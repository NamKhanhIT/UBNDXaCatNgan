# 🚀 Hướng Dẫn Triển Khai Toàn Hệ Thống Với Chi Phí 0 Đồng
## Hệ Thống Quản Lý Công Việc & Điều Hành Tác Nghiệp Thông Minh UBND Cấp Xã

> Tài liệu này tổng hợp **toàn bộ các phương án triển khai miễn phí** cho hệ thống,
> giúp vận hành trên cả **máy tính lẫn điện thoại** (PWA) mà **không tốn bất kỳ chi phí
> phần mềm, dịch vụ hay hosting** nào.

---

## 📐 1. Tổng Quan Kiến Trúc Triển Khai

```
┌──────────────────────────┐     ┌──────────────────────────────┐
│  ĐIỆN THOẠI (PWA)        │     │  MÁY TÍNH (Desktop Browser)  │
│  Chrome/Edge/Safari      │     │  Chrome/Edge/Firefox         │
│  - Cài đặt như app       │     │  - Web Push + SignalR        │
│  - Nhận push notification│     │  - In ấn, bảng biểu          │
└────────────┬─────────────┘     └──────────────┬───────────────┘
             │        HTTPS (bắt buộc cho PWA)   │
             ▼                                  ▼
┌───────────────────────────────────────────────────────────────┐
│  CLOUDFLARE TUNNEL (miễn phí) — mở hệ thống ra Internet       │
│  Hoặc: Oracle Cloud Always Free Load Balancer (miễn phí)     │
└────────────────────────────┬──────────────────────────────────┘
                             ▼
┌───────────────────────────────────────────────────────────────┐
│  MÁY CHỦ CHÍNH (Backend .NET 8 + PostgreSQL)                  │
│  Lựa chọn:                                                     │
│  A. Máy tính/văn phòng UBND xã (LAN + Tunnel)                 │
│  B. Oracle Cloud Always Free (Ampere ARM 2 OCPU / 12GB RAM)   │
│  C. VPS rẻ (vài chục nghìn/tháng — không bắt buộc)            │
└────────────────────────────┬──────────────────────────────────┘
                             ▼
┌───────────────────────────────────────────────────────────────┐
│  AI SERVER (LLM)                                              │
│  A. Hugging Face Space ZeroGPU — Qwen3-14B (100% miễn phí)   │
│  B. Ollama trên máy xã (qwen2.5:3b — chạy CPU)               │
│  C. Oracle Cloud Free ARM + Ollama (qua WireGuard VPN)       │
└───────────────────────────────────────────────────────────────┘
```

**Nguyên tắc chi phí 0:**
- ✅ Không có dịch vụ trả phí nào là bắt buộc (AI, DB, hosting, push, CI đều miễn phí).
- ✅ Toàn bộ font/icon/ảnh đã **self-host** (không phụ thuộc CDN ngoài, hoạt động offline).
- ✅ Web Push dùng VAPID key tự tạo (miễn phí, không cần đăng ký dịch vụ trả phí).
- ✅ CI/CD dùng GitHub Actions free tier.

---

## 🏗️ 2. Phương Án Triển Khai Khuyến Nghị (0 Đồng Toàn Bộ)

| Thành phần | Lựa chọn miễn phí | Chi phí |
|---|---|---|
| AI (LLM) | **Hugging Face Space ZeroGPU** — Qwen3-14B 4-bit | $0 |
| Backend + DB | Máy tính văn phòng xã hoặc **Oracle Cloud Always Free** (Ampere ARM) | $0 |
| Mở ra Internet (điện thoại truy cập) | **Cloudflare Tunnel** (không cần mở port, không cần domain trả phí) | $0 |
| Web Push | VAPID key tự tạo + trình duyệt (FCM/APNs/WebPush) | $0 |
| PWA trên điện thoại | Chrome/Edge/Safari cài từ trình duyệt | $0 |
| CI/CD | GitHub Actions free | $0 |

---

## 📋 3. Kế Hoạch Chi Tiết (Triển Khai Theo Thứ Tự)

### Bước 1 — Chuẩn bị cấu hình Backend

