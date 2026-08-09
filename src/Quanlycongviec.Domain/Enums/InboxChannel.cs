namespace Quanlycongviec.Domain.Enums
{
    /// <summary>
    /// Phân luồng Hộp thư theo Luật 72/2025/QH15:
    /// - Internal: Văn bản chỉ đạo nội bộ (từ cấp trên, UBND huyện, tỉnh)
    /// - PublicService: Hồ sơ TTHC công dân (qua Trung tâm HCC)
    /// </summary>
    public enum InboxChannel
    {
        Internal = 0,
        PublicService = 1
    }
}
