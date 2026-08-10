namespace Quanlycongviec.Application.Common.Options
{
    public class RatingRevisionOptions
    {
        public const string SectionName = "RatingRevisionOptions";

        public double ApprovalThreshold { get; set; } = 1.0;
        public int MinReasonLength { get; set; } = 30;
    }
}
