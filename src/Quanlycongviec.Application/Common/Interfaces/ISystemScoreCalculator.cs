using System.Collections.Generic;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public class SystemScoreBreakdown
    {
        public double OnTimeScore { get; set; }
        public double ChecklistScore { get; set; }
        public double NoRejectionScore { get; set; }
        public double TotalSystemScore { get; set; }

        public int DaysLate { get; set; }
        public int TotalSubTasks { get; set; }
        public int CompletedSubTasks { get; set; }
        public int RejectionCount { get; set; }
    }

    public interface ISystemScoreCalculator
    {
        /// <summary>
        /// Hàm tính điểm hệ thống khách quan, minh bạch, tất định 100%
        /// </summary>
        /// <param name="task">Nhiệm vụ cần tính điểm</param>
        /// <param name="rejectionCount">Số lần bị trả lại yêu cầu sửa</param>
        /// <param name="subtasks">Danh sách subtasks</param>
        /// <returns>SystemScoreBreakdown chi tiết</returns>
        SystemScoreBreakdown Calculate(TaskItem task, int rejectionCount, IReadOnlyCollection<SubTask>? subtasks);
    }
}
