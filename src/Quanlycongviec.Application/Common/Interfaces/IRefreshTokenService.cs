using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    /// <summary>
    /// Quản lý vòng đời refresh token: tạo, xác thực và thu hồi (chỉ lưu SHA-256 hash).
    /// </summary>
    public interface IRefreshTokenService
    {
        /// <summary>Tạo refresh token mới, lưu hash vào DB, trả về token thô để gửi client.</summary>
        Task<string> CreateAsync(System.Guid userId, CancellationToken cancellationToken);

        /// <summary>Tìm refresh token còn hiệu lực theo token thô (chưa thu hồi, chưa hết hạn).</summary>
        Task<RefreshToken?> FindValidAsync(string rawToken, CancellationToken cancellationToken);

        /// <summary>Thu hồi (revoke) refresh token theo token thô — dùng khi logout hoặc xoay vòng.</summary>
        Task RevokeAsync(string? rawToken, CancellationToken cancellationToken);
    }
}