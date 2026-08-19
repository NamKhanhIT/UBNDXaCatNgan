# 🏛️ Hệ Thống Quản Lý Công Việc & Điều Hành Tác Nghiệp Thông Minh UBND Cấp Xã

Giải pháp phần mềm **Quản lý công việc và Điều hành tác nghiệp trực tuyến chuyên biệt dành cho Ủy ban nhân dân Cấp Xã (Xã, Phường, Thị trấn)**. Hệ thống hỗ trợ toàn diện cho Lãnh đạo UBND (Chủ tịch, Phó Chủ tịch), Trưởng phòng/ban chuyên môn và Cán bộ chuyên viên trong việc tiếp nhận văn bản, phân công nhiệm vụ, theo dõi tiến độ thời gian thực, đánh giá cán bộ công tâm và điều hành chính quyền số theo chuẩn **Nghị định 30/2020/NĐ-CP** và **Luật 72/2025/QH15**.

---

## 📌 1. Giới thiệu Tổng quan (Overview)

### 🎯 Mục tiêu & Ý nghĩa
- **Số hóa & Chuẩn hóa quy trình công vụ**: Xóa bỏ hoàn toàn tình trạng quản lý thủ công qua sổ sách, giấy tờ và nhóm chat rời rạc; thiết lập quy trình luân chuyển công việc số hóa khép kín, minh bạch và an toàn.
- **Điều phối công việc công bằng & tối ưu**: Giúp Lãnh đạo nắm bắt trực quan định mức và tải trọng công việc (Workload Capacity 40h/tuần) của từng cán bộ, cảnh báo quá tải kịp thời để điều phối nhân sự hợp lý.
- **Đánh giá thi đua khách quan (Thang điểm 10)**: Kết hợp tự động giữa **3.0 điểm hệ thống** (đúng hạn, tiến độ checklist, không bị trả lại) và **7.0 điểm chất lượng** do Lãnh đạo thẩm định.
- **Hỗ trợ toàn diện cơ chế kiêm nhiệm**: Cho phép cán bộ chuyển đổi ngữ cảnh vai trò (Context Switching) tức thì chỉ với một thao tác mà vẫn phân định rõ trách nhiệm công vụ.

---

## 🔥 2. Các Phân hệ & Tính năng Cốt lõi (Core Modules)

### 🤖 1. Trợ lý AI Phân tích Văn bản Công vụ
- **Bóc tách thông minh**: Đọc hiểu nội dung văn bản hành chính (PDF, DOCX, bản scan OCR), tự động trích xuất loại văn bản, số ký hiệu, trích yếu, thời hạn xử lý và các mục tiêu cụ thể theo chuẩn Nghị định 30/2020/NĐ-CP.
- **Gợi ý phân công tự động**: Phân tích nội dung nhiệm vụ và đối chiếu với hồ sơ chuyên môn, thâm niên và mức tải hiện tại của cán bộ để đề xuất người phụ trách phù hợp nhất.
- **Trợ lý soạn thảo**: Hỗ trợ cán bộ tạo nhanh dự thảo Tờ trình, Thông báo, Kế hoạch, Báo cáo công vụ chuẩn thể thức.
- **Bảo mật & Chủ quyền dữ liệu (Data Sovereignty)**: Chạy mô hình ngôn ngữ AI cục bộ (Local LLM Qwen2.5 qua Ollama), đảm bảo 100% dữ liệu hành chính không bị gửi ra máy chủ bên ngoài.

### 📥 2. Quản lý Văn bản Đến & Văn bản Đi (Inbox & Outgoing Documents)
- **Inbox Triage (Tiếp nhận & Phân loại)**: Tiếp nhận văn bản đến từ cấp trên và nội bộ; hỗ trợ chuyển đổi trực tiếp văn bản thành nhiệm vụ (Auto-mapping điền sẵn tiêu đề, hạn chót, nội dung).
- **Quy trình Văn bản Đi khép kín**: Soạn thảo dự thảo, lưu lịch sử phiên bản (Version Control), trình duyệt ký, ban hành, cấp số tự động và cơ chế thu hồi văn bản chặt chẽ.
- **Xem văn bản trực tuyến**: Hỗ trợ xem trực tiếp tài liệu đính kèm (PDF, DOCX, ảnh) ngay trong trình duyệt mà không cần cài đặt phần mềm ngoài.

### 📋 3. Giao việc & Quản lý Tiến độ (Task Management)
- **Smart Assignee Picker**: Lưới thẻ cán bộ trực quan theo từng phòng ban, hiển thị % tải việc thời gian thực (cảnh báo đỏ khi quá tải >80%).
- **Checklist Sản phẩm Đầu ra (Sub-tasks)**: Quy định rõ các sản phẩm/tiêu chí con cần nộp, tiến độ tự động cập nhật theo tỷ lệ checklist hoàn thành.
- **Chú thích tài liệu nộp bài (Inline Task Review Annotation)**: Lãnh đạo có thể bôi đen từng đoạn văn bản nộp bài để ghi chú, chỉ điểm lỗi sai và yêu cầu chỉnh sửa trực quan.

### ⚖️ 4. Thang điểm 10 Đánh giá & Báo cáo Thi đua (Dual Evaluation & GRAD)
- **Cơ chế đánh giá kép**:
  - **3.0 điểm Hệ thống**: Tự động tính toán dựa trên thời gian nộp bài (sớm/đúng hạn), % hoàn thành checklist và số lần bị trả lại.
  - **7.0 điểm Lãnh đạo**: Lãnh đạo thẩm định chất lượng tài liệu và thái độ thực hiện.
