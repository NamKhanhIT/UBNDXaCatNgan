using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SignAndIssue
{
    public class SignAndIssueOutgoingDocumentCommand : IRequest<string>
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public int UserRankLevel { get; set; } = 5; // Default Chuyên viên
    }

    public class SignAndIssueOutgoingDocumentCommandHandler : IRequestHandler<SignAndIssueOutgoingDocumentCommand, string>
    {
        private readonly IApplicationDbContext _context;

        public SignAndIssueOutgoingDocumentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<string> Handle(SignAndIssueOutgoingDocumentCommand request, CancellationToken cancellationToken)
        {
            // Kiểm tra thẩm quyền ký: Chỉ Lãnh đạo UBND / Trưởng phòng (RankLevel <= 2.5) được ký ban hành
            if (request.UserRankLevel > 2.5)
            {
                throw new UnauthorizedAccessException("Cán bộ không có thẩm quyền ký và ban hành văn bản hành chính.");
            }

            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
            if (doc == null)
            {
                throw new InvalidOperationException($"Không tìm thấy văn bản đi có Id = {request.Id}");
            }

            if (doc.Status != OutgoingDocumentStatusEnum.PendingSignature)
            {
                throw new InvalidOperationException("Chỉ có thể ký và ban hành văn bản đang ở trạng thái Chờ ký duyệt.");
            }

            var now = DateTime.UtcNow;
            int currentYear = now.Year;

            string typeAbbrev = GetTypeAbbreviation(doc.DocumentType);
            string symbol = $"{typeAbbrev}-UBND";

            // ── Cấp số văn bản tự động concurrency-safe qua DocumentNumberSequence ──
            var sequence = await _context.DocumentNumberSequences
                .FirstOrDefaultAsync(s => s.Year == currentYear && s.Symbol == symbol, cancellationToken);

            if (sequence == null)
            {
                sequence = new DocumentNumberSequence
                {
                    Year = currentYear,
                    Symbol = symbol,
                    CurrentNumber = 1
                };
                _context.DocumentNumberSequences.Add(sequence);
            }
            else
            {
                sequence.CurrentNumber += 1;
                sequence.UpdatedAt = now;
            }

            int nextSeq = sequence.CurrentNumber;
            string docNumber = $"{nextSeq:D2}/{symbol}";

            doc.DocumentNumber = docNumber;
            doc.DocumentSequenceNumber = nextSeq;
            doc.DocumentSymbol = symbol;
            doc.Status = OutgoingDocumentStatusEnum.Issued;
            doc.SignedByUserId = request.UserId;
            doc.SignedAt = now;
            doc.IssuedDate = now;

            // ── Tự động tạo Công việc vào Trung tâm điều hành nếu gửi Cấp dưới ──
            if (doc.DestinationLevel == "Subordinate" && doc.AutoCreateTask)
            {
                var defaultAssignee = await _context.Users.FirstOrDefaultAsync(u => u.Id != request.UserId, cancellationToken);
                var assigneeId = defaultAssignee?.Id ?? request.UserId;

                var newTask = new TaskItem
                {
                    Id = Guid.NewGuid(),
                    Title = $"[Nhiệm vụ theo VB {docNumber}] {doc.Title}",
                    Description = $"Chỉ đạo thực hiện theo văn bản số {docNumber}.\nNơi nhận: {doc.RecipientNote ?? "Cấp dưới / Phòng ban"}.\n\nNội dung chi tiết:\n{doc.Content}",
                    AssignerId = request.UserId,
                    AssigneeId = assigneeId,
                    Priority = doc.IsUrgent || doc.UrgencyLevel == "Urgent" || doc.UrgencyLevel == "Express" ? TaskPriority.High : TaskPriority.Medium,
                    Status = TaskStatusEnum.Todo,
                    Type = TaskType.BAU,
                    DueDate = doc.ResponseDeadline ?? now.AddDays(7),
                    DocumentUrl = doc.AttachmentUrl,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                _context.TaskItems.Add(newTask);
                doc.RelatedTaskItemId = newTask.Id;
            }

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "SignAndIssueOutgoingDocument",
                EntityName = nameof(OutgoingDocument),
                EntityId = doc.Id.ToString(),
                Details = $"Ký và ban hành văn bản đi thành công. Số hiệu chính thức: {docNumber}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return docNumber;
        }

        public static string GetTypeAbbreviation(DocumentTypeEnum type) => type switch
        {
            DocumentTypeEnum.QuyetDinh => "QĐ",
            DocumentTypeEnum.CongVan => "CV",
            DocumentTypeEnum.ThongBao => "TB",
            DocumentTypeEnum.BaoCao => "BC",
            DocumentTypeEnum.KeHoach => "KH",
            DocumentTypeEnum.ToTrinh => "TTr",
            DocumentTypeEnum.CongDien => "CĐ",
            _ => "VB"
        };
    }
}
