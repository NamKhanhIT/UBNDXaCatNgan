# Bàn giao Kho văn bản và Công việc hôm nay

Ngày kiểm thử: 30-09-2026. Nhánh triển khai: `feat/unified-document-workflow`, từ `develop` tại `c7a39b1`. Đích tích hợp được chủ dự án duyệt là `develop`; không đổi `main`, không triển khai production.

## Nguyên nhân và thay đổi

Documents trước đây chỉ cập nhật giao diện và báo giao thành công, không lưu công việc. Workcenter dùng bộ lọc khác bộ đếm, bỏ việc chưa bắt đầu. TaskItem lưu kết quả trong một trường có thể bị ghi đè. Banner cũ trên route documents còn hướng người dùng sang “Hôm Nay”; Tổng quan dùng tên trạng thái cũ và tính cả việc hoàn tất/hủy vào quá hạn.

Hai màn dùng TaskComposer và WorkflowTaskDetail chung. Tạo việc đi qua TaskCreationWorkflow; bắt đầu/nộp/duyệt/hoàn trả/đổi hạn/điều chuyển/hủy qua TaskExecutionWorkflow. WorkflowAccess kiểm tra tài khoản đang hoạt động, phạm vi quản lý, quyền xem từng đối tượng và người nghiệm thu. Mọi thông báo được lưu cùng thay đổi trước khi phát.

Sidebar Trung tâm điều hành có đúng Kho văn bản (`/documents`) và Công việc hôm nay (`/workcenter`). Kho văn bản hợp nhất đầu vào/văn bản đi, tìm kiếm/phân trang/bộ lọc, xem tệp, trình, giao thêm việc và mở việc đã lưu. Công việc hôm nay mặc định Cần xử lý, không giới hạn ngày; có Chờ nghiệm thu, Tôi đã giao, Đã nghiệm thu, Tất cả và lọc nhanh Hôm nay/Sắp đến hạn 48 giờ/Quá hạn/Cần chỉnh sửa. Người phải duyệt và người đã nộp có bộ chọn riêng.

## Luồng sử dụng

1. Người có quyền tiếp nhận tải văn bản, kiểm tra tệp rồi chọn rõ người nhận trình. Lãnh đạo có quyền xử lý được tải/giao trực tiếp. AI chỉ cung cấp gợi ý; không bắt buộc phân tích để giao thủ công.
2. Người giao xác nhận tên, chỉ đạo, yêu cầu kết quả, chủ trì, hạn, ưu tiên, người nghiệm thu và văn bản nguồn. Chỉ có ngày thì hiển thị gợi ý 17:00 giờ Việt Nam; không tự tạo ngày còn thiếu. Tạo thành công mở chi tiết từ server.
3. Công việc: Chưa bắt đầu → Đang thực hiện → Chờ nghiệm thu → Đã nghiệm thu. Hoàn trả bắt buộc ghi chú, đưa về Cần chỉnh sửa (InProgress). Nộp lại tạo lần mới; tệp, hạn tại lúc nộp và quyết định cũ không bị ghi đè. Hủy riêng và có lý do.
4. Phần phối hợp là công việc con một cấp. Chủ trì nhận hoặc hoàn trả kết quả của chính việc tổng; phần phối hợp chưa được xác nhận/hủy có lý do sẽ chặn nộp tổng hợp. Không hoàn thành dây chuyền hoặc tự chấm điểm/KPI cho người khác. Checklist vẫn chỉ theo dõi tiến độ.
5. Trình văn bản giữ từng lượt và quyết định. Văn bản đi vẫn soạn/trình ký/phát hành; ký không tự chọn người nhận hoặc tạo việc. Tạo lịch từ giấy mời yêu cầu lãnh đạo xác nhận thời gian, địa điểm và người tham dự trong phạm vi quản lý.

## Migration và dữ liệu mẫu

Ba migration bổ sung:

