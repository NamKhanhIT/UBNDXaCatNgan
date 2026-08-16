# Chú Thích Khoanh Vùng Văn Bản Nộp Bài (Inline Task Review Annotation)

> **Một dòng định nghĩa:** Mô hình cho phép Lãnh đạo thẩm định bôi đen đoạn văn bản kết quả nộp bài của cán bộ để đính kèm nhận xét chỉ điểm cụ thể (Lỗi sai, Cần chỉnh sửa, Gợi ý hoàn thiện) và theo dõi tiến độ sửa lỗi (Resolved).

---

## 1. Bối Cảnh & Vấn Đề Giải Quyết

Khi cán bộ nộp báo cáo kết quả thực hiện nhiệm vụ (ví dụ: dự thảo báo cáo KTXH, phương án số hóa TTHC, biên bản kiểm tra), các phần mềm thông thường chỉ cho phép Lãnh đạo viết nhận xét chung chung ở cuối bài ("Bài làm còn nhiều lỗi, yêu cầu sửa lại"). Cán bộ không biết chính xác đoạn văn nào, số liệu nào sai sót.

Mô hình **Inline Annotation** giải quyết triệt để vấn đề này bằng cách:
- Bôi đen (Text Selection) trực tiếp trên đoạn văn bản.
- Gắn thẻ mức độ sai sót và nội dung yêu cầu sửa.
- Highlight đoạn văn bản bằng màu sắc tương ứng.

---

## 2. Phân Loại Mức Độ Chú Thích

| Mức Độ (Severity) | Mã & Màu Sắc | Ý Nghĩa Nghiệp Vụ |
|---|---|---|
| **Lỗi Sai Nghiêm Trọng** | `LoiSai` (Đỏ `#fee2e2`) | Sai lệch số liệu, căn cứ pháp lý hết hiệu lực, vi phạm quy định |
| **Cần Chỉnh Sửa** | `CanChinhSua` (Cam `#ffedd5`) | Diễn đạt chưa chuẩn tác phong hành chính, thiếu phụ lục |
| **Gợi Ý / Khen Ngợi** | `GoiYHoanThien` (Xanh `#eff6ff`) | Gợi ý cách diễn đạt hay hơn, mở rộng nội dung tham mưu |

---

## 3. Cài Đặt Trong Hệ Thống Mã Nguồn

- **Backend**:
  - Entity: `TaskReviewAnnotation.cs`
  - Controller & Commands: `TaskReviewAnnotationController.cs`, `CreateTaskReviewAnnotationCommand.cs`, `ResolveAnnotationCommand.cs`
- **Frontend**:
  - Service: `task-review-annotation.service.ts`
  - UI: Inline Text Highlighter, Annotation Popover & Creation Modal trong `page.tsx`

---

## Các Trang Wiki Liên Quan

- [Hệ Thống UBND Xã Cát Ngạn](../products/ubnd-xa-cat-ngan-system.md)
- [Thang Điểm 10 Đánh Giá Cán Bộ](../concepts/thang-diem-10-danh-gia-can-bo.md)
