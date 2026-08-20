# Đánh giá & Lộ trình phát triển — Phần mềm Quản lý & Nhắc việc UBND Cấp xã

*Dựa trên kiểm tra trực tiếp mã nguồn `UBNDXaCN.zip`, tài liệu `.ai/` (constitution, architecture, memory, decisions) và 2 báo cáo nghiên cứu bạn đã cung cấp.*

---

## 1. Kết luận nhanh

**Chưa đủ điều kiện lên MVP.** Không phải vì thiếu tính năng — ngược lại, phần `.ai/` của dự án đã có tầm nhìn rất tốt (RBAC/ABAC, Zalo ZNS, dual evaluation, AI guardrails...). Vấn đề là **hai khối Backend và Frontend hiện đang là hai hệ thống hoàn toàn tách rời nhau**, và **chức năng lõi mà bạn cần nhất — nhắc việc liên tục theo thời gian thực — chưa tồn tại ở bất kỳ đâu trong code**, dù nó đã được đặc tả rất kỹ trong tài liệu nghiên cứu.

Cụ thể:

| Khối | Đã có | Chưa có |
|---|---|---|
| **Backend** (.NET 8, Clean Architecture, CQRS/MediatR) | Domain model chuẩn, Đăng ký/Đăng nhập/JWT thật, Context Switching (kiêm nhiệm), Workload heatmap, Audit log, unit test | **Không có middleware xác thực JWT** (endpoint mở hoàn toàn), không có Notification/Reminder, không cron/background job, AI extract là dữ liệu giả lập cứng |
| **Frontend** (Next.js) | Giao diện đầy đủ, đúng chuẩn utilitarian/FontAwesome đã chốt trong `DECISIONS.md` | **Không gọi API backend** — toàn bộ đăng nhập, giao việc, tải việc đều là mock/state tạm trong trình duyệt, mất khi F5 |

Việc cần làm **trước khi thêm bất kỳ tính năng mới nào**: nối hai khối lại với nhau và khoá lỗ hổng bảo mật. Chi tiết ở mục 3.

---

## 2. Bằng chứng cụ thể từ mã nguồn

### 2.1 Backend — điểm mạnh
- Domain model hợp lý: `User`, `Role`, `UserRole` (many-to-many hỗ trợ kiêm nhiệm), `Department`, `Delegation` (ủy quyền có thời hạn), `TaskItem`, `SubTask`, `TaskComment`, `AuditLog`, `WorkloadCapacity`.
- `LoginCommandHandler`, `RegisterCommandHandler`, `SwitchContextCommandHandler`: xác thực thật bằng `IPasswordHasher` + JWT, không phải mock.
- `SwitchContextCommand` đã đúng hướng giải quyết bài toán "kiêm nhiệm" (Bí thư kiêm Chủ tịch UBND) mà báo cáo `TasksSoftware.docx` đề cập — một tài khoản, nhiều vai trò, ghi log khi chuyển ngữ cảnh.
- `GetWorkloadHeatmapQuery`: tính % tải việc thật từ dữ liệu task đang active, không phải số liệu giả.
- Có bộ unit test (`xUnit` + `Moq` + `FluentAssertions`, EF InMemory) cho Auth, CreateTask, Workload — chất lượng test khá tốt cho phần đã viết. *(Không thể chạy `dotnet test` trong môi trường này vì không có .NET SDK — đã review tĩnh, khuyến nghị bạn tự chạy `dotnet test` để xác nhận pass.)*

### 2.2 Backend — lỗ hổng nghiêm trọng
1. **Không endpoint nào có `[Authorize]`.** `AuthController`, `TasksController`, `WorkloadController` đều mở public hoàn toàn.
2. **`app.UseAuthentication()` được gọi trong `Program.cs` nhưng không có `AddAuthentication().AddJwtBearer(...)` nào được đăng ký** ở `Application/DependencyInjection.cs` hay `Infrastructure/DependencyInjection.cs`. Nghĩa là hệ thống sinh JWT nhưng **không có cơ chế xác thực JWT nào cả** — kể cả khi bạn thêm `[Authorize]` vào controller, nó sẽ không hoạt động cho tới khi bổ sung scheme này.
3. **JWT secret key mặc định bị hard-code trong `JwtTokenService.cs`**: `"UBNDXaCatNganEnterpriseSuperSecretKey2026!@#$"`. Đây là secret nằm thẳng trong source, ai đọc được code là giả mạo được token — không chấp nhận được cho hệ thống hành chính công.
4. **`ProcessAIStructuredTaskCommandHandler` (`ai-extract`) là dữ liệu giả lập cứng** (title, deadline, priority đều hardcode), không hề gọi AI thật. Comment trong code ghi đúng hướng ("Simulate AI Engine RAG & Multi-Agent Verification") nhưng chưa triển khai.
5. **Không có `Notification`/`Reminder` entity, không `IHostedService`/`BackgroundService`, không thư viện lịch nền (Quartz.NET/Hangfire), không SignalR.** Đây là lý do gốc rễ khiến "nhắc việc liên tục thời gian thực" — yêu cầu trọng tâm của bạn — chưa tồn tại.
6. Thiếu hàng loạt controller cần thiết: `Departments`, `Users`, `Reports`, `Delegations`, `Comments`/`SubTasks`, `Documents` (upload file), `Notifications`.
7. Chưa thấy EF Core migrations — nghĩa là database chưa được khởi tạo có cấu trúc bảng thật, và cũng chưa có seed data cho 5 phòng ban theo đúng `BUSINESS_MEMORY.md`.
8. Kết nối DB mặc định là SQL Server LocalDB (`Infrastructure/DependencyInjection.cs`) — chỉ chạy được trên Windows, không phù hợp để tự triển khai trên máy chủ Linux nội bộ như báo cáo `TasksSoftware.docx` đã khuyến nghị (PostgreSQL/MySQL).

