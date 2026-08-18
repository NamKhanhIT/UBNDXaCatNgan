#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
KỊCH BẢN FINE-TUNING QWEN3-14B-INSTRUCT BẰNG UNSLOTH (QLoRA 4-BIT)
Tối ưu hóa đặc thù nghiệp vụ hành chính công vụ UBND Cấp Xã
Hỗ trợ chạy trên Google Colab Pro (A100/V100) hoặc Kaggle (T4x2)
=============================================================================

THAY ĐỔI SO VỚI BẢN CŨ (Qwen2.5-3B):
- Nâng cấp base model: Qwen2.5-3B → Qwen3-14B-Instruct
- Bỏ GGUF export → Xuất safetensors merged_16bit (tương thích ZeroGPU)
- Tăng MAX_SEQ_LENGTH: 2048 → 4096
- Tăng gradient_accumulation_steps: 4 → 8 (model lớn hơn)
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
MAX_SEQ_LENGTH = 4096
DTYPE = None  # Tự động phát hiện (Float16 cho T4, Bfloat16 cho Ampere/Hopper)
LOAD_IN_4BIT = True  # Tiết kiệm 4x VRAM khi load base model

# Model nền tảng: Qwen3-14B-Instruct (Unsloth optimized 4-bit)
# Yêu cầu tối thiểu: Google Colab Pro (A100 40GB) hoặc Kaggle T4x2
BASE_MODEL_NAME = "unsloth/Qwen3-14B-unsloth-bnb-4bit"
OUTPUT_DIR = "outputs_qwen3_ubnd"
TRAIN_DATASET_PATH = "scripts/ai_pipeline/data/ubnd_train.jsonl"
TEST_DATASET_PATH = "scripts/ai_pipeline/data/ubnd_test.jsonl"
MERGED_MODEL_DIR = "models_export/qwen3-14b-ubnd"


def main():
    print("=" * 70)
    print("🚀 KHỞI ĐỘNG TIẾN TRÌNH FINE-TUNING QWEN3-14B CHO UBND CẤP XÃ")
    print("=" * 70)
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU Device: {torch.cuda.get_device_name(0)}")
        print(f"Total VRAM: {torch.cuda.get_device_properties(0).total_mem / (1024**3):.2f} GB")

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
        lora_dropout=0,  # Unsloth tối ưu 0 dropout để tăng tốc
        bias="none",
        use_gradient_checkpointing="unsloth",  # Giảm 30% VRAM sử dụng
        random_state=3407,
        use_rslora=False,
        loftq_config=None,
    )

    # -----------------------------------------------------------------------
    # 4. CHUẨN BỊ VÀ ĐỊNH DẠNG DỮ LIỆU HUẤN LUYỆN & KIỂM THỬ ĐỘC LẬP
    # -----------------------------------------------------------------------
    print(f"\n[3/5] Đang nạp tập Train từ {TRAIN_DATASET_PATH} và Test từ {TEST_DATASET_PATH}...")
    if not os.path.exists(TRAIN_DATASET_PATH) or not os.path.exists(TEST_DATASET_PATH):
        raise FileNotFoundError(
            f"Không tìm thấy tệp dữ liệu Train/Test. "
            f"Vui lòng chạy generate_administrative_dataset.py trước!"
        )

    raw_datasets = load_dataset(
        "json",
        data_files={"train": TRAIN_DATASET_PATH, "test": TEST_DATASET_PATH}
    )
    print(f"Tổng số mẫu Train: {len(raw_datasets['train'])} | Tổng số mẫu Test: {len(raw_datasets['test'])}")

    def formatting_prompts_func(examples):
        convos = examples["messages"]
        texts = [
            tokenizer.apply_chat_template(
                convo, tokenize=False, add_generation_prompt=False
            )
            for convo in convos
        ]
        return {"text": texts}

    train_dataset = raw_datasets["train"].map(formatting_prompts_func, batched=True)
    eval_dataset = raw_datasets["test"].map(formatting_prompts_func, batched=True)

    # -----------------------------------------------------------------------
    # 5. TIẾN HÀNH HUẤN LUYỆN VỚI SFTTrainer
    # -----------------------------------------------------------------------
    print("\n[4/5] Đang bắt đầu huấn luyện SFTTrainer với đánh giá validation định kỳ...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        dataset_num_proc=2,
        packing=False,  # Không pack để giữ nguyên cấu trúc hội thoại
        args=TrainingArguments(
            per_device_train_batch_size=2,
            per_device_eval_batch_size=2,
            gradient_accumulation_steps=8,  # Tăng từ 4 lên 8 cho model 14B
            warmup_steps=10,
            num_train_epochs=3,  # 3 epochs đạt độ hội tụ cao cho 800 mẫu train
            learning_rate=2e-4,
            fp16=not is_bfloat16_supported(),
            bf16=is_bfloat16_supported(),
            logging_steps=10,
            eval_strategy="steps",
            eval_steps=20,
            save_strategy="steps",
            save_steps=50,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=3407,
            output_dir=OUTPUT_DIR,
            report_to="none",  # Không cần wandb
        ),
    )

    trainer_stats = trainer.train()
    print(
        f"✅ Huấn luyện thành công! "
        f"Tổng thời gian: {trainer_stats.metrics.get('train_runtime', 0):.2f} giây"
    )

    # -----------------------------------------------------------------------
    # 6. XUẤT RA SAFETENSORS MERGED_16BIT (TƯƠNG THÍCH ZEROGPU / TRANSFORMERS)
    # -----------------------------------------------------------------------
    print(f"\n[5/5] Đang merge LoRA adapters và xuất checkpoint safetensors (16-bit)...")
    os.makedirs(MERGED_MODEL_DIR, exist_ok=True)

    # Merge LoRA vào base model và xuất dạng safetensors 16-bit
    # Đây là định dạng ZeroGPU/transformers load được trực tiếp
    model.save_pretrained_merged(
        MERGED_MODEL_DIR,
        tokenizer,
        save_method="merged_16bit",
    )

    print("=" * 70)
    print("🎉 HOÀN TẤT XUẤT CHECKPOINT SAFETENSORS THÀNH CÔNG!")
    print(f"Thư mục checkpoint: {MERGED_MODEL_DIR}/")
    print("Các file đầu ra: config.json, *.safetensors, tokenizer.json, ...")
    print()
    print("📤 BƯỚC TIẾP THEO — Upload lên HuggingFace Model Repo:")
    print("  1. pip install huggingface_hub")
    print("  2. huggingface-cli login")
    print(f"  3. huggingface-cli upload your-username/qwen3-14b-ubnd {MERGED_MODEL_DIR}/ .")
    print()
    print("Sau đó cấu hình MODEL_ID trong ZeroGPU Space Settings trỏ tới repo đã upload.")
    print("=" * 70)


if __name__ == "__main__":
    main()
