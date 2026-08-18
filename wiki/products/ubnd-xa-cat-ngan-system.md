# Hệ Thống Quản Lý & Điều Hành Tác Nghiệp UBND Xã Cát Ngạn

> **Một dòng định nghĩa:** Nền tảng số quản trị công vụ, phân công nhiệm vụ, đánh giá thi đua và nhắc việc thông minh cho toàn thể cán bộ, công chức UBND Xã Cát Ngạn theo chuẩn mực chính quyền điện tử cấp xã.

---

## Tổng Quan Sản Phẩm

Hệ thống được phát triển chuyên biệt phục vụ công tác chỉ đạo, điều hành của Lãnh đạo Đảng ủy - HĐND - UBND - UBMTTQ và hoạt động tác nghiệp chuyên môn của 05 phòng ban trực thuộc xã Cát Ngạn.

```
                    ┌─────────────────────────────────────────┐
                    │      LÃNH ĐẠO CẤP XÃ (SCOPE LEVEL 1)    │
                    │   (Chủ tịch UBND, Bí thư, Thường trực)  │
                    └────────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │ TRƯỞNG PHÒNG BAN (LV2)   │                   │ GIÁM SÁT THI ĐUA & KPI    │
   │  Giao việc & Duyệt sơ bộ │                   │  Thang 10 (3.0 Hệ thống + │
   └─────────────┬─────────────┘                   │  7.0 Lãnh đạo thẩm định)  │
                 │                                 └───────────────────────────┘
                 ▼
   ┌───────────────────────────┐
   │ CHUYÊN VIÊN CÔNG VỤ (LV3) │
   │  Nhận việc, nộp báo cáo,  │
   │  nhận Web Push thông báo  │
   └───────────────────────────┘
```

---

## Các Tính Năng Trọng Tâm

1. **Lịch Phân Ca 3 Ca Chuẩn Hành Chính**:
   - Ca Sáng (07:30 - 12:00), Ca Chiều (13:00 - 17:00), Ca Tối (17:00 - 21:00).
   - Kéo thả Kanban chuyển trạng thái công việc thời gian thực.
2. **Đánh Giá Thi Đua Cán Bộ (Thang Điểm 10)**:
   - Kết hợp 3.0đ Hệ thống tự động + 7.0đ Lãnh đạo trực tiếp chấm.
   - Xếp loại theo 5 khung chuẩn tác phong công chức.
3. **Kiểm Soát Chéo Sửa Điểm (Maker-Checker)**:
   - Ngưỡng lệch $> 1.0$ điểm yêu cầu Cấp trên phê duyệt.
   - Đính kèm tệp văn bản / hình ảnh biên bản từ máy tính làm bằng chứng giải trình.
4. **Thông Báo Đẩy Web Push W3C & Daily Digest 07:30 AM**:
   - Gửi thông báo đến máy tính và điện thoại di động (PWA).
   - Tóm tắt công việc mỗi sáng vào đúng 07:30.
5. **Chú Thích Khoanh Vùng Văn Bản Nộp Bài (Inline Annotations)**:
   - Bôi đen đoạn văn bản nộp kết quả để chỉ rõ vị trí lỗi sai và yêu cầu chỉnh sửa.

---

## Kiến Trúc Kỹ Thuật

- **Backend**: .NET 8 Web API, Clean Architecture, CQRS (MediatR), PostgreSQL EF Core (UTC).
- **Frontend**: Next.js 14 App Router, TypeScript, Vanilla CSS Tokens, FontAwesome 6 Free.
- **Bảo mật**: BCrypt Password Hashing, RBAC 3 cấp phân quyền.

---

## Bối Cảnh Hành Chính Cấp Xã Mới
- **Địa bàn hành chính:** Xã Cát Ngạn, Tỉnh Nghệ An.
- **Căn cứ thành lập:** Nghị quyết số 1678/NQ-UBTVQH15 ngày 16/6/2025 của Ủy ban Thường vụ Quốc hội về việc sắp xếp các đơn vị hành chính cấp xã của tỉnh Nghệ An năm 2025.
- **Nguồn gốc hợp nhất:** Thành lập trên cơ sở sáp nhập 03 xã cũ gồm **Xã Minh Sơn, Xã Cát Văn, Xã Phong Thịnh**.
- **Cấp quản lý:** Trực thuộc trực tiếp **UBND Tỉnh Nghệ An** theo mô hình chính quyền địa phương 2 cấp (Luật 72/2025/QH15).

---

## Các Trang Wiki Liên Quan

- [Đơn Vị Hành Chính Cấp Xã Nghệ An (NQ 1678/NQ-UBTVQH15)](../concepts/don-vi-hanh-chinh-nghe-an-nghi-quyet-1678.md)
- [Thang Điểm 10 Đánh Giá Cán Bộ](../concepts/thang-diem-10-danh-gia-can-bo.md)
- [Quy Chế Maker-Checker Sửa Điểm](../concepts/quy-che-maker-checker-sua-diem.md)
- [Web Push W3C & Thông Báo Công Vụ](../concepts/web-push-w3c-thong-bao-cong-vu.md)
- [Chú Thích Khoanh Vùng Văn Bản](../patterns/inline-task-review-annotation.md)
- [Dịch Vụ Nhắc Việc Tự Động Daily Digest](../patterns/daily-digest-cron-service.md)
