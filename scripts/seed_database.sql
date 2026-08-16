-- =====================================================================================
-- BỘ DỮ LIỆU MẪU TOÀN DIỆN & PHONG PHÚ - UBND XÃ CÁT NGẠN
-- Hệ thống Quản lý Giao việc, Lịch công tác, Sổ văn bản và Pipeline AI phân tích
-- Phiên bản: 2026.3 (Đầy đủ 5 nhóm AI, SubTasks tiến độ, Hồ sơ chuyên môn cán bộ)
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. PHÒNG BAN CHUYÊN MÔN (Departments)
-- -------------------------------------------------------------------------------------
INSERT INTO "Departments" ("Id", "Name", "Code", "IsDeleted", "CreatedAt")
VALUES 
    ('10000000-0000-0000-0000-000000000001', 'Văn phòng HĐND & UBND', 'VAN_PHONG', FALSE, NOW()),
    ('10000000-0000-0000-0000-000000000002', 'Phòng Kinh tế - Hạ tầng & Đô thị', 'KINH_TE', FALSE, NOW()),
    ('10000000-0000-0000-0000-000000000003', 'Phòng Văn hóa - Xã hội', 'VAN_HOA_XA_HOI', FALSE, NOW()),
    ('10000000-0000-0000-0000-000000000004', 'Trung tâm Phục vụ Hành chính công', 'HANH_CHINH_CONG', FALSE, NOW()),
    ('10000000-0000-0000-0000-000000000005', 'Khối Đảng - HĐND - UBMTTQ', 'KHOI_DANG_DOAN_THE', FALSE, NOW())
ON CONFLICT ("Id") DO UPDATE SET
    "Name" = EXCLUDED."Name",
    "Code" = EXCLUDED."Code";

-- -------------------------------------------------------------------------------------
-- 2. VAI TRÒ / CHỨC DANH LÃNH ĐẠO & CÁN BỘ (Roles)
-- -------------------------------------------------------------------------------------
INSERT INTO "Roles" ("Id", "Name", "Code", "Description", "RankLevel", "IsDeleted", "CreatedAt")
VALUES 
    ('20000000-0000-0000-0000-000000000001', 'Bí thư Đảng ủy', 'BiThuDU', 'Bí thư Đảng ủy xã — lãnh đạo cao nhất về Đảng', 1, FALSE, NOW()),
    ('20000000-0000-0000-0000-000000000002', 'Chủ tịch UBND', 'ChuTichUBND', 'Chủ tịch UBND xã — điều hành hành chính', 1, FALSE, NOW()),
    ('20000000-0000-0000-0000-000000000003', 'Chủ tịch HĐND', 'ChuTichHDND', 'Chủ tịch HĐND xã', 1, FALSE, NOW()),
    ('20000000-0000-0000-0000-000000000004', 'Phó Chủ tịch UBND (Chánh VP)', 'PhoChuTichUBND_ChanhVP', 'Phó Chủ tịch UBND kiêm Chánh VP', 2, FALSE, NOW()),
    ('20000000-0000-0000-0000-000000000005', 'Phó Chủ tịch UBND (GĐ TTPHCC)', 'PhoChuTichUBND_TTPHCC', 'Phó Chủ tịch UBND kiêm Giám đốc TTPHCC', 2, FALSE, NOW()),
    ('20000000-0000-0000-0000-000000000006', 'Trưởng phòng', 'TruongPhong', 'Trưởng phòng/ban chuyên môn', 3, FALSE, NOW()),
    ('20000000-0000-0000-0000-000000000007', 'Phó Trưởng phòng', 'PhoPhong', 'Phó Trưởng phòng/ban chuyên môn', 4, FALSE, NOW()),
    ('20000000-0000-0000-0000-000000000008', 'Chuyên viên', 'ChuyenVien', 'Chuyên viên / Cán bộ nghiệp vụ', 5, FALSE, NOW())
ON CONFLICT ("Id") DO UPDATE SET
    "Name" = EXCLUDED."Name",
    "RankLevel" = EXCLUDED."RankLevel";

