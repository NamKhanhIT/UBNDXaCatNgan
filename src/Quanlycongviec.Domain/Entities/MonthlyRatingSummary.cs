using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    /// <summary>
    /// 07-09-2026: Tổng hợp điểm thi đua theo tháng dùng cho tab Tháng / Quý / Năm.
    /// Background service AggregateMonthAsync insert/update bảng này mỗi ngày cuối tháng lúc 23:59 giờ VN.
    /// Unique index (UserId, Year, Month) đảm bảo idempotent.
    /// </summary>
    public class MonthlyRatingSummary : BaseEntity
    {
        public Guid UserId { get; set; }
        public int Year { get; set; }
        public int Month { get; set; }

        /// <summary>
        /// Trung bình cộng các lần chấm trong tháng (hệ thống + lãnh đạo)
        /// </summary>
        public double AverageFinalScore { get; set; }

        /// <summary>
        /// Tổng điểm hệ thống tích lũy
        /// </summary>
        public double SumSystemScore { get; set; }

        /// <summary>
        /// Tổng điểm lãnh đạo tích lũy
        /// </summary>
        public double SumEvaluatorScore { get; set; }

        /// <summary>
        /// Số lượt chấm trong tháng
        /// </summary>
        public int TasksEvaluated { get; set; }

        /// <summary>
        /// Thời điểm chấm gần nhất trong tháng
        /// </summary>
        public DateTime LastEvaluationAt { get; set; }

        /// <summary>
        /// Thời điểm aggregate job chạy
        /// </summary>
        public DateTime AggregatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Xếp loại thi đua theo AverageFinalScore
        /// </summary>
        public string TierGrade { get; set; } = string.Empty;
    }
}
