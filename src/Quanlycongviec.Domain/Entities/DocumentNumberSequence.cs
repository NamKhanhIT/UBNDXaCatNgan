using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    /// <summary>
    /// Bảng counter tự động cấp số văn bản theo năm + ký hiệu.
    /// Sử dụng PostgreSQL row-level lock (SELECT FOR UPDATE) để chống trùng số
    /// khi nhiều cán bộ cùng phát hành văn bản đồng thời.
    /// </summary>
    public class DocumentNumberSequence : BaseEntity
    {
        /// <summary>
        /// Năm hiệu lực (VD: 2026). Mỗi năm reset lại từ 1.
        /// </summary>
        public int Year { get; set; }

        /// <summary>
        /// Ký hiệu văn bản (VD: "UBND-VP", "QĐ-UBND").
        /// Kết hợp với Year tạo counter duy nhất.
        /// </summary>
        public string Symbol { get; set; } = "UBND-VP";

        /// <summary>
        /// Mã cơ quan (nếu hệ thống hỗ trợ đa cơ quan). Nullable = single-agency.
        /// </summary>
        public string? AgencyCode { get; set; }

        /// <summary>
        /// Số hiện tại cao nhất đã cấp trong năm + symbol.
        /// </summary>
        public int CurrentNumber { get; set; } = 0;
    }
}
