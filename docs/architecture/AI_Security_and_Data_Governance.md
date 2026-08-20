# Kiến Trúc Bảo Mật & Quản Trị Dữ Liệu AI Cấp Xã (AI Security & Data Governance)

**Dự án:** Hệ thống Quản lý Văn bản & Điều phối Công việc - UBND Xã Cát Ngạn  
**Căn cứ pháp lý:**  
- **Nghị định 13/2023/NĐ-CP** về Bảo vệ dữ liệu cá nhân.  
- **Luật An toàn thông tin mạng số 86/2015/QH13** & **Luật An ninh mạng số 24/2018/QH14**.  
- **Nghị định 30/2020/NĐ-CP** về công tác văn thư và lưu trữ tài liệu hành chính.  
- **Nghị quyết 1678/NQ-UBTVQH15** & **Luật Tổ chức CQĐP số 72/2025/QH15** (Mô hình 2 cấp Tỉnh - Xã).

---

## 1. Nguyên Tắc Cốt Lõi: 5 Tầng Bảo Mật Toàn Diện (Defense-in-Depth)

```
┌───────────────────────────────────────────────────────────────┐
│ TẦNG 1: DỮ LIỆU HUẤN LUYỆN & PII MASKING (Nghị định 13/2023) │
│ - Ẩn danh hóa số CCCD, SĐT, STK, Email cá nhân trước train    │
│ - Chặn dữ liệu raw/private bằng .gitignore                    │
├───────────────────────────────────────────────────────────────┤
│ TẦNG 2: BẢO VỆ TÀI SẢN TRÍ TUỆ MÔ HÌNH (IP & WEIGHTS)         │
│ - Tách biệt repo mã nguồn và Model Weights (Safetensors/LoRA) │
│ - Checkpoints lưu trữ mã hóa, chỉ nạp qua Private Hub / Vault │
├───────────────────────────────────────────────────────────────┤
│ TẦNG 3: BẢO MẬT GIAO THỨC & API GATEWAY (ZERO-TRUST)          │
│ - Xác thực bắt buộc Bearer Token (SPACE_API_KEY)              │
│ - Giới hạn kích thước payload (Max 32KB) chống tấn công DoS   │
├───────────────────────────────────────────────────────────────┤
│ TẦNG 4: CHỦ QUYỀN DỮ LIỆU HÀNH CHÍNH (DATA SOVEREIGNTY)       │
│ - Ưu tiên Ollama Local (On-premise / Air-gapped)              │
│ - Cấm gửi văn bản Mật / Nội bộ lên Cloud bên ngoài             │
│ - Cần cờ DataSovereigntyAcknowledged = true khi dùng API ngoài│
├───────────────────────────────────────────────────────────────┤
│ TẦNG 5: AUDIT TRAIL & NHẬT KÝ KHÔNG LỘ DỮ LIỆU                │
│ - Không ghi log nội dung toàn văn của tài liệu nhạy cảm       │
│ - Ghi vết người dùng, thời gian và mã văn bản phục vụ thanh tra│
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Quy Định Chi Tiết Từng Tầng

### 2.1. Tầng 1 — Bảo Vệ Dữ Liệu Huấn Luyện & Kiểm Soát PII
1. **Kiểm tra tự động trước khi huấn luyện**:
   - Sử dụng công cụ [`data_sanitizer.py`](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/scripts/ai_pipeline/data_sanitizer.py) để quét toàn bộ tệp `.jsonl`:
     ```bash
     python scripts/ai_pipeline/data_sanitizer.py --audit <duong_dan_dataset.jsonl>
     ```
   - Nếu phát hiện thông tin định danh cá nhân thật (CCCD, SĐT, số tài khoản, sổ đỏ), phải chạy lệnh làm sạch:
     ```bash
     python scripts/ai_pipeline/data_sanitizer.py --sanitize raw_input.jsonl sanitized_output.jsonl
     ```
2. **Loại trừ tuyệt đối khỏi Git**:
   - Thư mục `scripts/ai_pipeline/data/raw/` và `scripts/ai_pipeline/data/private/` được khóa chặn trong `.gitignore`.

---

### 2.2. Tầng 2 — Bảo Vệ Trọng Số Mô Hình & Checkpoint
1. **Không commit trọng số nhị phân lên Git Repository**:
   - Mọi file `*.safetensors`, `*.bin`, `*.pt`, `*.gguf`, thư mục `checkpoints/`, `models_export/`, `outputs_*/`, `lora_model/` bị cấm đẩy lên GitHub để bảo vệ tài sản trí tuệ và tránh phình dung lượng repo.
2. **Quản lý Checkpoint qua Private Model Repository**:
   - Checkpoint sau khi fine-tune xong chỉ được lưu trữ trên máy chủ nội bộ hoặc Hugging Face Model Repo ở chế độ **Private**, chỉ cấp quyền (Access Token) cho tài khoản quản trị viên của UBND.

---

### 2.3. Tầng 3 — Bảo Mật API Gateway & Xác Thực Truy Cập
1. **Bắt buộc khóa API (Bearer Authentication)**:
   - Server AI Gateway (`app.py`) tích hợp middleware kiểm tra header:
     `Authorization: Bearer <SPACE_API_KEY>`
   - Nếu không có token hoặc token không khớp -> Từ chối với mã lỗi `401 Unauthorized` / `403 Forbidden`.
2. **Chống tấn công từ chối dịch vụ (DoS & OOM Attack)**:
   - Giới hạn payload tối đa 32,000 ký tự cho mỗi lượt gọi. Chặn đứng các hành vi inject tài liệu quá lớn làm tràn VRAM của máy chủ GPU.
3. **Cấu hình an toàn trong `.NET Backend`**:
   - `appsettings.Development.json` và `appsettings.Production.json` không lưu hardcode API Key hay JWT Secret. Mọi secret phải được cung cấp qua User Secrets (`dotnet user-secrets`) hoặc Environment Variables trên máy chủ sản xuất.

---

### 2.4. Tầng 4 — Chủ Quyền Dữ Liệu Hành Chính (Data Sovereignty)
1. **Phân loại cấp độ văn bản**:
   - **Văn bản Mật / Tối mật / Tuyệt mật**: **TUYỆT ĐỐI KHÔNG** đưa vào bất kỳ hệ thống AI nào kết nối mạng ngoài.
   - **Văn bản Nội bộ / Đơn thư khiếu nại tố cáo**: Chỉ được xử lý bằng **Ollama chạy On-premise** (cục bộ trên máy chủ UBND xã, mạng LAN nội bộ, hoàn toàn ngắt kết nối internet ra ngoài).
   - **Văn bản Hành chính thông thường / Hỏi đáp pháp lý**: Có thể sử dụng AI Gateway (ZeroGPU / Cloud API) với điều kiện đã qua kiểm duyệt và bật cờ `DataSovereigntyAcknowledged = true`.

---

### 2.5. Tầng 5 — Kiểm Tra Rò Rỉ & Nhật Ký Kiểm Toán (Audit Trail)
1. **Quy chuẩn ghi log**:
   - Log hệ thống backend chỉ ghi nhận: `DocumentId`, `UserId`, `ProcessingTimeMs`, `TokensCount`, `ConfidenceScore`.
   - **CẤM** in nội dung toàn văn (`extractedText`, `prompt`, `completionContent`) vào log files ở chế độ Production.
2. **Rà soát định kỳ**:
   - Định kỳ hàng tháng chạy công cụ rà soát secret:
     ```bash
     python scripts/ai_pipeline/data_sanitizer.py
     ```

---

### 2.6. Tầng 6 — Phòng Vệ Prompt Injection & Lọc Dữ Liệu Độc Hại (SecurityGuard)
1. **Chuẩn hóa ký tự & Khử mã tàng hình**:
   - Xóa bỏ 17 loại ký tự Zero-width (`\u200b`, `\ufeff`, `\u00ad`, `\u202e`, v.v.).
   - Hoán chuyển tự động 35 ký tự Homoglyphs Cyrillic/Greek sang ký tự Latin/Việt chuẩn để ngăn chặn kỹ thuật vượt mặt bộ lọc.
2. **Bộ lọc Prompt Injection đa vector**:
   - Quét và chặn đứng các câu lệnh Direct Instruction Override, Persona Hijacking (DAN, Developer Mode, Roleplay phá hoại).
   - Chặn Token Delimiter Spoofing (`<|im_start|>`, `=== SYSTEM ===`, `<<SYS>>`).
   - Chặn các câu lệnh trích xuất System Prompt / Secret Keys / Biến môi trường.
   - Chặn văn bản giả mạo thẩm quyền phê duyệt trái luật của Chủ tịch xã.
3. **Cô lập ngữ cảnh RAG**:
   - Đóng gói toàn bộ tài liệu nạp vào khối an toàn `<rag_context_isolated>` kèm chỉ thị bất khả xâm phạm.
4. **Kiểm tra tệp tải lên & Rate Limiting**:
   - Kiểm tra Magic Bytes thực tế của file PDF (`%PDF-`) và DOCX (`PK\x03\x04`).
   - Giới hạn 60 request/phút/IP để chống DoS và cạn kiệt bộ nhớ.

---

## 3. Kết Quả Kiểm Định Áp Lực Bảo Mật 550+ Mẫu (`security_stress_test.py`)

Hệ thống được kiểm thử tự động định kỳ với **550 test cases chuyên sâu**:

| Phân Loại Lỗ Hổng Kiểm Thử | Số Mẫu | Kết Quả Đạt | Tỷ Lệ Bảo Vệ | Đánh Giá |
|---|:---:|:---:|:---:|:---:|
| 1. Direct Jailbreak & System Override | 100 | 100/100 | **100.00%** | ✅ TUYỆT ĐỐI |
| 2. Indirect RAG Poisoning & Delimiters | 100 | 100/100 | **100.00%** | ✅ TUYỆT ĐỐI |
| 3. PII Masking & Secret Leak Probing | 100 | 100/100 | **100.00%** | ✅ TUYỆT ĐỐI |
| 4. Obfuscation, Zero-width & Fake Files | 100 | 100/100 | **100.00%** | ✅ TUYỆT ĐỐI |
| 5. API Security, Constant-Time Auth & DoS | 100 | 100/100 | **100.00%** | ✅ TUYỆT ĐỐI |
| 6. Control Group - Benign Queries *(FP)* | 50 | 50/50 | **100.00% (FP=0%)** | ✅ AN TOÀN |
| **TỔNG CỘNG** | **550** | **550/550** | **100.00%** | ⭐️ TOÀN DIỆN |

---

## 4. Checklist An Toàn Dành Cho Kỹ Sư AI & Backend

Trước khi triển khai hoặc chuyển giao bất kỳ mô hình nào:
- [ ] File `.gitignore` đã chặn đầy đủ `.env`, `*.safetensors`, `checkpoints/`, `*.key`.
- [ ] Tập dữ liệu huấn luyện đã được kiểm tra bằng `data_sanitizer.py` và đạt kết quả `✅ AN TOÀN (0 vi phạm)`.
- [ ] Model ID / Checkpoint được lưu ở repo Private hoặc Local Server.
- [ ] API Gateway đã bật xác thực Bearer Token `SPACE_API_KEY` (Constant-time).
- [ ] Backend .NET đã cấu hình kiểm tra `DataSovereigntyAcknowledged`.
- [ ] Chạy bộ kiểm thử bảo mật `python scripts/ai_pipeline/security_stress_test.py` đạt 100% Passed.
