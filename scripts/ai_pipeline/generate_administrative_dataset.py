#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
BỘ SINH DỮ LIỆU ĐÀO TẠO AI HÀNH CHÍNH CÔNG VỤ (UBND CẤP XÃ)
Chuẩn thể thức Nghị định 30/2020/NĐ-CP & Luật Tổ chức chính quyền địa phương
Dành cho Fine-Tuning mô hình Qwen2.5-7B-Instruct qua Unsloth / QLoRA
=============================================================================
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

# Danh sách cơ quan ban hành thực tế cấp Tỉnh / Huyện / Xã
ISSUING_AGENCIES = [
    "UBND Tỉnh Nghệ An",
    "Sở Nội Vụ Tỉnh Nghệ An",
    "Sở Nông Nghiệp & PTNT Tỉnh Nghệ An",
    "Sở Tài Nguyên & Môi Trường Tỉnh Nghệ An",
    "Sở Xây Dựng Tỉnh Nghệ An",
    "UBND Huyện Thanh Chương",
    "Phòng Nội Vụ Huyện Thanh Chương",
    "Phòng Tài Chính - Kế Hoạch Huyện Thanh Chương",
    "Phòng Kinh Tế & Hạ Tầng Huyện Thanh Chương",
    "Phòng Tài Nguyên & Môi Trường Huyện Thanh Chương",
    "Phòng Nông Nghiệp & PTNT Huyện Thanh Chương",
    "Đảng Ủy Xã Cát Ngạn",
    "HĐND Xã Cát Ngạn",
    "UBND Xã Cát Ngạn",
    "Ủy Ban MTTQ Việt Nam Xã Cát Ngạn",
    "Công An Xã Cát Ngạn",
    "Ban Chỉ Huy Quân Sự Xã Cát Ngạn",
]

# Các phòng ban chuyên môn tại UBND Xã Cát Ngạn
DEPARTMENTS = [
    {"id": "10000000-0000-0000-0000-000000000001", "name": "Văn phòng HĐND & UBND", "code": "VAN_PHONG"},
    {"id": "10000000-0000-0000-0000-000000000002", "name": "Phòng Kinh tế - Hạ tầng & Đô thị", "code": "KINH_TE"},
    {"id": "10000000-0000-0000-0000-000000000003", "name": "Phòng Văn hóa - Xã hội", "code": "VAN_HOA_XA_HOI"},
    {"id": "10000000-0000-0000-0000-000000000004", "name": "Trung tâm Phục vụ Hành chính công", "code": "HANH_CHINH_CONG"},
    {"id": "10000000-0000-0000-0000-000000000005", "name": "Khối Đảng - HĐND - UBMTTQ", "code": "KHOI_DANG_DOAN_THE"},
]

