using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;

namespace Quanlycongviec.Application.Tests;

internal static class WorkflowTestData
{
    public static void AddAssignmentRoles(ApplicationDbContext db, User assigner, User assignee)
    {
        var department = new Department { Code = "WORKFLOW_TEST", Name = "Phòng kiểm thử" };
        var leader = new Role { Code = "TEST_LEADER", Name = "Lãnh đạo kiểm thử", RankLevel = 1 };
        var officer = new Role { Code = "TEST_OFFICER", Name = "Chuyên viên kiểm thử", RankLevel = 5 };
        assigner.PrimaryDepartment = department;
        assignee.PrimaryDepartment = department;
        assigner.ActiveRoleCode = leader.Code;
        assignee.ActiveRoleCode = officer.Code;
        assigner.UserRoles.Add(new UserRole { User = assigner, Role = leader, IsPrimary = true });
        assignee.UserRoles.Add(new UserRole { User = assignee, Role = officer, IsPrimary = true });
        db.Users.AddRange(assigner, assignee);
    }
}
