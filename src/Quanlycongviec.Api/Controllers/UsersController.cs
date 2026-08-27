using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Notifications.Commands.SendTestSms;
using Quanlycongviec.Application.Features.Users.Commands.ChangeEmail;
using Quanlycongviec.Application.Features.Users.Commands.Phone;
using Quanlycongviec.Application.Features.Users.Queries.GetUsersPaginated;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly ISender _mediator;

        public UsersController(ISender mediator)
        {
            _mediator = mediator;
        }

        /// <summary>
        /// Lấy danh sách cán bộ / nhân sự toàn xã (Hỗ trợ phân trang, tìm kiếm, lọc phòng ban, vai trò, mức tải việc)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] Guid? departmentId = null,
            [FromQuery] string? roleCode = null,
            [FromQuery] string? workloadStatus = null)
        {
            var result = await _mediator.Send(new GetUsersPaginatedQuery
            {
                Page = page,
                PageSize = pageSize,
                Search = search,
                DepartmentId = departmentId,
                RoleCode = roleCode,
                WorkloadStatus = workloadStatus
            });
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Lấy thông tin chi tiết hồ sơ cá nhân và cấu hình của cán bộ đang đăng nhập
        /// </summary>
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userId = User.GetUserId();
            var result = await _mediator.Send(new Quanlycongviec.Application.Features.Users.Queries.GetProfile.GetUserProfileQuery(userId));
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Cập nhật hồ sơ cá nhân, tùy biến thông báo, giao diện và CV công vụ
        /// </summary>
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] Quanlycongviec.Application.Features.Users.Commands.UpdateProfile.UpdateUserProfileCommand command)
        {
            var userId = User.GetUserId();
            var fixedCommand = command with { UserId = userId };
            var result = await _mediator.Send(fixedCommand);
            return Ok(new { success = true, data = result, message = "Đã cập nhật hồ sơ cá nhân thành công." });
        }

        // ══════════════════════════════════════════════════════════════════
        // QUY TRÌNH ĐỔI EMAIL CÔNG VỤ (2-STEP VERIFICATION)
        // ══════════════════════════════════════════════════════════════════

        public record RequestEmailChangeDto(string CurrentPassword, string NewEmail);

        /// <summary>
        /// Bước 1: Yêu cầu đổi Email công vụ (Xác thực mật khẩu hiện tại & gửi OTP đến Email mới)
        /// </summary>
        [HttpPost("email/request-change")]
        public async Task<IActionResult> RequestEmailChange([FromBody] RequestEmailChangeDto dto)
        {
            var userId = User.GetUserId();
            var result = await _mediator.Send(new RequestChangeEmailCommand(userId, dto.CurrentPassword, dto.NewEmail));
            if (!result.Success)
            {
                return BadRequest(new { success = false, error = result.Error, cooldownSeconds = result.CooldownSeconds });
            }
            return Ok(new { success = true, message = result.Message, cooldownSeconds = result.CooldownSeconds });
        }

        public record ConfirmEmailChangeDto(string OtpCode);

        /// <summary>
        /// Bước 2: Xác nhận mã OTP gửi đến Email mới và hoàn tất cập nhật Email
        /// </summary>
        [HttpPost("email/confirm-change")]
        public async Task<IActionResult> ConfirmEmailChange([FromBody] ConfirmEmailChangeDto dto)
        {
            var userId = User.GetUserId();
            var result = await _mediator.Send(new ConfirmChangeEmailCommand(userId, dto.OtpCode));
            if (!result.Success)
            {
                return BadRequest(new { success = false, error = result.Error });
            }
            return Ok(new { success = true, message = result.Message, newEmail = result.NewEmail });
        }

        // ══════════════════════════════════════════════════════════════════
        // QUY TRÌNH XÁC THỰC SỐ ĐIỆN THOẠI QUA SMS GATEWAY MIỄN PHÍ
        // ══════════════════════════════════════════════════════════════════

        public record SendPhoneOtpDto(string PhoneNumber);

        /// <summary>
        /// Gửi mã OTP 6 số qua SMS Gateway tới số điện thoại cán bộ
        /// </summary>
        [HttpPost("phone/send-otp")]
        public async Task<IActionResult> SendPhoneOtp([FromBody] SendPhoneOtpDto dto)
        {
            var userId = User.GetUserId();
            var result = await _mediator.Send(new SendPhoneVerificationOtpCommand(userId, dto.PhoneNumber));
            if (!result.Success)
            {
                return BadRequest(new { success = false, error = result.Error, cooldownSeconds = result.CooldownSeconds });
            }
            return Ok(new { success = true, message = result.Message, cooldownSeconds = result.CooldownSeconds });
        }

        public record VerifyPhoneOtpDto(string PhoneNumber, string OtpCode);

        /// <summary>
        /// Xác thực mã OTP SMS và lưu trạng thái PhoneNumberConfirmed = true vào CSDL
        /// </summary>
        [HttpPost("phone/verify-otp")]
        public async Task<IActionResult> VerifyPhoneOtp([FromBody] VerifyPhoneOtpDto dto)
        {
            var userId = User.GetUserId();
            var result = await _mediator.Send(new VerifyPhoneOtpCommand(userId, dto.PhoneNumber, dto.OtpCode));
            if (!result.Success)
            {
                return BadRequest(new { success = false, error = result.Error });
            }
            return Ok(new { success = true, message = result.Message, confirmedPhoneNumber = result.ConfirmedPhoneNumber });
        }

        public record SendTestSmsDto(string? PhoneNumber);

        /// <summary>
        /// Gửi tin nhắn SMS thử nghiệm tới số điện thoại cán bộ (Test SMS Notification)
        /// </summary>
        [HttpPost("notifications/test-sms")]
        public async Task<IActionResult> SendTestSms([FromBody] SendTestSmsDto? dto)
        {
            var userId = User.GetUserId();
            var result = await _mediator.Send(new SendTestSmsCommand(userId, dto?.PhoneNumber));
            if (!result.Success)
            {
                return BadRequest(new { success = false, error = result.Error });
            }
            return Ok(new { success = true, message = result.Message, gatewayStatus = result.GatewayStatus });
        }
    }
}
