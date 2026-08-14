# Quy Trình Phát Triển Tính Năng & Phối Hợp AI (Workflow & Collaboration Rules)

## 1. Quy Trình 5 Bước Phát Triển Tính Năng
Khi người dùng yêu cầu bổ sung hoặc cải tiến tính năng mới trong dự án, AI bắt buộc tuân theo quy trình 5 bước:

```
[1. Khám phá & Brainstorming] 
       ⬇
[2. Viết Đặc Tả Thiết Kế (Spec) vào docs/specs/] 
       ⬇
[3. Lập Kế Hoạch Triển Khai (Plan)] 
       ⬇
[4. Thực Hiện Code & Viết Unit Test] 
       ⬇
[5. Kiểm Thử Vượt Qua 100% & Push Git An Toàn]
```

---

## 2. Chi Tiết Từng Bước

### Bước 1: Khám phá & Brainstorming
- Tìm hiểu kỹ bối cảnh nghiệp vụ của UBND Xã (5 phòng ban, 3 cấp RBAC, Luật 72/2025/QH15).
- Thảo luận ngắn gọn, đề xuất 2-3 phương án tiếp cận với ưu/nhược điểm rõ ràng.
- Chốt phương án phù hợp nhất với kiến trúc hiện tại của dự án.

### Bước 2: Viết Đặc Tả Kỹ Thuật (Design Spec)
- Lưu bản thiết kế kỹ thuật vào thư mục chuẩn hóa: `docs/specs/YYYY-MM-DD-<tên-tính-năng>-design.md`.
- Bản spec phải nêu rõ:
  - Bối cảnh & Mục tiêu.
  - Thay đổi Domain Entities, Enums, Database Migrations.
  - Thay đổi Application CQRS Commands/Queries/DTOs.
  - Thay đổi Controller API & Frontend Components.
  - Kế hoạch kiểm thử (Test Plan).

### Bước 3: Lập Kế Hoạch Triển Khai (Implementation Plan)
- Chia nhỏ công việc thành các bước tuần tự (Entities ➔ Migration ➔ CQRS ➔ Controller ➔ UI ➔ Tests).

### Bước 4: Thực Hiện Code & Unit Test
- Viết code tuân thủ Clean Architecture, C# Best Practices, React/Next.js Standards.
- Viết Unit Tests đầy đủ trong `tests/Quanlycongviec.Application.Tests/` bao phủ các ca nghiệp vụ chính và các trường hợp biên.

### Bước 5: Kiểm Thử Tự Động & Push An Toàn
- Chạy `dotnet test Quanlycongviec.sln` (100% Passed).
- Chạy `npm run build` trong `frontend/web` (Compile thành công).
- Stage có chọn lọc (`git add src/ frontend/ tests/ docs/`) — **Tuyệt đối không stage file cấu hình, `.env*`, `.github/`, `.gitignore`**.
- Commit và Push lên GitHub với thông điệp rõ ràng (`feat: ...` / `fix: ...`).
