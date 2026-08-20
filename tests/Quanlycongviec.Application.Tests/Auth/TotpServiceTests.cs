using System;
using Quanlycongviec.Application.Common.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    public class TotpServiceTests
    {
        private readonly TotpService _totpService = new();
        private static readonly DateTime UnixEpoch = new(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        [Fact]
        public void GenerateSecret_ShouldReturnValidBase32String_WithExpectedLength()
        {
            // Act
            var secret = _totpService.GenerateSecret();

            // Assert
            Assert.False(string.IsNullOrWhiteSpace(secret));
            Assert.True(secret.Length >= 32);
            foreach (var c in secret)
            {
                Assert.True("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".Contains(c), $"Ký tự không hợp lệ: {c}");
            }
        }

        [Fact]
        public void GetProvisioningUri_ShouldContainCorrectParameters()
        {
            // Arrange
            var secret = "JBSWY3DPEHPK3PXP";
            var email = "chutich@catngan.gov.vn";
            var issuer = "UBND Xa Cat Ngan";

            // Act
            var uri = _totpService.GetProvisioningUri(secret, email, issuer);

            // Assert
            Assert.StartsWith("otpauth://totp/", uri);
            Assert.Contains("secret=" + secret, uri);
            Assert.Contains("digits=6", uri);
            Assert.Contains("period=30", uri);
            Assert.Contains("issuer=", uri);
        }

        [Fact]
        public void Validate_WithValidCode_ShouldReturnTrue()
        {
            // Arrange
            var secret = _totpService.GenerateSecret();
            var fixedTime = new DateTime(2026, 8, 20, 10, 0, 0, DateTimeKind.Utc);
            var counter = (long)(fixedTime - UnixEpoch).TotalSeconds / 30;
            var exactCode = TotpService.ComputeExactCode(secret, counter);

            // Act & Assert
            Assert.NotEmpty(exactCode);
            Assert.True(_totpService.Validate(secret, exactCode, fixedTime));
        }

        [Fact]
        public void Validate_WithTimeDrift_PlusMinusOneStep_ShouldReturnTrue()
        {
            // Arrange
            var secret = _totpService.GenerateSecret();
            var t0 = new DateTime(2026, 8, 20, 10, 0, 0, DateTimeKind.Utc);
            var counter0 = (long)(t0 - UnixEpoch).TotalSeconds / 30;
            var codeAtT0 = TotpService.ComputeExactCode(secret, counter0);

            // Test 1 step earlier (-30s) and 1 step later (+30s)
            var tMinus30s = t0.AddSeconds(-30);
            var tPlus30s = t0.AddSeconds(30);

            Assert.True(_totpService.Validate(secret, codeAtT0, tMinus30s));
            Assert.True(_totpService.Validate(secret, codeAtT0, tPlus30s));
        }

        [Fact]
        public void Validate_WithExpiredCode_PlusTwoSteps_ShouldReturnFalse()
        {
            // Arrange
            var secret = _totpService.GenerateSecret();
            var t0 = new DateTime(2026, 8, 20, 10, 0, 0, DateTimeKind.Utc);
            var counter0 = (long)(t0 - UnixEpoch).TotalSeconds / 30;
            var codeAtT0 = TotpService.ComputeExactCode(secret, counter0);

            // 2 steps later (+65s) -> outside ±1 window
            var tPlus65s = t0.AddSeconds(65);
            var tMinus65s = t0.AddSeconds(-65);

            Assert.False(_totpService.Validate(secret, codeAtT0, tPlus65s));
            Assert.False(_totpService.Validate(secret, codeAtT0, tMinus65s));
        }

        [Theory]
        [InlineData("", "123456")]
        [InlineData("JBSWY3DPEHPK3PXP", "")]
        [InlineData("JBSWY3DPEHPK3PXP", "12345")] // 5 digits
        [InlineData("JBSWY3DPEHPK3PXP", "1234567")] // 7 digits
        [InlineData("JBSWY3DPEHPK3PXP", "abcdef")] // non-numeric
        public void Validate_WithInvalidInputs_ShouldReturnFalse(string secret, string code)
        {
            var result = _totpService.Validate(secret, code);
            Assert.False(result);
        }
    }
}
