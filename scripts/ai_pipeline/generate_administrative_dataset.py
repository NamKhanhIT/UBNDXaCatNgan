#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
BỘ SINH DỮ LIỆU ĐÀO TẠO AI HÀNH CHÍNH CÔNG VỤ (UBND CẤP XÃ — TỔNG QUÁT)
Chuẩn thể thức Nghị định 30/2020/NĐ-CP & Luật Tổ chức chính quyền địa phương
Dành cho Fine-Tuning mô hình Qwen3-14B-Instruct qua Unsloth / QLoRA
=============================================================================

PHIÊN BẢN 2.0 — THAY ĐỔI SO VỚI BẢN CŨ:
- Tổng quát hóa: Nhiều tỉnh/huyện/xã khác nhau thay vì gắn cứng Cát Ngạn
- 4 nhóm mẫu (thay vì 3): trích xuất đơn, trích xuất bảng, đề xuất phân công, soạn thảo
- Tổng 600 mẫu (thay vì 300), mỗi nhóm 150 mẫu
- Nhóm trích xuất bảng: output là mảng JSON (phục vụ xuất Excel)
- Nhóm soạn thảo: mở rộng thêm Quyết định, Biên bản, Giấy mời
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
# DỮ LIỆU TỔNG QUÁT HÓA — ĐỊA DANH TOÀN QUỐC
# =============================================================================

# 10 tỉnh/thành phố đại diện các vùng miền
PROVINCES = [
    {"name": "Nghệ An", "districts": [
        {"name": "Thanh Chương", "communes": ["Cát Ngạn", "Thanh Lĩnh", "Đồng Văn", "Hạnh Lâm"]},
        {"name": "Nam Đàn", "communes": ["Kim Liên", "Nam Anh", "Xuân Hòa"]},
        {"name": "Đô Lương", "communes": ["Đà Sơn", "Lam Sơn", "Thượng Sơn"]},
    ]},
    {"name": "Hà Tĩnh", "districts": [
        {"name": "Can Lộc", "communes": ["Thiên Lộc", "Thuần Thiện", "Phú Lộc"]},
        {"name": "Đức Thọ", "communes": ["Tùng Ảnh", "Trường Sơn", "Đức Lạc"]},
    ]},
    {"name": "Thanh Hóa", "districts": [
        {"name": "Thọ Xuân", "communes": ["Xuân Hưng", "Thọ Hải", "Xuân Phú"]},
        {"name": "Yên Định", "communes": ["Yên Phong", "Định Tân", "Yên Lạc"]},
    ]},
    {"name": "Quảng Bình", "districts": [
        {"name": "Bố Trạch", "communes": ["Phúc Trạch", "Sơn Trạch", "Hưng Trạch"]},
    ]},
    {"name": "Thừa Thiên Huế", "districts": [
        {"name": "Phú Vang", "communes": ["Phú Đa", "Phú Mỹ", "Vinh Thanh"]},
        {"name": "Hương Trà", "communes": ["Hương Toàn", "Hương Vinh", "Hải Dương"]},
    ]},
    {"name": "Bắc Giang", "districts": [
        {"name": "Lục Ngạn", "communes": ["Quý Sơn", "Thanh Hải", "Biên Sơn"]},
        {"name": "Yên Thế", "communes": ["Bố Hạ", "Đồng Tiến", "Canh Nậu"]},
    ]},
    {"name": "Thái Nguyên", "districts": [
        {"name": "Đại Từ", "communes": ["An Khánh", "Cù Vân", "Hà Thượng"]},
    ]},
    {"name": "Bình Định", "districts": [
        {"name": "Tuy Phước", "communes": ["Phước Hòa", "Phước Thắng", "Phước An"]},
        {"name": "An Nhơn", "communes": ["Nhơn Hạnh", "Nhơn Mỹ", "Nhơn Phong"]},
    ]},
    {"name": "Đồng Tháp", "districts": [
        {"name": "Tháp Mười", "communes": ["Mỹ Quý", "Hưng Thạnh", "Tân Kiều"]},
        {"name": "Thanh Bình", "communes": ["An Phong", "Tân Mỹ", "Bình Thành"]},
    ]},
    {"name": "An Giang", "districts": [
        {"name": "Châu Phú", "communes": ["Bình Long", "Bình Mỹ", "Đào Hữu Cảnh"]},
    ]},
]


def random_location():
    """Sinh ngẫu nhiên bộ (tỉnh, huyện, xã) từ danh sách tổng quát."""
    province = random.choice(PROVINCES)
    district = random.choice(province["districts"])
    commune = random.choice(district["communes"])
    return {
        "province": province["name"],
        "district": district["name"],
        "commune": commune,
        "full_commune": f"Xã {commune}",
        "full_district": f"Huyện {district['name']}",
        "full_province": f"Tỉnh {province['name']}",
    }


# Cơ quan ban hành cấp trên (sinh động theo địa phương)
def issuing_agencies(loc):
    return [
        f"UBND {loc['full_province']}",
        f"Sở Nội Vụ {loc['full_province']}",
        f"Sở Nông Nghiệp & PTNT {loc['full_province']}",
        f"Sở Tài Nguyên & Môi Trường {loc['full_province']}",
        f"Sở Xây Dựng {loc['full_province']}",
        f"UBND {loc['full_district']}",
        f"Phòng Nội Vụ {loc['full_district']}",
        f"Phòng Tài Chính - Kế Hoạch {loc['full_district']}",
        f"Phòng Kinh Tế & Hạ Tầng {loc['full_district']}",
        f"Phòng Tài Nguyên & Môi Trường {loc['full_district']}",
        f"Đảng Ủy {loc['full_commune']}",
        f"HĐND {loc['full_commune']}",
        f"UBND {loc['full_commune']}",
        f"Ủy Ban MTTQ Việt Nam {loc['full_commune']}",
        f"Công An {loc['full_commune']}",
    ]


