#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
HUGGING FACE ZEROGPU SPACE: QWEN3-14B - UBND CẤP XÃ (Xã/Phường/Thị trấn)
SDK: Gradio + ZeroGPU (H200, cấp phát động qua @spaces.GPU)
Quantization: bitsandbytes 4-bit (NF4) — giảm VRAM ~8-10GB, tăng throughput
=============================================================================
"""

import os
import time
import spaces
import torch
import gradio as gr
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

# ---------------------------------------------------------------------------
# CẤU HÌNH MODEL
# ---------------------------------------------------------------------------
MODEL_ID = os.getenv("MODEL_ID", "")
if not MODEL_ID:
    raise RuntimeError(
        "⚠️ CHƯA CẤU HÌNH MODEL_ID — vào Space Settings → Variables and secrets, "
        "thêm biến MODEL_ID trỏ tới Model Repo chứa checkpoint đã fine-tune "
        "(ví dụ: your-username/qwen3-14b-ubnd). "
        "Nếu chưa fine-tune, có thể dùng tạm: Qwen/Qwen3-14B-Instruct"
    )

print("=" * 70)
print(f"🚀 Đang tải model: {MODEL_ID} (4-bit quantization via bitsandbytes)...")

# Cấu hình 4-bit quantization — giảm VRAM từ ~30GB xuống ~8-10GB
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)
model.eval()

print("🎉 Model đã sẵn sàng phục vụ trên ZeroGPU (4-bit NF4)!")
print("=" * 70)

START_TIME = time.time()
USING_FINETUNED = "ubnd" in MODEL_ID.lower()

# ---------------------------------------------------------------------------
# REQUEST / RESPONSE SCHEMAS (OpenAI-Compatible API)
# ---------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: str
    content: str

class ResponseFormat(BaseModel):
    type: Optional[str] = "text"

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = "qwen3-14b-ubnd"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.2
    top_p: Optional[float] = 0.8
    max_tokens: Optional[int] = 1024
    response_format: Optional[ResponseFormat] = None
    stream: Optional[bool] = False


# ---------------------------------------------------------------------------
# HÀM SINH VĂN BẢN CHÍNH (GPU-accelerated qua ZeroGPU)
# ---------------------------------------------------------------------------
# duration=20: Ước tính mỗi lần gọi ~8-15 giây với 4-bit quantization.
# Free tier: 300s/ngày ÷ 20s = ~15 lần gọi/ngày.
# Nếu văn bản đầu vào dài cần nhiều token sinh ra hơn, tăng số này.
@spaces.GPU(duration=20)
def generate_completion(messages: list, temperature: float, top_p: float, max_tokens: int) -> str:
    """Sinh text từ danh sách messages theo chuẩn chat template của model."""
    text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(text, return_tensors="pt").to(model.device)

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature if temperature > 0 else None,
            top_p=top_p if temperature > 0 else None,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
        )

    # Chỉ lấy phần tokens mới sinh ra (bỏ phần prompt)
    generated = output_ids[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(generated, skip_special_tokens=True)


def generate_text_ui(
    prompt: str,
    system_prompt: str = "",
    temperature: float = 0.2,
    max_tokens: int = 1024,
):
    """Wrapper cho giao diện Gradio UI."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    return generate_completion(messages, temperature, 0.8, max_tokens)


# ---------------------------------------------------------------------------
# GIAO DIỆN GRADIO WEB UI
# ---------------------------------------------------------------------------
custom_css = """
body { background-color: #0b1120; }
.gradio-container { max-width: 900px !important; margin: auto; }
"""

