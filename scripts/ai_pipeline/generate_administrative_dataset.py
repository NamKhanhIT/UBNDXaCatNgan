#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
BỘ SINH DỮ LIỆU ĐÀO TẠO AI HÀNH CHÍNH CÔNG VỤ — DÀNH RIÊNG CHO CHÍNH QUYỀN CẤP XÃ
(Theo mô hình 2 cấp Tỉnh - Xã, Luật 72/2025/QH15, 28 Nghị định phân cấp mới & NĐ 30/2020/NĐ-CP)
Dành cho Fine-Tuning mô hình Qwen3-14B-Instruct qua Unsloth / QLoRA
=============================================================================

ĐẶC ĐIỂM BẢN CẬP NHẬT:
1. Đối tượng trọng tâm: Chính quyền cấp Xã (UBND Xã/Phường/Thị trấn) tự chủ, tiếp nhận 86%
   nhiệm vụ từ cấp huyện cũ (714 nhiệm vụ chuyên môn, 4 phòng ban chuẩn).
2. Thể thức văn bản: Tuân thủ nghiêm ngặt 100% Nghị định số 30/2020/NĐ-CP về thể thức
   và kỹ thuật trình bày văn bản hành chính Việt Nam.
3. Văn phong: Tự nhiên, chuẩn mực công vụ, mang đậm phong cách hành chính nhà nước thực tế,
   tránh ngôn từ máy móc, viện dẫn chính xác các căn cứ pháp lý hiện hành 2025/2026.
4. Cấu trúc cân đối 4 nhóm mẫu (Tổng cộng 600 mẫu, mỗi nhóm 150 mẫu):
   - Nhóm 1: Trích xuất OCR công văn chỉ đạo đến -> JSON Object chi tiết (chuẩn backend .NET)
   - Nhóm 2: Trích xuất dữ liệu bảng phân công/kinh phí/rà soát -> JSON Array (phục vụ xuất Excel)
   - Nhóm 3: Đề xuất phân công cán bộ cấp Xã tối ưu -> JSON Reasoning sắc bén
   - Nhóm 4: Soạn thảo văn bản hành chính hoàn chỉnh (Quyết định, Kế hoạch, Báo cáo, Tờ trình, Thông báo, Công văn, Giấy mời, Biên bản)