# Các phòng ban chuyên môn cấp Xã (cấu trúc 5 khối chuẩn)
DEPARTMENTS = [
    {"id": "10000000-0000-0000-0000-000000000001", "name": "Văn phòng HĐND & UBND", "code": "VAN_PHONG"},
    {"id": "10000000-0000-0000-0000-000000000002", "name": "Phòng Kinh tế - Hạ tầng & Đô thị", "code": "KINH_TE"},
    {"id": "10000000-0000-0000-0000-000000000003", "name": "Phòng Văn hóa - Xã hội", "code": "VAN_HOA_XA_HOI"},
    {"id": "10000000-0000-0000-0000-000000000004", "name": "Trung tâm Phục vụ Hành chính công", "code": "HANH_CHINH_CONG"},
    {"id": "10000000-0000-0000-0000-000000000005", "name": "Khối Đảng - HĐND - UBMTTQ", "code": "KHOI_DANG_DOAN_THE"},
]

# Ngân hàng tên cán bộ để sinh ngẫu nhiên
FIRST_NAMES_MALE = ["Hùng", "Hoàng", "Tùng", "Nam", "Đức", "Minh", "Tuấn", "Phong", "Thành", "Long", "Quang", "Hải"]
FIRST_NAMES_FEMALE = ["Mai", "Thu", "Hương", "Loan", "Ngọc", "Thúy", "Hà", "Lan", "Oanh", "Phương", "Linh", "Trang"]
LAST_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ", "Võ"]
MIDDLE_NAMES = ["Văn", "Thị", "Đình", "Ngọc", "Quốc", "Minh", "Hữu", "Thanh", "Xuân", "Kim"]


def random_staff_name():
    """Sinh tên cán bộ ngẫu nhiên."""
    last = random.choice(LAST_NAMES)
    middle = random.choice(MIDDLE_NAMES)
    is_female = middle == "Thị" or random.random() < 0.35
    first = random.choice(FIRST_NAMES_FEMALE if is_female else FIRST_NAMES_MALE)
    return f"{last} {middle} {first}"


# Danh sách chức danh cán bộ cấp xã
ROLES_BY_DEPT = {
    "10000000-0000-0000-0000-000000000001": [
        ("Chánh Văn phòng", "Nội chính, Pháp chế, Tổng hợp tham mưu, Cải cách hành chính"),
        ("Chuyên viên Văn thư - Lưu trữ", "Văn thư, Lưu trữ, Quản lý văn bản đi đến, Theo dõi đôn đốc nhiệm vụ"),
        ("Chuyên viên Tổng hợp", "Tham mưu tổng hợp, Theo dõi lịch công tác, Biên bản họp"),
    ],
    "10000000-0000-0000-0000-000000000002": [
        ("Trưởng phòng Kinh tế", "Tài chính - Ngân sách, Đầu tư công, Xây dựng cơ bản, Nông thôn mới"),
        ("Chuyên viên Địa chính", "Địa chính, Trích đo giải phóng mặt bằng, Trật tự xây dựng, Cấp GCN QSDĐ"),
        ("Chuyên viên Nông nghiệp", "Trồng trọt, Chăn nuôi, Thú y, Phòng chống thiên tai"),
    ],
    "10000000-0000-0000-0000-000000000003": [
        ("Trưởng phòng Văn hóa - Xã hội", "Văn hóa, Thể thao, Y tế, Giáo dục, An sinh xã hội"),
        ("Chuyên viên Chính sách xã hội", "Chính sách người có công, Hộ nghèo, Bảo trợ xã hội, BHXH"),
        ("Chuyên viên Tư pháp - Hộ tịch", "Tư pháp, Hộ tịch, Chứng thực, Phổ biến pháp luật"),
    ],
    "10000000-0000-0000-0000-000000000004": [
        ("Chuyên viên Một cửa - CNTT", "Một cửa, CNTT, Dịch vụ công trực tuyến, Số hóa hồ sơ, Chuyển đổi số"),
        ("Chuyên viên Tiếp nhận hồ sơ", "Tiếp nhận, Trả kết quả TTHC, Hướng dẫn thủ tục hành chính"),
    ],
    "10000000-0000-0000-0000-000000000005": [
        ("Chuyên viên Đảng vụ", "Công tác Đảng, Tổ chức cơ sở đảng, Phát triển đảng viên"),
        ("Chuyên viên UBMTTQ", "Giám sát phản biện xã hội, Vận động quần chúng, Đoàn thể"),
    ],
}

LEADERSHIP_ROLES = [
    ("Chủ tịch UBND xã", "Văn phòng HĐND & UBND", "10000000-0000-0000-0000-000000000001",
     "Quản lý nhà nước, Điều hành chung, Quy hoạch phát triển KTXH", 15),
    ("Phó Chủ tịch UBND xã", "Văn phòng HĐND & UBND", "10000000-0000-0000-0000-000000000001",
     "Nội chính, Kinh tế, Hạ tầng, Tài nguyên Môi trường", 12),
]


