# Sổ Tay Hướng Dẫn: Tự Host Model Qwen2.5 Cục Bộ & Trên Cloud Miễn Phí

Tài liệu này hướng dẫn chi tiết toàn bộ quy trình triển khai mô hình ngôn ngữ lớn **Qwen2.5** cho hệ thống phần mềm quản lý công việc UBND Xã Cát Ngạn, với **2 phương án** triển khai:

| Phương án | Phần cứng | Chi phí | Ưu điểm |
| :--- | :--- | :--- | :--- |
| **A. Oracle Cloud Free ARM** (Khuyến nghị) | 2 OCPU + 12GB RAM (Cloud) | **$0/tháng** (miễn phí vĩnh viễn) | Chạy 24/7, không cần bật máy cá nhân |
| **B. Máy cá nhân RTX 3050** | 6GB VRAM + 28GB RAM | $0 (đã có sẵn) | Tốc độ nhanh hơn (GPU), nhưng phải bật máy |

---

## MỤC LỤC
1. [Phương Án A: Host Miễn Phí 24/7 Trên Oracle Cloud](#phương-án-a-host-miễn-phí-247-trên-oracle-cloud)
2. [Phương Án B: Chạy Cục Bộ Trên Máy Cá Nhân (RTX 3050)](#phương-án-b-chạy-cục-bộ-trên-máy-cá-nhân-rtx-3050)
3. [Đào Tạo (Fine-Tuning) Trên Google Colab Miễn Phí](#đào-tạo-fine-tuning-trên-google-colab-miễn-phí)
4. [Tùy Biến Dữ Liệu Thực Tế Của Cơ Quan](#tùy-biến-dữ-liệu-thực-tế-của-cơ-quan)
5. [Tích Hợp Vào Hệ Thống Backend .NET](#tích-hợp-vào-hệ-thống-backend-net)

---

## Phương Án A: Host Miễn Phí 24/7 Trên Oracle Cloud

### Kiến Trúc Tổng Quan

```
┌────────────────────────────┐    WireGuard VPN    ┌───────────────────────────┐
│  VPS WEB (.NET Backend)    │◄══════════════════►│  Oracle Cloud Free ARM    │
│  ─ Quanlycongviec.Api      │   Mã hóa đầu cuối  │  ─ Ubuntu 24.04           │
│  ─ PostgreSQL              │   10.0.0.2 ↔ 10.0.0.1│  ─ Ollama Service        │
│  ─ Next.js Frontend        │                     │  ─ Qwen2.5-3B (Q4_K_M)   │
│  ─ IP: 10.0.0.2            │                     │  ─ IP: 10.0.0.1           │
└────────────────────────────┘                     └───────────────────────────┘
```

**Dữ liệu văn bản chỉ truyền qua đường hầm VPN mã hóa, KHÔNG BAO GIỜ đi qua Internet dạng rõ.**

### Bước A.1: Đăng Ký Oracle Cloud Free Tier

1. Truy cập: **https://signup.cloud.oracle.com/**
2. Đăng ký tài khoản (cần thẻ Visa/Mastercard để xác minh, **KHÔNG bị trừ tiền**).
3. Chọn Home Region gần nhất: **Southeast Asia (Singapore)** hoặc **Japan (Tokyo)**.

> **Lưu ý**: Oracle Cloud Free Tier là **miễn phí vĩnh viễn** (Always Free), không phải trial. Bạn sẽ không bị tính phí khi sử dụng đúng mức Free Tier.

### Bước A.2: Tạo VM ARM Ampere A1

1. Đăng nhập **Oracle Cloud Console** → Menu **Compute → Instances → Create Instance**.
2. Cấu hình:
   - **Image**: Ubuntu 24.04 (Canonical)
   - **Shape**: Click **Change shape** → **Ampere** → **VM.Standard.A1.Flex**
   - **OCPUs**: `2` | **Memory**: `12 GB`
   - **Boot Volume**: 50 GB (tối đa 200 GB miễn phí)
   - **SSH Keys**: Tải xuống Private Key (lưu cẩn thận)
3. Click **Create** và đợi trạng thái **Running**.

> **Mẹo**: Nếu gặp lỗi "Out of capacity", thử khu vực khác (Singapore, Tokyo) hoặc thử lại vào giờ thấp điểm (5h - 7h sáng UTC+7).

### Bước A.3: Cài Đặt Ollama + Model AI

SSH vào Oracle Cloud VM:
```bash
ssh -i <your-private-key.pem> ubuntu@<ORACLE_VM_PUBLIC_IP>
```

Tải script cài đặt tự động lên VM và chạy:
```bash
# Upload script từ máy cá nhân
scp scripts/ai_pipeline/setup_oracle_cloud_ai_server.sh ubuntu@<IP>:/home/ubuntu/

# SSH vào VM và chạy
chmod +x setup_oracle_cloud_ai_server.sh
sudo ./setup_oracle_cloud_ai_server.sh
```

Script sẽ tự động:
- Cài đặt Ollama
- Tải model Qwen2.5-3B-Instruct (Q4_K_M) (~2GB)
- Tạo model tùy chỉnh `qwen-ubnd` với System Prompt hành chính
- Cấu hình tường lửa (chỉ cho phép kết nối từ VPN)

### Bước A.4: Thiết Lập WireGuard VPN

#### Trên Oracle Cloud VM (AI Server):
```bash
scp scripts/ai_pipeline/setup_wireguard_vpn.sh ubuntu@<IP>:/home/ubuntu/
chmod +x setup_wireguard_vpn.sh
sudo ./setup_wireguard_vpn.sh server
```

Script sẽ hiển thị **Server Public Key** và **Client Private Key** — ghi lại cẩn thận.

#### Trên VPS Web (.NET Backend):
```bash
chmod +x setup_wireguard_vpn.sh
sudo ./setup_wireguard_vpn.sh client <ORACLE_VM_PUBLIC_IP>
```

Nhập **Server Public Key** và **Client Private Key** từ bước trên khi được hỏi.

#### Mở Port WireGuard Trên Oracle Cloud Security List:
1. Trong Oracle Cloud Console → **Networking → Virtual Cloud Networks → Subnet → Security List**.
2. Thêm **Ingress Rule**:
   - Source: `0.0.0.0/0`
   - IP Protocol: `UDP`
   - Destination Port: `51820`

### Bước A.5: Kiểm Tra Kết Nối

Từ VPS Web, kiểm tra:
```bash
# Test VPN
ping 10.0.0.1

# Test Ollama API qua VPN
curl http://10.0.0.1:11434/api/tags

# Test suy luận AI
curl http://10.0.0.1:11434/api/chat -d '{
  "model": "qwen-ubnd",
  "messages": [{"role": "user", "content": "Trả về JSON: {\"status\": \"ok\"}"}],
  "format": "json",
  "stream": false
}'
```

---

## Phương Án B: Chạy Cục Bộ Trên Máy Cá Nhân (RTX 3050)

### Bước B.1: Cài Đặt Ollama Trên Windows
1. Tải từ: **https://ollama.com/download/windows**
2. Cài đặt `OllamaSetup.exe`

### Bước B.2: Chạy Script Thiết Lập
```powershell
powershell -ExecutionPolicy Bypass -File scripts/ai_pipeline/setup_local_ollama.ps1
```

### So Sánh Hiệu Năng

| Chỉ số | Oracle Cloud ARM (3B) | Máy cá nhân RTX 3050 (7B) |
| :--- | :--- | :--- |
| **Model** | Qwen2.5-3B Q4_K_M | Qwen2.5-7B Q4_K_M |
| **Tốc độ** | 20-30 tokens/s (CPU) | 35-50 tokens/s (GPU) |
| **Thời gian xử lý** | 3-5 giây/văn bản | 1.2-2 giây/văn bản |
| **Chạy 24/7** | ✅ Có | ❌ Phải bật máy |
| **Chi phí** | $0/tháng | $0 (điện nhà) |
| **Chất lượng** | 90-95% (sau fine-tune) | 96-99% (sau fine-tune) |

---

## Đào Tạo (Fine-Tuning) Trên Google Colab Miễn Phí

### Bước 1: Mở Google Colab
1. Truy cập: **https://colab.research.google.com/**
2. **File → Upload Notebook** → Chọn file `scripts/ai_pipeline/Qwen2_5_UBND_FineTuning_Colab.ipynb`
3. **Runtime → Change runtime type → T4 GPU (Free)** → Save

### Bước 2: Chạy Huấn Luyện (1-Click)
- Nhấn **Runtime → Run all** (`Ctrl + F9`)
- Quá trình tự động: Cài Unsloth → Nạp model → Train 10-15 phút → Xuất `.gguf` → Lưu vào Google Drive

### Bước 3: Tải File Model Về Oracle Cloud VM
```bash
# Tải từ Google Drive về máy cá nhân, sau đó upload lên Oracle VM
scp qwen2.5-3b-ubnd-catngan.Q4_K_M.gguf ubuntu@<ORACLE_VM_IP>:/home/ubuntu/

# SSH vào Oracle VM
ssh ubuntu@<ORACLE_VM_IP>

# Tạo Modelfile trỏ đến file đã fine-tune
echo 'FROM ./qwen2.5-3b-ubnd-catngan.Q4_K_M.gguf
PARAMETER num_ctx 2048
PARAMETER temperature 0.15' > Modelfile

# Tạo model trong Ollama
ollama create qwen-ubnd -f Modelfile

# Kiểm tra
ollama list
```

---

## Tùy Biến Dữ Liệu Thực Tế Của Cơ Quan

### Sinh Dữ Liệu Mẫu
```bash
python scripts/ai_pipeline/generate_administrative_dataset.py
```
→ Tạo 300 mẫu tại: `scripts/ai_pipeline/data/ubnd_administrative_dataset.jsonl`

### Cấu Trúc 1 Mẫu (ChatML JSONL):
```json
{
  "messages": [
    {"role": "system", "content": "Bạn là Trợ lý AI chuyên trách xử lý văn bản hành chính..."},
    {"role": "user", "content": "Phân tích văn bản: Số 45/UBND-VP ngày 10/08/2026..."},
    {"role": "assistant", "content": "{\"category\": \"TaskAssignmentDown\", ...}"}
  ]
}
```

---

## Tích Hợp Vào Hệ Thống Backend .NET

### Cấu Hình Production (`appsettings.json`):
Đã cấu hình sẵn trỏ đến Oracle Cloud VM qua WireGuard VPN:
```json
"AiProvider": {
  "Type": "Ollama",
  "Ollama": {
    "BaseUrl": "http://10.0.0.1:11434",
    "Model": "qwen-ubnd"
  }
}
```

### Cấu Hình Development (`appsettings.Development.json`):
Trỏ về localhost để phát triển trên máy cá nhân:
```json
"AiProvider": {
  "Type": "Ollama",
  "Ollama": {
    "BaseUrl": "http://localhost:11434",
    "Model": "qwen2.5:3b-instruct-q4_K_M"
  }
}
```

### Luồng Xử Lý:
1. Người dùng kéo thả file PDF/Word vào ô giao việc trên giao diện web
2. Backend .NET gọi `http://10.0.0.1:11434/api/chat` qua VPN
3. Model Qwen bóc tách trích yếu, hạn xử lý, phòng ban phụ trách
4. Kết quả JSON hiển thị tức thì trên giao diện
