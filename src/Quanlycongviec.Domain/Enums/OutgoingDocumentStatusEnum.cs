namespace Quanlycongviec.Domain.Enums
{
    public enum OutgoingDocumentStatusEnum
    {
        Draft,             // Bản nháp (Đang soạn)
        PendingSignature,  // Chờ ký duyệt (Đã trình Lãnh đạo)
        Issued,            // Đã ban hành (Đã ký & gán số hiệu chính thức)
        Sent,              // Đã gửi đi (Đã phát hành ra bên ngoài)
        Rejected,          // Bị từ chối ký (Cần chỉnh sửa lại)
        Recalled,          // Văn bản đã phát hành được thu hồi, giữ nguyên nội dung và số
        Cancelled          // Đã hủy có lý do, không dùng lại như bản nháp
    }
}