def generate_staff_list(loc):
    """Sinh danh sách cán bộ ngẫu nhiên cho một địa phương."""
    staff = []
    # Lãnh đạo
    for role, dept, dept_id, expertise, exp in LEADERSHIP_ROLES:
        staff.append({
            "id": f"a{random.randint(1000, 9999):04d}-0000-0000-0000-{random.randint(100000000000, 999999999999)}",
            "name": random_staff_name(),
            "role": role,
            "dept": dept,
            "dept_id": dept_id,
            "expertise": expertise,
            "experience": exp,
        })
    # Chuyên viên từ các phòng ban
    for dept_id, roles in ROLES_BY_DEPT.items():
        dept_name = next(d["name"] for d in DEPARTMENTS if d["id"] == dept_id)
        for role_name, expertise in roles:
            staff.append({
                "id": f"a{random.randint(1000, 9999):04d}-0000-0000-0000-{random.randint(100000000000, 999999999999)}",
                "name": random_staff_name(),
                "role": role_name,
                "dept": dept_name,
                "dept_id": dept_id,
                "expertise": expertise,
                "experience": random.randint(2, 12),
            })
    return staff


# Danh mục chủ đề văn bản hành chính thực tế cấp xã (đa dạng hơn)
TOPICS = [
    {
        "title": "Kiểm tra hiện trạng sử dụng đất và xử lý vi phạm trật tự xây dựng",
        "dept_code": "KINH_TE",
        "subtasks": [
            "Lập danh sách các hộ gia đình đang thi công xây dựng trên địa bàn",
            "Tổ chức kiểm tra thực địa, đo đạc mốc giới và đối chiếu hồ sơ địa chính",
            "Lập biên bản vi phạm hành chính đối với các trường hợp xây dựng trái phép",
            "Tham mưu ban hành Quyết định xử phạt vi phạm hành chính và báo cáo lãnh đạo",
        ],
    },
    {
        "title": "Tổng hợp số liệu giải ngân vốn đầu tư công các công trình nông thôn mới",
        "dept_code": "KINH_TE",
        "subtasks": [
            "Thu thập hóa đơn, chứng từ tạm ứng và khối lượng thi công từ các nhà thầu",
            "Đối chiếu số liệu giải ngân với Kho bạc Nhà nước huyện",
            "Đánh giá tiến độ giải ngân từng hạng mục công trình đường liên thôn",
            "Hoàn thiện Báo cáo giải ngân vốn đầu tư công trình Chủ tịch UBND",
        ],
    },
    {
        "title": "Tổ chức tiêm vắc xin phòng chống dịch bệnh gia súc gia cầm vụ Thu Đông",
        "dept_code": "KINH_TE",
        "subtasks": [
            "Thống kê tổng đàn trâu, bò, lợn, gia cầm trên địa bàn",
            "Tiếp nhận vật tư, vắc xin và bảo quản theo tiêu chuẩn thú y",
            "Phân công lịch tiêm phòng cụ thể tại các điểm tập trung từng thôn/xóm",
            "Lập danh sách nghiệm thu tỷ lệ tiêm phòng đạt trên 80% tổng đàn",
        ],
    },
    {
        "title": "Rà soát đối tượng chính sách người có công và hộ nghèo phục vụ trợ cấp",
        "dept_code": "VAN_HOA_XA_HOI",
        "subtasks": [
            "Gửi phiếu rà soát thông tin nhân khẩu tới Trưởng các thôn/xóm",
            "Tổng hợp danh sách các hộ có hoàn cảnh đặc biệt khó khăn",
            "Tổ chức họp Hội đồng xét duyệt chính sách cấp xã công khai, minh bạch",
            "Niêm yết công khai danh sách tại trụ sở UBND và lập hồ sơ gửi Phòng LĐTBXH",
        ],
    },
    {
        "title": "Đẩy mạnh tỷ lệ tiếp nhận và số hóa hồ sơ thủ tục hành chính trực tuyến toàn trình",
        "dept_code": "HANH_CHINH_CONG",
        "subtasks": [
            "Kiểm tra hệ thống máy quét scan tài liệu tại Bộ phận Một cửa",
            "Hướng dẫn công dân đăng ký tài khoản VNeID và nộp hồ sơ trực tuyến",
            "Thực hiện số hóa 100% kết quả giải quyết TTHC vào phần mềm Một cửa",
            "Báo cáo thống kê chỉ số phục vụ người dân và doanh nghiệp hàng tuần",
        ],
    },
    {
        "title": "Chuẩn bị cơ sở vật chất và chương trình Hội nghị đối thoại nhân dân",
        "dept_code": "VAN_PHONG",
        "subtasks": [
            "Soạn thảo Giấy mời và gửi đến đại diện các ban ngành, đoàn thể, trưởng thôn/xóm",
            "Tổng hợp các kiến nghị của cử tri gửi UBND trước kỳ đối thoại",
            "Chuẩn bị hội trường, âm thanh, ánh sáng và tài liệu phục vụ hội nghị",
            "Phân công thư ký ghi chép biên bản và tổng hợp kết luận đối thoại",
        ],
    },
    {
        "title": "Triển khai kế hoạch phòng chống lũ lụt và cứu trợ thiên tai mùa mưa bão",
        "dept_code": "VAN_PHONG",
        "subtasks": [
            "Kiểm tra, rà soát các vị trí xung yếu, vùng trũng hay ngập úng trên địa bàn",
            "Chuẩn bị lương thực, nước sạch dự trữ và phương tiện cứu hộ tại trụ sở",
            "Lập danh sách hộ dân cần di dời khẩn cấp khi có cảnh báo thiên tai",
            "Tổ chức tập huấn, diễn tập phương án ứng phó cho lực lượng xung kích",
        ],
    },
    {
        "title": "Xây dựng kế hoạch phát triển kinh tế - xã hội và dự toán ngân sách năm tới",
        "dept_code": "KINH_TE",
        "subtasks": [
            "Tổng hợp số liệu thực hiện các chỉ tiêu kinh tế - xã hội năm hiện tại",
            "Dự báo các nguồn thu ngân sách xã năm tiếp theo",
            "Xây dựng phương án phân bổ chi ngân sách cho từng lĩnh vực",
            "Trình HĐND xã thông qua kế hoạch phát triển và dự toán ngân sách",
        ],
    },
    {
        "title": "Tổ chức Ngày hội Đại đoàn kết toàn dân tộc tại khu dân cư",
        "dept_code": "KHOI_DANG_DOAN_THE",
        "subtasks": [
            "Phối hợp UBMTTQ lập kế hoạch tổ chức, phân công nhiệm vụ cụ thể",
            "Vận động kinh phí xã hội hóa và chuẩn bị quà tặng hộ khó khăn",
            "Bố trí sân khấu, chương trình văn nghệ, trò chơi dân gian",
            "Tổ chức tuyên dương gia đình văn hóa, gương điển hình tiên tiến",
        ],
    },
    {
        "title": "Kiểm tra vệ sinh an toàn thực phẩm tại các cơ sở kinh doanh ăn uống",
        "dept_code": "VAN_HOA_XA_HOI",
        "subtasks": [
            "Thành lập đoàn kiểm tra liên ngành vệ sinh ATTP cấp xã",
            "Kiểm tra giấy phép kinh doanh, giấy khám sức khỏe, sổ ghi chép nguồn gốc nguyên liệu",
            "Lập biên bản kiểm tra đối với từng cơ sở vi phạm",
            "Tham mưu xử lý vi phạm và báo cáo kết quả kiểm tra lên UBND xã",
        ],
    },
]


