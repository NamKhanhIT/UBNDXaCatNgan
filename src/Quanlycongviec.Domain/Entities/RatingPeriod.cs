using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class RatingPeriod : BaseEntity
    {
        public string Title { get; set; } = string.Empty;
        public string PeriodType { get; set; } = "Quarterly"; // "Monthly", "Quarterly", "Annual"
        public int Year { get; set; }
        public int? Quarter { get; set; }
        public int? Month { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsClosed { get; set; } = false;
        public DateTime? ClosedAt { get; set; }
        public Guid? ClosedByUserId { get; set; }
        public User? ClosedByUser { get; set; }
    }
}
