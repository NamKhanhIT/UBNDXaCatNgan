using System;
using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Application.AI.Models;

namespace Quanlycongviec.Application.Common.Interfaces
{
    /// <summary>
    /// Điểm mở rộng cho chữ ký số — chưa tích hợp nhà cung cấp cụ thể (VNPT-CA, Viettel-CA...).
    /// Implementation hiện tại: NoOpSignatureProvider (không làm gì, trả success = false).
    /// Khi có nhà cung cấp thật, tạo implementation mới mà không cần sửa luồng nghiệp vụ.
    /// </summary>
    public interface ISignatureProvider
    {
        Task<SignatureResult> SignDocumentAsync(Guid documentId, Guid signerUserId, CancellationToken ct);
        bool IsConfigured { get; }
    }
}
