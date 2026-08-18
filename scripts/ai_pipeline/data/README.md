# Thư Mục Dữ Liệu AI (AI Training Data Directory)

> [!CAUTION]
> **QUY ĐỊNH BẢO MẬT DỮ LIỆU CÔNG VỤ (Nghị định 13/2023/NĐ-CP):**
> - **TUYỆT ĐỐI KHÔNG commit hoặc push các tệp dữ liệu huấn luyện thật (.jsonl, .csv, .xlsx, .pdf, .docx)** lên Git repository.
> - Toàn bộ các tệp `.jsonl` lớn đã được cấu hình trong `.gitignore`.

---

## 1. Mẫu Dữ Liệu Phát Triển (`sample_template.jsonl`)
Tệp [`sample_template.jsonl`](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/scripts/ai_pipeline/data/sample_template.jsonl) chứa 3 mẫu hội thoại cấu trúc giả lập thuần túy nhằm phục vụ lập trình viên tham khảo định dạng JSON Schema của các tác vụ:
1. Trích xuất văn bản đơn (MeetingInvitation / SuperiorDirective ➔ JSON Object).
2. Trích xuất bảng giao việc (TaskAssignmentDown ➔ JSON Array).
3. Gợi ý phân công cán bộ (AssignmentSuggestion ➔ JSON Object).

---

## 2. Hướng Dẫn Sinh Dữ Liệu Kiểm Thử Trên Máy Local (Development Only)

Nếu bạn cần tạo bộ dữ liệu tổng hợp phục vụ chạy thử nghiệm pipeline huấn luyện hoặc benchmark trên máy cá nhân:

```bash
# 1. Chạy script sinh dữ liệu tổng hợp (Synthetic Data Generator):
python scripts/ai_pipeline/generate_administrative_dataset.py

# 2. Kiểm tra an toàn PII trước khi chạy:
python scripts/ai_pipeline/data_sanitizer.py --audit scripts/ai_pipeline/data/ubnd_train.jsonl
```

*Lưu ý: Dữ liệu sinh ra sẽ nằm tại máy cục bộ của bạn và tự động bị chặn bởi `.gitignore` khi thực hiện `git add/commit`.*
