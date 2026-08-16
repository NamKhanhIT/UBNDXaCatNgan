namespace Quanlycongviec.Domain.Enums
{
    public enum NotificationType
    {
        Assigned,
        BeforeDeadline,
        BeforeDeadline3d,
        BeforeDeadline1d,
        Overdue,
        Escalation,
        WeeklySummary,
        Comment,
        Reviewed,
        EventReminder,
        SubTaskProgress     // Thông báo 2 chiều khi tick SubTask (Prompt F)
    }
}
