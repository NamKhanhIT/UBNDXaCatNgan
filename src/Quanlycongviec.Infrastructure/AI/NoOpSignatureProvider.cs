using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.AI.Models;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Infrastructure.AI
{
    /// <summary>
    /// No-op signature provider — chưa tích hợp nhà cung cấp chữ ký số cụ thể.
    /// Luôn trả về Success = false + thông báo chưa cấu hình.
    /// Khi có nhà cung cấp thật (VNPT-CA, Viettel-CA...), tạo implementation mới kế thừa ISignatureProvider.
    /// </summary>
    public class NoOpSignatureProvider : ISignatureProvider
    {
        private readonly ILogger<NoOpSignatureProvider> _logger;

        public NoOpSignatureProvider(ILogger<NoOpSignatureProvider> logger)
        {
            _logger = logger;
        }

        public bool IsConfigured => false;

        public Task<SignatureResult> SignDocumentAsync(Guid documentId, Guid signerUserId, CancellationToken ct)
        {
            _logger.LogWarning(
                "Chữ ký số chưa được tích hợp. DocumentId={DocumentId}, SignerUserId={SignerUserId}. " +
                "Cần liên hệ nhà cung cấp chữ ký số (VNPT-CA, Viettel-CA, hoặc trục ký số quốc gia) " +
                "để lấy API/SDK tích hợp.",
                documentId, signerUserId);

            return Task.FromResult(new SignatureResult
            {
                Success = false,
                ErrorMessage = "Chữ ký số chưa được cấu hình. Liên hệ quản trị viên để tích hợp nhà cung cấp."
            });
        }
    }
}
