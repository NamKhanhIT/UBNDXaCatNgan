using System.Threading.Tasks;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IZaloNotificationService
    {
        Task SendZnsAsync(string phoneNumber, string templateId, object templateData);
    }
}
