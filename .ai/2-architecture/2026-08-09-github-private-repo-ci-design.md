# Thiết kế Kiến trúc Push Repository GitHub Private & GitHub Actions CI

**Ngày lập**: 09/08/2026  
**Dự án**: UBND Xã Cát Ngạn (`UBNDXaCN`)  
**Mục tiêu**: Chuẩn hóa Repository để đẩy lên GitHub Private bảo mật (không rò rỉ secret/api key/dữ liệu nhạy cảm), tối ưu ngữ cảnh cho AI Agent (.ai, .agents), và thiết lập GitHub Actions CI cho phát triển lâu dài & Production.

---

## 1. Phân loại Tệp tin & Chiến lược Bảo mật (Security & GitIgnore)

### 🔴 Tệp tin KHÔNG ĐƯỢC ĐẨY (Chặn tuyệt đối qua `.gitignore`)
1. **Secrets & Mật khẩu**:
   - `appsettings.Secrets.json`, `appsettings.*.user.json`, `appsettings.Production.json` (nếu chứa secret thật).
   - `.env`, `.env.local`, `.env.production`, `.env.staging` trong cả frontend và root.
   - Chuỗi kết nối Database thật, JWT Secret key thật, API key của các dịch vụ bên ngoài.
2. **Build Outputs & Dependencies**:
   - Backend .NET: `bin/`, `obj/`, `.vs/`, `*.user`, `*.suo`, `*.cache`, `TestResults/`.
   - Frontend Next.js: `node_modules/`, `.next/`, `out/`, `dist/`, `.turbo/`, `tsconfig.tsbuildinfo`.
3. **File lưu trữ & File nén**:
   - `UBNDXaCN.zip` (Tệp nén backup 187MB).
   - Any `*.zip`, `*.7z`, `*.tar.gz`, `*.iso`.
4. **Hệ điều hành / IDE artifacts**:
   - `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/` (trừ template chia sẻ nếu có).

---

### 🟢 Tệp tin NÊN ĐẨY (Tối ưu cho AI Agent & CI/CD)
1. **Mã nguồn & Test Suite**:
   - `src/` (Clean Architecture .NET 8 Backend).
   - `frontend/web/` (Next.js React Frontend).
   - `tests/` (Unit tests & Integration tests).
2. **Thư mục Tri thức AI (`.ai/` & `.agents/`)**:
   - `.ai/1-constitution/`: Định hướng sản phẩm và quy tắc thiết kế hệ thống.
   - `.ai/2-architecture/`: Sơ đồ kiến trúc, DB Schema, `DECISIONS.md` (ADR).
   - `.ai/3-memory/`: Lịch sử các tính năng đã làm (VD: Dynamic Demo Mode).
   - `.ai/4-prompts/`, `.ai/5-rules/`, `.ai/6-mcp/`, `.ai/7-skills/`, `.ai/8-agents/`.
   - `.agents/AGENTS.md`: Quy định pair-programming dành cho mọi AI Agent.
3. **Cấu hình Template An toàn**:
   - `src/Quanlycongviec.Api/appsettings.json` & `appsettings.Development.json` (sử dụng placeholder `CHANGE_ME_VIA_USER_SECRETS`).
   - `frontend/web/.env.example` (Mẫu khai báo biến môi trường frontend).
4. **GitHub Actions CI (`.github/workflows/ci.yml`)**:
   - Workflow chạy tự động trên GitHub Actions mỗi khi Push hoặc tạo Pull Request vào nhánh `main` / `master`.
   - Tự động Restore, Build & Test Backend .NET 8.
   - Tự động Install dependencies, Lint & Build Frontend Next.js.
5. **Tài liệu Dự án (`README.md`)**:
   - Tổng quan dự án, hướng dẫn cài đặt môi trường Dev bằng `dotnet user-secrets`, cấu hình `.env.local` cho Frontend, và hướng dẫn AI Agent.

---

## 2. Thiết lập GitHub Actions CI (`.github/workflows/ci.yml`)

Workflow CI sẽ bao gồm 2 jobs chạy song song:
1. **`build-and-test-backend`**:
   - Runs on: `ubuntu-latest`
   - Steps:
     - Checkout code (`actions/checkout@v4`)
     - Setup .NET 8 SDK (`actions/setup-dotnet@v4`)
     - `dotnet restore Quanlycongviec.sln`
     - `dotnet build Quanlycongviec.sln --no-restore -c Release`
     - `dotnet test Quanlycongviec.sln --no-build -c Release --verbosity normal`
2. **`build-frontend`**:
   - Runs on: `ubuntu-latest`
   - Steps:
     - Checkout code (`actions/checkout@v4`)
     - Setup Node.js 20 (`actions/setup-node@v4` with `npm` cache)
     - `cd frontend/web`
     - `npm ci`
     - `npm run build` (với `NEXT_PUBLIC_API_URL=http://localhost:5000/api`)

---

## 3. Kế hoạch Thực thi (Implementation Plan Overview)

1. **Tạo `.gitignore` tại root `UBNDXaCN/`**:
   - Bao phủ các quy tắc cho .NET, Node.js/Next.js, Visual Studio, OS, secrets, zip.
2. **Tạo `frontend/web/.env.example`**:
   - Mẫu khai báo biến môi trường cho Frontend.
3. **Tạo `.github/workflows/ci.yml`**:
   - Định nghĩa workflow kiểm thử & build tự động cho Backend & Frontend.
4. **Tạo `README.md` tại root**:
   - Hướng dẫn tổng quan, bảo mật secrets và làm việc với AI Agent.
5. **Khởi tạo Git Repository & Commit ban đầu**:
   - Khởi tạo `git init` trong `UBNDXaCN`.
   - Kiểm tra `git status` để đảm bảo 100% không có file secrets/build artifacts/file zip nào bị theo dõi.
   - Tạo commit ban đầu `feat: initial commit with security gitignore, AI context, and GitHub CI workflow`.
6. **Hướng dẫn Push lên GitHub Private**:
   - Cung cấp các lệnh chính xác để người dùng thêm `remote` và `git push -u origin main`.
