using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Comments.Commands.CreateComment
{
    public class CreateTaskCommentCommand : IRequest<CreateTaskCommentResult>
    {
        public Guid TaskId { get; set; }
        public Guid UserId { get; set; }
        public Guid RequestId { get; set; }
        public string Content { get; set; } = string.Empty;
    }

    public class CreateTaskCommentResult
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public Guid? CommentId { get; set; }
        public List<string> MentionedUsers { get; set; } = new();
    }

    public class CreateTaskCommentCommandHandler : IRequestHandler<CreateTaskCommentCommand, CreateTaskCommentResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITaskAuthorizationService _authorizationService;
        private readonly INotificationDispatcher? _notificationDispatcher;
        private static readonly Regex MentionRegex = new(@"@(\S+)", RegexOptions.Compiled);

        public CreateTaskCommentCommandHandler(
            IApplicationDbContext context,
            ITaskAuthorizationService authorizationService,
            INotificationDispatcher? notificationDispatcher = null)
        {
            _context = context;
            _authorizationService = authorizationService;
            _notificationDispatcher = notificationDispatcher;
        }

        public async Task<CreateTaskCommentResult> Handle(CreateTaskCommentCommand request, CancellationToken cancellationToken)
        {
            var task = await _context.TaskItems
                .FirstOrDefaultAsync(t => t.Id == request.TaskId && !t.IsDeleted, cancellationToken);

            if (task == null)
                return new CreateTaskCommentResult { Success = false, Message = "Không tìm thấy công việc." };

            if (!await _authorizationService.CanAccessTaskAsync(request.UserId, request.TaskId, cancellationToken))
                return new CreateTaskCommentResult { Success = false, Message = "Bạn không có quyền bình luận trong công việc này." };

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.UserId && !u.IsDeleted, cancellationToken);

            if (user == null)
                return new CreateTaskCommentResult { Success = false, Message = "Người dùng không hợp lệ." };

            var ops = new Quanlycongviec.Application.Common.Services.WorkflowOperations(_context, _notificationDispatcher);
            var fingerprint = Quanlycongviec.Application.Common.Services.WorkflowOperations.Fingerprint("CreateTaskComment", request);
            var replay = await ops.ReplayAsync(request.UserId, request.RequestId, fingerprint, cancellationToken);
            if (replay.HasValue) return new CreateTaskCommentResult { Success = true, CommentId = replay.Value, Message = "Đã thêm bình luận." };
            if (string.IsNullOrWhiteSpace(request.Content)) throw new ArgumentException("Vui lòng nhập nội dung trao đổi.");

            // 1. Tạo comment
            var comment = new TaskComment
            {
                TaskItemId = request.TaskId,
                UserId = request.UserId,
                Content = request.Content
            };
            _context.TaskComments.Add(comment);

            // 2. Parse @mention
            var mentions = MentionRegex.Matches(request.Content);
            var mentionedUsernames = mentions.Select(m => m.Groups[1].Value).Distinct().ToList();
            var mentionedUsers = new List<string>();
            var notificationsToSend = new List<Notification>();

            if (mentionedUsernames.Count > 0)
            {
                // Tìm users match username
                var allUsers = await _context.Users
                    .Where(u => !u.IsDeleted)
                    .ToListAsync(cancellationToken);
                var permitted = new List<User>();
                foreach (var candidate in allUsers)
                    if (await _authorizationService.CanAccessTaskAsync(candidate.Id, task.Id, cancellationToken)) permitted.Add(candidate);
                allUsers = permitted;

                foreach (var mention in mentionedUsernames)
                {
                    // Match @all → thông báo toàn bộ
                    if (mention.Equals("all", StringComparison.OrdinalIgnoreCase))
                    {
                        foreach (var u in allUsers.Where(u => u.Id != request.UserId))
                        {
                            notificationsToSend.Add(new Notification
                            {
                                Id = Guid.NewGuid(),
                                UserId = u.Id,
                                TaskItemId = request.TaskId,
                                Type = NotificationType.Comment,
                                Channel = NotificationChannel.InApp,
                                Title = $"Bình luận mới trong \"{task.Title}\"",
                                Message = $"{user.FullName} đã nhắc @all: {Truncate(request.Content, 100)}",
                                SentAt = DateTime.UtcNow,
                            });
                            mentionedUsers.Add(u.FullName);
                        }
                        break; // @all đã cover hết, không cần xử lý mention riêng
                    }

                    // Match by username or fullname
                    var matchedUser = allUsers.FirstOrDefault(u =>
                        u.Username.Equals(mention, StringComparison.OrdinalIgnoreCase) ||
                        u.FullName.Replace(" ", "").Equals(mention, StringComparison.OrdinalIgnoreCase));

                    if (matchedUser != null && matchedUser.Id != request.UserId)
                    {
                        notificationsToSend.Add(new Notification
                        {
                            Id = Guid.NewGuid(),
                            UserId = matchedUser.Id,
                            TaskItemId = request.TaskId,
                            Type = NotificationType.Comment,
                            Channel = NotificationChannel.InApp,
                            Title = $"Bạn được nhắc đến trong \"{task.Title}\"",
                            Message = $"{user.FullName} đã @mention bạn: {Truncate(request.Content, 100)}",
                            SentAt = DateTime.UtcNow,
                        });
                        mentionedUsers.Add(matchedUser.FullName);
                    }
                }
            }

            // 3. Ghi Activity Log
            _context.ActivityLogs.Add(new ActivityLog
            {
                UserId = request.UserId,
                ActionType = "comment_added",
                TargetEntityType = "TaskItem",
                TargetEntityId = request.TaskId.ToString(),
                Summary = $"{user.FullName} bình luận trong \"{task.Title}\""
                    + (mentionedUsers.Count > 0 ? $" (nhắc: {string.Join(", ", mentionedUsers)})" : "")
            });

            notificationsToSend = notificationsToSend.DistinctBy(n => n.UserId).ToList();
            foreach (var notification in notificationsToSend) notification.RequiresRealtimeDelivery = true;
            _context.Notifications.AddRange(notificationsToSend);
            await ops.CommitAsync(request.UserId, request.RequestId, fingerprint, comment.Id, cancellationToken);
            await ops.PublishAsync(notificationsToSend, cancellationToken);

            return new CreateTaskCommentResult
            {
                Success = true,
                Message = "Đã thêm bình luận.",
                CommentId = comment.Id,
                MentionedUsers = mentionedUsers
            };
        }

        private static string Truncate(string text, int maxLen)
            => text.Length > maxLen ? text[..maxLen] + "..." : text;
    }
}