def get_dept_for_code(code):
    """Tìm phòng ban theo mã code."""
    for d in DEPARTMENTS:
        if d["code"] == code:
            return d
    return DEPARTMENTS[0]


def get_staff_for_dept(staff_list, dept_id):
    """Lấy danh sách cán bộ thuộc phòng ban."""
    return [s for s in staff_list if s["dept_id"] == dept_id]


# =============================================================================
# NHÓM 1: TRÍCH XUẤT ĐƠN (OCR → JSON đơn) — 150 mẫu
# =============================================================================
def generate_sample_ocr_extraction(idx):
    loc = random_location()
    topic = random.choice(TOPICS)
    dept = get_dept_for_code(topic["dept_code"])
    agency = random.choice(issuing_agencies(loc))
    doc_num = random.randint(10, 399)
    doc_symbol = random.choice(["UBND-VP", "UBND-KT", "UBND-NC", "STC-HCSN", "STNMT-QLĐĐ", "SNN-PTNT"])
    days_offset = random.randint(3, 14)
    deadline_date = (datetime.now() + timedelta(days=days_offset)).strftime("%Y-%m-%d")
    issued_date = (datetime.now() - timedelta(days=random.randint(1, 3))).strftime("%d/%m/%Y")

    raw_document_text = f"""
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
{agency.upper()}
Số: {doc_num}/{doc_symbol}
{loc['commune']}, ngày {issued_date}

VĂN BẢN CHỈ ĐẠO / CÔNG VĂN ĐIỀU HÀNH

V/v: {topic['title']}

Kính gửi: Các Phòng/Ban chuyên môn trực thuộc UBND {loc['full_commune']}.

Căn cứ quy chế làm việc và yêu cầu nhiệm vụ phát triển kinh tế - xã hội trên địa bàn {loc['full_commune']};
UBND chỉ đạo và yêu cầu các đơn vị thực hiện nghiêm túc các nội dung sau:
1. Giao {dept['name']} chủ trì, phối hợp với các cơ quan, đơn vị liên quan triển khai ngay nội dung công việc: {topic['title']}.
2. Yêu cầu báo cáo tiến độ chi tiết và nộp kết quả thực hiện về Văn phòng UBND trước 17h00 ngày {deadline_date}.
3. Thủ trưởng các cơ quan, cán bộ công chức phụ trách chịu trách nhiệm toàn diện trước Chủ tịch UBND nếu để xảy ra chậm trễ.

Nơi nhận:
- Như trên;
- Lưu: VT, VP.
TM. ỦY BAN NHÂN DÂN
CHỦ TỊCH / LÃNH ĐẠO CƠ QUAN
(Đã ký & Đóng dấu)
""".strip()

    expected_output = {
        "category": "TaskAssignmentDown",
        "title": f"Chỉ đạo: {topic['title']}",
        "summary": (
            f"Văn bản số {doc_num}/{doc_symbol} của {agency} chỉ đạo {dept['name']} "
            f"chủ trì triển khai {topic['title']}, nộp báo cáo kết quả trước ngày {deadline_date}."
        ),
        "deadlineDate": f"{deadline_date}T17:00:00Z",
        "suggestedDepartmentId": dept["id"],
        "suggestedDepartmentName": dept["name"],
        "confidence": round(random.uniform(0.92, 0.99), 2),
        "deadlineSeemsUnreasonable": False,
        "lowConfidence": False,
        "objectives": f"Thực hiện đầy đủ, đúng hạn nội dung chỉ đạo về {topic['title']} theo quy định.",
        "subjects": topic["subtasks"],
        "validationWarnings": [],
    }

    system_prompt = (
        f"Bạn là Trợ lý AI chuyên trách xử lý văn bản hành chính công vụ cho UBND {loc['full_commune']} "
        f"theo chuẩn Nghị định 30/2020/NĐ-CP.\n"
        "Nhiệm vụ của bạn là đọc toàn bộ nội dung văn bản, bóc tách chính xác các trường thông tin "
        "và trả về DUY NHẤT một khối JSON hợp lệ."
    )

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Hãy phân tích và bóc tách dữ liệu có cấu trúc từ văn bản hành chính sau:\n\n{raw_document_text}"},
            {"role": "assistant", "content": json.dumps(expected_output, ensure_ascii=False, indent=2)},
        ]
    }


