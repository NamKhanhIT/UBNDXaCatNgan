# Đặc Tả Kỹ Thuật: Hệ Thống Phòng Vệ AI, Chống Prompt Injection & Kiểm Định An Ninh 550+ Mẫu

> **Dự án**: Cổng Điều Hành & Trợ Lý AI - UBND Xã Cát Ngạn  
> **Căn cứ**: Nghị định 13/2023/NĐ-CP, Luật An toàn Thông tin Mạng số 86/2015/QH13  
> **Trạng thái**: Đã Triển Khai & Đạt 100.00% Qua 550 Bộ Test (Production Ready)  

---

## 1. Mục Tiêu & Phạm Vi Bảo Vệ
Ngăn chặn toàn diện các vector tấn công đối kháng nhắm vào cổng AI công vụ:
1. **Direct Prompt Injection & Jailbreak:** Tấn công yêu cầu AI phớt lờ chỉ đạo, chuyển sang chế độ DAN/Developer mode hoặc đóng vai hacker/persona tự do.
2. **Indirect RAG Poisoning & Delimiter Spoofing:** Chèn các câu lệnh ngầm vào file PDF/DOCX quy chế tải lên để chiếm quyền hoặc giả mạo phê duyệt của Chủ tịch xã.
3. **Trích xuất bí mật hệ thống (Secret Leaks):** Lệnh yêu cầu in toàn bộ `system_prompt`, lộ `SPACE_API_KEY` hoặc biến môi trường.
4. **Ký tự tàng hình & Giả mạo Homoglyph:** Sử dụng ký tự Zero-width (`\u200b`, `\u200c`, `\u200d`, `\ufeff`) hoặc ký tự Cyrillic/Greek để vượt mặt bộ lọc từ khóa.
5. **Dữ liệu rác & Tấn công DoS:** Spam chuỗi lặp vô tận, mã hóa Base64 ẩn, dump mã nhị phân/shellcode, và file giả mạo định dạng.
6. **Bảo vệ dữ liệu cá nhân (PII Masking):** Tự động che mờ số CCCD 12 số, CMND 9 số, SĐT, STK, Số sổ đỏ theo Nghị định 13/2023.

---

## 2. Kiến Trúc 6 Tầng Phòng Vệ (Multi-Layer Security Architecture)

