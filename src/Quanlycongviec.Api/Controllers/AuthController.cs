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

        public AuthController(
            ISender mediator,
            ILogger<AuthController> logger,
            IConfiguration configuration,
            Quanlycongviec.Application.Common.Interfaces.IApplicationDbContext context)
        {
            _mediator = mediator;
            _logger = logger;
            _configuration = configuration;
            _context = context;
        }

        /// <summary>
        /// Xác định truy cập từ xa (Cloudflare, mobile ngoài mạng LAN)
        /// </summary>
        private bool IsRemoteAccess()
        {
            var origin = Request.Headers["Origin"].ToString();
            var referer = Request.Headers["Referer"].ToString();
            var source = (!string.IsNullOrEmpty(origin) ? origin : referer).ToLowerInvariant();

            if (string.IsNullOrEmpty(source)) return false;

            return source.Contains("trycloudflare.com")
                || source.Contains("loca.lt")
                || source.Contains("ngrok.io")
                || source.Contains("ngrok-free.app");
        }

        /// <summary>
        /// Đăng ký tài khoản cán bộ mới
        /// </summary>
        [HttpPost("register")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> Register([FromBody] RegisterCommand command)
        {
            var result = await _mediator.Send(command);
            SetTokenCookie(result.Token, result.RefreshToken);
            // Trả token trong body để client mobile/remote dùng Bearer auth
            return Ok(new { success = true, data = result, token = result.Token, refreshToken = result.RefreshToken, message = "Đăng ký thành công." });
        }

        /// <summary>
        /// Đăng nhập tài khoản và lấy danh sách chức danh kiêm nhiệm
        /// </summary>
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> Login([FromBody] LoginCommand command)
        {
            var result = await _mediator.Send(command);
            // Chỉ set cookie đăng nhập khi đã qua xác thực đầy đủ (không bị chặn bởi MFA)
            if (!result.MfaRequired && !string.IsNullOrEmpty(result.Token))
            {
                SetTokenCookie(result.Token, result.RefreshToken);
            }
            // Trả token trong body: client remote/mobile sẽ lưu vào localStorage và gửi qua Authorization header
            return Ok(new { success = true, data = result, token = result.Token, refreshToken = result.RefreshToken, message = result.MfaRequired ? "Yêu cầu xác thực 2 yếu tố (OTP)." : "Đăng nhập thành công." });
        }

        /// <summary>
        /// Chuyển đổi tư cách / ngữ cảnh kiêm nhiệm (Context Switching)
        /// </summary>
        [HttpPost("switch-context")]
        public async Task<IActionResult> SwitchContext([FromBody] SwitchContextCommand command)
        {
            var result = await _mediator.Send(command);
            SetTokenCookie(result.Token, result.RefreshToken);
            return Ok(new { success = true, data = result, token = result.Token, refreshToken = result.RefreshToken, message = $"Đã chuyển ngữ cảnh sang vai trò [{command.TargetRoleCode}] thành công." });
        }

        /// <summary>
        /// Cấp lại access token mới khi token hiện tại hết hạn (dùng refresh token)
        /// </summary>
        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<IActionResult> Refresh([FromBody] RefreshAccessTokenCommand command)
        {
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

        /// <summary>
        /// Hoàn tất đăng nhập 2 bước: xác thực mã OTP (sau khi đã qua bước mật khẩu)
        /// </summary>
        [HttpPost("mfa/verify-login")]
        [AllowAnonymous]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> VerifyMfaLogin([FromBody] VerifyMfaLoginCommand command)
        {
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

        /// <summary>
        /// Sinh secret TOTP + URI quét QR (bước 1 bật MFA — chưa lưu)
        /// </summary>
        [HttpPost("mfa/setup")]
        [EnableRateLimiting("LoginLimiter")]
        public async Task<IActionResult> MfaSetup()
        {
            var userId = GetCurrentUserId();
            var result = await _mediator.Send(new MfaSetupCommand(userId));
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Xác nhận mã OTP đầu tiên và bật MFA (bước 2)
        /// </summary>
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

        /// <summary>
        /// Tắt MFA — yêu cầu mã OTP hiện tại để xác nhận
        /// </summary>
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

        /// <summary>
        /// Đăng xuất — xoá cookie và thu hồi refresh token
        /// </summary>
        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout([FromBody] LogoutRequest? request)
        {
            if (!string.IsNullOrEmpty(request?.RefreshToken))
            {
                await _mediator.Send(new RevokeRefreshTokenCommand(request.RefreshToken));
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

        /// <summary>
        /// Kiểm tra trạng thái đăng nhập — trả về thông tin user từ JWT cookie / DB
        /// </summary>
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

        private Guid GetCurrentUserId()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var userId) ? userId : Guid.Empty;
        }

        private void SetTokenCookie(string token, string refreshToken)
        {
            var isHttps = Request.IsHttps || string.Equals(Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

            // Access token: thời hạn ngắn (khớp với JWT exp)
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

            // Refresh token: thời hạn dài hơn (7 ngày mặc định), chỉ dùng để cấp lại access token
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

