 #!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
HUGGING FACE GRADIO SPACE: QWEN 2.5 - UBND XÃ CÁT NGẠN
SDK: Gradio (Miễn phí 100% - 2 vCPU + 16GB RAM)
Cung cấp đồng thời:
1. Giao diện Web Gradio để kiểm thử trực tiếp trên trình duyệt
2. Cổng API chuẩn OpenAI: /v1/chat/completions, /v1/models, /health
=============================================================================
"""

import os
import time
import json
from typing import List, Optional
import gradio as gr
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
from huggingface_hub import hf_hub_download
from llama_cpp import Llama

# Cấu hình môi trường
MODEL_REPO = os.getenv("MODEL_REPO", "Qwen/Qwen2.5-3B-Instruct-GGUF")
MODEL_FILENAME = os.getenv("MODEL_FILENAME", "qwen2.5-3b-instruct-q4_k_m.gguf")
API_KEY = os.getenv("API_KEY", "")
N_CTX = int(os.getenv("N_CTX", "4096"))
N_THREADS = int(os.getenv("N_THREADS", "2"))

print("=" * 70)
print(f"🚀 [GRADIO SPACE] Đang tải mô hình: {MODEL_REPO} / {MODEL_FILENAME}...")

model_path = os.getenv("LOCAL_MODEL_PATH")
if not model_path or not os.path.exists(model_path):
    print("Đang nạp file GGUF từ Hugging Face Hub...")
    model_path = hf_hub_download(
        repo_id=MODEL_REPO,
        filename=MODEL_FILENAME,
        local_dir="/tmp/models"
    )

print(f"✅ Đường dẫn model: {model_path}")
print(f"Đang khởi tạo llama-cpp (n_ctx={N_CTX}, n_threads={N_THREADS})...")
llm = Llama(
    model_path=model_path,
    n_ctx=N_CTX,
    n_threads=N_THREADS,
    n_batch=512,
    verbose=False
)
print("🎉 Model Qwen2.5 đã sẵn sàng phục vụ!")
print("=" * 70)

START_TIME = time.time()

# Request/Response schemas cho OpenAI API
class ChatMessage(BaseModel):
    role: str
    content: str

class ResponseFormat(BaseModel):
    type: Optional[str] = "text"

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = "qwen2.5-3b-instruct-q4_k_m"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.2
    top_p: Optional[float] = 0.8
    max_tokens: Optional[int] = 2048
    response_format: Optional[ResponseFormat] = None
    stream: Optional[bool] = False

# Hàm sinh văn bản bằng model
def generate_text(prompt: str, system_prompt: str = "", temperature: float = 0.2, max_tokens: int = 1024):
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    res = llm.create_chat_completion(
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens
    )
    return res["choices"][0]["message"]["content"]

# Giao diện Gradio Web UI
custom_css = """
body { background-color: #0b1120; }
.gradio-container { max-width: 900px !important; margin: auto; }
"""

with gr.Blocks(title="UBND Xã Cát Ngạn - AI Gateway", css=custom_css, theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🏛️ UBND Xã Cát Ngạn - Cổng Trí Tuệ Nhân Tạo (Qwen2.5-3B)
    **Mô hình**: `Qwen2.5-3B-Instruct` | **Giao thức**: `OpenAI-Compatible API (/v1/chat/completions)`
    
    *Hệ thống phục vụ phân tích công văn, bóc tách dữ liệu theo Nghị định 30/2020/NĐ-CP và gợi ý điều phối nhiệm vụ.*
    """)

    with gr.Tab("🧪 Kiểm Thử Nhanh"):
        with gr.Row():
            with gr.Column():
                sys_input = gr.Textbox(
                    label="System Prompt",
                    value="Bạn là Trợ lý AI chuyên trách xử lý văn bản hành chính công vụ cho UBND Xã Cát Ngạn theo chuẩn Nghị định 30/2020/NĐ-CP. Trả về JSON.",
                    lines=3
                )
                user_input = gr.Textbox(
                    label="Nội dung văn bản / Yêu cầu",
                    placeholder="Nhập hoặc dán nội dung công văn cần bóc tách vào đây...",
                    lines=6
                )
                temp_slider = gr.Slider(minimum=0.0, maximum=1.0, value=0.2, step=0.05, label="Temperature")
                max_tokens_slider = gr.Slider(minimum=128, maximum=2048, value=1024, step=128, label="Max Tokens")
                submit_btn = gr.Button("⚡ Phân Tích & Bóc Tách Ngay", variant="primary")
            with gr.Column():
                output_text = gr.Textbox(label="Kết quả phản hồi từ AI", lines=14)

        submit_btn.click(
            fn=generate_text,
            inputs=[user_input, sys_input, temp_slider, max_tokens_slider],
            outputs=[output_text]
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
            "Model": "qwen2.5-3b-instruct-q4_k_m",
            "DataSovereigntyAcknowledged": true
          }}
        }}
        ```
        - **Endpoint API**: `/v1/chat/completions`
        - **Health Check**: `/health`
        """)

# Gắn các route FastAPI vào demo.app
app = demo.app

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "uptime_seconds": int(time.time() - START_TIME),
        "model": MODEL_FILENAME,
        "sdk": "gradio"
    }

@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": "qwen2.5-3b-instruct-q4_k_m",
                "object": "model",
                "created": int(START_TIME),
                "owned_by": "ubnd-cat-ngan"
            },
            {
                "id": "qwen-ubnd",
                "object": "model",
                "created": int(START_TIME),
                "owned_by": "ubnd-cat-ngan"
            }
        ]
    }

@app.post("/v1/chat/completions")
def chat_completions(req: ChatCompletionRequest):
    try:
        formatted_messages = [{"role": m.role, "content": m.content} for m in req.messages]

        response = llm.create_chat_completion(
            messages=formatted_messages,
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens,
            stream=False
        )

        content = response["choices"][0]["message"]["content"]

        # Nếu yêu cầu JSON mà nội dung bị bọc markdown ```json ... ```, tự động làm sạch
        if req.response_format and req.response_format.type == "json_object":
            clean_content = content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.startswith("```"):
                clean_content = clean_content[3:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            response["choices"][0]["message"]["content"] = clean_content.strip()

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI: {str(e)}")

# Khởi chạy Gradio app
if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
