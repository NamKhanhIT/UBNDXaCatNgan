# Hướng Dẫn Vận Hành & Host Mô Hình AI Nội Bộ (UBND Xã Cát Ngạn)

> **Dự án**: Hệ Thống Quản Lý & Điều Hành Tác Nghiệp UBND Xã Cát Ngạn  
> **Áp dụng**: Pipeline AI Phân Tích Văn Bản Hành Chính (Prompt F)  
> **Cập nhật**: Tháng 08/2026

---

## 1. Yêu Cầu Phần Cứng & Lựa Chọn Mô Hình AI

| Cấu Hình Máy Chủ Xã | Model Khuyến Nghị | VRAM / RAM Tối Thiểu | Tốc Độ Ước Tính |
|---|---|---|---|
| **Máy chủ có GPU rời** (RTX 3060/4060 12GB hoặc RTX 3080/4070 trở lên) | `qwen3.6:35b-a3b` *(MoE 35B)* | 12GB – 16GB VRAM | 1.5 – 3 giây / văn bản |
| **Máy trạm phổ thông** (Core i7 / Ryzen 7, RAM 16GB–32GB, không GPU) | `qwen3.5:4b` | 8GB – 16GB RAM | 4 – 8 giây / văn bản |

---

## 2. Các Bước Cài Đặt & Host Ollama Trên Máy Chủ Xã

### Bước 1: Cài đặt Ollama
- **Windows**: Tải file cài đặt từ [ollama.com/download](https://ollama.com/download) và cài đặt dạng Background Service.
- **Linux (Ubuntu Server)**:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```

### Bước 2: Tải mô hình AI
Mở Command Prompt / Terminal và chạy lệnh kéo model về máy chủ nội bộ:
```bash
# Đối với máy có GPU (Khuyến nghị chính thức):
ollama pull qwen3.6:35b-a3b

# Hoặc đối với máy chỉ chạy CPU:
ollama pull qwen3.5:4b
```

### Bước 3: Cấu hình cổng và truy cập
Mặc định Ollama lắng nghe tại `http://localhost:11434`.
Kiểm tra Ollama đang chạy bằng lệnh:
```bash
curl http://localhost:11434/api/tags
```

---

## 3. Cài Đặt Tesseract OCR & Gói Ngôn Ngữ Tiếng Việt

1. Tạo thư mục `tessdata` trong thư mục chạy của backend (`src/Quanlycongviec.Api/tessdata/` hoặc thư mục gốc ứng dụng).
2. Tải tệp `vie.traineddata` (Tiếng Việt) từ kho chính thức Tesseract OCR và đặt vào `tessdata/vie.traineddata`.
3. Hệ thống sẽ tự động sử dụng `vie.traineddata` khi nhận diện văn bản scan/ảnh chụp.

---

## 4. Cấu Hình Ứng Dụng (`appsettings.json`)

```json
{
  "AiProvider": {
    "Type": "Ollama",
    "ConfidenceThreshold": 0.6,
    "Ollama": {
      "BaseUrl": "http://localhost:11434",
      "Model": "qwen3.6:35b-a3b"
    },
    "Api": {
      "BaseUrl": "https://api.openai.com/v1",
      "ApiKey": "",
      "Model": "gpt-4o",
      "DataSovereigntyAcknowledged": false
    }
  },
  "FileUpload": {
    "MaxFileSizeMB": 20,
    "AllowedExtensions": "pdf,doc,docx,jpg,jpeg,png,xlsx"
  }
}
```

---

## 5. Danh Mục Kiểm Tra Vận Hành Sau Bàn Giao (Checklist)

- [ ] **1. Cập nhật hồ sơ chuyên môn cán bộ**:
  - Toàn bộ tài khoản cán bộ sau khi migrate cơ sở dữ liệu sẽ có `YearsOfExperience = 0`.
  - Quản trị viên/Chánh văn phòng cần vào module **Phòng ban & Cán bộ** để cập nhật trường `Expertise` (VD: *"Địa chính, Quy hoạch, TTHC"*) và `YearsOfExperience` (số năm kinh nghiệm thật) cho từng cán bộ.
  - Việc này giúp tính năng AI gợi ý giao việc đưa ra lý do chính xác và tối ưu nhất.

- [ ] **2. Kiểm thử thực tế với 5–10 mẫu văn bản scan có dấu mộc đỏ**:
  - Thực hiện tải lên các văn bản photocopy, văn bản có dấu mộc đỏ và chữ ký tay đè lên chữ in.
  - Ghi nhận tỷ lệ trích xuất đúng của OCR để cán bộ văn thư nắm được chất lượng bản scan cần thiết (khuyến nghị scan độ phân giải $\ge 300\text{ DPI}$).

- [ ] **3. Cảnh báo chủ quyền dữ liệu**:
  - Tuyệt đối không bật `AiProvider:Type = ApiCompatible` nếu chưa có văn bản phê duyệt của Chủ tịch UBND xã về việc gửi nội dung văn bản ra ngoài hạ tầng mạng nội bộ.
  - Cơ chế fail-fast đã được lập trình để chặn khởi động nếu cố ý bật API ngoài mà chưa có xác nhận `DataSovereigntyAcknowledged = true`.
