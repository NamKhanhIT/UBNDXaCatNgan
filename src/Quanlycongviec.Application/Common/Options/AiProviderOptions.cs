namespace Quanlycongviec.Application.Common.Options
{
    /// <summary>
    /// Cấu hình AI Provider — chọn giữa Ollama (nội bộ) và ApiCompatible (bên ngoài).
    /// Mặc định: Ollama. ApiCompatible bị chặn trừ khi DataSovereigntyAcknowledged = true.
    /// </summary>
    public class AiProviderOptions
    {
        public const string SectionName = "AiProvider";

        public string Type { get; set; } = "Ollama"; // "Ollama" | "ApiCompatible"
        public double ConfidenceThreshold { get; set; } = 0.6;
        /// <summary>
        /// Thời gian chờ tối đa cho mỗi request AI (giây). Tránh treo request khi AI server chết.
        /// </summary>
        public int TimeoutSeconds { get; set; } = 60;

        public OllamaOptions Ollama { get; set; } = new();
        public ApiOptions Api { get; set; } = new();
    }

    public class OllamaOptions
    {
        public string BaseUrl { get; set; } = "http://localhost:11434";
        public string Model { get; set; } = "qwen2.5:3b"; // Nhẹ, chạy tốt trên CPU máy thường; máy mạnh hơn dùng qwen3:4b
    }

    public class ApiOptions
    {
        public string BaseUrl { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        /// <summary>
        /// BẮT BUỘC = true trước khi dùng API ngoài. Nếu false → ứng dụng từ chối khởi động.
        /// Đây là quyết định chính sách dữ liệu, không phải kỹ thuật.
        /// </summary>
        public bool DataSovereigntyAcknowledged { get; set; } = false;
    }

    /// <summary>
    /// Cấu hình upload file — giới hạn dung lượng và loại file cho phép.
    /// </summary>
    public class FileUploadOptions
    {
        public const string SectionName = "FileUpload";

        public int MaxFileSizeMB { get; set; } = 20;
        public string AllowedExtensions { get; set; } = "pdf,doc,docx,jpg,jpeg,png,xlsx";

        public long MaxFileSizeBytes => MaxFileSizeMB * 1024L * 1024L;

        public string[] GetAllowedExtensionArray() =>
            AllowedExtensions.Split(',', System.StringSplitOptions.RemoveEmptyEntries | System.StringSplitOptions.TrimEntries);
    }
}