with gr.Blocks(
    title="UBND Cấp Xã - AI Gateway (Qwen3-14B ZeroGPU)",
    css=custom_css,
    theme=gr.themes.Soft(),
) as demo:
    gr.Markdown(f"""
    # 🏛️ UBND Cấp Xã - Cổng Trí Tuệ Nhân Tạo (Qwen3-14B, ZeroGPU 4-bit)
    **Model đang chạy**: `{MODEL_ID}` | **Quantization**: `4-bit NF4` | **Đã fine-tune**: `{"✅ Có" if USING_FINETUNED else "⚠️ CHƯA — đây có thể là model gốc"}`

    *Hệ thống phục vụ phân tích công văn, bóc tách dữ liệu theo Nghị định 30/2020/NĐ-CP, trích xuất bảng phân công, và soạn thảo văn bản hành chính.*
    """)

    with gr.Tab("🧪 Kiểm Thử Nhanh"):
        with gr.Row():
            with gr.Column():
                sys_input = gr.Textbox(
                    label="System Prompt",
                    value=(
                        "Bạn là Trợ lý AI chuyên trách xử lý văn bản hành chính công vụ "
                        "cho UBND cấp Xã theo chuẩn Nghị định 30/2020/NĐ-CP. Trả về JSON."
                    ),
                    lines=3,
                )
                user_input = gr.Textbox(
                    label="Nội dung văn bản / Yêu cầu",
                    placeholder="Nhập hoặc dán nội dung công văn cần bóc tách vào đây...",
                    lines=6,
                )
                temp_slider = gr.Slider(
                    minimum=0.0, maximum=1.0, value=0.2, step=0.05, label="Temperature"
                )
                max_tokens_slider = gr.Slider(
                    minimum=128, maximum=2048, value=1024, step=128, label="Max Tokens"
                )
                submit_btn = gr.Button(
                    "⚡ Phân Tích & Bóc Tách Ngay", variant="primary"
                )
            with gr.Column():
                output_text = gr.Textbox(label="Kết quả phản hồi từ AI", lines=14)

        submit_btn.click(
            fn=generate_text_ui,
            inputs=[user_input, sys_input, temp_slider, max_tokens_slider],
            outputs=[output_text],
        )

    with gr.Tab("ℹ️ Thông Tin Kết Nối API Backend .NET"):
        gr.Markdown(f"""
        ### 🔌 Cấu Hình Trong `appsettings.json` Của Dự Án .NET:
        ```json
        "AiProvider": {{
          "Type": "ApiCompatible",
          "ConfidenceThreshold": 0.6,
          "Api": {{
            "BaseUrl": "https://<TÊN_SPACE_CỦA_BẠN>.hf.space",
            "ApiKey": "",
            "Model": "qwen3-14b-ubnd",
            "DataSovereigntyAcknowledged": true
          }}
        }}
        ```
        - **Endpoint API**: `/v1/chat/completions`
        - **Health Check**: `/health`
        - **Lưu ý ZeroGPU**: Free tier = 5 phút GPU/ngày (~15 lần gọi với duration=20s).
          Nâng PRO ($9/tháng) để có 5x quota (~75 lần/ngày) và hàng đợi ưu tiên.
        """)


# ---------------------------------------------------------------------------
# FASTAPI ENDPOINTS (OpenAI-Compatible)
# ---------------------------------------------------------------------------
app = demo.app


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "uptime_seconds": int(time.time() - START_TIME),
        "model": MODEL_ID,
        "using_finetuned_model": USING_FINETUNED,
        "quantization": "4-bit NF4 (bitsandbytes)",
        "sdk": "gradio+zerogpu",
    }


@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": "qwen3-14b-ubnd",
                "object": "model",
                "created": int(START_TIME),
                "owned_by": "ubnd-cap-xa",
            }
        ],
    }


@app.post("/v1/chat/completions")
def chat_completions(req: ChatCompletionRequest):
    try:
        formatted_messages = [
            {"role": m.role, "content": m.content} for m in req.messages
        ]
        content = generate_completion(
            formatted_messages, req.temperature, req.top_p, req.max_tokens
        )

        # Nếu yêu cầu JSON mà nội dung bị bọc markdown ```json ... ```, tự động làm sạch
        if req.response_format and req.response_format.type == "json_object":
            clean_content = content.strip()
            for fence in ("```json", "```"):
                if clean_content.startswith(fence):
                    clean_content = clean_content[len(fence):]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            content = clean_content.strip()

        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": req.model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI: {str(e)}")


# ---------------------------------------------------------------------------
# KHỞI CHẠY
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
