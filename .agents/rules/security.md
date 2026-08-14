# Quy Tắc Bảo Mật & Quản Lý Git (Git & Security Rules)

## 1. Nguyên Tắc Vàng: Cấm Tuyệt Đối Đẩy File Cấu Hình & Secrets Lên Git
- **Tuyệt đối KHÔNG stage, commit hoặc push các tệp cấu hình chứa chuỗi kết nối, secret, port, biến môi trường cục bộ:**
  - `appsettings.json`, `appsettings.Development.json`, `appsettings.*.json`
  - `launchSettings.json`, `*.user`, `*.suo`
  - `.env`, `.env.*`, `.env.local`
  - `.gitignore`, `.github/` (giữ nguyên cục bộ, không push lên repo công khai trừ khi người dùng chỉ định rõ).
- Nếu phát hiện file cấu hình bị dính vào `git status`, lập tức unstage hoặc revert:
  ```bash
  git restore --staged <file_cau_hinh>
  # hoặc revert nếu file bị sửa đổi cục bộ mà không muốn commit:
  git checkout <file_cau_hinh>
  ```

## 2. Quy Trình Stage & Push Có Chọn Lọc (Selective Staging)
- **KHÔNG dùng `git add .` hoặc `git add -A` một cách bừa bãi.**
- Luôn stage có chọn lọc theo đúng các thư mục mã nguồn và tài liệu:
  ```bash
  git add src/ frontend/ tests/ docs/
  ```
- Kiểm tra lại bằng `git status` trước khi commit để đảm bảo chỉ có source code và tests được staged.

## 3. Kiểm Thử Tự Động Trước Khi Push (Pre-push Verification Gate)
- Bắt buộc chạy và kiểm tra vượt qua 100% các bước build/test trước khi push lên remote repository:
  1. **Backend Tests**: `dotnet test Quanlycongviec.sln` ➔ Toàn bộ unit tests & integration tests phải Passed.
  2. **Frontend Build**: `npm run build` (trong thư mục `frontend/web`) ➔ Compile thành công, không có lỗi Typecheck/Lint.
- Chỉ khi cả hai bước trên thành công 100% mới thực hiện `git push origin <branch>`.

## 4. Bảo Mật Dữ Liệu Ứng Dụng (Application Security)
- **JWT Authentication**:
  - Không hardcode JWT Secret trong source code.
  - Hỗ trợ đọc token từ cả `Authorization: Bearer <token>` Header và `access_token` Cookie (HttpOnly).
- **Audit Logging**:
  - Mọi thao tác nhạy cảm (phân quyền, chuyển vai trò, điều chuyển công việc, duyệt văn bản, thay đổi điểm đánh giá) phải được ghi vết vào bảng `AuditLogs`.
- **Append-only Records**: Các bản ghi đánh giá (`RatingHistory`), nhật ký hành động (`AuditLogs`) không được phép bị sửa hoặc xóa tùy tiện.
