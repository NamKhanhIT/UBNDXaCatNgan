# TECHNICAL MEMORY — HỆ THỐNG QUẢN LÝ & ĐIỀU HÀNH UBND XÃ CÁT NGẠN

> **Tài liệu kỹ thuật tổng hợp toàn diện (Cập nhật ngày 15/08/2026)**  
> Ghi nhớ toàn bộ kiến trúc mã nguồn, cấu hình hệ thống, dịch vụ nền và các luồng dữ liệu cốt lõi.

---

## 1. Công Nghệ & Hạ Tầng Kỹ Thuật (Tech Stack)

### Backend (.NET 8 Clean Architecture)
- **Framework**: .NET 8 Web API (`C# 12`)
- **Kiến trúc**: Clean Architecture theo mẫu CQRS (MediatR)
  - `Quanlycongviec.Domain`: Entities, Enums, BaseEntity, ValueObjects.
  - `Quanlycongviec.Application`: Features (Commands, Queries, DTOs), Interfaces, Behaviors, Options.
  - `Quanlycongviec.Infrastructure`: Persistence (`ApplicationDbContext`), Services (`WebPushNotificationService`, `SystemScoreCalculator`, `TaskReminderBackgroundService`, `PasswordHasher`).
  - `Quanlycongviec.Api`: Controllers, Middleware, SignalR Hubs, Background Services.
- **Cơ sở dữ liệu**: PostgreSQL 16 + Entity Framework Core 8
  - Toàn bộ trường `DateTime` lưu trữ bắt buộc chuẩn `DateTimeKind.Utc`.
  - Khởi tạo và kiểm tra dữ liệu mẫu độc lập từng bảng qua `DbInitializer.cs`.
- **Bảo mật & Mã hóa**:
  - Mật khẩu: `BCrypt.Net-Next` (Salt factor 11), tự động nâng cấp từ mã SHA256 cũ.
  - Phân quyền: RBAC 3 cấp (Role-Based Access Control theo `RankLevel` và `ScopeLevel`).
- **Thông báo & Đồng bộ thời gian thực**:
  - **SignalR Hub**: Gửi thông báo trực tiếp đến trình duyệt đang mở.
  - **Web Push (W3C Standard)**: Thư viện `WebPush` với VAPID keys (`WebPushOptions`), hỗ trợ gửi thông báo cả khi tắt trình duyệt / trên di động (iOS PWA & Android).

### Frontend (Next.js 14 App Router)
- **Framework**: Next.js 14.2 (App Router, Client Components, React 18, TypeScript).
- **Styling**: Vanilla CSS (`src/app/globals.css`), CSS Tokens tùy biến, tuyệt đối không phụ thuộc thư viện UI cồng kềnh.
- **Icon**: FontAwesome 6 Free (`fa-solid fa-*`) thông qua component `<Icon name="..." />`.
- **Tương thích di động (PWA)**:
  - Service Worker: `frontend/web/public/sw.js` (xử lý sự kiện `push` và `notificationclick`).
  - Hỗ trợ Web Push trên iOS 16.4+ khi thêm vào màn hình chính (Add to Home Screen).

---

## 2. Các Phân Hệ Chức Năng Cốt Lõi (Core Modules)

### Module 1: Tổng Quan & Bảng Điều Khiển (`overview`)
- Bảng thống kê chỉ số KPI: Tỷ lệ hoàn thành đúng hạn, nhiệm vụ khẩn cấp, khối lượng công việc toàn xã.
- Lịch công tác hôm nay & Nhiệm vụ trọng tâm cần xử lý.
- Nhật ký hoạt động công vụ thời gian thực (Activity Logs & Audit Logs).

### Module 2: Lịch Làm Việc & Tiến Độ Nhiệm Vụ (`tasks`)
- Lịch phân ca công việc 3 ca chuẩn hành chính:
  - **Ca Sáng**: 07:30 – 12:00
  - **Ca Chiều**: 13:00 – 17:00
  - **Ca Tối**: 17:00 – 21:00 (Nhiệm vụ trực ban, tiếp công dân đột xuất, an ninh cơ sở)
- Bảng Kanban kéo thả trạng thái: *Chờ tiếp nhận ➔ Đang thực hiện ➔ Chờ nghiệm thu ➔ Hoàn thành / Từ chối (kèm lý do & gia hạn)*.
- **Bôi đen chú thích văn bản kết quả (Task Review Annotation)**: Lãnh đạo bôi đen đoạn văn bản nộp bài để thêm nhận xét khoanh vùng (Lỗi sai, Cần chỉnh sửa, Gợi ý).

### Module 3: Nhân Sự & Phòng Ban Thống Nhất (`departments`)
Gộp 3 phân hệ con thành 1 module tiện lợi:
1. **Phòng Ban (`phongban`)**: 5 phòng ban chuyên môn trực thuộc UBND xã, hiển thị Trưởng phòng, biên chế và % tải việc.
2. **Hồ Sơ Cán Bộ (`canbo`)**: Thẻ thông tin công chức, số điện thoại, email, chuyên môn nghiệp vụ, điểm thi đua và nút giao việc tức thì.
3. **Tải Công Việc (`taiviec`)**: Theo dõi định mức 40h/tuần, cảnh báo đỏ khi quá tải (>80%), hỗ trợ điều chuyển việc từ cán bộ quá tải sang cán bộ rảnh.

