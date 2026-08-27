using FluentAssertions;
using Quanlycongviec.Application.Common.Security;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    public class PasswordPolicyTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Validate_NullOrEmptyPassword_ReturnsInvalid(string? password)
        {
            var (isValid, error) = PasswordPolicy.Validate(password);

            isValid.Should().BeFalse();
            error.Should().Contain("Vui lòng nhập mật khẩu mới.");
        }

        [Theory]
        [InlineData("Ab1!")]
        [InlineData("Pass1!")]
        [InlineData("Short1@")]
        public void Validate_PasswordUnder8Characters_ReturnsInvalid(string password)
        {
            var (isValid, error) = PasswordPolicy.Validate(password);

            isValid.Should().BeFalse();
            error.Should().Contain("tối thiểu 8 ký tự");
        }

        [Theory]
        [InlineData("password123!")]
        [InlineData("khmsw101@")]
        [InlineData("congtacvien2026#")]
        public void Validate_PasswordMissingUppercase_ReturnsInvalid(string password)
        {
            var (isValid, error) = PasswordPolicy.Validate(password);

            isValid.Should().BeFalse();
            error.Should().Contain("in hoa");
        }

        [Theory]
        [InlineData("Password!@#")]
        [InlineData("AdminUbndXa!")]
        [InlineData("SecuredAccount@")]
        public void Validate_PasswordMissingDigit_ReturnsInvalid(string password)
        {
            var (isValid, error) = PasswordPolicy.Validate(password);

            isValid.Should().BeFalse();
            error.Should().Contain("chữ số");
        }

        [Theory]
        [InlineData("Password123")]
        [InlineData("AdminUbndXa2026")]
        [InlineData("Khmsw101000")]
        public void Validate_PasswordMissingSpecialCharacter_ReturnsInvalid(string password)
        {
            var (isValid, error) = PasswordPolicy.Validate(password);

            isValid.Should().BeFalse();
            error.Should().Contain("ký tự đặc biệt");
        }

        [Theory]
        [InlineData("Khmsw101@")]
        [InlineData("AdminUbnd@2026")]
        [InlineData("CatNgan#2026!")]
        [InlineData("BaoMat$UbndXa1")]
        [InlineData("Strong_P@ssw0rd!")]
        public void Validate_ValidStrongPassword_ReturnsValid(string password)
        {
            var (isValid, error) = PasswordPolicy.Validate(password);

            isValid.Should().BeTrue();
            error.Should().BeNull();
        }
    }
}