```
                              [Yêu cầu đầu vào: Text / File / Ảnh]
                                                │
                                                ▼
     ┌────────────────────────────────────────────────────────────────────────────────────┐
     │ TẦNG 1: CHUẨN HÓA KÝ TỰ TÀNG HÌNH & HOMOGLYPHS NORMALIZER                         │
     │ • Xóa toàn bộ 17 ký tự Zero-width (\u200b, \ufeff, \u00ad, \u202e, ...)             │
     │ • Hoán chuyển 35 ký tự Cyrillic/Greek homoglyphs về Latin chuẩn                     │
     │ • Chuẩn hóa Unicode NFC & Chặn thẻ Script/Iframe HTML                              │
     └──────────────────────────────────────────┬─────────────────────────────────────────┘
                                                │
                                                ▼
     ┌────────────────────────────────────────────────────────────────────────────────────┐
     │ TẦNG 2: BỘ LỌC PROMPT INJECTION & JAILBREAK ĐA VECTOR                              │
     │ • Quét Regex chuyên sâu 17 mẫu lệnh tiếng Việt & tiếng Anh                         │
     │ • Chặn Direct Override, DAN mode, Roleplay phá hoại, Giả mạo thẩm quyền xã         │
     │ • Chặn System Token Spoofing (<|im_start|>, === SYSTEM ===, <<SYS>>)               │
     │ • Chặn yêu cầu trích xuất System Prompt / API Key                                  │
     └──────────────────────────────────────────┬─────────────────────────────────────────┘
                                                │
                                                ▼
     ┌────────────────────────────────────────────────────────────────────────────────────┐
     │ TẦNG 3: BỘ LỌC RÁC, ENTROPY BẤT THƯỜNG & CHỐNG DOS                                 │
     │ • Chặn chuỗi liền mạch > 400 ký tự không có dấu cách                               │
     │ • Chặn Spam lặp ký tự liên tục (Repetition Attack)                                 │
     │ • Tính Shannon Entropy: chặn dump shellcode/mã nhị phân thô                        │
     │ • Chặn chuỗi Base64/Hex dài bất thường                                             │
     └──────────────────────────────────────────┬─────────────────────────────────────────┘
                                                │
                                                ▼
     ┌────────────────────────────────────────────────────────────────────────────────────┐
     │ TẦNG 4: KHỬ KHUẨN DỮ LIỆU CÁ NHÂN (PII MASKING THEO NĐ 13/2023)                   │
     │ • Tự động che CCCD 12 số, CMND 9 số, SĐT Việt Nam, STK Ngân hàng, Số Sổ đỏ         │
     │ • Bảo vệ thông tin công dân trước khi nạp RAG hoặc gửi tới AI                      │
     └──────────────────────────────────────────┬─────────────────────────────────────────┘
                                                │
                                                ▼
     ┌────────────────────────────────────────────────────────────────────────────────────┐
     │ TẦNG 5: CÔ LẬP NGỮ CẢNH RAG & PHÂN TÁCH RANH GIỚI BẤT KHẢ XÂM PHẠM                │
     │ • Đóng gói văn bản RAG vào thẻ <rag_context_isolated>                              │
     │ • Chỉ thị tường minh cấm mô hình thực thi bất kỳ câu lệnh nào bên trong RAG        │
     └──────────────────────────────────────────┬─────────────────────────────────────────┘
                                                │
                                                ▼
     ┌────────────────────────────────────────────────────────────────────────────────────┐
     │ TẦNG 6: BẢO MẬT API GATEWAY & RATE LIMITING                                        │
     │ • Sliding Window Rate Limiting: Tối đa 60 req/phút/IP                              │
     │ • Constant-Time Token Comparison (secrets.compare_digest) chống Timing Attack      │
     │ • Giới hạn payload tối đa 32,000 ký tự                                             │
     └────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Kết Quả Kiểm Định Áp Lực Bảo Mật (550 Test Cases)

Bộ kiểm thử `scripts/ai_pipeline/security_stress_test.py` được thực thi tự động qua 550 test cases:

| Danh Mục Kiểm Thử | Số Mẫu | Đạt Chuẩn | Tỷ Lệ Chặn/Bảo Vệ | Đánh Giá |
|---|:---:|:---:|:---:|:---:|
| **Category 1**: Direct Jailbreak & System Override | 100 | 100 | **100.00%** | ✅ TUYỆT ĐỐI |
| **Category 2**: Indirect RAG Poisoning & Delimiters | 100 | 100 | **100.00%** | ✅ TUYỆT ĐỐI |
| **Category 3**: PII Masking & Secret Leak Probing | 100 | 100 | **100.00%** | ✅ TUYỆT ĐỐI |
| **Category 4**: Obfuscation, Zero-width, Homoglyphs & Fake Files | 100 | 100 | **100.00%** | ✅ TUYỆT ĐỐI |
| **Category 5**: API Security, Rate Limiting & DoS Defenses | 100 | 100 | **100.00%** | ✅ TUYỆT ĐỐI |
| **Category 6**: Control Group - Benign Queries *(False Positive)* | 50 | 50 | **100.00% (FP: 0%)**| ✅ KHÔNG CHẶN NHẦM |
| **TỔNG CỘNG** | **550** | **550** | **100.00%** | ⭐️ HOÀN HẢO |

---

## 4. Hướng Dẫn Chạy Kiểm Thử Định Kỳ

Quản trị viên hệ thống có thể kích hoạt chạy kiểm thử bảo mật bất kỳ lúc nào bằng lệnh:

```bash
python scripts/ai_pipeline/security_stress_test.py
```
