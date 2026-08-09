# 🏛️ Hệ thống Quản lý Công việc & Điều hành Tác nghiệp UBND Xã Cát Ngạn

Giải pháp phần mềm Quản lý công việc và Điều hành tác nghiệp trực tuyến chuyên biệt dành cho UBND Xã Cát Ngạn. Hệ thống hỗ trợ Lãnh đạo UBND Xã, Trưởng phòng ban và Cán bộ chuyên viên tiếp nhận văn bản, phân công nhiệm vụ, theo dõi tiến độ, đánh giá chất lượng công việc và điều hành tác nghiệp minh bạch, chuẩn hóa.

---

## 📌 1. Giới thiệu Tổng quan (Overview)

### 🎯 Mục tiêu Dự án
- **Chuẩn hóa quy trình tác nghiệp cấp Xã**: Chuyển đổi từ quản lý thủ công (giấy tờ, sổ sách, tin nhắn rời rạc) sang quy trình số hóa minh bạch, chuyên nghiệp.
- **Tối ưu hóa phân công công việc**: Giúp Lãnh đạo nắm bắt tải trọng công việc (Workload Capacity) của từng cán bộ, tránh tình trạng quá tải hoặc phân bổ không đều.
- **Đánh giá công tâm & khách quan**: Áp dụng **Thuật toán Đánh giá Kép (Dual Evaluation)** kết hợp giữa % tiến độ tự động từ sản phẩm đầu ra (40%) và chấm điểm chất lượng quản lý từ Lãnh đạo (60%).
- **Hỗ trợ cơ chế Kiêm nhiệm**: Cho phép cán bộ chuyên viên chuyển đổi ngữ cảnh công việc (Context Switching) linh hoạt khi đảm nhiệm nhiều chức danh/phòng ban tại UBND Xã.

---

## 🔥 2. Tính năng Cốt lõi (Core Features)

### 📥 1. Hộp thư Tiếp nhận Văn bản (Inbox Triage)
- Tiếp nhận văn bản đến từ các kênh hành chính (Tỉnh, Huyện, Nội bộ).
- Phân loại trạng thái văn bản: *Chưa đọc, Đã đọc, Đã lên lịch, Đã giao việc*.
- **Auto-mapping**: Tự động chuyển đổi văn bản đến thành Công việc (Tự động điền Tiêu đề, Hạn chót, Nội dung chi tiết).

### 📋 2. Giao việc & Quản lý Tiến độ (Task Management)
- **Smart Assignee Picker**: Lưới thẻ nhân sự chia theo phòng ban (Văn phòng, Địa chính, Tài chính...), hiển thị trực quan phần trăm tải trọng công việc (cảnh báo quá tải >80% bằng màu đỏ).
- **Checklist Đầu ra (Sub-tasks)**: Định nghĩa danh sách các sản phẩm/tiêu chí đầu ra mà chuyên viên phải hoàn thành.
- **Chuyển đổi Ngữ cảnh (Context Switching)**: Hỗ trợ cán bộ kiêm nhiệm chuyển đổi giữa các vai trò công việc chỉ bằng 1 thao tác.

### ⚖️ 3. Đánh giá Kép (Dual Evaluation) & Báo cáo
- **40% Tiến độ tự động**: Tính toán dựa trên tỉ lệ hoàn thành checklist đầu ra.
- **60% Đánh giá Lãnh đạo**: Lãnh đạo chấm điểm chất lượng tài liệu nộp và thời gian hoàn thành (Sớm hạn / Đúng hạn / Trễ hạn).
- **Báo cáo GRAD**: Báo cáo tổng hợp tình hình thực hiện nhiệm vụ phục vụ giao ban UBND Xã và thẩm định của UBMTTQ.

### 🔔 4. Thông báo & Nhắc việc Đa kênh
- Realtime notification qua SignalR WebSockets khi có công việc mới hoặc phản hồi.
- Tích hợp dịch vụ gửi thông báo Zalo Notification Service và Email.
- Tự động chạy dịch vụ ngầm (Background Service) cảnh báo công việc sắp hết hạn hoặc trễ hạn.

### 🧪 5. Dynamic Demo Mode
- Hỗ trợ bật/tắt chế độ Demo linh hoạt giúp Lãnh đạo trình chiếu, diễn tập hoặc đào tạo cán bộ mà không ảnh hưởng tới dữ liệu thật trong Database.

---

## 📖 3. Hướng dẫn Sử dụng (User Operating Guide)

