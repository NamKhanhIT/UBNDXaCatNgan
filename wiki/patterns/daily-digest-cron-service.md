# Dịch Vụ Nền Nhắc Việc Tự Động & Daily Digest 07:30 AM

> **Một dòng định nghĩa:** Dịch vụ nền (.NET BackgroundService) chạy ngầm tự động quét dữ liệu nhiệm vụ và gửi bản tin nhắc việc cá nhân hóa cho từng cán bộ công chức vào đúng 07:30 mỗi sáng.

---

## 1. Cơ Chế Hoạt Động

Dịch vụ `TaskReminderBackgroundService` kế thừa từ `Microsoft.Extensions.Hosting.BackgroundService`:
1. Sử dụng bộ đếm thời gian lặp `PeriodicTimer(TimeSpan.FromMinutes(1))`.
2. Kiểm tra giờ địa phương Việt Nam (UTC+7). Khi đồng hồ điểm đúng **07:30:00 - 07:30:59**:
   - Truy vấn toàn bộ cán bộ công chức đang có nhiệm vụ được phân công.
   - Thống kê:
     - Số nhiệm vụ đến hạn trong ngày.
     - Số nhiệm vụ khẩn cấp sắp đến hạn (24h - 72h).
     - Số nhiệm vụ đang bị quá hạn chưa hoàn thành.
   - Định dạng thông điệp Web Push cá nhân hóa và đẩy đồng thời đến các thiết bị của cán bộ.
3. Đồng thời quét liên tục các cảnh báo mốc thời gian:
   - Nhắc trước 3 ngày (`Deadlines in 3 days`).
   - Nhắc trước 1 ngày (`Deadlines in 1 day`).
   - Báo quá hạn (`Overdue tasks`).
   - Báo cáo tuần (`Weekly summary vào 08:00 sáng Thứ Hai`).

---

## 2. Cấu Hình Hệ Thống (`appsettings.json`)

```json
{
  "DailyDigest": {
    "Enabled": true,
    "Hour": 7,
    "Minute": 30
  }
}
```

---

## 3. Cài Đặt Trong Hệ Thống Mã Nguồn

- **Backend**:
  - Service: `src/Quanlycongviec.Infrastructure/Services/TaskReminderBackgroundService.cs`
  - Options: `src/Quanlycongviec.Application/Common/Options/DailyDigestOptions.cs`
  - Tích hợp: `IWebPushNotificationService`, `IApplicationDbContext`

---

## Các Trang Wiki Liên Quan

- [Hệ Thống UBND Xã Cát Ngạn](../products/ubnd-xa-cat-ngan-system.md)
- [Web Push W3C & Thông Báo Công Vụ](../concepts/web-push-w3c-thong-bao-cong-vu.md)
