# Đặc Tả Thiết Kế: Giao Diện Quản Trị Tri Thức AI UBND Xã Cát Ngạn (Institutional Executive Dashboard)

> **Dự án**: Cổng Điều Hành & Trợ Lý AI - UBND Xã Cát Ngạn  
> **Áp dụng**: `scripts/ai_pipeline/huggingface_space/app.py`  
> **Trạng thái**: Hoàn Thành & Đã Kiểm Định Toàn Diện  

---

## 1. Mục Tiêu & Triết Lý Thiết Kế
Giao diện được thiết kế chuyên biệt cho cán bộ kỹ thuật và lãnh đạo UBND Xã Cát Ngạn theo tiêu chuẩn **công vụ định chế (Institutional Executive UI)**:
- **Độ tin cậy cao:** Rõ ràng, cấu trúc mạch lạc, phục vụ đọc số liệu nhanh và thao tác chính xác.
- **Tránh các khuôn mẫu AI thông thường:** Tuyệt đối không dùng gradient tím-xanh, không hiệu ứng kính mờ (glassmorphism), không dùng bo góc mềm mại quá đà (neumorphism), không dùng emoji tùy tiện.

---

## 2. Hệ Thống Design Tokens

### 2.1 Bảng Màu Định Chế (Institutional Color Palette)
```css
:root {
    --color-primary:      #1B2A4A;   /* Navy đậm — sidebar, tiêu đề, nút chính */
    --color-primary-hov:  #24365E;   /* Navy hover */
    --color-accent-seal:  #A6293C;   /* Đỏ con dấu — CHỈ dùng cho trạng thái khẩn/lỗi và vạch active sidebar */
    --color-surface:      #F7F8FA;   /* Nền khu vực nội dung chính */
    --color-surface-card: #FFFFFF;   /* Nền thẻ/bảng */
    --color-border:       #E2E5EA;   /* Viền nhạt 1px */
    --color-text-primary: #1A1D24;   /* Chữ chính */
    --color-text-muted:   #6B7280;   /* Chữ phụ/chú thích */
    --color-success:      #1D7A4C;   /* Xanh lá trầm — trạng thái thành công */
    --color-warning:      #B4740E;   /* Vàng cam trầm — trạng thái cần chú ý */
}
```

*Quy tắc sử dụng màu đỏ:* `--color-accent-seal` chỉ xuất hiện tối đa ở 2-3 điểm trên toàn màn hình (vạch chỉ báo active ở sidebar, nút xoá, badge lỗi).

### 2.2 Typography 3 Lớp
- **Giao diện & nội dung chung:** `Inter` (Google Fonts CDN) — trung tính, hỗ trợ đầy đủ tiếng Việt.
- **Tiêu đề phân hệ & nhãn:** `IBM Plex Sans` (weight 600) — tính định chế, chuẩn mực hành chính.
- **Dữ liệu kỹ thuật, JSON, Benchmark:** `IBM Plex Mono` — phân định ranh giới dữ liệu hệ thống.
- **Thang cỡ chữ:** 12px (chú thích) $\rightarrow$ 14px (nội dung/nhãn) $\rightarrow$ 16px (nhấn) $\rightarrow$ 20px (tiêu đề mục) $\rightarrow$ 24px (tiêu đề trang).

---

## 3. Bố Cục Sidebar Dọc 240px

Chuyển đổi toàn bộ từ thanh tab ngang mặc định của Gradio sang Sidebar dọc cố định bên trái:

```
┌──────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ SIDEBAR (240px, #1B2A4A)             │ MAIN CONTENT AREA (#F7F8FA)                                 │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ ỦY BAN NHÂN DÂN                      │ Header: HỆ THỐNG QUẢN TRỊ TRI THỨC & TRỢ LÝ AI HÀNH CHÍNH   │
│ XÃ CÁT NGẠN — AI GATEWAY             │ Badges: Qwen3.8-27B-FP8 | 4-BIT QUANT | ZEROGPU             │
│                                      ├─────────────────────────────────────────────────────────────┤
│ ▮ 1. Quản Lý Dữ Liệu (fa-database)   │ 4 Thẻ KPI: Train (800) | Test (200) | Tổng (1000) | Rò rỉ:0%│
│   2. Training Studio (fa-flask)      ├─────────────────────────────────────────────────────────────┤
│   3. Kiểm Tra & Chat (fa-comments)   │                                                             │
│   4. Quản Lý RAG (fa-book-open)      │  [KHU VỰC HIỂN THỊ PHÂN HỆ ĐƯỢC CHỌN TRONG 5 PHÂN HỆ]       │
│   5. Bóc Tách (fa-file-signature)    │  (Chuyển đổi tức thời qua cơ chế State & Visibility)        │
│                                      │                                                             │
│ ──────────────────────────────────── │                                                             │
│ ● Hệ Thống Trực Tuyến                │                                                             │
│ ZeroGPU Sẵn Sàng                     │                                                             │
└──────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

- **Điểm nhấn thương hiệu (Signature Element):** Vạch dọc 3px màu đỏ con dấu (`--color-accent-seal`) xuất hiện bên trái nút đang được chọn ở Sidebar.

---

## 4. Chuẩn Hóa 100% Icon Vector FontAwesome 6

Đã rà soát và thay thế toàn bộ ký tự emoji thành FontAwesome 6.5.1 qua CDN:
- Sidebar Nav: `fa-database`, `fa-flask`, `fa-comments`, `fa-book-open`, `fa-file-signature`.
- Trạng thái & Thao tác: `fa-circle-check`, `fa-circle-xmark`, `fa-triangle-exclamation`, `fa-cloud-arrow-up`, `fa-shield-halved`, `fa-trash-can`, `fa-magnifying-glass`, `fa-square-poll-vertical`.

---

## 5. Kết Quả Kiểm Định
- **Cú pháp:** Đạt chuẩn 100% qua `py_compile`.
- **An ninh 550 test cases:** Đạt **100.00% (550/550)** qua `security_stress_test.py`.
- **Benchmark 200 mẫu:** Đạt **100.00% (6/6 chỉ số)** qua `evaluate_benchmark.py`.
- **Tính tương thích:** Hoạt động chuẩn xác trên cả môi trường Hugging Face ZeroGPU và phát triển cục bộ.