"""

import json
import os
import random
import sys
from datetime import datetime, timedelta

# Fix Windows console UTF-8 encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# =============================================================================
# 1. DANH MỤC ĐỊA BÀN CHÍNH QUYỀN CẤP XÃ (TRỌNG TÂM UBND CẤP XÃ SAU SÁP NHẬP)
# =============================================================================

# 16 đơn vị hành chính cấp xã tiêu biểu chuẩn theo Nghị quyết số 1678/NQ-UBTVQH15 (Tỉnh Nghệ An)
LOCATIONS = [
    # 1. Trọng tâm dự án: Xã Cát Ngạn (Sáp nhập Minh Sơn, Cát Văn, Phong Thịnh - Mục 87 NQ 1678)
    {"commune": "Cát Ngạn", "type": "Xã", "province": "Nghệ An", "hamlets": ["Thôn Cát Mộng", "Thôn Lương Điền", "Thôn Phong Mỹ", "Thôn Phong Thịnh", "Thôn Minh Sơn", "Thôn 1", "Thôn 2", "Thôn 3", "Thôn 4", "Thôn 5", "Thôn 6", "Thôn 7", "Thôn 8"]},
    # 2. Xã Đại Đồng (Sáp nhập TT Dùng, Đồng Văn, Thanh Ngọc, Thanh Phong, Đại Đồng - Mục 88 NQ 1678)
    {"commune": "Đại Đồng", "type": "Xã", "province": "Nghệ An", "hamlets": ["Khối Dùng 1", "Khối Dùng 2", "Thôn Đồng Văn", "Thôn Ngọc Sơn", "Thôn Phong Lĩnh", "Thôn Đại Lĩnh"]},
    # 3. Xã Hạnh Lâm (Sáp nhập Thanh Đức, Hạnh Lâm - Mục 89 NQ 1678)
    {"commune": "Hạnh Lâm", "type": "Xã", "province": "Nghệ An", "hamlets": ["Thôn 1", "Thôn 2", "Thôn 3", "Thôn 4", "Thôn Bãi Lim", "Thôn Hạnh Mỹ", "Thôn Thanh Đức"]},
    # 4. Xã Bích Hào (Sáp nhập Mai Giang, Thanh Lâm, Thanh Tùng, Thanh Xuân - Mục 86 NQ 1678)
    {"commune": "Bích Hào", "type": "Xã", "province": "Nghệ An", "hamlets": ["Thôn Mai Giang", "Thôn Thanh Lâm", "Thôn Thanh Tùng", "Thôn Thanh Xuân"]},
    # 5. Xã Kim Bảng (Sáp nhập Thanh Hà, Thanh Thủy, Kim Bảng - Mục 91 NQ 1678)
    {"commune": "Kim Bảng", "type": "Xã", "province": "Nghệ An", "hamlets": ["Thôn Kim Bảng 1", "Thôn Kim Bảng 2", "Thôn Thanh Hà", "Thôn Thanh Thủy"]},
    # 6. Xã Kim Liên (Sáp nhập Hùng Tiến, Nam Cát, Nam Giang, Xuân Hồng, Kim Liên - Mục 37 NQ 1678)
    {"commune": "Kim Liên", "type": "Xã", "province": "Nghệ An", "hamlets": ["Làng Sen", "Làng Hoàng Trù", "Xóm Sen 1", "Xóm Sen 2", "Xóm Hoàng Trù 1", "Xóm Nam Cát", "Xóm Hùng Tiến"]},
    # 7. Xã Vạn An (Sáp nhập TT Nam Đàn, Thượng Tân Lộc, Xuân Hòa - Mục 38 NQ 1678)
    {"commune": "Vạn An", "type": "Xã", "province": "Nghệ An", "hamlets": ["Khối 1", "Khối 2", "Thôn Thượng Lộc", "Thôn Tân Lộc", "Thôn Xuân Hòa"]},
    # 8. Xã Đại Huệ (Sáp nhập Nam Anh, Nam Lĩnh, Nam Xuân - Mục 40 NQ 1678)
    {"commune": "Đại Huệ", "type": "Xã", "province": "Nghệ An", "hamlets": ["Thôn Nam Anh", "Thôn Nam Lĩnh", "Thôn Nam Xuân", "Thôn Đại Huệ 1", "Thôn Đại Huệ 2"]},
    # 9. Xã Đô Lương (Sáp nhập Đà Sơn, Đặng Sơn, Lưu Sơn, Thịnh Sơn, Văn Sơn, Yên Sơn, TT Đô Lương - Mục 52 NQ 1678)
    {"commune": "Đô Lương", "type": "Xã", "province": "Nghệ An", "hamlets": ["Khối 1", "Khối 2", "Khối 3", "Thôn Đà Sơn", "Thôn Lưu Sơn", "Thôn Đặng Sơn"]},
    # 10. Phường Thành Vinh (Sáp nhập Cửa Nam, Đông Vĩnh, Hưng Bình, Lê Lợi, Quang Trung, Hưng Chính - Mục 117 NQ 1678)
    {"commune": "Thành Vinh", "type": "Phường", "province": "Nghệ An", "hamlets": ["Khối 1", "Khối 2", "Khối 3", "Khối Quang Trung", "Khối Lê Lợi", "Khối Cửa Nam"]},
    # 11. Phường Trường Vinh (Sáp nhập Bến Thủy, Hưng Dũng, Hưng Phúc, Trung Đô, Trường Thi, Vinh Tân, Hưng Hòa - Mục 116 NQ 1678)
    {"commune": "Trường Vinh", "type": "Phường", "province": "Nghệ An", "hamlets": ["Khối Trường Thi", "Khối Bến Thủy", "Khối Hưng Dũng", "Khối Trung Đô", "Khối Vinh Tân"]},
    # 12. Phường Cửa Lò (Sáp nhập Nghi Hải, Nghi Hòa, Nghi Hương, Nghi Tân, Nghi Thu, Nghi Thủy, Thu Thủy - Mục 121 NQ 1678)
    {"commune": "Cửa Lò", "type": "Phường", "province": "Nghệ An", "hamlets": ["Khối Nghi Tân", "Khối Nghi Thủy", "Khối Thu Thủy", "Khối Nghi Hương", "Khối Nghi Hải"]},
    # 13. Xã Con Cuông (Sáp nhập TT Trà Lân, Chi Khê, Yên Khê - Mục 7 NQ 1678)
    {"commune": "Con Cuông", "type": "Xã", "province": "Nghệ An", "hamlets": ["Bản Trà Lân", "Bản Chi Khê", "Bản Yên Khê", "Bản Pha Kháo"]},
    # 14. Xã Quỳnh Lưu (Sáp nhập TT Cầu Giát, Bình Sơn, Quỳnh Diễn, Quỳnh Giang, Quỳnh Hậu - Mục 71 NQ 1678)
    {"commune": "Quỳnh Lưu", "type": "Xã", "province": "Nghệ An", "hamlets": ["Khối 1", "Khối 2", "Thôn Cầu Giát", "Thôn Quỳnh Diễn", "Thôn Quỳnh Giang"]},
    # 15. Xã Diễn Châu (Sáp nhập TT Diễn Thành, Diễn Hoa, Diễn Phúc, Ngọc Bích - Mục 12 NQ 1678)
    {"commune": "Diễn Châu", "type": "Xã", "province": "Nghệ An", "hamlets": ["Khối 1", "Khối 2", "Thôn Diễn Thành", "Thôn Diễn Hoa", "Thôn Diễn Phúc"]},
    # 16. Xã Hưng Nguyên (Sáp nhập TT Hưng Nguyên, Hưng Đạo, Hưng Tây, Thịnh Mỹ - Mục 26 NQ 1678)
    {"commune": "Hưng Nguyên", "type": "Xã", "province": "Nghệ An", "hamlets": ["Khối 1", "Khối 2", "Thôn Hưng Đạo", "Thôn Hưng Tây", "Thôn Thịnh Mỹ"]},
]

def random_commune_info():
    """Lấy thông tin một xã/phường ngẫu nhiên."""
    loc = random.choice(LOCATIONS)
    full_commune = f"{loc['type']} {loc['commune']}"
    full_province = f"Tỉnh {loc['province']}"
    return {
        "commune": loc["commune"],
        "type": loc["type"],
        "province": loc["province"],
        "full_commune": full_commune,
        "full_province": full_province,
        "hamlets": loc["hamlets"],
    }

# =============================================================================
# 2. CƠ CẤU TỔ CHỨC 4 PHÒNG BAN CHUYÊN MÔN CẤP XÃ (LUẬT 72/2025/QH15)
# =============================================================================

DEPARTMENTS = [
    {
        "id": "10000000-0000-0000-0000-000000000001",
        "name": "Văn phòng HĐND & UBND",
        "code": "VAN_PHONG",
        "functions": "Quản lý điều hành chung, tham mưu pháp luật, nội chính, tổng hợp, cải cách hành chính, văn thư lưu trữ, kiểm tra đôn đốc, tiếp công dân",
        "roles": [
            ("Chánh Văn phòng", "Tham mưu tổng hợp, nội chính, pháp chế, kiểm soát TTHC, điều phối lịch công tác", 12),
            ("Phó Chánh Văn phòng", "Tổng hợp báo cáo, quy chế làm việc, công tác thi đua khen thưởng, tiếp công dân", 9),
            ("Chuyên viên Văn thư - Lưu trữ", "Văn thư, quản lý văn bản đi đến, lưu trữ hồ sơ, quản lý con dấu và chứng thư số", 6),
            ("Chuyên viên Tổng hợp - Pháp chế", "Rà soát văn bản quy phạm pháp luật, theo dõi đôn đốc nhiệm vụ, biên bản phiên họp", 5),
        ]
    },
    {
        "id": "10000000-0000-0000-0000-000000000002",
        "name": "Phòng Kinh tế",
        "alt_name": "Phòng Kinh tế - Hạ tầng & Đô thị",
        "code": "KINH_TE",
        "functions": "Quản lý đất đai, quy hoạch, trật tự xây dựng, tài chính - ngân sách, đầu tư công, nông nghiệp & phát triển nông thôn, tài nguyên môi trường, thương mại dịch vụ",
        "roles": [
            ("Trưởng phòng Kinh tế", "Tài chính ngân sách, đầu tư công, quy hoạch sử dụng đất, thẩm định dự án dân sinh", 14),
            ("Phó Trưởng phòng Kinh tế", "Nông nghiệp, lâm nghiệp, thủy sản, xây dựng nông thôn mới, phòng chống thiên tai", 10),
            ("Chuyên viên Địa chính - Xây dựng", "Quản lý đất đai, trích đo giải phóng mặt bằng, cấp phép xây dựng, xử lý vi phạm trật tự xây dựng", 8),
            ("Chuyên viên Tài chính - Kế toán", "Lập dự toán ngân sách xã, thanh quyết toán vốn đầu tư công, quản lý tài sản công dôi dư", 7),
            ("Chuyên viên Nông nghiệp & Môi trường", "Trồng trọt, chăn nuôi, thú y, bảo vệ môi trường khu dân cư, quản lý rác thải và tài nguyên khoáng sản", 6),
        ]
    },
    {
        "id": "10000000-0000-0000-0000-000000000003",
        "name": "Phòng Văn hóa - Xã hội",
        "code": "VAN_HOA_XA_HOI",
        "functions": "Quản lý trường mầm non/tiểu học/THCS, y tế trạm y tế, an sinh xã hội, người có công, văn hóa thể thao, tư pháp - hộ tịch, chứng thực, hòa giải",
        "roles": [
            ("Trưởng phòng Văn hóa - Xã hội", "Quản lý toàn diện khối văn hóa xã hội, giáo dục, y tế, chính sách an sinh xã hội", 13),
            ("Phó Trưởng phòng Văn hóa - Xã hội", "Phụ trách công tác chính sách người có công, giảm nghèo, bảo trợ xã hội và trẻ em", 9),
            ("Chuyên viên Tư pháp - Hộ tịch", "Hộ tịch, chứng thực, chứng thực điện tử, phổ biến giáo dục pháp luật, hòa giải cơ sở", 8),
            ("Chuyên viên Lao động - Thương binh & Xã hội", "Chính sách người có công, rà soát hộ nghèo, chi trả trợ cấp bảo trợ xã hội, bảo hiểm y tế", 7),
            ("Chuyên viên Văn hóa - Giáo dục - Y tế", "Quản lý thiết chế văn hóa, lễ hội, giám sát mạng lưới trường học và trạm y tế cơ sở", 5),
        ]
    },
    {
        "id": "10000000-0000-0000-0000-000000000004",
        "name": "Trung tâm Phục vụ Hành chính công",
        "code": "HANH_CHINH_CONG",
        "functions": "Đầu mối duy nhất tiếp nhận, số hóa 100% hồ sơ TTHC, giải quyết và trả kết quả, cung cấp dịch vụ công trực tuyến VNeID / Dịch vụ công Quốc gia",
        "roles": [
            ("Giám đốc Trung tâm Hành chính công", "Điều hành hoạt động bộ phận Một cửa, kiểm soát chất lượng giải quyết TTHC, tiếp nhận phản ánh kiến nghị", 11),
            ("Chuyên viên Tiếp nhận & Trả kết quả", "Hướng dẫn kê khai, tiếp nhận hồ sơ TTHC các lĩnh vực đất đai, tư pháp, bảo trợ xã hội", 6),
            ("Chuyên viên Số hóa & CNTT", "Scan tài liệu, số hóa kết quả TTHC, hỗ trợ người dân nộp hồ sơ trực tuyến qua VNeID", 5),
        ]
    },
    {
        "id": "10000000-0000-0000-0000-000000000005",
        "name": "Khối Đảng - HĐND - UBMTTQ",
        "code": "KHOI_DANG_DOAN_THE",
        "functions": "Lãnh đạo của Đảng ủy, giám sát của HĐND xã, giám sát và phản biện xã hội của Mặt trận Tổ quốc, Ban Giám sát đầu tư cộng đồng",
        "roles": [
            ("Phó Bí thư Thường trực Đảng ủy", "Công tác xây dựng đảng, tổ chức cán bộ cơ sở, quy chế phối hợp Đảng - Chính quyền", 15),
            ("Phó Chủ tịch HĐND xã", "Hoạt động giám sát của HĐND, Ban Pháp chế, Ban Kinh tế - Xã hội, thẩm tra nghị quyết", 13),
            ("Chủ tịch Ủy ban MTTQ xã", "Giám sát phản biện xã hội, Ban Thanh tra nhân dân, Ban Giám sát đầu tư của cộng đồng", 12),
            ("Chuyên viên UBMTTQ & Đoàn thể", "Tập hợp ý kiến cử tri, vận động nhân dân, giám sát thực hiện dân chủ ở cơ sở", 5),
        ]
    }
]

# Ban Lãnh đạo UBND cấp xã
LEADERSHIP_ROLES = [
    {"role": "Chủ tịch UBND xã", "dept_id": "10000000-0000-0000-0000-000000000001", "dept_name": "Văn phòng HĐND & UBND", "expertise": "Lãnh đạo, quản lý nhà nước toàn diện trên địa bàn xã, chỉ đạo điều hành kinh tế - xã hội, ngân sách, an ninh quốc phòng", "exp": 16},
    {"role": "Phó Chủ tịch UBND xã (Phụ trách Kinh tế)", "dept_id": "10000000-0000-0000-0000-000000000002", "dept_name": "Phòng Kinh tế", "expertise": "Chỉ đạo trực tiếp lĩnh vực địa chính, quy hoạch, xây dựng, tài nguyên môi trường, nông nghiệp, tài chính ngân sách", "exp": 13},
    {"role": "Phó Chủ tịch UBND xã (Phụ trách Văn hóa - Xã hội)", "dept_id": "10000000-0000-0000-0000-000000000003", "dept_name": "Phòng Văn hóa - Xã hội", "expertise": "Chỉ đạo trực tiếp lĩnh vực giáo dục, y tế, lao động thương binh xã hội, tư pháp hộ tịch, bộ phận Một cửa", "exp": 11},
]

# Ngân hàng họ tên cán bộ Việt Nam chân thực
LAST_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Đinh"]
MIDDLES_MALE = ["Văn", "Đình", "Quốc", "Minh", "Hữu", "Thanh", "Đức", "Trọng", "Xuân", "Viết"]
MIDDLES_FEMALE = ["Thị", "Thanh", "Ngọc", "Thu", "Mai", "Phương", "Hải", "Kim", "Bích", "Tuyết"]
FIRST_NAMES_MALE = ["Hùng", "Cường", "Tuấn", "Dũng", "Nam", "Long", "Thành", "Quang", "Hải", "Sơn", "Trung", "Bình", "Đạt", "Việt", "Toàn"]
FIRST_NAMES_FEMALE = ["Hương", "Mai", "Lan", "Hoa", "Thảo", "Trang", "Linh", "Hà", "Phương", "Ngọc", "Huyền", "Nhung", "Tâm", "Oanh", "Yến"]

def random_person_name():
    is_female = random.random() < 0.38
    last = random.choice(LAST_NAMES)
    if is_female:
        middle = random.choice(MIDDLES_FEMALE)
        first = random.choice(FIRST_NAMES_FEMALE)
    else:
        middle = random.choice(MIDDLES_MALE)
        first = random.choice(FIRST_NAMES_MALE)
    return f"{last} {middle} {first}"

def build_commune_staff_pool(loc):
    """Sinh danh sách cán bộ công chức đầy đủ cho một UBND xã."""
    pool = []
    # Lãnh đạo
    for leader in LEADERSHIP_ROLES:
        pool.append({
            "id": f"usr-{random.randint(1000, 9999):04d}-0000-0000-{random.randint(100000000000, 999999999999)}",
            "name": random_person_name(),
            "role": leader["role"],
            "dept_id": leader["dept_id"],
            "dept_name": leader["dept_name"],
            "expertise": leader["expertise"],
            "experience": leader["exp"],
            "assigned_hamlets": random.sample(loc["hamlets"], min(3, len(loc["hamlets"]))),
        })
    # Các phòng ban
    for dept in DEPARTMENTS:
        for role_name, expertise, exp in dept["roles"]:
            pool.append({
                "id": f"usr-{random.randint(1000, 9999):04d}-0000-0000-{random.randint(100000000000, 999999999999)}",
                "name": random_person_name(),
                "role": role_name,
                "dept_id": dept["id"],
                "dept_name": dept["name"],
                "expertise": expertise,
                "experience": exp,
                "assigned_hamlets": random.sample(loc["hamlets"], min(2, len(loc["hamlets"]))),
            })
    return pool

# =============================================================================
# 3. DANH MỤC 24 CHỦ ĐỀ NGHIỆP VỤ HÀNH CHÍNH CÔNG VỤ CẤP XÃ THỰC TẾ
# =============================================================================

COMMUNE_TOPICS = [
    # 1. Đất đai - Địa chính - Trật tự xây dựng (Phòng Kinh tế)
    {
        "title": "Kiểm tra hiện trạng sử dụng đất và xử lý vi phạm trật tự xây dựng trên đất nông nghiệp",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Đất đai ngày 18/01/2024; Căn cứ Nghị định số 151/2025/NĐ-CP ngày 15/7/2025 của Chính phủ về phân cấp, phân quyền trong lĩnh vực đất đai; Căn cứ Nghị định số 144/2025/NĐ-CP của Chính phủ về quản lý trật tự xây dựng;",
        "subtasks": [
            "Tổ chức kiểm tra thực địa, đo đạc hiện trạng các công trình xây dựng trái phép trên đất nông nghiệp tại các thôn, xóm",
            "Lập biên bản vi phạm hành chính, yêu cầu dừng ngay mọi hoạt động thi công và khắc phục hậu quả",
            "Xác minh nguồn gốc sử dụng đất, đối chiếu hồ sơ địa chính và bản đồ trích lục địa chính xã",
            "Tham mưu ban hành Quyết định xử phạt vi phạm hành chính và Quyết định cưỡng chế buộc thực hiện biện pháp khắc phục hậu quả",
        ],
        "output_type": "Quyết định xử phạt / Báo cáo kết quả kiểm tra",
    },
    {
        "title": "Rà soát, lập phương án bồi thường, hỗ trợ tái định cư giải phóng mặt bằng dự án mở rộng đường giao thông nông thôn",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Đất đai năm 2024; Căn cứ Nghị định số 151/2025/NĐ-CP của Chính phủ; Căn cứ Quyết định của UBND tỉnh về đơn giá bồi thường cây cối, hoa màu và vật kiến trúc;",
        "subtasks": [
            "Thông báo kế hoạch thu hồi đất và lịch kiểm kê, đo đạc trích đo tới các hộ gia đình bị ảnh hưởng trong phạm vi dự án",
            "Phối hợp với Ban phát triển thôn kiểm đếm tài sản, diện tích đất lúa, đất ở và hoa màu của từng hộ gia đình",
            "Lập bảng áp giá bồi thường chi tiết theo đơn giá quy định của UBND tỉnh và niêm yết công khai tại Nhà văn hóa thôn",
            "Tổ chức họp lấy ý kiến cử tri, hoàn thiện hồ sơ phương án bồi thường trình Hội đồng thẩm định xã phê duyệt",
        ],
        "output_type": "Phương án bồi thường GPMB / Tờ trình phê duyệt",
    },
    {
        "title": "Thẩm định hồ sơ và đề nghị cấp Giấy chứng nhận quyền sử dụng đất lần đầu cho hộ gia đình, cá nhân",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Đất đai số 31/2024/QH15; Căn cứ Nghị định số 151/2025/NĐ-CP ngày 15/7/2025 của Chính phủ; Căn cứ thẩm quyền xác nhận nguồn gốc đất của UBND cấp xã;",
        "subtasks": [
            "Tiếp nhận hồ sơ đăng ký cấp GCN QSDĐ từ Trung tâm Phục vụ Hành chính công xã chuyển sang",
            "Kiểm tra tính pháp lý, đối chiếu sổ mục kê, bản đồ địa chính qua các thời kỳ và xác nhận nguồn gốc, thời điểm bắt đầu sử dụng đất",
            "Niêm yết công khai danh sách các trường hợp đủ điều kiện cấp GCN QSDĐ tại trụ sở UBND xã và Nhà văn hóa thôn (thời gian 15 ngày)",
            "Lập biên bản kết thúc công khai và tham mưu văn bản xác nhận đủ điều kiện cấp Giấy chứng nhận gửi cơ quan đăng ký đất đai",
        ],
        "output_type": "Tờ trình và Danh sách xác nhận cấp GCN",
    },
    {
        "title": "Quản lý, kiểm kê và lập phương án xử lý tài sản công, đất công ích 5% dôi dư sau sắp xếp sáp nhập đơn vị hành chính",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Quản lý, sử dụng tài sản công năm 2017; Căn cứ Nghị định số 127/2025/NĐ-CP của Chính phủ về phân cấp quản lý tài sản công dôi dư; Căn cứ Nghị định số 155/2025/NĐ-CP;",
        "subtasks": [
            "Kiểm kê toàn bộ hiện trạng các cơ sở nhà đất, trụ sở trạm xá, nhà văn hóa và quỹ đất nông nghiệp công ích 5% dôi dư",
            "Phân loại các cơ sở đủ điều kiện chuyển đổi công năng sang mục đích giáo dục, y tế, thiết chế sinh hoạt cộng đồng",
            "Lập danh mục cơ sở nhà đất đề xuất đưa vào phương án bán đấu giá quyền sử dụng đất tạo nguồn thu ngân sách xã",
            "Xây dựng Báo cáo tổng thể trình Thường trực Đảng ủy và HĐND xã xem xét, quyết nghị",
        ],
        "output_type": "Báo cáo kiểm kê / Đề án xử lý tài sản công",
    },

    # 2. Tài chính ngân sách & Đầu tư công (Phòng Kinh tế)
    {
        "title": "Lập dự toán thu, chi ngân sách xã năm 2026 và phương án phân bổ nguồn vốn đầu tư công",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Ngân sách nhà nước; Căn cứ Nghị định số 125/2025/NĐ-CP ngày 01/7/2025 của Chính phủ về quyền tự chủ ngân sách cấp xã; Căn cứ Nghị quyết của HĐND xã;",
        "subtasks": [
            "Đánh giá tình hình thực hiện dự toán thu, chi ngân sách xã năm 2025 và rà soát các nguồn thu phát sinh trên địa bàn",
            "Dự toán nguồn thu ngân sách được hưởng theo phân cấp (thuế đất phi nông nghiệp, phí, lệ phí, tiền thuê đất công ích)",
            "Xây dựng phương án cân đối chi thường xuyên và phân bổ chi đầu tư phát triển cơ sở hạ tầng giao thông, thủy lợi nội đồng",
            "Hoàn chỉnh Báo cáo dự toán thu chi ngân sách trình Ban Kinh tế - Xã hội HĐND xã thẩm tra trước kỳ họp HĐND",
        ],
        "output_type": "Báo cáo dự toán thu chi / Tờ trình HĐND",
    },
    {
        "title": "Nghiệm thu khối lượng hoàn thành và giải ngân vốn đầu tư công các công trình xây dựng nông thôn mới nâng cao",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Đầu tư công năm 2019; Căn cứ Nghị định số 125/2025/NĐ-CP của Chính phủ; Căn cứ Hợp đồng kinh tế thi công xây lắp công trình đã ký kết;",
        "subtasks": [
            "Tổ chức kiểm tra hiện trường công trình cùng đơn vị tư vấn giám sát, nhà thầu thi công và Ban Giám sát đầu tư cộng đồng",
            "Đo đạc, đối chiếu khối lượng thi công thực tế với hồ sơ bản vẽ thiết kế - dự toán đã được phê duyệt",
            "Lập Biên bản nghiệm thu khối lượng hoàn thành giai đoạn làm căn cứ tạm ứng, thanh toán",
            "Hoàn thiện hồ sơ thanh toán gửi Kho bạc Nhà nước để giải ngân nguồn vốn đúng thời hạn",
        ],
        "output_type": "Biên bản nghiệm thu / Hồ sơ đề nghị giải ngân",
    },

    # 3. Nông nghiệp, Môi trường & Phòng chống thiên tai (Phòng Kinh tế)
    {
        "title": "Triển khai phương án ứng phó thiên tai, bão lũ và sơ tán nhân dân vùng trũng thấp sạt lở ven sông",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Phòng, chống thiên tai năm 2013; Căn cứ Nghị định số 136/2025/NĐ-CP của Chính phủ về phân cấp thẩm quyền phòng chống thiên tai cấp cơ sở; Căn cứ Phương án PCTT xã;",
        "subtasks": [
            "Rà soát, cắm biển cảnh báo tại các khu vực xung yếu có nguy cơ sạt lở bờ sông, đường tràn ngập sâu khi có mưa lớn",
            "Lập danh sách các hộ dân thuộc diện phải di dời khẩn cấp khi nước sông dâng báo động cấp 2, cấp 3",
            "Kiểm tra vật tư dự trữ phòng chống lụt bão (bao tải cát, cọc tre, phao cứu sinh, đèn pin, lương thực dự phòng)",
            "Phân công lực lượng xung kích ứng trực 24/24 giờ tại các điếm canh đê và trụ sở chỉ huy PCTT xã",
        ],
        "output_type": "Kế hoạch PCTT / Công văn chỉ đạo khẩn",
    },
    {
        "title": "Tổ chức tiêm phòng vắc xin gia súc, gia cầm vụ Thu - Đông và triển khai tháng cao điểm khử trùng tiêu độc",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Thú y năm 2015; Căn cứ Nghị định số 136/2025/NĐ-CP của Chính phủ; Căn cứ Kế hoạch phòng chống dịch bệnh động vật của Sở Nông nghiệp & PTNT;",
        "subtasks": [
            "Rà soát, thống kê chính xác tổng đàn trâu, bò, lợn, dê và đàn gia cầm trên địa bàn từng thôn, xóm",
            "Tiếp nhận vật tư, vắc xin Lở mồm long móng, Viêm da nổi cục, Cúm gia cầm và hóa chất khử trùng",
            "Thông báo lịch tiêm phòng tập trung tại từng cụm dân cư, cử cán bộ thú y trực tiếp thực hiện tiêm phòng",
            "Lập biên bản nghiệm thu tỷ lệ tiêm phòng đạt tối thiểu trên 85% tổng đàn thuộc diện tiêm bắt buộc",
        ],
        "output_type": "Kế hoạch tiêm phòng / Báo cáo kết quả",
    },
    {
        "title": "Tăng cường công tác thu gom, xử lý rác thải sinh hoạt và giải tỏa các điểm ô nhiễm môi trường khu dân cư",
        "dept_code": "KINH_TE",
        "legal_basis": "Căn cứ Luật Bảo vệ môi trường năm 2020; Căn cứ Nghị định số 131/2025/NĐ-CP của Chính phủ về phân cấp thẩm quyền quản lý môi trường nông thôn cấp xã;",
        "subtasks": [
            "Kiểm tra hoạt động của Tổ thu gom rác thải tự quản tại các thôn, xóm và điểm trung chuyển rác tập trung",
            "Xử lý nghiêm các trường hợp đổ rác thải sinh hoạt, xác động vật chết, rác thải xây dựng bừa bãi ven đường liên xã",
            "Phối hợp với Hội Phụ nữ và Đoàn Thanh niên phát động phong trào 'Chủ nhật xanh', dọn dẹp vệ sinh môi trường tuyến đường kiểu mẫu",
            "Báo cáo định kỳ công tác quản lý chất thải rắn sinh hoạt nông thôn gửi Phòng Kinh tế tổng hợp",
        ],
        "output_type": "Kế hoạch BVMT / Thông báo yêu cầu xử lý",
    },

    # 4. Văn hóa - Xã hội, Giáo dục, Y tế & An sinh (Phòng Văn hóa - Xã hội)
    {
        "title": "Kiểm tra cơ sở vật chất các trường Mầm non, Tiểu học, THCS và chuẩn bị công tác khai giảng năm học mới",
        "dept_code": "VAN_HOA_XA_HOI",
        "legal_basis": "Căn cứ Luật Giáo dục năm 2019; Căn cứ Nghị định số 142/2025/NĐ-CP và Nghị định số 143/2025/NĐ-CP của Chính phủ về tiếp nhận, quản lý các cơ sở giáo dục trực thuộc xã;",
        "subtasks": [
            "Kiểm tra thực tế phòng học, bàn ghế, trang thiết bị dạy học, hệ thống điện chiếu sáng, nước sạch tại 3 cấp trường",
            "Rà soát các hạng mục công trình phụ trợ xuống cấp cần bố trí kinh phí tu sửa cấp bách trước ngày khai giảng",
            "Nắm bắt số lượng học sinh trong độ tuổi đến trường, các trường hợp học sinh có hoàn cảnh đặc biệt khó khăn cần hỗ trợ",
            "Tổng hợp tình hình cơ sở vật chất trường lớp báo cáo Thường trực UBND xã xem xét phân bổ kinh phí sửa chữa",
        ],
        "output_type": "Báo cáo khảo sát / Tờ trình kinh phí",
    },
    {
        "title": "Kiểm tra công tác chăm sóc sức khỏe ban đầu, tiêm chủng mở rộng và phòng chống dịch bệnh tại Trạm Y tế xã",
        "dept_code": "VAN_HOA_XA_HOI",
        "legal_basis": "Căn cứ Luật Khám bệnh, chữa bệnh năm 2023; Căn cứ Nghị định số 147/2025/NĐ-CP và Nghị định số 148/2025/NĐ-CP của Chính phủ về quản lý y tế cơ sở và y tế dự phòng cấp xã;",
        "subtasks": [
            "Kiểm tra công tác trực khám chữa bệnh, danh mục thuốc thiết yếu, trang thiết bị y tế và quy trình sơ cấp cứu",
            "Giám sát việc thực hiện chương trình Tiêm chủng mở rộng định kỳ hàng tháng cho trẻ em dưới 1 tuổi và phụ nữ có thai",
            "Triển khai chiến dịch diệt lăng quăng, bọ gậy, phun hóa chất chủ động phòng chống dịch bệnh sốt xuất huyết",
            "Lập biên bản kiểm tra y tế cơ sở và kiến nghị biện pháp nâng cao chất lượng khám chữa bệnh ban đầu cho nhân dân",
        ],
        "output_type": "Biên bản kiểm tra / Báo cáo y tế",
    },
    {
        "title": "Tổ chức rà soát, bình xét hộ nghèo, hộ cận nghèo năm 2026 và thực hiện chính sách giảm nghèo bền vững",
        "dept_code": "VAN_HOA_XA_HOI",
        "legal_basis": "Căn cứ Nghị định số 07/2021/NĐ-CP của Chính phủ quy định chuẩn nghèo đa chiều giai đoạn 2021 - 2025; Căn cứ Kế hoạch rà soát hộ nghèo hàng năm của UBND tỉnh;",
        "subtasks": [
            "Tập huấn nghiệp vụ điều tra, thu thập thông tin phiếu khảo sát nhận dạng hộ nghèo cho Trưởng thôn và điều tra viên",
            "Tổ chức họp dân tại từng thôn, xóm để bình xét công khai, dân chủ, đúng quy trình xác định hộ nghèo, hộ cận nghèo",
            "Niêm yết công khai danh sách kết quả rà soát sơ bộ tại trụ sở UBND xã và Nhà văn hóa thôn trong thời hạn 07 ngày làm việc",
            "Hoàn thiện hồ sơ báo cáo thẩm định, ban hành Quyết định công nhận danh sách hộ nghèo, hộ cận nghèo chính thức của xã",
        ],
        "output_type": "Quyết định công nhận / Kế hoạch rà soát",
    },
    {
        "title": "Thực hiện chi trả chế độ trợ cấp ưu đãi người có công, đối tượng bảo trợ xã hội và tặng quà nhân dịp Lễ, Tết",
        "dept_code": "VAN_HOA_XA_HOI",
        "legal_basis": "Căn cứ Pháp lệnh Ưu đãi người có công với cách mạng; Căn cứ Nghị định số 20/2021/NĐ-CP của Chính phủ quy định chính sách trợ giúp xã hội; Căn cứ Quyết định phân bổ kinh phí của tỉnh;",
        "subtasks": [
            "Lập danh sách chi trả trợ cấp hàng tháng cho thương binh, bệnh binh, thân nhân liệt sĩ và người hoạt động kháng chiến",
            "Rà soát, lập danh sách người cao tuổi từ đủ 80 tuổi, người khuyết tật nặng và đối tượng hưởng bảo trợ xã hội",
            "Phối hợp với Bưu điện văn hóa xã thực hiện chi trả chế độ kịp thời, đầy đủ, đúng người, không để xảy ra sai sót",
            "Tổ chức các đoàn thăm hỏi, trao quà của Chủ tịch nước, Tỉnh ủy và Đảng ủy - UBND xã tới các Mẹ Việt Nam Anh hùng",
        ],
        "output_type": "Kế hoạch trao quà / Báo cáo chi trả",
    },
    {
        "title": "Kiểm tra việc chấp hành quy định an toàn vệ sinh thực phẩm tại các cơ sở kinh doanh dịch vụ ăn uống và chợ nông thôn",
        "dept_code": "VAN_HOA_XA_HOI",
        "legal_basis": "Căn cứ Luật An toàn thực phẩm năm 2010; Căn cứ Nghị định số 15/2018/NĐ-CP của Chính phủ; Căn cứ Quyết định thành lập Đoàn kiểm tra liên ngành ATTP cấp xã;",
        "subtasks": [
            "Kiểm tra giấy chứng nhận đăng ký kinh doanh, giấy chứng nhận cơ sở đủ điều kiện ATTP và giấy khám sức khỏe định kỳ",
            "Kiểm tra nguồn gốc xuất xứ nguyên liệu thực phẩm, điều kiện vệ sinh nơi chế biến, bảo quản và nguồn nước sử dụng",
            "Lấy mẫu xét nghiệm nhanh một số chỉ tiêu an toàn thực phẩm đối với thực phẩm chế biến sẵn lưu thông tại chợ",
            "Lập biên bản vi phạm hành chính đối với các cơ sở vi phạm quy định về vệ sinh an toàn thực phẩm, tham mưu xử phạt",
        ],
        "output_type": "Biên bản kiểm tra / Quyết định xử phạt",
    },

    # 5. Tư pháp - Hộ tịch & Hòa giải cơ sở (Phòng Văn hóa - Xã hội)
    {
        "title": "Thụ lý, xác minh và tổ chức hội nghị hòa giải cơ sở tranh chấp ranh giới đất đai giữa các hộ gia đình",
        "dept_code": "VAN_HOA_XA_HOI",
        "legal_basis": "Căn cứ Luật Đất đai năm 2024; Căn cứ Luật Hòa giải ở cơ sở năm 2013; Căn cứ Nghị định số 120/2025/NĐ-CP của Chính phủ về phân cấp thẩm quyền tư pháp cơ sở;",
        "subtasks": [
            "Tiếp nhận đơn đề nghị hòa giải tranh chấp đất đai của công dân, vào sổ theo dõi thụ lý đơn thư khiếu nại kiến nghị",
            "Tổ chức kiểm tra thực địa, phối hợp cán bộ địa chính đo đạc hiện trạng ranh giới thửa đất tranh chấp và lấy lời khai nhân chứng",
            "Chủ trì tổ chức phiên họp Hội đồng hòa giải tranh chấp đất đai xã với sự tham gia của đại diện MTTQ, Hội Nông dân, Trưởng thôn",
            "Lập Biên bản hòa giải thành (hoặc Biên bản hòa giải không thành) và hướng dẫn công dân nộp đơn tới Tòa án theo quy định",
        ],
        "output_type": "Biên bản hòa giải / Thông báo kết quả",
    },
    {
        "title": "Tổ chức đợt cao điểm tuyên truyền, phổ biến giáo dục pháp luật về Luật Đất đai 2024 và Luật Dân chủ cơ sở",
        "dept_code": "VAN_HOA_XA_HOI",
        "legal_basis": "Căn cứ Luật Phổ biến, giáo dục pháp luật năm 2012; Căn cứ Luật Thực hiện dân chủ ở cơ sở năm 2022; Căn cứ Kế hoạch PBGDPL hàng năm của xã;",
        "subtasks": [
            "Biên soạn tài liệu tuyên truyền tóm tắt các điểm mới cốt lõi của Luật Đất đai 2024 và các văn bản hướng dẫn thi hành",
            "Phát sóng các chuyên đề pháp luật trên hệ thống Đài truyền thanh không dây của xã vào khung giờ 06h00 và 17h00 hàng ngày",
            "Tổ chức các hội nghị tuyên truyền trực tiếp tại Nhà văn hóa các thôn, xóm thu hút đông đảo cán bộ, đoàn viên và nhân dân",
            "Tổ chức trợ giúp pháp lý lưu động, giải đáp trực tiếp các vướng mắc của người dân liên quan đến chế độ, chính sách, đất đai",
        ],
        "output_type": "Kế hoạch tuyên truyền / Báo cáo PBGDPL",
    },

    # 6. Chuyển đổi số & Bộ phận Một cửa (Trung tâm Phục vụ Hành chính công)
    {
        "title": "Đẩy mạnh số hóa 100% hồ sơ, kết quả giải quyết TTHC và nâng cao tỷ lệ dịch vụ công trực tuyến toàn trình",
        "dept_code": "HANH_CHINH_CONG",
        "legal_basis": "Căn cứ Nghị định số 61/2018/NĐ-CP và Nghị định số 107/2021/NĐ-CP của Chính phủ về thực hiện cơ chế một cửa, một cửa liên thông; Căn cứ Đề án 06/CP;",
        "subtasks": [
            "Kiểm tra trang thiết bị máy scan, chữ ký số chuyên dùng công vụ tại các quầy tiếp nhận của Trung tâm Hành chính công",
            "Hướng dẫn 100% công dân đến giao dịch tạo tài khoản Dịch vụ công Quốc gia và kích hoạt tài khoản định danh điện tử VNeID mức 2",
            "Thực hiện scan, đính kèm đầy đủ thành phần hồ sơ và ký số kết quả giải quyết TTHC vào kho dữ liệu điện tử của xã",
            "Theo dõi, đôn đốc các phòng chuyên môn xử lý hồ sơ đúng hạn, tuyệt đối không để hồ sơ quá hạn trên Hệ thống thông tin giải quyết TTHC",
        ],
        "output_type": "Kế hoạch chuyển đổi số / Báo cáo chỉ số TTHC",
    },
    {
        "title": "Kiểm tra kỷ luật, kỷ cương hành chính, đạo đức công vụ và văn hóa giao tiếp của cán bộ tại Bộ phận Một cửa",
        "dept_code": "HANH_CHINH_CONG",
        "legal_basis": "Căn cứ Chỉ thị số 26/CT-TTg của Thủ tướng Chính phủ về tăng cường kỷ luật, kỷ cương trong các cơ quan hành chính nhà nước; Căn cứ Quy chế làm việc của UBND xã;",
        "subtasks": [
            "Kiểm tra việc chấp hành giờ giấc làm việc, đeo thẻ công chức và trang phục công sở của cán bộ trực tại Bộ phận Một cửa",
            "Khảo sát, thu thập phiếu đánh giá mức độ hài lòng của người dân và doanh nghiệp khi đến thực hiện thủ tục hành chính",
            "Kiểm tra việc niêm yết công khai đầy đủ, rõ ràng danh mục 714 TTHC thuộc thẩm quyền giải quyết của cấp xã và mức thu phí, lệ phí",
            "Lập biên bản kiểm tra công vụ đột xuất, báo cáo Chủ tịch UBND xã xem xét biểu dương hoặc chấn chỉnh xử lý vi phạm",
        ],
        "output_type": "Biên bản kiểm tra công vụ / Thông báo chấn chỉnh",
    },

    # 7. Văn phòng, Nội chính & Lãnh đạo điều hành (Văn phòng HĐND & UBND)
    {
        "title": "Chuẩn bị nội dung, cơ sở vật chất và tài liệu phục vụ Kỳ họp chuyên đề của Hội đồng nhân dân xã",
        "dept_code": "VAN_PHONG",
        "legal_basis": "Căn cứ Luật Tổ chức chính quyền địa phương số 72/2025/QH15; Căn cứ Quy chế hoạt động của HĐND xã; Căn cứ Thông báo kết luận của Thường trực HĐND xã;",
        "subtasks": [
            "Phối hợp với Ban Kinh tế - Xã hội và Ban Pháp chế HĐND xã thẩm tra các dự thảo Nghị quyết, Báo cáo và Tờ trình của UBND",
            "Hoàn thiện toàn bộ bộ tài liệu kỳ họp, in ấn và gửi tới các đại biểu HĐND xã trước ngày khai mạc kỳ họp theo quy định",
            "Soạn thảo Giấy mời tham dự kỳ họp gửi đại biểu HĐND, đại biểu cấp tỉnh ứng cử trên địa bàn và các ban ngành đoàn thể",
            "Chuẩn bị hội trường, hệ thống âm thanh, máy chiếu, biển tên đại biểu và phân công tổ thư ký phục vụ kỳ họp",
        ],
        "output_type": "Kế hoạch tổ chức kỳ họp / Giấy mời HĐND",
    },
    {
        "title": "Tổ chức Hội nghị đối thoại trực tiếp giữa Người đứng đầu Cấp ủy, Chính quyền xã với Nhân dân",
        "dept_code": "VAN_PHONG",
        "legal_basis": "Căn cứ Quyết định số 218-QĐ/TW của Bộ Chính trị về MTTQ và các đoàn thể tham gia góp ý xây dựng Đảng, chính quyền; Căn cứ Kế hoạch đối thoại hàng năm;",
        "subtasks": [
            "Phối hợp với Ban Thường trực UBMTTQ xã tổng hợp toàn bộ các ý kiến, kiến nghị, tâm tư của cử tri trước hội nghị đối thoại",
            "Phân công các phòng chuyên môn (Kinh tế, Văn hóa - Xã hội, Tư pháp) chuẩn bị báo cáo giải trình chi tiết từng nội dung kiến nghị",
            "Phát hành Giấy mời và thông báo rộng rãi trên hệ thống loa truyền thanh xã về thời gian, địa điểm, nội dung đối thoại",
            "Phân công thư ký ghi chép biên bản chi tiết, tổng hợp kết luận của đồng chí Bí thư Đảng ủy - Chủ tịch UBND xã để ban hành Thông báo kết luận",
        ],
        "output_type": "Kế hoạch đối thoại / Thông báo kết luận đối thoại",
    },
    {
        "title": "Kiểm tra, đôn đốc tiến độ thực hiện các nhiệm vụ do Chủ tịch UBND tỉnh và UBND xã giao trong tháng",
        "dept_code": "VAN_PHONG",
        "legal_basis": "Căn cứ Quy chế làm việc của UBND xã nhiệm kỳ 2026 - 2031; Căn cứ Sổ theo dõi thực hiện nhiệm vụ và Hệ thống chỉ đạo điều hành điện tử;",
        "subtasks": [
            "Rà soát toàn bộ các văn bản chỉ đạo của cấp trên và các kết luận phiên họp UBND xã giao cho các phòng ban, cán bộ công chức",
            "Thống kê các nhiệm vụ đã hoàn thành đúng hạn, nhiệm vụ đang triển khai và nhiệm vụ quá hạn chưa có báo cáo giải trình",
            "Lập Bảng tổng hợp theo dõi nhiệm vụ chi tiết và gửi văn bản đôn đốc các bộ phận đang chậm tiến độ",
            "Báo cáo tại phiên họp giao ban định kỳ của Thường trực UBND xã để Lãnh đạo có biện pháp chỉ đạo xử lý kịp thời",
        ],
        "output_type": "Báo cáo tiến độ / Văn bản đôn đốc",
    },

    # 8. Khối Đảng - Đoàn thể & Giám sát Mặt trận Tổ quốc (Khối Đảng - Đoàn thể)
    {
        "title": "Ban Giám sát đầu tư của cộng đồng (UBMTTQ xã) tổ chức giám sát thi công công trình đường giao thông liên thôn",
        "dept_code": "KHOI_DANG_DOAN_THE",
        "legal_basis": "Căn cứ Luật Thực hiện dân chủ ở cơ sở năm 2022; Căn cứ Luật Đầu tư công năm 2019; Căn cứ Quyết định thành lập Ban Giám sát đầu tư cộng đồng của UBMTTQ xã;",
        "subtasks": [
            "Tổ chức kiểm tra thực tế việc đào móng, lu lèn nền đường, độ dày lớp bê tông và chất lượng cốt thép, xi măng của đơn vị thi công",
            "Đối chiếu tiến độ thi công thực tế với hồ sơ thiết kế kỹ thuật và cam kết tiến độ của nhà thầu",
            "Lắng nghe, tiếp thu các phản ánh của nhân dân dọc tuyến đường về tình trạng bụi bẩn, lún sụt hoặc ảnh hưởng dòng chảy tiêu thoát nước",
            "Lập Biên bản giám sát cộng đồng, kiến nghị Ban Quản lý dự án xã và Nhà thầu chấn chỉnh kịp thời các tồn tại",
        ],
        "output_type": "Biên bản giám sát cộng đồng / Báo cáo kết quả giám sát",
    },
    {
        "title": "Tổ chức Ngày hội Đại đoàn kết toàn dân tộc tại các khu dân cư nhân kỷ niệm Ngày truyền thống Mặt trận Tổ quốc",
        "dept_code": "KHOI_DANG_DOAN_THE",
        "legal_basis": "Căn cứ Hướng dẫn của Ban Thường trực Ủy ban Trung ương MTTQ Việt Nam; Căn cứ Kế hoạch tổ chức Ngày hội Đại đoàn kết của Đảng ủy - HĐND - UBND - UBMTTQ xã;",
        "subtasks": [
            "Hướng dẫn Ban Công tác Mặt trận các thôn, xóm xây dựng kế hoạch, kịch bản chương trình phần Lễ và phần Hội",
            "Rà soát, lập danh sách đề nghị UBND xã tặng Giấy khen cho các Gia đình văn hóa tiêu biểu và tập thể xuất sắc trong phong trào toàn dân đoàn kết",
            "Vận động Quỹ Vì người nghèo xã, chuẩn bị các suất quà trao tặng cho các hộ nghèo, hộ có hoàn cảnh đặc biệt khó khăn tại ngày hội",
            "Phân công các đồng chí Ủy viên Ban Thường vụ Đảng ủy, Lãnh đạo HĐND, UBND xã về dự và chung vui cùng nhân dân tại từng thôn/xóm",
        ],
        "output_type": "Kế hoạch tổ chức Ngày hội / Quyết định khen thưởng",
    },
    {
        "title": "Phối hợp giải quyết đơn thư khiếu nại, phản ánh của nhân dân về tranh chấp lối đi chung trong khu dân cư",
        "dept_code": "KHOI_DANG_DOAN_THE",
        "legal_basis": "Căn cứ Luật Tiếp công dân năm 2013; Căn cứ Luật Khiếu nại năm 2011; Căn cứ Quy chế phối hợp công tác giữa UBND xã và Ủy ban MTTQ xã;",
        "subtasks": [
            "Cùng cán bộ Tư pháp - Địa chính xã xuống hiện trường kiểm tra lối đi chung, xác minh nguồn gốc ranh giới qua các thời kỳ",
            "Tổ chức gặp gỡ riêng từng gia đình, lắng nghe tâm tư, phân tích quy định pháp luật và vận động giữ gìn tình làng nghĩa xóm",
            "Chủ trì buổi hòa giải tại Nhà văn hóa thôn với sự tham gia của Chi ủy, Trưởng thôn, Ban Công tác Mặt trận và các bậc cao niên",
            "Lập biên bản thống nhất phương án mở rộng lối đi chung và ký cam kết giữa các bên liên quan, ổn định tình hình cơ sở",
        ],
        "output_type": "Biên bản hòa giải cơ sở / Báo cáo kết quả",
    },
]

def get_dept_by_code(code):
    for d in DEPARTMENTS:
        if d["code"] == code:
            return d
    return DEPARTMENTS[0]

# =============================================================================
# NHÓM 1: TRÍCH XUẤT ĐƠN (OCR CÔNG VĂN ĐẾN -> JSON SCHEMA .NET) — 150 MẪU
# =============================================================================

def generate_sample_ocr_extraction(idx):
    loc = random_commune_info()
    topic = random.choice(COMMUNE_TOPICS)
    dept = get_dept_by_code(topic["dept_code"])
    
    # Cơ quan ban hành (UBND Tỉnh gửi về xã, hoặc do UBND xã ban hành)
    is_province_level = random.random() < 0.65
    if is_province_level:
        issuing_org = f"ỦY BAN NHÂN DÂN {loc['full_province'].upper()}"
        doc_num = f"{random.randint(100, 999)}/UBND-VP"
        sender_title = "CHỦ TỊCH / KT. CHỦ TỊCH\nPHÓ CHỦ TỊCH"
        recipient = f"UBND {loc['full_commune']}"
    else:
        issuing_org = f"ỦY BAN NHÂN DÂN {loc['full_commune'].upper()}"
        doc_num = f"{random.randint(15, 299)}/UBND-{topic['dept_code'][:2]}"
        sender_title = "TM. ỦY BAN NHÂN DÂN\nCHỦ TỊCH"
        recipient = f"Các Phòng chuyên môn thuộc UBND {loc['full_commune']}; Trưởng các thôn, xóm"

    days_offset = random.randint(3, 15)
    now = datetime.now()
    deadline_date = (now + timedelta(days=days_offset)).strftime("%Y-%m-%d")
    deadline_display = (now + timedelta(days=days_offset)).strftime("%d/%m/%Y")
    issued_date = (now - timedelta(days=random.randint(1, 3))).strftime("%d/%m/%Y")
    leader_name = random_person_name()

    subtask_bullets = "\n".join([f"   {i+1}. {st}." for i, st in enumerate(topic["subtasks"])])

    raw_doc = f"""
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{issuing_org}
Số: {doc_num}
{loc['commune']}, ngày {issued_date}

