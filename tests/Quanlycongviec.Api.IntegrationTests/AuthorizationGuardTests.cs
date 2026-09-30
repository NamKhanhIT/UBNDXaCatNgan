using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    // =====================================================================
    // BẢO MẬT (Audit Đợt 4): Lưới reflection chặn hồi quy phân quyền.
    // Bất kỳ controller/endpoint mới nào thiếu [Authorize], thêm [AllowAnonymous]
    // ngoài whitelist, hoặc bỏ rate-limit trên endpoint anonymous đều làm test đỏ.
    // =====================================================================
    public class AuthorizationGuardTests
    {
        private static readonly Assembly ApiAssembly =
            typeof(Quanlycongviec.Api.Controllers.AuthController).Assembly;

        private static readonly string[] HttpVerbAttributeNames =
        {
            "HttpPostAttribute", "HttpGetAttribute", "HttpPutAttribute",
            "HttpDeleteAttribute", "HttpPatchAttribute"
        };

        // Endpoint anonymous ĐƯỢC PHÉP — bổ sung vào đây bắt buộc kèm lý do bảo mật
        // được ghi trong PR/review. Đây là "từ điển" duy nhất của bề mặt công khai.
        private static readonly HashSet<string> ApprovedAnonymousEndpoints = new()
        {
            "AuthController.Login",
            "AuthController.Refresh",
            "AuthController.VerifyMfaLogin",
            "AuthController.SendMfaEmailCode",
            "AuthController.Logout",
            "AuthController.SendPasswordResetOtp",
            "AuthController.VerifyResetOtp",      // Đợt 4: bước 2 xác minh OTP → cấp reset token
            "AuthController.VerifyResetMfa",      // Đợt 4: bước 2 xác minh TOTP → cấp reset token
            "AuthController.ResetPasswordWithOtp",
            "AuthController.ResetPasswordWithMfa",
            "PushController.GetVapidPublicKey" // chỉ trả về khóa VAPID CÔNG KHAI cho trình duyệt đăng ký push
        };

        private static IEnumerable<Type> AllControllers() =>
            ApiAssembly.GetTypes()
                .Where(t => t.IsClass && !t.IsAbstract
                            && t.Name.EndsWith("Controller", StringComparison.Ordinal)
                            && (t.Namespace ?? string.Empty)
                                .StartsWith("Quanlycongviec.Api.Controllers", StringComparison.Ordinal));

        private static bool IsActionMethod(MethodInfo m) =>
            m.IsPublic && !m.IsStatic
            && m.GetCustomAttributes(true).Any(a => HttpVerbAttributeNames.Contains(a.GetType().Name));

        private static bool HasAllowAnonymous(MethodInfo m) =>
            m.GetCustomAttribute<AllowAnonymousAttribute>() != null;

        [Fact]
        public void Every_Controller_Must_Have_ClassLevel_Authorize()
        {
            var offenders = AllControllers()
                .Where(c => c.GetCustomAttribute<AuthorizeAttribute>() == null)
                .Select(c => c.Name)
                .ToList();

            offenders.Should().BeEmpty(
                "mọi controller phải khóa mặc định bằng [Authorize] cấp class; " +
                "endpoint công khai phải khai báo [AllowAnonymous] tường minh để lưới reflection nhìn thấy");
        }

        [Fact]
        public void Anonymous_Endpoints_Must_Be_In_Approved_Whitelist()
        {
            var offenders = new List<string>();

            foreach (var controller in AllControllers())
            {
                foreach (var method in controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                {
                    if (!IsActionMethod(method) || !HasAllowAnonymous(method)) continue;

                    var key = $"{controller.Name}.{method.Name}";
                    if (!ApprovedAnonymousEndpoints.Contains(key))
                    {
                        offenders.Add(key);
                    }
                }
            }

            offenders.Should().BeEmpty(
                "phát hiện endpoint [AllowAnonymous] MỚI chưa được phê duyệt: " +
                string.Join(", ", offenders));
        }

        [Fact]
        public void Whitelisted_Auth_Endpoints_Must_Still_Exist()
        {
            // Chặn ngược: nếu ai đổi tên/xóa endpoint trong whitelist mà không dọn
            // whitelist thì test này đỏ — tránh whitelist thành danh sách ma.
            var currentAnonymous = new HashSet<string>();

            foreach (var controller in AllControllers())
            {
                foreach (var method in controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                {
                    if (!IsActionMethod(method) || !HasAllowAnonymous(method)) continue;
                    currentAnonymous.Add($"{controller.Name}.{method.Name}");
                }
            }

            var ghosts = ApprovedAnonymousEndpoints.Where(k => !currentAnonymous.Contains(k)).ToList();

            ghosts.Should().BeEmpty(
                "whitelist chứa endpoint không còn tồn tại, cần dọn: " + string.Join(", ", ghosts));
        }

        [Fact]
        public void Anonymous_Auth_Endpoints_Must_Be_RateLimited()
        {
            var exempt = new HashSet<string> { "PushController.GetVapidPublicKey" };
            var offenders = new List<string>();

            foreach (var controller in AllControllers())
            {
                foreach (var method in controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                {
                    if (!IsActionMethod(method) || !HasAllowAnonymous(method)) continue;

                    var key = $"{controller.Name}.{method.Name}";
                    if (exempt.Contains(key)) continue;

                    var hasLimiter = method.GetCustomAttributes(true)
                        .Concat(controller.GetCustomAttributes(true))
                        .Any(a => a is EnableRateLimitingAttribute);

                    if (!hasLimiter)
                    {
                        offenders.Add(key);
                    }
                }
            }

            offenders.Should().BeEmpty(
                "endpoint anonymous là mặt trận brute-force bắt buộc phải có [EnableRateLimiting]: " +
                string.Join(", ", offenders));
        }

        [Fact]
        public void Sensitive_Admin_And_Signing_Endpoints_Must_Carry_Policies()
        {
            var adminLeaderOnly = RequireController("AdminController")
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .SelectMany(m => m.GetCustomAttributes<AuthorizeAttribute>())
                .Any(a => a.Policy == "LeaderOnly");
            adminLeaderOnly.Should().BeTrue("AdminController.seed-demo phải đặt dưới policy LeaderOnly (Audit C3)");

            // Task actions use the shared object policy, including rank-4 deputies and exact reviewers.
            // The application role matrix verifies those decisions; the class-level authentication
            // guard above still prevents public task endpoints.

            var ratingLeaderOnly = RequireController("RatingHistoryController")
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Count(m => m.GetCustomAttribute<AuthorizeAttribute>()?.Policy == "LeaderOnly");
            ratingLeaderOnly.Should().BeGreaterThanOrEqualTo(3,
                "các endpoint chốt điểm/xem toàn đơn vị phải đặt dưới policy LeaderOnly");
        }

        private static Type RequireController(string name) =>
            AllControllers().First(c => c.Name == name);
    }
}
