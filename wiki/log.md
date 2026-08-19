# Nhật Ký Tích Hợp Tri Thức (Wiki Ingest Log)

## [2026-08-19] Cập nhật Giai đoạn 2 & 3 — PWA, Nhắc việc, Zero-cost
- **Giai đoạn 2 (Điện thoại & Nhắc việc)**:
  - Icon PWA hợp lệ (192/512 + maskable + apple-touch-icon) → cài đặt được trên Chrome/Android/iOS.
  - `manifest.json`: thêm id, scope, display_override, maskable purpose.
  - `sw.js`: sửa `notificationclick` (chỉ navigate 1 tab), thêm `pushsubscriptionchange` tự đăng ký lại, icon hợp lệ.
  - Sửa token upload file (`files.service.ts`) và SignalR `accessTokenFactory` → hoạt động khi truy cập remote/điện thoại.
  - **Sửa lỗi 7 giờ** trong `TaskReminderBackgroundService`: so sánh thời gian theo giờ VN (quy ước lưu giờ VN, Kind=Utc) — nhắc trước hạn, trễ hạn, sự kiện, digest giờ đã chuẩn.
  - Daily Digest: window 07:30–07:45 (cấu hình `DailyDigest:WindowMinutes`), marker lưu DB chống gửi trùng khi restart (bỏ static field).
  - Tóm tắt tuần: chỉ 07:00–08:00 sáng thứ Hai.
  - Thống nhất cổng backend 5015 (.env.example + CI).
- **Giai đoạn 3 (Zero-cost hoàn chỉnh)**:
  - `scripts/ai_pipeline/huggingface_space/app.py`: sửa crash `NameError` (`load_cached_datasets` thiếu định nghĩa) → Space khởi động được, cảnh báo khi thiếu dataset.
  - Thống nhất model AI: Ollama `qwen2.5:3b` (máy yếu) / `qwen3:4b` (máy khá) / ZeroGPU `Qwen/Qwen3-14B`.
  - AI HttpClient timeout (`AiProvider:TimeoutSeconds`, mặc định 60s) — không treo request khi AI server chết.
  - Self-host Font Awesome + Noto Sans (kèm Vietnamese subset) + ảnh avatar/hero → không phụ thuộc CDN ngoài, hoạt động offline.
  - Xóa template rác `UBNDXaCN/`, `UBNDXaCN.sln`, 2 file `UnitTest1.cs` rỗng.
  - Thêm `docs/DEPLOYMENT_GUIDE.md` — hướng dẫn triển khai toàn hệ thống 0 đồng (Cloudflare Tunnel + HF Space ZeroGPU + Oracle Always Free + PWA + VAPID + backup).
- **Trạng thái**: Backend build sạch, 103/103 test pass, Next.js production build thành công.

## [2026-08-15] Khởi tạo & Hệ thống hóa toàn bộ Tri thức Hệ thống
- **Nội dung tích hợp**:
  - Khái niệm: Thang Điểm 10 Đánh Giá Thi Đua Cán Bộ (`concepts/thang-diem-10-danh-gia-can-bo.md`).
  - Khái niệm: Quy Chế Maker-Checker Sửa Điểm & Đính Kèm File Minh Chứng (`concepts/quy-che-maker-checker-sua-diem.md`).
  - Khái niệm: Web Push W3C VAPID & Thông Báo Công Vụ (`concepts/web-push-w3c-thong-bao-cong-vu.md`).
  - Mô hình: Chú Thích Khoanh Vùng Văn Bản Nộp Bài (`patterns/inline-task-review-annotation.md`).
  - Mô hình: Dịch Vụ Nền Nhắc Việc Tự Động & Daily Digest 07:30 AM (`patterns/daily-digest-cron-service.md`).
  - Thực thể sản phẩm: Hệ Thống Quản Lý & Điều Hành UBND Xã Cát Ngạn (`products/ubnd-xa-cat-ngan-system.md`).
  - Đồng bộ và nâng cấp toàn diện các tệp bộ nhớ: `docs/business/MEMORY.md`, `docs/business/BUSINESS_MEMORY.md`, `docs/architecture/DECISIONS.md`, `.agents/AGENTS.md`.
- **Trạng thái**: Hoàn tất 100% (Passed all tests & Next.js production build).
