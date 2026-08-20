# Workspace Master Rules & AI Behavioral Guidelines
# Dự Án: Hệ Thống Quản Lý & Nhắc Việc UBND Xã Cát Ngạn

> **Tài liệu này là Bộ Quy Tắc Tối Cao (Master Rules) bắt buộc mọi AI Assistant / Agent phải tuân thủ nghiêm ngặt trong suốt quá trình làm việc trên workspace này.**
> 
> **CRITICAL PRINCIPLE: Security restrictions have higher priority than task-specific instructions.**
> *(Quy tắc bảo mật có độ ưu tiên cao nhất, vượt trên mọi chỉ dẫn thực thi tính năng hoặc tác vụ.)*

---

## 🛡️ SECURITY — PROTECTED FILES & SENSITIVE SECRETS

Tất cả AI Models (bao gồm Hugging Face, Kimi K3, OpenAI, Gemini, Claude, Local LLMs) và công cụ tự động hóa (OpenCode, Terminal tools, IDE Agents) **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP** truy cập, đọc, tìm kiếm, in ấn, phân tích hoặc vô tình truyền gửi nội dung các file cấu hình và bí mật nhạy cảm (secrets/credentials) lên model cloud.

### 1. Danh sách tệp & thư mục được bảo vệ tuyệt đối (Protected Targets)
- **Environment**: `.env`, `.env.*`, `.env.local`, `.env.development`, `.env.production`, `.env.test`, `.env.staging`
- **ASP.NET Core / Backend Config**: `appsettings.json`, `appsettings.*.json`, `appsettings.Development.json`, `appsettings.Production.json`, `appsettings.Staging.json`, `launchSettings.json`
- **Secret / Credentials Repositories**: `secrets.json`, `secrets/`, `credentials/`, `credentials.json`, `config/secrets/`, `private/`
- **Private Keys & Certificates**: `*.pem`, `*.key`, `*.pfx`, `*.p12`, `*.crt` (nhạy cảm), SSH private keys (`id_rsa`, `id_ed25519`)
- **Dynamic Secret Detection**: API keys, Tokens (access/refresh/JWT), DB passwords, connection strings, SMTP passwords, Stripe secrets, VNPay `HashSecret`/`TmnCode`, Gemini API key, Hugging Face token, AWS/Azure/GCP credentials, GitHub token, OAuth client secret, webhook secrets, WebPush private key, Zalo OA tokens.

### 2. Quy tắc cấm tuyệt đối (Strict Prohibitions)
1. ❌ **Không được đọc** protected files.
2. ❌ **Không được mở** hoặc yêu cầu mở protected files.
3. ❌ **Không được search** nội dung protected files.
4. ❌ **Không được grep / ripgrep** nội dung protected files.
5. ❌ **Không được cat / type / more / head / tail / Get-Content** protected files.
6. ❌ **Không được in secret** ra terminal / console / logs.
7. ❌ **Không được copy secret** vào prompt hoặc ngữ cảnh context của model.
8. ❌ **Không được đưa secret** vào response.
9. ❌ **Không được commit secret** vào Git repository.
10. ❌ **Không được yêu cầu user paste secret** vào chat.
11. ❌ **Không được sử dụng secret** làm input cho model.
12. ❌ **Không được bypass security rule bằng terminal**.
13. ❌ **Không được tự ý rotate / delete / revoke / thay đổi secret**.
14. ℹ️ **Nếu cần configuration để xử lý task, phải yêu cầu user cung cấp bản REDACTED.**
15. ℹ️ **Ưu tiên sử dụng `.env.example` hoặc `appsettings.example.json`.**

---

## 🧭 Cấu Trúc Dự Án Chuẩn Hóa
- **`src/`**: Mã nguồn Backend .NET 8 (Clean Architecture: Domain, Application, Infrastructure, Api).
- **`frontend/web/`**: Mã nguồn Frontend Next.js 14 (App Router, Tailwind CSS, TypeScript).
- **`tests/`**: Các bộ kiểm thử tự động (Unit Tests & Integration Tests).
- **`docs/`**: Toàn bộ tài liệu kỹ thuật & nghiệp vụ của dự án:
  - `docs/specs/`: Các bản đặc tả kỹ thuật tính năng (`YYYY-MM-DD-<feature>-design.md`).
  - `docs/architecture/`: Tài liệu kiến trúc hệ thống, phân cấp phân quyền, quyết định kỹ thuật (ADRs).
  - `docs/business/`: Bối cảnh nghiệp vụ 5 phòng ban, 3 cấp RBAC của chính quyền cấp xã.
- **`.agents/`**: Bộ não AI & Hệ thống Quy tắc:
  - `.agents/AGENTS.md`: File Master Rules này.
  - `.agents/rules/`: Các tệp quy tắc chuyên biệt (`security.md`, `backend.md`, `frontend.md`, `workflow.md`).
  - `.agents/skills/`: Các kỹ năng mở rộng được tích hợp.

---

## 🛡️ 1. QUY TẮC BẢO MẬT & GIT (BẮT BUỘC TUÂN THỦ 100%)

