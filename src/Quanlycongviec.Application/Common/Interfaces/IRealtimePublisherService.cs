using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Quanlycongviec.Application.Common.Interfaces
{
    /// <summary>
    /// Giao diện dịch vụ phát sự kiện Realtime SignalR tập trung cho toàn hệ thống
    /// </summary>
    public interface IRealtimePublisherService
    {
        /// <summary>
        /// Phát sự kiện tới một người dùng cụ thể
        /// </summary>
        Task PublishToUserAsync<T>(Guid userId, string eventName, T data, CancellationToken cancellationToken = default);

        /// <summary>
        /// Phát sự kiện tới danh sách người dùng cụ thể
        /// </summary>
        Task PublishToUsersAsync<T>(IEnumerable<Guid> userIds, string eventName, T data, CancellationToken cancellationToken = default);

        /// <summary>
        /// Phát sự kiện tới một nhóm (Vai trò hoặc Phòng ban)
        /// </summary>
        Task PublishToGroupAsync<T>(string groupName, string eventName, T data, CancellationToken cancellationToken = default);

        /// <summary>
        /// Phát sự kiện tới toàn bộ cán bộ công chức đang trực tuyến
        /// </summary>
        Task BroadcastAsync<T>(string eventName, T data, CancellationToken cancellationToken = default);
    }
}
