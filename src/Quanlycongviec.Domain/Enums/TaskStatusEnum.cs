namespace Quanlycongviec.Domain.Enums
{
    public enum TaskStatusEnum
    {
        Todo = 0,
        InProgress = 1,
        InReview = 2,
        Completed = 3,
        Cancelled = 4,
        PendingUBMTTQReview = 5  // Chờ phản biện UBMTTQ (bắt buộc cho TaskType.Project)
    }
}

