using System;
using System.Security.Claims;

namespace Quanlycongviec.Api.Controllers
{
    // BẢO MẬT (Audit X1): Helper tập trung duy nhất để lấy UserId từ JWT claim (trả về Guid.Empty nếu không hợp lệ)
    public static class CurrentUserExtensions
    {
        public static Guid GetUserId(this ClaimsPrincipal? user)
        {
            var userIdStr = user?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? user?.FindFirstValue("sub");
            return Guid.TryParse(userIdStr, out var userId) ? userId : Guid.Empty;
        }
    }
}