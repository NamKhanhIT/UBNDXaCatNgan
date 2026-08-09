# Quyết định Kiến trúc & Thiết kế Giao diện (ADR)

## 1. Giao diện & Trải nghiệm Người Dùng (UI/UX)
- Tuân thủ nguyên tắc **Utilitarian**: Loại bỏ hoàn toàn các thành phần trang trí không cần thiết ("AI slop", gradient sặc sỡ, shadow nặng).
- Sử dụng **FontAwesome** chuẩn hóa cho toàn bộ hệ thống icon. Không dùng Emoji.

## 2. Quy trình Xử lý Công việc: Inbox ➡️ Create Task ➡️ Dual Evaluation
**Bối cảnh:** Lãnh đạo cần một nơi tập trung xử lý mọi yêu cầu (Inbox) và từ đó phân bổ công việc (Create Task).

**Quyết định:**
- **Module Inbox (Hộp thư):** Đóng vai trò là trung tâm Triage (phân loại, tiếp nhận). Các văn bản đến được lưu ở các trạng thái chưa đọc/đã đọc/đã xếp lịch/đã giao việc.
- **Module Create Task (Giao việc mới):** 
  - **Auto-mapping:** Liên kết trực tiếp từ Inbox. Nếu tạo việc từ Inbox, hệ thống sẽ điền sẵn (pre-fill) Tiêu đề, Hạn chót, Nội dung. Vẫn hỗ trợ tạo công việc phát sinh nội bộ (không từ thư).
  - **Smart Assignee Picker:** Chuyển đổi `<select>` thành lưới thẻ (Grid of cards) phân loại theo Phòng ban (Văn phòng, Địa chính, Tài chính...). Thẻ nhân sự hiển thị thanh Loading (%) để cảnh báo Lãnh đạo nếu nhân sự quá tải (>80% = màu đỏ).
  - **Checklist Sản Phẩm Đầu Ra:** Cho phép lãnh đạo gõ danh sách các tiêu chí thành phần (sub-tasks). Đây là đầu vào cốt lõi cho **Thuật toán Đánh giá Kép (Dual Evaluation)**. 

## 3. Thuật toán Đánh giá Kép (Dual Evaluation)
**Mô hình đánh giá:**
- **40% Tiến độ tự động:** Chuyên viên hoàn thành các "Checklist đầu ra", hệ thống tự động quy đổi ra % tiến độ hoàn thành.
- **60% Chất lượng quản lý:** Lãnh đạo dựa vào chất lượng tài liệu nộp lên (chậm/sớm, tốt/kém) để chấm % còn lại khi xét duyệt (Approve/Reject).
