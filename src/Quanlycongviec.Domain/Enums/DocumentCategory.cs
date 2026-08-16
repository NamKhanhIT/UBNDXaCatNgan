namespace Quanlycongviec.Domain.Enums
{
    /// <summary>
    /// Phân loại văn bản hành chính do AI trích xuất.
    /// AI chỉ được chọn 1 trong các giá trị này, không tự tạo loại mới.
    /// </summary>
    public enum DocumentCategory
    {
        MeetingInvitation,      // Họp / Thư mời
        SuperiorDirective,      // Chỉ đạo cấp trên
        TaskAssignmentDown,     // Giao việc xuống
        ReportSubmissionUp,     // Báo cáo cấp dưới gửi lên
        Other                   // Loại khác
    }
}