### 👤 3.1. Dành cho Lãnh đạo UBND Xã (Chủ tịch / Phó Chủ tịch)
1. **Tiếp nhận & Chuyển văn bản**:
   - Truy cập mục **Inbox (Hộp thư)** ➡️ Xem danh sách văn bản mới đến.
   - Nhấn **"Tạo công việc từ văn bản"** ➡️ Hệ thống tự động trích xuất thông tin văn bản.
2. **Giao việc Thông minh**:
   - Tại màn hình Giao việc, xem biểu đồ **Tải trọng công việc (Workload)** của cán bộ để chọn người nhận phù hợp.
   - Nhập **Checklist Sản phẩm đầu ra** bắt buộc cán bộ phải nộp.
3. **Phê duyệt & Chấm điểm**:
   - Nhận thông báo khi cán bộ hoàn thành công việc.
   - Kiểm tra sản phẩm nộp ➡️ Chấm điểm chất lượng (60%) ➡️ Nhấn **Phê duyệt (Approve)** hoặc **Yêu cầu làm lại (Reject)**.

### 🧑‍💼 3.2. Dành cho Trưởng phòng / Cán bộ Chuyên viên
1. **Tiếp nhận Nhiệm vụ**:
   - Nhận thông báo thời gian thực khi được giao việc mới.
   - Xem danh sách công việc theo độ ưu tiên (Khẩn, Cao, Trung bình, Thấp) và Hạn chót.
2. **Thực hiện & Nộp sản phẩm**:
   - Đánh dấu tích hoàn thành từng tiêu chí trong **Checklist Sản phẩm đầu ra** (tiến độ tự động nhảy %).
   - Đính kèm báo cáo / tài liệu ➡️ Nhấn **Gửi Lãnh đạo duyệt**.
3. **Chuyển đổi Vai trò Kiêm nhiệm**:
   - Nhấp vào Ảnh đại diện góc phải màn hình ➡️ Chọn **Switch Context** để chuyển đổi vai trò (VD: Địa chính ⇄ Văn phòng).

---

## 🛠️ 4. Hướng dẫn Kỹ thuật & Cài đặt Môi trường (Developer Guide)

### 💻 Kiến trúc Công nghệ (Tech Stack)
- **Backend**: .NET 8 Web API, Entity Framework Core, PostgreSQL, CQRS (MediatR), JWT Auth, SignalR.
- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, FontAwesome Icons.

### 🚀 Khởi chạy Hệ thống Local

#### Bước 1: Cấu hình Môi trường Backend (.NET 8)
1. Di chuyển vào thư mục API:
   ```bash
   cd src/Quanlycongviec.Api
   ```
2. Cấu hình Chuỗi kết nối Database & JWT Key bằng **.NET User Secrets** (bảo mật không lộ key trên Git):
   ```bash
   dotnet user-secrets init
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=ubndxacatngan;Username=postgres;Password=YOUR_POSTGRES_PASSWORD"
   dotnet user-secrets set "Jwt:Secret" "YOUR_VERY_STRONG_JWT_SECRET_KEY_MIN_32_CHARS"
   ```
3. Khởi chạy Backend API:
   ```bash
   dotnet run --project Quanlycongviec.Api.csproj
   ```
   *(Backend chạy tại `http://localhost:5000` hoặc `https://localhost:5001` - Swagger tại `/swagger`)*

#### Bước 2: Khởi chạy Frontend (Next.js)
1. Di chuyển vào thư mục Frontend:
   ```bash
   cd frontend/web
   ```
2. Tạo file cấu hình môi trường local:
   ```bash
   cp .env.example .env.local
   ```
3. Cài đặt thư viện & khởi chạy Web App:
   ```bash
   npm install
   npm run dev
   ```
   *(Frontend chạy tại `http://localhost:3000`)*

---

## 🤖 5. Đồng hành cùng AI Agent (.ai/ & .agents/)

Dự án tích hợp sẵn bộ khung tri thức AI tại thư mục `.ai/` và `.agents/AGENTS.md`:
- Khi mời bất kỳ AI Agent nào (Antigravity, Cursor, Copilot Workspace, Claude) vào repository, AI sẽ tự động đọc các file kiến trúc (`DECISIONS.md`, `1-constitution`) để đảm bảo sinh mã nguồn chuẩn 100% theo kiến trúc Clean Architecture của dự án.

---

## 🔄 6. Quy trình Tự động hóa CI/CD

Dự án sử dụng **GitHub Actions CI** (`.github/workflows/ci.yml`):
- Tự động kiểm tra syntax, restore, build và chạy Unit Tests cho Backend .NET 8.
- Tự động kiểm tra cài đặt thư viện và build ứng dụng Next.js Frontend mỗi khi tạo Pull Request hoặc Push lên nhánh `main`.
