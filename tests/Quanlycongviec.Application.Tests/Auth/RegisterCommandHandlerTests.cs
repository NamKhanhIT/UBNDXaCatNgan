using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.Commands.Register;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    public class RegisterCommandHandlerTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IPasswordHasher> _passwordHasherMock;
        private readonly Mock<IJwtTokenService> _jwtTokenServiceMock;

        public RegisterCommandHandlerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
            _passwordHasherMock = new Mock<IPasswordHasher>();
            _jwtTokenServiceMock = new Mock<IJwtTokenService>();

            _passwordHasherMock.Setup(x => x.HashPassword(It.IsAny<string>())).Returns("hashed_pass");
            _jwtTokenServiceMock.Setup(x => x.GenerateToken(It.IsAny<Domain.Entities.User>(), It.IsAny<string>(), It.IsAny<System.Collections.Generic.IEnumerable<string>>(), It.IsAny<int>()))
                .Returns("jwt_token_sample");
        }

        [Fact]
        public async Task Handle_ShouldRegisterUserSuccessfully()
        {
            // Arrange
            var handler = new RegisterCommandHandler(_context, _passwordHasherMock.Object, _jwtTokenServiceMock.Object);
            var command = new RegisterCommand("canbo1", "Nguyen Van A", "canbo1@catngan.gov.vn", "password123", "BiThu");

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Username.Should().Be("canbo1");
            result.ActiveRole.Should().Be("BiThu");
            result.Token.Should().Be("jwt_token_sample");

            var userInDb = await _context.Users.FirstOrDefaultAsync(u => u.Username == "canbo1");
            userInDb.Should().NotBeNull();
            userInDb!.Email.Should().Be("canbo1@catngan.gov.vn");
        }
    }
}
