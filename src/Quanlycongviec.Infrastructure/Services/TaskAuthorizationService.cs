using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Infrastructure.Services
{
    public class TaskAuthorizationService : ITaskAuthorizationService
    {
        private readonly IApplicationDbContext _context;

        public TaskAuthorizationService(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> CanAssignTaskAsync(Guid assignerId, Guid assigneeId, Guid? departmentId, CancellationToken cancellationToken = default)
        {
            if (assignerId == Guid.Empty || assigneeId == Guid.Empty) return false;
            if (assignerId == assigneeId) return false; // Không tự giao việc cho chính mình theo quy chuẩn hành chính

            var assigner = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == assignerId, cancellationToken);

            var assignee = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == assigneeId, cancellationToken);

            if (assigner == null || assignee == null) return false;

            int assignerRank = assigner.UserRoles.Where(ur => !ur.IsDeleted).Min(ur => (int?)ur.Role.RankLevel) ?? 5;
            int assigneeRank = assignee.UserRoles.Where(ur => !ur.IsDeleted).Min(ur => (int?)ur.Role.RankLevel) ?? 5;

            // 1. Chỉ giao XUỐNG DƯỚI (RankLevel số nhỏ hơn = cấp cao hơn)
            if (assignerRank >= assigneeRank) return false;

            // 2. Chuyên viên (Rank 5) không có quyền giao việc
            if (assignerRank >= 5) return false;

            // 3. Lãnh đạo cấp cao (Rank 1: Chủ tịch/Bí thư, Rank 2: Phó Chủ tịch) -> Toàn quyền giao việc liên phòng
            if (assignerRank <= 2) return true;

            // 4. Chánh Văn phòng (Rank 3): Quản lý Văn phòng và có thẩm quyền tham mưu điều phối liên phòng
            if (assigner.ActiveRoleCode == "ChanhVanPhong") return true;

            // 5. Trưởng phòng / Phó phòng chuyên môn (Rank 3, 4): Chỉ giao việc nội bộ phòng ban mình
            var assignerDeptId = assigner.PrimaryDepartmentId;
            var assigneeDeptId = assignee.PrimaryDepartmentId;

            if (assignerDeptId != null && assigneeDeptId != null && assignerDeptId == assigneeDeptId)
            {
                return true;
            }

            if (departmentId.HasValue && assignerDeptId.HasValue && departmentId.Value == assignerDeptId.Value)
            {
                return true;
            }

            return false;
        }

        public async Task<bool> CanTransferTaskAsync(Guid currentUserId, Guid taskId, Guid targetUserId, CancellationToken cancellationToken = default)
        {
            if (currentUserId == Guid.Empty || taskId == Guid.Empty || targetUserId == Guid.Empty) return false;

            var currentUser = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken);

            var task = await _context.TaskItems
                .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);

            var targetUser = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == targetUserId, cancellationToken);

            if (currentUser == null || task == null || targetUser == null) return false;

            int currentUserRank = currentUser.UserRoles.Where(ur => !ur.IsDeleted).Min(ur => (int?)ur.Role.RankLevel) ?? 5;
            int targetUserRank = targetUser.UserRoles.Where(ur => !ur.IsDeleted).Min(ur => (int?)ur.Role.RankLevel) ?? 5;

            // Chuyên viên không được điều chuyển
            if (currentUserRank >= 5) return false;

            // Không được điều chuyển cho người có Rank cao hơn hoặc ngang cấp mình
            if (currentUserRank >= targetUserRank) return false;

            // Lãnh đạo UBND (Rank 1, 2) có quyền điều chuyển liên phòng
            if (currentUserRank <= 2) return true;

            // Chánh Văn phòng (Rank 3) có quyền điều phối liên phòng
            if (currentUser.ActiveRoleCode == "ChanhVanPhong") return true;

            // Trưởng/Phó phòng chuyên môn: Chỉ điều chuyển trong nội bộ phòng ban mình
            var oldAssignee = await _context.Users.FirstOrDefaultAsync(u => u.Id == task.AssigneeId, cancellationToken);
            if (oldAssignee == null) return false;

            return currentUser.PrimaryDepartmentId != null
                && oldAssignee.PrimaryDepartmentId == currentUser.PrimaryDepartmentId
                && targetUser.PrimaryDepartmentId == currentUser.PrimaryDepartmentId;
        }

        public async Task<bool> CanUpdateTaskStatusAsync(Guid currentUserId, Guid taskId, TaskStatusEnum newStatus, CancellationToken cancellationToken = default)
        {
            if (currentUserId == Guid.Empty || taskId == Guid.Empty) return false;

            var task = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
            if (task == null) return false;

            var currentUser = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken);

            if (currentUser == null) return false;

            int currentUserRank = currentUser.UserRoles.Where(ur => !ur.IsDeleted).Min(ur => (int?)ur.Role.RankLevel) ?? 5;

            // Duyệt Hoàn thành (Completed)
            if (newStatus == TaskStatusEnum.Completed)
            {
                // Chuyên viên không được tự duyệt Hoàn thành cho chính mình
                if (task.AssigneeId == currentUserId && currentUserRank >= 5)
                {
                    return false;
                }

                // Assigner hoặc cấp trên có Rank nhỏ hơn
                return task.AssignerId == currentUserId || currentUserRank <= 3;
            }

            // Chuyển sang làm (InProgress) hoặc Trình duyệt (InReview / PendingUBMTTQReview)
            if (newStatus == TaskStatusEnum.InProgress || newStatus == TaskStatusEnum.InReview || newStatus == TaskStatusEnum.PendingUBMTTQReview)
            {
                return task.AssigneeId == currentUserId || task.AssignerId == currentUserId || currentUserRank <= 2;
            }

            // Từ chối / Huỷ (Cancelled)
            if (newStatus == TaskStatusEnum.Cancelled)
            {
                return task.AssignerId == currentUserId || currentUserRank <= 3;
            }

            return true;
        }

        public async Task<bool> CanScoreTaskAsync(Guid evaluatorId, Guid taskId, CancellationToken cancellationToken = default)
        {
            if (evaluatorId == Guid.Empty || taskId == Guid.Empty) return false;

            var task = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
            if (task == null) return false;

            // Không tự chấm điểm cho chính mình
            if (task.AssigneeId == evaluatorId) return false;

            var evaluator = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == evaluatorId, cancellationToken);

            var assignee = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == task.AssigneeId, cancellationToken);

            if (evaluator == null || assignee == null) return false;

            int evaluatorRank = evaluator.UserRoles.Where(ur => !ur.IsDeleted).Min(ur => (int?)ur.Role.RankLevel) ?? 5;
            int assigneeRank = assignee.UserRoles.Where(ur => !ur.IsDeleted).Min(ur => (int?)ur.Role.RankLevel) ?? 5;

            // Người chấm phải có cấp bậc cao hơn (RankLevel nhỏ hơn)
            if (evaluatorRank >= assigneeRank) return false;

            // Lãnh đạo UBND (Rank 1, 2) có quyền chấm điểm toàn cơ quan
            if (evaluatorRank <= 2) return true;

            // Chánh Văn phòng (Rank 3)
            if (evaluator.ActiveRoleCode == "ChanhVanPhong") return true;

            // Trưởng phòng chuyên môn (Rank 3): Chỉ chấm cho cán bộ thuộc phòng mình
            return evaluator.PrimaryDepartmentId != null && assignee.PrimaryDepartmentId == evaluator.PrimaryDepartmentId;
        }
    }
}
