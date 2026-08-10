namespace Quanlycongviec.Domain.Enums
{
    public enum RatingApprovalStatusEnum
    {
        Applied,              // Tự động áp dụng ngay (Độ lệch <= 1.0 điểm)
        PendingApproval,      // Chờ cấp trên phê duyệt (Độ lệch > 1.0 điểm)
        ApprovedBySuperior,   // Cấp trên đã duyệt & điểm mới đã được áp dụng
        RejectedBySuperior    // Cấp trên từ chối đề xuất (Giữ nguyên điểm cũ)
    }
}
