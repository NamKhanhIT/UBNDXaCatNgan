using System;
using Quanlycongviec.Domain.Common;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Domain.Entities
{
    public class InboxDocument : BaseEntity
    {
        public string DocumentNumber { get; set; } = string.Empty; // Mã công văn: 88/UBND-VP
        public string Subject { get; set; } = string.Empty; // Tiêu đề công văn
        public string Category { get; set; } = string.Empty; // Chỉ đạo / Tờ trình / Công văn
        public string Sender { get; set; } = string.Empty; // Đơn vị gửi
        public DateTime ReceivedDate { get; set; } = DateTime.UtcNow;
        public bool IsUrgent { get; set; } = false; // Thượng khẩn / Khẩn
        
        /// <summary>
        /// Phân luồng theo Luật 72/2025: Internal (chỉ đạo nội bộ) | PublicService (TTHC công dân)
        /// </summary>
        public InboxChannel Channel { get; set; } = InboxChannel.Internal;

        // ── Thông tin TTHC công dân (chỉ dùng khi Channel = PublicService) ──
        public string? CitizenName { get; set; }     // Tên công dân nộp hồ sơ
        public string? CitizenPhone { get; set; }    // SĐT liên hệ
        public string? ServiceCode { get; set; }     // Mã TTHC (VD: DK-001, XD-003)
        
        // ── Thông tin nghiệp vụ văn bản theo NĐ 30/2020/NĐ-CP ──
        public string? DocumentSymbol { get; set; }     // Ký hiệu: UBND-VP, UBND-KT...
        public string? IssuingAgency { get; set; }      // Cơ quan ban hành: UBND huyện Đức Thọ
        public string? SignerName { get; set; }         // Người ký văn bản
        public string? AttachmentUrl { get; set; }      // URL file đính kèm chính
        public DateTime? IssuedDate { get; set; }       // Ngày ban hành văn bản

        // ── Xếp lịch xử lý ──
        public bool IsScheduled { get; set; } = false; // Trạng thái đã xếp lịch
        public DateTime? ScheduledDate { get; set; }
        public string? ScheduledShift { get; set; } // Sang / Chieu / Toi
        public Guid? ScheduledTaskId { get; set; } // TaskItem liên kết
        public TaskItem? ScheduledTask { get; set; }

        // ── Kết quả AI phân tích văn bản (Prompt F) ──
        // Mọi field nullable: nếu AI không tìm thấy trong văn bản → null, không suy diễn
        public string? AiCategory { get; set; }              // DocumentCategory enum → string
        public string? AiTitle { get; set; }                 // Tiêu đề AI trích xuất
        public string? AiSummary { get; set; }               // Tóm tắt nội dung
        public DateTime? AiExtractedDeadline { get; set; }   // Hạn chót trích xuất
        public string? AiExtractedSubjects { get; set; }     // Đối tượng liên quan (JSON array)
        public string? AiObjectives { get; set; }            // Mục tiêu/yêu cầu
        public Guid? AiSuggestedDepartmentId { get; set; }   // Phòng ban gợi ý — LUÔN là Id thật đã validate, không lưu text tự do
        public double? AiConfidenceScore { get; set; }       // Độ tin cậy 0.0 - 1.0
        public DateTime? AiEventStartDateTime { get; set; }  // Thời gian bắt đầu (nếu là họp/sự kiện)
        public DateTime? AiEventEndDateTime { get; set; }    // Thời gian kết thúc

        // ── Kiểm duyệt AI (human-in-the-loop) ──
        public Guid? AiReviewedByUserId { get; set; }        // null = chưa duyệt → không cho đi tiếp bước sau
        public DateTime? AiReviewedAt { get; set; }
        public string? AiProcessingStatus { get; set; }      // "Pending" | "Analyzed" | "Reviewed" | "Confirmed"
    }
}

