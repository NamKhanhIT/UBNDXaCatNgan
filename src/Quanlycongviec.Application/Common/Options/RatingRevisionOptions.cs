namespace Quanlycongviec.Application.Common.Options
{
    public class RatingRevisionOptions
    {
        public const string SectionName = "RatingRevisionOptions";

        /// <summary>
        /// Ngưỡng lệch điểm kích hoạt quy trình phê duyệt cấp trên (mặc định > 1.0 điểm trên thang 10)
        /// </summary>
        public double ApprovalThreshold { get; set; } = 1.0;

        /// <summary>
        /// Số ký tự lý do tối thiểu (mặc định 30 ký tự)
        /// </summary>
        public int MinReasonLength { get; set; } = 30;
    }
}