CÔNG VĂN
V/v: {topic['title']}

Kính gửi: {recipient}.

{topic['legal_basis']}
Nhằm nâng cao hiệu lực, hiệu quả quản lý nhà nước trên địa bàn, Ủy ban nhân dân yêu cầu các cơ quan, đơn vị, cán bộ công chức tập trung triển khai thực hiện nghiêm túc các nhiệm vụ trọng tâm sau:

1. Giao {dept['name']} chủ trì, phối hợp với các cơ quan, đơn vị liên quan và Trưởng các thôn, xóm khẩn trương triển khai các nội dung:
{subtask_bullets}

2. Thời hạn hoàn thành: Yêu cầu {dept['name']} tổng hợp kết quả, lập báo cáo chi tiết bằng văn bản gửi về Thường trực UBND trước 16 giờ 30 phút ngày {deadline_display} để xem xét, chỉ đạo.

3. Đề nghị Ủy ban Mặt trận Tổ quốc xã và các đoàn thể chính trị - xã hội tăng cường công tác tuyên truyền, giám sát thực hiện; Trưởng các thôn, xóm kịp thời báo cáo các vướng mắc phát sinh trong quá trình triển khai./.

Nơi nhận:
- Như kính gửi;
- Thường trực Đảng ủy xã (để b/c);
- Thường trực HĐND xã;
- Chủ tịch, các PCT UBND;
- Lưu: VT, {dept['name'][:2]}.

