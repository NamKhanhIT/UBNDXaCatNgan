using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Users.Commands.UpdateProfile;

namespace Quanlycongviec.Application.Features.Users.Queries.GetProfile
{
    public record GetUserProfileQuery(Guid UserId) : IRequest<UserProfileResultDto>;

    public class GetUserProfileQueryHandler : IRequestHandler<GetUserProfileQuery, UserProfileResultDto>
    {
        private readonly IApplicationDbContext _context;

        public GetUserProfileQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<UserProfileResultDto> Handle(GetUserProfileQuery request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .Include(u => u.PrimaryDepartment)
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

            if (user == null)
            {
                throw new InvalidOperationException("Không tìm thấy thông tin tài khoản người dùng.");
            }

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
