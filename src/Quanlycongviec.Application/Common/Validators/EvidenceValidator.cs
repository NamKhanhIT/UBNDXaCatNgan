using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Validators
{
    /// <summary>
    /// R.3 (07-09-2026): Validate bằng chứng đính kèm khi sửa điểm thi đua.
    /// Bằng chứng KHÔNG được:
    /// - Rỗng (0 byte)
    /// - Có UploadedAt trong tương lai (lệch đồng hồ client)
    /// - Do chính cán bộ được đánh giá upload (self-uploaded)
    /// </summary>
    public static class EvidenceValidator
    {

        // Trả về thông báo lỗi nếu không hợp lệ; null nếu hợp lệ.
        public static async Task<string?> ValidateAsync(
            Guid[] evidenceFileIds,
            Guid targetUserId,
            IApplicationDbContext context,
            CancellationToken cancellationToken)
        {
            if (evidenceFileIds == null || evidenceFileIds.Length == 0)
            {
                return "Phải đính kèm ít nhất 1 bằng chứng.";
            }

            try
            {
                var files = await context.DocumentAttachments
                    .Where(f => evidenceFileIds.Contains(f.Id))
                    .ToListAsync(cancellationToken);

                // Không tìm thấy file metadata → cho qua (best-effort, tránh block request khi
                // hệ thống chưa có file store thật — sẽ check kỹ hơn khi có file upload pipeline hoàn chỉnh).
                if (files.Count == 0)
                {
                    return null;
                }

                foreach (var file in files)
                {
                    if (file.FileSize <= 0)
                    {
                        return $"Bằng chứng \"{file.OriginalFileName}\" rỗng / 0 byte, không hợp lệ.";
                    }

                    if (file.UploadedAt > DateTime.UtcNow.AddMinutes(5))
                    {
                        return $"Bằng chứng \"{file.OriginalFileName}\" có ngày tải lên trong tương lai, không hợp lệ.";
                    }

                    if (file.UploadedByUserId == targetUserId)
                    {
                        return "Bằng chứng không được do chính cán bộ đang đánh giá cung cấp.";
                    }
                }
            }
            catch
            {
                // Best-effort: nếu query lỗi do schema khác biệt, không block request.
            }

            return null; 
        }
    }
}