### 2.3 Frontend — điểm mạnh
- Giao diện dashboard khá đầy đủ (`page.tsx` ~3.860 dòng): tổng quan, lịch tuần 3 ca, module Phòng ban/Cán bộ/Tải việc hợp nhất, form giao việc, báo cáo GRAD — đúng tinh thần utilitarian, FontAwesome, light-mode đã chốt trong `DECISIONS.md`/`BUSINESS_MEMORY.md`.
- Có tách lớp `services/` khá rõ ràng về mặt ý tưởng (auth, task, schedule, report, role-hierarchy).

### 2.4 Frontend — lỗ hổng nghiêm trọng
- **`auth.service.ts` chứa `MOCK_USERS` là mảng cứng với mật khẩu dạng plaintext ngay trong source** (`password: 'catngan2026'`). Đăng nhập chỉ so sánh chuỗi trong bộ nhớ trình duyệt, hoàn toàn không gọi API `/api/v1/Auth/login` của backend.
- Rà toàn bộ thư mục `frontend/web/src` bằng `grep -r "fetch\|axios\|api/v1"` **không tìm thấy bất kỳ lệnh gọi mạng nào tới backend**. Xác nhận: giao diện là một bản "prototype" chạy 100% phía client, dữ liệu giả.
- `schedule.service.ts` có định nghĩa `Reminder` interface nhưng chỉ là cấu trúc dữ liệu tĩnh trong bộ nhớ — không có gửi/nhận/lưu trữ thật nào.
- Hệ quả: mọi thao tác "giao việc", "điều chuyển việc" trên UI hiện tại chỉ đổi state React tạm thời, **mất sạch khi tải lại trang**, không hề ghi xuống database thật dù backend đã có API `POST /api/v1/Tasks` sẵn sàng nhận.

---

## 3. Lộ trình 4 giai đoạn

### Giai đoạn 0 — Nối dây thật + khoá bảo mật (làm trước tiên, không thêm tính năng mới)
- Đăng ký `AddAuthentication().AddJwtBearer(...)` trong `Infrastructure/DependencyInjection.cs`, thêm `[Authorize]` theo `RankLevel`/`RoleCode` lên toàn bộ controller.
- Chuyển JWT secret ra `appsettings.json`/biến môi trường/`dotnet user-secrets`, xoá secret hard-code khỏi source.
- Viết EF Core migration + seed data đúng 5 phòng ban và các Role theo `BUSINESS_MEMORY.md`.
- Thay `auth.service.ts` mock bằng lệnh gọi thật tới `/api/v1/Auth/login`, lưu JWT ở cookie `httpOnly` (không `localStorage`, tránh XSS đánh cắp token của cán bộ).
- Nối `task.service.ts`, `role-hierarchy.service.ts` với các endpoint backend tương ứng; bổ sung các controller còn thiếu (Departments, Users).
- Đổi connection string sang PostgreSQL (Npgsql) để triển khai được trên hạ tầng Linux nội bộ, đúng khuyến nghị chi phí thấp trong tài liệu nghiên cứu của bạn.