# =============================================================================
# NHÓM 2: TRÍCH XUẤT BẢNG (Văn bản có bảng → JSON mảng cho Excel) — 150 mẫu
# =============================================================================
TABLE_TEMPLATES = [
    {
        "type": "ke_hoach_phan_cong",
        "title_prefix": "Kế hoạch phân công thực hiện",
        "columns": ["stt", "noi_dung_cong_viec", "nguoi_phu_trach", "don_vi_phoi_hop", "thoi_han", "ghi_chu"],
    },
    {
        "type": "danh_sach_kiem_tra",
        "title_prefix": "Danh sách cơ sở/hộ dân cần kiểm tra",
        "columns": ["stt", "ten_co_so", "dia_chi", "noi_dung_kiem_tra", "thoi_gian", "ket_qua"],
    },
    {
        "type": "bang_tong_hop_kinh_phi",
        "title_prefix": "Bảng tổng hợp kinh phí dự toán",
        "columns": ["stt", "hang_muc", "don_vi_tinh", "so_luong", "don_gia_vnd", "thanh_tien_vnd", "nguon_von"],
    },
    {
        "type": "lich_cong_tac_tuan",
        "title_prefix": "Lịch công tác tuần của UBND",
        "columns": ["thu", "buoi", "noi_dung", "chu_tri", "thanh_phan", "dia_diem"],
    },
]

WORK_ITEMS = [
    "Kiểm tra hiện trạng đất đai tại thôn/xóm",
    "Rà soát hộ nghèo, cận nghèo năm",
    "Tổ chức họp dân thông báo quy hoạch",
    "Khảo sát tuyến đường liên thôn xuống cấp",
    "Tiếp nhận đơn khiếu nại về đất đai",
    "Cấp giấy chứng nhận quyền sử dụng đất",
    "Tổng hợp số liệu thu ngân sách",
    "Kiểm tra vệ sinh an toàn thực phẩm",
    "Đôn đốc tiến độ xây dựng trường mầm non",
    "Phối hợp tiêm chủng mở rộng cho trẻ em",
    "Xác nhận hồ sơ chính sách người có công",
    "Triển khai chương trình nước sạch nông thôn",
]

COST_ITEMS = [
    ("Vật liệu xây dựng (xi măng, sắt thép)", "tấn", 5, 3500000),
    ("Nhân công lao động phổ thông", "công", 30, 350000),
    ("Chi phí vận chuyển vật tư", "chuyến", 10, 1200000),
    ("Thiết bị đo đạc địa chính", "bộ", 2, 15000000),
    ("In ấn tài liệu, biểu mẫu", "bộ", 200, 25000),
    ("Chi phí tập huấn, hội nghị", "buổi", 3, 5000000),
    ("Mua sắm văn phòng phẩm", "bộ", 50, 120000),
    ("Chi phí điện, nước trụ sở", "tháng", 6, 2500000),
]

WEEKDAYS_VN = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]
SESSIONS = ["Sáng", "Chiều"]
MEETING_CONTENTS = [
    "Họp giao ban Lãnh đạo UBND",
    "Tiếp công dân định kỳ",
    "Họp Ban chỉ đạo Nông thôn mới",
    "Kiểm tra thực địa công trình",
    "Họp Hội đồng xét duyệt chính sách",
    "Đối thoại nhân dân tại thôn",
    "Tập huấn chuyển đổi số",
    "Họp Ban An toàn giao thông",
]


