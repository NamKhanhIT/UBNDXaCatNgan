using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Features.Auth.Commands.Login;
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

        public AuthController(ISender mediator, ILogger<AuthController> logger)
        {
            _mediator = mediator;
            _logger = logger;
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
        public async Task<IActionResult> Register([FromBody] RegisterCommand command)
        {
            var result = await _mediator.Send(command);
            SetTokenCookie(result.Token);
            // Trả token trong body để client mobile/remote dùng Bearer auth
            return Ok(new { success = true, data = result, token = result.Token, message = "Đăng ký thành công." });
        }

        /// <summary>
        /// Đăng nhập tài khoản và lấy danh sách chức danh kiêm nhiệm
        /// </summary>
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginCommand command)
        {
            var result = await _mediator.Send(command);
            SetTokenCookie(result.Token);
            // Trả token trong body: client remote/mobile sẽ lưu vào localStorage và gửi qua Authorization header
            return Ok(new { success = true, data = result, token = result.Token, message = "Đăng nhập thành công." });
        }

        /// <summary>
        /// Chuyển đổi tư cách / ngữ cảnh kiêm nhiệm (Context Switching)
        /// </summary>
        [HttpPost("switch-context")]
        public async Task<IActionResult> SwitchContext([FromBody] SwitchContextCommand command)
        {
            var result = await _mediator.Send(command);
            SetTokenCookie(result.Token);
            return Ok(new { success = true, data = result, token = result.Token, message = $"Đã chuyển ngữ cảnh sang vai trò [{command.TargetRoleCode}] thành công." });
        }

        /// <summary>
        /// Đăng xuất — xoá cookie access_token
        /// </summary>
        [HttpPost("logout")]
        [AllowAnonymous]
        public IActionResult Logout()
        {
            Response.Cookies.Delete("access_token", new CookieOptions
            {
                Path = "/",
                HttpOnly = true,
                SameSite = SameSiteMode.Lax
            });
            return Ok(new { success = true, message = "Đăng xuất thành công." });
        }

        /// <summary>
        /// Kiểm tra trạng thái đăng nhập — trả về thông tin user từ JWT cookie
        /// </summary>
        [HttpGet("me")]
        public IActionResult Me()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            var fullName = User.FindFirst("FullName")?.Value;
            var email = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)?.Value;
            var activeRole = User.FindFirst("ActiveRole")?.Value;
            var rankLevel = User.FindFirst("RankLevel")?.Value;

            return Ok(new
            {
                success = true,
                data = new
                {
                    userId,
                    username,
                    fullName,
                    email,
                    activeRole,
                    rankLevel
                }
            });
        }

        private void SetTokenCookie(string token)
        {
            var isHttps = Request.IsHttps || string.Equals(Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UtcNow.AddDays(7)
            };

            Response.Cookies.Append("access_token", token, cookieOptions);
        }
    }
}