# Hồ sơ cán bộ công chức UBND Xã
STAFF_LIST = [
    {
        "id": "a0000000-0000-0000-0000-000000000001",
        "name": "Nguyễn Đình Hùng",
        "role": "Chủ tịch UBND xã",
        "dept": "Văn phòng HĐND & UBND",
        "dept_id": "10000000-0000-0000-0000-000000000001",
        "expertise": "Quản lý nhà nước, Điều hành chung, Quy hoạch phát triển KTXH",
        "experience": 15
    },
    {
        "id": "a0000000-0000-0000-0000-000000000003",
        "name": "Nguyễn Văn Hoàng",
        "role": "Phó Chủ tịch UBND xã (Chánh VP)",
        "dept": "Văn phòng HĐND & UBND",
        "dept_id": "10000000-0000-0000-0000-000000000001",
        "expertise": "Nội chính, Pháp chế, Tổng hợp tham mưu, Cải cách hành chính",
        "experience": 12
    },
    {
        "id": "a0000000-0000-0000-0000-000000000004",
        "name": "Lê Văn Tùng",
        "role": "Trưởng phòng Kinh tế",
        "dept": "Phòng Kinh tế - Hạ tầng & Đô thị",
        "dept_id": "10000000-0000-0000-0000-000000000002",
        "expertise": "Tài chính - Ngân sách, Đầu tư công, Xây dựng cơ bản, Nông thôn mới",
        "experience": 10
    },
    {
        "id": "a0000000-0000-0000-0000-000000000005",
        "name": "Trần Thị Mai",
        "role": "Trưởng phòng Văn hóa - Xã hội",
        "dept": "Phòng Văn hóa - Xã hội",
        "dept_id": "10000000-0000-0000-0000-000000000003",
        "expertise": "Đất đai, Tài nguyên môi trường, Quy hoạch đô thị nông thôn",
        "experience": 8
    },
    {
        "id": "a0000000-0000-0000-0000-000000000006",
        "name": "Nguyễn Văn Nam",
        "role": "Chuyên viên Địa chính",
        "dept": "Phòng Kinh tế - Hạ tầng & Đô thị",
        "dept_id": "10000000-0000-0000-0000-000000000002",
        "expertise": "Địa chính, Trích đo giải phóng mặt bằng, Trật tự xây dựng, Cấp GCN QSDĐ",
        "experience": 4
    },
    {
        "id": "a0000000-0000-0000-0000-000000000007",
        "name": "Hoàng Thị Thu",
        "role": "Chuyên viên Văn thư - Lưu trữ",
        "dept": "Văn phòng HĐND & UBND",
        "dept_id": "10000000-0000-0000-0000-000000000001",
        "expertise": "Văn thư, Lưu trữ, Quản lý văn bản đi đến, Theo dõi đôn đốc nhiệm vụ",
        "experience": 6
    },
    {
        "id": "a0000000-0000-0000-0000-000000000008",
        "name": "Phạm Văn Đức",
        "role": "Chuyên viên Một cửa - CNTT",
        "dept": "Trung tâm Phục vụ Hành chính công",
        "dept_id": "10000000-0000-0000-0000-000000000004",
        "expertise": "Một cửa, CNTT, Dịch vụ công trực tuyến, Số hóa hồ sơ, Chuyển đổi số",
        "experience": 5
    }
]