Tạo file `appsettings.Production.json` (hoặc dùng biến môi trường) với đầy đủ:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=ubndxacatngan;Username=postgres;Password=<MAT_KHAU_MANH>"
  },
  "Jwt": {
    "Secret": "<MAT_KHAU_NGAU_NHIEN_32_KY_TU_TRO_LEN>",
    "Issuer": "UBNDXaCatNganApi",
    "Audience": "UBNDXaCatNganClient"
  },
  "WebPush": {
    "PublicKey": "<VAPID_PUBLIC_KEY>",
    "PrivateKey": "<VAPID_PRIVATE_KEY>",
    "Subject": "mailto:admin@catngan.gov.vn"
  },
  "AiProvider": {
    "Type": "ApiCompatible",
    "TimeoutSeconds": 60,
    "ConfidenceThreshold": 0.6,
    "Api": {
      "BaseUrl": "https://<ten-ban>-ubnd-qwen.hf.space",
      "ApiKey": "",
      "Model": "qwen3-14b-ubnd",
      "DataSovereigntyAcknowledged": true
    }
  },
  "Reminder": { "IntervalMinutes": 15 },
  "DailyDigest": { "Enabled": true, "Hour": 7, "Minute": 30, "WindowMinutes": 15 },
  "DemoMode": { "Enabled": false, "UseInMemoryDatabase": false, "ReadOnlyMode": false }
}
```

> ⚠️ **Bảo mật:** KHÔNG commit file này lên Git. Dùng `dotnet user-secrets` hoặc biến môi trường.
> ⚠️ `DataSovereigntyAcknowledged = true` nghĩa là bạn xác nhận gửi nội dung văn bản ra
> Space HF (đặt riêng của xã, không ai khác truy cập). Nếu muốn tuyệt đối giữ dữ liệu nội bộ,
> dùng phương án Ollama local (mục 4).

### Bước 2 — Sinh cặp VAPID Key (miễn phí)

```bash
npx web-push generate-vapid-keys
```
Kết quả gồm 2 key (public + private). Điền vào `WebPush:PublicKey` / `WebPush:PrivateKey` ở trên.
> LƯU Ý: Bản cũ có cặp key MẪU hardcode trong code — nó chỉ dùng khi chưa cấu hình.
> Bắt buộc tạo key riêng cho production, nếu không push sẽ bị trình duyệt từ chối (401).

### Bước 3 — Cài đặt PostgreSQL & di trú CSDL

```bash
# Cài PostgreSQL 14+ trên máy chủ
sudo apt install postgresql -y
sudo -u postgres createdb ubndxacatngan
sudo -u postgres psql -c "CREATE USER ubnd WITH PASSWORD '<mat_khau>';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ubndxacatngan TO ubnd;"

# Backend tự động chạy migration khi khởi động (DbInitializer) — không cần lệnh tay
dotnet run --project src/Quanlycongviec.Api
```

### Bước 4 — Build & publish Frontend (Next.js)

```bash
cd frontend/web
npm ci
npm run build        # Sinh thư mục .next — hoàn toàn tự host font/icon, không cần mạng ngoài
# Chạy production:
npm run start        # mặc định cổng 3000
```

> Không cần set `NEXT_PUBLIC_API_URL` khi chạy qua reverse proxy mặc định
> (Next.js rewrite `/api` → backend, xem `next.config.js`, mặc định `http://localhost:5015`).

### Bước 5 — Mở hệ thống ra Internet bằng Cloudflare Tunnel (miễn phí)

```bash
# Cài cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

# Tạo tunnel tạm (URL dạng https://xxx.trycloudflare.com)
cloudflared tunnel --url http://localhost:3000

# Hoặc tunnel vĩnh viễn (khuyến nghị — URL cố định):
cloudflared tunnel login
cloudflared tunnel create ubnd-xa
cloudflared tunnel route dns ubnd-xa ubnd.ten-xa.tk   # dùng domain miễn phí .tk/.pp.ua
cloudflared tunnel run ubnd-xa
```

> ⚠️ Chú ý: Nếu dùng URL `trycloudflare.com`, hệ thống chạy ở chế độ **Demo Read-Only**
> (không ghi được dữ liệu). Dùng tunnel vĩnh viễn với domain riêng để có toàn quyền.

### Bước 6 — Cài đặt PWA trên điện thoại

1. Mở URL hệ thống trên **Chrome (Android)** hoặc **Safari (iPhone)**.
2. **Android:** Chrome → menu ⋮ → "Thêm vào Màn hình chính" (Add to Home screen).
3. **iPhone/iPad:** Safari → nút Chia sẻ → "Thêm vào Màn hình chính".
4. Vào **Cài đặt Thông báo** trong hệ thống → bật "Nhận thông báo đẩy trên thiết bị này".

> ✅ Yêu cầu bắt buộc: trang phải chạy **HTTPS** (Cloudflare Tunnel cấp sẵn chứng chỉ miễn phí).
> ✅ Icon PWA đã hợp lệ (192/512 + maskable + apple-touch-icon) — cài đặt thành công trên
> Chrome, Android, iOS 12.4+.

### Bước 7 — Triển khai AI (Hugging Face Space ZeroGPU)

Tham khảo chi tiết: [`docs/huong_dan_huggingface_space_ai.md`](huong_dan_huggingface_space_ai.md)

Tóm tắt:
1. Tạo Space mới: `sdk: gradio`, hardware **ZeroGPU**.
2. Upload mã trong `scripts/ai_pipeline/huggingface_space/` (app.py, rag_engine.py, requirements.txt, README.md).
3. Set biến môi trường: `MODEL_ID=Qwen/Qwen3-14B`, `SPACE_API_KEY=<tùy chọn>`.
4. (Tùy chọn) Upload thư mục `data/` chứa `ubnd_train.jsonl` (800 mẫu) + `ubnd_test.jsonl` (200 mẫu)
   để kích hoạt phân hệ duyệt dữ liệu/benchmark.
5. Cấu hình `AiProvider` như Bước 1. Kiểm tra `GET /health` của Space trước khi bật cho backend.

