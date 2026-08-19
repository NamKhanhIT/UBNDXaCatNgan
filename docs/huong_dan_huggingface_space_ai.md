# Sổ Tay Hướng Dẫn: Triển Khai AI Qwen2.5 Miễn Phí 100% Trên Hugging Face Spaces (SDK: Gradio)

Tài liệu này hướng dẫn cách triển khai máy chủ AI **Qwen2.5-3B** hoàn toàn miễn phí trên **Hugging Face Spaces** với **SDK Gradio** (cấu hình **2 vCPU + 16GB RAM**, không cần thẻ tín dụng), cung cấp đồng thời:
1. **Giao diện Web trực quan** để thử nghiệm bóc tách văn bản trực tiếp trên trình duyệt.
2. **Cổng OpenAI Chat Completions API (`/v1/chat/completions`)** kết nối tự động vào hệ thống Backend .NET UBND Xã Cát Ngạn.

---

## 1. Ưu Điểm Khi Dùng Gradio Space SDK
- **100% Miễn phí vĩnh viễn**: Không yêu cầu thẻ tín dụng (Credit Card / Visa / Mastercard).
- **Cấu hình mạnh**: Được cấp **2 vCPU + 16GB RAM** (CPU Basic - Free).
- **Cực kỳ đơn giản**: Chỉ cần **3 tệp** (`app.py`, `requirements.txt`, `README.md`), không cần cấu hình Docker phức tạp.
- **Có sẵn giao diện Web**: Dễ dàng kiểm thử chất lượng trả lời của mô hình ngay trên web.

---

## 2. Các Bước Triển Khai Trong 2 Phút

### Bước 1: Tạo Space Mới Trên Hugging Face
1. Truy cập: **[https://huggingface.co/new-space](https://huggingface.co/new-space)**
2. Đăng ký / Đăng nhập tài khoản (bằng Email hoặc GitHub).
3. Điền thông tin tạo Space:
   - **Space name**: `qwen-ubnd-catngan` (hoặc tên bạn muốn).
   - **License**: Chọn `mit`.
   - **Select the Space SDK**: Chọn **`Gradio`**.
   - **Space Hardware**: Chọn **`CPU basic (2 vCPU, 16GB RAM) - Free`**.
   - **Privacy**: Chọn `Public` (hoặc `Private` nếu muốn bảo mật).
4. Nhấn nút **Create Space**.

---

### Bước 2: Tải Mã Nguồn Lên Space (Có 2 Cách)

#### CÁCH 1: Kéo Thả Trực Tiếp Trên Trình Duyệt Web (Khuyên Dùng)
1. Trong trang Space vừa tạo, nhấn vào tab **Files and versions** ở menu phía trên.
2. Nhấn nút **Add file $\rightarrow$ Upload files**.
3. Mở thư mục [scripts/ai_pipeline/huggingface_space/](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/scripts/ai_pipeline/huggingface_space/) trên máy tính và kéo thả **3 tệp** sau vào trình duyệt:
   - `app.py`
   - `requirements.txt`
   - `README.md`
4. Cuộn xuống dưới, nhấn nút **Commit changes to main**.

#### CÁCH 2: Dùng Script Tự Động Qua Dòng Lệnh
Mở Terminal/PowerShell tại thư mục dự án và chạy:
```bash
python scripts/ai_pipeline/setup_huggingface.py
```

---

### Bước 3: Lấy Địa Chỉ API Sau Khi Space Hoạt Động
1. Sau khi commit, Hugging Face sẽ tự động cài đặt thư viện và nạp model Qwen2.5-3B (mất khoảng **1 – 2 phút**).
2. Khi trạng thái chuyển sang **Running** (màu xanh lá):
   - Nhấn vào biểu tượng **ba chấm (`...`)** ở góc trên bên phải của Space $\rightarrow$ Chọn **Embed this Space**.
   - Tìm dòng **Direct URL** (ví dụ: `https://yourusername-qwen-ubnd-catngan.hf.space`).
   - Đây chính là địa chỉ `BaseUrl` cho Backend .NET!

---

## 3. Cấu Hình Tích Hợp Vào Backend .NET

Mở tệp [src/Quanlycongviec.Api/appsettings.json](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/src/Quanlycongviec.Api/appsettings.json) và cập nhật:

```json
"AiProvider": {
  "Type": "ApiCompatible",
  "ConfidenceThreshold": 0.6,
  "Api": {
    "BaseUrl": "https://YOUR_USERNAME-qwen-ubnd-catngan.hf.space",
    "ApiKey": "",
    "Model": "qwen2.5-3b-instruct-q4_k_m",
    "DataSovereigntyAcknowledged": true
  }
}
```

> [!TIP]
> - Nếu Space ở chế độ **Public**: Để `"ApiKey": ""` (trống).
> - Nếu Space ở chế độ **Private**: Tạo token tại [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) và điền vào ô `"ApiKey": "hf_xxxx..."`.
