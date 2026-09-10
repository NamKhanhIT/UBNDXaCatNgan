using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Application.Features.Tasks.Commands.TransferTask;
using Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class TaskAuthorizationTests
    {
        private readonly ApplicationDbContext _context;
        private readonly ITaskAuthorizationService _authService;

        private readonly Department _depVanPhong;
        private readonly Department _depKinhTe;
        private readonly Department _depVanHoa;

        private readonly Role _roleChuTich;
        private readonly Role _rolePhoChuTich;
        private readonly Role _roleChanhVanPhong;
        private readonly Role _roleTruongPhong;
        private readonly Role _rolePhoPhong;
        private readonly Role _roleChuyenVien;

        private readonly User _userChuTich;
        private readonly User _userPhoChuTich;
        private readonly User _userChanhVanPhong;
        private readonly User _userTruongPhongKinhTe;
        private readonly User _userPhoPhongKinhTe;
        private readonly User _userChuyenVienKinhTe;
        private readonly User _userChuyenVienVanHoa;

        public TaskAuthorizationTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);

            // 1. Khởi tạo Departments
            _depVanPhong = new Department { Name = "Văn phòng HĐND & UBND", Code = "VAN_PHONG" };
            _depKinhTe = new Department { Name = "Phòng Kinh tế - Hạ tầng & Đô thị", Code = "KINH_TE" };
            _depVanHoa = new Department { Name = "Phòng Văn hóa - Xã hội", Code = "VAN_HOA_XA_HOI" };
            _context.Departments.AddRange(_depVanPhong, _depKinhTe, _depVanHoa);

            // 2. Khởi tạo Roles theo chuẩn RankLevel (1: Chủ tịch, 2: Phó CT, 3: Chánh VP/Trưởng phòng, 4: Phó phòng, 5: Chuyên viên)
            _roleChuTich = new Role { Name = "Chủ tịch UBND", Code = "ChuTichUBND", RankLevel = 1 };
            _rolePhoChuTich = new Role { Name = "Phó Chủ tịch UBND", Code = "PhoChuTichUBND", RankLevel = 2 };
            _roleChanhVanPhong = new Role { Name = "Chánh Văn phòng HĐND & UBND", Code = "ChanhVanPhong", RankLevel = 3 };
            _roleTruongPhong = new Role { Name = "Trưởng phòng", Code = "TruongPhong", RankLevel = 3 };
            _rolePhoPhong = new Role { Name = "Phó Trưởng phòng", Code = "PhoPhong", RankLevel = 4 };
            _roleChuyenVien = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            _context.Roles.AddRange(_roleChuTich, _rolePhoChuTich, _roleChanhVanPhong, _roleTruongPhong, _rolePhoPhong, _roleChuyenVien);

            // 3. Khởi tạo Users
            _userChuTich = new User { Username = "chutich", FullName = "Nguyễn Đình Hùng", Email = "chutich@ubnd.gov.vn", PrimaryDepartmentId = _depVanPhong.Id, ActiveRoleCode = "ChuTichUBND" };
            _userPhoChuTich = new User { Username = "pct", FullName = "Nguyễn Văn Hoàng", Email = "pct@ubnd.gov.vn", PrimaryDepartmentId = _depVanPhong.Id, ActiveRoleCode = "PhoChuTichUBND" };
            _userChanhVanPhong = new User { Username = "chanh_vp", FullName = "Hoàng Đức Minh", Email = "chanhvp@ubnd.gov.vn", PrimaryDepartmentId = _depVanPhong.Id, ActiveRoleCode = "ChanhVanPhong" };
            _userTruongPhongKinhTe = new User { Username = "tp_kt", FullName = "Lê Văn Tùng", Email = "tpkt@ubnd.gov.vn", PrimaryDepartmentId = _depKinhTe.Id, ActiveRoleCode = "TruongPhong" };
            _userPhoPhongKinhTe = new User { Username = "ptp_kt", FullName = "Đặng Văn Lộc", Email = "ptpkt@ubnd.gov.vn", PrimaryDepartmentId = _depKinhTe.Id, ActiveRoleCode = "PhoPhong" };
            _userChuyenVienKinhTe = new User { Username = "cv_kt", FullName = "Nguyễn Văn Nam", Email = "nam@ubnd.gov.vn", PrimaryDepartmentId = _depKinhTe.Id, ActiveRoleCode = "ChuyenVien" };
            _userChuyenVienVanHoa = new User { Username = "cv_vh", FullName = "Trần Văn Phúc", Email = "phuc@ubnd.gov.vn", PrimaryDepartmentId = _depVanHoa.Id, ActiveRoleCode = "ChuyenVien" };

            _context.Users.AddRange(_userChuTich, _userPhoChuTich, _userChanhVanPhong, _userTruongPhongKinhTe, _userPhoPhongKinhTe, _userChuyenVienKinhTe, _userChuyenVienVanHoa);

            // 4. Gán UserRoles
            _context.UserRoles.AddRange(
                new UserRole { UserId = _userChuTich.Id, RoleId = _roleChuTich.Id, DepartmentId = _depVanPhong.Id, IsPrimary = true },
                new UserRole { UserId = _userPhoChuTich.Id, RoleId = _rolePhoChuTich.Id, DepartmentId = _depVanPhong.Id, IsPrimary = true },
                new UserRole { UserId = _userChanhVanPhong.Id, RoleId = _roleChanhVanPhong.Id, DepartmentId = _depVanPhong.Id, IsPrimary = true },
                new UserRole { UserId = _userTruongPhongKinhTe.Id, RoleId = _roleTruongPhong.Id, DepartmentId = _depKinhTe.Id, IsPrimary = true },
                new UserRole { UserId = _userPhoPhongKinhTe.Id, RoleId = _rolePhoPhong.Id, DepartmentId = _depKinhTe.Id, IsPrimary = true },
                new UserRole { UserId = _userChuyenVienKinhTe.Id, RoleId = _roleChuyenVien.Id, DepartmentId = _depKinhTe.Id, IsPrimary = true },
                new UserRole { UserId = _userChuyenVienVanHoa.Id, RoleId = _roleChuyenVien.Id, DepartmentId = _depVanHoa.Id, IsPrimary = true }
            );

            _context.SaveChanges();

            _authService = new TaskAuthorizationService(_context);
        }

        [Fact]
        public async Task ChuTich_CanAssignTask_ToAnyDepartmentStaff()
        {
            // Chủ tịch (Rank 1) có thể giao việc cho Trưởng phòng và Chuyên viên liên phòng
            var canAssignTP = await _authService.CanAssignTaskAsync(_userChuTich.Id, _userTruongPhongKinhTe.Id, _depKinhTe.Id);
            var canAssignCV = await _authService.CanAssignTaskAsync(_userChuTich.Id, _userChuyenVienVanHoa.Id, _depVanHoa.Id);

            canAssignTP.Should().BeTrue();
            canAssignCV.Should().BeTrue();
        }

        [Fact]
        public async Task PhoChuTich_CanAssignTask_ToChanhVanPhongAndDepartmentStaff()
        {
            // Phó Chủ tịch (Rank 2) có thể giao việc cho Chánh Văn phòng (Rank 3) và Trưởng phòng (Rank 3)
            var canAssignChanhVP = await _authService.CanAssignTaskAsync(_userPhoChuTich.Id, _userChanhVanPhong.Id, _depVanPhong.Id);
            var canAssignTP = await _authService.CanAssignTaskAsync(_userPhoChuTich.Id, _userTruongPhongKinhTe.Id, _depKinhTe.Id);

            canAssignChanhVP.Should().BeTrue();
            canAssignTP.Should().BeTrue();
        }

        [Fact]
        public async Task ChanhVanPhong_CanCoordinate_AndAssignTask_ToStaff()
        {
            // Chánh Văn phòng (Rank 3) có thể giao việc cho chuyên viên
            var canAssignCV = await _authService.CanAssignTaskAsync(_userChanhVanPhong.Id, _userChuyenVienKinhTe.Id, _depKinhTe.Id);
            canAssignCV.Should().BeTrue();
        }

        [Fact]
        public async Task TruongPhong_CanOnlyAssignTask_WithinOwnDepartment()
        {
            // Trưởng phòng Kinh tế (Rank 3) giao việc cho Chuyên viên Kinh tế -> Hợp lệ
            var canAssignInternal = await _authService.CanAssignTaskAsync(_userTruongPhongKinhTe.Id, _userChuyenVienKinhTe.Id, _depKinhTe.Id);
            canAssignInternal.Should().BeTrue();

            // Trưởng phòng Kinh tế (Rank 3) giao việc cho Chuyên viên Văn hóa -> Bị chặn
            var canAssignExternal = await _authService.CanAssignTaskAsync(_userTruongPhongKinhTe.Id, _userChuyenVienVanHoa.Id, _depVanHoa.Id);
            canAssignExternal.Should().BeFalse();
        }

        [Fact]
        public async Task ChuyenVien_CannotAssignTask()
        {
            // Chuyên viên (Rank 5) không được phép giao việc
            var canAssign = await _authService.CanAssignTaskAsync(_userChuyenVienKinhTe.Id, _userChuyenVienVanHoa.Id, _depVanHoa.Id);
            canAssign.Should().BeFalse();
        }

        [Fact]
        public async Task TruongPhong_CannotAssignCrossDepartment_WithSpoofedDepartmentId()
        {
            var canAssign = await _authService.CanAssignTaskAsync(
                _userTruongPhongKinhTe.Id,
                _userChuyenVienVanHoa.Id,
                _depKinhTe.Id);

            canAssign.Should().BeFalse();
        }

        [Fact]
        public async Task TruongPhong_CannotTransferTask_CrossDepartment()
        {
            // Tạo task thuộc phòng Kinh tế
            var task = new TaskItem
            {
                Title = "Kiểm tra trật tự xây dựng",
                AssignerId = _userTruongPhongKinhTe.Id,
                AssigneeId = _userChuyenVienKinhTe.Id,
                DepartmentId = _depKinhTe.Id
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            // Trưởng phòng điều chuyển sang chuyên viên Văn hóa -> Bị chặn
            var canTransfer = await _authService.CanTransferTaskAsync(_userTruongPhongKinhTe.Id, task.Id, _userChuyenVienVanHoa.Id);
            canTransfer.Should().BeFalse();

            // Phó Chủ tịch điều chuyển sang chuyên viên Văn hóa -> Hợp lệ
            var canTransferByPCT = await _authService.CanTransferTaskAsync(_userPhoChuTich.Id, task.Id, _userChuyenVienVanHoa.Id);
            canTransferByPCT.Should().BeTrue();
        }

        [Fact]
        public async Task ChuyenVien_CannotApproveOwnTaskToCompleted()
        {
            var task = new TaskItem
            {
                Title = "Báo cáo số liệu quý",
                AssignerId = _userTruongPhongKinhTe.Id,
                AssigneeId = _userChuyenVienKinhTe.Id,
                DepartmentId = _depKinhTe.Id,
                Status = TaskStatusEnum.InReview
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            // Chuyên viên tự duyệt Hoàn thành cho chính mình -> Bị chặn
            var canComplete = await _authService.CanUpdateTaskStatusAsync(_userChuyenVienKinhTe.Id, task.Id, TaskStatusEnum.Completed);
            canComplete.Should().BeFalse();

            // Trưởng phòng duyệt Hoàn thành -> Hợp lệ
            var canCompleteByTP = await _authService.CanUpdateTaskStatusAsync(_userTruongPhongKinhTe.Id, task.Id, TaskStatusEnum.Completed);
            canCompleteByTP.Should().BeTrue();
        }

        [Fact]
        public async Task TruongPhong_CannotCompleteTaskOutsideOwnDepartment()
        {
            var task = new TaskItem
            {
                Title = "Cross department approval",
                AssignerId = _userChuTich.Id,
                AssigneeId = _userChuyenVienVanHoa.Id,
                DepartmentId = _depVanHoa.Id,
                Status = TaskStatusEnum.InReview
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            var canComplete = await _authService.CanUpdateTaskStatusAsync(
                _userTruongPhongKinhTe.Id,
                task.Id,
                TaskStatusEnum.Completed);

            canComplete.Should().BeFalse();
        }
    }
}
