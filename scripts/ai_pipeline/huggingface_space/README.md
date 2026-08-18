---
title: AssistantForUBND
emoji: 👁
colorFrom: blue
colorTo: blue
sdk: gradio
sdk_version: 6.24.0
python_version: '3.12'
app_file: app.py
pinned: false
license: mit
---

# 🏛️ Hệ Thống Trí Tuệ Nhân Tạo Xử Lý Văn Bản - UBND Cấp Xã (Xã/Phường/Thị trấn)
Máy chủ AI phân tích, bóc tách công văn hành chính, trích xuất bảng phân công, soạn thảo văn bản và điều phối giao việc theo chuẩn **Nghị định 30/2020/NĐ-CP**.

- **Mô hình**: `Qwen/Qwen3-14B` (Tắt thinking mode — trả kết quả JSON cấu trúc nhanh gọn)
- **Quantization**: 4-bit NF4 (bitsandbytes) — tối ưu bộ nhớ VRAM (~8-10GB)
- **Phần cứng**: ZeroGPU (cấp phát động qua `@spaces.GPU`)
- **Giao thức API**: Chuẩn OpenAI Chat Completions (`/v1/chat/completions`)

## 🔌 Cấu hình kết nối Backend .NET

Cập nhật file `appsettings.json` trong dự án Backend:

```json
"AiProvider": {
  "Type": "ApiCompatible",
  "ConfidenceThreshold": 0.6,
  "Api": {
    "BaseUrl": "https://<USER>-<SPACE_NAME>.hf.space",
    "ApiKey": "",
    "Model": "qwen3-14b-ubnd",
    "DataSovereigntyAcknowledged": true
  }
}
```

- **Health check**: `https://<USER>-<SPACE_NAME>.hf.space/health`
- **OpenAI API**: `https://<USER>-<SPACE_NAME>.hf.space/v1/chat/completions`
