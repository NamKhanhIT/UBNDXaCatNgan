# Kho Tài Liệu Dự Án UBND Xã Cát Ngạn (Project Documentation)

Thư mục này lưu trữ toàn bộ tài liệu kỹ thuật, kiến trúc, đặc tả tính năng và bối cảnh nghiệp vụ của hệ thống Quản lý & Nhắc việc UBND Xã Cát Ngạn.

---

## 📁 Cấu Trúc Tài Liệu

### 1. [docs/specs/](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/specs) — Đặc Tả Kỹ Thuật Tính Năng (Design Specs)
Chứa các bản đặc tả chi tiết được thiết kế trước khi triển khai các tính năng lớn:
- `2026-08-08-dynamic-demo-mode-design.md`: Chế độ Demo động phục vụ trải nghiệm người dùng.
- `2026-08-09-github-private-repo-ci-design.md`: Thiết kế CI/CD và quản lý repository GitHub an toàn.
- `2026-08-10-rating-revision-design.md`: Lịch sử điều chỉnh và kiểm duyệt đánh giá công việc.
- `2026-08-10-outgoing-document-enhancements-design.md`: Quản lý và xử lý quy trình Văn bản đi.
- `2026-08-10-google-calendar-events-design.md`: Quản lý lịch công tác & sự kiện phong cách Google Calendar.

### 2. [docs/architecture/](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/architecture) — Kiến Trúc & Quyết Định Kỹ Thuật
- `DECISIONS.md`: Quyết định kiến trúc (ADRs) về UI Utilitarian, Inbox Triage, Thuật toán Đánh giá Kép (Dual Evaluation 40/60).
- `Phân cấp phân quyền UBND Cấp xã.md`: Mô hình phân quyền 3 cấp, cơ cấu tổ chức theo Luật 72/2025/QH15.
- `Danh-gia-va-Lo-trinh-Phan-mem-UBND-Xa.md`: Báo cáo đánh giá hiện trạng và lộ trình phát triển hệ thống qua 4 giai đoạn.
- `TasksSoftware.docx`: Báo cáo nghiên cứu cơ sở lý luận và yêu cầu phần mềm.

### 3. [docs/business/](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/business) — Bối Cảnh Nghiệp Vụ & Bộ Nhớ Hệ Thống
- `BUSINESS_MEMORY.md`: Cơ cấu 5 phòng ban (`VAN_PHONG`, `KINH_TE`, `VAN_HOA_XA_HOI`, `HANH_CHINH_CONG`, `KHOI_DANG_DOAN_THE`) và 3 cấp RBAC.
- `MEMORY.md`: Ghi nhớ các định mức tải việc và nguyên tắc nghiệp vụ.

---

## 🧭 Bộ Quy Tắc Dành Cho AI
Toàn bộ quy tắc ứng xử của AI Assistant và quy chuẩn kỹ thuật được định nghĩa tại [.agents/AGENTS.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/.agents/AGENTS.md).
