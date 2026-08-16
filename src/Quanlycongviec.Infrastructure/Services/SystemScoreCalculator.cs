using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Infrastructure.Services
{
    public class SystemScoreCalculator : ISystemScoreCalculator
    {
        private readonly ScoringOptions _options;

        public SystemScoreCalculator(IOptions<ScoringOptions> options)
        {
            _options = options.Value;
        }

        public SystemScoreBreakdown Calculate(TaskItem task, int rejectionCount, IReadOnlyCollection<SubTask>? subtasks)
        {
            if (task == null)
            {
                return new SystemScoreBreakdown();
            }

            // 1. Tiêu chí Đúng hạn (mặc định tối đa 15đ)
            double onTimeScore = _options.SystemOnTimeMaxScore;
            int daysLate = 0;

            var finishTime = task.CompletedAt ?? DateTime.UtcNow;

            if (task.DueDate.HasValue)
            {
                var dueDate = task.DueDate.Value;
                if (finishTime > dueDate)
                {
                    var timeSpanLate = finishTime - dueDate;
                    daysLate = (int)Math.Max(1, Math.Round(timeSpanLate.TotalDays, MidpointRounding.AwayFromZero));

                    var penalty = daysLate * _options.SystemLatePenaltyPerDay;
                    onTimeScore = Math.Max(0.0, _options.SystemOnTimeMaxScore - penalty);
                }
            }

            // 2. Tiêu chí Checklist công việc (mặc định tối đa 10đ)
            double checklistScore = _options.SystemChecklistMaxScore;
            int totalSubTasks = 0;
            int completedSubTasks = 0;

            if (subtasks != null && subtasks.Count > 0)
            {
                totalSubTasks = subtasks.Count;
                completedSubTasks = subtasks.Count(s => s.IsCompleted);
                double ratio = (double)completedSubTasks / totalSubTasks;
                checklistScore = Math.Round(ratio * _options.SystemChecklistMaxScore, 1);
            }

            // 3. Tiêu chí Không bị trả lại nhiều lần (mặc định tối đa 5đ)
            double noRejectionScore = _options.SystemNoRejectionMaxScore;
            if (rejectionCount > 0)
            {
                double penalty = rejectionCount * _options.SystemRejectionPenaltyPerTime;
                noRejectionScore = Math.Max(0.0, _options.SystemNoRejectionMaxScore - penalty);
            }

            // Tổng điểm hệ thống = onTimeScore + checklistScore + noRejectionScore (tối đa 30đ)
            double totalSystemScore = Math.Min(_options.MaxSystemScore, Math.Round(onTimeScore + checklistScore + noRejectionScore, 1));

            return new SystemScoreBreakdown
            {
                OnTimeScore = Math.Round(onTimeScore, 1),
                ChecklistScore = Math.Round(checklistScore, 1),
                NoRejectionScore = Math.Round(noRejectionScore, 1),
                TotalSystemScore = totalSystemScore,
                DaysLate = daysLate,
                TotalSubTasks = totalSubTasks,
                CompletedSubTasks = completedSubTasks,
                RejectionCount = rejectionCount
            };
        }
    }
}
