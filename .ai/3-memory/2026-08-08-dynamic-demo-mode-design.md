# Thiết kế Kỹ thuật: Chế độ Demo Động (Dynamic Demo Mode)

## 1. Mục tiêu
1. **Cloudflare Tunnel (`*.trycloudflare.com`)**: Ép buộc 100% Chế độ Demo (Read-Only) ở cấp Backend. Khách truy cập từ xa không thể thực hiện bất kỳ thao tác Thêm/Sửa/Xóa nào gây ảnh hưởng đến Database thật.
2. **Localhost (`localhost:3000`)**: Cho phép người dùng local bật/tắt linh hoạt Chế độ Demo ngay trên thanh Header của giao diện web mà không cần khởi động lại server hay sửa file config.

---

## 2. Thiết kế Backend (`Quanlycongviec.Api`)

### [DemoModeMiddleware.cs](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/src/Quanlycongviec.Api/Middleware/DemoModeMiddleware.cs)
Middleware xử lý 2 tầng kiểm tra:
1. **Tầng 1 (Bắt buộc cho Cloudflare)**: 
   - Kiểm tra `Origin`, `Host`, `X-Forwarded-Host`. Nếu chứa `trycloudflare.com` hoặc `loca.lt`:
   - Chặn tất cả lệnh `POST`, `PUT`, `DELETE`, `PATCH` (trừ Auth/SignalR) và phản hồi:
     `"Truy cập từ xa qua Cloudflare Tunnel chỉ được phép dùng Chế độ Demo chỉ đọc. Dữ liệu thật được bảo vệ 100%."`

2. **Tầng 2 (Linh hoạt cho Localhost)**:
   - Nếu request từ `localhost`: Kiểm tra Header `X-Demo-Mode: true`.
   - Nếu `X-Demo-Mode: true` -> Chặn thao tác ghi (Demo Mode).
   - Nếu `X-Demo-Mode: false` -> Thực thi trực tiếp vào PostgreSQL thật.

---

## 3. Thiết kế Frontend (`frontend/web`)

### [api.config.ts](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/frontend/web/src/services/api.config.ts)
- Đọc trạng thái `demo_mode` từ `localStorage`.
- Đưa Header `X-Demo-Mode: true/false` vào mọi request gửi tới Backend API.

### [page.tsx](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/frontend/web/src/app/page.tsx)
- Thêm nút Toggle Switch **"Chế độ Demo"** ở thanh Header Sidebar.
- Nếu mở bằng Cloudflare Tunnel: Hiển thị nhãn cố định `🛡️ Cloudflare Demo (Đã khóa DB thật)`.
- Nếu mở bằng Localhost: Cho phép bấm vào để bật/tắt giữa **Chế độ Thực (PostgreSQL)** và **Chế độ Demo (Chỉ đọc)**.

---

## 4. Kế hoạch kiểm thử (Verification)
1. Kiểm thử truy cập từ `localhost:3000`:
   - Bật Demo Mode -> Thử tạo công việc -> Nhận thông báo "Đang ở chế độ Demo".
   - Tắt Demo Mode -> Thử tạo công việc -> Tạo công việc thành công trong PostgreSQL.
2. Kiểm thử giả lập request từ Cloudflare:
   - Gửi request kèm Header `Origin: https://xxx.trycloudflare.com` -> Bị chặn 100% dù client gửi bất kỳ header nào.
