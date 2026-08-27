using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Infrastructure.Persistence;

namespace Quanlycongviec.Api.Controllers
{
    // BẢO MẬT (Audit C3): Controller quản trị — yêu cầu xác thực + policy LeaderOnly
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<AdminController> _logger;
        private readonly IWebHostEnvironment _environment;

        public AdminController(
            IApplicationDbContext context,
            IServiceProvider serviceProvider,
            ILogger<AdminController> logger,
            IWebHostEnvironment environment)
        {
            _context = context;
            _serviceProvider = serviceProvider;
            _logger = logger;
            _environment = environment;
        }

        // BẢO MẬT (Audit C3): Nạp lại dữ liệu mẫu — chỉ chạy trong Development và yêu cầu LeaderOnly
        [HttpPost("seed-demo")]
        [Authorize(Policy = "LeaderOnly")]
        public async Task<IActionResult> SeedDemoData()
        {
            // Phòng vệ thứ hai ngoài attribute: chặn hẳn ở Production bất kể ai gọi
            if (!_environment.IsDevelopment())
            {
                return StatusCode(403, new
                {
                    success = false,
                    message = "Chức năng nạp dữ liệu mẫu chỉ khả dụng trong môi trường phát triển (Development)."
                });
            }

            try
            {
                _logger.LogInformation("Bắt đầu nạp lại bộ dữ liệu mẫu phong phú (Rich Seed Dataset)...");

                await DbInitializer.SeedAsync(_serviceProvider, force: true);

                var usersCount = await _context.Users.CountAsync();
                var inboxDocsCount = await _context.InboxDocuments.CountAsync();
                var tasksCount = await _context.TaskItems.CountAsync();
                var subTasksCount = await _context.SubTasks.CountAsync();
                var eventsCount = await _context.CalendarEvents.CountAsync();
                var outgoingDocsCount = await _context.OutgoingDocuments.CountAsync();

                return Ok(new
                {
                    success = true,
                    message = "Đã nạp thành công bộ dữ liệu mẫu phong phú cho toàn hệ thống!",
                    timestamp = DateTime.UtcNow,
                    summary = new
                    {
                        departments = 5,
                        roles = 8,
                        users = usersCount,
                        inboxDocuments = inboxDocsCount,
                        taskItems = tasksCount,
                        subTasks = subTasksCount,
                        calendarEvents = eventsCount,
                        outgoingDocuments = outgoingDocsCount
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi nạp dữ liệu mẫu.");
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Lỗi khi nạp dữ liệu mẫu: {ex.Message}"
                });
            }
        }

        // BẢO MẬT (Audit C3): đã XÓA HẲN endpoint reset-mfa —
        // endpoint này cho phép tắt MFA của TOÀN BỘ tài khoản ẩn danh, không có nghiệp vụ hợp lệ nào.
    }
}