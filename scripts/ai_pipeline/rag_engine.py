#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
RAG KNOWLEDGE ENGINE: TRI THỨC HÀNH CHÍNH CÔNG VỤ UBND CẤP XÃ
(Theo Nghị quyết 1678/NQ-UBTVQH15, Luật 72/2025/QH15 & NĐ 30/2020/NĐ-CP)
=============================================================================
Module RAG gọn nhẹ (Hybrid BM25 + Keyword Semantic Graph), tự động nạp
và truy xuất tri thức quy định, địa bàn sáp nhập 130 ĐVHC Nghệ An,
cơ cấu 4 phòng ban và thể thức công văn để bổ sung ngữ cảnh cho LLM.
"""

import os
import re
import sys
import math
from typing import List, Dict, Any, Tuple

# Fix Windows console UTF-8 encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ---------------------------------------------------------------------------
# DỮ LIỆU TRI THỨC NỀN TẢNG (ADMINISTRATIVE KNOWLEDGE BASE)
# ---------------------------------------------------------------------------

DEFAULT_KNOWLEDGE_DOCS = [
    {
        "id": "KB_NQ1678_OVERVIEW",
        "title": "Tổng quan sắp xếp 130 ĐVHC cấp xã Tỉnh Nghệ An theo Nghị quyết 1678/NQ-UBTVQH15",
        "keywords": ["1678", "nghị quyết 1678", "nghệ an", "130 xã", "119 xã", "11 phường", "sắp xếp", "sáp nhập", "đơn vị hành chính"],
        "content": (
            "Căn cứ Nghị quyết số 1678/NQ-UBTVQH15 ngày 16/6/2025 của Ủy ban Thường vụ Quốc hội "
            "về sắp xếp đơn vị hành chính cấp xã của tỉnh Nghệ An năm 2025 (có hiệu lực từ 16/6/2025, vận hành từ 01/7/2025):\n"
            "- Tổng số ĐVHC cấp xã sau sắp xếp là 130 đơn vị (gồm 119 xã và 11 phường).\n"
            "- 121 đơn vị hình thành sau sắp xếp (110 xã, 11 phường).\n"
            "- 09 xã giữ nguyên không thực hiện sắp xếp: Keng Đu, Mỹ Lý, Bắc Lý, Huồi Tụ, Mường Lống, Bình Chuẩn, Hữu Khuông, Lượng Minh, Châu Bình.\n"
            "- Mô hình quản trị: Vận hành chính quyền địa phương 2 cấp (Tỉnh - Xã) theo Luật Tổ chức CQĐP số 72/2025/QH15, bãi bỏ cấp huyện. "
            "Cấp xã tự chủ trực tiếp tiếp nhận 86% nhiệm vụ chuyên môn từ cấp huyện cũ (714 nhiệm vụ)."
        )
    },
    {
        "id": "KB_CAT_NGAN_DETAIL",
        "title": "Thông tin chi tiết Xã Cát Ngạn (Sáp nhập Minh Sơn, Cát Văn, Phong Thịnh)",
        "keywords": ["cát ngạn", "xã cát ngạn", "minh sơn", "cát văn", "phong thịnh", "cát mộng", "lương điền", "thanh chương", "thôn"],
        "content": (
            "Đơn vị hành chính: Xã Cát Ngạn (Tỉnh Nghệ An) - Thành lập theo Mục 87 Nghị quyết 1678/NQ-UBTVQH15.\n"
            "- Hình thành trên cơ sở sáp nhập 03 xã cũ: Xã Minh Sơn, Xã Cát Văn, Xã Phong Thịnh (huyện Thanh Chương cũ).\n"
            "- Địa bàn hành chính & 17 thôn xóm trực thuộc: Thôn Cát Mộng, Thôn Lương Điền, Thôn Phong Mỹ, Thôn Phong Thịnh, "
            "Thôn Minh Sơn, Thôn 1, Thôn 2, Thôn 3, Thôn 4, Thôn 5, Thôn 6, Thôn 7, Thôn 8, Thôn 9, Thôn 10, Thôn 11, Thôn 12.\n"
            "- Cơ quan quản lý cấp trên trực tiếp: Ủy ban nhân dân Tỉnh Nghệ An (không qua cấp huyện).\n"
            "- Cơ quan lãnh đạo cơ sở: Đảng ủy - HĐND - UBND - UBMTTQ Xã Cát Ngạn.\n"
            "- Cơ cấu chuyên môn 4 phòng ban: Văn phòng HĐND & UBND, Phòng Kinh tế, Phòng Văn hóa - Xã hội, Trung tâm Phục vụ Hành chính công."
        )
    },
    {
        "id": "KB_COMMUNE_DEPARTMENTS",
        "title": "Cơ cấu 4 phòng ban chuyên môn cấp Xã và thẩm quyền theo Luật 72/2025/QH15",
        "keywords": ["phòng ban", "văn phòng", "phòng kinh tế", "văn hóa xã hội", "hành chính công", "thẩm quyền", "luật 72", "cấp xã"],
        "content": (
            "Cơ cấu tổ chức bộ máy UBND cấp xã theo Luật Tổ chức CQĐP số 72/2025/QH15 gồm 4 phòng ban chuyên môn:\n"
            "1. Văn phòng HĐND & UBND: Tham mưu tổng hợp, nội chính, pháp chế, kiểm soát TTHC, văn thư lưu trữ, quản lý con dấu, chứng thư số, tiếp công dân, điều phối công tác.\n"
            "2. Phòng Kinh tế (hoặc Kinh tế - Hạ tầng & Đô thị): Quản lý đất đai, cấp GCN QSDĐ lần đầu, quy hoạch trật tự xây dựng, tài chính - ngân sách xã, đầu tư công, nông nghiệp, nông thôn mới, tài nguyên môi trường.\n"
            "3. Phòng Văn hóa - Xã hội: Quản lý trường mầm non/tiểu học/THCS, Trạm Y tế xã, an sinh xã hội, chính sách người có công, giảm nghèo, tư pháp - hộ tịch, chứng thực điện tử, hòa giải cơ sở.\n"
            "4. Trung tâm Phục vụ Hành chính công: Đầu mối duy nhất tiếp nhận, số hóa 100% hồ sơ TTHC, trả kết quả và cung cấp dịch vụ công trực tuyến qua VNeID / Cổng Dịch vụ công Quốc gia."
        )
    },
    {
        "id": "KB_DECREE30_FORMAT",
        "title": "Quy chuẩn thể thức văn bản hành chính theo Nghị định 30/2020/NĐ-CP",
        "keywords": ["nghị định 30", "thể thức", "văn bản", "quốc hiệu", "số ký hiệu", "chữ ký", "tm. uỷ ban nhân dân", "kt. chủ tịch"],
        "content": (
            "Thể thức văn bản hành chính của UBND cấp xã theo Nghị định số 30/2020/NĐ-CP của Chính phủ:\n"
            "- Quốc hiệu & Tiêu ngữ: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' / 'Độc lập - Tự do - Hạnh phúc'.\n"
            "- Tên cơ quan ban hành: 'ỦY BAN NHÂN DÂN' và dòng dưới là tên xã in hoa (VD: 'XÃ CÁT NGẠN').\n"
            "- Ký hiệu văn bản: Số/Ký hiệu loại-UBND (VD: 125/QĐ-UBND, 45/BC-UBND, 18/TB-UBND, 60/KH-UBND, 12/TTr-UBND).\n"
            "- Thẩm quyền ký ban hành:\n"
            "  + 'TM. ỦY BAN NHÂN DÂN' / 'CHỦ TỊCH': Ký các văn bản thuộc thẩm quyền tập thể của UBND (Quyết định quy chế, Báo cáo KTXH, Tờ trình HĐND).\n"
            "  + 'KT. CHỦ TỊCH' / 'PHÓ CHỦ TỊCH': Ký thay Chủ tịch theo lĩnh vực phân công phụ trách (Kinh tế, Văn hóa - Xã hội) hoặc ủy quyền."
        )
    },
    {
        "id": "KB_NGHE_AN_COMMUNES_LIST",
        "title": "Danh sách các ĐVHC cấp xã tiêu biểu khác tại Nghệ An theo NQ 1678",
        "keywords": ["đại đồng", "hạnh lâm", "bích hào", "kim bảng", "kim liên", "vạn an", "đại huệ", "đô lương", "thành vinh", "trường vinh", "cửa lò"],
        "content": (
            "Các ĐVHC cấp xã tiêu biểu tại Nghệ An sau sáp nhập NQ 1678:\n"
            "- Xã Đại Đồng: Sáp nhập TT Dùng, Đồng Văn, Thanh Ngọc, Thanh Phong, Đại Đồng.\n"
            "- Xã Hạnh Lâm: Sáp nhập Thanh Đức, Hạnh Lâm.\n"
            "- Xã Bích Hào: Sáp nhập Mai Giang, Thanh Lâm, Thanh Tùng, Thanh Xuân.\n"
            "- Xã Kim Bảng: Sáp nhập Thanh Hà, Thanh Thủy, Kim Bảng.\n"
            "- Xã Kim Liên: Sáp nhập Hùng Tiến, Nam Cát, Nam Giang, Xuân Hồng, Kim Liên (gồm Làng Sen, Hoàng Trù, Xóm Sen 1, Sen 2).\n"
            "- Xã Vạn An: Sáp nhập TT Nam Đàn, Thượng Tân Lộc, Xuân Hòa.\n"
            "- Xã Đô Lương: Sáp nhập Đà Sơn, Đặng Sơn, Lưu Sơn, Thịnh Sơn, Văn Sơn, Yên Sơn, TT Đô Lương.\n"
            "- Phường Thành Vinh: Sáp nhập Cửa Nam, Đông Vĩnh, Hưng Bình, Lê Lợi, Quang Trung, Hưng Chính.\n"
            "- Phường Trường Vinh: Sáp nhập Bến Thủy, Hưng Dũng, Hưng Phúc, Trung Đô, Trường Thi, Vinh Tân, Hưng Hòa.\n"
            "- Phường Cửa Lò: Sáp nhập Nghi Hải, Nghi Hòa, Nghi Hương, Nghi Tân, Nghi Thu, Nghi Thủy, Thu Thủy."
        )
    }
]

# ---------------------------------------------------------------------------
# HYBRID RETRIEVER ENGINE
# ---------------------------------------------------------------------------

class AdministrativeRagEngine:
    def __init__(self, extra_docs: List[Dict[str, Any]] = None):
        self.docs = list(DEFAULT_KNOWLEDGE_DOCS)
        if extra_docs:
            self.docs.extend(extra_docs)
        self._load_wiki_concepts()
        self._build_index()

    def _load_wiki_concepts(self):
        """Tự động nạp thêm tài liệu wiki nếu có."""
        possible_paths = [
            os.path.join(os.path.dirname(__file__), "..", "..", "wiki", "concepts", "don-vi-hanh-chinh-nghe-an-nghi-quyet-1678.md"),
            os.path.join(os.getcwd(), "wiki", "concepts", "don-vi-hanh-chinh-nghe-an-nghi-quyet-1678.md"),
            os.path.join(os.getcwd(), "UBNDXaCN", "wiki", "concepts", "don-vi-hanh-chinh-nghe-an-nghi-quyet-1678.md"),
        ]
        for p in possible_paths:
            p = os.path.normpath(p)
            if os.path.isfile(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        text = f.read()
                    self.docs.append({
                        "id": "WIKI_NQ1678_SOURCE",
                        "title": "Tài liệu chuyên đề: Đơn Vị Hành Chính Nghệ An (Nghị Quyết 1678)",
                        "keywords": ["nghị quyết 1678", "nghệ an", "cát ngạn", "130 xã", "phân quyền 86%"],
                        "content": text[:4000],  # Lấy 4000 ký tự quan trọng nhất
                    })
                    break
                except Exception:
                    pass

    def _tokenize(self, text: str) -> List[str]:
        text_clean = re.sub(r"[^\w\s]", " ", text.lower())
        tokens = [t.strip() for t in text_clean.split() if len(t.strip()) > 1]
        return tokens

    def _build_index(self):
        """Xây dựng chỉ mục từ khóa và tính toán IDF cho BM25."""
        self.doc_tokens = []
        self.df = {}
        self.doc_len = []
        self.N = len(self.docs)

        for doc in self.docs:
            combined_text = f"{doc['title']} {' '.join(doc.get('keywords', []))} {doc['content']}"
            tokens = self._tokenize(combined_text)
            self.doc_tokens.append(tokens)
            self.doc_len.append(len(tokens))
            seen = set(tokens)
            for t in seen:
                self.df[t] = self.df.get(t, 0) + 1

        self.avgdl = sum(self.doc_len) / max(1, self.N)

    def retrieve(self, query: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """Truy xuất các đoạn tri thức liên quan nhất dựa trên BM25 + Keyword Matching."""
        q_tokens = self._tokenize(query)
        if not q_tokens:
            return self.docs[:top_k]

        scores = []
        k1 = 1.5
        b = 0.75

        for idx, doc in enumerate(self.docs):
            score = 0.0
            tokens = self.doc_tokens[idx]
            doc_len = self.doc_len[idx]

            # 1. Điểm BM25
            token_counts = {}
            for t in tokens:
                token_counts[t] = token_counts.get(t, 0) + 1

            for qt in q_tokens:
                if qt in token_counts:
                    tf = token_counts[qt]
                    df_val = self.df.get(qt, 1)
                    idf = math.log((self.N - df_val + 0.5) / (df_val + 0.5) + 1.0)
                    numerator = tf * (k1 + 1)
                    denominator = tf + k1 * (1 - b + b * (doc_len / self.avgdl))
                    score += idf * (numerator / denominator)

            # 2. Khớp từ khóa cụm chính xác (Exact match bonus)
            for kw in doc.get("keywords", []):
                if kw.lower() in query.lower():
                    score += 4.0

            # 3. Trọng tâm Cát Ngạn
            if "cát ngạn" in query.lower() and "cát ngạn" in doc["content"].lower():
                score += 5.0

            scores.append((score, doc))

        scores.sort(key=lambda x: x[0], reverse=True)
        results = [doc for s, doc in scores[:top_k] if s > 0.1]
        if not results:
            results = [scores[0][1]]
        return results

    def build_rag_prompt(self, system_prompt: str, user_query: str, top_k: int = 2) -> Tuple[str, str]:
        """Tự động tiêm tri thức RAG vào prompt."""
        retrieved_docs = self.retrieve(user_query, top_k=top_k)
        context_blocks = []
        for i, doc in enumerate(retrieved_docs, 1):
            context_blocks.append(f"--- [TRI THỨC PHÁP LÝ & ĐỊA BÀN #{i}: {doc['title']}] ---\n{doc['content']}")

        rag_context = "\n\n".join(context_blocks)
        augmented_system_prompt = (
            f"{system_prompt}\n\n"
            f"=== [CƠ SỞ TRI THỨC PHÁP LÝ & ĐỊA CHÍNH (NQ 1678 / LUẬT 72 / NĐ 30)] ===\n"
            f"{rag_context}\n"
            f"=== [HẾT CƠ SỞ TRI THỨC] ===\n"
            f"Hãy căn cứ vào tri thức chuẩn xác ở trên để phân tích, bóc tách và phản hồi chính xác."
        )
        return augmented_system_prompt, user_query


# Singleton instance
_rag_instance = None

def get_rag_engine() -> AdministrativeRagEngine:
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = AdministrativeRagEngine()
    return _rag_instance


# ---------------------------------------------------------------------------
# TEST CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    rag = get_rag_engine()
    test_queries = [
        "Xã Cát Ngạn sau sáp nhập gồm những thôn nào?",
        "Tỉnh Nghệ An sau Nghị quyết 1678 có bao nhiêu xã, phường?",
        "Phòng ban nào của UBND xã phụ trách thẩm định cấp sổ đỏ đất đai?",
    ]
    print("=" * 70)
    print("🔍 KIỂM THỬ TRUY XUẤT TRI THỨC RAG CẤP XÃ (BM25 + KEYWORD GRAPH)")
    print("=" * 70)
    for q in test_queries:
        print(f"\n❓ Query: {q}")
        res = rag.retrieve(q, top_k=1)
        for r in res:
            print(f"  👉 Khớp tài liệu: [{r['id']}] {r['title']}")
            print(f"     Nội dung trích đoạn: {r['content'][:150]}...")
    print("=" * 70)
