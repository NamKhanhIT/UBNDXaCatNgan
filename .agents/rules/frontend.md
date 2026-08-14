# Quy Tắc Phát Triển Frontend Next.js & Thiết Kế Giao Diện (Frontend & UI Rules)

## 1. Công Nghệ & Khung Phát Triển
- **Framework**: Next.js 14 (App Router), React 18, TypeScript.
- **Styling**: Tailwind CSS với bảng màu công vụ chuyên nghiệp, chuẩn mực (xanh navy, xanh lá hành chính, xám thanh lịch, trắng sáng).
- **Icons**: FontAwesome 6 Free (`fa-solid fa-*`) hoặc Lucide Icons đồng bộ, rõ nghĩa.

## 2. Tiêu Chuẩn Giao Diện Công Vụ (Utilitarian & Modern Government UI)
- **Phong cách**: Thiết kế phẳng, sáng sủa (Light mode primary), thông tin trực quan, tối ưu cho xử lý công việc hành chính thực tế.
- **Tránh "AI Slop"**: Không dùng hiệu ứng gradient tím/hồng lòe loẹt, không shadow quá đậm, không dùng emoji thay cho icon chuẩn.
- **Trạng thái trực quan**:
  - Quá tải công việc: Thanh % tải việc đổi màu đỏ cảnh báo khi vượt 80% định mức.
  - Trạng thái văn bản/công việc: Badges với màu sắc chuẩn (Xanh lá = Hoàn thành/Đã ban hành, Vàng = Đang xử lý/Chờ duyệt, Đỏ = Quá hạn/Thu hồi/Từ chối).

## 3. Tương Tác Dữ Liệu & API Service Layer
- **Không dùng Mock Data cho luồng nghiệp vụ chính**:
  - Mọi thao tác xem, thêm, sửa, xóa, duyệt, thu hồi, giao việc BẮT BUỘC phải gọi qua tầng Service (`frontend/web/src/services/*.service.ts`).
  - Dữ liệu luôn đồng bộ thời gian thực với backend PostgreSQL.
- **Xử lý trạng thái & lỗi**:
  - Luôn có trạng thái Loading (`isSubmitting`, `isLoading`, Skeleton) khi thực hiện các tác vụ bất đồng bộ.
  - Hiển thị Toast thông báo thành công hoặc lỗi chi tiết từ server, không để người dùng bối rối.
- **Modals & Dialogs**:
  - Các modal nghiệp vụ (`DocumentViewerModal`, `DocumentHistoryModal`, `RevokeDocumentModal`, `GoogleCalendarView`) phải có phím đóng ESC, click outside, kiểm soát form validation trước khi submit.
