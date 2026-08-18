# Hướng Dẫn Cộng Tác & Quy Chuẩn Phát Triển (CONTRIBUTING)

Chào mừng bạn tham gia phát triển dự án **Hệ Thống Quản Lý Văn Bản & Điều Phối Công Việc - UBND Xã Cát Ngạn**!

Để đảm bảo chất lượng mã nguồn, an toàn dữ liệu và quy trình phối hợp nhịp nhàng, tất cả các thành viên trong nhóm vui lòng tuân thủ các quy định dưới đây.

---

## 1. Mô Hình Phân Nhánh (Gitflow Workflow)

Dự án áp dụng mô hình phân nhánh chuẩn:

```
[main] (Production / Stable - Được bảo vệ)
   ▲
   │ (Pull Request & Lead Review khi release)
   │
[develop] (Nhánh phát triển chính)
   ▲
   ├─── [feature/ten-tinh-nang] (Thành viên làm tính năng mới)
   └─── [fix/ten-loi]           (Thành viên sửa lỗi)
```

- **`main`**: Nhánh ổn định cao nhất, chỉ được merge từ `develop`. **Nghiêm cấm push trực tiếp lên `main`**.
- **`develop`**: Nhánh tập hợp code phát triển chung của cả nhóm.
- **`feature/*` / `fix/*`**: Nhánh cá nhân để thực hiện từng đầu việc cụ thể.

---

## 2. Quy Trình 5 Bước Cho Thành Viên

### Bước 1: Kéo code mới nhất từ `develop`
```bash
git checkout develop
git pull origin develop
```

### Bước 2: Tạo nhánh làm việc mới từ `develop`
Đặt tên nhánh theo quy ước:
- Tính năng: `feature/<ten-ngan-gon>` (ví dụ: `feature/phan-tich-van-ban`, `feature/xuat-bao-cao-excel`)
- Sửa lỗi: `fix/<ten-loi>` (ví dụ: `fix/loi-tinh-diem`, `fix/font-tieng-viet`)
- Tài liệu: `docs/<noi-dung>` (ví dụ: `docs/huong-dan-cai-dat`)

```bash
git checkout -b feature/ten-tinh-nang
```

### Bước 3: Phát triển & Kiểm thử tại máy cục bộ
Trước khi commit, hãy đảm bảo:
```bash
# Kiểm tra backend:
dotnet test Quanlycongviec.sln

# Kiểm tra frontend:
cd frontend/web
npm run build
```

### Bước 4: Commit theo chuẩn Conventional Commits
Quy ước thông điệp commit:
- `feat: <mô tả>`: Thêm tính năng mới
- `fix: <mô tả>`: Sửa lỗi
- `refactor: <mô tả>`: Tái cấu trúc mã nguồn (không đổi tính năng)
- `docs: <mô tả>`: Cập nhật tài liệu / wiki
- `test: <mô tả>`: Bổ sung hoặc sửa unit tests
- `chore: <mô tả>`: Cấu hình build, dependencies

*Ví dụ:*
```bash
git commit -m "feat(ai): bổ sung parser trích xuất bảng phân công theo NĐ 30"
```

### Bước 5: Đẩy nhánh lên GitHub & Tạo Pull Request (PR)
```bash
git push -u origin feature/ten-tinh-nang
```
- Truy cập trang GitHub của dự án: [https://github.com/NamKhanhIT/UBNDXaCatNgan](https://github.com/NamKhanhIT/UBNDXaCatNgan)
- Bấm **Compare & pull request**.
- **CỰC KỲ QUAN TRỌNG**: Chọn `base: develop` (KHÔNG chọn `base: main`).
- Điền đầy đủ thông tin theo mẫu **Pull Request Template**.
- Chờ GitHub Actions CI chạy kiểm tra tự động và Team Lead review để merge.

---

## 3. Hướng Dẫn Cấu Hình Bảo Vệ Nhánh Cho Team Lead (Branch Protection)

Để ngăn chặn việc vô tình push nhầm hoặc ghi đè code lên nhánh quan trọng, Team Lead thực hiện thiết lập trên GitHub:

1. Vào **Settings** của repository -> Chọn **Branches** ở menu bên trái.
2. Bấm **Add branch protection rule**:
   - **Branch name pattern**: `main`
   - ✅ Tick `Require a pull request before merging` (Bắt buộc phải qua PR)
   - ✅ Tick `Require approvals` (Đặt là `1`)
   - ✅ Tick `Require status checks to pass before merging` -> Chọn check CI `backend-test` và `frontend-build`
   - ✅ Tick `Do not allow bypassing the above settings`
   - Bấm **Create / Save changes**.
3. Tiếp tục bấm **Add branch protection rule** cho nhánh `develop`:
   - **Branch name pattern**: `develop`
   - ✅ Tick `Require a pull request before merging`
   - ✅ Tick `Require status checks to pass before merging` -> Chọn check CI
   - Bấm **Create / Save changes**.

---

## 4. Nguyên Tắc An Toàn Dữ Liệu & Bảo Mật

1. **Tuyệt đối không đưa file nhạy cảm lên Git**:
   - Không commit file `.env`, mật khẩu database, connection strings, API tokens (`HF_TOKEN`, OpenAI key, JWT secret thực tế).
   - Kiểm tra kỹ file `.gitignore` trước khi `git add`.
2. **Tuân thủ quy chuẩn dữ liệu chính quyền cấp xã**:
   - Mọi biểu mẫu và trích xuất hành chính phải tuân thủ chuẩn **Nghị định 30/2020/NĐ-CP** và địa giới hành chính theo **Nghị quyết 1678/NQ-UBTVQH15**.