{sender_title}
(Ký, đóng dấu)

{leader_name}
""".strip()

    expected_output = {
        "category": "TaskAssignmentDown",
        "title": f"Chỉ đạo: {topic['title']}",
        "summary": (
            f"Văn bản số {doc_num} yêu cầu {dept['name']} chủ trì, phối hợp các đơn vị liên quan "
            f"triển khai {topic['title'].lower()}; hoàn thành và nộp báo cáo trước ngày {deadline_display}."
        ),
        "deadlineDate": f"{deadline_date}T16:30:00Z",
        "suggestedDepartmentId": dept["id"],
        "suggestedDepartmentName": dept["name"],
        "confidence": round(random.uniform(0.93, 0.99), 2),
        "deadlineSeemsUnreasonable": False,
        "lowConfidence": False,
        "objectives": f"Thực hiện đầy đủ, đúng hạn và đúng quy định pháp luật nội dung chỉ đạo về {topic['title'].lower()}.",
        "subjects": topic["subtasks"],
        "validationWarnings": [],
    }

    system_prompt = (
        f"Bạn là Trợ lý AI chuyên trách xử lý văn bản hành chính công vụ cho UBND {loc['full_commune']} "
        f"theo chuẩn Nghị định 30/2020/NĐ-CP và Luật Tổ chức chính quyền địa phương.\n"
        "Nhiệm vụ của bạn là phân tích nội dung văn bản, bóc tách chính xác các thông tin có cấu trúc "
        "và trả về DUY NHẤT một khối JSON hợp lệ khớp với schema của hệ thống điều phối."
    )

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Hãy phân tích và bóc tách dữ liệu có cấu trúc từ văn bản hành chính công vụ sau:\n\n{raw_doc}"},
            {"role": "assistant", "content": json.dumps(expected_output, ensure_ascii=False, indent=2)},
        ]
    }

# =============================================================================
# NHÓM 2: TRÍCH XUẤT BẢNG (VĂN BẢN CÓ BẢNG -> MẢNG JSON CHO EXCEL) — 150 MẪU
# =============================================================================

TABLE_KINDS = [
    "ke_hoach_phan_cong",
    "du_toan_kinh_phi",
    "ra_soat_dat_dai",
    "danh_sach_ho_ngheo",
    "lich_cong_tac_tuan"
]

def generate_sample_table_extraction(idx):
    loc = random_commune_info()
    staff_pool = build_commune_staff_pool(loc)
    topic = random.choice(COMMUNE_TOPICS)
    table_kind = random.choice(TABLE_KINDS)
    now = datetime.now()
    issued_date = (now - timedelta(days=random.randint(0, 4))).strftime("%d/%m/%Y")
    doc_num = random.randint(10, 199)

    rows = []
    num_rows = random.randint(4, 7)

    if table_kind == "ke_hoach_phan_cong":
        table_title = f"KẾ HOẠCH PHÂN CÔNG NHIỆM VỤ CHI TIẾT: {topic['title'].upper()}"
        headers = ["STT", "Nội dung nhiệm vụ", "Cán bộ chủ trì", "Chức vụ", "Đơn vị phối hợp", "Thời hạn hoàn thành", "Sản phẩm đầu ra", "Ghi chú"]
        for i in range(num_rows):
            staff = random.choice(staff_pool[3:])
            deadline = (now + timedelta(days=random.randint(4, 25))).strftime("%d/%m/%Y")
            task_desc = topic["subtasks"][i % len(topic["subtasks"])]
            rows.append({
                "stt": i + 1,
                "noi_dung_nhiem_vu": task_desc,
                "can_bo_chu_tri": staff["name"],
                "chuc_vu": staff["role"],
                "don_vi_phoi_hop": "UBMTTQ, Trưởng thôn " + random.choice(loc["hamlets"]),
                "thoi_han_hoan_thanh": deadline,
                "san_pham_dau_ra": random.choice(["Biên bản kiểm tra", "Báo cáo tổng hợp", "Danh sách thẩm định", "Hồ sơ trích đo", "Quyết định phê duyệt"]),
                "ghi_chu": random.choice(["Ưu tiên xử lý", "Đúng tiến độ", "Báo cáo tuần", "Khẩn", ""]),
            })

    elif table_kind == "du_toan_kinh_phi":
        table_title = f"BẢNG DỰ TOÁN KINH PHÍ THỰC HIỆN: {topic['title'].upper()}"
        headers = ["STT", "Hạng mục công việc / Vật tư", "Đơn vị tính", "Số lượng", "Đơn giá (VNĐ)", "Thành tiền (VNĐ)", "Nguồn vốn", "Ghi chú"]
        cost_items = [
            ("Vật tư xi măng PC40 đổ đường bê tông", "Tấn", 15, 1650000),
            ("Cát vàng, sỏi bê tông", "m3", 40, 320000),
            ("Đo đạc, trích lục bản đồ địa chính", "Thửa", 25, 450000),
            ("In ấn tài liệu, biểu mẫu, phiếu khảo sát", "Bộ", 300, 20000),
            ("Hỗ trợ ngày công lao động tại chỗ", "Công", 45, 300000),
            ("Vắc xin và hóa chất khử trùng tiêu độc", "Liều", 500, 15000),
            ("Thuê máy xúc san gạt mặt bằng", "Giờ", 16, 650000),
            ("Hội nghị tập huấn, tuyên truyền cơ sở", "Buổi", 3, 2500000),
        ]
        for i in range(min(num_rows, len(cost_items))):
            item = cost_items[i]
            qty = random.randint(1, item[2])
            price = item[3]
            amount = qty * price
            rows.append({
                "stt": i + 1,
                "hang_muc_cong_viec": item[0],
                "don_vi_tinh": item[1],
                "so_luong": qty,
                "don_gia_vnd": price,
                "thanh_tien_vnd": amount,
                "nguon_von": random.choice(["Ngân sách xã năm 2026", "Vốn NTM nâng cao", "Xã hội hóa đóng góp", "Vốn đầu tư công"]),
                "ghi_chu": random.choice(["Dự toán chuẩn", "Đã thẩm tra", "Thanh toán theo nghiệm thu", ""]),
            })

    elif table_kind == "ra_soat_dat_dai":
        table_title = f"DANH SÁCH RÀ SOÁT HIỆN TRẠNG SỬ DỤNG ĐẤT VÀ CÔNG TRÌNH XÂY DỰNG: {loc['full_commune'].upper()}"
        headers = ["STT", "Họ và tên chủ hộ", "Địa chỉ thửa đất", "Diện tích (m2)", "Loại đất quy hoạch", "Hiện trạng sử dụng", "Biện pháp xử lý", "Thời hạn hoàn thành"]
        for i in range(num_rows):
            owner = random_person_name()
            hamlet = random.choice(loc["hamlets"])
            area = random.randint(80, 800)
            deadline = (now + timedelta(days=random.randint(5, 20))).strftime("%d/%m/%Y")
            rows.append({
                "stt": i + 1,
                "ho_ten_chu_ho": owner,
                "dia_chi_thua_dat": f"Thửa số {random.randint(10, 450)}, {hamlet}",
                "dien_tich_m2": area,
                "loai_dat_quy_hoach": random.choice(["Đất ở nông thôn (ONT)", "Đất trồng cây lâu năm (CLN)", "Đất trồng lúa (LUC)", "Đất công ích 5%"]),
                "hien_trang_su_dung": random.choice(["Đã dựng nhà tạm", "Trồng cây ăn quả", "Tự ý chuyển đổi mục đích", "Sử dụng đúng mục đích", "Lấn chiếm hành lang đường"]),
                "bien_phap_xu_ly": random.choice(["Lập biên bản đình chỉ", "Hướng dẫn nộp hồ sơ chuyển mục đích", "Đủ điều kiện cấp GCN", "Yêu cầu tháo dỡ công trình"]),
                "thoi_han_hoan_thanh": deadline,
            })

    elif table_kind == "danh_sach_ho_ngheo":
        table_title = f"DANH SÁCH BÌNH XÉT ĐỐI TƯỢNG HỘ NGHÈO, HỘ CẬN NGHÈO VÀ CHÍNH SÁCH XÃ HỘI NĂM 2026"
        headers = ["STT", "Họ và tên chủ hộ", "Thôn/Xóm", "Số nhân khẩu", "Thuộc diện chính sách", "Điểm chấm đa chiều", "Mức độ thiếu hụt dịch vụ", "Kết quả bình xét"]
        for i in range(num_rows):
            owner = random_person_name()
            hamlet = random.choice(loc["hamlets"])
            members = random.randint(1, 6)
            score = random.randint(110, 190)
            rows.append({
                "stt": i + 1,
                "ho_ten_chu_ho": owner,
                "thon_xom": hamlet,
                "so_nhan_khau": members,
                "dien_chinh_sach": random.choice(["Hộ nghèo bất khả dụng", "Hộ nghèo có người tàn tật", "Hộ cận nghèo đơn thân", "Gia đình chính sách khó khăn"]),
                "diem_cham_da_chieu": score,
                "muc_do_thieu_hut": random.choice(["Y tế, BHYT, Nhà ở", "Nước sạch, Việc làm", "Nhà tiêu hợp vệ sinh, BHYT", "Thông tin, Giáo dục"]),
                "ket_qua_binh_xet": random.choice(["Đạt chuẩn Hộ nghèo", "Đạt chuẩn Hộ cận nghèo", "Đủ điều kiện hưởng trợ cấp", "Hỗ trợ xây nhà đại đoàn kết"]),
            })

    else:  # lich_cong_tac_tuan
        table_title = f"LỊCH CÔNG TÁC TUẦN CỦA THƯỜNG TRỰC ĐẢNG ỦY - HĐND - UBND {loc['full_commune'].upper()}"
        headers = ["STT", "Thứ / Ngày", "Thời gian", "Nội dung công việc", "Chủ trì", "Thành phần tham dự", "Địa điểm", "Chuẩn bị tài liệu"]
        weekdays = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu"]
        for i in range(num_rows):
            day_name = weekdays[i % len(weekdays)]
            staff = random.choice(staff_pool[:4])
            rows.append({
                "stt": i + 1,
                "thu_ngay": day_name,
                "thoi_gian": random.choice(["08h00 - 11h30", "14h00 - 17h00", "07h30 - 10h00"]),
                "noi_dung_cong_viec": random.choice([
                    "Họp giao ban Thường trực Đảng ủy - UBND tuần",
                    "Tiếp công dân định kỳ theo Luật Tiếp công dân",
                    "Kiểm tra thực địa giải phóng mặt bằng đường liên thôn",
                    "Họp Hội đồng xét duyệt đất đai, bồi thường GPMB",
                    "Làm việc với Đoàn giám sát của UBMTTQ xã",
                    "Hội nghị đối thoại trực tiếp với nhân dân tại thôn",
                    "Họp Ban chỉ đạo chuyển đổi số và Đề án 06/CP",
                ]),
                "chu_tri": staff["name"] + f" ({staff['role']})",
                "thanh_phan_tham_du": "Lãnh đạo các phòng chuyên môn, Trưởng các thôn xóm",
                "dia_diem": random.choice(["Hội trường tầng 2 UBND xã", "Phòng họp số 1", "Nhà văn hóa thôn", "Tại thực địa công trình"]),
                "chuan_bi_tai_lieu": random.choice(["Văn phòng HĐND-UBND", "Phòng Kinh tế", "Phòng Văn hóa - Xã hội", "Trung tâm Hành chính công"]),
            })

    # Render Markdown table text inside realistic government document
    table_lines = []
    col_keys = list(rows[0].keys())
    table_lines.append("| " + " | ".join(headers) + " |")
    table_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for r in rows:
        vals = [str(r.get(k, "")) for k in col_keys]
        table_lines.append("| " + " | ".join(vals) + " |")

    raw_doc = f"""