### Giai đoạn 1 — Nhắc việc liên tục thời gian thực (trọng tâm yêu cầu chính của bạn)
Đây là phần hoàn toàn chưa tồn tại, cần xây từ đầu:
- Thêm entity `Notification` (UserId, TaskItemId, Type, Channel, SentAt, ReadAt) và `NotificationsController`.
- `BackgroundService` (`IHostedService`) quét `TaskItems` theo chu kỳ (ví dụ mỗi 15 phút), sinh nhắc nhở theo kịch bản đã nêu trong `TasksSoftware.docx`: trước hạn 3 ngày / 1 ngày / 12 giờ, tóm tắt sáng thứ Hai cho việc BAU lặp lại, và **leo thang (escalation)** — trường `IsEscalated` đã có sẵn trong `TaskItem` nhưng chưa có logic nào gán giá trị này.
- Kênh gửi: thông báo trong app qua **SignalR** (để lãnh đạo/chuyên viên thấy chuông đỏ ngay khi đang mở web, đúng yêu cầu "thời gian thực"), cộng thêm **Zalo ZNS** — kênh phù hợp nhất với cán bộ hành chính Việt Nam vì không cần cài app riêng, tỷ lệ mở tin cao hơn hẳn email.
- Nhắc cho **cả hai bên** đúng yêu cầu số 3 trong file docx của bạn: cả người giao lẫn người nhận đều nhận thông báo khi gần hạn.

### Giai đoạn 2 — Hoàn thiện thuật toán đánh giá kép
- `DECISIONS.md` đã mô tả đúng công thức (40% tiến độ tự động từ checklist sub-task + 60% chất lượng lãnh đạo chấm khi nghiệm thu) nhưng hiện chỉ tồn tại ở dạng UI form, chưa có handler tính toán thật ở backend.
- Viết `ApproveTaskCommand`/`RejectTaskCommand` tính điểm, cập nhật `ProgressPercentage`, lưu lịch sử để làm dữ liệu cho báo cáo GRAD.
- `ReportsController` sinh báo cáo tiến độ tự động theo tuần/tháng cho từng phòng ban và toàn xã (yêu cầu số 4 trong file docx gốc của bạn).

### Giai đoạn 3 — AI thật thay cho dữ liệu giả lập
- Thay `ProcessAIStructuredTaskCommandHandler` bằng lệnh gọi Claude/GPT API thật, ép **structured output theo JSON Schema** (đúng "Rào chắn 1" trong `TasksSoftware.docx`) để tránh AI bịa tên nhân sự/deadline không tồn tại.
- Áp dụng RAG khi tóm tắt văn bản dài, bắt buộc trích dẫn nguồn, và giữ nguyên tắc **human-in-the-loop**: task do AI tạo luôn ở trạng thái "Bản nháp", cán bộ phải bấm xác nhận mới thực sự giao việc.

---

## 4. Tính năng bổ sung — chọn lọc từ các nền tảng lớn, cân đối với quy mô 1 xã

Tài liệu `TasksSoftware.docx` của bạn đã liệt kê rất đầy đủ (Google GRAD, Microsoft Viva/Azure DevOps, OpenAI/Anthropic guardrails, kiến trúc Amazon-style). Ở đây tôi chọn lọc lại phần **thực sự đáng làm cho một xã** (vài chục đến ~100 cán bộ), tránh over-engineer:

- **Từ Microsoft Teams/Planner** — @mention trong `TaskComment` kèm thông báo tức thời; "Việc của tôi hôm nay" (My Day) làm màn hình mặc định cho chuyên viên thay vì danh sách toàn phòng.
- **Từ Asana/Amazon** — cơ chế leo thang tự động theo SLA (đã nêu ở Giai đoạn 1) và audit log **append-only** (không cho sửa/xoá) — phù hợp nguyên tắc minh bạch trách nhiệm mà báo cáo phân quyền của bạn nhấn mạnh.
- **Từ Slack/Workplace** — nhật ký hoạt động toàn xã (ai giao gì cho ai, lúc nào) và "đã xem" (read receipt) cho văn bản/nhắc việc, giúp lãnh đạo biết cán bộ đã đọc chỉ đạo hay chưa mà không cần hỏi lại.
- **Từ Google GRAD** — thay đánh giá cuối năm một lần bằng check-in định kỳ nhẹ (dữ liệu đã có sẵn từ `Đánh giá kép`), giảm cảm tính khi xét thi đua.
- **Riêng cho bối cảnh hành chính công** (không nền tảng thương mại nào có sẵn): tích hợp Zalo ZNS như đã nói, và cân nhắc kết nối VNeID mức độ 2 cho đăng nhập về lâu dài thay vì mật khẩu tay — vì báo cáo "Phân cấp phân quyền" bạn gửi chỉ rõ đây đang là điểm nghẽn chuyển đổi số quốc gia (dữ liệu cát cứ, thiếu liên thông).

**Cân nhắc quan trọng:** những phần "doanh nghiệp lớn" trong `TasksSoftware.docx` như kiến trúc microservices đầy đủ, load balancer 2 tầng, polyglot persistence (Postgres + MongoDB + Elasticsearch + Redis), app di động native iOS/Android riêng — là **đúng cho nền tảng phục vụ hàng vạn người dùng nhiều xã cùng lúc**, nhưng **quá tải cho một xã một backend .NET monolith hiện tại**. Nếu mục tiêu chỉ là 1 xã, giữ kiến trúc monolith + PostgreSQL + Redis (cho cache/queue nhắc việc) là đủ và dễ vận hành hơn nhiều. Nếu định hình sản phẩm SaaS bán cho nhiều xã, hãy nói rõ để tôi tư vấn lại kiến trúc multi-tenant phù hợp — đó là hai bài toán khác nhau.

