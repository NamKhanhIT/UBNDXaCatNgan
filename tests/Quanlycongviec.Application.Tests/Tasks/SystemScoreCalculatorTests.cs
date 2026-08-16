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
                SystemOnTimeMaxScore = 15.0,
                SystemLatePenaltyPerDay = 2.0,
                SystemChecklistMaxScore = 10.0,
                SystemNoRejectionMaxScore = 5.0,
                SystemRejectionPenaltyPerTime = 2.5,
                MaxSystemScore = 30.0
            });
            _calculator = new SystemScoreCalculator(options);
        }

        [Fact]
        public void Calculate_OnTimeAndComplete_ShouldReturnFull30Points()
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

            Assert.Equal(15.0, result.OnTimeScore);
            Assert.Equal(10.0, result.ChecklistScore);
            Assert.Equal(5.0, result.NoRejectionScore);
            Assert.Equal(30.0, result.TotalSystemScore);
            Assert.Equal(0, result.DaysLate);
            Assert.Equal(2, result.CompletedSubTasks);
        }

        [Fact]
        public void Calculate_LateByTwoDays_ShouldDeductFourPoints()
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

            Assert.Equal(11.0, result.OnTimeScore); // 15 - (2 * 2) = 11
            Assert.Equal(10.0, result.ChecklistScore); // No subtasks -> 10.0
            Assert.Equal(5.0, result.NoRejectionScore);
            Assert.Equal(26.0, result.TotalSystemScore);
            Assert.Equal(2, result.DaysLate);
        }

        [Fact]
        public void Calculate_SubTasksHalfCompleted_ShouldReturnFiveChecklistPoints()
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

            Assert.Equal(15.0, result.OnTimeScore);
            Assert.Equal(5.0, result.ChecklistScore); // 2/4 * 10 = 5.0
            Assert.Equal(5.0, result.NoRejectionScore);
            Assert.Equal(25.0, result.TotalSystemScore);
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

            // 1 rejection: 5 - 2.5 = 2.5
            var result1 = _calculator.Calculate(task, 1, null);
            Assert.Equal(2.5, result1.NoRejectionScore);
            Assert.Equal(27.5, result1.TotalSystemScore);

            // 2 rejections: 5 - 5.0 = 0.0
            var result2 = _calculator.Calculate(task, 2, null);
            Assert.Equal(0.0, result2.NoRejectionScore);
            Assert.Equal(25.0, result2.TotalSystemScore);
        }
    }
}
