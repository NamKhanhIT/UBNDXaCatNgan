# Quy Tắc Phát Triển Backend .NET 8 & Cơ Sở Dữ Liệu (Backend & Database Rules)

## 1. Kiến Trúc Tổng Thể (.NET 8 Clean Architecture)
- **Domain Layer (`Quanlycongviec.Domain`)**: Chứa Entities, Enums, Value Objects, Domain Events. Tuyệt đối không phụ thuộc vào tầng ngoài.
- **Application Layer (`Quanlycongviec.Application`)**: Chứa CQRS Commands, Queries, DTOs, Validators, Interfaces (`IApplicationDbContext`).
- **Infrastructure Layer (`Quanlycongviec.Infrastructure`)**: Chứa EF Core `ApplicationDbContext`, Migrations, Background Services (`TaskReminderBackgroundService`), Email/Notification services.
- **API Layer (`Quanlycongviec.Api`)**: Chứa Controllers, Middlewares, Dependency Injection setup, Program.cs.

## 2. Quy Tắc CQRS & MediatR
- **Đồng bộ trạng thái**: Mọi hành động làm thay đổi dữ liệu (tạo task, cập nhật tiến độ, giao việc, thu hồi văn bản, phê duyệt đánh giá, xếp lịch sự kiện...) BẮT BUỘC phải đi qua **CQRS Command** và ghi nhận vào cơ sở dữ liệu PostgreSQL.
- **Queries**: Chỉ đọc dữ liệu (`AsNoTracking()`), ánh xạ sang DTO (hoặc qua PaginatedResult), không được phép làm biến đổi state.
- **Validation**: Đặt validation rõ ràng (hạn chế đầu vào rỗng, kiểm tra quyền truy cập).

## 3. Quy Tắc Cơ Sở Dữ Liệu PostgreSQL & EF Core
- **Chuẩn hóa DateTime UTC**:
  - Mọi trường `DateTime` lưu vào PostgreSQL EF Core bắt buộc phải có `DateTimeKind.Utc` (dùng `DateTime.UtcNow` hoặc `.ToUniversalTime()`).
  - Tránh lưu `DateTime.Now` (Local time) gây lỗi `Cannot write DateTime with Kind=Local to PostgreSQL type 'timestamp with time zone'`.
- **Khởi tạo dữ liệu mẫu (`DbInitializer`)**:
  - Phải kiểm tra tồn tại theo **từng bảng riêng biệt** (ví dụ: `if (!await context.InboxDocuments.AnyAsync()) { ... }`, `if (!await context.CalendarEvents.AnyAsync()) { ... }`).
  - Tuyệt đối không dùng 1 check duy nhất cho toàn bộ database vì sẽ làm sót seed data khi có migration mới.
- **Phân trang (Pagination)**: Các endpoint danh sách lớn (Users, InboxDocuments, OutgoingDocuments, Tasks) bắt buộc phải hỗ trợ phân trang với `PaginatedResult<T>` (`pageIndex`, `pageSize`, `totalCount`, `totalPages`).

## 4. Quy Tắc Controller & Serialization
- **Cấu hình JSON Options**: Luôn đăng ký `JsonStringEnumConverter` và `PropertyNameCaseInsensitive = true` trong `AddControllers().AddJsonOptions()`.
- **DTOs**: Sử dụng class DTO với getter/setter rõ ràng cho API request body và response.
- **PowerShell Testing**: Khi viết lệnh kiểm thử `Invoke-RestMethod` / `Invoke-WebRequest` với tiếng Việt, luôn encode payload UTF-8:
  ```powershell
  $body = [System.Text.Encoding]::UTF8.GetBytes($json)
  Invoke-RestMethod -Uri "..." -Method Post -Body $body -ContentType "application/json; charset=utf-8"
  ```
