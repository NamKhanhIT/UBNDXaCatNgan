using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Infrastructure.Persistence
{
    public class ApplicationDbContext : DbContext, IApplicationDbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<UserRole> UserRoles => Set<UserRole>();
        public DbSet<Department> Departments => Set<Department>();
        public DbSet<Delegation> Delegations => Set<Delegation>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<TaskItem> TaskItems => Set<TaskItem>();
        public DbSet<SubTask> SubTasks => Set<SubTask>();
        public DbSet<TaskComment> TaskComments => Set<TaskComment>();
        public DbSet<WorkloadCapacity> WorkloadCapacities => Set<WorkloadCapacity>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<ReminderLog> ReminderLogs => Set<ReminderLog>();
        public DbSet<InboxDocument> InboxDocuments => Set<InboxDocument>();
        public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
        public DbSet<ReadReceipt> ReadReceipts => Set<ReadReceipt>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ── Enum → string conversions (tránh sai lệch khi enum bị chỉnh sửa) ──
            modelBuilder.Entity<TaskItem>(entity =>
            {
                entity.Property(t => t.Priority)
                    .HasConversion<string>()
                    .HasMaxLength(20);

                entity.Property(t => t.Status)
                    .HasConversion<string>()
                    .HasMaxLength(20);

                entity.Property(t => t.Type)
                    .HasConversion<string>()
                    .HasMaxLength(20);
            });

            // ── Notification: Enum → string conversions ──
            modelBuilder.Entity<Notification>(entity =>
            {
                entity.Property(n => n.Type)
                    .HasConversion<string>()
                    .HasMaxLength(30);

                entity.Property(n => n.Channel)
                    .HasConversion<string>()
                    .HasMaxLength(20);
            });

            // ── ReminderLog: Unique constraint chống gửi trùng cấp CSDL ──
            modelBuilder.Entity<ReminderLog>(entity =>
            {
                entity.HasIndex(r => new { r.TaskItemId, r.ReminderType })
                    .IsUnique();
            });

            // ── InboxDocument: Channel enum → string ──
            modelBuilder.Entity<InboxDocument>(entity =>
            {
                entity.Property(d => d.Channel)
                    .HasConversion<string>()
                    .HasMaxLength(20)
                    .HasDefaultValue(Quanlycongviec.Domain.Enums.InboxChannel.Internal);
            });

            // ── ReadReceipt: Unique constraint (1 user chỉ đọc 1 entity 1 lần) ──
            modelBuilder.Entity<ReadReceipt>(entity =>
            {
                entity.HasIndex(r => new { r.UserId, r.TargetEntityType, r.TargetEntityId })
                    .IsUnique();
            });

            // ── WorkloadCapacity: Ignore computed properties (runtime-only) ──
            modelBuilder.Entity<WorkloadCapacity>(entity =>
            {
                entity.Ignore(w => w.UtilizationRate);
                entity.Ignore(w => w.IsOverloaded);
            });

            // ── FK: UserRole ──
            modelBuilder.Entity<UserRole>()
                .HasOne(ur => ur.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(ur => ur.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserRole>()
                .HasOne(ur => ur.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(ur => ur.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            // ── FK: Delegation ──
            modelBuilder.Entity<Delegation>()
                .HasOne(d => d.Delegator)
                .WithMany(u => u.DelegationsGiven)
                .HasForeignKey(d => d.DelegatorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Delegation>()
                .HasOne(d => d.Delegatee)
                .WithMany(u => u.DelegationsReceived)
                .HasForeignKey(d => d.DelegateeId)
                .OnDelete(DeleteBehavior.Restrict);

            // ── FK: TaskItem ──
            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Assigner)
                .WithMany(u => u.CreatedTasks)
                .HasForeignKey(t => t.AssignerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Assignee)
                .WithMany(u => u.AssignedTasks)
                .HasForeignKey(t => t.AssigneeId)
                .OnDelete(DeleteBehavior.Restrict);
        }

        public override async System.Threading.Tasks.Task<int> SaveChangesAsync(System.Threading.CancellationToken cancellationToken = default)
        {
            // ── Chống sửa/xoá AuditLog (Append-Only Enforcement) ──
            foreach (var entry in ChangeTracker.Entries<AuditLog>())
            {
                if (entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
                {
                    throw new System.InvalidOperationException("Sổ kiểm toán (AuditLog) là append-only, tuyệt đối không được phép sửa hoặc xóa.");
                }
            }

            return await base.SaveChangesAsync(cancellationToken);
        }
    }
}

