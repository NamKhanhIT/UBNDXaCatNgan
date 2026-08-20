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
        public DbSet<OutgoingDocument> OutgoingDocuments => Set<OutgoingDocument>();
        public DbSet<RatingHistory> RatingHistories => Set<RatingHistory>();
        public DbSet<DocumentNumberSequence> DocumentNumberSequences => Set<DocumentNumberSequence>();
        public DbSet<DocumentAttachment> DocumentAttachments => Set<DocumentAttachment>();
        public DbSet<DocumentVersion> DocumentVersions => Set<DocumentVersion>();
        public DbSet<CalendarEvent> CalendarEvents => Set<CalendarEvent>();
        public DbSet<EventParticipant> EventParticipants => Set<EventParticipant>();
        public DbSet<EventReminderOffset> EventReminderOffsets => Set<EventReminderOffset>();
        public DbSet<TaskReviewAnnotation> TaskReviewAnnotations => Set<TaskReviewAnnotation>();
        public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ── DocumentVersion: Indexes cho tra cứu lịch sử phiên bản ──
            modelBuilder.Entity<DocumentVersion>(entity =>
            {
                entity.HasIndex(v => new { v.DocumentId, v.VersionNumber });
                entity.HasIndex(v => v.ChangedByUserId);
            });

            // ── DocumentAttachment: Indexes cho tra cứu theo DocumentId + TargetType ──
            modelBuilder.Entity<DocumentAttachment>(entity =>
            {
                entity.HasIndex(a => new { a.DocumentId, a.TargetType });
                entity.HasIndex(a => a.UploadedByUserId);
            });

            // ── DocumentNumberSequence: Unique constraint chống trùng số theo (Year + Symbol) ──
            modelBuilder.Entity<DocumentNumberSequence>(entity =>
            {
                entity.HasIndex(s => new { s.Year, s.Symbol })
                    .IsUnique();
            });

            // ── RatingHistory: Enum conversions & Indexes ──
            modelBuilder.Entity<RatingHistory>(entity =>
            {
                entity.Property(r => r.ApprovalStatus)
                    .HasConversion<string>()
                    .HasMaxLength(30);

                entity.HasIndex(r => r.TaskItemId);
                entity.HasIndex(r => r.ApprovalStatus);
                entity.HasIndex(r => r.ChangedByUserId);

                entity.HasOne(r => r.TaskItem)
                    .WithMany()
                    .HasForeignKey(r => r.TaskItemId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ── OutgoingDocument: Enum conversions & Indexes ──
            modelBuilder.Entity<OutgoingDocument>(entity =>
            {
                entity.Property(o => o.DocumentType)
                    .HasConversion<string>()
                    .HasMaxLength(30);

                entity.Property(o => o.Status)
                    .HasConversion<string>()
                    .HasMaxLength(30);

                entity.HasIndex(o => o.Status);
                entity.HasIndex(o => o.DocumentType);
                entity.HasIndex(o => o.DraftedByUserId);
            });

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

                // ── Indexes cho phân trang / lọc hiệu năng cao ──
                entity.HasIndex(d => d.IsScheduled);
                entity.HasIndex(d => d.ReceivedDate);
                entity.HasIndex(d => d.Channel);
                entity.HasIndex(d => d.IsUrgent);
            });

            // ── ReadReceipt: Unique constraint (1 user chỉ đọc 1 entity 1 lần) ──
            modelBuilder.Entity<ReadReceipt>(entity =>
            {
                entity.HasIndex(r => new { r.UserId, r.TargetEntityType, r.TargetEntityId })
                    .IsUnique();
            });

            // ── TaskItem: Composite index cho lọc phổ biến (AssigneeId + Status + DueDate) ──
            modelBuilder.Entity<TaskItem>(entity =>
            {
                entity.HasIndex(t => new { t.AssigneeId, t.Status, t.DueDate });
            });

            // ── User: Index phục vụ tìm kiếm theo tên ──
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(u => u.FullName);
            });

            // ── UserRole: Indexes phục vụ lọc theo phòng ban / vai trò ──
            modelBuilder.Entity<UserRole>(entity =>
            {
                entity.HasIndex(ur => ur.DepartmentId);
                entity.HasIndex(ur => ur.RoleId);
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

            // ── CalendarEvent: Indexes & Enum conversion ──
            modelBuilder.Entity<CalendarEvent>(entity =>
            {
                entity.Property(e => e.EventType)
                    .HasConversion<string>()
                    .HasMaxLength(30);

                entity.HasIndex(e => new { e.StartDateTime, e.EndDateTime });
                entity.HasIndex(e => e.OrganizerId);
                entity.HasIndex(e => e.DepartmentId);

                entity.HasOne(e => e.Organizer)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizerId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // ── EventParticipant: Indexes & Enum conversion ──
            modelBuilder.Entity<EventParticipant>(entity =>
            {
                entity.Property(p => p.ResponseStatus)
                    .HasConversion<string>()
                    .HasMaxLength(20);

                entity.HasIndex(p => new { p.EventId, p.UserId });

                entity.HasOne(p => p.Event)
                    .WithMany(e => e.Participants)
                    .HasForeignKey(p => p.EventId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(p => p.User)
                    .WithMany()
                    .HasForeignKey(p => p.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ── EventReminderOffset: Index ──
            modelBuilder.Entity<EventReminderOffset>(entity =>
            {
                entity.HasIndex(r => r.EventId);

                entity.HasOne(r => r.Event)
                    .WithMany(e => e.ReminderOffsets)
                    .HasForeignKey(r => r.EventId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ── TaskReviewAnnotation: Indexes & Enum conversions ──
            modelBuilder.Entity<TaskReviewAnnotation>(entity =>
            {
                entity.Property(a => a.Severity)
                    .HasConversion<string>()
                    .HasMaxLength(30);

                entity.Property(a => a.ResolvedStatus)
                    .HasConversion<string>()
                    .HasMaxLength(30);

                entity.HasIndex(a => a.TaskItemId);
                entity.HasIndex(a => a.CreatedByUserId);
                entity.HasIndex(a => a.ResolvedStatus);

                entity.HasOne(a => a.TaskItem)
                    .WithMany(t => t.Annotations)
                    .HasForeignKey(a => a.TaskItemId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(a => a.CreatedByUser)
                    .WithMany()
                    .HasForeignKey(a => a.CreatedByUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.ResolvedByUser)
                    .WithMany()
                    .HasForeignKey(a => a.ResolvedByUserId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            // ── PushSubscription: Lưu trữ thông tin đăng ký nhận thông báo đẩy Web Push ──
            modelBuilder.Entity<PushSubscription>(entity =>
            {
                entity.Property(p => p.Endpoint)
                    .IsRequired()
                    .HasMaxLength(1000);

                entity.Property(p => p.P256dhKey)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(p => p.AuthKey)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(p => p.DeviceLabel)
                    .HasMaxLength(150);

                entity.HasIndex(p => p.UserId);
                entity.HasIndex(p => p.Endpoint);
                entity.HasIndex(p => new { p.UserId, p.IsActive });

                entity.HasOne(p => p.User)
                    .WithMany(u => u.PushSubscriptions)
                    .HasForeignKey(p => p.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ── RefreshToken: Chỉ lưu hash, unique theo TokenHash ──
            modelBuilder.Entity<RefreshToken>(entity =>
            {
                entity.Property(t => t.TokenHash)
                    .IsRequired()
                    .HasMaxLength(64);

                entity.HasIndex(t => t.TokenHash)
                    .IsUnique();

                entity.HasIndex(t => new { t.UserId, t.RevokedUtc });

                entity.HasOne(t => t.User)
                    .WithMany(u => u.RefreshTokens)
                    .HasForeignKey(t => t.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
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

