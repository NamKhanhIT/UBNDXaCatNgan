# KIẾN TRÚC & QUYẾT ĐỊNH THIẾT KẾ HỆ THỐNG (ARCHITECTURE DECISION RECORDS - ADR)

> **Dự án**: Hệ thống Quản lý Công việc & Điều hành Tác nghiệp UBND Xã Cát Ngạn  
> **Cập nhật**: Tháng 08/2026

---

## ADR-01: Kiến Trúc Tổng Thể .NET 8 Clean Architecture & CQRS
- **Bối cảnh**: Hệ thống phục vụ hoạt động công vụ cần tính ổn định cao, bảo mật chặt chẽ, dễ bảo trì và mở rộng.
- **Quyết định**: Áp dụng Clean Architecture chia làm 4 lớp rõ ràng:
  1. `Quanlycongviec.Domain`: Thực thể nghiệp vụ, Enums, không phụ thuộc thư viện ngoài.
  2. `Quanlycongviec.Application`: Sử dụng MediatR triển khai mẫu CQRS (Command/Query Responsibility Segregation).
  3. `Quanlycongviec.Infrastructure`: EF Core PostgreSQL, WebPush, PasswordHasher, Background Services.
  4. `Quanlycongviec.Api`: RESTful API Controller, SignalR Hubs.
- **Hệ quả**: Logic nghiệp vụ được cô lập hoàn toàn, dễ dàng viết Unit Test (hiện đạt 100% Passed trên 38 bộ test).

---

## ADR-02: Thiết Kế Giao Diện Utilitarian & Chuẩn Mực Công Vụ (Anti-Slop)
- **Bối cảnh**: Phần mềm chính quyền cấp xã cần sự trang nhã, nghiêm túc, rõ ràng và dễ tiếp cận cho mọi lứa tuổi cán bộ.
- **Quyết định**:
  - Giao diện nền sáng chủ đạo (Light Mode), tương phản cao ($\ge 4.5:1$).
  - Sử dụng **FontAwesome 6 Free** chuẩn hóa cho toàn bộ icon. Tuyệt đối không dùng Emoji thay thế cho biểu tượng chức năng.
  - Loại bỏ hoàn toàn các yếu tố đồ họa thừa thãi ("AI slop", gradient tím lòe loẹt, bóng mờ glassmorphism nặng).

---

## ADR-03: Mô Hình Phân Quyền 3 Cấp & Gộp Module Nhân Sự - Phòng Ban
- **Bối cảnh**: Tránh phân tán thông tin giữa màn hình "Phòng ban" và "Hồ sơ cán bộ".
- **Quyết định**:
  - Gộp thành 1 module duy nhất `departments` gồm 3 sub-tab: *Phòng ban, Hồ sơ cán bộ, Tải công việc*.
  - Phân quyền RBAC 3 cấp: Cấp 1 (Lãnh đạo xã toàn quyền), Cấp 2 (Lãnh đạo phòng), Cấp 3 (Chuyên viên).

---

## ADR-04: Thang Điểm 10 Đánh Giá Thi Đua Công Vụ (3.0đ Hệ Thống + 7.0đ Lãnh Đạo)
- **Bối cảnh**: Cần một cơ chế đánh giá khách quan nhưng vẫn đảm bảo tính linh hoạt và quyền hạn của lãnh đạo trực tiếp.
- **Quyết định**:
  - **Thang điểm 10.0** chính thức.
  - **Điểm Hệ thống (Tối đa 3.0đ)**: 1.5đ đúng hạn, 1.0đ checklist sản phẩm, 0.5đ không bị trả lại yêu cầu sửa.
  - **Điểm Lãnh đạo thẩm định (Tối đa 7.0đ)**: Lãnh đạo trực tiếp chấm theo chất lượng thực hiện.
  - Xếp loại theo 5 mức chuẩn Nghị định về đánh giá cán bộ, công chức.

---

## ADR-05: Cơ Chế Sửa Điểm Chống Thiên Vị (Maker-Checker & Local File Upload)
- **Bối cảnh**: Ngăn ngừa tiêu cực hoặc tùy tiện sửa đổi điểm số đánh giá.
- **Quyết định**:
  - Cấm cán bộ tự sửa điểm của chính mình.
  - Bắt buộc giải trình $\ge 30$ ký tự.
  - **Đính kèm minh chứng từ máy tính**: Hỗ trợ chọn tệp PDF, Word, Excel, ảnh chụp biên bản từ máy tính (mã hóa Base64 Data URI), không bắt buộc nhập đường dẫn URL web.
  - **Ngưỡng Maker-Checker**: Chênh lệch $> 1.0$ điểm trên thang 10 bắt buộc phải chuyển tới Lãnh đạo Cấp 1 phê duyệt.

---

## ADR-06: Hệ Thống Thông Báo Đẩy Web Push W3C & PWA Cho Di Động
- **Bối cảnh**: Cần thông báo tức thời cho cán bộ nhưng không sử dụng các giải pháp Zalo cá nhân không chính thống (rủi ro bảo mật và vi phạm điều khoản).
- **Quyết định**:
  - Sử dụng chuẩn mở **Web Push W3C** qua giao thức VAPID keys.
  - Tích hợp Service Worker (`sw.js`) để nhận thông báo và điều hướng URL khi bấm vào.
  - Hỗ trợ đầy đủ trên trình duyệt máy tính và thiết bị di động (kể cả iOS 16.4+ qua chế độ PWA Thêm vào Màn hình chính).

---

