using System;

namespace Quanlycongviec.Application.Features.Inbox.DTOs
{
    public class InboxDocumentDto
    {
        public Guid Id { get; set; }
        public string DocumentNumber { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Sender { get; set; } = string.Empty;
        public DateTime ReceivedDate { get; set; }
        public bool IsUrgent { get; set; }
        public string Channel { get; set; } = "Internal";
        public string? CitizenName { get; set; }
        public string? CitizenPhone { get; set; }
        public string? ServiceCode { get; set; }
        public bool IsScheduled { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public string? ScheduledShift { get; set; }
        public Guid? ScheduledTaskId { get; set; }

        // ── Thông tin nghiệp vụ văn bản theo NĐ 30/2020 ──
        public string? DocumentSymbol { get; set; }
        public string? IssuingAgency { get; set; }
        public string? SignerName { get; set; }
        public string? AttachmentUrl { get; set; }
        public DateTime? IssuedDate { get; set; }
    }
}