- `20260912153534_UnifiedDocumentWorkflow`: liên kết văn bản, lần nộp/tệp, lịch sử xử lý, quyền tiếp nhận, receipt, phiên bản. Chuyển liên kết cũ sang TaskDocumentLinks, giữ bằng chứng cũ và đánh dấu bản ghi đang hoạt động thiếu thông tin cần rà soát. PendingUBMTTQReview chuyển sang InReview, giữ dấu chuyển đổi, không tự nghiệm thu.
- `20260913151308_CalendarWorkflowConfirmation`: phiên bản và giấy mời nguồn của lịch.
- `20260914005800_OutgoingWorkflowConcurrency`: phiên bản văn bản đi.

Database mẫu `ubndxacatngan` đã có migration đầu trước lượt kiểm tra này; đã bổ sung hai migration còn lại và chạy lại script idempotent thành công. Giữ nguyên 8 người dùng, 38 công việc, 29 văn bản đến, 16 văn bản đi, 13 tệp, 27 lịch. Đối chiếu có 0 liên kết cũ bị thiếu và 0 phiên bản lịch/văn bản đi trống. Dữ liệu thiếu bằng chứng giữ “Chưa xác định”; không tái tạo lần nộp đã bị ghi đè, không dịch giờ dữ liệu cũ hàng loạt.

Bản sao lưu đầy đủ trước nâng cấp: `E:\Jobs\UBNDXaCatNgan\.workflow-backups\ubndxacatngan-before-workflow-20260930-144055.dump` (206992 byte), nằm ngoài Git, chỉ ADMIN/SYSTEM truy cập. Không đọc nội dung backup. Cấp quản trị workflow riêng cho đúng tài khoản chủ dự án chỉ định, không cấp tiếp nhận ngầm; retry cùng yêu cầu vẫn chỉ 1 audit.

SSPI ADMIN → postgres chỉ dùng tạm trong phạm vi được duyệt. Đã khôi phục `pg_hba.conf`/`pg_ident.conf` từ backup trước SSPI, xác minh PostgreSQL vẫn chạy và kết nối ADMIN không mật khẩu bị từ chối. Không đổi mật khẩu PostgreSQL. Để chạy API mẫu sau bàn giao, chủ dự án cần dùng xác thực PostgreSQL hợp lệ trong cấu hình nội bộ; AI không đọc/in cấu hình hoặc mật khẩu.

## Cách chạy và nâng cấp

Frontend: trong `frontend/web`, chạy `npm run dev`, mở `http://localhost:3000`. API: trong `src/Quanlycongviec.Api`, chạy `dotnet run -- --skip-seed`; proxy frontend mặc định tới cổng 5015. Khi chạy không launch profile, chỉ định `--urls http://127.0.0.1:5015`. Không chạy seed/reset trên dữ liệu mẫu.

DBA sao lưu trước, chạy `workflow-preflight.sql`, áp dụng `unified-workflow-upgrade.sql` bằng psql với tài khoản đã được phép, sau đó chạy `workflow-postflight.sql`. Script nâng cấp sinh từ migration đã đăng ký `20260903150000_AddPerformanceIndexesForPagination`; không dùng tên migration không được đăng ký. Giữ backup và dừng nâng cấp nếu đối chiếu không khớp.

`provision-workflow-admin.sql` nhận operator_username, target_username, grant_admin, reason và request_id. Chỉ DBA bootstrap tài khoản được chỉ định; không suy ra từ vai trò hoặc quyền quản lý nhân sự. Mục Cài đặt cấp/thu quyền tiếp nhận yêu cầu quyền quản trị server và lưu lịch sử. Không đưa mật khẩu vào tham số/chat.

## Kết quả kiểm thử