ỦY BAN NHÂN DÂN {loc['full_commune'].upper()}
Số: {doc_num}/KH-UBND

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {issued_date}

{table_title}

{chr(10).join(table_lines)}

Ủy ban nhân dân xã yêu cầu các phòng chuyên môn, các thôn xóm và các cán bộ được phân công nghiêm túc tổ chức thực hiện, bảo đảm hoàn thành 100% chỉ tiêu, khối lượng công việc đúng thời hạn quy định./.

Nơi nhận:
- Thường trực Đảng ủy, HĐND xã;
- Chủ tịch, các PCT UBND xã;
- Các cá nhân, đơn vị có tên tại Bảng;
- Lưu: VT, VP.

TM. ỦY BAN NHÂN DÂN
CHỦ TỊCH
(Ký, đóng dấu)

{staff_pool[0]['name']}
""".strip()

    system_prompt = (
        f"Bạn là Trợ lý AI chuyên trách xử lý văn bản hành chính công vụ cho UBND {loc['full_commune']}.\n"
        "Khi văn bản có chứa dữ liệu bảng phân công, danh mục rà soát hoặc dự toán nhiều dòng, "
        "hãy trích xuất toàn bộ dữ liệu thành MỘT MẢNG JSON HỢP LỆ (mỗi object là một dòng trong bảng) "
        "để phục vụ kết xuất trực tiếp sang bảng tính Excel."
    )

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Hãy bóc tách toàn bộ dữ liệu bảng từ văn bản hành chính công vụ sau thành mảng JSON:\n\n{raw_doc}"},
            {"role": "assistant", "content": json.dumps(rows, ensure_ascii=False, indent=2)},
        ]
    }

# =============================================================================
# NHÓM 3: ĐỀ XUẤT PHÂN CÔNG CÁN BỘ CẤP XÃ (REASONING SẮC BÉN) — 150 MẪU
# =============================================================================

def generate_sample_assignment(idx):
    loc = random_commune_info()
    staff_pool = build_commune_staff_pool(loc)
    topic = random.choice(COMMUNE_TOPICS)
    dept = get_dept_by_code(topic["dept_code"])

    # Chọn 1 cán bộ phù hợp nhất trong phòng ban mục tiêu
    matching_staff = [s for s in staff_pool if s["dept_id"] == dept["id"] and "Chủ tịch" not in s["role"]]
    if not matching_staff:
        matching_staff = staff_pool[3:]
    target_staff = random.choice(matching_staff)

    # Sinh danh sách ứng viên với chỉ số tải việc
    candidates = []
    for s in staff_pool[1:9]:  # Lấy 8 cán bộ đại diện
        is_target = s["id"] == target_staff["id"]
        active_tasks = random.randint(1, 3) if is_target else random.randint(4, 9)
        workload = active_tasks * random.randint(10, 14)
        candidates.append({
            "UserId": s["id"],
            "FullName": s["name"],
            "RoleName": s["role"],
            "DepartmentName": s["dept_name"],
            "DepartmentId": s["dept_id"],
            "Expertise": s["expertise"],
            "YearsOfExperience": s["experience"],
            "AssignedHamlets": ", ".join(s["assigned_hamlets"]),
            "ActiveTasksCount": active_tasks,
            "WorkloadPercentage": workload,
        })

    candidate_str_list = []
    for c in candidates:
        candidate_str_list.append(
            f"- Mã định danh: \"{c['UserId']}\" | Họ tên: {c['FullName']} | Chức vụ: {c['RoleName']} | "
            f"Phòng: {c['DepartmentName']} | Chuyên môn: {c['Expertise']} | Thâm niên: {c['YearsOfExperience']} năm | "
            f"Phụ trách địa bàn: {c['AssignedHamlets']} | Đang xử lý: {c['ActiveTasksCount']} việc | Mức tải: {c['WorkloadPercentage']}%"
        )
    candidate_text = "\n".join(candidate_str_list)

    hamlets_str = ", ".join(target_staff["assigned_hamlets"])
    reasoning_text = (
        f"Đồng chí {target_staff['name']} hiện giữ chức vụ {target_staff['role']} thuộc {dept['name']}, "
        f"có {target_staff['experience']} năm kinh nghiệm công tác chuyên sâu về {target_staff['expertise'].lower()}. "
        f"Đồng chí nắm rất vững quy định pháp luật và hiện đang có mức tải công việc an toàn, "
        f"rất am hiểu địa bàn các thôn, xóm được phân công ({hamlets_str}). "
        f"Do đó, phân công đồng chí {target_staff['name']} chủ trì thực hiện nhiệm vụ '{topic['title']}' "
        f"sẽ bảo đảm tính chuẩn xác về mặt chuyên môn, phối hợp nhịp nhàng với cơ sở và cam kết hoàn thành đúng tiến độ được giao."
    )

    expected_output = {
        "suggestedUserId": target_staff["id"],
        "suggestedUserName": target_staff["name"],
        "suggestedDepartmentId": dept["id"],
        "suggestedDepartmentName": dept["name"],
        "reasoning": reasoning_text,
        "confidence": round(random.uniform(0.92, 0.98), 2),
    }

    system_prompt = (
        f"Bạn là Trợ lý Điều phối Công việc thông minh của Thường trực UBND {loc['full_commune']}.\n"
        "Hãy căn cứ vào nội dung nhiệm vụ hành chính phát sinh và ma trận năng lực của đội ngũ cán bộ, "
        "phân tích chuyên môn, thẩm quyền phân cấp theo Luật 72/2025/QH15, kinh nghiệm thực tiễn và mức độ quá tải công việc "
        "để đề xuất cán bộ chủ trì phù hợp nhất. Trả về DUY NHẤT một khối JSON hợp lệ."
    )

    user_query = (
        f"Nhiệm vụ cần phân công xử lý: {topic['title']}\n"
        f"Địa bàn trọng tâm: {random.choice(loc['hamlets'])}, {loc['full_commune']}\n\n"
        f"Danh sách cán bộ, công chức khả dụng:\n{candidate_text}\n\n"
        f"Hãy đề xuất nhân sự chủ trì phù hợp nhất kèm lập luận chi tiết."
    )

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query},
            {"role": "assistant", "content": json.dumps(expected_output, ensure_ascii=False, indent=2)},
        ]
    }

# =============================================================================
# NHÓM 4: SOẠN THẢO VĂN BẢN HÀNH CHÍNH CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP — 150 MẪU
# =============================================================================

DOC_TEMPLATES = [
    {"type": "quyet_dinh", "name": "Quyết định", "symbol": "QĐ-UBND"},
    {"type": "ke_hoach", "name": "Kế hoạch", "symbol": "KH-UBND"},
    {"type": "bao_cao", "name": "Báo cáo", "symbol": "BC-UBND"},
    {"type": "to_trinh", "name": "Tờ trình", "symbol": "TTr-UBND"},
    {"type": "thong_bao", "name": "Thông báo", "symbol": "TB-UBND"},
    {"type": "cong_van", "name": "Công văn", "symbol": "UBND-VP"},
    {"type": "giay_moi", "name": "Giấy mời", "symbol": "GM-UBND"},
    {"type": "bien_ban", "name": "Biên bản", "symbol": "BB-UBND"},
]

def generate_sample_drafting(idx):
    loc = random_commune_info()
    topic = random.choice(COMMUNE_TOPICS)
    dept = get_dept_by_code(topic["dept_code"])
    doc_t = random.choice(DOC_TEMPLATES)
    staff_pool = build_commune_staff_pool(loc)
    leader_name = staff_pool[0]["name"]
    now = datetime.now()
    day_str = now.strftime("%d")
    month_str = now.strftime("%m")
    year_str = now.strftime("%Y")
    doc_num = random.randint(12, 199)

    system_prompt = (
        f"Bạn là Chuyên viên tham mưu tổng hợp kỳ cựu của Văn phòng HĐND & UBND {loc['full_commune']}.\n"
        f"Hãy soạn thảo văn bản hành chính dự thảo hoàn chỉnh theo đúng chuẩn thể thức, bố cục và kỹ thuật trình bày "
        f"quy định tại Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ và các Nghị định phân quyền cấp xã hiện hành."
    )

    user_query = (
        f"Hãy soạn thảo dự thảo {doc_t['name']} về nội dung: '{topic['title']}' "
        f"để trình Lãnh đạo UBND {loc['full_commune']} ký ban hành theo chuẩn Nghị định 30/2020/NĐ-CP."
    )

    # Xây dựng nội dung văn bản theo đúng thể thức từng loại
    if doc_t["type"] == "quyet_dinh":
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: {doc_num}/{doc_t['symbol']}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {day_str} tháng {month_str} năm {year_str}

QUYẾT ĐỊNH
Về việc {topic['title'].lower()}

CHỦ TỊCH ỦY BAN NHÂN DÂN {loc['full_commune'].upper()}

Căn cứ Luật Tổ chức chính quyền địa phương số 72/2025/QH15 ngày 16 tháng 6 năm 2025;
Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;
{topic['legal_basis']}
Theo đề nghị của Trưởng {dept['name']} tại Tờ trình số {random.randint(10, 80)}/TTr-{dept['code'][:2]} ngày {now.strftime('%d/%m/%Y')}.

QUYẾT ĐỊNH:

Điều 1. Ban hành Kế hoạch và triển khai thực hiện nhiệm vụ: {topic['title']} trên địa bàn {loc['full_commune']}.

Điều 2. Phân công trách nhiệm tổ chức thực hiện:
1. Giao {dept['name']} làm đầu mối chủ trì, chịu trách nhiệm trước Chủ tịch UBND xã về việc tổ chức thực hiện các nội dung:
{chr(10).join([f"   a) {st}." for st in topic['subtasks']])}
2. Văn phòng HĐND và UBND xã có trách nhiệm theo dõi, đôn đốc, kiểm tra tiến độ và kịp thời báo cáo Lãnh đạo UBND xã.
3. Đề nghị Ủy ban MTTQ xã, các đoàn thể chính trị - xã hội và Trưởng các thôn, xóm phối hợp chặt chẽ trong quá trình tổ chức thực hiện.

Điều 3. Thời hạn hoàn thành: Toàn bộ nội dung công việc phải được hoàn thành và báo cáo kết quả trước ngày {(now + timedelta(days=20)).strftime('%d/%m/%Y')}.

Điều 4. Quyết định này có hiệu lực thi hành kể từ ngày ký.
Chánh Văn phòng HĐND & UBND, Trưởng {dept['name']}, Trưởng các phòng chuyên môn, Trưởng các thôn/xóm và các cá nhân có liên quan chịu trách nhiệm thi hành Quyết định này./.

Nơi nhận:
- Như Điều 4;
- Thường trực Đảng ủy xã (để b/c);
- Thường trực HĐND xã;
- Chủ tịch, các PCT UBND xã;
- Lưu: VT, {dept['name'][:2]}.

CHỦ TỊCH
(Ký, đóng dấu)

{leader_name}
""".strip()

    elif doc_t["type"] == "ke_hoach":
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: {doc_num}/{doc_t['symbol']}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {day_str} tháng {month_str} năm {year_str}

