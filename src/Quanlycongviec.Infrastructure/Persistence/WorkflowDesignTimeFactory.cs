using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Quanlycongviec.Infrastructure.Persistence;

/// <summary>Build migration metadata without loading application configuration or credentials.</summary>
public sealed class WorkflowDesignTimeFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        if (!args.Contains("--workflow-design"))
            throw new InvalidOperationException("Schema tooling requires --workflow-design. Apply reviewed migration SQL with your normal database administration tool.");
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=workflow_schema;Username=workflow_schema")
            .Options;
        return new ApplicationDbContext(options);
    }
}
