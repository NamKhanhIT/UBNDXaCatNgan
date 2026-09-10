using System;
using System.Collections.Generic;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class SystemScoreCalculatorTests
    {
        private readonly SystemScoreCalculator _calculator;

        public SystemScoreCalculatorTests()
        {
            var options = Options.Create(new ScoringOptions
            {
                SystemOnTimeMaxScore = 1.5,
                SystemLatePenaltyPerDay = 0.2,
                SystemChecklistMaxScore = 1.0,
                SystemNoRejectionMaxScore = 0.5,
                SystemRejectionPenaltyPerTime = 0.25,
                MaxSystemScore = 3.0,
                MaxEvaluatorScore = 7.0,
                TotalMaxScore = 10.0
            });
            _calculator = new SystemScoreCalculator(options);
        }

        [Fact]
        public void Calculate_OnTimeAndComplete_ShouldReturnFull3Points()
        {
            var finish = new DateTime(2026, 8, 10, 10, 0, 0, DateTimeKind.Utc);
            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                DueDate = finish.AddDays(1),
                CompletedAt = finish
            };

            var subtasks = new List<SubTask>
            {
                new SubTask { Id = Guid.NewGuid(), Title = "Step 1", IsCompleted = true },
                new SubTask { Id = Guid.NewGuid(), Title = "Step 2", IsCompleted = true }
            };

            var result = _calculator.Calculate(task, 0, subtasks);

            Assert.Equal(1.5, result.OnTimeScore);
            Assert.Equal(1.0, result.ChecklistScore);
            Assert.Equal(0.5, result.NoRejectionScore);
            Assert.Equal(3.0, result.TotalSystemScore);
            Assert.Equal(0, result.DaysLate);
            Assert.Equal(2, result.CompletedSubTasks);
        }

        [Fact]
        public void Calculate_LateByTwoDays_ShouldDeductPointFour()
        {
            var finish = new DateTime(2026, 8, 10, 10, 0, 0, DateTimeKind.Utc);
            var dueDate = finish.AddDays(-2);
            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                DueDate = dueDate,
                CompletedAt = finish
            };

            var result = _calculator.Calculate(task, 0, null);

            Assert.Equal(1.1, result.OnTimeScore); // 1.5 - (2 * 0.2) = 1.1
            Assert.Equal(1.0, result.ChecklistScore); // No subtasks -> default 1.0
            Assert.Equal(0.5, result.NoRejectionScore);
            Assert.Equal(2.6, result.TotalSystemScore); // 1.1 + 1.0 + 0.5 = 2.6
            Assert.Equal(2, result.DaysLate);
        }

        [Fact]
        public void Calculate_SubTasksHalfCompleted_ShouldReturnHalfChecklistPoint()
        {
            var finish = new DateTime(2026, 8, 10, 10, 0, 0, DateTimeKind.Utc);
            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                DueDate = finish.AddDays(1),
                CompletedAt = finish
            };

            var subtasks = new List<SubTask>
            {
                new SubTask { Id = Guid.NewGuid(), Title = "Step 1", IsCompleted = true },
                new SubTask { Id = Guid.NewGuid(), Title = "Step 2", IsCompleted = false },
                new SubTask { Id = Guid.NewGuid(), Title = "Step 3", IsCompleted = true },
                new SubTask { Id = Guid.NewGuid(), Title = "Step 4", IsCompleted = false }
            };

            var result = _calculator.Calculate(task, 0, subtasks);

            Assert.Equal(1.5, result.OnTimeScore);
            Assert.Equal(0.5, result.ChecklistScore); // 2/4 * 1.0 = 0.5
            Assert.Equal(0.5, result.NoRejectionScore);
            Assert.Equal(2.5, result.TotalSystemScore);
        }

        [Fact]
        public void Calculate_MultipleRejections_ShouldDeductRejectionPoints()
        {
            var finish = new DateTime(2026, 8, 10, 10, 0, 0, DateTimeKind.Utc);
            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                DueDate = finish.AddDays(1),
                CompletedAt = finish
            };

            // 1 rejection: 0.5 - 0.25 = 0.25 -> Bankers rounding rounds to even 0.2. Total: 1.5 + 1.0 + 0.25 = 2.75 -> 2.8
            var result1 = _calculator.Calculate(task, 1, null);
            Assert.Equal(0.2, result1.NoRejectionScore);
            Assert.Equal(2.8, result1.TotalSystemScore);

            // 2 rejections: 0.5 - 0.5 = 0.0 -> Total: 1.5 + 1.0 + 0.0 = 2.5
            var result2 = _calculator.Calculate(task, 2, null);
            Assert.Equal(0.0, result2.NoRejectionScore);
            Assert.Equal(2.5, result2.TotalSystemScore);
        }

        [Fact]
        public void ScoringOptions_DefaultScale_ShouldHaveSystemMax3_EvaluatorMax7_Total10()
        {
            var defaultOptions = new ScoringOptions();
            Assert.Equal(3.0, defaultOptions.MaxSystemScore);
            Assert.Equal(7.0, defaultOptions.MaxEvaluatorScore);
            Assert.Equal(10.0, defaultOptions.TotalMaxScore);
            Assert.Equal(1.5, defaultOptions.SystemOnTimeMaxScore);
            Assert.Equal(1.0, defaultOptions.SystemChecklistMaxScore);
            Assert.Equal(0.5, defaultOptions.SystemNoRejectionMaxScore);
        }
    }
}
