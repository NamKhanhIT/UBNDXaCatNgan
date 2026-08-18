# Thiết Kế Quy Trình Cộng Tác GitFlow & CI/CD An Toàn Cho Dự Án UBND Xã Cát Ngạn

## 1. Bối Cảnh & Mục Tiêu

Dự án **UBND Xã Cát Ngạn (UBNDXaCN)** đang bước vào giai đoạn cộng tác nhiều thành viên. Để đảm bảo tính an toàn cho mã nguồn nhánh chính (`main`), tránh ghi đè dữ liệu, chặn code lỗi trước khi merge và tạo quy trình làm việc chuyên nghiệp, hệ thống áp dụng mô hình phân nhánh chuẩn **Gitflow** kết hợp **GitHub Actions CI**.

---

## 2. Cấu Trúc Phân Nhánh (Branching Strategy)

### 2.1. Nhánh `main` (Production / Stable)
- **Mục đích**: Chứa mã nguồn ổn định nhất, sẵn sàng triển khai thực tế.
- **Quyền hạn**: Chỉ có Team Lead / Quản trị viên dự án mới có quyền merge vào `main`. Không ai được push trực tiếp (`git push origin main`).
- **Nguồn merge**: Chỉ nhận code từ nhánh `develop` thông qua **Pull Request (PR)** sau khi đã qua kiểm thử và review.

### 2.2. Nhánh `develop` (Phát triển chung)
- **Mục đích**: Nhánh trung tâm cho toàn bộ hoạt động phát triển tính năng mới và sửa lỗi của các thành viên.
- **Luồng hoạt động**:
  1. Thành viên kéo code mới nhất từ `develop`: `git pull origin develop`.
  2. Tạo nhánh con để làm việc theo quy ước:
     - Tính năng mới: `feature/ten-tinh-nang` (ví dụ: `feature/ocr-pdf-van-ban`, `feature/giao-dien-danh-gia`)
     - Sửa lỗi: `fix/ten-loi` (ví dụ: `fix/tinh-diem-muon-han`, `fix/loi-font-in-phieu`)
     - Cập nhật tài liệu: `docs/noi-dung`
  3. Hoàn thành công việc -> Đẩy nhánh con lên GitHub -> Tạo Pull Request (PR) trỏ vào `develop`.
  4. GitHub Actions CI tự động chạy kiểm thử.
  5. Lead review mã nguồn -> Duyệt (Approve) và Merge vào `develop`.

---

## 3. Các Thành Phần Triển Khai

### 3.1. Nhóm Thay Đổi Cần Đẩy Lên GitHub
- **Commit 1 (feat/ai-pipeline-nq1678)**:
  - Chuẩn hóa dữ liệu hành chính theo Nghị quyết 1678/NQ-UBTVQH15 & Nghị định 30/2020/NĐ-CP.
  - Script tự động hóa Hugging Face ZeroGPU Space (`setup_huggingface.py`, `app.py` tắt thinking mode, `rag_engine.py`, `evaluate_benchmark.py`).
  - Tập dữ liệu 600 mẫu JSONL và tài liệu wiki.
- **Commit 2 (ci/gitflow-setup)**:
  - GitHub Actions CI workflow (`.github/workflows/ci.yml`).
  - Pull Request Template (`.github/pull_request_template.md`).
  - Hướng dẫn cộng tác (`CONTRIBUTING.md`).

### 3.2. GitHub Actions CI Workflow (`.github/workflows/ci.yml`)
- **Triggers**: Kích hoạt khi có `push` hoặc `pull_request` vào 2 nhánh: `main`, `develop`.
- **Jobs**:
  1. **Backend .NET Build & Test**:
     - Setup .NET 8.0 SDK.
     - Restore dependencies (`dotnet restore`).
     - Build solution ở chế độ Release (`dotnet build --configuration Release --no-restore`).
     - Chạy toàn bộ Unit Tests (`dotnet test --no-build --verbosity normal`).
  2. **Frontend Web Build Check**:
     - Setup Node.js 20.x.
     - Install dependencies (`npm ci` trong `frontend/web`).
     - Run Next.js lint & build (`npm run build`).

### 3.3. Pull Request Template (`.github/pull_request_template.md`)
- Form mẫu chuẩn hóa yêu cầu người gửi PR:
  - Loại thay đổi (Feature / Fix / Refactor / Docs).
  - Tóm tắt nội dung thay đổi.
  - Ảnh chụp màn hình / Bằng chứng kiểm thử (nếu có).
  - Checklist tự kiểm tra (Đã chạy test local, không chứa secrets/tokens, tuân thủ code style).

### 3.4. Hướng Dẫn Cộng Tác (`CONTRIBUTING.md`)
- Hướng dẫn từng bước từ clone repo, tạo branch, commit chuẩn theo Conventional Commits, tạo PR đến xử lý conflict.

---

## 4. Kế Hoạch Thiết Lập Branch Protection Trên GitHub (Dành Cho Lead)

Sau khi đẩy các nhánh lên GitHub, Team Lead thực hiện thiết lập bảo vệ nhánh trên trang GitHub Repo (`Settings -> Branches -> Add branch protection rule`):
1. **Rule cho `main`**:
   - `Branch name pattern`: `main`
   - ✅ `Require a pull request before merging` (Yêu cầu phải có PR)
   - ✅ `Require approvals`: 1 (Bắt buộc ít nhất 1 người review duyệt)
   - ✅ `Require status checks to pass before merging` -> Chọn check của GitHub Actions CI
   - ✅ `Do not allow bypassing the above settings`
2. **Rule cho `develop`**:
   - `Branch name pattern`: `develop`
   - ✅ `Require a pull request before merging`
   - ✅ `Require status checks to pass before merging`

---

## 5. Tiêu Chuẩn Nghiệm Thu & Đảm Bảo An Toàn

1. ✅ Toàn bộ file nhạy cảm (`.env`, `appsettings.Development.json`, tokens) được chặn bởi `.gitignore`.
2. ✅ Nhánh `main` được cập nhật sạch sẽ và đồng bộ với remote GitHub.
3. ✅ Nhánh `develop` được khởi tạo từ `main` và đẩy lên remote `origin/develop`.
4. ✅ GitHub Actions CI workflow hợp lệ, sẵn sàng chạy khi có PR mới.
5. ✅ Tài liệu hướng dẫn rõ ràng, dễ áp dụng cho tất cả thành viên trong nhóm.
