using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Resilience
{
    /// <summary>
    /// TIER 1: Bộ 100 Kịch bản kiểm thử ma trận phân quyền & thẩm quyền chức danh UBND cấp xã
    /// </summary>
    public class Tier1_AuthorizationRoleMatrixTests
    {
        private readonly ApplicationDbContext _context;
        private readonly ITaskAuthorizationService _authService;

        private readonly Department _depVanPhong;
        private readonly Department _depKinhTe;
        private readonly Department _depVanHoa;

        private readonly Dictionary<string, Role> _roles = new();
        private readonly Dictionary<string, User> _users = new();

        public Tier1_AuthorizationRoleMatrixTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);

            _depVanPhong = new Department { Name = "Văn phòng HĐND & UBND", Code = "VAN_PHONG" };
            _depKinhTe = new Department { Name = "Phòng Kinh tế - Hạ tầng", Code = "KINH_TE" };
            _depVanHoa = new Department { Name = "Phòng Văn hóa - Xã hội", Code = "VAN_HOA_XA_HOI" };
            _context.Departments.AddRange(_depVanPhong, _depKinhTe, _depVanHoa);

            var roleDefs = new (string Code, string Name, int Rank)[]
            {
                ("ChuTichUBND", "Chủ tịch UBND", 1),
                ("BiThuDU", "Bí thư Đảng ủy", 1),
                ("ChuTichHDND", "Chủ tịch HĐND", 1),
                ("PhoChuTichUBND", "Phó Chủ tịch UBND", 2),
                ("ChanhVanPhong", "Chánh Văn phòng HĐND & UBND", 3),
                ("TruongPhong", "Trưởng phòng chuyên môn", 3),
                ("PhoPhong", "Phó Trưởng phòng", 4),
                ("ChuyenVien", "Chuyên viên", 5),
            };

            foreach (var def in roleDefs)
            {
                var role = new Role { Name = def.Name, Code = def.Code, RankLevel = def.Rank };
                _roles[def.Code] = role;
                _context.Roles.Add(role);
            }

            // Tạo danh sách Users mẫu thuộc các phòng ban
            CreateUser("chutich", "ChuTichUBND", _depVanPhong);
            CreateUser("pct", "PhoChuTichUBND", _depVanPhong);
            CreateUser("chanh_vp", "ChanhVanPhong", _depVanPhong);
            CreateUser("tp_kt", "TruongPhong", _depKinhTe);
            CreateUser("tp_vh", "TruongPhong", _depVanHoa);
            CreateUser("pp_kt", "PhoPhong", _depKinhTe);
            CreateUser("pp_vh", "PhoPhong", _depVanHoa);
            CreateUser("cv_vp", "ChuyenVien", _depVanPhong);
            CreateUser("cv_kt1", "ChuyenVien", _depKinhTe);
            CreateUser("cv_kt2", "ChuyenVien", _depKinhTe);
            CreateUser("cv_vh1", "ChuyenVien", _depVanHoa);
            CreateUser("cv_vh2", "ChuyenVien", _depVanHoa);

            _context.SaveChanges();
            _authService = new TaskAuthorizationService(_context);
        }

        private void CreateUser(string username, string roleCode, Department dept)
        {
            var user = new User
            {
                Username = username,
                FullName = $"Cán bộ {username.ToUpper()}",
                Email = $"{username}@ubnd.gov.vn",
                PrimaryDepartmentId = dept.Id,
                ActiveRoleCode = roleCode
            };
            _users[username] = user;
            _context.Users.Add(user);

            var userRole = new UserRole
            {
                UserId = user.Id,
                RoleId = _roles[roleCode].Id,
                DepartmentId = dept.Id,
                IsPrimary = true
            };
            _context.UserRoles.Add(userRole);
        }

        public static IEnumerable<object[]> AssignTaskMatrixData()
        {
            // 40 kịch bản tổ hợp Giao việc (Assigner -> Assignee, TargetDept, ExpectedResult)
            var assigners = new[] { "chutich", "pct", "chanh_vp", "tp_kt", "pp_kt", "cv_kt1" };
            var assignees = new[] { "pct", "chanh_vp", "tp_kt", "pp_kt", "cv_kt1", "cv_vh1", "cv_vp" };

            foreach (var assigner in assigners)
            {
                foreach (var assignee in assignees)
                {
                    if (assigner == assignee) continue;

                    bool expected;
                    if (assigner == "chutich") expected = true; // Rank 1 giao cho tất cả cấp dưới
                    else if (assigner == "pct") expected = assignee != "chutich"; // Rank 2 giao cho Rank 3, 4, 5
                    else if (assigner == "chanh_vp") expected = assignee.StartsWith("cv_") || assignee.StartsWith("pp_"); // Rank 3 giao xuống Rank 4, 5
                    else if (assigner == "tp_kt") expected = assignee == "pp_kt" || assignee == "cv_kt1" || assignee == "cv_kt2"; // Nội bộ KT
                    else if (assigner == "pp_kt") expected = assignee == "cv_kt1" || assignee == "cv_kt2"; // Nội bộ KT xuống CV
                    else expected = false; // Chuyên viên không giao việc

                    yield return new object[] { assigner, assignee, expected };
                }
            }
        }

        [Theory]
        [MemberData(nameof(AssignTaskMatrixData))]
        public async Task Tier1_01_AssignTask_Matrix_ShouldEnforceStrictRankLevel(string assignerKey, string assigneeKey, bool expected)
        {
            var assigner = _users[assignerKey];
            var assignee = _users[assigneeKey];

            var result = await _authService.CanAssignTaskAsync(assigner.Id, assignee.Id, assignee.PrimaryDepartmentId);
            result.Should().Be(expected, $"Assigner {assignerKey} giao việc cho {assigneeKey} phải trả về {expected}");
        }

        public static IEnumerable<object[]> TransferTaskMatrixData()
        {
            // 30 kịch bản tổ hợp Điều chuyển công việc (Manager, OldAssignee, TargetUser, Expected)
            var managers = new[] { "chutich", "pct", "chanh_vp", "tp_kt", "pp_kt", "cv_kt1" };
            var targetUsers = new[] { "cv_kt1", "cv_kt2", "cv_vh1", "cv_vp", "pp_kt" };

            foreach (var m in managers)
            {
                foreach (var t in targetUsers)
                {
                    bool expected;
                    if (m == "chutich" || m == "pct" || m == "chanh_vp") expected = (t != m);
                    else if (m == "tp_kt") expected = (t == "cv_kt1" || t == "cv_kt2" || t == "pp_kt");
                    else expected = false;

                    yield return new object[] { m, "cv_kt1", t, expected };
                }
            }
        }

        [Theory]
        [MemberData(nameof(TransferTaskMatrixData))]
        public async Task Tier1_02_TransferTask_Matrix_ShouldEnforceScope(string managerKey, string oldAssigneeKey, string targetUserKey, bool expected)
        {
            var manager = _users[managerKey];
            var oldAssignee = _users[oldAssigneeKey];
            var targetUser = _users[targetUserKey];

            var task = new TaskItem
            {
                Title = $"Task test {Guid.NewGuid()}",
                AssignerId = _users["tp_kt"].Id,
                AssigneeId = oldAssignee.Id,
                DepartmentId = oldAssignee.PrimaryDepartmentId
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            var result = await _authService.CanTransferTaskAsync(manager.Id, task.Id, targetUser.Id);
            result.Should().Be(expected, $"Manager {managerKey} điều chuyển task từ {oldAssigneeKey} sang {targetUserKey} phải là {expected}");
        }

        public static IEnumerable<object[]> UpdateTaskStatusMatrixData()
        {
            // 20 kịch bản cập nhật trạng thái nhiệm vụ
            var users = new[] { "chutich", "pct", "tp_kt", "cv_kt1", "cv_vh1" };
            var statuses = new[] { TaskStatusEnum.InProgress, TaskStatusEnum.InReview, TaskStatusEnum.Completed, TaskStatusEnum.Cancelled };

            foreach (var u in users)
            {
                foreach (var s in statuses)
                {
                    bool expected;
                    if (s == TaskStatusEnum.Completed)
                    {
                        expected = u == "tp_kt"; // Only the designated reviewer may accept.
                    }
                    else if (s == TaskStatusEnum.Cancelled)
                    {
                        expected = (u == "chutich" || u == "pct" || u == "tp_kt"); // Chỉ Assigner hoặc Lãnh đạo mới huỷ
                    }
                    else
                    {
                        expected = u == "cv_kt1"; // Only the assignee starts and submits their work.
                    }

                    yield return new object[] { u, s, expected };
                }
            }
        }

        [Theory]
        [MemberData(nameof(UpdateTaskStatusMatrixData))]
        public async Task Tier1_03_UpdateTaskStatus_Matrix_ShouldEnforceApprovalAuthority(string userKey, TaskStatusEnum status, bool expected)
        {
            var user = _users[userKey];
            var task = new TaskItem
            {
                Title = $"Task test status {Guid.NewGuid()}",
                AssignerId = _users["tp_kt"].Id,
                AssigneeId = _users["cv_kt1"].Id,
                DepartmentId = _depKinhTe.Id,
                ReviewerId = _users["tp_kt"].Id,
                Status = status == TaskStatusEnum.InProgress ? TaskStatusEnum.Todo
                    : status == TaskStatusEnum.Completed ? TaskStatusEnum.InReview : TaskStatusEnum.InProgress
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            var result = await _authService.CanUpdateTaskStatusAsync(user.Id, task.Id, status);
            result.Should().Be(expected, $"User {userKey} chuyển task sang trạng thái {status} phải là {expected}");
        }
    }
}
