namespace Quanlycongviec.Application.Common.Options
{
    public class ScoringOptions
    {
        public const string SectionName = "ScoringConfig";

        /// <summary>
        /// Điểm tối đa tiêu chí Đúng hạn (mặc định 1.5đ trong thang 3.0đ hệ thống)
        /// </summary>
        public double SystemOnTimeMaxScore { get; set; } = 1.5;

        /// <summary>
        /// Mức trừ điểm mỗi ngày trễ hạn (mặc định trừ 0.2đ/ngày trễ)
        /// </summary>
        public double SystemLatePenaltyPerDay { get; set; } = 0.2;

        /// <summary>
        /// Điểm tối đa tiêu chí Checklist công việc (mặc định 1.0đ trong thang 3.0đ hệ thống)
        /// </summary>
        public double SystemChecklistMaxScore { get; set; } = 1.0;

        /// <summary>
        /// Điểm tối đa tiêu chí Không bị trả lại (mặc định 0.5đ trong thang 3.0đ hệ thống)
        /// </summary>
        public double SystemNoRejectionMaxScore { get; set; } = 0.5;

        /// <summary>
        /// Mức trừ điểm mỗi lần bị trả lại yêu cầu sửa (mặc định trừ 0.25đ/lần)
        /// </summary>
        public double SystemRejectionPenaltyPerTime { get; set; } = 0.25;

        /// <summary>
        /// Điểm hệ thống tối đa (mặc định 3.0 điểm)
        /// </summary>
        public double MaxSystemScore { get; set; } = 3.0;

        /// <summary>
        /// Điểm người chấm tối đa (mặc định 7.0 điểm)
        /// </summary>
        public double MaxEvaluatorScore { get; set; } = 7.0;

        /// <summary>
        /// Tổng điểm tối đa (mặc định 10.0 điểm)
        /// </summary>
        public double TotalMaxScore { get; set; } = 10.0;

        /// <summary>
        /// Ngưỡng lệch điểm kích hoạt Maker-Checker (mặc định lệch > 1.0 điểm)
        /// </summary>
        public double ApprovalThreshold { get; set; } = 1.0;
    }
}