# Danh mục chủ đề văn bản hành chính thực tế cấp xã
TOPICS = [
    {
        "title": "Kiểm tra hiện trạng sử dụng đất và xử lý vi phạm trật tự xây dựng",
        "dept": "Phòng Kinh tế - Hạ tầng & Đô thị",
        "dept_id": "10000000-0000-0000-0000-000000000002",
        "staff": "Nguyễn Văn Nam",
        "staff_id": "a0000000-0000-0000-0000-000000000006",
        "subtasks": [
            "Lập danh sách các hộ gia đình đang thi công xây dựng trên địa bàn xã",
            "Tổ chức kiểm tra thực địa, đo đạc mốc giới và đối chiếu hồ sơ địa chính",
            "Lập biên bản vi phạm hành chính đối với các trường hợp xây dựng trái phép",
            "Tham mưu ban hành Quyết định xử phạt vi phạm hành chính và báo cáo UBND Xã"
        ]
    },
    {
        "title": "Tổng hợp số liệu giải ngân vốn đầu tư công các công trình nông thôn mới",
        "dept": "Phòng Kinh tế - Hạ tầng & Đô thị",
        "dept_id": "10000000-0000-0000-0000-000000000002",
        "staff": "Lê Văn Tùng",
        "staff_id": "a0000000-0000-0000-0000-000000000004",
        "subtasks": [
            "Thu thập hóa đơn, chứng từ tạm ứng và khối lượng thi công từ các nhà thầu",
            "Đối chiếu số liệu giải ngân với Kho bạc Nhà nước Huyện",
            "Đánh giá tiến độ giải ngân từng hạng mục công trình đường liên thôn",
            "Hoàn thiện Báo cáo giải ngân vốn đầu tư công trình Chủ tịch UBND Xã"
        ]
    },
    {
        "title": "Tổ chức tiêm vắc xin phòng chống dịch bệnh gia súc gia cầm vụ Thu Đông",
        "dept": "Phòng Kinh tế - Hạ tầng & Đô thị",
        "dept_id": "10000000-0000-0000-0000-000000000002",
        "staff": "Lê Văn Tùng",
        "staff_id": "a0000000-0000-0000-0000-000000000004",
        "subtasks": [
            "Thống kê tổng đàn trâu, bò, lợn, gia cầm tại 8 xóm trên địa bàn",
            "Tiếp nhận vật tư, vắc xin và bảo quản theo tiêu chuẩn thú y",
            "Phân công lịch tiêm phòng cụ thể tại các điểm tập trung của từng xóm",
            "Lập danh sách nghiệm thu tỷ lệ tiêm phòng đạt trên 80% tổng đàn"
        ]
    },
    {
        "title": "Rà soát đối tượng chính sách người có công và hộ nghèo phục vụ trợ cấp",
        "dept": "Phòng Văn hóa - Xã hội",
        "dept_id": "10000000-0000-0000-0000-000000000003",
        "staff": "Trần Thị Mai",
        "staff_id": "a0000000-0000-0000-0000-000000000005",
        "subtasks": [
            "Gửi phiếu rà soát thông tin nhân khẩu tới Trưởng các xóm",
            "Tổng hợp danh sách các hộ có hoàn cảnh đặc biệt khó khăn",
            "Tổ chức họp Hội đồng xét duyệt chính sách cấp xã công khai, minh bạch",
            "Niêm yết công khai danh sách tại trụ sở UBND và lập hồ sơ gửi Phòng LĐTBXH"
        ]
    },
    {
        "title": "Đẩy mạnh tỷ lệ tiếp nhận và số hóa hồ sơ thủ tục hành chính trực tuyến toàn trình",
        "dept": "Trung tâm Phục vụ Hành chính công",
        "dept_id": "10000000-0000-0000-0000-000000000004",
        "staff": "Phạm Văn Đức",
        "staff_id": "a0000000-0000-0000-0000-000000000008",
        "subtasks": [
            "Kiểm tra hệ thống máy quét scan tài liệu tại Bộ phận Một cửa",
            "Hướng dẫn công dân đăng ký tài khoản VNeID và nộp hồ sơ trực tuyến",
            "Thực hiện số hóa 100% kết quả giải quyết TTHC vào phần mềm Một cửa",
            "Báo cáo thống kê chỉ số phục vụ người dân và doanh nghiệp hàng tuần"
        ]
    },
    {
        "title": "Chuẩn bị cơ sở vật chất và chương trình Hội nghị đối thoại nhân dân",
        "dept": "Văn phòng HĐND & UBND",
        "dept_id": "10000000-0000-0000-0000-000000000001",
        "staff": "Hoàng Thị Thu",
        "staff_id": "a0000000-0000-0000-0000-000000000007",
        "subtasks": [
            "Soạn thảo Giấy mời và gửi đến đại diện các ban ngành, đoàn thể, xóm trưởng",
            "Tổng hợp các kiến nghị của cử tri gửi UBND Xã trước kỳ đối thoại",
            "Chuẩn bị hội trường, âm thanh, ánh sáng và tài liệu phục vụ hội nghị",
            "Phân công thư ký ghi chép biên bản và tổng hợp kết luận đối thoại"
        ]
    }
]

def generate_sample_ocr_extraction(idx):
    topic = random.choice(TOPICS)
    agency = random.choice(ISSUING_AGENCIES)
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
Cát Ngạn, ngày {issued_date}

VĂN BẢN CHỈ ĐẠO / CÔNG VĂN ĐIỀU HÀNH

V/v: {topic['title']}

Kính gửi: Các Phòng/Ban chuyên môn trực thuộc UBND Xã Cát Ngạn.

