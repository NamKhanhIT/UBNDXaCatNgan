# BUSINESS MEMORY — UBND XÃ CÁT NGẠN (LUẬT 72/2025/QH15)

## 1. Cơ Cấu Tổ Chức & Phân Quyền Chính Quyền 2 Cấp
- **05 Phòng / Ban Chuyên Môn Trực Thuộc**:
  1. `VAN_PHONG`: Văn phòng HĐND & UBND (Tham mưu tổng hợp, công vụ, tiếp công dân, thi đua khen thưởng).
  2. `KINH_TE`: Phòng Kinh tế - Hạ tầng & Đô thị (Quy hoạch, đất đai, tài nguyên, trật tự xây dựng, tài chính - ngân sách).
  3. `VAN_HOA_XA_HOI`: Phòng Văn hóa - Xã hội (Văn hóa, y tế dự phòng, giáo dục, an sinh xã hội, người có công).
  4. `HANH_CHINH_CONG`: Trung tâm Phục vụ Hành chính công (Đầu mối tiếp nhận, số hóa & giải quyết 100% TTHC 1 cửa).
  5. `KHOI_DANG_DOAN_THE`: Khối Đảng - HĐND - UBMTTQ (Cấp ủy, Ban Pháp chế, Ban KT-XH HĐND & Giám sát UBMTTQ).

## 2. Mô Hình Phân Quyền 3 Cấp (RBAC Scope Levels)
- **Level 1 (Lãnh đạo cao nhất - CT UBND, BT ĐU, CT HĐND, CT UBMTTQ)**: Quản lý toàn bộ 5 phòng ban, theo dõi định mức tải việc toàn xã, điều chuyển công việc liên phòng ban.
- **Level 2 (Lãnh đạo phòng - Trưởng phòng chuyên môn)**: Quản lý cán bộ thuộc phòng, phân công việc đúng chuyên môn nghiệp vụ.
- **Level 3 (Chuyên viên)**: Theo dõi công việc cá nhân và phối hợp nội bộ phòng.

## 3. Kiến Trúc UX/UI Hệ Thống
- **Module Gộp Thống Nhất: "Nhân Sự & Phòng Ban" (`departments`)**:
  - Gộp 2 module dư thừa cũ thành 1 module duy nhất có 3 sub-tab con:
    - **Tab 1 — Phòng Ban**: 5 thẻ phòng ban hiển thị Trưởng phòng, biên chế, % tải việc và nút chuyển xem danh sách.
    - **Tab 2 — Hồ Sơ Cán Bộ**: Card profile hiển thị đầy đủ avatar, ngạch công chức, chuyên môn nghiệp vụ sâu, số điện thoại, email, % tải tuần, điểm nghiệm thu, xếp loại GRAD và nút giao việc/điều chuyển.
    - **Tab 3 — Tải Công Việc**: Biểu đồ giờ làm (40h/tuần), cảnh báo quá tải khẩn cấp + gợi ý điều chuyển người rảnh.
- **Thiết Kế UI/UX Chuẩn Công Vụ**:
  - 100% FontAwesome 6 Free icons (`fa-solid fa-*`).
  - Giao diện sáng (Light mode only), phẳng, minh bạch, không AI slop, không glassmorphic hay gradient tím vô nghĩa.
