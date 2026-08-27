using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Users.Commands.UpdateProfile
{
    public record UpdateUserProfileCommand : IRequest<UserProfileResultDto>
    {
        public Guid UserId { get; init; }
        public string? FullName { get; init; }
        public string? Email { get; init; }
        public string? ZaloPhoneNumber { get; init; }
        public string? Expertise { get; init; }
        public int? YearsOfExperience { get; init; }
        public string? WorkProfileJson { get; init; }
        public string? NotificationPreferences { get; init; }
        public string? AppearancePreferences { get; init; }
    }

    public class UserProfileResultDto
    {
        public Guid UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? ZaloPhoneNumber { get; set; }
        public bool PhoneNumberConfirmed { get; set; }
        public string? DepartmentName { get; set; }
        public string? ActiveRoleCode { get; set; }
        public string? Expertise { get; set; }
        public int YearsOfExperience { get; set; }
        public string? WorkProfileJson { get; set; }
        public string? NotificationPreferences { get; set; }
        public string? AppearancePreferences { get; set; }
    }

    public class UpdateUserProfileCommandHandler : IRequestHandler<UpdateUserProfileCommand, UserProfileResultDto>
    {
        private readonly IApplicationDbContext _context;

        public UpdateUserProfileCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<UserProfileResultDto> Handle(UpdateUserProfileCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .Include(u => u.PrimaryDepartment)
                .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

            if (user == null)
            {
                throw new InvalidOperationException("Không tìm thấy thông tin tài khoản người dùng.");
            }

            if (!string.IsNullOrWhiteSpace(request.FullName))
            {
                user.FullName = request.FullName.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                user.Email = request.Email.Trim();
            }

            if (request.ZaloPhoneNumber != null)
            {
                var phone = request.ZaloPhoneNumber.Trim();
                if (string.IsNullOrWhiteSpace(phone))
                {
                    user.ZaloPhoneNumber = null;
                }
                else
                {
                    if (!System.Text.RegularExpressions.Regex.IsMatch(phone, @"^0\d{9}$"))
                    {
                        throw new InvalidOperationException("Số điện thoại Zalo không hợp lệ. Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0 (ví dụ: 0912345678).");
                    }
                    user.ZaloPhoneNumber = phone;
                }
            }

            if (request.Expertise != null)
            {
                user.Expertise = request.Expertise.Trim();
            }

            if (request.YearsOfExperience.HasValue && request.YearsOfExperience.Value >= 0)
            {
                user.YearsOfExperience = request.YearsOfExperience.Value;
            }

            if (request.WorkProfileJson != null)
            {
                user.WorkProfileJson = request.WorkProfileJson;
            }

            if (request.NotificationPreferences != null)
            {
                user.NotificationPreferences = request.NotificationPreferences;
            }

            if (request.AppearancePreferences != null)
            {
                user.AppearancePreferences = request.AppearancePreferences;
            }

            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);

            return new UserProfileResultDto
            {
                UserId = user.Id,
                Username = user.Username,
                FullName = user.FullName,
                Email = user.Email,
                ZaloPhoneNumber = user.ZaloPhoneNumber,
                PhoneNumberConfirmed = user.PhoneNumberConfirmed,
                DepartmentName = user.PrimaryDepartment?.Name ?? "UBND Cấp Xã",
                ActiveRoleCode = user.ActiveRoleCode,
                Expertise = user.Expertise,
                YearsOfExperience = user.YearsOfExperience,
                WorkProfileJson = user.WorkProfileJson,
                NotificationPreferences = user.NotificationPreferences,
                AppearancePreferences = user.AppearancePreferences
            };
        }
    }
}
