namespace Quanlycongviec.Domain.Enums
{
    public enum AnnotationSeverityEnum
    {
        LoiSai = 1,       // Lỗi sai (đỏ nhạt)
        CanChinhSua = 2,  // Cần chỉnh sửa (cam nhạt)
        GopY = 3          // Góp ý (xanh nhạt)
    }

    public enum AnnotationStatusEnum
    {
        Open = 1,         // Đang mở / Chờ xử lý
        Resolved = 2      // Đã sửa xong / Đã giải quyết
    }
}