- **Kiểm soát sửa điểm (Maker-Checker)**: Ngăn chặn can thiệp điểm tùy tiện; mọi yêu cầu điều chỉnh điểm vượt ngưỡng quy định phải được cấp có thẩm quyền phê duyệt kèm tệp minh chứng.
- **Báo cáo định kỳ (GRAD)**: Tổng hợp biểu đồ tiến độ, phân loại thi đua cán bộ phục vụ giao ban UBND và báo cáo giám sát của HĐND, UBMTTQ.

### 📅 5. Lịch Công tác & Sự kiện (Google Calendar Style)
- Giao diện lịch tuần 3 ca (Sáng, Chiều, Tối) chuẩn công vụ, hỗ trợ quản lý phòng họp, tài nguyên và sự kiện quan trọng.
- Cho phép liên kết sự kiện trực tiếp với đầu việc cụ thể và phân công cán bộ tham gia.

### 🔔 6. Thông báo & Nhắc việc Đa kênh (Web Push W3C & SignalR)
- **Thông báo đẩy W3C (Web Push)**: Nhận thông báo công việc tức thời trên trình duyệt máy tính và điện thoại di động (PWA) mà không phụ thuộc vào ứng dụng bên thứ ba.
- **Real-time SignalR**: Cập nhật thông báo, tin nhắn đôn đốc và chuông cảnh báo tức thì ngay khi mở trang web.
- **Dịch vụ Tóm tắt Sáng sớm (Daily Digest Service)**: Tự động quét và gửi bản tin nhắc việc tổng hợp lúc 07:30 mỗi sáng cho cán bộ.

---

## 🏛️ 3. Cơ cấu Tổ chức & Mô hình Phân quyền

Hệ thống được thiết kế tối ưu cho mô hình tổ chức chính quyền cấp Xã gồm **05 Phòng/Ban/Khối chuyên môn**:
1. **Văn phòng HĐND & UBND**: Tham mưu tổng hợp, nội chính, văn thư lưu trữ, tiếp công dân, thi đua khen thưởng.
2. **Phòng Kinh tế - Hạ tầng & Đô thị**: Địa chính, đất đai, quy hoạch, tài nguyên môi trường, tài chính - ngân sách, nông thôn mới.
3. **Phòng Văn hóa - Xã hội**: Văn hóa, thể thao, y tế, giáo dục, chính sách người có công, an sinh xã hội.
4. **Trung tâm Phục vụ Hành chính công**: Đầu mối Một cửa tiếp nhận, số hóa và giải quyết 100% thủ tục hành chính công.
5. **Khối Đảng - HĐND - UBMTTQ**: Công tác Đảng, giám sát phản biện xã hội của UBMTTQ và các ban HĐND.

### 3 Cấp phân quyền (RBAC Scope):
- **Cấp 1 (Lãnh đạo cao nhất - Chủ tịch UBND, Bí thư Đảng ủy, Chủ tịch HĐND, Chủ tịch UBMTTQ)**: Quản lý toàn bộ 5 phòng ban, theo dõi định mức tải việc toàn xã, điều phối công việc liên phòng ban.
- **Cấp 2 (Lãnh đạo phòng/ban - Trưởng phòng chuyên môn)**: Quản lý và giao việc cho cán bộ trong phạm vi phòng ban.
- **Cấp 3 (Chuyên viên / Cán bộ nghiệp vụ)**: Tiếp nhận nhiệm vụ, cập nhật checklist sản phẩm, phối hợp công việc nội bộ và nộp báo cáo.

---

## 💻 4. Kiến trúc Công nghệ (Tech Stack)

```
├── Backend:      .NET 8 Web API (Clean Architecture, CQRS với MediatR)
├── Database:     PostgreSQL + Entity Framework Core (UTC DateTime chuẩn hóa)
├── Realtime:     ASP.NET Core SignalR WebSockets
├── Push Notif:   W3C Web Push Protocol (VAPID Encryption)
├── AI Engine:    Qwen (Ollama local / OpenAI-Compatible API / HF ZeroGPU)
├── OCR:          PdfPig + OpenXML Document Parsing
└── Frontend:     Next.js 14 (App Router), React, TypeScript, Tailwind CSS, PWA
```

---

## 🚀 5. Hướng dẫn Khởi chạy Nhanh (Getting Started)

> 📖 **Muốn triển khai toàn hệ thống MIỄN PHÍ trên cả máy tính lẫn điện thoại (PWA)?**
> Đọc ngay: [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) — hướng dẫn 8 bước:
> Cloudflare Tunnel miễn phí + AI Hugging Face Space ZeroGPU + Oracle Cloud Always Free + Web Push VAPID.

### Yêu cầu môi trường:
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/) & npm
- [PostgreSQL 14+](https://www.postgresql.org/)

### 1. Khởi chạy Backend API (.NET 8):
```bash
cd src/Quanlycongviec.Api
dotnet run
```
> *API khởi chạy tại: `http://localhost:5015` (Swagger UI: `http://localhost:5015/swagger`)*

### 2. Khởi chạy Frontend (Next.js):
```bash
cd frontend/web
npm install
npm run dev
```
> *Giao diện Web khởi chạy tại: `http://localhost:3000`*

---

## 🛡️ 6. Bảo mật & Quy chuẩn Phát triển

Toàn bộ các quy tắc ứng xử của AI, quy chuẩn bảo mật Git, hướng dẫn kiến trúc và bối cảnh nghiệp vụ được quy hoạch tại:
- **Tài liệu dự án & Hướng dẫn kỹ thuật**: Xem thư mục [`docs/`](docs/README.md)
- **Bộ Quy tắc Master Rules**: Xem tệp [`.agents/AGENTS.md`](.agents/AGENTS.md)
- **Kho tri thức quy chế & thiết kế**: Xem thư mục [`wiki/`](wiki/index.md)