def generate_sample_table_extraction(idx):
    loc = random_location()
    staff_list = generate_staff_list(loc)
    template = random.choice(TABLE_TEMPLATES)
    topic = random.choice(TOPICS)

    doc_num = random.randint(10, 399)
    doc_symbol = random.choice(["KH-UBND", "BC-UBND", "TB-UBND", "LCT-UBND"])
    issued_date = (datetime.now() - timedelta(days=random.randint(0, 5))).strftime("%d/%m/%Y")

    # Sinh dữ liệu bảng theo template
    rows = []
    num_rows = random.randint(4, 8)

    if template["type"] == "ke_hoach_phan_cong":
        for i in range(num_rows):
            staff = random.choice(staff_list)
            deadline = (datetime.now() + timedelta(days=random.randint(3, 21))).strftime("%d/%m/%Y")
            rows.append({
                "stt": i + 1,
                "noi_dung_cong_viec": random.choice(WORK_ITEMS),
                "nguoi_phu_trach": staff["name"],
                "don_vi_phoi_hop": staff["dept"],
                "thoi_han": deadline,
                "ghi_chu": random.choice(["Ưu tiên", "Bình thường", "Khẩn", ""]),
            })
    elif template["type"] == "danh_sach_kiem_tra":
        for i in range(num_rows):
            rows.append({
                "stt": i + 1,
                "ten_co_so": f"Hộ {random_staff_name()} ({random.choice(['thôn', 'xóm'])} {random.randint(1, 12)})",
                "dia_chi": f"Thôn {random.randint(1, 12)}, {loc['full_commune']}",
                "noi_dung_kiem_tra": random.choice(WORK_ITEMS[:6]),
                "thoi_gian": (datetime.now() + timedelta(days=random.randint(1, 10))).strftime("%d/%m/%Y"),
                "ket_qua": random.choice(["Đạt", "Không đạt", "Chưa kiểm tra", "Cần kiểm tra lại"]),
            })
    elif template["type"] == "bang_tong_hop_kinh_phi":
        total = 0
        for i in range(num_rows):
            item = random.choice(COST_ITEMS)
            qty = random.randint(1, item[2])
            price = item[3] + random.randint(-item[3] // 10, item[3] // 10)
            amount = qty * price
            total += amount
            rows.append({
                "stt": i + 1,
                "hang_muc": item[0],
                "don_vi_tinh": item[1],
                "so_luong": qty,
                "don_gia_vnd": price,
                "thanh_tien_vnd": amount,
                "nguon_von": random.choice(["Ngân sách xã", "Ngân sách huyện", "Xã hội hóa", "Vốn đầu tư công"]),
            })
    elif template["type"] == "lich_cong_tac_tuan":
        for i in range(num_rows):
            staff = random.choice(staff_list[:4])
            rows.append({
                "thu": random.choice(WEEKDAYS_VN),
                "buoi": random.choice(SESSIONS),
                "noi_dung": random.choice(MEETING_CONTENTS),
                "chu_tri": staff["name"],
                "thanh_phan": f"{staff['dept']} và các đơn vị liên quan",
                "dia_diem": random.choice(["Hội trường UBND", "Phòng họp A", "Tại thực địa", "Nhà văn hóa thôn"]),
            })

    # Xây dựng nội dung văn bản có bảng
    table_text_lines = []
    if rows:
        headers = template["columns"]
        table_text_lines.append("| " + " | ".join(headers) + " |")
        table_text_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for row in rows:
            table_text_lines.append("| " + " | ".join(str(row.get(h, "")) for h in headers) + " |")

    raw_document_text = f"""
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
UBND {loc['full_commune'].upper()}
Số: {doc_num}/{doc_symbol}
{loc['commune']}, ngày {issued_date}

{template['title_prefix'].upper()}: {topic['title']}

{chr(10).join(table_text_lines)}

Yêu cầu các đơn vị, cá nhân được phân công nghiêm túc thực hiện theo đúng nội dung và thời hạn nêu trên.

TM. ỦY BAN NHÂN DÂN
CHỦ TỊCH
(Đã ký)
""".strip()

    system_prompt = (
        f"Bạn là Trợ lý AI chuyên trách xử lý văn bản hành chính cho UBND {loc['full_commune']}.\n"
        "Khi văn bản có bảng phân công hoặc danh sách nhiều dòng, hãy trích xuất thành MỘT MẢNG JSON "
        "(mỗi phần tử là một dòng trong bảng) để có thể xuất trực tiếp sang Excel."
    )

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Hãy trích xuất dữ liệu bảng từ văn bản hành chính sau thành mảng JSON:\n\n{raw_document_text}"},
            {"role": "assistant", "content": json.dumps(rows, ensure_ascii=False, indent=2)},
        ]
    }


# =============================================================================
# NHÓM 3: ĐỀ XUẤT PHÂN CÔNG CÁN BỘ — 150 mẫu
# =============================================================================
def generate_sample_assignment(idx):
    loc = random_location()
    topic = random.choice(TOPICS)
    dept = get_dept_for_code(topic["dept_code"])
    staff_list = generate_staff_list(loc)

    # Tìm cán bộ phù hợp nhất cho phòng ban của topic
    dept_staff = get_staff_for_dept(staff_list, dept["id"])
    if not dept_staff:
        dept_staff = staff_list[2:]  # fallback
    target_staff = random.choice(dept_staff)

    # Tạo danh sách ứng viên với tải việc ngẫu nhiên
    candidates = []
    for staff in staff_list:
        is_target = staff["id"] == target_staff["id"]
        active_tasks = random.randint(1, 3) if is_target else random.randint(3, 8)
        workload = active_tasks * 10
        candidates.append({
            "UserId": staff["id"],
            "FullName": staff["name"],
            "RoleName": staff["role"],
            "DepartmentName": staff["dept"],
            "DepartmentId": staff["dept_id"],
            "Expertise": staff["expertise"],
            "YearsOfExperience": staff["experience"],
            "ActiveTasksCount": active_tasks,
            "WorkloadPercentage": workload,
        })

    candidate_text = "\n".join([
        f"- UserId: \"{c['UserId']}\", Họ tên: {c['FullName']}, Chức vụ: {c['RoleName']}, "
        f"Phòng ban: {c['DepartmentName']}, Chuyên môn: {c['Expertise']}, "
        f"Thâm niên: {c['YearsOfExperience']} năm, Đang xử lý: {c['ActiveTasksCount']} việc, "
        f"Tải việc: {c['WorkloadPercentage']}%"
        for c in candidates
    ])

    expected_output = {
        "suggestedUserId": target_staff["id"],
        "suggestedUserName": target_staff["name"],
        "suggestedDepartmentId": dept["id"],
        "suggestedDepartmentName": dept["name"],
        "reasoning": (
            f"Đồng chí {target_staff['name']} thuộc {dept['name']} có chuyên môn sâu về "
            f"{target_staff['expertise']}, kinh nghiệm công tác {target_staff['experience']} năm "
            f"và hiện đang có khối lượng công việc phù hợp (mức tải an toàn), "
            f"đảm bảo hoàn thành nhiệm vụ đúng tiến độ và chất lượng."
        ),
        "confidence": round(random.uniform(0.90, 0.98), 2),
    }

    system_prompt = (
        f"Bạn là Trợ lý Điều phối Công việc thông minh cho Lãnh đạo UBND {loc['full_commune']}.\n"
        "Hãy phân tích nội dung công việc và danh sách cán bộ, đề xuất người phụ trách phù hợp nhất "
        "dựa trên chuyên môn, thẩm quyền phân cấp và khối lượng công việc hiện tại. Trả về JSON."
    )

    user_input = f"Nhiệm vụ cần phân công: {topic['title']}\n\nDanh sách cán bộ khả dụng:\n{candidate_text}"

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": json.dumps(expected_output, ensure_ascii=False, indent=2)},
        ]
    }


