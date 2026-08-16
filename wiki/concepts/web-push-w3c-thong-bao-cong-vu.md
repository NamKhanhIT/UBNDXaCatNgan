# Web Push W3C & Hệ Thống Thông Báo Công Vụ Tức Thời

> **Một dòng định nghĩa:** Giải pháp thông báo đẩy thời gian thực tuân thủ chuẩn mở W3C Push API & VAPID, truyền tải tin tức nhắc việc an toàn, bảo mật và miễn phí đến thiết bị của cán bộ công chức mà không phụ thuộc bên thứ ba.

---

## 1. Lý Do Lựa Chọn Web Push W3C Thay Vì Zalo Cá Nhân Không Chính Thức

1. **Rủi ro bảo mật & pháp lý**: Các giải pháp gửi tin Zalo cá nhân không qua OA đều dựa trên kỹ thuật đánh cắp Cookie/Session cá nhân, vi phạm điều khoản dịch vụ và tiềm ẩn nguy cơ lộ lọt bí mật nhà nước.
2. **Chuẩn mở W3C**: Hoạt động trực tiếp trên nền tảng trình duyệt hiện đại (Chrome, Edge, Safari, Firefox) thông qua Service Worker và cặp khóa VAPID (Voluntary Application Server Identification).
3. **Đa nền tảng**: Nhận thông báo trên máy tính để bàn, laptop, điện thoại Android và iPhone/iPad (iOS 16.4+ qua chế độ PWA Thêm vào Màn hình chính).

---

## 2. Kiến Trúc Luồng Đẩy Thông Báo (Push Flow)

```
[Server .NET 8] ──(Payload mã hóa VAPID)──> [Push Service (Google FCM / Apple APNs / Mozilla)]
                                                                   │
                                                                   ▼
[Thiết bị cán bộ] <──(Đánh thức Service Worker `sw.js`)────────────┘
        │
        ├── Hiển thị thông báo (Icon, Tiêu đề, Nội dung, Badge)
        └── Khi cán bộ bấm vào ➔ Focus / Mở tab đúng nhiệm vụ cần xử lý
```

---

## 3. Các Loại Thông Báo Được Kích Hoạt Tự Động

1. **Giao việc mới**: Khi Lãnh đạo giao một công việc mới cho cán bộ.
2. **Cảnh báo hạn chót (Deadlines)**:
   - Sắp đến hạn: Nhắc trước 3 ngày (`3 days warning`).
   - Khẩn cấp: Nhắc trước 1 ngày (`1 day urgent warning`).
   - Quá hạn: Cảnh báo vi phạm tiến độ (`Overdue alert`).
3. **Phê duyệt / Từ chối nghiệm thu**: Thông báo ngay khi kết quả nộp bài được thẩm định hoặc yêu cầu làm lại.
4. **Đề xuất sửa điểm (Maker-Checker)**: Thông báo Lãnh đạo Cấp 1 khi có đề xuất sửa điểm lệch $> 1.0$ điểm.
5. **Bản tin tóm tắt mỗi sáng (Daily Digest)**: Gửi lúc 07:30 sáng tóm tắt toàn bộ việc cần làm trong ngày.

---

## 4. Cài Đặt Trong Hệ Thống Mã Nguồn

- **Backend**:
  - Entity: `PushSubscription.cs`
  - Service: `WebPushNotificationService.cs`, `IWebPushNotificationService.cs`
  - Controller: `PushController.cs` (`/api/v1/Push/subscribe`, `/api/v1/Push/vapid-public-key`)
  - Options: `WebPushOptions.cs`
- **Frontend**:
  - Service Worker: `frontend/web/public/sw.js`
  - Service: `push-notification.service.ts`
  - UI Component: Topbar Quick Status Button & Web Push Settings Modal trong `page.tsx`

---

## Các Trang Wiki Liên Quan

- [Hệ Thống UBND Xã Cát Ngạn](../products/ubnd-xa-cat-ngan-system.md)
- [Dịch Vụ Nhắc Việc Tự Động Daily Digest](../patterns/daily-digest-cron-service.md)