---

## 5. Điều chỉnh quy trình nghiệp vụ theo đúng Luật 72/2025/QH15

Dựa trên báo cáo "Phân cấp phân quyền UBND Cấp xã" bạn gửi, đối chiếu với `BUSINESS_MEMORY.md` hiện tại:

- Cơ cấu 5 phòng ban + 3 cấp RBAC trong `BUSINESS_MEMORY.md` đã bám khá sát thực tế luật mới (Văn phòng HĐND-UBND, Phòng Kinh tế, Văn hóa-Xã hội, Trung tâm HCC, Khối Đảng-HĐND-UBMTTQ).
- Đề xuất bổ sung: báo cáo nêu rõ *"các nghị quyết, quyết định của UBND cấp xã bắt buộc phải có báo cáo phản biện của UBMTTQ đính kèm trước khi ban hành"* — nên thêm bước **"Phản biện UBMTTQ"** bắt buộc vào workflow cho `TaskType = Project` (việc trọng điểm/nghị quyết) trước khi chuyển sang `Completed`, khác với luồng đơn giản của việc `BAU`/`AdHoc`.
- Trung tâm Phục vụ hành chính công là *"đầu mối duy nhất"* xử lý hồ sơ công dân — nên tách rõ trong Inbox hai luồng nguồn khác nhau: "Văn bản chỉ đạo nội bộ" và "Hồ sơ TTHC công dân", vì SLA và người xem hai loại này khác nhau.
- `SwitchContextCommand` đã đúng hướng xử lý "nhất thể hóa" (Bí thư kiêm Chủ tịch) — giữ nguyên, chỉ cần đảm bảo Giai đoạn 0 (JWT thật) bảo vệ được hành động chuyển ngữ cảnh này khỏi bị giả mạo.

---

## 6. Bảo mật & an toàn thông tin — checklist bắt buộc

Đúng với yêu cầu "an toàn + bảo mật toàn bộ thông tin" của bạn:

- [x] Bật xác thực JWT thật + `[Authorize]` trên mọi endpoint (mục 3, Giai đoạn 0) — hoàn thành; bổ sung `[Authorize]` còn thiếu trên `RatingHistoryController` & `PushController`; kiểm soát quyền theo policy `LeaderOnly`/`ManagerPlus`.
- [x] Xoá JWT secret hard-code, chuyển sang secret manager/biến môi trường — secret đọc từ `Jwt:Secret` trong config.
- [x] Bắt buộc HTTPS + HSTS ở môi trường production — `UseHsts()` + redirect HTTPS.
- [x] Access token thời hạn ngắn (30 phút) + refresh token 7 ngày (xoay vòng, lưu SHA-256 hash), thay vì hạn 7 ngày như trước.
- [x] Rate limiting cho endpoint đăng nhập (10 lần/5 phút/IP) + global 120 req/phút, chống brute-force mật khẩu cán bộ.
- [x] `AuditLog` append-only ở tầng database — đã thi hành trong `ApplicationDbContext.SaveChangesAsync` (chặn UPDATE/DELETE).
- [ ] Với dữ liệu nhạy cảm (đất đai, tài chính, hồ sơ công dân): cân nhắc mã hoá field-level, không chỉ mã hoá at-rest toàn ổ đĩa.
- [ ] Tách biệt thật sự `appsettings.Development.json` khỏi cấu hình production (hiện file production đang thiếu hẳn connection string — cần đảm bảo secret production không commit vào git). — bổ sung `AGENTS.md` cấm commit/đọc file secret; `.gitignore` chặn `appsettings*.json`/`.env*`.
- [x] Xác thực đa yếu tố (MFA/OTP) cho tài khoản — TOTP RFC 6238 (Google Authenticator tương thích), bật/tắt trong cài đặt tài khoản, đăng nhập 2 bước tại cổng đăng nhập.

---

## 7. Nếu bạn muốn tôi bắt đầu code ngay

Tôi đề xuất bắt đầu từ **Giai đoạn 0** vì mọi tính năng khác đều vô nghĩa nếu dữ liệu giao việc không thật sự được lưu và bảo vệ. Cho tôi biết bạn muốn tôi:
1. Sửa trực tiếp trong project đã upload (thêm JWT middleware, nối frontend thật, viết migration + seed 5 phòng ban), hay
2. Ưu tiên dựng trước module Nhắc việc real-time (Giai đoạn 1) vì đó là tính năng bạn nhấn mạnh nhất,

rồi tôi sẽ triển khai trực tiếp trên codebase và kiểm thử kỹ trước khi giao lại cho bạn.
