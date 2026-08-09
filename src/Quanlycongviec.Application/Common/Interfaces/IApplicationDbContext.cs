using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IApplicationDbContext
    {
        DbSet<User> Users { get; }
        DbSet<Role> Roles { get; }
        DbSet<UserRole> UserRoles { get; }
        DbSet<Department> Departments { get; }
        DbSet<Delegation> Delegations { get; }
        DbSet<AuditLog> AuditLogs { get; }
        DbSet<TaskItem> TaskItems { get; }
        DbSet<SubTask> SubTasks { get; }
        DbSet<TaskComment> TaskComments { get; }
        DbSet<WorkloadCapacity> WorkloadCapacities { get; }
        DbSet<Notification> Notifications { get; }
        DbSet<ReminderLog> ReminderLogs { get; }
        DbSet<InboxDocument> InboxDocuments { get; }
        DbSet<ActivityLog> ActivityLogs { get; }
        DbSet<ReadReceipt> ReadReceipts { get; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

