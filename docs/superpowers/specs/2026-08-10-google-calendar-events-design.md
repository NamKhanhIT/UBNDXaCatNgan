# Design Spec: Google Calendar View, CalendarEvents & Task Date Range

## 1. Bối Cảnh & Mục Tiêu

Hệ thống quản lý công việc xã Cát Ngạn hiện tại:
- `TaskItem` chỉ có `DueDate` (1 mốc duy nhất), chưa có `StartDate`.
- Tab Lịch (`week`) còn theo dạng ca cố định Sáng/Chiều, chưa có View Tháng/Tuần/Ngày dạng Google Calendar linh hoạt.
- Chưa hỗ trợ **Sự kiện (`CalendarEvent`)** độc lập (họp chi bộ, đại hội, hội nghị, tập huấn, đi công tác...) mà không gán nghĩa vụ giao việc cho 1 cá nhân cụ thể.

Mục tiêu nâng cấp:
1. Mở rộng `TaskItem` có `StartDate` (khoảng ngày từ `StartDate` đến `DueDate`).
2. Xây dựng Entity `CalendarEvent`, `EventParticipant`, `EventReminderOffset`.
3. Mở rộng `TaskReminderBackgroundService` quét nhắc sự kiện tự động theo các mốc `MinutesBefore` qua SignalR & Notification.
4. Xây dựng bộ UI **Google Calendar (Tháng / Tuần / Ngày)** trên frontend, hỗ trợ dải sự kiện kéo dài nhiều ngày (multi-day bar spanning), nút "+ Tạo mới" chọn Công việc / Sự kiện, bộ lọc "My Calendars", và xem chi tiết đầy đủ.

---

## 2. Kiến Trúc & Luồng Dữ Liệu (Architecture & Data Flow)

```mermaid
flowchart TD
    subgraph Frontend [React / Next.js Google Calendar]
        A[View Switcher: Tháng | Tuần | Ngày] --> B[Fetch parallel GET /Tasks?from=&to= & GET /CalendarEvents?from=&to=]
        B --> C[Gộp & Phân loại dữ liệu Lịch]
        C --> D[Hiển thị dải nhiều ngày CSS Grid & Khối theo giờ]
        D --> E[Click Item]
        E -->|TaskItem| F[Task Detail Drawer với 'Từ StartDate đến DueDate']
        E -->|CalendarEvent| G[Event Detail Modal]
        H[Nút + Tạo] -->|Sự kiện mới| I[Create Event Modal]
    end

    subgraph Backend [.NET 8 Web API]
        J[CalendarEventsController] --> K[ApplicationDbContext]
        L[TasksController] --> K
        K --> M[(PostgreSQL Database)]
        N[TaskReminderBackgroundService] -->|Periodic Check| K
        N -->|SignalR Push| O[NotificationHub]
    end
```

---

## 3. Chi Tiết Backend (C# .NET 8)

### 3.1 Domain Entities

1. **`TaskItem.cs`**:
   - Thêm `public DateTime? StartDate { get; set; }`

2. **`CalendarEvent.cs`** (BaseEntity):
   - `Title`, `Description` (string)
   - `EventType` (enum: `Meeting`, `Conference`, `Training`, `FieldTrip`, `Other`)
   - `StartDateTime`, `EndDateTime` (DateTime, Utc)
   - `IsAllDay` (bool)
   - `Location` (string?)
   - `OrganizerId` (Guid, User)
   - `DepartmentId` (Guid?, Department)
   - `ColorTag` (string?)
   - `RelatedTaskItemId` (Guid?, TaskItem)
   - Navigation: `Participants` (ICollection<EventParticipant>), `ReminderOffsets` (ICollection<EventReminderOffset>)

3. **`EventParticipant.cs`** (BaseEntity):
   - `EventId` (Guid), `UserId` (Guid)
   - `HasResponded` (bool), `ResponseStatus` (enum: `Pending`, `Accepted`, `Declined`)

4. **`EventReminderOffset.cs`** (BaseEntity):
   - `EventId` (Guid), `MinutesBefore` (int) - Default: 30 minutes

5. **`Notification.cs` & `ReminderLog.cs`**:
   - Thêm `CalendarEventId` (Guid?) vào `Notification` và `ReminderLog`.
   - Thêm `NotificationType.EventReminder` vào enum `NotificationType`.

### 3.2 Background Service

- In `TaskReminderBackgroundService.cs`:
  - Query `CalendarEvents` where `StartDateTime >= nowUtc.AddDays(-1)` and `IsDeleted == false`.
  - For each event and each `ReminderOffset` (e.g. 30m before):
    - Calculate `reminderTime = event.StartDateTime.AddMinutes(-offset.MinutesBefore)`.
    - If `nowUtc >= reminderTime` and no `ReminderLog` exists for `(CalendarEventId, ReminderType)`:
      - Create `Notification` for `OrganizerId` and all `EventParticipants`.
      - Save `ReminderLog`.
      - Push real-time notification via SignalR `NotificationHub`.

### 3.3 API Endpoints

- `GET /api/v1/CalendarEvents?from={from}&to={to}`
  - Returns events intersecting interval: `StartDateTime <= to && EndDateTime >= from`.
- `POST /api/v1/CalendarEvents`: Create event with participants & reminder offsets.
- `PUT /api/v1/CalendarEvents/{id}`: Update event (Organizer or Leader).
- `DELETE /api/v1/CalendarEvents/{id}`: Soft delete (`IsDeleted = true`).
- Update `GET /api/v1/Tasks?from={from}&to={to}`: Return tasks intersecting `[StartDate ?? DueDate, DueDate ?? StartDate]`.

---

## 4. Chi Tiết Frontend (Next.js / TypeScript)

1. **Google Calendar Navigation**:
   - Month / Week / Day view toggle.
   - Prev / Next / Today buttons.
2. **View Tháng (Month View)**:
   - 7x5 or 7x6 month grid.
   - Multi-day spanning bars using calculated grid column start and span.
   - Max 3 items visible per day cell; `+N khác` popover/drawer for overflow items.
3. **View Tuần (Week View)**:
   - Header with day dates.
   - Top all-day / multi-day row.
   - 06:00 - 19:00 hourly grid (scrollable to 24h).
4. **View Ngày (Day View)**:
   - Detailed single day layout with time slots and shift badges (Sáng/Chiều).
5. **My Calendars Sidebar Filter**:
   - Filter by Task vs Event, Department color tags.
6. **Modals & Drawers**:
   - "+ Tạo" dropdown -> "Sự kiện mới" (opens Create Event Modal).
   - Event Detail Modal with edit/delete controls for organizers.

---

## 5. Kế Hoạch Kiểm Thử (Verification Plan)

1. **Automated Tests**:
   - Unit tests for `CalendarEvent` date range intersection query (`from` / `to`).
   - Unit tests for `EventReminderBackgroundService` no-duplicate notification log logic.
2. **Manual Tests**:
   - Create 3-day event ("Đại hội chi bộ") -> verify multi-day bar spanning in Month view.
   - Create >5 events in 1 day -> verify `+N khác` popover.
   - Verify real-time SignalR notifications for event participants.
   - Verify existing tasks display properly with `StartDate` fallback.
