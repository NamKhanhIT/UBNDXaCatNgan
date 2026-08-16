using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Infrastructure.Persistence;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AdminController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<AdminController> _logger;

        public AdminController(
            IApplicationDbContext context,
            IServiceProvider serviceProvider,
            ILogger<AdminController> logger)
        {
            _context = context;
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        /// <summary>
        /// Nạp lại toàn bộ bộ dữ liệu mẫu phong phú (Rich Seed Dataset) từ scripts/seed_database.sql.
        /// </summary>
        [HttpPost("seed-demo")]
        [AllowAnonymous]
        public async Task<IActionResult> SeedDemoData()
        {
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
                    message = "Đã nạp thành công bộ dữ liệu mẫu phong phú cho toàn hệ thống UBND Xã Cát Ngạn!",
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
    }
}
