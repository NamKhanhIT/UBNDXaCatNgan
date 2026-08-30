using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Application.Features.RatingHistory.Commands.SubmitRatingRevision;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.RatingHistory
{
    public class DepartmentScopedScoringTests
    {
        private readonly ApplicationDbContext _context;
        private readonly ITaskAuthorizationService _authService;
        private readonly IOptions<RatingRevisionOptions> _options;

        private readonly Department _depKinhTe;
        private readonly Department _depVanHoa;

        private readonly Role _roleChuTich;
        private readonly Role _rolePhoChuTich;
        private readonly Role _roleTruongPhong;
        private readonly Role _roleChuyenVien;

        private readonly User _userChuTich;
        private readonly User _userPhoChuTich;
        private readonly User _userTruongPhongKinhTe;
        private readonly User _userTruongPhongVanHoa;
        private readonly User _userChuyenVienKinhTe;

        public DepartmentScopedScoringTests()
        {
            var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(dbOptions);

            _options = Microsoft.Extensions.Options.Options.Create(new RatingRevisionOptions
            {
                ApprovalThreshold = 1.0,
                MinReasonLength = 5
            });

            _depKinhTe = new Department { Name = "Phòng Kinh tế", Code = "KINH_TE" };
            _depVanHoa = new Department { Name = "Phòng Văn hóa", Code = "VAN_HOA_XA_HOI" };
            _context.Departments.AddRange(_depKinhTe, _depVanHoa);

            _roleChuTich = new Role { Name = "Chủ tịch UBND", Code = "ChuTichUBND", RankLevel = 1 };
            _rolePhoChuTich = new Role { Name = "Phó Chủ tịch UBND", Code = "PhoChuTichUBND", RankLevel = 2 };
            _roleTruongPhong = new Role { Name = "Trưởng phòng", Code = "TruongPhong", RankLevel = 3 };
            _roleChuyenVien = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            _context.Roles.AddRange(_roleChuTich, _rolePhoChuTich, _roleTruongPhong, _roleChuyenVien);

            _userChuTich = new User { Username = "chutich", FullName = "Nguyễn Đình Hùng", Email = "chutich@ubnd.gov.vn", PrimaryDepartmentId = _depKinhTe.Id, ActiveRoleCode = "ChuTichUBND" };
            _userPhoChuTich = new User { Username = "pct", FullName = "Nguyễn Văn Hoàng", Email = "pct@ubnd.gov.vn", PrimaryDepartmentId = _depKinhTe.Id, ActiveRoleCode = "PhoChuTichUBND" };
            _userTruongPhongKinhTe = new User { Username = "tp_kt", FullName = "Lê Văn Tùng", Email = "tpkt@ubnd.gov.vn", PrimaryDepartmentId = _depKinhTe.Id, ActiveRoleCode = "TruongPhong" };
            _userTruongPhongVanHoa = new User { Username = "tp_vh", FullName = "Trần Thị Mai", Email = "tpvh@ubnd.gov.vn", PrimaryDepartmentId = _depVanHoa.Id, ActiveRoleCode = "TruongPhong" };
            _userChuyenVienKinhTe = new User { Username = "cv_kt", FullName = "Nguyễn Văn Nam", Email = "nam@ubnd.gov.vn", PrimaryDepartmentId = _depKinhTe.Id, ActiveRoleCode = "ChuyenVien" };

            _context.Users.AddRange(_userChuTich, _userPhoChuTich, _userTruongPhongKinhTe, _userTruongPhongVanHoa, _userChuyenVienKinhTe);

            _context.UserRoles.AddRange(
                new UserRole { UserId = _userChuTich.Id, RoleId = _roleChuTich.Id, DepartmentId = _depKinhTe.Id, IsPrimary = true },
                new UserRole { UserId = _userPhoChuTich.Id, RoleId = _rolePhoChuTich.Id, DepartmentId = _depKinhTe.Id, IsPrimary = true },
                new UserRole { UserId = _userTruongPhongKinhTe.Id, RoleId = _roleTruongPhong.Id, DepartmentId = _depKinhTe.Id, IsPrimary = true },
                new UserRole { UserId = _userTruongPhongVanHoa.Id, RoleId = _roleTruongPhong.Id, DepartmentId = _depVanHoa.Id, IsPrimary = true },
                new UserRole { UserId = _userChuyenVienKinhTe.Id, RoleId = _roleChuyenVien.Id, DepartmentId = _depKinhTe.Id, IsPrimary = true }
            );

            _context.SaveChanges();

            _authService = new TaskAuthorizationService(_context);
        }

        [Fact]
        public async Task TruongPhong_CannotScore_OtherDepartmentTask()
        {
            var task = new TaskItem
            {
                Title = "Nhiệm vụ phòng Kinh tế",
                AssignerId = _userTruongPhongKinhTe.Id,
                AssigneeId = _userChuyenVienKinhTe.Id,
                DepartmentId = _depKinhTe.Id,
                Status = TaskStatusEnum.Completed,
                RatingScore = 8.0,
                SystemScore = 2.5,
                EvaluatorScore = 5.5
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            // Trưởng phòng Văn hóa (khác phòng) chấm điểm -> Bị chặn
            var canScore = await _authService.CanScoreTaskAsync(_userTruongPhongVanHoa.Id, task.Id);
            canScore.Should().BeFalse();

            // Trưởng phòng Kinh tế (cùng phòng) chấm điểm -> Hợp lệ
            var canScoreByOwnTP = await _authService.CanScoreTaskAsync(_userTruongPhongKinhTe.Id, task.Id);
            canScoreByOwnTP.Should().BeTrue();

            // Phó Chủ tịch (Rank 2) chấm điểm -> Hợp lệ
            var canScoreByPCT = await _authService.CanScoreTaskAsync(_userPhoChuTich.Id, task.Id);
            canScoreByPCT.Should().BeTrue();
        }

        [Fact]
        public async Task SubmitRatingRevision_EnforcesDepartmentScope()
        {
            var task = new TaskItem
            {
                Title = "Lập bản đồ địa chính",
                AssignerId = _userTruongPhongKinhTe.Id,
                AssigneeId = _userChuyenVienKinhTe.Id,
                DepartmentId = _depKinhTe.Id,
                Status = TaskStatusEnum.Completed,
                RatingScore = 7.5,
                SystemScore = 2.5,
                EvaluatorScore = 5.0
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            var handler = new SubmitRatingRevisionCommandHandler(_context, _options, _authService);

            var commandByOtherTP = new SubmitRatingRevisionCommand(
                TaskItemId: task.Id,
                NewScore: 8.5,
                Reason: "Đánh giá lại tiến độ hoàn thành",
                EvidenceUrl: "https://ubnd.gov.vn/evidence/123.pdf",
                CurrentUserId: _userTruongPhongVanHoa.Id
            );

            // Chấm chéo phòng ban không có thẩm quyền -> Ném UnauthorizedAccessException
            Func<Task> act = async () => await handler.Handle(commandByOtherTP, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>();
        }
    }
}
