using System.Threading;
using System.Threading.Tasks;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IEmailService
    {
        Task<bool> SendPasswordResetOtpAsync(string toEmail, string fullName, string otpCode, CancellationToken cancellationToken = default);
        Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
    }
}