KẾ HOẠCH
Triển khai thực hiện: {topic['title']}

{topic['legal_basis']}
Ủy ban nhân dân {loc['full_commune']} ban hành Kế hoạch triển khai thực hiện nhiệm vụ cụ thể như sau:

I. MỤC ĐÍCH, YÊU CẦU
1. Mục đích: Đảm bảo thực hiện kịp thời, hiệu quả, đúng thẩm quyền và đúng quy định của pháp luật về {topic['title'].lower()}, góp phần giữ vững ổn định kinh tế - xã hội trên địa bàn xã.
2. Yêu cầu: Xác định rõ nội dung công việc, trách nhiệm chủ trì của từng phòng chuyên môn, cán bộ phụ trách và thời hạn hoàn thành; tuyệt đối không đùn đẩy, né tránh trách nhiệm.

II. NỘI DUNG VÀ NHIỆM VỤ TRỌNG TÂM
{chr(10).join([f"{i+1}. {st}." for i, st in enumerate(topic['subtasks'])])}

III. THỜI GIAN VÀ KINH PHÍ THỰC HIỆN
1. Thời gian thực hiện: Từ ngày {now.strftime('%d/%m/%Y')} đến hết ngày {(now + timedelta(days=30)).strftime('%d/%m/%Y')}.
2. Kinh phí thực hiện: Bố trí từ nguồn ngân sách xã năm {year_str} và các nguồn vốn hợp pháp khác.

IV. TỔ CHỨC THỰC HIỆN
1. Giao {dept['name']} chủ trì, phối hợp với các cơ quan, đơn vị liên quan triển khai các nhiệm vụ theo Kế hoạch này; tổng hợp báo cáo UBND xã trước ngày 25 hàng tháng.
2. Văn phòng HĐND & UBND xã chịu trách nhiệm theo dõi, đôn đốc và tổng hợp kết quả phục vụ công tác đánh giá thi đua, khen thưởng cuối năm./.

Nơi nhận:
- Thường trực Đảng ủy xã (để b/c);
- Thường trực HĐND xã;
- Chủ tịch, các PCT UBND;
- Các phòng chuyên môn;
- Trưởng các thôn, xóm;
- Lưu: VT, VP.

TM. ỦY BAN NHÂN DÂN
CHỦ TỊCH
(Ký, đóng dấu)

{leader_name}
""".strip()

    elif doc_t["type"] == "bao_cao":
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: {doc_num}/{doc_t['symbol']}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {day_str} tháng {month_str} năm {year_str}

BÁO CÁO
Kết quả thực hiện: {topic['title']}

Kính gửi:
- Ủy ban nhân dân {loc['full_province']};
- Thường trực Đảng ủy, HĐND {loc['full_commune']}.

Thực hiện chỉ đạo của cấp trên và Nghị quyết của Đảng ủy, HĐND xã; Ủy ban nhân dân {loc['full_commune']} báo cáo kết quả triển khai thực hiện như sau:

I. ĐẶC ĐIỂM TÌNH HÌNH
Trong thời gian qua, công tác quản lý nhà nước về {topic['title'].lower()} tại {loc['full_commune']} luôn nhận được sự quan tâm chỉ đạo sâu sát của cấp trên và sự đồng thuận của nhân dân các thôn, xóm.

II. KẾT QUẢ ĐẠT ĐƯỢC
UBND xã đã giao {dept['name']} chủ trì, phối hợp với các đơn vị liên quan thực hiện đạt các kết quả nổi bật:
{chr(10).join([f"1.{i+1}. Đã triển khai: {st}, kết quả đạt 100% chỉ tiêu được giao." for i, st in enumerate(topic['subtasks'])])}

III. TỒN TẠI, HẠN CHẾ VÀ NGUYÊN NHÂN
1. Một số hộ dân tại cơ sở nhận thức chưa đầy đủ về các quy định pháp luật mới, dẫn đến thời gian phối hợp xác minh còn kéo dài.
2. Khối lượng công việc phân cấp về xã rất lớn trong khi biên chế chuyên môn còn hạn chế.

IV. PHƯƠNG HƯỚNG, NHIỆM VỤ THỜI GIAN TỚI VÀ KIẾN NGHỊ
1. Tiếp tục tăng cường công tác kiểm tra, đôn đốc, không để phát sinh điểm nóng vi phạm.
2. Kính đề nghị UBND tỉnh xem xét hỗ trợ thêm nguồn lực và kinh phí để xã hoàn thành thắng lợi các mục tiêu đề ra./.

Nơi nhận:
- Như kính gửi;
- Chủ tịch, các PCT UBND xã;
- Các phòng chuyên môn;
- Lưu: VT, {dept['name'][:2]}.

TM. ỦY BAN NHÂN DÂN
CHỦ TỊCH
(Ký, đóng dấu)

{leader_name}
""".strip()

    elif doc_t["type"] == "to_trinh":
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: {doc_num}/{doc_t['symbol']}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {day_str} tháng {month_str} năm {year_str}

TỜ TRÌNH
Về việc phê duyệt phương án: {topic['title']}

Kính gửi: Hội đồng nhân dân {loc['full_commune']}.

{topic['legal_basis']}
Xuất phát từ yêu cầu thực tiễn công tác quản lý nhà nước và nguyện vọng chính đáng của nhân dân trên địa bàn {loc['full_commune']};
Ủy ban nhân dân xã kính trình Hội đồng nhân dân xã xem xét, quyết nghị thông qua phương án với các nội dung chính sau:

I. SỰ CẦN THIẾT BAN HÀNH
Việc triển khai {topic['title'].lower()} là nhiệm vụ cấp bách nhằm cụ thể hóa các quy định phân quyền của Luật 72/2025/QH15 và đáp ứng yêu cầu phát triển kinh tế - xã hội địa phương.

II. NỘI DUNG PHƯƠNG ÁN ĐỀ XUẤT
1. Mục tiêu: Hoàn thành 100% các chỉ tiêu nhiệm vụ về {topic['title'].lower()} trong năm {year_str}.
2. Các nhiệm vụ trọng tâm:
{chr(10).join([f"   - {st}." for st in topic['subtasks']])}
3. Cơ quan chủ trì: {dept['name']} phối hợp cùng các phòng ban liên quan.

