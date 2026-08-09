using System;
using System.Collections.Generic;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IJwtTokenService
    {
        string GenerateToken(User user, string activeRole, IEnumerable<string> allRoles, int rankLevel = 5);
    }
}