-- -------------------------------------------------------------------------------------
-- 3. NGƯỜI DÙNG & TÀI KHOẢN CÁN BỘ (Users) - Bổ sung Expertise & YearsOfExperience
-- Mật khẩu mặc định: catngan2026
-- -------------------------------------------------------------------------------------
INSERT INTO "Users" ("Id", "Username", "FullName", "Email", "PasswordHash", "PrimaryDepartmentId", "ActiveRoleCode", "Expertise", "YearsOfExperience", "IsDeleted", "CreatedAt")
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'admin', 'Nguyễn Đình Hùng', 'admin@catngan.gov.vn', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '10000000-0000-0000-0000-000000000001', 'ChuTichUBND', 'Quản lý nhà nước, Điều hành chung, Quy hoạch phát triển KTXH', 15, FALSE, NOW()),
    ('a0000000-0000-0000-0000-000000000002', 'bithu', 'Phan Văn Hà', 'bithu@catngan.gov.vn', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '10000000-0000-0000-0000-000000000005', 'BiThuDU', 'Công tác xây dựng Đảng, Giám sát chính trị, Dân vận', 18, FALSE, NOW()),
    ('a0000000-0000-0000-0000-000000000003', 'pct_vp', 'Nguyễn Văn Hoàng', 'pct_vp@catngan.gov.vn', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '10000000-0000-0000-0000-000000000001', 'PhoChuTichUBND_ChanhVP', 'Nội chính, Pháp chế, Tổng hợp tham mưu, Cải cách hành chính', 12, FALSE, NOW()),
    ('a0000000-0000-0000-0000-000000000004', 'tp_kt', 'Lê Văn Tùng', 'tp_kt@catngan.gov.vn', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '10000000-0000-0000-0000-000000000002', 'TruongPhong', 'Tài chính - Ngân sách, Đầu tư công, Xây dựng cơ bản', 10, FALSE, NOW()),
    ('a0000000-0000-0000-0000-000000000005', 'tp_vh', 'Trần Thị Mai', 'tp_vh@catngan.gov.vn', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '10000000-0000-0000-0000-000000000003', 'TruongPhong', 'Đất đai, Tài nguyên môi trường, Quy hoạch đô thị nông thôn', 8, FALSE, NOW()),
    ('a0000000-0000-0000-0000-000000000006', 'nam', 'Nguyễn Văn Nam', 'nam@catngan.gov.vn', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '10000000-0000-0000-0000-000000000002', 'ChuyenVien', 'Địa chính, Trích đo giải phóng mặt bằng, Trật tự xây dựng, TTHC', 4, FALSE, NOW()),
    ('a0000000-0000-0000-0000-000000000007', 'thu', 'Hoàng Thị Thu', 'thu@catngan.gov.vn', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '10000000-0000-0000-0000-000000000001', 'ChuyenVien', 'Văn thư, Lưu trữ, Quản lý văn bản đi đến, Theo dõi đôn đốc', 6, FALSE, NOW()),
    ('a0000000-0000-0000-0000-000000000008', 'duc', 'Phạm Văn Đức', 'duc@catngan.gov.vn', '$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '10000000-0000-0000-0000-000000000004', 'ChuyenVien', 'Một cửa, CNTT, Dịch vụ công trực tuyến, Số hóa hồ sơ', 5, FALSE, NOW())
ON CONFLICT ("Id") DO UPDATE SET
    "FullName" = EXCLUDED."FullName",
    "Expertise" = EXCLUDED."Expertise",
    "YearsOfExperience" = EXCLUDED."YearsOfExperience",
    "ActiveRoleCode" = EXCLUDED."ActiveRoleCode",
    "PrimaryDepartmentId" = EXCLUDED."PrimaryDepartmentId";

-- -------------------------------------------------------------------------------------
-- 4. PHÂN QUYỀN & VAI TRÒ NGƯỜI DÙNG (UserRoles)
-- -------------------------------------------------------------------------------------
INSERT INTO "UserRoles" ("Id", "UserId", "RoleId", "DepartmentId", "IsPrimary", "IsDeleted", "CreatedAt")
VALUES 
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', TRUE, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', TRUE, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', TRUE, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', TRUE, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', TRUE, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', TRUE, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', TRUE, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000004', TRUE, FALSE, NOW())
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 5. ĐỊNH MỨC NĂNG SUẤT GIỜ CÔNG (WorkloadCapacities)
-- -------------------------------------------------------------------------------------
INSERT INTO "WorkloadCapacities" ("Id", "UserId", "WeeklyMaxHours", "CurrentAssignedHours", "IsDeleted", "CreatedAt")
VALUES 
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 40.0, 15.0, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 40.0, 12.0, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 40.0, 18.0, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', 40.0, 22.0, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000005', 40.0, 20.0, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000006', 40.0, 28.0, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000007', 40.0, 26.0, FALSE, NOW()),
    (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000008', 40.0, 30.0, FALSE, NOW())
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 6. SỔ VĂN BẢN ĐẾN (InboxDocuments) - 25+ Văn bản phong phú đủ 5 nhóm AI
-- -------------------------------------------------------------------------------------
INSERT INTO "InboxDocuments" (
    "Id", "DocumentNumber", "DocumentSymbol", "IssuingAgency", "SignerName", "IssuedDate", 
    "Subject", "Category", "Sender", "ReceivedDate", "IsUrgent", "IsScheduled", "Channel", 
    "CitizenName", "CitizenPhone", "ServiceCode", "IsDeleted", "CreatedAt",
    "AiCategory", "AiTitle", "AiSummary", "AiExtractedDeadline", "AiExtractedSubjects", 
    "AiObjectives", "AiSuggestedDepartmentId", "AiConfidenceScore", 
    "AiEventStartDateTime", "AiEventEndDateTime", "AiProcessingStatus"
)
VALUES 
    -- ── NHÓM 1: THƯ MỜI / LỊCH HỌP (MeetingInvitation) ──
    ('d0000000-0000-0000-0000-000000000001', '12/GM-HU', 'GM-HU', 'Huyện ủy Đức Thọ', 'Trần Đình Gia', NOW() - INTERVAL '1 day', 
     'Giấy mời dự Hội nghị sơ kết công tác xây dựng Đảng và hệ thống chính trị 6 tháng đầu năm 2026', 'Thư mời', 'Huyện ủy Đức Thọ', NOW() - INTERVAL '1 day', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'MeetingInvitation', 'Hội nghị sơ kết công tác Đảng 6 tháng đầu năm 2026', 'Huyện ủy triệu tập Bí thư Đảng ủy và Phó Bí thư xã tham dự hội nghị sơ kết tại Trung tâm chính trị huyện.', (CURRENT_DATE + INTERVAL '2 days')::date, '["Bí thư Đảng ủy", "Phó Bí thư Đảng ủy", "Chánh Văn phòng Đảng ủy"]', 'Đánh giá kết quả lãnh đạo thực hiện nhiệm vụ chính trị và triển khai phương hướng 6 tháng cuối năm.', '10000000-0000-0000-0000-000000000005', 0.95, (CURRENT_DATE + INTERVAL '2 days' + TIME '08:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '2 days' + TIME '11:30:00') AT TIME ZONE 'UTC', 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000002', '45/GM-HDND', 'GM-HDND', 'HĐND Huyện Đức Thọ', 'Nguyễn Thị Nữ', NOW() - INTERVAL '2 days', 
     'Giấy mời tham dự Kỳ họp chuyên đề HĐND huyện khóa XX về thông qua Đề án quy hoạch xây dựng vùng huyện', 'Thư mời', 'HĐND Huyện', NOW() - INTERVAL '2 days', TRUE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'MeetingInvitation', 'Kỳ họp chuyên đề HĐND huyện về quy hoạch xây dựng', 'Triệu tập Chủ tịch UBND xã và Trưởng phòng Kinh tế tham dự phiên thảo luận và biểu quyết thông qua đề án quy hoạch.', (CURRENT_DATE + INTERVAL '3 days')::date, '["Chủ tịch UBND xã", "Trưởng phòng Kinh tế - Hạ tầng"]', 'Đóng góp ý kiến về định hướng phát triển không gian và hạ tầng giao thông kết nối liên xã.', '10000000-0000-0000-0000-000000000002', 0.92, (CURRENT_DATE + INTERVAL '3 days' + TIME '14:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '3 days' + TIME '17:00:00') AT TIME ZONE 'UTC', 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000003', '78/GM-UBND', 'GM-UBND', 'UBND Huyện Đức Thọ', 'Trần Hoài Đức', NOW() - INTERVAL '3 days', 
     'Giấy mời họp trực tuyến triển khai công tác phòng chống dịch bệnh sốt xuất huyết và bệnh mùa hè', 'Thư mời', 'UBND Huyện', NOW() - INTERVAL '3 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'MeetingInvitation', 'Họp trực tuyến phòng chống dịch bệnh sốt xuất huyết', 'Họp giao ban trực tuyến từ điểm cầu UBND huyện tới 12 xã về kiểm soát ổ dịch và phun hóa chất diệt muỗi.', (CURRENT_DATE + INTERVAL '1 day')::date, '["Phó Chủ tịch UBND (Văn hóa)", "Trưởng Trạm Y tế xã"]', 'Không để bùng phát dịch bệnh trên địa bàn; hoàn thành vệ sinh môi trường trước 20/8.', '10000000-0000-0000-0000-000000000003', 0.90, (CURRENT_DATE + INTERVAL '1 day' + TIME '08:30:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '1 day' + TIME '10:30:00') AT TIME ZONE 'UTC', 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000004', '05/GM-BTC', 'GM-BTC', 'Ban Tổ chức Lễ hội Đền Cát Ngạn', 'Hoàng Văn Thái', NOW() - INTERVAL '4 days', 
     'Thư mời tham dự Lễ tế Khai hạ và Lễ đón nhận Bằng xếp hạng Di tích Lịch sử cấp Tỉnh Đền Cát Ngạn', 'Thư mời', 'Ban Tổ chức Lễ hội', NOW() - INTERVAL '4 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'MeetingInvitation', 'Lễ đón nhận Bằng Di tích Lịch sử cấp Tỉnh Đền Cát Ngạn', 'Ban tổ chức trân trọng kính mời toàn thể Thường trực Đảng ủy, HĐND, UBND, UBMTTQ và nhân dân tham dự đại lễ.', (CURRENT_DATE + INTERVAL '5 days')::date, '["Thường trực Đảng ủy", "UBND Xã", "UBMTTQ", "Cán bộ và nhân dân"]', 'Tổ chức trang trọng, an toàn, tiết kiệm và phát huy giá trị di sản văn hóa truyền thống.', '10000000-0000-0000-0000-000000000003', 0.88, (CURRENT_DATE + INTERVAL '5 days' + TIME '07:30:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '5 days' + TIME '11:00:00') AT TIME ZONE 'UTC', 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000005', '99/GM-STTTT', 'GM-STTTT', 'Sở Thông tin & Truyền thông', 'Võ Trọng Hải', NOW() - INTERVAL '5 days', 
     'Giấy triệu tập cán bộ tham gia Lớp bồi dưỡng kỹ năng an toàn thông tin và khai thác dữ liệu số', 'Thư mời', 'Sở TTTT Tỉnh', NOW() - INTERVAL '5 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'MeetingInvitation', 'Lớp bồi dưỡng kỹ năng An toàn thông tin và Dữ liệu số', 'Triệu tập 02 cán bộ chuyên trách CNTT và Văn phòng tham gia lớp bồi dưỡng 02 ngày tại Trung tâm CNTT Tỉnh.', (CURRENT_DATE + INTERVAL '6 days')::date, '["Cán bộ CNTT", "Chuyên viên Văn phòng"]', 'Nâng cao năng lực phòng ngừa tấn công mạng và kỹ năng vận hành hệ thống thông tin nội bộ.', '10000000-0000-0000-0000-000000000004', 0.86, (CURRENT_DATE + INTERVAL '6 days' + TIME '08:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '7 days' + TIME '17:00:00') AT TIME ZONE 'UTC', 'Analyzed'),

    -- ── NHÓM 2: CHỈ ĐẠO CẤP TRÊN (SuperiorDirective) ──
    ('d0000000-0000-0000-0000-000000000006', '124/UBND-VP', 'UBND-VP', 'UBND Huyện Đức Thọ', 'Trần Hoài Đức', NOW() - INTERVAL '2 days', 
     'Chỉ đạo khẩn: Tăng cường các biện pháp phòng chống thiên tai, tìm kiếm cứu nạn và bảo đảm an toàn hồ đập mùa mưa lũ 2026', 'Chỉ đạo', 'UBND Huyện Đức Thọ', NOW() - INTERVAL '2 days', TRUE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'SuperiorDirective', 'Chỉ đạo khẩn phòng chống thiên tai và an toàn hồ đập 2026', 'Yêu cầu các xã kiểm tra 100% hồ chứa, bố trí lực lượng trực ban 24/24, chuẩn bị phương châm 4 tại chỗ.', (CURRENT_DATE + INTERVAL '5 days')::date, '["Ban Chỉ huy PCTT&TKCN xã", "Phòng Kinh tế - Hạ tầng", "Công an xã"]', 'Rà soát vật tư dự phòng, cắm biển cảnh báo điểm có nguy cơ sạt lở trước ngày 22/8.', '10000000-0000-0000-0000-000000000002', 0.94, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000007', '89/UBND-KT', 'UBND-KT', 'UBND Huyện Đức Thọ', 'Nguyễn Văn A', NOW() - INTERVAL '3 days', 
     'Về việc đẩy nhanh tiến độ giải ngân vốn đầu tư công các công trình xây dựng nông thôn mới nâng cao năm 2026', 'Chỉ đạo', 'UBND Huyện', NOW() - INTERVAL '3 days', TRUE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'SuperiorDirective', 'Đẩy nhanh tiến độ giải ngân vốn đầu tư công NTM nâng cao', 'Đôn đốc các chủ đầu tư hoàn thành hồ sơ nghiệm thu thanh toán khối lượng hoàn thành, phấn đấu đạt tỷ lệ giải ngân trên 95%.', (CURRENT_DATE + INTERVAL '10 days')::date, '["Phòng Kinh tế - Hạ tầng", "Kế toán ngân sách", "Ban Quản lý dự án xã"]', 'Nghiệm thu dứt điểm 03 tuyến đường bê tông và nhà văn hóa xóm Cát Bắc trước 30/8.', '10000000-0000-0000-0000-000000000002', 0.91, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000008', '215/UBND-CA', 'UBND-CA', 'UBND Huyện Đức Thọ', 'Lê Văn B', NOW() - INTERVAL '4 days', 
     'Chỉ đạo mở đợt cao điểm tuyên truyền, kiểm tra xử lý vi phạm về trật tự an toàn giao thông và hành lang đường bộ', 'Chỉ đạo', 'UBND Huyện', NOW() - INTERVAL '4 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'SuperiorDirective', 'Cao điểm kiểm tra trật tự an toàn giao thông và hành lang đường bộ', 'Phối hợp Công an huyện giải tỏa các điểm kinh doanh lấn chiếm lòng đường, vỉa hè dọc Quốc lộ 8A đoạn qua địa bàn xã.', (CURRENT_DATE + INTERVAL '12 days')::date, '["Công an xã", "Đội trật tự đô thị", "12 Thôn xóm"]', 'Lập biên bản xử lý 100% trường hợp cố tình tái lấn chiếm; kẻ vạch quy định khu vực họp chợ.', '10000000-0000-0000-0000-000000000002', 0.89, NULL, NULL, 'Analyzed'),

    -- Ca test 1: Hạn chót trong quá khứ (DeadlineSeemsUnreasonable = true)
    ('d0000000-0000-0000-0000-000000000009', '42/SNN-CCTY', 'SNN-CCTY', 'Chi cục Chăn nuôi & Thú y Tỉnh', 'Trần Văn C', NOW() - INTERVAL '6 days', 
     'Công văn đôn đốc báo cáo số liệu tổng đàn gia súc, gia cầm phục vụ phân bổ vắc-xin tiêm phòng đợt 2/2026', 'Chỉ đạo', 'Chi cục Thú y', NOW() - INTERVAL '5 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'SuperiorDirective', 'Đôn đốc báo cáo số liệu tổng đàn gia súc gia cầm đợt 2', 'Yêu cầu các xã gửi biểu mẫu thống kê đàn trâu bò, lợn, gia cầm để làm căn cứ cấp phát vắc-xin Lở mồm long móng.', (CURRENT_DATE - INTERVAL '2 days')::date, '["Cán bộ Nông nghiệp", "Cán bộ Thú y xã"]', 'Gửi báo cáo trước 13/8/2026 (Hạn chót đã quá hạn).', '10000000-0000-0000-0000-000000000002', 0.82, NULL, NULL, 'Analyzed'),

    -- Ca test 2: Bản scan mờ (LowConfidence = true, Confidence < 0.6)
    ('d0000000-0000-0000-0000-000000000010', '19/STNMT-VP', 'STNMT-QLĐĐ', 'Sở Tài nguyên & Môi trường', 'Phan Bá Dũng', NOW() - INTERVAL '4 days', 
     'Thông báo kết luận thanh tra việc chấp hành pháp luật đất đai đối với các khu đất công ích (5%) trên địa bàn xã (Bản scan mờ)', 'Chỉ đạo', 'Sở TN&MT', NOW() - INTERVAL '3 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'SuperiorDirective', 'Kết luận thanh tra đất công ích 5% (Trích xuất OCR không trọn vẹn)', 'Văn bản scan chất lượng thấp, chữ mờ: Đề cập tới việc rà soát các hợp đồng thuê đất nông nghiệp công ích hết hạn...', (CURRENT_DATE + INTERVAL '15 days')::date, '["Phòng Địa chính", "UBND Xã"]', 'Kiểm tra lại toàn bộ danh mục quỹ đất công ích.', '10000000-0000-0000-0000-000000000002', 0.48, NULL, NULL, 'Analyzed'),

    -- ── NHÓM 3: GIAO VIỆC XUỐNG (TaskAssignmentDown) ──
    ('d0000000-0000-0000-0000-000000000011', '88/CV-UBND', 'UBND-VP', 'UBND Huyện Đức Thọ', 'Nguyễn Văn A', NOW() - INTERVAL '2 days', 
     'Yêu cầu Phòng Địa chính phối hợp kiểm tra hiện trạng sử dụng đất khu vực cầu Cát Ngạn', 'Giao việc', 'UBND Huyện Đức Thọ', NOW() - INTERVAL '1 day', TRUE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'TaskAssignmentDown', 'Kiểm tra hiện trạng sử dụng đất khu vực cầu Cát Ngạn', 'Đo đạc, lập biên bản xác minh ranh giới sử dụng đất theo phản ánh của nhân dân xóm Cát Nam.', (CURRENT_DATE + INTERVAL '4 days')::date, '["Cán bộ Địa chính", "Trưởng xóm Cát Nam"]', 'Báo cáo kết quả bằng văn bản kèm trích lục bản đồ địa chính.', '10000000-0000-0000-0000-000000000002', 0.93, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000012', '55/KH-UBND', 'UBND-VP', 'UBND Xã Cát Ngạn', 'Nguyễn Đình Hùng', NOW() - INTERVAL '3 days', 
     'Kế hoạch rà soát, lập danh sách hộ gia đình có nhu cầu chuyển mục đích sử dụng đất vườn liền kề sang đất ở năm 2026', 'Giao việc', 'Chủ tịch UBND xã', NOW() - INTERVAL '3 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'TaskAssignmentDown', 'Rà soát nhu cầu chuyển mục đích sử dụng đất vườn sang đất ở', 'Phòng Địa chính tiếp nhận đơn, tổng hợp danh sách các hộ đủ điều kiện theo quy hoạch sử dụng đất cấp huyện.', (CURRENT_DATE + INTERVAL '14 days')::date, '["Phòng Kinh tế - Hạ tầng", "12 Xóm trưởng"]', 'Lập danh mục chi tiết kèm diện tích dự kiến chuyển đổi trình UBND huyện phê duyệt.', '10000000-0000-0000-0000-000000000002', 0.89, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000013', '102/TB-UBND', 'UBND-VH', 'UBND Xã Cát Ngạn', 'Trần Thị Mai', NOW() - INTERVAL '2 days', 
     'Giao nhiệm vụ tổ chức Giải bóng chuyền nam - nữ mừng Quốc khánh 2/9 xã Cát Ngạn năm 2026', 'Giao việc', 'Phó Chủ tịch UBND xã', NOW() - INTERVAL '2 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'TaskAssignmentDown', 'Tổ chức Giải bóng chuyền nam nữ mừng Quốc khánh 2/9', 'Ban hành Điều lệ giải, chuẩn bị sân bãi, phân công trọng tài và bảo đảm an ninh trật tự trong suốt thời gian diễn ra giải đấu.', (CURRENT_DATE + INTERVAL '8 days')::date, '["Đoàn Thanh niên", "Hội Phụ nữ", "Công an xã", "Trạm Y tế"]', 'Hoàn tất bốc thăm chia bảng trước ngày 25/8; khai mạc sáng 30/8.', '10000000-0000-0000-0000-000000000003', 0.91, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000014', '63/CV-UBND', 'UBND-KT', 'UBND Xã Cát Ngạn', 'Lê Văn Tùng', NOW() - INTERVAL '4 days', 
     'Giao thẩm tra phương án dự toán thu chi ngân sách quý III/2026 và xây dựng khung dự toán 2027', 'Giao việc', 'Chủ tịch UBND xã', NOW() - INTERVAL '4 days', TRUE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'TaskAssignmentDown', 'Thẩm tra phương án dự toán thu chi ngân sách quý III/2026', 'Rà soát nguồn thu phí lệ phí, tiền cấp quyền sử dụng đất và cân đối chi thường xuyên, chi đầu tư công.', (CURRENT_DATE + INTERVAL '6 days')::date, '["Kế toán ngân sách", "Bộ phận Tài chính"]', 'Hoàn chỉnh báo cáo dự toán trình Thường trực HĐND xã xem xét.', '10000000-0000-0000-0000-000000000002', 0.87, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000015', '31/KH-TTPHCC', 'TTPHCC-VP', 'Trung tâm Phục vụ Hành chính công', 'Phạm Văn Đức', NOW() - INTERVAL '1 day', 
     'Kế hoạch tăng cường hướng dẫn người dân tạo tài khoản VNeID mức 2 và nộp hồ sơ trực tuyến', 'Giao việc', 'UBND Xã Cát Ngạn', NOW() - INTERVAL '1 day', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'TaskAssignmentDown', 'Tăng cường hướng dẫn kích hoạt VNeID và DVC trực tuyến', 'Thành lập 3 tổ lưu động hỗ trợ tại nhà văn hóa các thôn; hướng dẫn công dân nộp thủ tục Đăng ký khai sinh, kết hôn trực tuyến.', (CURRENT_DATE + INTERVAL '7 days')::date, '["Tổ Đề án 06", "Đoàn thanh niên", "Cán bộ Một cửa"]', 'Nâng tỷ lệ hồ sơ trực tuyến đạt tối thiểu 80% trong tháng 8/2026.', '10000000-0000-0000-0000-000000000004', 0.94, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000016', '18/CV-UBND', 'UBND-VP', 'UBND Xã Cát Ngạn', 'Nguyễn Đình Hùng', NOW() - INTERVAL '5 hours', 
     'Giao kiểm tra, chấn chỉnh kỷ luật, kỷ cương hành chính và văn hóa công vụ tại các phòng ban', 'Giao việc', 'Chủ tịch UBND xã', NOW() - INTERVAL '5 hours', TRUE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'TaskAssignmentDown', 'Kiểm tra kỷ luật kỷ cương hành chính và văn hóa công vụ', 'Kiểm tra giờ giấc làm việc, đeo thẻ công chức, tác phong ứng xử khi tiếp nhận giải quyết TTHC cho người dân.', (CURRENT_DATE + INTERVAL '3 days')::date, '["Văn phòng HĐND & UBND", "Toàn thể cán bộ công chức"]', 'Lập biên bản nhắc nhở các trường hợp đi muộn về sớm; báo cáo tại phiên họp giao ban đầu tuần.', '10000000-0000-0000-0000-000000000001', 0.96, NULL, NULL, 'Analyzed'),

    -- ── NHÓM 4: BÁO CÁO CẤP DƯỚI GỬI LÊN (ReportSubmissionUp) ──
    ('d0000000-0000-0000-0000-000000000017', '102/BC-SNN', 'SNNPTNT-TL', 'Sở Nông nghiệp & PTNT', 'Lê Văn B', NOW() - INTERVAL '3 days', 
     'Báo cáo rà soát hiện trạng các công trình thủy lợi phục vụ tưới tiêu sản xuất vụ Mùa 2026', 'Báo cáo', 'Sở Nông nghiệp & PTNT', NOW() - INTERVAL '2 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'ReportSubmissionUp', 'Báo cáo hiện trạng công trình thủy lợi vụ Mùa 2026', 'Tổng hợp kết quả kiểm tra 12 trạm bơm dã chiến và 8.5km kênh mương nội đồng phục vụ gieo cấy lúa Mùa.', (CURRENT_DATE + INTERVAL '7 days')::date, '["Ban Nông nghiệp", "Cụm Thủy nông"]', 'Nắm bắt hiện trạng hư hỏng cần duy tu bảo dưỡng.', '10000000-0000-0000-0000-000000000002', 0.89, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000018', '24/BC-CAX', 'CAX-CN', 'Công an Xã Cát Ngạn', 'Phan Văn Hùng', NOW() - INTERVAL '1 day', 
     'Báo cáo tình hình an ninh trật tự, an toàn xã hội và phòng chống tội phạm tháng 8/2026', 'Báo cáo', 'Công an Xã Cát Ngạn', NOW() - INTERVAL '1 day', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'ReportSubmissionUp', 'Báo cáo an ninh trật tự tháng 8/2026 trên địa bàn xã', 'Tình hình trật tự ổn định; đã tuần tra đêm 14 lượt, phát hiện 01 vụ trộm cắp vặt, giải quyết 02 vụ mâu thuẫn nội bộ gia đình.', NULL, '["Công an xã", "Lãnh đạo UBND xã"]', 'Duy trì tuần tra khép kín địa bàn dịp nghỉ lễ 2/9.', '10000000-0000-0000-0000-000000000001', 0.95, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000019', '15/TTr-TTPHCC', 'TTPHCC-VP', 'Trung tâm Phục vụ Hành chính công', 'Phạm Văn Đức', NOW() - INTERVAL '5 hours', 
     'Tờ trình đề nghị nâng cấp trang thiết bị CNTT tại Trung tâm Phục vụ Hành chính công xã Cát Ngạn', 'Tờ trình', 'Trung tâm Phục vụ Hành chính công', NOW() - INTERVAL '5 hours', TRUE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'ReportSubmissionUp', 'Tờ trình nâng cấp trang thiết bị CNTT tại TTPHCC', 'Đề xuất trang bị thêm 02 máy scan tốc độ cao và 01 máy in màu phục vụ số hóa hồ sơ tư pháp - hộ tịch.', (CURRENT_DATE + INTERVAL '5 days')::date, '["Trung tâm Hành chính công", "Bộ phận Kế toán"]', 'Kinh phí dự kiến: 35.000.000 VNĐ trích từ nguồn kinh phí chuyển đổi số.', '10000000-0000-0000-0000-000000000004', 0.92, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000020', '09/BC-UBMTTQ', 'MTTQ-CN', 'UBMTTQ Xã Cát Ngạn', 'Lê Hoàng Anh', NOW() - INTERVAL '2 days', 
     'Báo cáo kết quả giám sát, phản biện xã hội đối với dự án nâng cấp đường giao thông thôn Cát Nam', 'Báo cáo', 'UBMTTQ Xã', NOW() - INTERVAL '2 days', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     'ReportSubmissionUp', 'Báo cáo giám sát phản biện xã hội dự án đường Cát Nam', 'Đa số nhân dân đồng thuận hiến 1.200m2 đất mở rộng đường; kiến nghị bổ sung rãnh thoát nước có nắp đậy đoạn qua khu đông dân cư.', (CURRENT_DATE + INTERVAL '8 days')::date, '["Ban Thường trực UBMTTQ", "Chủ tịch UBND xã"]', 'UBND xã tiếp thu và chỉ đạo đơn vị thiết kế điều chỉnh dự toán.', '10000000-0000-0000-0000-000000000005', 0.90, NULL, NULL, 'Analyzed'),

    -- ── NHÓM 5: THỦ TỤC HÀNH CHÍNH & KHÁC (Other / PublicService) ──
    ('d0000000-0000-0000-0000-000000000021', 'TTHC-2026-001', 'TTHC-DK', 'Trung tâm Phục vụ Hành chính công', 'Phạm Văn Đức', NOW() - INTERVAL '1 day', 
     'Đăng ký khai sinh cho con — Công dân Nguyễn Thị Lan (xóm Cát Nam)', 'Hồ sơ TTHC', 'Trung tâm Hành chính công', NOW() - INTERVAL '1 day', FALSE, FALSE, 'PublicService', 'Nguyễn Thị Lan', '0912345678', 'DK-001', FALSE, NOW(),
     'Other', 'Hồ sơ Đăng ký khai sinh — Nguyễn Thị Lan', 'Tiếp nhận hồ sơ đăng ký khai sinh lần đầu cho trẻ em sinh năm 2026, đính kèm giấy chứng sinh và CCCD phụ huynh.', (CURRENT_DATE + INTERVAL '2 days')::date, '["Công dân Nguyễn Thị Lan", "Cán bộ Tư pháp - Hộ tịch"]', 'Xác minh và in trích lục khai sinh trong ngày làm việc.', '10000000-0000-0000-0000-000000000004', 0.97, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000022', 'TTHC-2026-002', 'TTHC-XD', 'Trung tâm Phục vụ Hành chính công', 'Phạm Văn Đức', NOW() - INTERVAL '8 hours', 
     'Cấp giấy phép xây dựng nhà ở riêng lẻ — Công dân Trần Văn Bình (xóm Cát Bắc)', 'Hồ sơ TTHC', 'Trung tâm Hành chính công', NOW() - INTERVAL '8 hours', FALSE, FALSE, 'PublicService', 'Trần Văn Bình', '0987654321', 'XD-003', FALSE, NOW(),
     'Other', 'Hồ sơ Cấp phép xây dựng nhà ở — Trần Văn Bình', 'Công dân nộp hồ sơ xin phép xây dựng nhà 2 tầng diện tích 120m2; đính kèm bản vẽ thiết kế và sổ đỏ bản sao.', (CURRENT_DATE + INTERVAL '10 days')::date, '["Công dân Trần Văn Bình", "Cán bộ Địa chính - Xây dựng"]', 'Thẩm định hồ sơ và kiểm tra thực địa chỉ giới quy hoạch đường trước 22/8.', '10000000-0000-0000-0000-000000000002', 0.91, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000023', 'TTHC-2026-003', 'TTHC-HN', 'Trung tâm Phục vụ Hành chính công', 'Phạm Văn Đức', NOW() - INTERVAL '2 hours', 
     'Cấp Giấy xác nhận tình trạng hôn nhân — Công dân Lê Hoàng Anh', 'Hồ sơ TTHC', 'Trung tâm Hành chính công', NOW() - INTERVAL '2 hours', TRUE, FALSE, 'PublicService', 'Lê Hoàng Anh', '0366789012', 'HN-002', FALSE, NOW(),
     'Other', 'Hồ sơ Xác nhận tình trạng hôn nhân — Lê Hoàng Anh', 'Xác nhận công dân độc thân phục vụ mục đích đăng ký kết hôn tại TP Vinh.', (CURRENT_DATE + INTERVAL '1 day')::date, '["Công dân Lê Hoàng Anh", "Cán bộ Tư pháp"]', 'Tra cứu sổ bộ hộ tịch và cấp giấy xác nhận.', '10000000-0000-0000-0000-000000000004', 0.96, NULL, NULL, 'Analyzed'),

    ('d0000000-0000-0000-0000-000000000024', 'ĐKN-2026-004', 'ĐKN-ĐĐ', 'UBND Xã Cát Ngạn', 'Nguyễn Thị Hồng', NOW() - INTERVAL '1 day', 
     'Đơn khiếu nại tranh chấp ranh giới đất ở liền kề giữa hộ bà Nguyễn Thị Hồng và ông Trần Văn Năm', 'Đơn thư', 'Ban Tiếp công dân', NOW() - INTERVAL '1 day', TRUE, FALSE, 'Internal', 'Nguyễn Thị Hồng', '0944556677', 'KN-001', FALSE, NOW(),
     'Other', 'Đơn khiếu nại tranh chấp ranh giới đất liền kề', 'Bà Hồng phản ánh ông Năm xây tường rào lấn sang mốc giới gia đình 0.4m dọc chiều dài 15m.', (CURRENT_DATE + INTERVAL '7 days')::date, '["Bà Nguyễn Thị Hồng", "Ông Trần Văn Năm", "Tổ hòa giải xóm"]', 'Tổ chức hòa giải cơ sở tại xóm Cát Nam; trích đo lại mốc tọa độ.', '10000000-0000-0000-0000-000000000002', 0.85, NULL, NULL, 'Analyzed'),

    -- Ca test 3: Văn bản mới tải lên chưa phân tích (Pending)
    ('d0000000-0000-0000-0000-000000000025', '188/CV-STTTT', 'STTTT-BCVT', 'Sở Thông tin & Truyền thông', 'Nguyễn Văn Khoa', NOW() - INTERVAL '30 minutes', 
     'Hướng dẫn triển khai Đề án nâng cao nhận thức, phổ cập kỹ năng và phát triển nguồn nhân lực chuyển đổi số quốc gia đến năm 2030', 'Công văn', 'Sở TTTT Tỉnh', NOW() - INTERVAL '30 minutes', FALSE, FALSE, 'Internal', NULL, NULL, NULL, FALSE, NOW(),
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Pending')
ON CONFLICT ("Id") DO UPDATE SET
    "DocumentNumber" = EXCLUDED."DocumentNumber",
    "Subject" = EXCLUDED."Subject",
    "Category" = EXCLUDED."Category",
    "Sender" = EXCLUDED."Sender",
    "AiCategory" = EXCLUDED."AiCategory",
    "AiTitle" = EXCLUDED."AiTitle",
    "AiSummary" = EXCLUDED."AiSummary",
    "AiExtractedDeadline" = EXCLUDED."AiExtractedDeadline",
    "AiExtractedSubjects" = EXCLUDED."AiExtractedSubjects",
    "AiObjectives" = EXCLUDED."AiObjectives",
    "AiSuggestedDepartmentId" = EXCLUDED."AiSuggestedDepartmentId",
    "AiConfidenceScore" = EXCLUDED."AiConfidenceScore",
    "AiEventStartDateTime" = EXCLUDED."AiEventStartDateTime",
    "AiEventEndDateTime" = EXCLUDED."AiEventEndDateTime",
    "AiProcessingStatus" = EXCLUDED."AiProcessingStatus";

-- -------------------------------------------------------------------------------------
-- 7. TỆP ĐÍNH KÈM VĂN BẢN (DocumentAttachments)
-- Khớp với các tệp vật lý trong uploads/documents/
-- -------------------------------------------------------------------------------------
INSERT INTO "DocumentAttachments" ("Id", "DocumentId", "TargetType", "FileName", "OriginalFileName", "FilePath", "FileType", "FileSize", "AttachmentType", "IsMainDocument", "UploadedByUserId", "UploadedAt", "IsDeleted", "CreatedAt")
VALUES
    ('80000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Inbox', 'sample_gm_so_ket_dang.pdf', '12_GM_HU_SoKetCongTacDang.pdf', 'uploads/documents/sample_gm_so_ket_dang.pdf', 'pdf', 145200, 'MainDocument', TRUE, 'a0000000-0000-0000-0000-000000000007', NOW() - INTERVAL '1 day', FALSE, NOW()),
    ('80000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000006', 'Inbox', 'sample_chi_dao_thien_tai.pdf', '124_UBND_ChiDaoPhongChongThienTai.pdf', 'uploads/documents/sample_chi_dao_thien_tai.pdf', 'pdf', 210400, 'MainDocument', TRUE, 'a0000000-0000-0000-0000-000000000007', NOW() - INTERVAL '2 days', FALSE, NOW()),
    ('80000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000011', 'Inbox', 'sample_kiem_tra_dat_dai.pdf', '88_CV_UBND_KiemTraDatDaiCauCatNgan.pdf', 'uploads/documents/sample_kiem_tra_dat_dai.pdf', 'pdf', 185000, 'MainDocument', TRUE, 'a0000000-0000-0000-0000-000000000007', NOW() - INTERVAL '1 day', FALSE, NOW()),
    ('80000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000017', 'Inbox', 'sample_bc_thuy_loi.pdf', '102_BC_SNN_ThuyLoiVuMua.pdf', 'uploads/documents/sample_bc_thuy_loi.pdf', 'pdf', 198000, 'MainDocument', TRUE, 'a0000000-0000-0000-0000-000000000007', NOW() - INTERVAL '2 days', FALSE, NOW()),
    ('80000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000021', 'Inbox', 'sample_tthc_khai_sinh.pdf', 'TTHC_DK_001_KhaiSinh_NguyenThiLan.pdf', 'uploads/documents/sample_tthc_khai_sinh.pdf', 'pdf', 95000, 'MainDocument', TRUE, 'a0000000-0000-0000-0000-000000000008', NOW() - INTERVAL '1 day', FALSE, NOW())
ON CONFLICT ("Id") DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 8. NHIỆM VỤ CÔNG VIỆC (TaskItems) - 10+ Task với nhiều dải tiến độ
-- -------------------------------------------------------------------------------------
INSERT INTO "TaskItems" ("Id", "Title", "Description", "AssignerId", "AssigneeId", "DepartmentId", "Priority", "Status", "Type", "EstimatedEffortHours", "StartDate", "DueDate", "ProgressPercentage", "CompletedAt", "SubmissionNote", "SystemScore", "EvaluatorScore", "RatingScore", "IsDelegatedAction", "IsEscalated", "IsDeleted", "CreatedAt")
VALUES 
    -- Task 1: Tiến độ 75% (3/4 SubTasks hoàn thành)
    ('b0000000-0000-0000-0000-000000000001', 'Rà soát hiện trạng sử dụng đất nông nghiệp xóm Cát Nam', 'Kiểm tra ranh giới, trích đo hiện trạng sử dụng đất lập phương án quản lý.', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'Urgent', 'InProgress', 'BAU', 12.0, NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days', 75, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, NOW()),

    -- Task 2: Tiến độ 50% (2/4 SubTasks hoàn thành)
    ('b0000000-0000-0000-0000-000000000002', 'Giải quyết hồ sơ cấp GCNQSDĐ tồn đọng đợt 2', 'Tổng hợp 15 hồ sơ cấp đổi sổ đỏ đợt 2 trình Lãnh đạo UBND xã phê duyệt.', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'High', 'InReview', 'BAU', 8.0, NOW() - INTERVAL '3 days', NOW() + INTERVAL '1 day', 50, NULL, 'Đã thẩm tra thực địa 15/15 bộ hồ sơ cấp đổi giấy chứng nhận QSDĐ tại xóm Cát Nam. Kết quả: 13 bộ đủ điều kiện đề nghị UBND xã phê duyệt cấp mới, 02 bộ còn thiếu trích đo địa chính và biên bản giáp ranh cần bổ sung xác nhận của xóm trưởng trước ngày 20/8.', NULL, NULL, NULL, FALSE, FALSE, FALSE, NOW()),

    -- Task 3: Tiến độ 25% (1/4 SubTasks hoàn thành)
    ('b0000000-0000-0000-0000-000000000003', 'Tổ chức Hội nghị tiếp xúc cử tri HĐND xã khóa XVIII', 'Chuẩn bị ma két, giấy mời, hội trường và tài liệu phục vụ tiếp xúc cử tri.', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Medium', 'InProgress', 'BAU', 6.0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 25, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, NOW()),

    -- Task 4: Tiến độ 100% (4/4 SubTasks hoàn thành - Đã chấm điểm 95.0đ)
    ('b0000000-0000-0000-0000-000000000004', 'Tiếp nhận và số hóa hồ sơ thủ tục hành chính tại TTPHCC', 'Hoàn thành 100% việc scan và cập nhật hồ sơ một cửa lên hệ thống Cổng DVC.', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000004', 'High', 'Completed', 'BAU', 16.0, NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day', 100, NOW() - INTERVAL '1 day', 'Đã tiếp nhận 48 bộ hồ sơ thủ tục hành chính các lĩnh vực Tư pháp, Đất đai và Xây dựng trong tuần. 100% hồ sơ đã được scan và đính kèm đầy đủ tài liệu số hóa trên Cổng DVC Quốc gia, hoàn thành trước hạn 4 giờ.', 30.0, 65.0, 95.0, FALSE, FALSE, FALSE, NOW()),

    -- Task 5: Tiến độ 0% (Chờ phản biện UBMTTQ - Dự án Project)
    ('b0000000-0000-0000-0000-000000000005', 'Xây dựng Kế hoạch chủ động ứng phó thiên tai mùa mưa bão 2026', 'Rà soát trọng điểm xung yếu đê điều, hồ đập trên địa bàn xã.', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Urgent', 'PendingUBMTTQReview', 'Project', 10.0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', 0, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, NOW()),

    -- Task 6: Tiến độ 100% (Đã chấm điểm 90.0đ)
    ('b0000000-0000-0000-0000-000000000006', 'Kiểm tra vệ sinh an toàn thực phẩm tại các chợ dân sinh', 'Phối hợp Trạm Y tế kiểm tra định kỳ các hộ kinh doanh thực phẩm.', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'Medium', 'Completed', 'BAU', 8.0, NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', 100, NOW() - INTERVAL '2 days', 'Đã phối hợp Trạm Y tế xã kiểm tra 24 quầy hàng thực phẩm tại chợ Cát Ngạn. Phát hiện 02 cơ sở kinh doanh hàng tươi sống chưa xuất trình được hóa đơn nguồn gốc xuất xứ, đã lập biên bản nhắc nhở và yêu cầu cam kết bổ sung chứng từ.', 28.5, 61.5, 90.0, FALSE, FALSE, FALSE, NOW()),

    -- Task 7: Tiến độ 60% (3/5 SubTasks hoàn thành)
    ('b0000000-0000-0000-0000-000000000007', 'Rà soát các hộ nghèo, hộ cận nghèo nhận hỗ trợ nhà ở đợt 3', 'Lập danh sách thẩm định hộ nghèo khó khăn về nhà ở trình HĐND thông qua.', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'High', 'InProgress', 'AdHoc', 14.0, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 60, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, NOW()),

    -- Task 8: Tiến độ 0% (Chưa bắt đầu)
    ('b0000000-0000-0000-0000-000000000008', 'Triển khai chiến dịch tiêm chủng mở rộng đợt 3/2026', 'Lập danh sách trẻ em trong độ tuổi tiêm chủng gửi Trạm Y tế xã.', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'Medium', 'Todo', 'BAU', 6.0, NOW() + INTERVAL '2 days', NOW() + INTERVAL '6 days', 0, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, NOW()),

    -- Task 9: Tiến độ 0% (Chưa bắt đầu)
    ('b0000000-0000-0000-0000-000000000009', 'Tổ chức họp Giao ban Đầu tuần toàn thể Cán bộ công chức xã', 'Tổng hợp nội dung báo cáo tiến độ tuần trước và dự thảo lịch công tác tuần mới.', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'High', 'Todo', 'BAU', 4.0, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day', 0, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, NOW()),

    -- Task 10: Tiến độ 0% (Bị hủy do thay đổi kế hoạch cấp trên)
    ('b0000000-0000-0000-0000-000000000010', 'Khảo sát lắp đặt wifi miễn phí tại nhà văn hóa 12 thôn', 'Tạm hoãn khảo sát để chờ hướng dẫn mới từ Sở Thông tin & Truyền thông.', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000004', 'Low', 'Cancelled', 'AdHoc', 4.0, NOW() - INTERVAL '6 days', NOW() - INTERVAL '3 days', 0, NULL, 'Tạm hoãn theo chỉ đạo tại Công văn 188/STTTT.', NULL, NULL, NULL, FALSE, FALSE, FALSE, NOW())
ON CONFLICT ("Id") DO UPDATE SET
    "Title" = EXCLUDED."Title",
    "Status" = EXCLUDED."Status",
    "ProgressPercentage" = EXCLUDED."ProgressPercentage",
    "RatingScore" = EXCLUDED."RatingScore",
    "SystemScore" = EXCLUDED."SystemScore",
    "EvaluatorScore" = EXCLUDED."EvaluatorScore",
    "SubmissionNote" = EXCLUDED."SubmissionNote";

-- -------------------------------------------------------------------------------------
-- 9. ĐẦU VIỆC CON TIẾN ĐỘ AI (SubTasks)
-- -------------------------------------------------------------------------------------
INSERT INTO "SubTasks" ("Id", "TaskItemId", "Title", "IsCompleted", "IsDeleted", "CreatedAt", "UpdatedAt")
VALUES
    -- SubTasks cho Task 1 (3/4 = 75%)
    ('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Kiểm tra hồ sơ địa chính và bản đồ trích đo xóm Cát Nam', TRUE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    ('70000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Khảo sát thực địa và cắm mốc tọa độ ranh giới', TRUE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    ('70000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Lập biên bản xác minh hiện trạng có chữ ký xóm trưởng và các hộ giáp ranh', TRUE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '12 hours'),
    ('70000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Tổng hợp báo cáo và lập phương án quản lý trình Lãnh đạo xã', FALSE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

    -- SubTasks cho Task 2 (2/4 = 50%)
    ('70000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Tiếp nhận 15 bộ hồ sơ đề nghị cấp đổi GCNQSDĐ từ bộ phận một cửa', TRUE, FALSE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
    ('70000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'Thẩm tra nguồn gốc sử dụng đất và nghĩa vụ tài chính', TRUE, FALSE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
    ('70000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', 'Bổ sung trích đo địa chính cho 02 bộ hồ sơ còn thiếu xác nhận giáp ranh', FALSE, FALSE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    ('70000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000002', 'Dự thảo Tờ trình đề nghị UBND xã phê duyệt cấp mới', FALSE, FALSE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

    -- SubTasks cho Task 3 (1/4 = 25%)
    ('70000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000003', 'Dự thảo và phát hành Giấy mời tiếp xúc cử tri tới các thôn', TRUE, FALSE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours'),
    ('70000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000003', 'Chuẩn bị tài liệu báo cáo kết quả phát triển KTXH 6 tháng', FALSE, FALSE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    ('70000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000003', 'Trang trí khánh tiết, âm thanh ánh sáng hội trường lớn', FALSE, FALSE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    ('70000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000003', 'Phân công thư ký ghi chép và tổng hợp ý kiến cử tri', FALSE, FALSE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

    -- SubTasks cho Task 4 (4/4 = 100%)
    ('70000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000004', 'Tiếp nhận 48 bộ hồ sơ một cửa trong tuần', TRUE, FALSE, NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),
    ('70000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000004', 'Scan và số hóa 100% tài liệu thành phần hồ sơ', TRUE, FALSE, NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days'),
    ('70000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000004', 'Cập nhật và đính kèm tệp lên Cổng Dịch vụ công Quốc gia', TRUE, FALSE, NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day'),
    ('70000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000004', 'Bàn giao hồ sơ gốc cho các phòng ban chuyên môn thụ lý', TRUE, FALSE, NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day'),

    -- SubTasks cho Task 7 (3/5 = 60%)
    ('70000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000007', 'Thu thập danh sách đề xuất hộ nghèo từ 12 thôn', TRUE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    ('70000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000007', 'Kiểm tra hiện trạng nhà ở thực tế (chụp ảnh lưu hồ sơ)', TRUE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    ('70000000-0000-0000-0000-000000000019', 'b0000000-0000-0000-0000-000000000007', 'Thành lập Hội đồng xét duyệt cấp xã', TRUE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '8 hours'),
    ('70000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000007', 'Niêm yết công khai danh sách tại trụ sở UBND xã và nhà văn hóa thôn', FALSE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    ('70000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000007', 'Hoàn thiện hồ sơ trình Phòng LĐ-TB&XH Huyện phê duyệt', FALSE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
ON CONFLICT ("Id") DO UPDATE SET
    "Title" = EXCLUDED."Title",
    "IsCompleted" = EXCLUDED."IsCompleted";

-- -------------------------------------------------------------------------------------
-- 10. CHÚ THÍCH KHOANH VÙNG TRÊN VĂN BẢN KẾT QUẢ (TaskReviewAnnotations)
-- -------------------------------------------------------------------------------------
INSERT INTO "TaskReviewAnnotations" ("Id", "TaskItemId", "AnchorText", "StartOffsetHint", "CommentText", "Severity", "CreatedByUserId", "ResolvedStatus", "ResolvedByUserId", "ResolvedAt", "IsDeleted", "CreatedAt")
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '02 bộ còn thiếu trích đo địa chính', 150, 'Cần đôn đốc xóm trưởng Cát Nam ký xác nhận mốc ranh giới trước thứ Sáu tuần này để kịp kỳ họp HĐND.', 'CanChinhSua', 'a0000000-0000-0000-0000-000000000004', 'Open', NULL, NULL, FALSE, NOW() - INTERVAL '4 hours'),
    ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'trước ngày 20/8', 210, 'Lưu ý kiểm tra lại hạn công văn của Huyện, nên hoàn tất trước ngày 18/8.', 'GopY', 'a0000000-0000-0000-0000-000000000001', 'Open', NULL, NULL, FALSE, NOW() - INTERVAL '2 hours'),
    ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'hoàn thành trước hạn 4 giờ', 180, 'Biểu dương tinh thần chủ động, hoàn thành xuất sắc nhiệm vụ số hóa hồ sơ một cửa.', 'GopY', 'a0000000-0000-0000-0000-000000000001', 'Resolved', 'a0000000-0000-0000-0000-000000000008', NOW() - INTERVAL '1 hour', FALSE, NOW() - INTERVAL '1 day')
ON CONFLICT ("Id") DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 11. SỰ KIỆN LỊCH / CUỘC HỌP (CalendarEvents)
-- -------------------------------------------------------------------------------------
INSERT INTO "CalendarEvents" ("Id", "Title", "Description", "EventType", "StartDateTime", "EndDateTime", "IsAllDay", "Location", "OrganizerId", "DepartmentId", "ColorTag", "IsDeleted", "CreatedAt")
VALUES 
    ('c0000000-0000-0000-0000-000000000001', 'Họp Giao ban Thường trực Đảng ủy & Lãnh đạo UBND xã', 'Đánh giá kết quả công tác tuần qua, triển khai nhiệm vụ trọng tâm tuần mới và giải quyết các kiến nghị cử tri.', 'Meeting', (CURRENT_DATE + TIME '08:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE + TIME '10:30:00') AT TIME ZONE 'UTC', FALSE, 'Phòng họp số 1 - UBND Xã Cát Ngạn', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '#2563eb', FALSE, NOW()),
    ('c0000000-0000-0000-0000-000000000002', 'Hội nghị tiếp xúc cử tri đại biểu HĐND xã Cát Ngạn khóa XVIII', 'Tiếp xúc cử tri các thôn Cát Nam, Cát Bắc, lắng nghe phản ánh về chính sách đất đai và giao thông nông thôn.', 'Conference', (CURRENT_DATE + INTERVAL '1 day' + TIME '14:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '1 day' + TIME '17:00:00') AT TIME ZONE 'UTC', FALSE, 'Hội trường lớn UBND Xã Cát Ngạn', 'a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '#d97706', FALSE, NOW()),
    ('c0000000-0000-0000-0000-000000000003', 'Khảo sát thực địa hệ thống đê điều & tiêu úng hồ Cát Ngạn', 'Kiểm tra hiện trạng các cống xả, thân đê xung yếu trước mùa mưa bão năm 2026.', 'FieldTrip', (CURRENT_DATE + INTERVAL '2 days' + TIME '07:30:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '2 days' + TIME '11:30:00') AT TIME ZONE 'UTC', FALSE, 'Tuyến đê tả sông Lam & Hồ Cát Ngạn', 'a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '#9333ea', FALSE, NOW()),
    ('c0000000-0000-0000-0000-000000000004', 'Lớp tập huấn Chuyển đổi số & Dịch vụ công trực tuyến năm 2026', 'Bồi dưỡng kỹ năng số hóa hồ sơ một cửa và sử dụng ứng dụng phản ánh hiện trường cho cán bộ xã và 12 xóm trưởng.', 'Training', (CURRENT_DATE + INTERVAL '3 days' + TIME '08:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '3 days' + TIME '17:00:00') AT TIME ZONE 'UTC', TRUE, 'Hội trường UBND Xã Cát Ngạn', 'a0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', '#16a34a', FALSE, NOW()),
    ('c0000000-0000-0000-0000-000000000005', 'Đại hội Hội Khuyến học xã Cát Ngạn nhiệm kỳ 2026 - 2031', 'Tổng kết phong trào khuyến học, khuyến tài và xây dựng xã hội học tập giai đoạn 2021 - 2026.', 'Conference', (CURRENT_DATE + INTERVAL '5 days' + TIME '07:30:00') AT TIME ZONE 'UTC', (CURRENT_DATE + INTERVAL '6 days' + TIME '11:30:00') AT TIME ZONE 'UTC', FALSE, 'Trung tâm Văn hóa Thể thao xã Cát Ngạn', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '#d97706', FALSE, NOW()),
    ('c0000000-0000-0000-0000-000000000006', 'Họp Chi bộ cơ quan UBND xã định kỳ tháng 8', 'Kiểm điểm công tác đảng viên, triển khai Nghị quyết Đảng ủy xã về phát triển KTXH 6 tháng cuối năm.', 'Meeting', (CURRENT_DATE - INTERVAL '2 days' + TIME '14:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE - INTERVAL '2 days' + TIME '16:30:00') AT TIME ZONE 'UTC', FALSE, 'Phòng họp số 2 - UBND Xã', 'a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '#2563eb', FALSE, NOW())
ON CONFLICT ("Id") DO UPDATE SET
    "Title" = EXCLUDED."Title",
    "Description" = EXCLUDED."Description",
    "StartDateTime" = EXCLUDED."StartDateTime",
    "EndDateTime" = EXCLUDED."EndDateTime";

-- -------------------------------------------------------------------------------------
-- 12. THÀNH PHẦN THAM DỰ SỰ KIỆN (EventParticipants)
-- -------------------------------------------------------------------------------------
INSERT INTO "EventParticipants" ("Id", "EventId", "UserId", "HasResponded", "ResponseStatus", "IsDeleted", "CreatedAt")
SELECT gen_random_uuid(), c."Id", u."Id", TRUE, 'Accepted', FALSE, NOW()
FROM "CalendarEvents" c
CROSS JOIN "Users" u
WHERE c."Id" IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000006')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 13. SỔ VĂN BẢN ĐI (OutgoingDocuments)
-- -------------------------------------------------------------------------------------
INSERT INTO "OutgoingDocuments" ("Id", "DocumentNumber", "DocumentSequenceNumber", "DocumentSymbol", "DocumentType", "Title", "Content", "Status", "DraftedByUserId", "DraftedAt", "SignedByUserId", "SignedAt", "IssuedDate", "RecipientNote", "DestinationLevel", "SecurityLevel", "UrgencyLevel", "AutoCreateTask", "IsUrgent", "IsCorrectionDocument", "IsDeleted", "CreatedAt")
VALUES 
    (gen_random_uuid(), '89/BC-UBND', 89, 'UBND-VP', 'BaoCao', 'Báo cáo công tác chỉ đạo điều hành và tình hình phát triển kinh tế - xã hội tháng 8/2026', 'Tổng hợp kết quả thu ngân sách, tiến độ sản xuất vụ Mùa, công tác cải cách hành chính và giải quyết thủ tục một cửa trên địa bàn xã Cát Ngạn.', 'Issued', 'a0000000-0000-0000-0000-000000000007', NOW() - INTERVAL '3 days', 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'UBND Huyện Đức Thọ, Thường trực HĐND Huyện, Sở Kế hoạch & Đầu tư Tỉnh', 'Superior', 'Normal', 'Normal', FALSE, FALSE, FALSE, FALSE, NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), '34/TTr-UBND', 34, 'UBND-KT', 'ToTrinh', 'Tờ trình đề nghị phê duyệt chủ trương đầu tư nâng cấp tuyến đường giao thông nông thôn thôn Cát Nam', 'Đề xuất bố trí vốn ngân sách nhà nước hỗ trợ xây dựng 3.2km đường bê tông nông thôn đạt chuẩn nông thôn mới nâng cao.', 'Issued', 'a0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '4 days', 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 'UBND Huyện Đức Thọ, Phòng Tài chính - Kế hoạch Huyện', 'Superior', 'Normal', 'Urgent', FALSE, TRUE, FALSE, FALSE, NOW() - INTERVAL '4 days'),
    (gen_random_uuid(), '112/UBND-VP', 112, 'UBND-VP', 'CongVan', 'Công văn chỉ đạo tăng cường công tác phòng chống dịch bệnh gia súc, gia cầm vụ Thu Đông 2026', 'Yêu cầu Ban cán bộ 12 thôn xóm phối hợp cán bộ thú y xã tiến hành tiêm phòng vắc-xin đạt tỷ lệ trên 90% tổng đàn.', 'Issued', 'a0000000-0000-0000-0000-000000000007', NOW() - INTERVAL '2 days', 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Phòng Kinh tế - Hạ tầng, Ban cán bộ 12 thôn xóm, Trạm Thú y', 'Subordinate', 'Normal', 'Urgent', TRUE, TRUE, FALSE, FALSE, NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), '78/QĐ-UBND', 78, 'UBND-VP', 'QuyetDinh', 'Quyết định thành lập Tổ công tác triển khai Đề án 06 và Chuyển đổi số cộng đồng xã Cát Ngạn năm 2026', 'Kiện toàn nhân sự tổ công tác gồm 15 đồng chí do Phó Chủ tịch UBND xã làm Tổ trưởng.', 'Issued', 'a0000000-0000-0000-0000-000000000007', NOW() - INTERVAL '5 days', 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', 'Thường trực Đảng ủy, Các thành viên Tổ công tác Đề án 06, Công an xã', 'Subordinate', 'Normal', 'Normal', FALSE, FALSE, FALSE, FALSE, NOW() - INTERVAL '5 days'),
    (gen_random_uuid(), NULL, 115, 'UBND-VH', 'CongVan', 'Công văn hướng dẫn tổ chức các hoạt động văn hóa, thể thao chào mừng kỷ niệm Quốc khánh 2/9', 'Triển khai giải bóng chuyền nam - nữ và chương trình nghệ thuật quần chúng tại Trung tâm VHTT xã.', 'PendingSignature', 'a0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '6 hours', NULL, NULL, NULL, 'Các trường học, Đoàn thanh niên, Hội phụ nữ, 12 thôn xóm', 'Subordinate', 'Normal', 'Normal', TRUE, FALSE, FALSE, FALSE, NOW() - INTERVAL '6 hours'),
    (gen_random_uuid(), NULL, NULL, 'UBND-VH', 'ToTrinh', 'Dự thảo Tờ trình đề nghị hỗ trợ kinh phí sửa chữa nhà ở cho 3 hộ gia đình có hoàn cảnh đặc biệt khó khăn', 'Bản dự thảo lập danh sách thẩm định hiện trạng nhà ở dột nát xin ý kiến lãnh đạo UBND xã trước khi trình HĐND.', 'Draft', 'a0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '2 hours', NULL, NULL, NULL, 'Lãnh đạo UBND Xã, Phòng Lao động - TB&XH Huyện', 'Superior', 'Normal', 'Normal', FALSE, FALSE, FALSE, FALSE, NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 14. THIẾT BỊ ĐĂNG KÝ THÔNG BÁO ĐẨY (PushSubscriptions - Mẫu ban đầu để IsActive=FALSE)
-- -------------------------------------------------------------------------------------
INSERT INTO "PushSubscriptions" ("Id", "UserId", "Endpoint", "P256dhKey", "AuthKey", "DeviceLabel", "LastUsedAt", "IsActive", "IsDeleted", "CreatedAt")
VALUES
    ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'https://fcm.googleapis.com/fcm/send/sample_endpoint_admin_pc', 'BCsample_p256dh_key_for_admin_windows_chrome_desktop_browser', 'sample_auth_key_1', 'Máy tính làm việc (Chủ tịch UBND)', NOW() - INTERVAL '30 minutes', FALSE, FALSE, NOW() - INTERVAL '5 days'),
    ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006', 'https://fcm.googleapis.com/fcm/send/sample_endpoint_nam_android', 'BCsample_p256dh_key_for_nam_samsung_galaxy_mobile_device', 'sample_auth_key_2', 'Samsung Galaxy S24 (Cán bộ Nam)', NOW() - INTERVAL '1 hour', FALSE, FALSE, NOW() - INTERVAL '3 days'),
    ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000007', 'https://web.push.apple.com/sample_endpoint_thu_iphone_pwa', 'BCsample_p256dh_key_for_thu_iphone_15_standalone_pwa_app', 'sample_auth_key_3', 'iPhone 15 Pro (PWA Cán bộ Thu)', NOW() - INTERVAL '2 hours', FALSE, FALSE, NOW() - INTERVAL '2 days')
ON CONFLICT ("Id") DO UPDATE SET
    "LastUsedAt" = EXCLUDED."LastUsedAt",
    "DeviceLabel" = EXCLUDED."DeviceLabel",
    "IsActive" = EXCLUDED."IsActive";

COMMIT;