### Bước 8 — Sao lưu (backup) hàng ngày

```bash
# Cron hàng ngày 02:00
0 2 * * * pg_dump -U ubnd ubndxacatngan | gzip > /backup/ubnd_$(date +\%F).sql.gz
# Giữ 30 ngày gần nhất
0 3 * * * find /backup -name "*.sql.gz" -mtime +30 -delete
```

---

## 🖥️ 4. Phương Án Khác: Ollama Nội Bộ (Không Gửi Dữ Liệu Ra Ngoài)

Nếu xã yêu cầu **tuyệt đối không gửi dữ liệu ra ngoài**:

### 4a. Ollama trên máy tính xã (chạy CPU, miễn phí)

```bash
# Cài Ollama: https://ollama.com/download
ollama pull qwen2.5:3b      # máy yếu (8GB RAM)
ollama pull qwen3:4b        # máy khá (16GB RAM)
ollama serve
```

Cấu hình backend:
```json
"AiProvider": {
  "Type": "Ollama",
  "TimeoutSeconds": 120,
  "Ollama": { "BaseUrl": "http://localhost:11434", "Model": "qwen2.5:3b" }
}
```

> Mô hình được thống nhất trong toàn bộ config/docs:
> - **Máy yếu:** `qwen2.5:3b` (3B, ~2GB RAM, vài giây/văn bản)
> - **Máy mạnh:** `qwen3:4b`
> - **HF Space ZeroGPU:** `Qwen/Qwen3-14B` (đặt tên API: `qwen3-14b-ubnd`)

### 4b. Oracle Cloud Always Free (Ampere ARM) + WireGuard

Chi tiết: [`docs/huong_dan_tu_host_va_dao_tao_qwen_ubnd.md`](huong_dan_tu_host_va_dao_tao_qwen_ubnd.md)

Tóm tắt:
- VM Ampere A1: 2 OCPU + 12GB RAM (miễn phí vĩnh viễn).
- Cài Ollama + backend + PostgreSQL trên VM này.
- Dùng WireGuard VPN nối máy xã ↔ VM nếu muốn AI chạy trên máy xã.

---

## 📲 5. Kiểm Tra & Vận Hành Trên Điện Thoại

| Chức năng | Cách kiểm tra |
|---|---|
| Cài app (PWA) | Trình duyệt → "Thêm vào màn hình chính" → icon hiển thị đúng |
| Nhận push | Cài đặt thông báo → bật → "Gửi thử nghiệm" → điện thoại rung/đổ chuông |
| Nhắc hạn 3/1 ngày | Tạo task hạn 3 ngày → đúng ngày, nhận thông báo |
| Cảnh báo trễ hạn | Để task quá hạn → nhận cảnh báo (không lệch giờ — đã sửa múi giờ VN) |
| Daily Digest 07:30 | Sáng hôm sau nhận bản tóm tắt nhiệm vụ |
| Tóm tắt tuần | 07:00–08:00 sáng thứ Hai |
| Realtime (SignalR) | Mở 2 tab → giao việc ở tab này → tab kia hiện ngay |
| Upload file | Upload PDF/ảnh qua điện thoại → xem trực tuyến |

---

## 🧯 6. Xử Lý Sự Cố Thường Gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Push không đến | VAPID key mẫu chưa thay / chưa HTTPS | Sinh key riêng (Bước 2), đảm bảo HTTPS |
| Đăng nhập thất bại | Seed SQL chưa chạy (scripts bị ẩn khỏi Git) | Chạy `scripts/seed_database.sql` thủ công trên máy chủ |
| AI trả lỗi/treo | Space tắt / Ollama chưa bật | Kiểm tra `/health`; timeout 60s tự trả lỗi thay vì treo |
| 403 khi ghi dữ liệu | Đang truy cập qua `trycloudflare.com` | Dùng tunnel vĩnh viễn + domain riêng |
| Real-time không chạy từ xa | Thiếu Bearer token cho SignalR | Đã sửa — tự động gắn token khi truy cập remote |
| Chậm khi phân tích AI | Model quá to với CPU | Hạ xuống `qwen2.5:3b` hoặc dùng ZeroGPU |

---

## 📌 7. Checklist Bàn Giao Vận Hành

- [ ] VAPID key riêng đã sinh và cấu hình
- [ ] `Jwt:Secret` là chuỗi ngẫu nhiên ≥ 32 ký tự, không nằm trong Git
- [ ] Mật khẩu PostgreSQL mạnh, backup tự động hàng ngày
- [ ] HTTPS hoạt động (kiểm tra biểu tượng ổ khóa trên điện thoại)
- [ ] PWA cài đặt được trên 1 điện thoại Android + 1 iPhone
- [ ] Web Push gửi thử nghiệm thành công trên cả 2
- [ ] AI Space `/health` OK, backend kết nối được
- [ ] Test đầy đủ: `dotnet test Quanlycongviec.sln`
- [ ] Bàn giao tài khoản admin + đổi mật khẩu seed

---

*Tài liệu được cập nhật theo các thay đổi Giai đoạn 2 & 3 (PWA, push, nhắc việc, self-host assets, AI pipeline).*