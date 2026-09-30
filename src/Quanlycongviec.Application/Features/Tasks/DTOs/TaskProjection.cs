using System.Linq.Expressions;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.Tasks.DTOs;

public static class TaskProjection
{
    public static readonly Expression<Func<TaskItem, TaskItemDto>> Summary = t => new TaskItemDto
    {
        Id = t.Id, Title = t.Title, Description = t.Description, Requirements = t.Requirements,
        AssignerId = t.AssignerId, AssignerName = t.Assigner.FullName,
        AssigneeId = t.AssigneeId, AssigneeName = t.Assignee.FullName,
        ReviewerId = t.ReviewerId, ReviewerName = t.Reviewer != null ? t.Reviewer.FullName : null,
        ParentTaskId = t.ParentTaskId, Version = t.Version, RequiresWorkflowReview = t.RequiresWorkflowReview,
        ProgressPercentage = t.ProgressPercentage,
        DepartmentId = t.DepartmentId, DepartmentName = t.Department != null ? t.Department.Name : null,
        Status = t.Status.ToString(), Priority = t.Priority.ToString(), Type = t.Type.ToString(),
        StartDate = t.StartDate, DueDate = t.DueDate, CreatedAt = t.CreatedAt, CompletedAt = t.CompletedAt,
        RejectionReason = t.RejectionReason, SubmissionNote = t.SubmissionNote, IsEscalated = t.IsEscalated,
        SystemScore = t.SystemScore, EvaluatorScore = t.EvaluatorScore, RatingScore = t.RatingScore,
        TotalAnnotationCount = t.Annotations.Count(a => !a.IsDeleted)
    };
}