## ADR-07: Tóm Tắt Nhắc Việc Tự Động Mỗi Sáng (Daily Digest 07:30 AM)
- **Bối cảnh**: Cán bộ cần nắm bắt công việc trong ngày trước khi bắt đầu ca làm việc sáng.
- **Quyết định**:
  - Triển khai `TaskReminderBackgroundService` chạy ngầm trong .NET 8.
  - Đúng **07:30 sáng** mỗi ngày, hệ thống tổng hợp công việc đến hạn, công việc trong ngày và công việc tồn đọng để gửi thông báo tóm tắt qua Web Push tới từng cán bộ.

---

## ADR-08: Chú Thích Khoanh Vùng Văn Bản Nộp Bài (Task Review Annotation)
- **Bối cảnh**: Khi nghiệm thu văn bản, Lãnh đạo cần chỉ rõ đoạn văn nào sai sót thay vì nhận xét chung chung.
- **Quyết định**:
  - Cho phép Lãnh đạo bôi đen (selection) trực tiếp trên văn bản kết quả nộp bài.
  - Gắn chú thích phân loại theo mức độ: *Lỗi sai nghiêm trọng (đỏ), Cần chỉnh sửa (cam), Gợi ý hoàn thiện (xanh)*.
  - Chuyên viên có thể xem trực tiếp vị trí khoanh vùng và đánh dấu Đã sửa (Resolved).

---

## ADR-09: Phân Ca Làm Việc 3 Ca Chuẩn Hành Chính
- **Bối cảnh**: Chính quyền cấp xã có các nhiệm vụ trực giải quyết TTHC ngoài giờ và an ninh trật tự buổi tối.
- **Quyết định**: Phân định 3 ca làm việc rõ ràng:
  - **Ca Sáng**: 07:30 – 12:00
  - **Ca Chiều**: 13:00 – 17:00
  - **Ca Tối**: 17:00 – 21:00

---

## ADR-10: Chuẩn Hóa Thời Gian UTC Cho PostgreSQL EF Core
- **Bối cảnh**: Tránh lỗi lệch múi giờ khi lưu trữ thời gian giữa server và cơ sở dữ liệu PostgreSQL.
- **Quyết định**:
  - Mọi trường `DateTime` lưu vào cơ sở dữ liệu đều có `DateTimeKind.Utc`.
  - Phía Frontend Next.js chịu trách nhiệm định dạng sang giờ Việt Nam (`vi-VN`, UTC+7) khi hiển thị.

---

## ADR-11: Pipeline AI Phân Tích Văn Bản Hành Chính, Chống Bịa Đặt & Human-In-The-Loop
- **Bối cảnh**: Văn bản chỉ đạo, thư mời họp, giao việc đến UBND xã cần được phân loại, trích xuất thông tin tự động để tiết kiệm thời gian xử lý công vụ.
- **Quyết định**:
  - **Human-in-the-loop**: AI chỉ trích xuất và đề xuất (trạng thái `Analyzed`), không bao giờ tự tạo `TaskItem` hoặc `CalendarEvent` chính thức khi chưa có sự kiểm duyệt của cán bộ (`confirm-classification`).
  - **Chống bịa đặt (Anti-hallucination)**: Mọi trường thông tin không có bằng chứng trực tiếp trong văn bản gốc đều phải để `null`, tuyệt đối không tự suy diễn hay gán giá trị mặc định.
  - **Validation ID thực tế**: `SuggestedDepartmentId` do AI trả về bắt buộc phải được mã nguồn backend đối chiếu với danh sách phòng ban thật trong CSDL PostgreSQL, nếu không hợp lệ sẽ set về `null` và ghi log cảnh báo.
  - **Cảnh báo độ tin cậy**: Gắn cờ `LowConfidence` (< 60%) và `DeadlineSeemsUnreasonable` (hạn chót trong quá khứ) để giao diện cảnh báo cán bộ kiểm tra kỹ văn bản gốc.

---

## ADR-12: Chủ Quyền Dữ Liệu & Cơ Chế Fail-Fast Khi Sử Dụng AI Ngoài
- **Bối cảnh**: Văn bản hành chính nhà nước có tính bảo mật cao, không được tùy tiện gửi ra máy chủ đám mây của bên thứ ba nếu chưa được cấp có thẩm quyền phê duyệt.
- **Quyết định**:
  - **Mặc định**: Sử dụng mô hình Ollama nội bộ (khuyến nghị `qwen3.6:35b-a3b` hoặc `qwen3.5:4b`), toàn bộ quá trình OCR và suy luận AI chạy 100% trên máy chủ của xã.
  - **Fail-Fast chủ quyền dữ liệu**: Khi cấu hình `AiProvider:Type = ApiCompatible`, hệ thống **từ chối khởi động** (ném ngoại lệ `InvalidOperationException`) nếu chưa có xác nhận `DataSovereigntyAcknowledged = true` trong cấu hình.

---

## ADR-13: Kiến Trúc Chữ Ký Số Độc Lập Nhà Cung Cấp (ISignatureProvider)
- **Bối cảnh**: Quy trình phát hành văn bản đi theo Nghị định 30/2020/NĐ-CP cần tích hợp ký số, nhưng nhà cung cấp chứng thư số (VNPT-CA, Viettel-CA, Ban Cơ yếu Chính phủ) sẽ được chọn lựa sau.
- **Quyết định**:
  - Thiết kế interface `ISignatureProvider` trong tầng Application.
  - Cung cấp `NoOpSignatureProvider` trong tầng Infrastructure phục vụ giai đoạn phát triển và kiểm thử.
  - Cho phép cắm (plug-in) nhà cung cấp ký số thật mà không làm thay đổi các quy tắc nghiệp vụ cốt lõi.