Căn cứ quy chế làm việc và yêu cầu nhiệm vụ phát triển kinh tế - xã hội trên địa bàn xã Cát Ngạn;
UBND chỉ đạo và yêu cầu các đơn vị thực hiện nghiêm túc các nội dung sau:
1. Giao {topic['dept']} chủ trì, phối hợp với các cơ quan, đơn vị liên quan triển khai ngay nội dung công việc: {topic['title']}.
2. Yêu cầu báo cáo tiến độ chi tiết và nộp kết quả thực hiện về Văn phòng UBND Xã trước 17h00 ngày {deadline_date}.
3. Thủ trưởng các cơ quan, cán bộ công chức phụ trách chịu trách nhiệm toàn diện trước Chủ tịch UBND Xã nếu để xảy ra chậm trễ.

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
        "summary": f"Văn bản số {doc_num}/{doc_symbol} của {agency} chỉ đạo {topic['dept']} chủ trì triển khai {topic['title']}, nộp báo cáo kết quả trước ngày {deadline_date}.",
        "deadlineDate": f"{deadline_date}T17:00:00Z",
        "suggestedDepartmentId": topic["dept_id"],
        "suggestedDepartmentName": topic["dept"],
        "confidence": round(random.uniform(0.92, 0.99), 2),
        "deadlineSeemsUnreasonable": False,
        "lowConfidence": False,
        "objectives": f"Thực hiện đầy đủ, đúng hạn nội dung chỉ đạo về {topic['title']} theo quy định.",
        "subjects": topic["subtasks"],
        "validationWarnings": []
    }

    system_prompt = (
        "Bạn là Trợ lý AI chuyên trách xử lý văn bản hành chính công vụ cho UBND Xã Cát Ngạn theo chuẩn Nghị định 30/2020/NĐ-CP.\n"
        "Nhiệm vụ của bạn là đọc toàn bộ nội dung văn bản, bóc tách chính xác các trường thông tin và trả về DUY NHẤT một khối JSON hợp lệ."
    )

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Hãy phân tích và bóc tách dữ liệu có cấu trúc từ văn bản hành chính sau:\n\n{raw_document_text}"},
            {"role": "assistant", "content": json.dumps(expected_output, ensure_ascii=False, indent=2)}
        ]
    }

def generate_sample_assignment(idx):
    topic = random.choice(TOPICS)
    
    # Tạo danh sách các ứng viên cán bộ với tải việc ngẫu nhiên
    candidates = []
    for staff in STAFF_LIST:
        is_target = (staff["name"] == topic["staff"])
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
            "WorkloadPercentage": workload
        })

    candidate_text = "\n".join([
        f"- UserId: \"{c['UserId']}\", Họ tên: {c['FullName']}, Chức vụ: {c['RoleName']}, Phòng ban: {c['DepartmentName']}, "
        f"Chuyên môn: {c['Expertise']}, Thâm niên: {c['YearsOfExperience']} năm, Đang xử lý: {c['ActiveTasksCount']} việc, Tải việc: {c['WorkloadPercentage']}%"
        for c in candidates
    ])

    expected_output = {
        "suggestedUserId": topic["staff_id"],
        "suggestedUserName": topic["staff"],
        "suggestedDepartmentId": topic["dept_id"],
        "suggestedDepartmentName": topic["dept"],
        "reasoning": (
            f"Đồng chí {topic['staff']} thuộc {topic['dept']} có chuyên môn sâu về {topic['title']}, "
            f"kinh nghiệm công tác thực tế và hiện đang có khối lượng công việc phù hợp (mức tải an toàn), "
            f"đảm bảo hoàn thành nhiệm vụ đúng tiến độ và chất lượng."
        ),
        "confidence": 0.95
    }

    system_prompt = (
        "Bạn là Trợ lý Điều phối Công việc thông minh cho Lãnh đạo UBND Xã Cát Ngạn.\n"
        "Hãy phân tích nội dung công việc và danh sách cán bộ, đề xuất người phụ trách phù hợp nhất dựa trên chuyên môn, thẩm quyền phân cấp và khối lượng công việc hiện tại. Trả về JSON."
    )

    user_input = f"Nhiệm vụ cần phân công: {topic['title']}\n\nDanh sách cán bộ khả dụng:\n{candidate_text}"

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": json.dumps(expected_output, ensure_ascii=False, indent=2)}
        ]
    }

