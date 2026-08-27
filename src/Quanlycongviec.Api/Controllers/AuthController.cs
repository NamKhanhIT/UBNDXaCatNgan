using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Features.Auth.Commands.Login;
using Quanlycongviec.Application.Features.Auth.Commands.Mfa;
using Quanlycongviec.Application.Features.Auth.Commands.RefreshToken;
using Quanlycongviec.Application.Features.Auth.Commands.Register;
using Quanlycongviec.Application.Features.Auth.Commands.SwitchContext;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class AuthController : ControllerBase
    {
        private readonly ISender _mediator;
        private readonly ILogger<AuthController> _logger;
        private readonly IConfiguration _configuration;
        private readonly Quanlycongviec.Application.Common.Interfaces.IApplicationDbContext _context;
        private readonly Quanlycongviec.Application.Common.Interfaces.ITurnstileValidator _turnstileValidator;

        public AuthController(
            ISender mediator,
            ILogger<AuthController> logger,
            IConfiguration configuration,
            Quanlycongviec.Application.Common.Interfaces.IApplicationDbContext context,
            Quanlycongviec.Application.Common.Interfaces.ITurnstileValidator turnstileValidator)
        {
            _mediator = mediator;
            _logger = logger;
            _configuration = configuration;
            _context = context;
            _turnstileValidator = turnstileValidator;
        }

        // BẢO MẬT (Audit P4B): Xác minh chống bot (Turnstile) cho endpoint công khai
        private Task<bool> PassesBotCheckAsync()
        {
            var token = Request.Headers["X-Turnstile-Token"].ToString();
            return _turnstileValidator.ValidateAsync(
                string.IsNullOrWhiteSpace(token) ? null : token,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                HttpContext.RequestAborted);
        }

        private IActionResult BotCheckRejected() =>
            BadRequest(new { success = false, error = "Xác minh chống bot không đạt. Vui lòng thử lại." });

        // BẢO MẬT (Audit C2): Đăng ký tài khoản cán bộ mới — chỉ lãnh đạo (LeaderOnly)
        [HttpPost("register")]
        [Authorize(Policy = "LeaderOnly")]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> Register([FromBody] RegisterCommand command)
        {
            var result = await _mediator.Send(command);
            SetTokenCookie(result.Token, result.RefreshToken);
            return Ok(new { success = true, data = result, token = result.Token, refreshToken = result.RefreshToken, message = "Đăng ký thành công." });
        }

        // Đăng nhập tài khoản và lấy danh sách chức danh kiêm nhiệm
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> Login([FromBody] LoginCommand command)
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            var result = await _mediator.Send(command);
            if (!result.MfaRequired && !string.IsNullOrEmpty(result.Token))
            {
                SetTokenCookie(result.Token, result.RefreshToken);
            }
            return Ok(new { success = true, data = result, token = result.Token, refreshToken = result.RefreshToken, message = result.MfaRequired ? "Yêu cầu xác thực 2 yếu tố (OTP)." : "Đăng nhập thành công." });
        }

        // BẢO MẬT (Audit C1): Chuyển đổi ngữ cảnh kiêm nhiệm — UserId lấy từ JWT claim chống IDOR
        [HttpPost("switch-context")]
        public async Task<IActionResult> SwitchContext([FromBody] SwitchContextCommand command)
        {
            command = command with { UserId = GetCurrentUserId() };
            var result = await _mediator.Send(command);
            SetTokenCookie(result.Token, result.RefreshToken);
            return Ok(new { success = true, data = result, token = result.Token, refreshToken = result.RefreshToken, message = $"Đã chuyển ngữ cảnh sang vai trò [{command.TargetRoleCode}] thành công." });
        }

        // Cấp lại access token mới khi token hiện tại hết hạn bằng refresh token
        [HttpPost("refresh")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> Refresh([FromBody] RefreshAccessTokenCommand command)
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            try
            {
                var result = await _mediator.Send(command);
                SetTokenCookie(result.Token, result.RefreshToken);
                return Ok(new { success = true, data = result, token = result.Token, refreshToken = result.RefreshToken, message = "Đã làm mới phiên làm việc." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
        }

        // Hoàn tất đăng nhập 2 bước: xác thực mã OTP/TOTP
        [HttpPost("mfa/verify-login")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> VerifyMfaLogin([FromBody] VerifyMfaLoginCommand command)
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            try
            {
                var result = await _mediator.Send(command);
                SetTokenCookie(result.Token, result.RefreshToken);
                return Ok(new { success = true, data = result, token = result.Token, refreshToken = result.RefreshToken, message = "Xác thực 2 yếu tố thành công." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
        }

        // Bước 1 bật MFA: Sinh secret TOTP + URI quét mã QR
        [HttpPost("mfa/setup")]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> MfaSetup()
        {
            var userId = GetCurrentUserId();
            var result = await _mediator.Send(new MfaSetupCommand(userId));
            return Ok(new { success = true, data = result });
        }

        // Bước 2 bật MFA: Xác nhận mã OTP đầu tiên để kích hoạt
        [HttpPost("mfa/enable")]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> MfaEnable([FromBody] MfaEnableCommand command)
        {
            try
            {
                command.UserId = GetCurrentUserId();
                var result = await _mediator.Send(command);
                return Ok(new { success = result, message = "Đã bật xác thực 2 yếu tố." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        // Tắt MFA: Yêu cầu mã OTP hiện tại để xác nhận
        [HttpPost("mfa/disable")]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> MfaDisable([FromBody] MfaDisableCommand command)
        {
            try
            {
                command.UserId = GetCurrentUserId();
                var result = await _mediator.Send(command);
                return Ok(new { success = result, message = "Đã tắt xác thực 2 yếu tố." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        // BẢO MẬT (Audit Đợt 3): Gửi mã OTP xác thực 2 yếu tố qua email công vụ (cooldown 60s)
        [HttpPost("mfa/email-code")]
        [HttpPost("mfa/send-email-code")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> SendMfaEmailCode([FromBody] SendMfaEmailCodeCommand? command)
        {
            try
            {
                command ??= new SendMfaEmailCodeCommand();
                if (string.IsNullOrWhiteSpace(command.MfaToken))
                {
                    command.SessionUserId = GetCurrentUserId();
                }

                var result = await _mediator.Send(command);
                return Ok(new
                {
                    success = true,
                    data = result,
                    cooldownSeconds = result.CooldownSeconds,
                    maskedEmail = result.MaskedEmail,
                    message = $"Mã xác thực đã được gửi tới {result.MaskedEmail}. Mã có hiệu lực 5 phút."
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        // BẢO MẬT: Đăng xuất khỏi tất cả các thiết bị khác (thu hồi toàn bộ Refresh Token khác phiên hiện tại)
        [HttpPost("logout-other-sessions")]
        [HttpPost("revoke-other-sessions")]
        [Authorize]
        public async Task<IActionResult> LogoutOtherSessions()
        {
            var userId = GetCurrentUserId();
            var currentRefreshToken = Request.Cookies["refresh_token"];
            await _mediator.Send(new Quanlycongviec.Application.Features.Auth.Commands.RefreshToken.RevokeOtherSessionsCommand(userId, currentRefreshToken));
            return Ok(new { success = true, message = "Đã đăng xuất tài khoản khỏi tất cả các thiết bị khác thành công." });
        }

        // BẢO MẬT (Audit H2): Đăng xuất — xóa cookie và thu hồi refresh token (hỗ trợ cả body & cookie)
        [HttpPost("logout")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> Logout([FromBody] LogoutRequest? request)
        {
            var refreshToken = request?.RefreshToken;
            if (string.IsNullOrEmpty(refreshToken))
            {
                refreshToken = Request.Cookies["refresh_token"];
            }

            if (!string.IsNullOrEmpty(refreshToken))
            {
                await _mediator.Send(new RevokeRefreshTokenCommand(refreshToken));
            }

            Response.Cookies.Delete("access_token", new CookieOptions
            {
                Path = "/",
                HttpOnly = true,
                SameSite = SameSiteMode.Lax
            });
            Response.Cookies.Delete("refresh_token", new CookieOptions
            {
                Path = "/",
                HttpOnly = true,
                SameSite = SameSiteMode.Lax
            });
            return Ok(new { success = true, message = "Đăng xuất thành công." });
        }

        // Bước 1 quên mật khẩu: Gửi mã OTP đặt lại mật khẩu qua email công vụ
        [HttpPost("forgot-password/send-otp")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> SendPasswordResetOtp([FromBody] Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword.SendPasswordResetOtpCommand command)
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            try
            {
                var result = await _mediator.Send(command);
                return Ok(new { success = result, message = "Mã xác thực khôi phục mật khẩu đã được gửi đến hòm thư. Vui lòng kiểm tra hòm thư!" });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý yêu cầu gửi mã OTP khôi phục mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi trong quá trình gửi mã xác thực." });
            }
        }

        // BẢO MẬT (Audit Đợt 4): Bước 2 quên mật khẩu Email — xác minh OTP và cấp ResetToken
        [HttpPost("forgot-password/verify-otp")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> VerifyResetOtp([FromBody] Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword.VerifyResetOtpCommand command)
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            try
            {
                var result = await _mediator.Send(command);
                return Ok(new { success = true, resetToken = result.ResetToken, data = new { resetToken = result.ResetToken }, message = "Mã xác thực chính xác. Vui lòng đặt mật khẩu mới." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xác minh OTP khôi phục mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi khi xác minh mã xác thực." });
            }
        }

        // BẢO MẬT (Audit Đợt 4): Bước 2 quên mật khẩu Authenticator — xác minh TOTP và cấp ResetToken
        [HttpPost("forgot-password/verify-reset-mfa")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> VerifyResetMfa([FromBody] Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword.VerifyResetMfaCommand command)
        {
            try
            {
                var result = await _mediator.Send(command);
                return Ok(new { success = true, resetToken = result.ResetToken, data = new { resetToken = result.ResetToken }, message = "Xác thực 2 bước chính xác. Vui lòng đặt mật khẩu mới." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xác minh khôi phục mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi khi xác minh mã xác thực." });
            }
        }

        // Bước 3 quên mật khẩu Email — đặt mật khẩu mới bằng ResetToken
        [HttpPost("forgot-password/reset-with-otp")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> ResetPasswordWithOtp([FromBody] Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword.ResetPasswordWithOtpCommand command)
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            try
            {
                var result = await _mediator.Send(command);
                return Ok(new { success = result, message = "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay bằng mật khẩu mới." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đặt lại mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi khi hoàn tất đặt lại mật khẩu." });
            }
        }

        // Bước 3 quên mật khẩu Authenticator — đặt mật khẩu mới bằng ResetToken
        [HttpPost("forgot-password/reset-with-mfa")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> ResetPasswordWithMfa([FromBody] Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword.ResetPasswordWithMfaCommand command)
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            try
            {
                var result = await _mediator.Send(command);
                return Ok(new { success = result, message = "Xác thực bảo mật 2 bước thành công và đã cập nhật mật khẩu mới." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đặt lại mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi khi hoàn tất đặt lại mật khẩu." });
            }
        }

        // BẢO MẬT: Bước 1 Đổi mật khẩu — Gửi mã OTP về Email công vụ của cán bộ
        [HttpPost("change-password/send-otp")]
        public async Task<IActionResult> SendChangePasswordOtp()
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            try
            {
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!Guid.TryParse(userIdStr, out var userId))
                {
                    return Unauthorized(new { success = false, error = "Phiên làm việc không hợp lệ." });
                }

                await _mediator.Send(new Quanlycongviec.Application.Features.Auth.Commands.ChangePassword.SendChangePasswordOtpCommand(userId));
                return Ok(new { success = true, message = "Mã xác thực OTP đã được gửi đến email công vụ của đồng chí." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gửi mã OTP đổi mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi khi gửi mã xác thực." });
            }
        }

        // BẢO MẬT: Bước 1 Đổi mật khẩu — Xác thực mật khẩu hiện tại và OTP để cấp ChangePasswordToken
        [HttpPost("change-password/verify-step1")]
        public async Task<IActionResult> VerifyChangePasswordStep1([FromBody] Quanlycongviec.Application.Features.Auth.Commands.ChangePassword.VerifyChangePasswordStepCommand command)
        {
            if (!await PassesBotCheckAsync()) return BotCheckRejected();
            try
            {
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!Guid.TryParse(userIdStr, out var userId))
                {
                    return Unauthorized(new { success = false, error = "Phiên làm việc không hợp lệ." });
                }

                var fixedCommand = command with { UserId = userId };
                var result = await _mediator.Send(fixedCommand);

                return Ok(new
                {
                    success = true,
                    changePasswordToken = result.ChangePasswordToken,
                    data = new { changePasswordToken = result.ChangePasswordToken },
                    message = result.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xác minh Bước 1 đổi mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi khi xác minh danh tính." });
            }
        }

        // BẢO MẬT: Bước 2 Đổi mật khẩu — Thiết lập mật khẩu mới qua ChangePasswordToken
        [HttpPost("change-password/complete")]
        public async Task<IActionResult> CompleteChangePassword([FromBody] Quanlycongviec.Application.Features.Auth.Commands.ChangePassword.CompleteChangePasswordCommand command)
        {
            try
            {
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!Guid.TryParse(userIdStr, out var userId))
                {
                    return Unauthorized(new { success = false, error = "Phiên làm việc không hợp lệ." });
                }

                var fixedCommand = command with { UserId = userId };
                var result = await _mediator.Send(fixedCommand);

                SetTokenCookie(result.Token, result.RefreshToken);
                return Ok(new
                {
                    success = true,
                    message = "Đã cập nhật mật khẩu mới thành công.",
                    data = result,
                    token = result.Token,
                    refreshToken = result.RefreshToken
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi hoàn tất đổi mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi khi cập nhật mật khẩu mới." });
            }
        }

        // BẢO MẬT (Audit A5): Đổi mật khẩu trực tiếp cho người dùng đã đăng nhập (tương thích ngược)
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] Quanlycongviec.Application.Features.Auth.Commands.ChangePassword.ChangePasswordCommand command)
        {
            try
            {
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!Guid.TryParse(userIdStr, out var userId))
                {
                    return Unauthorized(new { success = false, error = "Phiên làm việc không hợp lệ." });
                }

                var fixedCommand = command with { UserId = userId };
                var result = await _mediator.Send(fixedCommand);

                SetTokenCookie(result.Token, result.RefreshToken);
                return Ok(new
                {
                    success = true,
                    message = "Đã cập nhật mật khẩu mới thành công.",
                    data = result,
                    token = result.Token,
                    refreshToken = result.RefreshToken
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đổi mật khẩu: {Message}", ex.Message);
                return StatusCode(500, new { success = false, error = "Đã xảy ra lỗi khi cập nhật mật khẩu." });
            }
        }

        // Lấy thông tin tài khoản hiện tại từ JWT / DB
        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            var fullName = User.FindFirst("FullName")?.Value;
            var email = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)?.Value;
            var activeRole = User.FindFirst("ActiveRole")?.Value;
            var rankLevel = User.FindFirst("RankLevel")?.Value;

            bool mfaEnabled = false;
            if (Guid.TryParse(userIdStr, out var uid))
            {
                var user = await _context.Users.FindAsync(new object[] { uid });
                if (user != null)
                {
                    mfaEnabled = user.MfaEnabled;
                }
            }

            return Ok(new
            {
                success = true,
                data = new
                {
                    userId = userIdStr,
                    username,
                    fullName,
                    email,
                    activeRole,
                    rankLevel,
                    mfaEnabled
                }
            });
        }

        // BẢO MẬT (Audit X1): Lấy ID người dùng hiện tại qua CurrentUserExtensions
        private Guid GetCurrentUserId() => User.GetUserId();

        private void SetTokenCookie(string token, string refreshToken)
        {
            var isHttps = Request.IsHttps || string.Equals(Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

            var accessTokenMinutes = int.TryParse(_configuration["Jwt:AccessTokenMinutes"], out var minutes)
                ? minutes
                : 30;

            var accessCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UtcNow.AddMinutes(accessTokenMinutes)
            };

            var refreshTokenDays = int.TryParse(_configuration["Jwt:RefreshTokenDays"], out var days)
                ? days
                : 7;

            var refreshCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UtcNow.AddDays(refreshTokenDays)
            };

            Response.Cookies.Append("access_token", token, accessCookieOptions);
            Response.Cookies.Append("refresh_token", refreshToken, refreshCookieOptions);
        }
    }

    public class LogoutRequest
    {
        public string? RefreshToken { get; set; }
    }
}

