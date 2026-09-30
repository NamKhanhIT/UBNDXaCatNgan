using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Infrastructure.Persistence;

public sealed class WorkflowTaskConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> e)
    {
        e.Property(x => x.Version).IsConcurrencyToken();
        e.HasOne(x => x.Reviewer).WithMany().HasForeignKey(x => x.ReviewerId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.ParentTask).WithMany(x => x.CoordinationTasks).HasForeignKey(x => x.ParentTaskId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => new { x.ReviewerId, x.Status, x.IsDeleted });
    }
}