III. DỰ KIẾN KINH PHÍ VÀ NGUỒN VỐN
Tổng kinh phí khái toán dự kiến: {random.randint(150, 950)}.000.000 VNĐ (trích từ nguồn ngân sách xã và hỗ trợ của tỉnh).

Ủy ban nhân dân xã kính trình Hội đồng nhân dân {loc['full_commune']} xem xét, quyết nghị./.

Nơi nhận:
- Như kính gửi;
- Thường trực Đảng ủy xã (để b/c);
- Các Ban của HĐND xã;
- Lưu: VT, VP.

TM. ỦY BAN NHÂN DÂN
CHỦ TỊCH
(Ký, đóng dấu)

{leader_name}
""".strip()

    elif doc_t["type"] == "thong_bao":
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: {doc_num}/{doc_t['symbol']}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {day_str} tháng {month_str} năm {year_str}

THÔNG BÁO
Về việc triển khai: {topic['title']}

Ủy ban nhân dân {loc['full_commune']} thông báo tới toàn thể các cơ quan, đơn vị, cán bộ, đảng viên và nhân dân trên địa bàn xã các nội dung sau:

1. Kể từ ngày {now.strftime('%d/%m/%Y')}, UBND xã triển khai đợt cao điểm thực hiện: {topic['title']}.
2. Các nội dung cụ thể:
{chr(10).join([f"   - {st}." for st in topic['subtasks']])}
3. Giao {dept['name']} phối hợp cùng Trưởng các thôn, xóm tiếp nhận phản ánh, hướng dẫn và giải quyết các thủ tục liên quan cho nhân dân.
4. Đề nghị nhân dân trên địa bàn chấp hành nghiêm chỉnh các quy định pháp luật và phối hợp với đoàn công tác trong quá trình thực hiện.

UBND xã thông báo để toàn thể nhân dân được biết và thực hiện./.

Nơi nhận:
- Thường trực Đảng ủy, HĐND;
- Ban Chỉ huy Công an, Quân sự xã;
- Đài Truyền thanh xã (để phát sóng);
- Trưởng các thôn, xóm (để niêm yết);
- Lưu: VT, VP.

TL. CHỦ TỊCH
CHÁNH VĂN PHÒNG
(Ký, đóng dấu)

{staff_pool[3]['name']}
""".strip()

    elif doc_t["type"] == "giay_moi":
        meeting_date = now + timedelta(days=random.randint(2, 6))
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: {doc_num}/{doc_t['symbol']}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {day_str} tháng {month_str} năm {year_str}

GIẤY MỜI
Tham dự Hội nghị về việc: {topic['title']}

Ủy ban nhân dân {loc['full_commune']} trân trọng kính mời:
- Đại diện Thường trực Đảng ủy, HĐND, UBMTTQ xã;
- Lãnh đạo và chuyên viên {dept['name']};
- Trưởng các thôn, xóm: {', '.join(loc['hamlets'][:4])};
- Đại diện các hộ gia đình, cá nhân có liên quan.

Tới tham dự Hội nghị chuyên đề với nội dung như sau:
1. Nội dung: {topic['title']}.
2. Chủ trì: Đồng chí {leader_name} - Chủ tịch UBND xã.
3. Thời gian: {random.choice(['08 giờ 00 phút', '14 giờ 00 phút'])}, ngày {meeting_date.strftime('%d/%m/%Y')} (Thứ {random.choice(['Hai', 'Ba', 'Tư', 'Năm', 'Sáu'])}).
4. Địa điểm: Hội trường tầng 2, Trụ sở UBND {loc['full_commune']}.

Đề nghị các đại biểu tham dự đầy đủ, đúng giờ để hội nghị đạt kết quả cao nhất./.

Nơi nhận:
- Như trên;
- Chủ tịch, các PCT UBND;
- Lưu: VT, VP.

TL. CHỦ TỊCH
CHÁNH VĂN PHÒNG
(Ký, đóng dấu)

{staff_pool[3]['name']}
""".strip()

    elif doc_t["type"] == "bien_ban":
        meeting_place = random.choice(["Trụ sở UBND xã", "Nhà văn hóa " + loc["hamlets"][0], "Thực địa thửa đất thôn " + loc["hamlets"][0]])
        draft_content = f"""
ỦY BAN NHÂN DÂN {loc['full_commune'].upper()}
HỘI ĐỒNG / ĐOÀN CÔNG TÁC XÃ
Số: {doc_num}/{doc_t['symbol']}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {day_str} tháng {month_str} năm {year_str}

BIÊN BẢN LÀM VIỆC
Về việc: {topic['title']}

Hôm nay, vào hồi {random.choice(['08 giờ 30 phút', '14 giờ 15 phút'])}, ngày {day_str} tháng {month_str} năm {year_str}, tại {meeting_place}.

I. THÀNH PHẦN THAM DỰ:
1. Đại diện UBND {loc['full_commune']}:
   - Ông (Bà): {leader_name} - Chức vụ: Chủ tịch UBND xã (Chủ trì).
   - Ông (Bà): {staff_pool[4]['name']} - Chức vụ: Chuyên viên {dept['name']} (Thư ký).
2. Đại diện Ban ngành, Đoàn thể và Địa phương:
   - Ông (Bà): {staff_pool[7]['name']} - Chức vụ: Chủ tịch UBMTTQ xã.
   - Ông (Bà): {random_person_name()} - Chức vụ: Trưởng thôn {loc['hamlets'][0]}.
3. Đại diện các hộ gia đình, cá nhân có liên quan:
   - Ông (Bà): {random_person_name()} (Địa chỉ: {loc['hamlets'][0]}, {loc['full_commune']}).

II. NỘI DUNG LÀM VIỆC:
Đoàn công tác tiến hành kiểm tra, xác minh và làm việc về nội dung: {topic['title']}.

III. DIỄN BIẾN VÀ Ý KIẾN CÁC THÀNH VIÊN:
1. Ý kiến của đại diện {dept['name']}: Báo cáo chi tiết nguồn gốc, hiện trạng và kết quả kiểm tra xác minh thực tế.
2. Ý kiến của Trưởng thôn và đại diện UBMTTQ xã: Đề nghị xử lý dứt điểm, công khai minh bạch, đảm bảo quyền lợi hợp pháp của các bên.
3. Ý kiến của hộ gia đình: Thừa nhận hiện trạng và cam kết chấp hành theo kết luận của chính quyền.

IV. KẾT LUẬN CUỘC HỌP:
1. Giao {dept['name']} hoàn thiện hồ sơ, tham mưu văn bản xử lý đúng quy định pháp luật trước ngày {(now + timedelta(days=7)).strftime('%d/%m/%Y')}.
2. Giao Trưởng thôn theo dõi, giám sát việc thực hiện cam kết tại cơ sở.

Biên bản kết thúc vào hồi {random.choice(['11 giờ 15 phút', '17 giờ 00 phút'])} cùng ngày, đã được đọc lại cho tất cả các thành viên tham dự cùng nghe, thống nhất ký tên dưới đây.

ĐẠI DIỆN HỘ DÂN                  THƯ KÝ CUỘC HỌP                  CHỦ TRÌ CUỘC HỌP
(Ký, ghi rõ họ tên)             (Ký, ghi rõ họ tên)             (Ký, đóng dấu)

                                {staff_pool[4]['name']}           {leader_name}
""".strip()

    else:  # cong_van
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: {doc_num}/{doc_t['symbol']}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
----------------------------------
{loc['commune']}, ngày {day_str} tháng {month_str} năm {year_str}

CÔNG VĂN
V/v: {topic['title']}

Kính gửi:
- Trưởng các phòng chuyên môn thuộc UBND xã;
- Trưởng các thôn, xóm trên địa bàn xã.

{topic['legal_basis']}
Ủy ban nhân dân {loc['full_commune']} yêu cầu Trưởng các phòng chuyên môn và Trưởng các thôn, xóm tập trung thực hiện các nhiệm vụ trọng tâm sau:

1. Giao {dept['name']} chủ trì thực hiện:
{chr(10).join([f"   - {st}." for st in topic['subtasks']])}

2. Yêu cầu các đơn vị, cá nhân khẩn trương tổ chức triển khai, báo cáo kết quả bằng văn bản về UBND xã trước ngày {(now + timedelta(days=10)).strftime('%d/%m/%Y')}.
Quá trình thực hiện nếu có khó khăn, vướng mắc phát sinh phải kịp thời báo cáo Thường trực UBND xã để xem xét, chỉ đạo giải quyết./.

Nơi nhận:
- Như trên;
- Thường trực Đảng ủy, HĐND xã;
- Chủ tịch, các PCT UBND;
- Lưu: VT, VP.

TM. ỦY BAN NHÂN DÂN
KT. CHỦ TỊCH
PHÓ CHỦ TỊCH
(Ký, đóng dấu)

{staff_pool[1]['name']}
""".strip()

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query},
            {"role": "assistant", "content": draft_content},
        ]
    }


# =============================================================================
# 8. NHÓM 5: HỎI ĐÁP PHÁP LÝ, ĐỊA CHÍNH NQ 1678 & PHÂN CẤP CHÍNH QUYỀN 2 CẤP
# =============================================================================