# =============================================================================
# NHÓM 4: SOẠN THẢO VĂN BẢN HÀNH CHÍNH — 150 mẫu
# =============================================================================
DOC_TYPES = [
    {
        "name": "Tờ trình",
        "prefix": "TTr",
        "template": "to_trinh",
    },
    {
        "name": "Báo cáo",
        "prefix": "BC",
        "template": "bao_cao",
    },
    {
        "name": "Kế hoạch",
        "prefix": "KH",
        "template": "ke_hoach",
    },
    {
        "name": "Thông báo",
        "prefix": "TB",
        "template": "thong_bao",
    },
    {
        "name": "Công văn",
        "prefix": "CV",
        "template": "cong_van",
    },
    {
        "name": "Quyết định",
        "prefix": "QĐ",
        "template": "quyet_dinh",
    },
    {
        "name": "Biên bản",
        "prefix": "BB",
        "template": "bien_ban",
    },
    {
        "name": "Giấy mời",
        "prefix": "GM",
        "template": "giay_moi",
    },
]


def generate_sample_drafting(idx):
    loc = random_location()
    topic = random.choice(TOPICS)
    dept = get_dept_for_code(topic["dept_code"])
    doc_type = random.choice(DOC_TYPES)
    now = datetime.now()

    system_prompt = (
        f"Bạn là Chuyên viên tham mưu tổng hợp kỳ cựu của Văn phòng UBND {loc['full_commune']}.\n"
        "Hãy soạn thảo văn bản hành chính dự thảo chuẩn theo Nghị định 30/2020/NĐ-CP "
        "về thể thức và kỹ thuật trình bày văn bản hành chính Việt Nam."
    )

    user_prompt = (
        f"Hãy soạn thảo dự thảo {doc_type['name']} về nội dung: {topic['title']} "
        f"để trình Chủ tịch UBND {loc['full_commune']} phê duyệt."
    )

    # Sinh nội dung dự thảo phù hợp từng loại văn bản
    if doc_type["template"] == "quyet_dinh":
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: .../{doc_type['prefix']}-UBND

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
{loc['commune']}, ngày {now.strftime('%d')} tháng {now.strftime('%m')} năm {now.strftime('%Y')}

QUYẾT ĐỊNH
V/v: {topic['title']}

CHỦ TỊCH ỦY BAN NHÂN DÂN {loc['full_commune'].upper()}

Căn cứ Luật Tổ chức chính quyền địa phương ngày 19/6/2015;
Căn cứ Luật sửa đổi, bổ sung một số điều của Luật Tổ chức Chính phủ và Luật Tổ chức chính quyền địa phương ngày 22/11/2019;
Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư;
Theo đề nghị của {dept['name']},

QUYẾT ĐỊNH:

Điều 1. Giao {dept['name']} chủ trì thực hiện: {topic['title']}.
Điều 2. Các đầu việc cụ thể:
{chr(10).join([f"   {i+1}. {st}" for i, st in enumerate(topic['subtasks'])])}
Điều 3. Thời hạn hoàn thành: Trước ngày {(now + timedelta(days=14)).strftime('%d/%m/%Y')}.
Điều 4. Quyết định này có hiệu lực kể từ ngày ký. {dept['name']}, Văn phòng UBND và các cơ quan, cá nhân liên quan chịu trách nhiệm thi hành Quyết định này./.

Nơi nhận:
- Như Điều 4;
- Lưu: VT.
CHỦ TỊCH
(Ký, đóng dấu)
""".strip()

    elif doc_type["template"] == "bien_ban":
        draft_content = f"""
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---

BIÊN BẢN
V/v: {topic['title']}

Hôm nay, ngày {now.strftime('%d')} tháng {now.strftime('%m')} năm {now.strftime('%Y')}, tại trụ sở UBND {loc['full_commune']}, {loc['full_district']}, {loc['full_province']}.

I. THÀNH PHẦN THAM DỰ:
1. Chủ trì: Chủ tịch UBND {loc['full_commune']}
2. Thư ký: Chuyên viên Văn phòng UBND
3. Đại diện {dept['name']}
4. Đại diện các ban ngành, đoàn thể liên quan

II. NỘI DUNG:
Cuộc họp/buổi làm việc nhằm mục đích {topic['title']}.

III. Ý KIẾN CÁC THÀNH VIÊN:
- {dept['name']}: Báo cáo tình hình triển khai, những thuận lợi và khó khăn.
- Các đơn vị phối hợp: Đề xuất giải pháp và cam kết thực hiện.

IV. KẾT LUẬN:
1. Thống nhất triển khai các nội dung:
{chr(10).join([f"   - {st}" for st in topic['subtasks']])}
2. Thời hạn hoàn thành: Trước ngày {(now + timedelta(days=10)).strftime('%d/%m/%Y')}.
3. {dept['name']} chịu trách nhiệm theo dõi, đôn đốc tiến độ.

Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.

