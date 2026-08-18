#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
BỘ TIỆN ÍCH BẢO MẬT & ẨN DANH HÓA DỮ LIỆU HUẤN LUYỆN AI (PII MASKING)
Dự án: UBND Xã Cát Ngạn
Tuân thủ: Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân
=============================================================================
Chức năng:
1. Phát hiện và thay thế thông tin định danh cá nhân nhạy cảm:
   - Số CCCD (12 chữ số) / CMND (9 chữ số)
   - Số điện thoại cá nhân (Việt Nam)
   - Số tài khoản ngân hàng
   - Địa chỉ email cá nhân
   - Số giấy chứng nhận quyền sử dụng đất (Sổ đỏ)
2. Kiểm tra (Audit) rò rỉ dữ liệu nhạy cảm trong tập train/test .jsonl trước khi fine-tuning.
=============================================================================
"""

import re
import sys
import json
import argparse
from typing import Dict, Tuple, List

# Fix Windows console UTF-8 encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass



# Regex nhận diện thông tin cá nhân nhạy cảm (PII)
REGEX_PATTERNS = {
    # CCCD Việt Nam: 12 chữ số, mã tỉnh 001-096, không phải là phần đuôi của UUID/GUID
    "CCCD": re.compile(r"(?<![-a-fA-F0-9])\b(0(?:0[1-9]|[1-8]\d|9[0-6])[0-9]\d{8})\b(?![-a-fA-F0-9])"),
    "CMND": re.compile(r"(?<![-a-fA-F0-9])\b([0-3]\d{8})\b(?![-a-fA-F0-9])"),   # 9 chữ số CMND cũ
    "PHONE_VN": re.compile(r"\b((?:0|\+84)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9\d)\d{7})\b"), # Số điện thoại di động VN
    "EMAIL_PERSONAL": re.compile(r"\b[A-Za-z0-9._%+-]+@(?:gmail|yahoo|hotmail|outlook|icloud)\.com\b", re.IGNORECASE),
    "BANK_ACCOUNT": re.compile(r"\b(?:TK|STK|Số tài khoản|Tài khoản số)[:\s]*(\d{8,16})\b", re.IGNORECASE),
    "LAND_CERTIFICATE": re.compile(r"\b(?:GCNQSDĐ|Sổ đỏ|Giấy chứng nhận số)[:\s]*([A-Z0-9]{6,12})\b", re.IGNORECASE)
}


def sanitize_text(text: str) -> Tuple[str, Dict[str, int]]:
    """
    Tự động ẩn danh hóa văn bản, thay thế thông tin nhạy cảm bằng nhãn thay thế an toàn.
    Trả về: (văn_bản_đã_làm_sạch, thống_kê_số_lượng_phát_hiện)
    """
    stats = {key: 0 for key in REGEX_PATTERNS}
    sanitized = text

    # 1. Ẩn danh Email
    def replace_email(match):
        stats["EMAIL_PERSONAL"] += 1
        return "[EMAIL_ĐÃ_ẨN_DANH]"
    sanitized = REGEX_PATTERNS["EMAIL_PERSONAL"].sub(replace_email, sanitized)

    # 2. Ẩn danh Số điện thoại
    def replace_phone(match):
        stats["PHONE_VN"] += 1
        return "[SĐT_ĐÃ_ẨN_DANH]"
    sanitized = REGEX_PATTERNS["PHONE_VN"].sub(replace_phone, sanitized)

    # 3. Ẩn danh CCCD (12 số)
    def replace_cccd(match):
        stats["CCCD"] += 1
        return "[CCCD_ĐÃ_ẨN_DANH]"
    sanitized = REGEX_PATTERNS["CCCD"].sub(replace_cccd, sanitized)

    # 4. Ẩn danh CMND (9 số)
    def replace_cmnd(match):
        stats["CMND"] += 1
        return "[CMND_ĐÃ_ẨN_DANH]"
    sanitized = REGEX_PATTERNS["CMND"].sub(replace_cmnd, sanitized)

    # 5. Ẩn danh Tài khoản ngân hàng
    def replace_bank(match):
        stats["BANK_ACCOUNT"] += 1
        prefix = match.group(1)
        return f"{prefix}: [STK_ĐÃ_ẨN_DANH]"
    sanitized = REGEX_PATTERNS["BANK_ACCOUNT"].sub(replace_bank, sanitized)

    # 6. Ẩn danh Số sổ đỏ
    def replace_land(match):
        stats["LAND_CERTIFICATE"] += 1
        prefix = match.group(1)
        return f"{prefix}: [SỔ_ĐỎ_ĐÃ_ẨN_DANH]"
    sanitized = REGEX_PATTERNS["LAND_CERTIFICATE"].sub(replace_land, sanitized)

    return sanitized, stats


def audit_jsonl_file(file_path: str) -> Dict[str, any]:
    """
    Kiểm tra bảo mật tập dữ liệu JSONL, phát hiện các trường thông tin nhạy cảm còn tồn tại.
    """
    total_samples = 0
    flagged_samples = 0
    total_violations = {key: 0 for key in REGEX_PATTERNS}
    sample_violations: List[Dict] = []

    with open(file_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, start=1):
            if not line.strip():
                continue
            total_samples += 1
            sample = json.loads(line)

            # Ghép toàn bộ nội dung trong conversation
            full_text = " ".join([m.get("content", "") for m in sample.get("messages", [])])

            _, stats = sanitize_text(full_text)
            has_violation = any(count > 0 for count in stats.values())

            if has_violation:
                flagged_samples += 1
                for k, v in stats.items():
                    total_violations[k] += v
                if len(sample_violations) < 5:  # Lưu tối đa 5 ví dụ đầu tiên
                    sample_violations.append({
                        "line": idx,
                        "detected": {k: v for k, v in stats.items() if v > 0}
                    })

    return {
        "file_path": file_path,
        "total_samples": total_samples,
        "flagged_samples": flagged_samples,
        "is_clean": flagged_samples == 0,
        "violations_summary": total_violations,
        "sample_violations": sample_violations
    }


def sanitize_jsonl_file(input_path: str, output_path: str) -> Dict[str, any]:
    """
    Đọc tệp JSONL nguồn, tự động ẩn danh hóa toàn bộ nội dung và xuất sang tệp đích an toàn.
    """
    total_processed = 0
    total_sanitized = 0
    aggregate_stats = {key: 0 for key in REGEX_PATTERNS}

    with open(input_path, "r", encoding="utf-8") as fin, \
         open(output_path, "w", encoding="utf-8") as fout:

        for line in fin:
            if not line.strip():
                continue
            total_processed += 1
            data = json.loads(line)

            modified = False
            for message in data.get("messages", []):
                cleaned_content, stats = sanitize_text(message.get("content", ""))
                if any(v > 0 for v in stats.values()):
                    modified = True
                    message["content"] = cleaned_content
                    for k, v in stats.items():
                        aggregate_stats[k] += v

            if modified:
                total_sanitized += 1

            fout.write(json.dumps(data, ensure_ascii=False) + "\n")

    return {
        "input_file": input_path,
        "output_file": output_path,
        "total_samples": total_processed,
        "sanitized_samples": total_sanitized,
        "stats": aggregate_stats
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bộ công cụ bảo mật & ẩn danh hóa dữ liệu AI (PII Masking)")
    parser.add_argument("--audit", type=str, help="Đường dẫn file .jsonl cần kiểm tra an toàn dữ liệu")
    parser.add_argument("--sanitize", nargs=2, metavar=("INPUT", "OUTPUT"), help="Ẩn danh hóa file INPUT sang file OUTPUT")

    args = parser.parse_args()

    if args.audit:
        print("=" * 70)
        print(f"🔍 ĐANG KIỂM TRA BẢO MẬT DỮ LIỆU: {args.audit}")
        print("=" * 70)
        result = audit_jsonl_file(args.audit)
        print(f"Tổng số mẫu: {result['total_samples']}")
        print(f"Mẫu phát hiện PII nhạy cảm: {result['flagged_samples']}")
        print("Chi tiết vi phạm:", json.dumps(result['violations_summary'], indent=2, ensure_ascii=False))
        if result['is_clean']:
            print("\n✅ TẬP DỮ LIỆU AN TOÀN — Không phát hiện dữ liệu cá nhân nhạy cảm!")
        else:
            print("\n⚠️ CẢNH BÁO: Cần ẩn danh hóa trước khi đưa vào huấn luyện mô hình!")
        print("=" * 70)

    elif args.sanitize:
        inp, out = args.sanitize
        print("=" * 70)
        print(f"🛡️ ĐANG TIẾN HÀNH ẨN DANH HÓA: {inp} ➔ {out}")
        print("=" * 70)
        res = sanitize_jsonl_file(inp, out)
        print(f"Đã xử lý {res['total_samples']} mẫu (trong đó {res['sanitized_samples']} mẫu được làm sạch).")
        print("Thống kê ẩn danh:", json.dumps(res['stats'], indent=2, ensure_ascii=False))
        print("=" * 70)
    else:
        # Tự động chạy audit trên các dataset hiện có
        print("🛡️ Đang kiểm tra an toàn các tập dữ liệu hiện tại...")
        for ds in [
            "scripts/ai_pipeline/data/ubnd_train.jsonl",
            "scripts/ai_pipeline/data/ubnd_test.jsonl",
            "scripts/ai_pipeline/data/ubnd_administrative_dataset.jsonl"
        ]:
            try:
                res = audit_jsonl_file(ds)
                status = "✅ AN TOÀN" if res["is_clean"] else "⚠️ CẦN ẨN DANH"
                print(f" - {ds}: {status} ({res['total_samples']} mẫu, {res['flagged_samples']} vi phạm)")
            except FileNotFoundError:
                pass
