# Dự án Quản lý công việc UBND Xã Cát Ngạn (`UBNDXaCN`)

Hệ thống Quản lý công việc & Điều hành tác nghiệp dành cho UBND Xã Cát Ngạn, được xây dựng theo kiến trúc hiện đại Clean Architecture (.NET 8) kết hợp Next.js React Frontend.

---

## 🏗️ Kiến trúc Hệ thống (System Architecture)

- **Backend**: .NET 8 Web API (`Clean Architecture`, CQRS với MediatR, Entity Framework Core, PostgreSQL, JWT Authentication).
  - `src/Quanlycongviec.Domain`: Entities, Value Objects, Domain Events.
  - `src/Quanlycongviec.Application`: Use cases, CQRS Commands/Queries, Interfaces, DTOs.
  - `src/Quanlycongviec.Infrastructure`: Persistence (EF Core, DbContext), Repositories, External Services.
  - `src/Quanlycongviec.Api`: Controllers, Middleware, Auth Setup, Swagger.
- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS.
  - `frontend/web/src/app`: Pages, Layouts.
  - `frontend/web/src/components`: UI Components.
- **AI Tri thức & Quy chuẩn**: `.ai/` và `.agents/`
  - Chứa toàn bộ định hướng sản phẩm, sơ đồ DB Schema, ADR decisions (`DECISIONS.md`), quy tắc lập trình và memory dành cho AI Agent đồng hành phát triển.

---

## 🛡️ Hướng dẫn Khởi chạy Môi trường Dev (Local Setup)

### 1. Yêu cầu Tiền đề (Prerequisites)
- .NET 8.0 SDK trở lên
- Node.js 20+ & npm
- PostgreSQL Database server

### 2. Cấu hình Mật khẩu & Chuỗi kết nối Backend (User Secrets)
Để đảm bảo **không bao giờ lộ secrets/api keys trên Git**, sử dụng tính năng **.NET User Secrets**:

```bash
# Di chuyển vào thư mục API
cd src/Quanlycongviec.Api

# Khởi tạo user secrets (nếu chưa có)
dotnet user-secrets init

# Thiết lập Chuỗi kết nối Database local
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=ubndxacatngan;Username=postgres;Password=YOUR_LOCAL_PASSWORD"

# Thiết lập JWT Secret Key (tối thiểu 32 ký tự)
dotnet user-secrets set "Jwt:Secret" "YOUR_VERY_STRONG_JWT_SECRET_KEY_MIN_32_CHARS"
```

Khởi chạy Backend:
```bash
dotnet run --project src/Quanlycongviec.Api/Quanlycongviec.Api.csproj
```

### 3. Cấu hình Frontend
```bash
cd frontend/web

# Tạo file cấu hình môi trường local từ template
cp .env.example .env.local

# Cài đặt thư viện & khởi chạy frontend
npm install
npm run dev
```

---

## 🤖 Hướng dẫn AI Agent Pair-Programming

Dự án tích hợp bộ tri thức AI chuẩn hóa trong thư mục `.ai/` và `.agents/`:
- Mọi AI Agent (Antigravity, Cursor, GitHub Copilot Workspace, Claude) khi được mời vào Repo sẽ tự động tham chiếu `.ai/1-constitution/`, `.ai/2-architecture/DECISIONS.md`, và `.agents/AGENTS.md` để đảm bảo code sinh ra tuân thủ 100% kiến trúc Clean Architecture và domain chuẩn.

---

## 🔄 Quy trình CI/CD

Dự án được cấu hình tự động kiểm thử qua **GitHub Actions CI** (`.github/workflows/ci.yml`):
- Tự động Restore, Build & Test Backend .NET 8.
- Tự động Install & Build Frontend Next.js khi tạo Pull Request hoặc Push vào nhánh `main`.