CHỦ TRÌ                                     THƯ KÝ
(Ký, ghi rõ họ tên)                          (Ký, ghi rõ họ tên)
""".strip()

    elif doc_type["template"] == "giay_moi":
        meeting_date = (now + timedelta(days=random.randint(2, 7)))
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: .../{doc_type['prefix']}-UBND

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
{loc['commune']}, ngày {now.strftime('%d')} tháng {now.strftime('%m')} năm {now.strftime('%Y')}

GIẤY MỜI

Kính gửi: ....................................................

UBND {loc['full_commune']} trân trọng kính mời đại diện Quý cơ quan/đơn vị tham dự cuộc họp:

1. Nội dung: {topic['title']}
2. Chủ trì: Chủ tịch UBND {loc['full_commune']}
3. Thời gian: {random.choice(['08h00', '14h00'])} ngày {meeting_date.strftime('%d/%m/%Y')} ({random.choice(WEEKDAYS_VN)})
4. Địa điểm: Hội trường UBND {loc['full_commune']}, {loc['full_district']}, {loc['full_province']}
5. Thành phần: Lãnh đạo/đại diện {dept['name']} và các đơn vị liên quan

Đề nghị Quý cơ quan/đơn vị cử đại diện tham dự đúng thành phần và thời gian.
Trân trọng kính mời./.

Nơi nhận:
- Như trên;
- Lưu: VT.
TL. CHỦ TỊCH
CHÁNH VĂN PHÒNG
(Ký, đóng dấu)
""".strip()

    else:
        # Tờ trình, Báo cáo, Kế hoạch, Thông báo, Công văn
        draft_content = f"""
ỦY BAN NHÂN DÂN
{loc['full_commune'].upper()}
Số: .../{doc_type['prefix']}-UBND

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
{loc['commune']}, ngày {now.strftime('%d')} tháng {now.strftime('%m')} năm {now.strftime('%Y')}

DỰ THẢO: {doc_type['name'].upper()}
V/v: {topic['title']}

Kính gửi: Chủ tịch Ủy ban nhân dân {loc['full_commune']}.

I. SỰ CẦN THIẾT VÀ CĂN CỨ PHÁP LÝ
1. Căn cứ Luật Tổ chức chính quyền địa phương ngày 19/6/2015; Luật sửa đổi, bổ sung một số điều của Luật Tổ chức Chính phủ và Luật Tổ chức chính quyền địa phương ngày 22/11/2019;
2. Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư;
3. Xuất phát từ tình hình thực tế và yêu cầu nhiệm vụ quản lý nhà nước trên địa bàn {loc['full_commune']} về việc {topic['title']}.

II. NỘI DUNG VÀ BIỆN PHÁP THỰC HIỆN
1. Mục tiêu: Đảm bảo thực hiện nghiêm túc, kịp thời và đúng quy định pháp luật nội dung {topic['title']}.
2. Phân công nhiệm vụ cụ thể:
{chr(10).join([f"   - Đầu việc {i+1}: {st}" for i, st in enumerate(topic['subtasks'])])}
3. Thời gian hoàn thành: Trước ngày {(now + timedelta(days=7)).strftime('%d/%m/%Y')}.

III. ĐỀ XUẤT VÀ KIẾN NGHỊ
Kính trình Chủ tịch UBND {loc['full_commune']} xem xét, phê duyệt để triển khai thực hiện trên toàn địa bàn.

Nơi nhận:
- Như kính gửi;
- Các ban ngành, thôn/xóm liên quan;
- Lưu: VT, {dept['name']}.
NGƯỜI LẬP DỰ THẢO / THAM MƯU
(Ký, ghi rõ họ tên)
""".strip()

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": draft_content},
        ]
    }


# =============================================================================
# SINH DỮ LIỆU CHÍNH
# =============================================================================
def main():
    os.makedirs("scripts/ai_pipeline/data", exist_ok=True)
    output_file = "scripts/ai_pipeline/data/ubnd_administrative_dataset.jsonl"

    total_samples = 600
    samples_per_group = 150
    samples = []

    print(f"Đang sinh {total_samples} mẫu dữ liệu huấn luyện hành chính UBND Cấp Xã (tổng quát hóa)...")
    print(f"  - Nhóm 1 (Trích xuất đơn):     {samples_per_group} mẫu")
    print(f"  - Nhóm 2 (Trích xuất bảng):     {samples_per_group} mẫu")
    print(f"  - Nhóm 3 (Đề xuất phân công):   {samples_per_group} mẫu")
    print(f"  - Nhóm 4 (Soạn thảo văn bản):   {samples_per_group} mẫu")

    for i in range(samples_per_group):
        samples.append(generate_sample_ocr_extraction(i))
    for i in range(samples_per_group):
        samples.append(generate_sample_table_extraction(i))
    for i in range(samples_per_group):
        samples.append(generate_sample_assignment(i))
    for i in range(samples_per_group):
        samples.append(generate_sample_drafting(i))

    # Xáo trộn để các nhóm không bị gom cụm
    random.shuffle(samples)

    with open(output_file, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print(f"\nHoàn tất sinh dữ liệu! Đã lưu {len(samples)} dòng vào: {output_file}")
    print(f"Dung lượng tệp: {os.path.getsize(output_file) / 1024:.2f} KB")

    # Thống kê kiểm tra
    provinces_used = set()
    with open(output_file, "r", encoding="utf-8") as f:
        for line in f:
            data = json.loads(line)
            for msg in data["messages"]:
                for prov in PROVINCES:
                    if prov["name"] in msg["content"]:
                        provinces_used.add(prov["name"])
    print(f"Số tỉnh/thành được sử dụng trong dataset: {len(provinces_used)}")
    print(f"Danh sách tỉnh: {', '.join(sorted(provinces_used))}")


if __name__ == "__main__":
    main()
