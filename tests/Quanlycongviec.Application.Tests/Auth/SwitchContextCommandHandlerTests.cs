using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.Commands.SwitchContext;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    public class SwitchContextCommandHandlerTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IJwtTokenService> _jwtTokenServiceMock;
        private readonly Mock<IRefreshTokenService> _refreshTokenServiceMock;

        public SwitchContextCommandHandlerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
            _jwtTokenServiceMock = new Mock<IJwtTokenService>();
            _jwtTokenServiceMock.Setup(x => x.GenerateToken(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<System.Collections.Generic.IEnumerable<string>>(), It.IsAny<int>()))
                .Returns("jwt_token_switched");
            _refreshTokenServiceMock = new Mock<IRefreshTokenService>();
            _refreshTokenServiceMock.Setup(x => x.CreateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("refresh_token_switched");
        }

        [Fact]
        public async Task Handle_ShouldSwitchContextSuccessfully_WhenUserHasTargetRole()
        {
            // Arrange
            var role1 = new Role { Name = "Bí thư Đảng ủy", Code = "BiThu" };
            var role2 = new Role { Name = "Chủ tịch HĐND", Code = "ChuTichHDND" };
            _context.Roles.AddRange(role1, role2);
            await _context.SaveChangesAsync();

            var user = new User
            {
                Username = "bithu_chutich",
                FullName = "Trần Văn B",
                Email = "bithu@catngan.gov.vn",
                ActiveRoleCode = "BiThu"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role1.Id, IsPrimary = true });
            _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role2.Id, IsPrimary = false });
            await _context.SaveChangesAsync();

            var handler = new SwitchContextCommandHandler(_context, _jwtTokenServiceMock.Object, _refreshTokenServiceMock.Object);
            var command = new SwitchContextCommand(user.Id, "ChuTichHDND");

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.ActiveRole.Should().Be("ChuTichHDND");
            result.RefreshToken.Should().Be("refresh_token_switched");

            var auditLog = await _context.AuditLogs.FirstOrDefaultAsync(a => a.UserId == user.Id);
            auditLog.Should().NotBeNull();
            auditLog!.Action.Should().Be("SwitchContext");
            auditLog.ActingRole.Should().Be("ChuTichHDND");
        }
    }
}
