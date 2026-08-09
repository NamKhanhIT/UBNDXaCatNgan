using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class WorkloadCapacity : BaseEntity
    {
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public double WeeklyMaxHours { get; set; } = 40.0; // Định mức giờ/tuần
        public double CurrentAssignedHours { get; set; } = 0.0;
        
        public double UtilizationRate => WeeklyMaxHours > 0 ? (CurrentAssignedHours / WeeklyMaxHours) * 100.0 : 0.0;
        public bool IsOverloaded => UtilizationRate > 100.0;
    }
}
