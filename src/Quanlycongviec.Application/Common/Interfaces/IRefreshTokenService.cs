using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    // Quản lý vòng đời refresh token: tạo, xác thực, xoay vòng và thu hồi (chỉ lưu SHA-256 hash)
    public interface IRefreshTokenService
    {
        // Tạo refresh token mới, lưu hash vào DB và trả về token thô
        Task<string> CreateAsync(System.Guid userId, CancellationToken cancellationToken);

        // BẢO MẬT (Audit M4): Xoay vòng refresh token nguyên tử và phát hiện tái sử dụng token đã thu hồi
        Task<string> RotateAsync(System.Guid userId, string rawOldToken, CancellationToken cancellationToken);

        // Tìm refresh token còn hiệu lực theo token thô
        Task<RefreshToken?> FindValidAsync(string rawToken, CancellationToken cancellationToken);

        // Thu hồi (revoke) refresh token theo token thô
        Task RevokeAsync(string? rawToken, CancellationToken cancellationToken);

        // BẢO MẬT (Audit H6): Thu hồi toàn bộ refresh token của người dùng (sau đổi mật khẩu/đăng xuất)
        Task RevokeAllForUserAsync(System.Guid userId, CancellationToken cancellationToken);

        // Đăng xuất các thiết bị khác: Thu hồi tất cả refresh token ngoại trừ phiên hiện tại
        Task RevokeOtherSessionsForUserAsync(System.Guid userId, string? currentRawToken, CancellationToken cancellationToken);
    }
}