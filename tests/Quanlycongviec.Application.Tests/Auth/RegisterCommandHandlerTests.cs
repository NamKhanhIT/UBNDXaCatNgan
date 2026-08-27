using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.Commands.Register;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    public class RegisterCommandHandlerTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IPasswordHasher> _passwordHasherMock;
        private readonly Mock<IJwtTokenService> _jwtTokenServiceMock;
        private readonly Mock<IRefreshTokenService> _refreshTokenServiceMock;

        public RegisterCommandHandlerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
            _passwordHasherMock = new Mock<IPasswordHasher>();
            _jwtTokenServiceMock = new Mock<IJwtTokenService>();
            _refreshTokenServiceMock = new Mock<IRefreshTokenService>();

            _passwordHasherMock.Setup(x => x.HashPassword(It.IsAny<string>())).Returns("hashed_pass");
            _jwtTokenServiceMock.Setup(x => x.GenerateToken(It.IsAny<Domain.Entities.User>(), It.IsAny<string>(), It.IsAny<System.Collections.Generic.IEnumerable<string>>(), It.IsAny<int>()))
                .Returns("jwt_token_sample");
            _refreshTokenServiceMock.Setup(x => x.CreateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("refresh_token_sample");
        }

        [Fact]
        public async Task Handle_ShouldRegisterUserSuccessfully()
        {
            // Arrange: vai trò trong whitelist phải tồn tại sẵn trong DB
            var role = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            _context.Roles.Add(role);
            await _context.SaveChangesAsync();

            var handler = new RegisterCommandHandler(_context, _passwordHasherMock.Object, _jwtTokenServiceMock.Object, _refreshTokenServiceMock.Object);
            var command = new RegisterCommand("canbo1", "Nguyen Van A", "canbo1@ubnd.gov.vn", "password123", "ChuyenVien");

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Username.Should().Be("canbo1");
            result.ActiveRole.Should().Be("ChuyenVien");
            result.Token.Should().Be("jwt_token_sample");
            result.RefreshToken.Should().Be("refresh_token_sample");

            var userInDb = await _context.Users.FirstOrDefaultAsync(u => u.Username == "canbo1");
            userInDb.Should().NotBeNull();
            userInDb!.Email.Should().Be("canbo1@ubnd.gov.vn");
        }

        [Fact]
        public async Task Handle_WithLeaderRole_ShouldRejectPrivilegeEscalation()
        {
            // BẢO MẬT (Audit C2): client tự gán vai trò lãnh đạo RankLevel cao phải bị chặn
            var role = new Role { Name = "Chủ tịch UBND", Code = "ChuTichUBND", RankLevel = 1 };
            _context.Roles.Add(role);
            await _context.SaveChangesAsync();

            var handler = new RegisterCommandHandler(_context, _passwordHasherMock.Object, _jwtTokenServiceMock.Object, _refreshTokenServiceMock.Object);
            var command = new RegisterCommand("hacker1", "Attacker", "hacker1@ubnd.gov.vn", "password123", "ChuTichUBND");

            var act = async () => await handler.Handle(command, CancellationToken.None);

            (await act.Should().ThrowAsync<InvalidOperationException>())
                .WithMessage("*Vai trò không hợp lệ*");

            (await _context.Users.AnyAsync(u => u.Username == "hacker1")).Should().BeFalse(
                "không được phép tạo tài khoản mang vai trò lãnh đạo qua API đăng ký");
        }

        [Fact]
        public async Task Handle_WithUnknownRole_ShouldNotAutoCreateRole()
        {
            // BẢO MẬT (Audit C2): không còn nhánh tự tạo Role mới từ chuỗi client gửi tùy ý
            var handler = new RegisterCommandHandler(_context, _passwordHasherMock.Object, _jwtTokenServiceMock.Object, _refreshTokenServiceMock.Object);
            var command = new RegisterCommand("hacker2", "Attacker", "hacker2@ubnd.gov.vn", "password123", "SuperAdminTuTao");

            var act = async () => await handler.Handle(command, CancellationToken.None);

            (await act.Should().ThrowAsync<InvalidOperationException>())
                .WithMessage("*Vai trò không hợp lệ*");

            _context.Roles.Where(r => r.Code == "SuperAdminTuTao").Should().BeEmpty(
                "role lạ không được tự động tạo trong hệ thống");
            (await _context.Users.AnyAsync(u => u.Username == "hacker2")).Should().BeFalse();
        }

        [Fact]
        public async Task Handle_WithWhitelistedRoleMissingInDb_ShouldThrow()
        {
            // Role nằm trong whitelist nhưng chưa được seed trong DB → từ chối thay vì tự tạo
            var handler = new RegisterCommandHandler(_context, _passwordHasherMock.Object, _jwtTokenServiceMock.Object, _refreshTokenServiceMock.Object);
            var command = new RegisterCommand("canbo2", "Nguyen Van B", "canbo2@ubnd.gov.vn", "password123", "PhoPhong");

            var act = async () => await handler.Handle(command, CancellationToken.None);

            (await act.Should().ThrowAsync<InvalidOperationException>())
                .WithMessage("*chưa được khởi tạo*");
        }
    }
}