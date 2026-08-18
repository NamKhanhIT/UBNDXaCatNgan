#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
SETUP HUGGINGFACE SPACE — Tự động tạo & cấu hình ZeroGPU Space cho UBND Cấp Xã
Idempotent: chạy lại không lỗi nếu Space đã tồn tại.
Model: Qwen/Qwen3-14B (có sẵn trên Hub, không cần upload checkpoint)
=============================================================================
"""

import os
import sys
import time
import json

# Fix Windows console UTF-8 encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def main():
    # =========================================================================
    # BƯỚC 0 — Kiểm tra thư viện & phiên bản
    # =========================================================================
    try:
        import huggingface_hub
        print(f"✅ huggingface_hub phiên bản: {huggingface_hub.__version__}")
    except ImportError:
        print("❌ Chưa cài huggingface_hub. Chạy: pip install -U huggingface_hub")
        sys.exit(1)

    from huggingface_hub import HfApi, login, repo_exists, get_token

    # =========================================================================
    # BƯỚC 1 — Đăng nhập bằng HF_TOKEN từ biến môi trường hoặc cached login
    # =========================================================================
    token = os.environ.get("HF_TOKEN") or get_token()
    if not token:
        print("❌ Chưa tìm thấy HuggingFace token.")
        print("   Vui lòng đặt biến môi trường: $env:HF_TOKEN=\"hf_xxxx...\" (PowerShell)")
        print("   hoặc chạy lệnh:              hf auth login")
        sys.exit(1)

    try:
        login(token=token)
        api = HfApi(token=token)
        user_info = api.whoami()
        username = user_info["name"]
        print(f"✅ Đã đăng nhập HuggingFace: {username}")
    except Exception as e:
        print(f"❌ Lỗi đăng nhập: {e}")
        sys.exit(1)

    # =========================================================================
    # BƯỚC 2 & 3 — Tạo Space & yêu cầu phần cứng ZeroGPU (idempotent)
    # =========================================================================
    space_repo_id = f"{username}/qwen-ubnd-catngan-v2"

    if not repo_exists(space_repo_id, repo_type="space", token=token):
        print(f"🚀 Đang tạo Space {space_repo_id}...")
        try:
            api.create_repo(
                repo_id=space_repo_id,
                repo_type="space",
                space_sdk="gradio",
                private=False,
            )
            print(f"✅ Đã tạo Space mới: {space_repo_id}")
        except Exception as e:
            error_msg = str(e)
            if "402" in error_msg or "payment required" in error_msg.lower() or "pro" in error_msg.lower():
                print("\n" + "!" * 70)
                print("⚠️  KHÔNG THỂ TẠO SPACE TỰ ĐỘNG — YÊU CẦU TỪ HUGGING FACE:")
                print(f"   Chi tiết: {error_msg}")
                print("   Nguyên nhân: Tài khoản chưa đủ 30 ngày hoặc chính sách nền tảng")
                print("   yêu cầu gói PRO ($9/tháng) để cấp phát tài nguyên tính toán (ZeroGPU/CPU).")
                print("   → Vui lòng kiểm tra tài khoản hoặc nâng cấp tại: https://huggingface.co/settings/billing")
                print("   Script dừng tại đây theo đúng chỉ dẫn — không tìm cách vòng qua.")
                print("!" * 70)
                sys.exit(1)
            else:
                raise
    else:
        print(f"ℹ️  Space đã tồn tại: {space_repo_id}")

    # Yêu cầu phần cứng ZeroGPU
    try:
        api.request_space_hardware(repo_id=space_repo_id, hardware="zero-a10g")
        print("✅ Đã yêu cầu phần cứng ZeroGPU (zero-a10g).")
    except Exception as e:
        error_msg = str(e)
        if "not available" in error_msg.lower() or "unauthorized" in error_msg.lower() or "402" in error_msg:
            print(f"⚠️  Không thể yêu cầu ZeroGPU: {error_msg}")
            print("   Nguyên nhân: Tài khoản chưa đủ điều kiện ZeroGPU (cần >=30 ngày hoặc gói PRO).")
            print("   → Kiểm tra tài khoản tại: https://huggingface.co/settings/billing")
            print("   Script dừng tại đây — không tìm cách vòng qua.")
            sys.exit(1)
        else:
            print(f"ℹ️  Ghi nhận phần cứng: {e}")

    # =========================================================================
    # BƯỚC 4 — Xác nhận cấu hình app.py (MODEL_ID default + enable_thinking=False)
    # =========================================================================
    space_dir = os.path.join(os.path.dirname(__file__), "huggingface_space")
    app_py_path = os.path.join(space_dir, "app.py")

    if not os.path.isfile(app_py_path):
        print(f"❌ Không tìm thấy {app_py_path}")
        sys.exit(1)

    with open(app_py_path, "r", encoding="utf-8") as f:
        app_content = f.read()

    # Kiểm tra cấu hình bắt buộc
    checks = {
        "MODEL_ID default = Qwen/Qwen3-14B": 'Qwen/Qwen3-14B' in app_content,
        "enable_thinking=False": 'enable_thinking=False' in app_content,
    }
    for label, ok in checks.items():
        if ok:
            print(f"   ✓ {label}")
        else:
            print(f"   ✗ {label} — CẦN KIỂM TRA LẠI app.py!")
            sys.exit(1)

    print("✅ Bước 4: app.py đã sẵn sàng (Qwen/Qwen3-14B, thinking mode OFF).")

    # =========================================================================
    # BƯỚC 5 — Upload code Space lên HuggingFace
    # =========================================================================
    print(f"\n📤 Đang upload thư mục '{space_dir}' lên Space {space_repo_id}...")
    api.upload_folder(
        repo_id=space_repo_id,
        repo_type="space",
        folder_path=space_dir,
    )
    print("✅ Đã upload code lên Space.")

    # =========================================================================
    # BƯỚC 6 — Set biến môi trường MODEL_ID cho Space (tường minh)
    # =========================================================================
    model_id = "Qwen/Qwen3-14B"
    try:
        api.add_space_variable(
            repo_id=space_repo_id,
            key="MODEL_ID",
            value=model_id,
        )
        print(f"✅ Đã set biến môi trường MODEL_ID = {model_id}")
    except Exception as e:
        print(f"⚠️  Không set được biến qua API ({e}).")
        print(f"   → Bạn có thể vào Space Settings > Variables and secrets, thêm thủ công:")
        print(f"     Key: MODEL_ID   Value: {model_id}")

    # =========================================================================
    # BƯỚC 7 — Đợi Space khởi động, in URL thật
    # =========================================================================
    print(f"\n⏳ Đang đợi Space {space_repo_id} khởi động...")
    print("   (Space cần tải model ~28GB từ Hub lần đầu — có thể mất vài phút)")

    max_wait_minutes = 20
    start_wait = time.time()

    while True:
        elapsed = time.time() - start_wait
        if elapsed > max_wait_minutes * 60:
            print(f"\n⚠️  Đã đợi quá {max_wait_minutes} phút. Space chưa RUNNING.")
            print(f"   → Kiểm tra log tại: https://huggingface.co/spaces/{space_repo_id}?logs=build")
            break

        try:
            runtime = api.get_space_runtime(repo_id=space_repo_id)
            stage = runtime.stage
            minutes = int(elapsed // 60)
            seconds = int(elapsed % 60)
            print(f"   [{minutes:02d}:{seconds:02d}] Trạng thái: {stage}")

            if stage == "RUNNING":
                print(f"\n🎉 Space đã RUNNING thành công!")
                break

            if stage in ("RUNTIME_ERROR", "BUILD_ERROR"):
                print(f"\n❌ Lỗi ở giai đoạn {stage}!")
                print(f"   → Xem log: https://huggingface.co/spaces/{space_repo_id}?logs=build")
                sys.exit(1)

        except Exception as e:
            print(f"   Lỗi khi kiểm tra: {e}")

        time.sleep(30)

    space_url = f"https://{username}-qwen-ubnd-catngan-v2.hf.space"
    print(f"\n📋 URL Space: {space_url}")
    print(f"   → Giao diện Web: https://huggingface.co/spaces/{space_repo_id}")
    print(f"   → Health check:  {space_url}/health")
    print(f"   → API endpoint:  {space_url}/v1/chat/completions")

    # =========================================================================
    # BƯỚC 8 — Cập nhật appsettings.Development.json backend .NET
    # =========================================================================
    appsettings_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "src", "Quanlycongviec.Api",
        "appsettings.Development.json"
    )
    appsettings_path = os.path.normpath(appsettings_path)

    if os.path.isfile(appsettings_path):
        with open(appsettings_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        config["AiProvider"] = {
            "Type": "ApiCompatible",
            "ConfidenceThreshold": 0.6,
            "Api": {
                "BaseUrl": space_url,
                "ApiKey": "",
                "Model": model_id,
                "DataSovereigntyAcknowledged": True,
            }
        }

        with open(appsettings_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Đã cập nhật {appsettings_path}")
        print(f"   AiProvider.Type = ApiCompatible")
        print(f"   AiProvider.Api.BaseUrl = {space_url}")
        print(f"   AiProvider.Api.Model = {model_id}")
    else:
        print(f"\n⚠️  Không tìm thấy {appsettings_path}")

    # =========================================================================
    # TỔNG KẾT
    # =========================================================================
    print("\n" + "=" * 70)
    print("🏛️ THIẾT LẬP HOÀN TẤT — TỔNG KẾT:")
    print(f"   Space:    https://huggingface.co/spaces/{space_repo_id}")
    print(f"   Model:    {model_id} (thinking mode: OFF)")
    print(f"   Hardware: ZeroGPU (zero-a10g)")
    print(f"   API:      {space_url}/v1/chat/completions")
    print(f"   Health:   {space_url}/health")
    print("=" * 70)


if __name__ == "__main__":
    main()