- Backend build đạt; Application **850/850**, không bỏ qua, gồm **7 test PostgreSQL thật** trên cụm riêng. TRX: `tests/Quanlycongviec.Application.Tests/TestResults/workflow-final-application-0930.trx`.
- API **56/56**, không bỏ qua. TRX: `tests/Quanlycongviec.Api.IntegrationTests/TestResults/workflow-final-api-0930.trx`.
- Frontend production build/TypeScript đạt; các kiểm thử Node bao gồm refresh phiên đồng thời, retry giữ FormData, HTTP 403, mất mạng, 401 muộn, không xóa phiên mới, tải đủ trang lịch, múi giờ thiết bị UTC, focus và checklist. Query kiểm chứng response sai thứ tự bị bỏ qua, đổi tài khoản không lộ dữ liệu cũ và refresh giữ form.
- EF xác nhận không có thay đổi model thiếu migration. Cảnh báo AutoMapper 13.0.1 NU1903 có từ trước còn tồn tại; chưa nâng dependency trong phạm vi này.
- **14 kiểm tra HTTP → API → PostgreSQL thật** đạt: Phó phòng giao trong phòng; chặn liên phòng/ngang cấp; bắt buộc yêu cầu kết quả; hai request cùng mã chỉ tạo một việc; không giả danh người giao; chặn tự duyệt; hai duyệt đồng thời trả 200/409; chặn detail/score/file ngoài quyền; bảo toàn tệp mỗi lần nộp; hạn lúc nộp tách thời điểm duyệt; tổng số và counter cùng bộ lọc.
- Browser mẫu: đăng nhập thật, đọc Kho văn bản/Workcenter và đối chiếu dữ liệu. Browser tổng hợp trên PostgreSQL riêng: tiếp nhận tải → reload → trình; lãnh đạo mở hàng đợi → giao việc tổng có phối hợp → tạo việc thứ hai từ Workcenter trên cùng văn bản; người nhận mở được tệp nguồn; phần phối hợp nộp/được nhận; chặn nộp tổng trước xác nhận; nộp tổng → hoàn trả → nộp lại → nghiệm thu; tệp result-1/result-2 và ghi chú từng lượt giữ riêng. Nghiệm thu việc tổng không hoàn thành việc khác hoặc ghi RatingHistory.
- Lịch thử tạo đúng 08:00–09:00 ngày 02-10-2026, một người tham dự được chọn. Văn bản đi thử soạn/trình ký/phát hành, có số, 0 công việc tự sinh. Test backend bao phủ phần phối hợp bị hoàn trả, trình bổ sung/trình lại, thay hạn/reviewer/hủy, legacy, transaction, nhắc đúng người và chống trùng sau restart.
- Responsive **1366×768 và 375×812**, keyboard Escape/Enter xác nhận bỏ draft rồi khôi phục focus về ô nhập; kiểm tra ngày DD-MM-YYYY và giờ Việt Nam. API thử bị dừng/khởi động lại: giao diện báo mất SignalR/polling 30 giây, tự refresh phiên, reconnect WebSocket và gỡ cảnh báo.

Ảnh thật trong `evidence/unified-workflow-0930`: Kho văn bản/Workcenter mẫu, biểu mẫu chung, chặn phối hợp, các lần nộp/hoàn trả/nghiệm thu, mobile, lịch, phát hành và mất/reconnect. Đây là ảnh trình duyệt; không phải mockup.

## Giới hạn và bảo toàn thay đổi

Chưa xác minh gửi **Web Push hoặc Zalo thực tế**; kết quả lưu thông báo/SignalR và test transport không được dùng để kết luận hai kênh này hoạt động. Không có dữ liệu production hoặc kiểm thử thiết bị vật lý. Download qua API đã kiểm tra byte từng PDF và quyền truy cập; sự kiện download của trình duyệt nhúng không được xác nhận. Các lần nộp lịch sử thiếu bằng chứng giữ null; cần người quản lý rà soát các việc cũ có cờ RequiresWorkflowReview.

Thay đổi của chủ dự án tại `OllamaDocumentAiService.cs` và whitespace đầu `Tier2_DataBoundaryAndInjectionTests.cs` được giữ nguyên, không đưa vào commit triển khai. Không đọc/commit protected configuration, secret, backup database hay tệp cấp quyền kiểm tra chứa định danh cá nhân. Nhánh/commit và trạng thái push cuối được xác nhận trong thông báo bàn giao, đối chiếu bằng `git rev-parse develop` và `git ls-remote origin refs/heads/develop`.
