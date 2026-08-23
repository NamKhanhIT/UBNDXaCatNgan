using System;

namespace Quanlycongviec.Application.Common.Models
{
    /// <summary>
    /// Vỏ bọc chuẩn hóa cho tất cả các sự kiện Realtime SignalR trong hệ thống UBND Cấp Xã.
    /// Giúp chống nhận trùng lặp sự kiện (Deduplication) và định danh thời gian chính xác.
    /// </summary>
    /// <typeparam name="T">Kiểu dữ liệu nghiệp vụ của sự kiện</typeparam>
    public class RealtimeEventEnvelope<T>
    {
        /// <summary>
        /// Mã định danh duy nhất của sự kiện (UUID v4)
        /// </summary>
        public string EventId { get; set; } = Guid.NewGuid().ToString("N");

        /// <summary>
        /// Tên sự kiện nghiệp vụ chuẩn
        /// </summary>
        public string EventType { get; set; } = string.Empty;

        /// <summary>
        /// Thời điểm phát sinh sự kiện (UTC)
        /// </summary>
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Dữ liệu chi tiết của sự kiện
        /// </summary>
        public T Data { get; set; } = default!;

        public static RealtimeEventEnvelope<T> Create(string eventType, T data)
        {
            return new RealtimeEventEnvelope<T>
            {
                EventId = Guid.NewGuid().ToString("N"),
                EventType = eventType,
                Timestamp = DateTime.UtcNow,
                Data = data
            };
        }
    }
}
