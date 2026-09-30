using System.Text.Json.Serialization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Api.Middleware;
using Quanlycongviec.Application;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure;
using Quanlycongviec.Infrastructure.Hubs;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using System.Threading.RateLimiting;

// A local acceptance fixture, using the real controllers, authorization, EF migrations, JWT,
// file storage and SignalR. It never loads appsettings, environment credentials or sample data.
if (!args.Contains("--isolated-workflow")) throw new InvalidOperationException("This fixture requires --isolated-workflow.");
const string server = "Host=127.0.0.1;Port=55439;Username=workflow_test;Pooling=false;Passfile=workflow-test-no-passfile";
const string database = "workflow_acceptance_20260930";
await using (var admin = new NpgsqlConnection(server + ";Database=postgres"))
{
    await admin.OpenAsync();
    await using var exists = new NpgsqlCommand("SELECT EXISTS (SELECT FROM pg_database WHERE datname=@name)", admin);
    exists.Parameters.AddWithValue("name", database);
    if (!(bool)(await exists.ExecuteScalarAsync())!)
        await new NpgsqlCommand("CREATE DATABASE " + database, admin).ExecuteNonQueryAsync();
}
var builder = WebApplication.CreateEmptyBuilder(new WebApplicationOptions
{ EnvironmentName = "Development", ApplicationName = typeof(AuthController).Assembly.FullName });
builder.WebHost.UseKestrel().UseUrls("http://127.0.0.1:5000");
builder.Logging.AddConsole().SetMinimumLevel(LogLevel.Warning);
builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["ConnectionStrings:DefaultConnection"] = server + ";Database=" + database,
    ["Jwt:Secret"] = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
    ["Jwt:Issuer"] = "WorkflowAcceptance", ["Jwt:Audience"] = "WorkflowAcceptance",
    ["DailyDigest:Enabled"] = "false", ["Reminder:IntervalMinutes"] = "15"
});
builder.Services.AddControllers().AddApplicationPart(typeof(AuthController).Assembly)
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddApplication(); builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins("http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001")
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddRateLimiter(options => options.AddFixedWindowLimiter("LoginLimiter", limiter =>
{ limiter.PermitLimit = 100; limiter.Window = TimeSpan.FromMinutes(1); }));
var app = builder.Build();
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();
    if (!await db.Users.AnyAsync())
    {
        var department = new Department { Code = "FIXTURE_A", Name = "Phòng kiểm thử A" };
        var outside = new Department { Code = "FIXTURE_B", Name = "Phòng kiểm thử B" };
        db.Departments.AddRange(department, outside);
        var hasher = new PasswordHasher();
        foreach (var (username, fullName, rank, code, dept) in new[]
        {
            ("fixture-leader", "Lãnh đạo kiểm thử", 1, "ChuTichUBND", department),
            ("fixture-deputy", "Phó phòng kiểm thử", 4, "PhoPhong", department),
            ("fixture-officer", "Chủ trì kiểm thử", 5, "ChuyenVien", department),
            ("fixture-partner", "Phối hợp kiểm thử", 5, "ChuyenVien", department),
            ("fixture-intake", "Tiếp nhận kiểm thử", 5, "ChuyenVien", department),
            ("fixture-outside", "Chuyên viên phòng khác", 5, "ChuyenVien", outside)
        })
        {
            var role = db.Roles.Local.FirstOrDefault(r => r.Code == code) ?? new Role { Code = code, Name = fullName, RankLevel = rank };
            var user = new User { Username = username, Email = username + "@example.invalid", FullName = fullName,
                PrimaryDepartment = dept, ActiveRoleCode = code, PasswordHash = hasher.HashPassword("WorkflowFixture2026!") };
            user.UserRoles.Add(new UserRole { User = user, Role = role, Department = dept, IsPrimary = true });
            db.Users.Add(user);
            if (username == "fixture-intake" || username == "fixture-leader")
                db.WorkflowPermissions.Add(new WorkflowPermission { User = user,
                    CanReceiveDocuments = username == "fixture-intake", CanManageWorkflowPermissions = username == "fixture-leader" });
        }
        await db.SaveChangesAsync();
    }
}
app.UseMiddleware<ApiExceptionHandlingMiddleware>();
app.UseCors(); app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
app.MapControllers(); app.MapHub<NotificationHub>("/hubs/notifications");
app.MapGet("/health", () => new { fixture = true, database, externalDeliveryVerified = false });
Console.WriteLine("Isolated workflow fixture ready on 127.0.0.1:5000; PostgreSQL 127.0.0.1:55439. No sample configuration loaded.");
await app.RunAsync();
