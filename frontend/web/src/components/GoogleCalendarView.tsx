'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CalendarEventDto, EventTypeEnum, createCalendarEventApi, deleteCalendarEventApi, getCalendarEventsApi, updateCalendarEventApi } from '../services/calendar-event.service';
import { UserDto } from '../services/task.service';

interface TaskCalendarItem {
  id: string;
  title: string;
  startDate?: string;
  dueDate?: string;
  status: string;
  priority: string;
  assigneeName?: string;
  assignerName?: string;
  departmentName?: string;
  category?: string;
  isTask: true;
}

interface EventCalendarItem extends CalendarEventDto {
  isTask: false;
}

type UnifiedCalendarItem = TaskCalendarItem | EventCalendarItem;

interface GoogleCalendarViewProps {
  tasks: any[];
  users: UserDto[];
  onOpenCreateTaskModal: () => void;
  onOpenTaskDetailModal: (taskId: string) => void;
  addToast: (title: string, message: string, type?: 'success' | 'danger' | 'info' | 'warning') => void;
}

export function GoogleCalendarView({
  tasks,
  users,
  onOpenCreateTaskModal,
  onOpenTaskDetailModal,
  addToast,
}: GoogleCalendarViewProps) {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Sidebar My Calendars Filters
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

  // Server Events State
  const [eventsList, setEventsList] = useState<CalendarEventDto[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Modals
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDto | null>(null);

  // Day Overflow Popover State
  const [overflowDayDate, setOverflowDayDate] = useState<Date | null>(null);
  const [overflowItems, setOverflowItems] = useState<UnifiedCalendarItem[]>([]);

  // Create Event Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<EventTypeEnum>('Meeting');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndTime, setFormEndTime] = useState('11:00');
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formLocation, setFormLocation] = useState('');
  const [formParticipants, setFormParticipants] = useState<string[]>([]);
  const [formReminders, setFormReminders] = useState<number[]>([30]);

  // Fetch Events from API based on current view date range
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'month') {
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay()); // Go to start of week
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setDate(end.getDate() + (6 - end.getDay())); // Go to end of week
    } else if (viewMode === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Mon start
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { from: start.toISOString(), to: end.toISOString() };
  }, [currentDate, viewMode]);

  const fetchEvents = async () => {
    setEventsLoading(true);
    const res = await getCalendarEventsApi({
      from: dateRange.from,
      to: dateRange.to,
    });
    if (res.success && res.data) {
      setEventsList(res.data);
    }
    setEventsLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [dateRange]);

  // Unified items list mapping Tasks & Events
  const unifiedItems = useMemo<UnifiedCalendarItem[]>(() => {
    const list: UnifiedCalendarItem[] = [];

    if (showTasks && tasks) {
      tasks.forEach((t) => {
        list.push({
          id: t.id,
          title: t.title,
          startDate: t.startDate || t.dueDate || new Date().toISOString().split('T')[0],
          dueDate: t.dueDate || t.startDate || new Date().toISOString().split('T')[0],
          status: t.status,
          priority: t.priority,
          assigneeName: t.assignee,
          assignerName: t.assignedBy,
          departmentName: t.departmentName,
          category: t.category,
          isTask: true,
        });
      });
    }

    if (showEvents && eventsList) {
      eventsList.forEach((e) => {
        list.push({
          ...e,
          isTask: false,
        });
      });
    }

    return list;
  }, [tasks, eventsList, showTasks, showEvents]);

  // Date Navigation Helpers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
    else if (viewMode === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
    else if (viewMode === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Helper for Event Types Badge
  const getEventBadge = (type: EventTypeEnum) => {
    switch (type) {
      case 'Meeting': return { label: 'Cuộc họp', bg: '#dbeafe', color: '#1d4ed8' };
      case 'Conference': return { label: 'Đại hội / Hội nghị', bg: '#fef3c7', color: '#b45309' };
      case 'Training': return { label: 'Tập huấn', bg: '#dcfce7', color: '#15803d' };
      case 'FieldTrip': return { label: 'Công tác', bg: '#f3e8ff', color: '#6b21a8' };
      default: return { label: 'Sự kiện khác', bg: '#f1f5f9', color: '#475569' };
    }
  };

  // Render Month View Days Grid
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Calculate Monday start grid
    const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
    const daysInMonth = lastDayOfMonth.getDate();

    const calendarDays: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      calendarDays.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding days
    const totalCells = Math.ceil(calendarDays.length / 7) * 7;
    const nextPadding = totalCells - calendarDays.length;
    for (let i = 1; i <= nextPadding; i++) {
      calendarDays.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        {/* Day Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.82rem', color: '#475569', textAlign: 'center' }}>
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, idx) => (
            <div key={idx} style={{ padding: '10px 4px' }}>{d}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(110px, auto)' }}>
          {calendarDays.map((cell, idx) => {
            const cellDateStr = cell.date.toISOString().split('T')[0];
            const isToday = cellDateStr === todayStr;

            // Filter items falling on cellDate
            const cellItems = unifiedItems.filter((item) => {
              if (item.isTask) {
                const s = item.startDate ? item.startDate.split('T')[0] : item.dueDate ? item.dueDate.split('T')[0] : '';
                const e = item.dueDate ? item.dueDate.split('T')[0] : item.startDate ? item.startDate.split('T')[0] : '';
                return cellDateStr >= s && cellDateStr <= e;
              } else {
                const s = item.startDateTime.split('T')[0];
                const e = item.endDateTime.split('T')[0];
                return cellDateStr >= s && cellDateStr <= e;
              }
            });

            const visibleItems = cellItems.slice(0, 3);
            const overflowCount = cellItems.length - 3;

            return (
              <div
                key={idx}
                style={{
                  borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #f1f5f9',
                  borderBottom: '1px solid #f1f5f9',
                  padding: 6,
                  background: cell.isCurrentMonth ? '#ffffff' : '#fafafa',
                  minHeight: 110,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: isToday ? 800 : cell.isCurrentMonth ? 600 : 400,
                      color: isToday ? '#ffffff' : cell.isCurrentMonth ? '#1e293b' : '#94a3b8',
                      background: isToday ? '#2563eb' : 'transparent',
                      borderRadius: isToday ? '50%' : 'none',
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {cell.date.getDate()}
                  </span>
                </div>

                {/* Items List inside Day cell */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                  {visibleItems.map((item) => {
                    if (item.isTask) {
                      return (
                        <div
                          key={`task_${item.id}`}
                          onClick={() => onOpenTaskDetailModal(item.id)}
                          style={{
                            background: item.priority === 'Khan' ? '#fef2f2' : item.priority === 'Cao' ? '#fff7ed' : '#eff6ff',
                            borderLeft: `3px solid ${item.priority === 'Khan' ? '#dc2626' : item.priority === 'Cao' ? '#ea580c' : '#2563eb'}`,
                            padding: '2px 5px',
                            borderRadius: 3,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#1e293b',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}
                          title={`[Công việc] ${item.title}`}
                        >
                          📌 {item.title}
                        </div>
                      );
                    } else {
                      const badge = getEventBadge(item.eventType);
                      return (
                        <div
                          key={`event_${item.id}`}
                          onClick={() => {
                            setSelectedEvent(item);
                            setShowEventDetailModal(true);
                          }}
                          style={{
                            background: badge.bg,
                            borderLeft: `3px solid ${badge.color}`,
                            padding: '2px 5px',
                            borderRadius: 3,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: badge.color,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}
                          title={`[${badge.label}] ${item.title}`}
                        >
                          📅 {item.title}
                        </div>
                      );
                    }
                  })}

                  {overflowCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOverflowDayDate(cell.date);
                        setOverflowItems(cellItems);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: 0,
                        marginTop: 2,
                      }}
                    >
                      +{overflowCount} mục khác...
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, width: '100%' }}>
      {/* ── Sidebar My Calendars ── */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Nút + Tạo mới */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            style={{ width: '100%', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px' }}
          >
            <i className="fa-solid fa-plus" /> + Tạo Mới Lịch
          </button>

          {showCreateMenu && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowCreateMenu(false);
                  onOpenCreateTaskModal();
                }}
                style={{ width: '100%', textAlign: 'left', borderRadius: 0, fontSize: '0.85rem', fontWeight: 600, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <i className="fa-solid fa-list-check" style={{ color: '#2563eb' }} /> Công việc mới (Task)
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowCreateMenu(false);
                  setShowCreateEventModal(true);
                }}
                style={{ width: '100%', textAlign: 'left', borderRadius: 0, fontSize: '0.85rem', fontWeight: 600, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f1f5f9' }}
              >
                <i className="fa-solid fa-calendar-day" style={{ color: '#d97706' }} /> Sự kiện mới (Meeting/Họp)
              </button>
            </div>
          )}
        </div>

        {/* My Calendars Filter Card */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-sliders" style={{ color: '#64748b' }} /> Lịch của tôi (My Calendars)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} />
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#2563eb', display: 'inline-block' }} />
              <span>Công việc được giao</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} />
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#d97706', display: 'inline-block' }} />
              <span>Cuộc họp & Sự kiện</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Main Google Calendar Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Top Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: '#fff', padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleToday} style={{ fontWeight: 700 }}>
              Hôm nay
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handlePrev}>
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleNext}>
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              {currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          {/* View Switcher */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 6 }}>
            <button
              type="button"
              className={`btn btn-xs ${viewMode === 'month' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('month')}
              style={{ fontWeight: 700 }}
            >
              Tháng
            </button>

          </div>
        </div>

        {/* Calendar Content Render */}
        {renderMonthView()}
      </div>

      {/* ── Create Event Modal ── */}
      {showCreateEventModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-calendar-plus" style={{ color: '#2563eb' }} /> Tạo Sự Kiện / Cuộc Họp Mới
              </h3>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowCreateEventModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Tiêu đề sự kiện <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: Họp Chi bộ mở rộng tháng 8, Đại hội..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{ fontSize: '0.9rem', fontWeight: 600 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Loại sự kiện</label>
                  <select
                    className="form-select"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as EventTypeEnum)}
                  >
                    <option value="Meeting">Cuộc họp</option>
                    <option value="Conference">Hội nghị / Đại hội</option>
                    <option value="Training">Tập huấn / Bồi dưỡng</option>
                    <option value="FieldTrip">Đi công tác / Khảo sát</option>
                    <option value="Other">Sự kiện khác</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Địa điểm</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="VD: Hội trường UBND Xã, Phòng họp số 2"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Bắt đầu</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" className="form-control" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                    {!formIsAllDay && <input type="time" className="form-control" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Kết thúc</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" className="form-control" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
                    {!formIsAllDay && <input type="time" className="form-control" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />}
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Mô tả chi tiết</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Nội dung chương trình sự kiện..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCreateEventModal(false)}>Hủy</button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  if (!formTitle.trim()) {
                    addToast('Thiếu thông tin', 'Vui lòng nhập tiêu đề sự kiện!', 'warning');
                    return;
                  }

                  const startIso = new Date(`${formStartDate}T${formIsAllDay ? '00:00:00' : formStartTime}:00`).toISOString();
                  const endIso = new Date(`${formEndDate}T${formIsAllDay ? '23:59:59' : formEndTime}:00`).toISOString();

                  const res = await createCalendarEventApi({
                    title: formTitle.trim(),
                    description: formDesc,
                    eventType: formType,
                    startDateTime: startIso,
                    endDateTime: endIso,
                    isAllDay: formIsAllDay,
                    location: formLocation,
                    participantUserIds: formParticipants,
                    reminderOffsetsMinutes: formReminders,
                  });

                  if (res.success) {
                    addToast('Thành công', 'Đã khởi tạo sự kiện mới!', 'success');
                    setShowCreateEventModal(false);
                    fetchEvents();
                  } else {
                    addToast('Lỗi', res.error || 'Không thể tạo sự kiện.', 'danger');
                  }
                }}
              >
                <i className="fa-solid fa-floppy-disk" /> Lưu Sự Kiện
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Detail Modal ── */}
      {showEventDetailModal && selectedEvent && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
              <span className="badge" style={{ background: getEventBadge(selectedEvent.eventType).bg, color: getEventBadge(selectedEvent.eventType).color, fontWeight: 700 }}>
                {selectedEvent.eventTypeName}
              </span>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowEventDetailModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a' }}>
              📅 {selectedEvent.title}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem', color: '#475569' }}>
              <div><strong>Thời gian:</strong> {new Date(selectedEvent.startDateTime).toLocaleString('vi-VN')} — {new Date(selectedEvent.endDateTime).toLocaleString('vi-VN')}</div>
              <div><strong>Địa điểm:</strong> {selectedEvent.location || 'UBND Xã Cát Ngạn'}</div>
              <div><strong>Người chủ trì:</strong> {selectedEvent.organizerName || 'Ban tổ chức'}</div>
              {selectedEvent.description && (
                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, marginTop: 4 }}>
                  <strong>Nội dung:</strong> {selectedEvent.description}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: '#dc2626' }}
                onClick={async () => {
                  if (confirm(`Bạn có chắc chắn muốn xóa sự kiện: "${selectedEvent.title}"?`)) {
                    const res = await deleteCalendarEventApi(selectedEvent.id);
                    if (res.success) {
                      addToast('Đã xóa', 'Sự kiện đã được xóa thành công.', 'success');
                      setShowEventDetailModal(false);
                      fetchEvents();
                    }
                  }
                }}
              >
                <i className="fa-solid fa-trash" /> Xóa sự kiện
              </button>

              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowEventDetailModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