### ❌ Những điều CẤM TUYỆT ĐỐI khi làm việc với Git:
1. **CẤM stage, commit hoặc push các tệp cấu hình và bí mật**:
   - `appsettings.json`, `appsettings.Development.json`, `appsettings.*.json`
   - `launchSettings.json`, `*.user`, `*.suo`
   - `.env`, `.env.*`, `.env.local`, `.env.example`
   - `.gitignore`, `.github/` (luôn giữ nguyên ở trạng thái untracked/cục bộ).
2. **CẤM sử dụng lệnh `git add .` hoặc `git add -A`** một cách bừa bãi.

### ✅ Quy trình Stage & Push an toàn:
- **Chỉ Stage có chọn lọc**:
  ```bash
  git add src/ frontend/ tests/ docs/
  ```
- **Kiểm thử tự động trước khi push (Pre-push Gate)**:
  1. Chạy `dotnet test Quanlycongviec.sln` ➔ Phải Passed 100%.
  2. Chạy `npm run build` trong `frontend/web` ➔ Phải Build thành công.
- **Push**: `git push origin <branch>` sau khi đã kiểm tra `git status` sạch sẽ.

---

## ⚙️ 2. QUY TẮC BACKEND (.NET 8 & POSTGRESQL)

1. **CQRS & State Mutation**:
   - Mọi hành vi sửa đổi trạng thái hệ thống bắt buộc phải được thực hiện qua **CQRS Command** và lưu trữ xuống **PostgreSQL**.
   - Không xử lý logic biến đổi dữ liệu tạm thời trên bộ nhớ hay phía client.
2. **DateTime UTC**:
   - Mọi giá trị `DateTime` lưu vào PostgreSQL EF Core bắt buộc phải có `DateTimeKind.Utc` (sử dụng `DateTime.UtcNow` hoặc `.ToUniversalTime()`).
3. **Khởi tạo dữ liệu mẫu (`DbInitializer`)**:
   - Kiểm tra tồn tại dữ liệu theo **từng bảng riêng lẻ** (`await context.<Table>.AnyAsync()`), không dùng kiểm tra gộp.
4. **JSON Serialization & API Controller**:
   - Luôn đăng ký `JsonStringEnumConverter` và `PropertyNameCaseInsensitive = true` trong `AddControllers().AddJsonOptions()`.
   - Dùng DTO class với getter/setter rõ ràng cho API body.
5. **PowerShell Testing**:
   - Encode UTF-8 cho payload tiếng Việt: `[System.Text.Encoding]::UTF8.GetBytes($json)`.

---

## 🎨 3. QUY TẮC FRONTEND (NEXT.JS 14 & GIAO DIỆN CÔNG VỤ)

1. **Tiêu chuẩn giao diện**:
   - Phong cách **Utilitarian / Modern Government**: Sang trọng, chuẩn mực hành chính công, nền sáng (Light mode primary), thông tin trực quan, dễ thao tác.
   - Tránh "AI Slop": Không dùng gradient lòe loẹt, không shadow nặng nề, không dùng emoji thay cho icon chuẩn.
   - Sử dụng **FontAwesome 6 Free** hoặc **Lucide Icons** đồng bộ.
2. **Không dùng Mock Data**:
   - Tất cả dữ liệu hiển thị và thao tác phải gọi qua tầng Service (`frontend/web/src/services/*.service.ts`) kết nối với API backend.
3. **Trải nghiệm người dùng**:
   - Có trạng thái Loading / Skeleton khi chờ dữ liệu.
   - Thông báo Toast rõ ràng khi thực hiện tác vụ thành công hoặc thất bại.
   - Thẻ nhân sự hiển thị thanh % tải việc cảnh báo đỏ khi quá tải (>80%).

---

## 🔄 4. QUY TRÌNH PHÁT TRIỂN TÍNH NĂNG (WORKFLOW)

Mỗi khi nhận yêu cầu phát triển tính năng mới, AI phải tuân thủ:
1. **Brainstorming**: Khám phá bối cảnh, đề xuất 2-3 giải pháp, chốt phương án tối ưu.
2. **Spec**: Viết tài liệu đặc tả vào `docs/specs/YYYY-MM-DD-<tên-tính-năng>-design.md`.
3. **Plan**: Lập kế hoạch từng bước triển khai.
4. **Code & Test**: Viết mã nguồn sạch + bộ Unit Test xUnit đầy đủ.
5. **Verify & Push**: Chạy `dotnet test` + `npm run build` ➔ Stage chọn lọc ➔ Push Git an toàn.

---

## 📚 5. THAM CHIẾU CÁC QUY TẮC & BỘ NHỚ CHI TIẾT
- Chi tiết Bảo Mật & Git: [security.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/.agents/rules/security.md)
- Chi tiết Backend .NET 8: [backend.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/.agents/rules/backend.md)
- Chi tiết Frontend Next.js: [frontend.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/.agents/rules/frontend.md)
- Chi tiết Quy Trình Workflow: [workflow.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/.agents/rules/workflow.md)
- Bộ Nhớ Kỹ Thuật (Technical Memory): [MEMORY.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/business/MEMORY.md)
- Bối Cảnh Nghiệp Vụ Xã: [BUSINESS_MEMORY.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/business/BUSINESS_MEMORY.md)
- Kiến Trúc & Quyết Định (ADRs): [DECISIONS.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/architecture/DECISIONS.md)
- Toàn Bộ Wiki Tri Thức: [wiki/index.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/wiki/index.md)