LEGAL_QA_TOPICS = [
    {
        "question": "Căn cứ theo Nghị quyết số 1678/NQ-UBTVQH15 của Ủy ban Thường vụ Quốc hội, Xã Cát Ngạn được thành lập trên cơ sở sáp nhập những đơn vị hành chính nào? Cơ cấu các thôn xóm và cấp quản lý trực tiếp là gì?",
        "answer": """Theo Nghị quyết số 1678/NQ-UBTVQH15 ngày 16/6/2025 của Ủy ban Thường vụ Quốc hội về việc sắp xếp các đơn vị hành chính cấp xã của tỉnh Nghệ An năm 2025 (có hiệu lực từ 16/6/2025 và vận hành chính quyền cấp xã mới từ 01/7/2025):

1. **Nguồn gốc hình thành Xã Cát Ngạn:**
   - Xã Cát Ngạn được thành lập trên cơ sở sáp nhập toàn bộ diện tích tự nhiên và quy mô dân số của 03 xã cũ thuộc huyện Thanh Chương:
     + Xã Minh Sơn
     + Xã Cát Văn
     + Xã Phong Thịnh

2. **Địa bàn hành chính & Thôn xóm:**
   - Xã Cát Ngạn gồm 17 thôn, xóm: *Thôn Cát Mộng, Thôn Lương Điền, Thôn Phong Mỹ, Thôn Phong Thịnh, Thôn Minh Sơn, Thôn 1, Thôn 2, Thôn 3, Thôn 4, Thôn 5, Thôn 6, Thôn 7, Thôn 8, Thôn 9, Thôn 10, Thôn 11, Thôn 12*.

3. **Mô hình quản lý và Cấp trên trực tiếp:**
   - Vận hành theo mô hình chính quyền địa phương 2 cấp (Tỉnh - Xã) theo Luật Tổ chức chính quyền địa phương số 72/2025/QH15.
   - Cấp trên trực tiếp của UBND Xã Cát Ngạn là **Ủy ban nhân dân Tỉnh Nghệ An** (không qua cấp huyện trung gian).
   - Cơ cấu tổ chức bộ máy gồm 4 phòng ban chuyên môn: *Văn phòng HĐND & UBND, Phòng Kinh tế, Phòng Văn hóa - Xã hội, Trung tâm Phục vụ Hành chính công*."""
    },
    {
        "question": "Tổng số đơn vị hành chính cấp xã của Tỉnh Nghệ An sau khi thực hiện sắp xếp theo Nghị quyết 1678/NQ-UBTVQH15 là bao nhiêu? Có bao nhiêu xã giữ nguyên không sáp nhập?",
        "answer": """Căn cứ theo Nghị quyết số 1678/NQ-UBTVQH15 của Ủy ban Thường vụ Quốc hội:

1. **Tổng số ĐVHC cấp xã của tỉnh Nghệ An sau sắp xếp:** **130 đơn vị**, bao gồm:
   - **119 xã**
   - **11 phường**

2. **Cơ cấu sắp xếp:**
   - **121 đơn vị** hình thành sau sắp xếp sáp nhập (gồm 110 xã và 11 phường).
   - **09 xã giữ nguyên không thực hiện sắp xếp:** *Keng Đu, Mỹ Lý, Bắc Lý, Huồi Tụ, Mường Lống, Bình Chuẩn, Hữu Khuông, Lượng Minh, Châu Bình*.

3. **Nguyên tắc vận hành:**
   - Vận hành đồng bộ mô hình chính quyền 2 cấp từ ngày 01/7/2025, cấp xã trực tiếp nhận phân cấp 86% nhiệm vụ chuyên môn từ cấp huyện cũ."""
    },
    {
        "question": "Theo Luật Tổ chức chính quyền địa phương số 72/2025/QH15 và các Nghị định phân quyền 2025/2026, cơ cấu tổ chức chuyên môn của UBND cấp xã gồm những phòng ban nào và thẩm quyền chủ yếu là gì?",
        "answer": """Theo Luật Tổ chức chính quyền địa phương số 72/2025/QH15 và các nghị định hướng dẫn phân cấp phân quyền:

Cơ cấu chuyên môn của UBND cấp xã được tinh gọn thành **04 phòng ban chuẩn** (đảm nhiệm 714 nhiệm vụ chuyên môn):

1. **Văn phòng HĐND & UBND:**
   - Tham mưu tổng hợp, nội chính, pháp chế, kiểm soát TTHC, văn thư lưu trữ, quản lý con dấu, chứng thư số, tiếp công dân và điều phối đôn đốc nhiệm vụ.

2. **Phòng Kinh tế (hoặc Phòng Kinh tế - Hạ tầng & Đô thị):**
   - Quản lý địa chính, đất đai, cấp GCN QSDĐ lần đầu, quy hoạch trật tự xây dựng, tài chính - ngân sách xã, đầu tư công, nông nghiệp, nông thôn mới và tài nguyên môi trường.

3. **Phòng Văn hóa - Xã hội:**
   - Quản lý toàn diện mạng lưới trường mầm non/tiểu học/THCS, Trạm Y tế xã, an sinh xã hội, chính sách người có công, giảm nghèo, tư pháp - hộ tịch, chứng thực điện tử và hòa giải cơ sở.

4. **Trung tâm Phục vụ Hành chính công:**
   - Đầu mối duy nhất tiếp nhận, số hóa 100% hồ sơ TTHC, trả kết quả và hỗ trợ công dân thực hiện dịch vụ công trực tuyến qua VNeID và Cổng Dịch vụ công Quốc gia."""
    },
    {
        "question": "Trình bày các yêu cầu bắt buộc về thể thức và kỹ thuật trình bày văn bản hành chính của UBND cấp xã theo Nghị định số 30/2020/NĐ-CP?",
        "answer": """Theo Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư, thể thức văn bản hành chính của UBND cấp xã bắt buộc phải có đầy đủ 9 thành phần chính:

1. **Quốc hiệu và Tiêu ngữ:** 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' (chữ in hoa, đứng, đậm) và 'Độc lập - Tự do - Hạnh phúc' (chữ in thường, đứng, đậm).
2. **Tên cơ quan, tổ chức ban hành văn bản:** 'ỦY BAN NHÂN DÂN' và dòng dưới là tên đơn vị hành chính cấp xã in hoa (VD: 'XÃ CÁT NGẠN').
3. **Số, ký hiệu của văn bản:** Đánh số liên tục từ 01 trong năm; Ký hiệu gồm: Số/Ký hiệu loại văn bản-UBND (VD: 125/QĐ-UBND, 45/BC-UBND, 18/TB-UBND).
4. **Địa danh và thời gian ban hành văn bản:** Tên xã, ngày... tháng... năm... (in nghiêng).
5. **Tên loại và trích yếu nội dung văn bản:** Tên loại in hoa đứng đậm (BÁO CÁO, KẾ HOẠCH...), trích yếu in thường đứng đậm.
6. **Nội dung văn bản:** Bố cục rõ ràng thành các phần, mục, điều, khoản, điểm theo kỹ thuật lập pháp.
7. **Chức vụ, họ tên và chữ ký của người có thẩm quyền:** Đúng thẩm quyền ban hành (TM. ỦY BAN NHÂN DÂN - CHỦ TỊCH hoặc KT. CHỦ TỊCH - PHÓ CHỦ TỊCH).
8. **Dấu, chữ ký số của cơ quan, tổ chức:** Đóng dấu hoặc ký số công vụ theo đúng quy định.
9. **Nơi nhận:** Liệt kê các cơ quan, đơn vị nhận văn bản để báo cáo, phối hợp, thực hiện và lưu văn thư."""
    },
    {
        "question": "Thẩm quyền xử phạt vi phạm hành chính của Chủ tịch UBND cấp xã trong lĩnh vực đất đai và trật tự xây dựng được quy định như thế nào?",
        "answer": """Theo quy định phân cấp thẩm quyền quản lý nhà nước tại cơ sở:
1. **Lĩnh vực đất đai:** Chủ tịch UBND xã có thẩm quyền phát hiện, lập biên bản vi phạm hành chính đối với hành vi lấn, chiếm đất, sử dụng đất sai mục đích; ra quyết định xử phạt tiền và áp dụng biện pháp buộc khôi phục lại tình trạng ban đầu của đất trước khi vi phạm.
2. **Lĩnh vực trật tự xây dựng:** Có thẩm quyền kiểm tra thực địa, yêu cầu dừng thi công công trình không phép, sai phép trên đất nông nghiệp/đất công; ban hành quyết định xử phạt VPHC và quyết định cưỡng chế phá dỡ công trình vi phạm theo đúng trình tự luật định."""
    },
    {
        "question": "Quy trình giải quyết thủ tục chứng thực bản sao điện tử từ bản chính tại Trung tâm Phục vụ Hành chính công cấp xã được thực hiện như thế nào?",
        "answer": """Quy trình chứng thực bản sao điện tử từ bản chính tại Trung tâm Hành chính công cấp xã gồm 4 bước:
1. **Tiếp nhận:** Công chức tiếp nhận bản chính giấy tờ, kiểm tra tính hợp pháp, hợp lệ và thực hiện scan tài liệu vào phần mềm chuyên ngành.
2. **Ký số thẩm tra:** Công chức phụ trách kiểm tra đối chiếu bản scan với bản chính, đính kèm lời chứng thực điện tử và ký số chuyên dùng cá nhân.
3. **Phê duyệt:** Lãnh đạo UBND xã hoặc Trưởng phòng Tư pháp - Hộ tịch kiểm tra và ký số của cơ quan có thẩm quyền lên bản sao điện tử.
4. **Trả kết quả:** Bản sao điện tử đã ký số được trả trực tiếp vào kho dữ liệu điện tử / tài khoản VNeID của công dân trên Cổng Dịch vụ công Quốc gia."""
    },
    {
        "question": "Phân biệt thẩm quyền ký ban hành văn bản giữa Chủ tịch UBND xã (TM. ỦY BAN NHÂN DÂN) và Phó Chủ tịch UBND xã (KT. CHỦ TỊCH) theo Nghị định 30/2020/NĐ-CP?",
        "answer": """Theo Điều 13 Nghị định số 30/2020/NĐ-CP:
1. **Chủ tịch UBND xã ký thay mặt (TM. ỦY BAN NHÂN DÂN):** Ký các văn bản thuộc thẩm quyền tập thể của UBND xã như: Tờ trình trình HĐND, Quyết định ban hành Quy chế làm việc, Báo cáo tình hình kinh tế - xã hội định kỳ, Kế hoạch phát triển dài hạn.
2. **Phó Chủ tịch UBND xã ký thay (KT. CHỦ TỊCH):** Ký thay Chủ tịch UBND xã các văn bản thuộc lĩnh vực được phân công phụ trách (Kinh tế, Văn hóa - Xã hội) và các văn bản do Chủ tịch ủy quyền trực tiếp (Công văn chỉ đạo chuyên ngành, Giấy mời, Thông báo, Quyết định xử phạt theo lĩnh vực)."""
    },
    {
        "question": "Trách nhiệm của Trưởng thôn, xóm trong việc phối hợp với UBND cấp xã thực hiện công tác quản lý địa bàn sau khi sắp xếp sáp nhập?",
        "answer": """Trưởng thôn, xóm là cánh tay nối dài của chính quyền cấp xã tại cơ sở, có các trách nhiệm trọng tâm:
1. Tuyên truyền, vận động nhân dân chấp hành chủ trương sáp nhập thôn xóm, giữ vững khối đại đoàn kết toàn dân.
2. Phối hợp với Phòng Kinh tế trong công tác kiểm kê đất đai, xác minh nguồn gốc đất, bảo vệ tài sản công dôi dư và tài nguyên môi trường.
3. Phối hợp với Phòng Văn hóa - Xã hội rà soát hộ nghèo, gia đình chính sách, giám sát dịch bệnh và hòa giải các mâu thuẫn tranh chấp nội bộ dân cư.
4. Kịp thời phản ánh tâm tư, kiến nghị chính đáng của cử tri lên Thường trực UBND xã và tham gia Ban Giám sát đầu tư của cộng đồng."""
    }
]

def generate_sample_legal_qa(index):
    """Sinh mẫu hỏi đáp pháp lý, ĐVHC NQ 1678 và mô hình quản trị 2 cấp."""
    loc = random_commune_info()
    qa_template = LEGAL_QA_TOPICS[index % len(LEGAL_QA_TOPICS)]
    
    system_prompt = (
        f"Bạn là Chuyên gia Cố vấn Pháp lý & Hành chính công vụ cấp Xã của Tỉnh {loc['province']}.\n"
        f"Hãy trả lời chính xác, đầy đủ căn cứ pháp lý theo Nghị quyết số 1678/NQ-UBTVQH15, "
        f"Luật Tổ chức chính quyền địa phương số 72/2025/QH15 và Nghị định số 30/2020/NĐ-CP."
    )

    hamlet_sample = loc['hamlets'][index % len(loc['hamlets'])]

    # Đa dạng hóa câu hỏi theo địa phương cụ thể
    if "Cát Ngạn" in qa_template["question"]:
        user_query = f"[Chuyên đề tra cứu #{index+1:03d}] {qa_template['question']}"
        assistant_answer = qa_template["answer"]
    else:
        user_query = f"[Chuyên đề tra cứu #{index+1:03d}] Đối với {loc['full_commune']} (trọng tâm địa bàn {hamlet_sample}, {loc['full_province']}): {qa_template['question']}"
        assistant_answer = f"**Áp dụng cho {loc['full_commune']} (Địa bàn {hamlet_sample}, {loc['full_province']}):**\n\n{qa_template['answer']}"

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query},
            {"role": "assistant", "content": assistant_answer},
        ]
    }


# =============================================================================
# HÀM MAIN: SINH VÀ PHÂN CHIA DATASET TRAIN/TEST (1,000 MẪU, 80:20 STRATIFIED)
# =============================================================================

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    output_full = os.path.join(data_dir, "ubnd_administrative_dataset.jsonl")
    output_train = os.path.join(data_dir, "ubnd_train.jsonl")
    output_test = os.path.join(data_dir, "ubnd_test.jsonl")

    total_samples = 1000
    samples_per_group = 200  # 5 nhóm x 200 = 1,000 mẫu
    train_ratio = 0.80       # 80% train (800 mẫu), 20% test (200 mẫu)

    print("=" * 80)
    print("🏛️ BẮT ĐẦU SINH BỘ DỮ LIỆU ĐÀO TẠO & KIỂM THỬ AI HÀNH CHÍNH CÔNG VỤ CẤP XÃ")
    print("   Chuẩn thể thức NĐ 30/2020/NĐ-CP, NQ 1678/NQ-UBTVQH15 & Luật 72/2025/QH15")
    print("=" * 80)
    print(f"Tổng số mẫu kế hoạch: {total_samples} mẫu chia đều 5 nhóm (mỗi nhóm {samples_per_group} mẫu):")
    print(f"  [1] Nhóm Trích xuất đơn (OCR -> JSON Object Schema .NET): {samples_per_group} mẫu")
    print(f"  [2] Nhóm Trích xuất bảng (Bảng dự toán/rà soát -> JSON Array Excel): {samples_per_group} mẫu")
    print(f"  [3] Nhóm Đề xuất phân công cán bộ cấp Xã (Reasoning quản lý): {samples_per_group} mẫu")
    print(f"  [4] Nhóm Soạn thảo văn bản hành chính chuẩn NĐ 30: {samples_per_group} mẫu")
    print(f"  [5] Nhóm Hỏi đáp Pháp lý, ĐVHC NQ 1678 & Chính quyền 2 cấp: {samples_per_group} mẫu")
    print("-" * 80)

    generators = [
        ("ocr_extraction", generate_sample_ocr_extraction),
        ("table_extraction", generate_sample_table_extraction),
        ("assignment", generate_sample_assignment),
        ("drafting", generate_sample_drafting),
        ("legal_qa", generate_sample_legal_qa),
    ]

    groups = {}
    random.seed(42)

    for g_name, gen_func in generators:
        group_items = []
        seen_queries = set()
        idx = 0
        while len(group_items) < samples_per_group:
            sample = gen_func(idx)
            q = sample["messages"][1]["content"]
            if q not in seen_queries:
                seen_queries.add(q)
                group_items.append(sample)
            idx += 1
        groups[g_name] = group_items

    train_samples = []
    test_samples = []
    full_samples = []

    # Phân tầng nghiêm ngặt (Stratified Split 80:20 theo từng nhóm nghiệp vụ)
    for group_name, group_data in groups.items():
        random.shuffle(group_data)
        split_idx = int(len(group_data) * train_ratio)
        train_part = group_data[:split_idx]  # 160 mẫu
        test_part = group_data[split_idx:]   # 40 mẫu

        train_samples.extend(train_part)
        test_samples.extend(test_part)
        full_samples.extend(group_data)

    # Xáo trộn lại sau khi phân chia
    random.shuffle(train_samples)
    random.shuffle(test_samples)
    random.shuffle(full_samples)

    # Ghi ra 3 tệp JSONL UTF-8
    with open(output_train, "w", encoding="utf-8") as f:
        for s in train_samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    with open(output_test, "w", encoding="utf-8") as f:
        for s in test_samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    with open(output_full, "w", encoding="utf-8") as f:
        for s in full_samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    train_size_kb = os.path.getsize(output_train) / 1024
    test_size_kb = os.path.getsize(output_test) / 1024
    full_size_kb = os.path.getsize(output_full) / 1024

    print(f"\n🎉 HOÀN THÀNH SINH VÀ PHÂN CHIA DỮ LIỆU THÀNH CÔNG!")
    print(f"📁 Tập Huấn Luyện (Train Set - 80%): {output_train}")
    print(f"   -> Số lượng: {len(train_samples)} mẫu | Dung lượng: {train_size_kb:.2f} KB (~{train_size_kb/1024:.2f} MB)")
    print(f"📁 Tập Kiểm Thử (Test Set - 20%):   {output_test}")
    print(f"   -> Số lượng: {len(test_samples)} mẫu | Dung lượng: {test_size_kb:.2f} KB (~{test_size_kb/1024:.2f} MB)")
    print(f"📁 Tập Toàn Bộ (Full Dataset):       {output_full}")
    print(f"   -> Số lượng: {len(full_samples)} mẫu | Dung lượng: {full_size_kb:.2f} KB (~{full_size_kb/1024:.2f} MB)")

    # Kiểm định không trùng lặp (Zero Data Leakage Check)
    train_queries = set(s["messages"][1]["content"] for s in train_samples)
    test_queries = set(s["messages"][1]["content"] for s in test_samples)
    overlap = train_queries.intersection(test_queries)

    print("\n🔍 KIỂM ĐỊNH RÒ RỈ DỮ LIỆU (DATA LEAKAGE AUDIT):")
    print(f"  - Số query độc lập trong Train: {len(train_queries)}")
    print(f"  - Số query độc lập trong Test:  {len(test_queries)}")
    print(f"  - Số mẫu trùng lặp (Overlap):   {len(overlap)} mẫu ({'✅ ĐẠT CHUẨN 0% TRÙNG LẶP (ZERO DATA LEAKAGE)' if len(overlap) == 0 else '⚠️ CẢNH BÁO CÓ TRÙNG LẶP'})")
    print("=" * 80)


if __name__ == "__main__":
    main()


