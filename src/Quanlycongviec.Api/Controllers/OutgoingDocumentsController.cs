using System;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CreateOutgoingDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CancelDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CreateVersion;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.RejectOutgoingDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.RevokeIssued;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.RevokeToDraft;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SignAndIssue;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SubmitForSignature;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.UpdateOutgoingDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetDocumentVersions;
using Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetOutgoingDocumentById;
using Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetOutgoingDocumentsPaginated;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class OutgoingDocumentsController : ControllerBase
    {
        private readonly ISender _mediator;

        public OutgoingDocumentsController(ISender mediator)
        {
            _mediator = mediator;
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (Guid.TryParse(claim, out var userId)) return userId;
            return Guid.Empty;
        }

        private int GetUserRankLevel()
        {
            var claim = User.FindFirst("RankLevel")?.Value;
            if (int.TryParse(claim, out var rank)) return rank;
            return 5; // Default Chuyên viên
        }

        /// <summary>
        /// Lấy danh sách văn bản đi (Hỗ trợ phân trang, tìm kiếm, lọc trạng thái/loại văn bản)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetOutgoingDocuments(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] OutgoingDocumentStatusEnum? status = null,
            [FromQuery] DocumentTypeEnum? documentType = null)
        {
            var userId = GetCurrentUserId();
            var rankLevel = GetUserRankLevel();

            var result = await _mediator.Send(new GetOutgoingDocumentsPaginatedQuery
            {
                Page = page,
                PageSize = pageSize,
                Search = search,
                Status = status,
                DocumentType = documentType,
                CurrentUserId = userId,
                UserRankLevel = rankLevel
            });

            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Lấy chi tiết văn bản đi
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var doc = await _mediator.Send(new GetOutgoingDocumentByIdQuery { Id = id });
            if (doc == null) return NotFound(new { success = false, error = "Không tìm thấy văn bản đi." });
            return Ok(new { success = true, data = doc });
        }

        /// <summary>
        /// Tạo văn bản nháp mới
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOutgoingDocumentCommand command)
        {
            if (command.DraftedByUserId == Guid.Empty)
            {
                command.DraftedByUserId = GetCurrentUserId();
            }

            var docId = await _mediator.Send(command);
            return Ok(new { success = true, data = docId });
        }

        /// <summary>
        /// Cập nhật văn bản nháp (CHỈ cho phép khi Status == Draft)
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOutgoingDocumentCommand command)
        {
            command.Id = id;
            if (command.UserId == Guid.Empty)
            {
                command.UserId = GetCurrentUserId();
            }

            var success = await _mediator.Send(command);
            return Ok(new { success });
        }

        /// <summary>
        /// Trình ký duyệt văn bản (Draft -> PendingSignature)
        /// </summary>
        [HttpPost("{id}/submit-for-signature")]
        public async Task<IActionResult> SubmitForSignature(Guid id)
        {
            var userId = GetCurrentUserId();
            var success = await _mediator.Send(new SubmitForSignatureCommand { Id = id, UserId = userId });
            return Ok(new { success });
        }

        /// <summary>
        /// Ký & Ban hành văn bản (Dành cho Lãnh đạo - Tự động cấp số hiệu chính thức)
        /// </summary>
        [HttpPost("{id}/sign")]
        public async Task<IActionResult> SignAndIssue(Guid id)
        {
            var userId = GetCurrentUserId();
            var rankLevel = GetUserRankLevel();

            var docNumber = await _mediator.Send(new SignAndIssueOutgoingDocumentCommand
            {
                Id = id,
                UserId = userId,
                UserRankLevel = rankLevel
            });

            return Ok(new { success = true, documentNumber = docNumber });
        }

        /// <summary>
        /// Từ chối ký duyệt văn bản kèm lý do
        /// </summary>
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> Reject(Guid id, [FromBody] RejectDocumentRequest request)
        {
            var userId = GetCurrentUserId();
            var rankLevel = GetUserRankLevel();

            var success = await _mediator.Send(new RejectOutgoingDocumentCommand
            {
                Id = id,
                RejectionReason = request.RejectionReason,
                UserId = userId,
                UserRankLevel = rankLevel
            });

            return Ok(new { success });
        }

        /// <summary>
        /// Thu hồi văn bản chờ ký về nháp
        /// </summary>
        [HttpPost("{id}/revoke")]
        public async Task<IActionResult> Revoke(Guid id)
        {
            var userId = GetCurrentUserId();
            var success = await _mediator.Send(new RevokeToDraftCommand { Id = id, UserId = userId });
            return Ok(new { success });
        }

        /// <summary>
        /// Thu hồi văn bản ĐÃ BAN HÀNH (Bắt buộc kèm lý do thu hồi) per NĐ 30/2020
        /// </summary>
        [HttpPost("{id}/revoke-issued")]
        public async Task<IActionResult> RevokeIssued(Guid id, [FromBody] RevokeIssuedDocumentRequest request)
        {
            var userId = GetCurrentUserId();
            var success = await _mediator.Send(new RevokeIssuedOutgoingDocumentCommand
            {
                Id = id,
                UserId = userId,
                Reason = request.Reason
            });
            return Ok(new { success });
        }

        /// <summary>
        /// Hủy văn bản (Xóa nháp nếu Status=Draft, Hủy văn bản nếu đã phát hành) per NĐ 30/2020
        /// </summary>
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelDocumentRequest request)
        {
            var userId = GetCurrentUserId();
            var success = await _mediator.Send(new CancelOutgoingDocumentCommand
            {
                Id = id,
                UserId = userId,
                Reason = request.Reason
            });
            return Ok(new { success });
        }

        /// <summary>
        /// Tạo phiên bản chỉnh sửa / đính chính cho văn bản đã ban hành per NĐ 30/2020
        /// </summary>
        [HttpPost("{id}/versions")]
        public async Task<IActionResult> CreateVersion(Guid id, [FromBody] CreateVersionRequest request)
        {
            var userId = GetCurrentUserId();
            var versionId = await _mediator.Send(new CreateDocumentVersionCommand
            {
                DocumentId = id,
                UserId = userId,
                Title = request.Title,
                Content = request.Content,
                AttachmentUrl = request.AttachmentUrl,
                ChangeReason = request.ChangeReason
            });
            return Ok(new { success = true, versionId });
        }

        /// <summary>
        /// Lấy danh sách lịch sử phiên bản của văn bản
        /// </summary>
        [HttpGet("{id}/versions")]
        public async Task<IActionResult> GetVersions(Guid id)
        {
            var versions = await _mediator.Send(new GetDocumentVersionsQuery { DocumentId = id });
            return Ok(new { success = true, data = versions });
        }
    }

    public class RejectDocumentRequest
    {
        public string RejectionReason { get; set; } = string.Empty;
    }

    public class RevokeIssuedDocumentRequest
    {
        public string Reason { get; set; } = string.Empty;
    }

    public class CancelDocumentRequest
    {
        public string Reason { get; set; } = string.Empty;
    }

    public class CreateVersionRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
        public string ChangeReason { get; set; } = string.Empty;
    }
}
