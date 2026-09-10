using System;
using System.Linq;

namespace Quanlycongviec.Application.Common.Validators
{
    /// <summary>
    /// R.2 (07-09-2026): Validate lý do thay đổi điểm thi đua.
    /// Lý do phải:
    /// - Có ít nhất 10 ký tự sau trim
    /// - KHÔNG nằm trong blocklist (từ khóa chung chung)
    /// - Nếu tăng điểm: phải chứa 1 trong các từ khóa tăng
    /// - Nếu giảm điểm: phải chứa 1 trong các từ khóa giảm
    /// </summary>
    public static class RatingReasonValidator
    {
        // Blocklist: từ khóa chung chung, không có giá trị kiểm chứng
        private static readonly string[] GenericKeywords = new[]
        {
            "test", "thử", "abc", "xyz", "không có", "chưa rõ",
            "tạm thời", "sửa sau", "điền đại"
        };

        // Từ khóa hợp lệ cho tăng điểm (delta > 0)
        private static readonly string[] IncreaseKeywords = new[]
        {
            "tốt", "hoàn thành", "vượt", "xuất sắc",
            "cải thiện", "tiến bộ", "đạt"
        };

        // Từ khóa hợp lệ cho giảm điểm (delta < 0)
        private static readonly string[] DecreaseKeywords = new[]
        {
            "trễ", "thiếu", "sai", "vi phạm",
            "không hoàn thành", "yếu", "kém", "chậm"
        };

        /// <summary>
        /// Trả về thông báo lỗi nếu không hợp lệ; null nếu hợp lệ.
        /// </summary>
        public static string? Validate(string? reason, double oldScore, double newScore)
        {
            if (string.IsNullOrWhiteSpace(reason))
            {
                return "Lý do không được để trống.";
            }

            var trimmed = reason.Trim();
            if (trimmed.Length < 10)
            {
                return "Lý do phải có ít nhất 10 ký tự.";
            }

            var lower = trimmed.ToLowerInvariant();
            if (GenericKeywords.Any(k => lower.Contains(k, StringComparison.OrdinalIgnoreCase)))
            {
                return "Lý do quá chung chung, vui lòng mô tả cụ thể.";
            }

            var delta = newScore - oldScore;
            if (delta > 0)
            {
                // Tăng điểm: phải có từ khóa tăng
                if (!IncreaseKeywords.Any(k => lower.Contains(k, StringComparison.OrdinalIgnoreCase)))
                {
                    return "Lý do không khớp với việc tăng điểm. Vui lòng giải thích lý do tăng (tốt, hoàn thành, vượt, xuất sắc, cải thiện, tiến bộ, đạt...).";
                }
            }
            else if (delta < 0)
            {
                // Giảm điểm: phải có từ khóa giảm
                if (!DecreaseKeywords.Any(k => lower.Contains(k, StringComparison.OrdinalIgnoreCase)))
                {
                    return "Lý do không khớp với việc giảm điểm. Vui lòng giải thích lý do giảm (trễ, thiếu, sai, vi phạm, không hoàn thành, yếu, kém, chậm...).";
                }
            }

            return null; // hợp lệ
        }
    }
}
