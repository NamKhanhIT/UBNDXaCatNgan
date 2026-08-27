using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword;
using Quanlycongviec.Application.Features.Auth.Commands.Mfa;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    // =====================================================================
    // BẢO MẬT (Audit Đợt 4): Test hồi quy hardening Auth.
    //   H3  - Khóa tài khoản sau loạt sai OTP khôi phục mật khẩu
    //   H3b - Cửa sổ khóa hết hạn thì mã đúng được chấp nhận lại
    //   H4  - Mọi nhánh thất bại trả ĐÚNG MỘT message chung (chống enumeration)
    //   H5  - Mã TOTP không dùng lại được (chống replay)
    //   RT  - Luồng ResetToken 2 bước: cấp đúng, từ chối token giả/sai mục đích
    // =====================================================================
    public class HardeningRegressionTests : IDisposable
    {
        private readonly ApplicationDbContext _context;
        private readonly IJwtTokenService _jwtTokenService;

        public HardeningRegressionTests()
        {
            _context = new ApplicationDbContext(
                new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options);

            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Secret"] = "unit-test-secret-key-must-be-at-least-32-chars!!",
                    ["Jwt:Issuer"] = "TestIssuer",
                    ["Jwt:Audience"] = "TestAudience"
                })
                .Build();
            _jwtTokenService = new JwtTokenService(configuration);
        }

        public void Dispose() => _context.Dispose();

        // BẢO MẬT (Đợt 4 - M3): DB lưu SHA-256 hash của OTP — seed phải khớp
        private static string Sha256Hex(string input) =>
            Convert.ToHexString(
                System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(input.Trim()))
            ).ToLowerInvariant();

        private User SeedUser(string email, string? otp = null, DateTime? otpExpiry = null)
        {
            var role = new Role { Id = Guid.NewGuid(), Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = email.Split('@')[0],
                FullName = "Người Dùng Kiểm Thử",
                Email = email,
                PasswordHash = "old-password-hash",
                ActiveRoleCode = "ChuyenVien",
                PasswordResetOtp = otp == null ? null : Sha256Hex(otp),
                PasswordResetOtpExpiry = otpExpiry
            };
            _context.Roles.Add(role);
            _context.Users.Add(user);
            _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, IsPrimary = true });
            _context.SaveChanges();
            return user;
        }

        private static Mock<IPasswordHasher> BuildHasher()
        {
            var hasher = new Mock<IPasswordHasher>();
            hasher.Setup(p => p.HashPassword(It.IsAny<string>())).Returns("new-password-hash");
            return hasher;
        }

        private static Mock<IRefreshTokenService> BuildRefresh()
        {
            var refresh = new Mock<IRefreshTokenService>();
            refresh.Setup(r => r.CreateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                   .ReturnsAsync("refresh-token");
            refresh.Setup(r => r.RevokeAllForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                   .Returns(Task.CompletedTask);
            return refresh;
        }

        private VerifyResetOtpCommandHandler BuildVerifyOtpHandler() =>
            new(_context, _jwtTokenService, NullLogger<VerifyResetOtpCommandHandler>.Instance);

        private ResetPasswordWithOtpCommandHandler BuildResetOtpHandler() =>
            new(_context, BuildHasher().Object, BuildRefresh().Object, _jwtTokenService,
                NullLogger<ResetPasswordWithOtpCommandHandler>.Instance);

        private static async Task<Exception?> CaptureAsync(Func<Task> act)
        {
            try
            {
                await act();
                return null;
            }
            catch (InvalidOperationException ex)
            {
                return ex;
            }
        }

        // ─────────────────────────── H3 ───────────────────────────

        [Fact]
        public async Task H3_VerifyResetOtp_Locks_After_Max_Consecutive_Failures()
        {
            var email = "h3@example.gov.vn";
            SeedUser(email, otp: "123456", otpExpiry: DateTime.UtcNow.AddMinutes(10));
            var handler = BuildVerifyOtpHandler();

            // 5 lần nhập sai OTP liên tiếp phải bị từ chối...
            for (var attempt = 1; attempt <= 5; attempt++)
            {
                var ex = await CaptureAsync(() => handler.Handle(
                    new VerifyResetOtpCommand(email, "000000"), CancellationToken.None));
                ex.Should().NotBeNull($"lần sai thứ {attempt} phải bị từ chối");
                ex!.Message.Should().NotContain("resetToken", "thất bại không được lộ token");
            }

            // ...và sau ngưỡng khóa, kể cả mã ĐÚNG cũng không nhận được token nữa.
            var correctAttempt = await CaptureAsync(() => handler.Handle(
                new VerifyResetOtpCommand(email, "123456"), CancellationToken.None));

            correctAttempt.Should().NotBeNull(
                "tài khoản đã bị khóa do brute-force OTP — mã đúng trong giai đoạn khóa vẫn phải bị từ chối");

            var stored = await _context.Users.AsNoTracking().FirstAsync(u => u.Email == email);
            stored.OtpLockedUntil.Should().NotBeNull();
            stored.OtpLockedUntil!.Value.Should().BeAfter(DateTime.UtcNow, "mốc khóa phải còn hiệu lực");
            stored.PasswordHash.Should().Be("old-password-hash", "khóa chặn toàn bộ luồng đổi mật khẩu");
        }

        [Fact]
        public async Task H3_VerifyResetOtp_Lockout_Releases_After_Window_Expires()
        {
            var email = "h3b@example.gov.vn";
            SeedUser(email, otp: "654321", otpExpiry: DateTime.UtcNow.AddMinutes(10));
            var handler = BuildVerifyOtpHandler();

            for (var attempt = 1; attempt <= 5; attempt++)
            {
                await CaptureAsync(() => handler.Handle(
                    new VerifyResetOtpCommand(email, "999999"), CancellationToken.None));
            }

            // Giả lập hết cửa sổ khóa: đẩy mốc khóa lùi về quá khứ rồi thử lại bằng mã đúng.
            var user = await _context.Users.FirstAsync(u => u.Email == email);
            user.OtpLockedUntil = DateTime.UtcNow.AddMinutes(-16);
            await _context.SaveChangesAsync();

            var result = await handler.Handle(
                new VerifyResetOtpCommand(email, "654321"), CancellationToken.None);

            result.Success.Should().BeTrue("sau khi cửa sổ khóa hết hạn, mã đúng phải được chấp nhận trở lại");
            result.ResetToken.Should().NotBeNullOrWhiteSpace();
        }

        // ─────────────────────────── H4 ───────────────────────────

        [Fact]
        public async Task H4_All_Failure_Branches_Return_One_Generic_Message()
        {
            var knownEmail = "h4-known@example.gov.vn";
            SeedUser(knownEmail, otp: "111111", otpExpiry: DateTime.UtcNow.AddMinutes(10));

            var verifyHandler = BuildVerifyOtpHandler();
            var resetHandler = BuildResetOtpHandler();

            var messages = new List<string?>();

            // Bước verify: (a) email KHÔNG tồn tại
            messages.Add((await CaptureAsync(() => verifyHandler.Handle(
                new VerifyResetOtpCommand("h4-ghost@example.gov.vn", "222222"), CancellationToken.None)))?.Message);

            // (b) Tài khoản tồn tại nhưng CHƯA yêu cầu OTP
            messages.Add((await CaptureAsync(() => verifyHandler.Handle(
                new VerifyResetOtpCommand("h4-nootp@example.gov.vn", "333333"), CancellationToken.None)))?.Message);

            // (c) Có yêu cầu OTP nhưng đã HẾT HẠN
            var expiringUser = await _context.Users.FirstAsync(x => x.Email == knownEmail);
            expiringUser.PasswordResetOtpExpiry = DateTime.UtcNow.AddMinutes(-11);
            await _context.SaveChangesAsync();
            messages.Add((await CaptureAsync(() => verifyHandler.Handle(
                new VerifyResetOtpCommand(knownEmail, "111111"), CancellationToken.None)))?.Message);

            // Bước reset: (d) token giả / sai chữ ký
            messages.Add((await CaptureAsync(() => resetHandler.Handle(
                new ResetPasswordWithOtpCommand("fake.jwt.token", "MatKhau@Moi1"), CancellationToken.None)))?.Message);

            // (e) token hợp lệ về chữ ký nhưng SAI mục đích (mượn mfa token)
            messages.Add((await CaptureAsync(() => resetHandler.Handle(
                new ResetPasswordWithOtpCommand(_jwtTokenService.GenerateMfaToken(Guid.NewGuid()), "MatKhau@Moi1"), CancellationToken.None)))?.Message);

            // Chống enumeration: kẻ tấn công KHÔNG ĐƯỢC phân biệt trạng thái qua lỗi.
            messages.Should().OnlyContain(m => !string.IsNullOrEmpty(m));
            messages.Distinct(StringComparer.Ordinal).Should().HaveCount(1,
                "mọi nhánh thất bại của luồng quên mật khẩu phải trả đúng một message chung: " +
                $"thực tế thu được: [{string.Join(" | ", messages!)}]");
        }

        // ─────────────────────── Reset Token ───────────────────────

        [Fact]
        public async Task RT_Full_Flow_Verify_Issues_Token_Then_Reset_Succeeds_And_Consumes_Otp()
        {
            var email = "rt@example.gov.vn";
            SeedUser(email, otp: "246810", otpExpiry: DateTime.UtcNow.AddMinutes(10));

            var verified = await BuildVerifyOtpHandler().Handle(
                new VerifyResetOtpCommand(email, "246810"), CancellationToken.None);

            verified.Success.Should().BeTrue();
            verified.ResetToken.Should().NotBeNullOrWhiteSpace();

            var resetResult = await BuildResetOtpHandler().Handle(
                new ResetPasswordWithOtpCommand(verified.ResetToken!, "MatKhau@Moi123"), CancellationToken.None);

            resetResult.Should().BeTrue();

            var stored = await _context.Users.AsNoTracking().FirstAsync(u => u.Email == email);
            stored.PasswordHash.Should().Be("new-password-hash");
            stored.PasswordResetOtp.Should().BeNull("OTP phải bị tiêu thụ sau khi đổi mật khẩu thành công");
            stored.OtpFailedCount.Should().Be(0);
            stored.OtpLockedUntil.Should().BeNull();
        }

        [Fact]
        public async Task RT_Reset_Token_Cannot_Be_Reused_After_Otp_Consumed()
        {
            var email = "rt-reuse@example.gov.vn";
            SeedUser(email, otp: "135790", otpExpiry: DateTime.UtcNow.AddMinutes(10));

            var verifyHandler = BuildVerifyOtpHandler();
            var resetHandler = BuildResetOtpHandler();

            var first = await verifyHandler.Handle(new VerifyResetOtpCommand(email, "135790"), CancellationToken.None);
            first.ResetToken.Should().NotBeNullOrWhiteSpace();

            (await resetHandler.Handle(new ResetPasswordWithOtpCommand(first.ResetToken!, "MatKhau@Moi123"), CancellationToken.None))
                .Should().BeTrue();

            // Dùng lại token khi OTP đã tiêu thụ → phải bị từ chối (chặn replay toàn luồng).
            var reuse = await CaptureAsync(() => resetHandler.Handle(
                new ResetPasswordWithOtpCommand(first.ResetToken!, "Khac@MatKhau1"), CancellationToken.None));

            reuse.Should().NotBeNull("token đã hoàn tất phiên reset không được dùng lần thứ hai");
        }

        // ─────────────────────────── H5 ───────────────────────────

        [Fact]
        public async Task H5_Totp_Code_Cannot_Be_Replayed_On_Second_Login()
        {
            var totp = new TotpService();
            var secret = totp.GenerateSecret();
            var utcNow = DateTime.UtcNow;

            var user = SeedUser("h5@example.gov.vn");
            user.MfaEnabled = true;
            user.MfaSecret = secret;
            await _context.SaveChangesAsync();

            Guid resolvedUserId = user.Id;
            var jwt = new Mock<IJwtTokenService>();
            jwt.Setup(j => j.TryValidateMfaToken(It.IsAny<string>(), out resolvedUserId))
               .Returns(true);
            jwt.Setup(j => j.GenerateToken(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<System.Collections.Generic.IEnumerable<string>>(), It.IsAny<int>()))
               .Returns("jwt-full");

            var handler = new VerifyMfaLoginCommandHandler(
                _context, jwt.Object, BuildRefresh().Object, totp,
                NullLogger<VerifyMfaLoginCommandHandler>.Instance);

            var counter = (long)(utcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds / 30;
            var code = TotpService.ComputeExactCode(secret, counter);

            // Lần 1: mã hợp lệ → đăng nhập thành công
            await handler.Invoking(h => h.Handle(
                new VerifyMfaLoginCommand { MfaToken = "mfa-token", Code = code, Channel = "totp" },
                CancellationToken.None))
                .Should().NotThrowAsync("lần sử dụng đầu tiên với mã hợp lệ phải thành công");

            // Lần 2: CÙNG mã trong cùng cửa sổ 30s → phải bị chặn (replay).
            await handler.Invoking(h => h.Handle(
                new VerifyMfaLoginCommand { MfaToken = "mfa-token", Code = code, Channel = "totp" },
                CancellationToken.None))
                .Should().ThrowAsync<UnauthorizedAccessException>(
                    "mã TOTP đã tiêu thụ không được phép đăng nhập lại (replay attack)");
        }
    }
}