### Module 4: Giao Việc Mới (`create-task`)
- Tự động điền (Auto-mapping) từ văn bản đến trong Hộp thư (Inbox).
- Hỗ trợ nhập liệu bằng giọng nói (Voice Simulation) và nhận diện tài liệu OCR AI.
- Thiết lập danh mục checklist sản phẩm đầu ra (sub-tasks).

### Module 5: Báo Cáo & Đánh Giá Thi Đua (`reports`)
Gồm 4 tab công vụ:
1. **Bảng Tổng Hợp Đánh Giá Thi Đua (`evaluation`)**:
   - **Thang điểm 10**: 3.0 điểm Hệ thống tự động + 7.0 điểm Lãnh đạo thẩm định.
   - Xếp loại chuẩn tác phong cán bộ: Xuất sắc ($\ge 9.0$), Tốt ($7.5-8.9$), Đạt ($6.0-7.4$), Cần cải thiện ($4.0-5.9$), Chưa đạt ($< 4.0$).
2. **Nộp Báo Cáo Tiến Độ (`submit`)**: Chuyên viên nộp báo cáo định kỳ/đột xuất kèm đính kèm tệp.
3. **Duyệt Báo Cáo (`review`)**: Lãnh đạo cấp phòng và cấp xã phê duyệt 2 cấp.
4. **Lịch Sử Báo Cáo (`history`)**: Lưu trữ và tra cứu toàn bộ báo cáo đã nộp.

### Module 6: Quản Lý Văn Bản Đến & Văn Bản Đi (`documents`)
- Sổ văn bản đến: Tiếp nhận, phân loại khẩn, chuyển giao việc trực tiếp.
- Sổ văn bản đi: Phát hành công văn, quyết định, thông báo, lưu trữ file scan PDF.

---

## 3. Hệ Thống Đánh Giá Điểm & Cơ Chế Chống Thiên Vị

### 3.1. Thuật Toán Tính Điểm Hệ Thống (Tối đa 3.0 điểm)
- **Tiêu chí Đúng hạn (Tối đa 1.5đ)**:
  - Đúng hạn: Nhận đủ `1.5` điểm.
  - Trễ hạn: Trừ `0.2đ` cho mỗi ngày trễ (`finishTime - dueDate`).
- **Tiêu chí Checklist thành phần (Tối đa 1.0đ)**:
  - Tính theo tỷ lệ hoàn thành checklist: `(completedSubTasks / totalSubTasks) * 1.0đ`.
- **Tiêu chí Chất lượng (Tối đa 0.5đ)**:
  - Không bị trả lại yêu cầu sửa: Nhận đủ `0.5` điểm.
  - Mỗi lần bị Lãnh đạo từ chối/yêu cầu sửa: Trừ `0.25đ`/lần.

### 3.2. Điểm Lãnh Đạo Thẩm Định (Tối đa 7.0 điểm)
- Do Lãnh đạo trực tiếp giao việc chấm dựa trên mức độ hoàn thiện nội dung và tinh thần trách nhiệm.
- Tổng điểm = `Điểm Hệ Thống (0-3.0đ) + Điểm Lãnh Đạo (0-7.0đ)` = `0.0 - 10.0 điểm`.

### 3.3. Cơ Chế Sửa Điểm Chống Thiên Vị (Maker-Checker & File Evidence)
- **Cấm tự sửa điểm**: Cán bộ được giao việc không được tự ý sửa điểm của chính mình.
- **Quy định lý do**: Bắt buộc giải trình tối thiểu **30 ký tự**.
- **Đính kèm minh chứng từ máy tính**: Bắt buộc đính kèm tệp PDF, Word, Excel hoặc ảnh chụp biên bản từ máy tính (mã hóa Base64 Data URI).
- **Ngưỡng duyệt chéo (Threshold)**:
  - Nếu độ lệch $|ĐiểmMới - ĐiểmCũ| \le 1.0$ điểm: Điểm mới được **áp dụng ngay lập tức**.
  - Nếu độ lệch $> 1.0$ điểm: Đề xuất chuyển sang trạng thái **Chờ Lãnh đạo cấp trên phê duyệt (Maker-Checker)**, điểm cũ giữ nguyên cho đến khi được duyệt.

---

## 4. Hệ Thống Thông Báo Đẩy (Web Push) & Nhắc Việc Định Kỳ

### 4.1. Web Push VAPID Chuẩn W3C
- Không phụ thuộc bên thứ ba (Zalo OA, SMS gateway), hoàn toàn miễn phí.
- Hỗ trợ lưu trữ nhiều thiết bị/trình duyệt cho mỗi cán bộ (`PushSubscription`).
- Tự động hủy đăng ký (deactivate) nếu endpoint trả về mã lỗi `410 Gone` hoặc `404 Not Found`.

### 4.2. Tóm Tắt Nhắc Việc Buổi Sáng (Daily Digest lúc 07:30 AM)
- Dịch vụ nền `TaskReminderBackgroundService` chạy nền độc lập.
- Mỗi ngày đúng **07:30 sáng** (giờ địa phương), hệ thống quét toàn bộ nhiệm vụ:
  - Đang thực hiện trong ngày.
  - Sắp đến hạn chót (trong vòng 24h - 72h).
  - Quá hạn chưa hoàn thành.
- Gửi bản tin tóm tắt công việc buổi sáng qua Web Push đến từng cán bộ công chức.
