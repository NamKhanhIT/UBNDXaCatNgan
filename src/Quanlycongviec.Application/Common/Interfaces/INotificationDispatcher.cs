using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface INotificationDispatcher
    {
        Task DispatchAsync(Notification notification, CancellationToken cancellationToken = default);
        Task DispatchBatchAsync(IEnumerable<Notification> notifications, CancellationToken cancellationToken = default);
    }
}
