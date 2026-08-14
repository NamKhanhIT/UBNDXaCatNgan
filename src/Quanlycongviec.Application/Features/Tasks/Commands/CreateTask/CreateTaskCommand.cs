using System;
using MediatR;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.CreateTask
{
    public class CreateTaskCommand : IRequest<Guid>
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public Guid AssignerId { get; set; }
        public Guid AssigneeId { get; set; }
        public Guid? DepartmentId { get; set; }
        public TaskPriority Priority { get; set; } = TaskPriority.Medium;
        public TaskType Type { get; set; } = TaskType.BAU;
        public double EstimatedEffortHours { get; set; } = 8.0;
        public DateTime? StartDate { get; set; }
        public DateTime? DueDate { get; set; }
        public string? OCRText { get; set; }
        public string? DocumentUrl { get; set; }
        public bool IsDelegatedAction { get; set; } = false;
    }
}

