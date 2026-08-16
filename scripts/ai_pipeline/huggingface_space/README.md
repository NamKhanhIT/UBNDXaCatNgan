---
title: Qwen3-14B UBND Cấp Xã AI
emoji: 🏛️
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
license: mit
---

# 🏛️ Hệ Thống Trí Tuệ Nhân Tạo Xử Lý Văn Bản - UBND Cấp Xã (Xã/Phường/Thị trấn)
Máy chủ AI phân tích, bóc tách công văn hành chính, trích xuất bảng phân công, soạn thảo văn bản và điều phối giao việc theo chuẩn **Nghị định 30/2020/NĐ-CP**.

- **Mô hình**: `Qwen3-14B-Instruct` (Fine-tuned cho nghiệp vụ hành chính công vụ)
- **Quantization**: 4-bit NF4 (bitsandbytes) — chỉ ~8-10GB VRAM
- **Phần cứng**: ZeroGPU (H200, cấp phát động qua `@spaces.GPU`)
- **Giao thức**: Chuẩn OpenAI Chat Completions API (`/v1/chat/completions`)

## ⚙️ Cấu hình bắt buộc

Vào **Settings → Variables and secrets**, thêm biến:
- `MODEL_ID`: Trỏ tới Model Repo chứa checkpoint đã fine-tune (ví dụ: `your-username/qwen3-14b-ubnd`)

## 🔌 Kết nối Backend .NET

```json
"AiProvider": {
  "Type": "ApiCompatible",
  "Api": {
    "BaseUrl": "https://<TÊN-SPACE>.hf.space",
    "Model": "qwen3-14b-ubnd",
    "DataSovereigntyAcknowledged": true
  }
}
```