def generate_sample_drafting(idx):
    topic = random.choice(TOPICS)
    doc_types = ["Tờ trình", "Báo cáo", "Kế hoạch", "Thông báo", "Công văn"]
    doc_type = random.choice(doc_types)
    
    system_prompt = (
        "Bạn là Chuyên viên tham mưu tổng hợp kỳ cựu của Văn phòng UBND Xã Cát Ngạn.\n"
        "Hãy soạn thảo văn bản hành chính dự thảo chuẩn theo Nghị định 30/2020/NĐ-CP về thể thức văn bản hành chính Việt Nam."
    )

    user_prompt = f"Hãy soạn thảo dự thảo {doc_type} về nội dung: {topic['title']} để trình Chủ tịch UBND Xã phê duyệt."

    draft_content = f"""
ỦY BAN NHÂN DÂN
XÃ CÁT NGẠN
Số: .../{doc_type[:2].upper()}-UBND

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
Cát Ngạn, ngày {datetime.now().strftime('%d')} tháng {datetime.now().strftime('%m')} năm {datetime.now().strftime('%Y')}

DỰ THẢO: {doc_type.upper()}
V/v: {topic['title']}

Kính gửi: Chủ tịch Ủy ban nhân dân xã Cát Ngạn.

I. SỰ CẦN THIẾT VÀ CĂN CỨ PHÁP LÝ
1. Căn cứ Luật Tổ chức chính quyền địa phương ngày 19/6/2015; Luật sửa đổi, bổ sung một số điều của Luật Tổ chức Chính phủ và Luật Tổ chức chính quyền địa phương ngày 22/11/2019;
2. Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư;
3. Xuất phát từ tình hình thực tế và yêu cầu nhiệm vụ quản lý nhà nước trên địa bàn xã Cát Ngạn về việc {topic['title']}.

II. NỘI DUNG VÀ BIỆN PHÁP THỰC HIỆN
1. Mục tiêu: Đảm bảo thực hiện nghiêm túc, kịp thời và đúng quy định pháp luật nội dung {topic['title']}.
2. Phân công nhiệm vụ cụ thể:
{chr(10).join([f"   - Đầu việc {i+1}: {st}" for i, st in enumerate(topic['subtasks'])])}
3. Thời gian hoàn thành: Trước ngày {(datetime.now() + timedelta(days=7)).strftime('%d/%m/%Y')}.

III. ĐỀ XUẤT VÀ KIẾN NGHỊ
Kính trình Chủ tịch UBND Xã xem xét, phê duyệt để triển khai thực hiện trên toàn địa bàn.

Nơi nhận:
- Như kính gửi;
- Các ban ngành, xóm liên quan;
- Lưu: VT, {topic['dept']}.
NGƯỜI LẬP DỰ THẢO / THAM MƯU
(Ký, ghi rõ họ tên)
""".strip()

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": draft_content}
        ]
    }

def main():
    os.makedirs("scripts/ai_pipeline/data", exist_ok=True)
    output_file = "scripts/ai_pipeline/data/ubnd_administrative_dataset.jsonl"
    
    total_samples = 300
    samples = []
    
    print(f"Đang sinh {total_samples} mẫu dữ liệu huấn luyện hành chính UBND Xã...")
    for i in range(total_samples):
        r = random.random()
        if r < 0.45:
            samples.append(generate_sample_ocr_extraction(i))
        elif r < 0.75:
            samples.append(generate_sample_assignment(i))
        else:
            samples.append(generate_sample_drafting(i))

    with open(output_file, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print(f"Hoàn tất sinh dữ liệu! Đã lưu {len(samples)} dòng vào: {output_file}")
    print(f"Dung lượng tệp: {os.path.getsize(output_file) / 1024:.2f} KB")

if __name__ == "__main__":
    main()
