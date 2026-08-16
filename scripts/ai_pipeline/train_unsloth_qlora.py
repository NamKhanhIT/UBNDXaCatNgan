#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
KỊCH BẢN FINE-TUNING QWEN2.5-7B-INSTRUCT BẰNG UNSLOTH (QLoRA 4-BIT)
Tối ưu hóa đặc thù nghiệp vụ hành chính công vụ UBND Xã Cát Ngạn
Hỗ trợ chạy trên Google Colab Free (T4 16GB GPU) hoặc Kaggle (T4x2)
=============================================================================
"""

import os
import torch
from datasets import load_dataset
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from unsloth import is_bfloat16_supported

# ---------------------------------------------------------------------------
# 1. CẤU HÌNH SIÊU THAM SỐ (Hyperparameters)
# ---------------------------------------------------------------------------
MAX_SEQ_LENGTH = 2048
DTYPE = None # Tự động phát hiện (Float16 cho T4, Bfloat16 cho Ampere/Hopper)
LOAD_IN_4BIT = True # Tiết kiệm 4x VRAM khi load base model

# Model nền tảng: Qwen2.5-3B tối ưu cho Oracle Cloud Free ARM (2 OCPU + 12GB RAM)
# Cũng có thể thay bằng "unsloth/Qwen2.5-7B-Instruct-bnb-4bit" nếu muốn model lớn hơn
BASE_MODEL_NAME = "unsloth/Qwen2.5-3B-Instruct-bnb-4bit"
OUTPUT_DIR = "outputs_qwen_ubnd"
DATASET_PATH = "scripts/ai_pipeline/data/ubnd_administrative_dataset.jsonl"
GGUF_MODEL_NAME = "qwen2.5-3b-ubnd-catngan"
QUANTIZATION_METHOD = "q4_k_m" # Tối ưu cho Oracle Cloud ARM CPU (12GB RAM)

def main():
    print("=" * 70)
    print("🚀 KHỞI ĐỘNG TIẾN TRÌNH FINE-TUNING QWEN2.5 CHO UBND XÃ CÁT NGẠN")
    print("=" * 70)
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU Device: {torch.cuda.get_device_name(0)}")
        print(f"Total VRAM: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")

    # -----------------------------------------------------------------------
    # 2. TẢI BASE MODEL & TOKENIZER
    # -----------------------------------------------------------------------
    print(f"\n[1/5] Đang tải mô hình nền tảng: {BASE_MODEL_NAME}...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL_NAME,
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=DTYPE,
        load_in_4bit=LOAD_IN_4BIT,
    )

    # -----------------------------------------------------------------------
    # 3. THIẾT LẬP LoRA ADAPTERS (QLoRA)
    # -----------------------------------------------------------------------
    print("\n[2/5] Đang cấu hình QLoRA Adapters trên toàn bộ Attention & MLP layers...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=16,
        lora_dropout=0, # Unsloth tối ưu 0 dropout để tăng tốc
        bias="none",
        use_gradient_checkpointing="unsloth", # Giảm 30% VRAM sử dụng
        random_state=3407,
        use_rslora=False,
        loftq_config=None,
    )

    # -----------------------------------------------------------------------
    # 4. CHUẨN BỊ VÀ ĐỊNH DẠNG DỮ LIỆU HUẤN LUYỆN
    # -----------------------------------------------------------------------
    print(f"\n[3/5] Đang nạp tập dữ liệu hành chính từ: {DATASET_PATH}...")
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Không tìm thấy tệp {DATASET_PATH}. Vui lòng chạy generate_administrative_dataset.py trước!")

    dataset = load_dataset("json", data_files={"train": DATASET_PATH}, split="train")
    print(f"Tổng số mẫu huấn luyện: {len(dataset)}")

    def formatting_prompts_func(examples):
        convos = examples["messages"]
        texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
        return {"text": texts}

    dataset = dataset.map(formatting_prompts_func, batched=True)

    # -----------------------------------------------------------------------
    # 5. TIẾN HÀNH HUẤN LUYỆN VỚI SFTTrainer
    # -----------------------------------------------------------------------
    print("\n[4/5] Đang bắt đầu huấn luyện SFTTrainer...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        dataset_num_proc=2,
        packing=False, # Không pack để giữ nguyên cấu trúc hội thoại
        args=TrainingArguments(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_steps=10,
            num_train_epochs=3, # 3 epochs đạt độ hội tụ cao cho 300-1000 mẫu
            learning_rate=2e-4,
            fp16=not is_bfloat16_supported(),
            bf16=is_bfloat16_supported(),
            logging_steps=10,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=3407,
            output_dir=OUTPUT_DIR,
            report_to="none", # Không cần wandb
        ),
    )

    trainer_stats = trainer.train()
    print(f"✅ Huấn luyện thành công! Tổng thời gian: {trainer_stats.metrics.get('train_runtime', 0):.2f} giây")

    # -----------------------------------------------------------------------
    # 6. XUẤT RA ĐỊNH DẠNG GGUF (Q4_K_M) ĐỂ CHẠY OLLAMA CỤC BỘ
    # -----------------------------------------------------------------------
    print(f"\n[5/5] Đang chuyển đổi và xuất sang định dạng GGUF ({QUANTIZATION_METHOD})...")
    os.makedirs("models_export", exist_ok=True)
    
    # Xuất file GGUF
    model.save_pretrained_gguf(
        f"models_export/{GGUF_MODEL_NAME}",
        tokenizer,
        quantization_method=QUANTIZATION_METHOD
    )

    print("=" * 70)
    print("🎉 HOÀN TẤT XUẤT FILE MODEL GGUF THÀNH CÔNG!")
    print(f"Tệp GGUF đã được tạo tại: models_export/{GGUF_MODEL_NAME}-{QUANTIZATION_METHOD.upper()}.gguf")
    print("Bạn có thể tải tệp này về máy cá nhân và nạp vào Ollama để sử dụng 100% Offline.")
    print("=" * 70)

if __name__ == "__main__":
    main()
