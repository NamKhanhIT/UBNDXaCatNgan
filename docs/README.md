# Kho Tài Liệu Dự Án UBND Xã Cát Ngạn (Project Documentation)

Thư mục này lưu trữ toàn bộ tài liệu kỹ thuật, kiến trúc, đặc tả tính năng và bối cảnh nghiệp vụ của hệ thống Quản lý & Nhắc việc UBND Xã Cát Ngạn.

---

## 📁 Cấu Trúc Tài Liệu

### 0. Hướng Dẫn Vận Hành & Triển Khai (Bắt Buộc Đọc Trước Khi Vận Hành)
- **[docs/DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**: Hướng dẫn triển khai **toàn hệ thống với chi phí 0 đồng** — PWA trên điện thoại + máy tính, Web Push VAPID, AI ZeroGPU, Cloudflare Tunnel, backup, checklist bàn giao.
- **[docs/HUONG_DAN_SU_DUNG_AI_RAG.md](HUONG_DAN_SU_DUNG_AI_RAG.md)**: **Sổ tay hướng dẫn sử dụng & vận hành Cổng AI & RAG mới** (Qwen3.8-27B-FP8, Tab 5 Nạp tài liệu PDF/Word, Tab 3 Chatbot Multimodal Vision, bảo mật Private Space & API Key).

### 1. [docs/specs/](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/specs) — Đặc Tả Kỹ Thuật Tính Năng (Design Specs)
Chứa các bản đặc tả chi tiết được thiết kế trước khi triển khai các tính năng lớn:
- `2026-08-08-dynamic-demo-mode-design.md`: Chế độ Demo động phục vụ trải nghiệm người dùng.
- `2026-08-09-github-private-repo-ci-design.md`: Thiết kế CI/CD và quản lý repository GitHub an toàn.
- `2026-08-10-rating-revision-design.md`: Lịch sử điều chỉnh và kiểm duyệt đánh giá công việc.
- `2026-08-10-outgoing-document-enhancements-design.md`: Quản lý và xử lý quy trình Văn bản đi.
- `2026-08-10-google-calendar-events-design.md`: Quản lý lịch công tác & sự kiện phong cách Google Calendar.
- `2026-08-15-ai-document-analysis-pipeline-design.md`: Đặc tả pipeline phân tích văn bản AI.
- `2026-08-15-ai-hosting-and-operations-guide.md`: Hướng dẫn vận hành AI (Ollama/ZeroGPU).
- `2026-08-19-hybrid-rag-and-multimodal-upgrade-design.md`: Nâng cấp Hybrid RAG 2 lớp (BM25 + ChromaDB/bge-m3), Multimodal Vision Qwen3.8-27B-FP8, Tab 5 Quản lý tri thức RAG và bộ đánh giá 6 chỉ số.
- `2026-08-19-ai-security-hardening-and-anti-injection-spec.md`: Hệ thống phòng vệ AI 6 tầng, chống Prompt Injection/Jailbreak đa vector, lọc rác/ẩn danh PII và bộ kiểm định an ninh 550+ test cases.
- `2026-08-19-executive-dashboard-ui-redesign-spec.md`: Tái thiết kế giao diện Dashboard Quản trị Tri thức AI phong cách định chế công vụ (Sidebar dọc 240px, FontAwesome 6, Palette Navy #1B2A4A & Đỏ con dấu #A6293C, Inter/IBM Plex Typography).

### 2. [docs/architecture/](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/architecture) — Kiến Trúc & Quyết Định Kỹ Thuật
- `DECISIONS.md`: Quyết định kiến trúc (ADRs từ ADR-01 đến ADR-14 về UI Utilitarian, Inbox Triage, Đánh giá Kép, Hybrid RAG 2 lớp, Multimodal LLM).
- `Phân cấp phân quyền UBND Cấp xã.md`: Mô hình phân quyền 3 cấp, cơ cấu tổ chức theo Luật 72/2025/QH15.
- `Danh-gia-va-Lo-trinh-Phan-mem-UBND-Xa.md`: Báo cáo đánh giá hiện trạng và lộ trình phát triển hệ thống qua 4 giai đoạn.
- `TasksSoftware.docx`: Báo cáo nghiên cứu cơ sở lý luận và yêu cầu phần mềm.

### 3. [docs/business/](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/docs/business) — Bối Cảnh Nghiệp Vụ & Bộ Nhớ Hệ Thống
- `BUSINESS_MEMORY.md`: Cơ cấu 5 phòng ban (`VAN_PHONG`, `KINH_TE`, `VAN_HOA_XA_HOI`, `HANH_CHINH_CONG`, `KHOI_DANG_DOAN_THE`) và 3 cấp RBAC.
- `MEMORY.md`: Ghi nhớ các định mức tải việc và nguyên tắc nghiệp vụ.

---

## 🧭 Bộ Quy Tắc Dành Cho AI
Toàn bộ quy tắc ứng xử của AI Assistant và quy chuẩn kỹ thuật được định nghĩa tại [.agents/AGENTS.md](file:///e:/Jobs/UBNDXaCatNgan/UBNDXaCN/.agents/AGENTS.md).
