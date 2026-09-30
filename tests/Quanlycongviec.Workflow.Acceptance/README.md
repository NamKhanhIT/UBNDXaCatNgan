# Nghiệm thu workflow với PostgreSQL riêng

Máy chủ này sử dụng controllers, phân quyền, migration, JWT, tệp, thông báo và SignalR thật. `CreateEmptyBuilder` và design factory không tải appsettings, secrets hoặc dữ liệu mẫu. Chỉ chạy khi có `--isolated-workflow`.

Chuẩn bị cụm PostgreSQL tổng hợp chỉ lắng nghe `127.0.0.1:55439`, role `workflow_test`, database rỗng/postgres. Authentication trust chỉ cho loopback của cụm thử riêng. Không đổi pg_hba của PostgreSQL mẫu. Host tạo `workflow_acceptance_20260930`, migrate rồi seed sáu tài khoản synthetic `fixture-leader`, `fixture-deputy`, `fixture-officer`, `fixture-partner`, `fixture-intake`, `fixture-outside`; tất cả dùng mật khẩu fixture công khai `WorkflowFixture2026!`. Không dùng mật khẩu này cho tài khoản thật. JWT tạo ngẫu nhiên trong bộ nhớ khi khởi động.

Chạy `dotnet run --project tests/Quanlycongviec.Workflow.Acceptance -- --isolated-workflow`, API loopback:5000. `/health` xác nhận fixture và tên database. CORS chỉ các địa chỉ localhost/127.0.0.1:3000/3001. Giao diện fixture phải dùng proxy API5000 và SignalR5000, cache `.next` riêng; không chạy cùng cache với dev/build dự án.

`node tests/Quanlycongviec.Workflow.Acceptance/create-browser-fixtures.cjs` tạo bốn PDF synthetic trong fixtures. Dùng source.pdf cho văn bản; coordination.pdf, result-1.pdf và result-2.pdf cho các lần nộp. Đây không phải tệp thực tế.

Thực hiện browser flow trong báo cáo bàn giao, đặt tên việc tổng “Tổng hợp báo cáo nghiệm thu trình văn bản”. Sau đó `node tests/Quanlycongviec.Workflow.Acceptance/verify-api.cjs` chạy các assertion HTTP/PostgreSQL với tài khoản synthetic. Token nằm trong tiến trình cục bộ, không in/lưu. Mỗi lượt thêm một công việc thử độc lập để kiểm tra retry/concurrency; không reset database.

Application PostgreSQL tests dùng `WORKFLOW_TEST_POSTGRES=1` và cùng cổng thử; mỗi test tạo/xóa database `workflow_test_<guid>`, không dùng database nghiệm thu hay mẫu. Chạy .NET build/tests tuần tự để tránh khóa DLL trên Windows. Dừng host và cụm thử sau nghiệm thu bằng đúng tiến trình/cụm của mình; không dừng service PostgreSQL mẫu.
