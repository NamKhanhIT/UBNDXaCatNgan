'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarEventDto,
  EventTypeEnum,
  createCalendarEventApi,
  updateCalendarEventApi,
  deleteCalendarEventApi,
  getCalendarEventsApi,
} from '../services/calendar-event.service';
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

const REMINDER_OPTIONS = [
  { label: '10 phút trước', value: 10 },
  { label: '30 phút trước', value: 30 },
  { label: '1 giờ trước', value: 60 },
  { label: '1 ngày trước', value: 1440 },
  { label: '3 ngày trước', value: 4320 },
];

export function GoogleCalendarView({
  tasks,
  users,
  onOpenCreateTaskModal,
  onOpenTaskDetailModal,
  addToast,
}: GoogleCalendarViewProps) {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Screen size detection (Mobile vs Desktop)
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sidebar / Filter States
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Server Events State
  const [eventsList, setEventsList] = useState<CalendarEventDto[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Modals & Drawers
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDto | null>(null);

  // Day Detail Drawer
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayItems, setSelectedDayItems] = useState<UnifiedCalendarItem[]>([]);

  // Create/Edit Event Form State
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
  const [participantSearch, setParticipantSearch] = useState('');

  // Touch Swipe Gesture Handling
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > 1.4 * Math.abs(deltaY)) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  // Date Range Calculation for API queries
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'month') {
      start.setDate(1);
      start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setDate(end.getDate() + (end.getDay() === 0 ? 0 : 7 - end.getDay()));
    } else if (viewMode === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
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

  // Unified items mapping Tasks & Events
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

  // Date Navigation
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

  // Helper for Event Type styling & colors (Crisp government styling with standard FontAwesome icons)
  const getEventBadge = (type: EventTypeEnum) => {
    switch (type) {
      case 'Meeting':
        return { label: 'Cuộc họp', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#2563eb', icon: 'fa-users' };
      case 'Conference':
        return { label: 'Đại hội / Hội nghị', bg: '#fffbeb', color: '#b45309', border: '#fde68a', dot: '#d97706', icon: 'fa-landmark' };
      case 'Training':
        return { label: 'Tập huấn', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#16a34a', icon: 'fa-graduation-cap' };
      case 'FieldTrip':
        return { label: 'Công tác / Khảo sát', bg: '#faf5ff', color: '#6b21a8', border: '#e9d5ff', dot: '#9333ea', icon: 'fa-car-side' };
      default:
        return { label: 'Sự kiện khác', bg: '#f8fafc', color: '#475569', border: '#e2e8f0', dot: '#64748b', icon: 'fa-calendar' };
    }
  };

  // Helper for Task color
  const getTaskColor = (priority: string) => {
    switch (priority) {
      case 'Khan':
      case 'Urgent':
        return { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5', dot: '#dc2626', label: 'Khẩn' };
      case 'Cao':
      case 'High':
        return { bg: '#fff7ed', color: '#c2410c', border: '#fdba74', dot: '#ea580c', label: 'Ưu tiên cao' };
      default:
        return { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', dot: '#0284c7', label: 'Thường' };
    }
  };

  // Open Day Detail Drawer
  const openDayDetail = (date: Date, items: UnifiedCalendarItem[]) => {
    setSelectedDayDate(date);
    setSelectedDayItems(items);
  };

  // Reset Create/Edit Event Form
  const resetEventForm = (prefillDate?: string, prefillTime?: string) => {
    const d = prefillDate || new Date().toISOString().split('T')[0];
    setEditingEventId(null);
    setFormTitle('');
    setFormDesc('');
    setFormType('Meeting');
    setFormStartDate(d);
    setFormStartTime(prefillTime || '08:00');
    setFormEndDate(d);
    setFormEndTime(prefillTime === '14:00' ? '16:30' : '11:00');
    setFormIsAllDay(false);
    setFormLocation('');
    setFormParticipants([]);
    setFormReminders([30]);
    setParticipantSearch('');
  };

  // Load Event for Editing
  const openEditEventModal = (event: CalendarEventDto) => {
    setEditingEventId(event.id);
    setFormTitle(event.title);
    setFormDesc(event.description || '');
    setFormType(event.eventType);
    const sDate = event.startDateTime ? event.startDateTime.split('T')[0] : new Date().toISOString().split('T')[0];
    const sTime = event.startDateTime && event.startDateTime.includes('T') ? event.startDateTime.split('T')[1].substring(0, 5) : '08:00';
    const eDate = event.endDateTime ? event.endDateTime.split('T')[0] : sDate;
    const eTime = event.endDateTime && event.endDateTime.includes('T') ? event.endDateTime.split('T')[1].substring(0, 5) : '11:00';
    setFormStartDate(sDate);
    setFormStartTime(sTime);
    setFormEndDate(eDate);
    setFormEndTime(eTime);
    setFormIsAllDay(event.isAllDay);
    setFormLocation(event.location || '');
    setFormParticipants(event.participants?.map((p) => p.userId) || []);
    setFormReminders(event.reminderOffsetsMinutes?.length ? event.reminderOffsetsMinutes : [30]);
    setParticipantSearch('');
    setShowEventDetailModal(false);
    setShowCreateEventModal(true);
  };

  // Filtered users for participant selection
  const filteredUsers = useMemo(() => {
    if (!users || !users.length) return [];
    if (!participantSearch.trim()) return users;
    const q = participantSearch.toLowerCase();
    return users.filter(
      (u: any) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q)) ||
        (u.departmentName && u.departmentName.toLowerCase().includes(q))
    );
  }, [users, participantSearch]);

  // Helper to test if item falls on a specific date
  const getItemsForDate = (dateStr: string) => {
    return unifiedItems.filter((item) => {
      if (item.isTask) {
        const s = item.startDate ? item.startDate.split('T')[0] : item.dueDate?.split('T')[0] || '';
        const e = item.dueDate ? item.dueDate.split('T')[0] : item.startDate?.split('T')[0] || '';
        return dateStr >= s && dateStr <= e;
      } else {
        const s = item.startDateTime.split('T')[0];
        const e = item.endDateTime.split('T')[0];
        return dateStr >= s && dateStr <= e;
      }
    });
  };

  // Helper to split ALL items (Events and Tasks) directly into Morning (Sáng) and Afternoon (Chiều)
  const categorizeDayItems = (items: UnifiedCalendarItem[]) => {
    const morning: UnifiedCalendarItem[] = [];
    const afternoon: UnifiedCalendarItem[] = [];

    items.forEach((item) => {
      if (item.isTask) {
        // Phân ca làm việc cho Nhiệm vụ/Công việc:
        const timeSource = item.startDate?.includes('T') ? item.startDate : item.dueDate?.includes('T') ? item.dueDate : null;
        if (timeSource) {
          const hour = new Date(timeSource).getHours();
          if (hour < 12) {
            morning.push(item);
          } else {
            afternoon.push(item);
          }
        } else {
          // Việc khẩn / ưu tiên cao được xếp ca sáng; việc khác phân bổ theo ID
          if (item.priority === 'Urgent' || item.priority === 'Khan' || item.priority === 'High' || item.priority === 'Cao') {
            morning.push(item);
          } else {
            const charCode = item.id.charCodeAt(item.id.length - 1) || 0;
            if (charCode % 2 === 0) {
              morning.push(item);
            } else {
              afternoon.push(item);
            }
          }
        }
      } else {
        // Cuộc họp / Sự kiện:
        if (item.isAllDay) {
          morning.push(item);
        } else {
          const hour = new Date(item.startDateTime).getHours();
          if (hour < 12) {
            morning.push(item);
          } else {
            afternoon.push(item);
          }
        }
      }
    });

    return { morning, afternoon };
  };

  // ─────────────────────────────────────────────────────────────
  // 1. RENDER MONTH VIEW (Ô Vuông Gọn Gàng, Lưới 7 Cột Cố Định)
  // ─────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
    const daysInMonth = lastDayOfMonth.getDate();

    const calendarDays: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      calendarDays.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding (total cells must be multiple of 7)
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
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Day of Week Headers - 7 Cột Đều Nhau Tuyệt Đối */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '0.82rem',
            color: '#334155',
          }}
        >
          {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((d, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px 4px',
                borderRight: idx === 6 ? 'none' : '1px solid #f1f5f9',
                color: idx >= 5 ? '#b45309' : '#334155',
              }}
            >
              {isMobile ? d.replace('Thứ ', 'T').replace('Chủ Nhật', 'CN') : d}
            </div>
          ))}
        </div>

        {/* Days Grid - Các Ô Vuông Cố Định (Strict Equal Columns) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            width: '100%',
          }}
        >
          {calendarDays.map((cell, idx) => {
            const cellDateStr = cell.date.toISOString().split('T')[0];
            const isToday = cellDateStr === todayStr;
            const isSelected = selectedDayDate && selectedDayDate.toISOString().split('T')[0] === cellDateStr;
            const cellItems = getItemsForDate(cellDateStr);

            // Maximum 2 items displayed per cell in month view to prevent height expansion
            const visibleItems = cellItems.slice(0, 2);
            const overflowCount = cellItems.length - 2;

            return (
              <div
                key={idx}
                onClick={() => openDayDetail(cell.date, cellItems)}
                style={{
                  borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #f1f5f9',
                  borderBottom: '1px solid #f1f5f9',
                  padding: isMobile ? '4px 2px' : '6px 8px',
                  background: isSelected
                    ? '#eff6ff'
                    : cell.isCurrentMonth
                    ? '#ffffff'
                    : '#fbfcfd',
                  minHeight: isMobile ? 65 : 115,
                  maxHeight: isMobile ? 80 : 125,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = cell.isCurrentMonth ? '#ffffff' : '#fbfcfd';
                }}
              >
                {/* Date Number Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: isToday ? 800 : cell.isCurrentMonth ? 700 : 400,
                      color: isToday ? '#ffffff' : cell.isCurrentMonth ? '#0f172a' : '#cbd5e1',
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

                  {cellItems.length > 0 && !isMobile && (
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                      {cellItems.length} mục
                    </span>
                  )}
                </div>

                {/* Mobile: Colored Dots indicator */}
                {isMobile ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      flexWrap: 'wrap',
                      marginTop: 'auto',
                    }}
                  >
                    {cellItems.slice(0, 3).map((item, dIdx) => {
                      const dotColor = item.isTask ? getTaskColor(item.priority).dot : getEventBadge(item.eventType).dot;
                      return (
                        <span
                          key={dIdx}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: dotColor,
                            display: 'inline-block',
                          }}
                        />
                      );
                    })}
                    {cellItems.length > 3 && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b' }}>
                        +{cellItems.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  /* Desktop: Compact 1-line item chips with strict ellipsis (no blowout) */
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      overflow: 'hidden',
                      width: '100%',
                    }}
                  >
                    {visibleItems.map((item) => {
                      if (item.isTask) {
                        const tColor = getTaskColor(item.priority);
                        return (
                          <div
                            key={`task_${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTaskDetailModal(item.id);
                            }}
                            style={{
                              background: tColor.bg,
                              borderLeft: `3px solid ${tColor.border}`,
                              padding: '2px 5px',
                              borderRadius: 4,
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: tColor.color,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              width: '100%',
                              cursor: 'pointer',
                            }}
                            title={`[Công việc] ${item.title} (${item.assigneeName || 'Chuyên viên'})`}
                          >
                            <i className="fa-solid fa-thumbtack" style={{ marginRight: 4, fontSize: '0.65rem' }} />
                            {item.title}
                          </div>
                        );
                      } else {
                        const badge = getEventBadge(item.eventType);
                        return (
                          <div
                            key={`event_${item.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(item);
                              setShowEventDetailModal(true);
                            }}
                            style={{
                              background: badge.bg,
                              borderLeft: `3px solid ${badge.border}`,
                              padding: '2px 5px',
                              borderRadius: 4,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: badge.color,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              width: '100%',
                              cursor: 'pointer',
                            }}
                            title={`[${badge.label}] ${item.title} (${item.location || 'UBND Xã'})`}
                          >
                            <i className={`fa-solid ${badge.icon}`} style={{ marginRight: 4, fontSize: '0.68rem' }} />
                            {item.title}
                          </div>
                        );
                      }
                    })}

                    {overflowCount > 0 && (
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#2563eb',
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: '#eff6ff',
                          textAlign: 'center',
                          marginTop: 1,
                        }}
                      >
                        +{overflowCount} mục khác...
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // 2. RENDER WEEK VIEW (Gộp Toàn Bộ Công Việc & Cuộc Họp Vào 2 Ca Sáng / Chiều Chuẩn)
  // ─────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      weekDays.push(d);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    return (
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ minWidth: isMobile ? 720 : '100%' }}>
          {/* Header Row: 7 Ngày trong tuần */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '110px repeat(7, minmax(0, 1fr))',
              background: '#f8fafc',
              borderBottom: '2px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                padding: '12px 6px',
                fontWeight: 800,
                fontSize: '0.8rem',
                color: '#475569',
                borderRight: '2px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f1f5f9',
              }}
            >
              CA / BUỔI
            </div>

            {weekDays.map((d, idx) => {
              const dStr = d.toISOString().split('T')[0];
              const isToday = dStr === todayStr;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '8px 4px',
                    borderRight: idx === 6 ? 'none' : '1px solid #e2e8f0',
                    background: isToday ? '#eff6ff' : 'transparent',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: isToday ? '#2563eb' : idx >= 5 ? '#b45309' : '#64748b',
                    }}
                  >
                    {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'][idx]}
                  </div>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: isToday ? '#2563eb' : '#0f172a',
                    }}
                  >
                    {d.getDate()}/{d.getMonth() + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 1: BUỔI SÁNG (07:30 - 11:30) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '110px repeat(7, minmax(0, 1fr))',
              borderBottom: '1px solid #e2e8f0',
              minHeight: 140,
            }}
          >
            <div
              style={{
                background: '#fffbeb',
                borderRight: '2px solid #e2e8f0',
                padding: '12px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <i className="fa-solid fa-sun" style={{ color: '#d97706', fontSize: '1.2rem', marginBottom: 4 }} />
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#b45309' }}>SÁNG</div>
              <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600 }}>07:30 - 11:30</div>
            </div>

            {weekDays.map((d, idx) => {
              const dStr = d.toISOString().split('T')[0];
              const dayItems = getItemsForDate(dStr);
              const { morning } = categorizeDayItems(dayItems);

              return (
                <div
                  key={idx}
                  style={{
                    borderRight: idx === 6 ? 'none' : '1px solid #f1f5f9',
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                  }}
                >
                  {morning.length === 0 ? (
                    <div
                      onClick={() => {
                        resetEventForm(dStr, '08:00');
                        setShowCreateEventModal(true);
                      }}
                      style={{
                        height: '100%',
                        minHeight: 90,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#cbd5e1',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        borderRadius: 6,
                        border: '1px dashed transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.color = '#94a3b8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.color = '#cbd5e1';
                      }}
                      title="Bấm để thêm cuộc họp / công việc sáng"
                    >
                      <i className="fa-solid fa-plus" style={{ marginRight: 3 }} /> Trống
                    </div>
                  ) : (
                    morning.map((item) => {
                      if (item.isTask) {
                        const tColor = getTaskColor(item.priority);
                        return (
                          <div
                            key={`wk_m_task_${item.id}`}
                            onClick={() => onOpenTaskDetailModal(item.id)}
                            style={{
                              background: tColor.bg,
                              border: `1px solid ${tColor.border}`,
                              borderLeft: `3px solid ${tColor.dot}`,
                              padding: '6px 8px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontWeight: 800, color: tColor.color, fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <i className="fa-solid fa-thumbtack" /> [Công việc]
                              </span>
                              <span className="badge" style={{ background: tColor.bg, color: tColor.color, border: `1px solid ${tColor.border}`, fontSize: '0.62rem', padding: '0 4px' }}>
                                {tColor.label}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                              {item.title}
                            </div>
                            {item.assigneeName && (
                              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="fa-solid fa-user-tie" /> {item.assigneeName}
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        const badge = getEventBadge(item.eventType);
                        return (
                          <div
                            key={`wk_m_event_${item.id}`}
                            onClick={() => {
                              setSelectedEvent(item);
                              setShowEventDetailModal(true);
                            }}
                            style={{
                              background: badge.bg,
                              borderLeft: `3px solid ${badge.border}`,
                              padding: '6px 8px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                              <span style={{ fontWeight: 800, color: badge.color, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <i className="fa-solid fa-clock" /> {new Date(item.startDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: '0.62rem', padding: '1px 4px' }}>
                                <i className={`fa-solid ${badge.icon}`} style={{ marginRight: 3 }} />
                                {badge.label}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                              {item.title}
                            </div>
                            {item.location && (
                              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="fa-solid fa-location-dot" /> {item.location}
                              </div>
                            )}
                          </div>
                        );
                      }
                    })
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 2: BUỔI CHIỀU (13:30 - 17:00) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '110px repeat(7, minmax(0, 1fr))',
              minHeight: 140,
            }}
          >
            <div
              style={{
                background: '#f0fdf4',
                borderRight: '2px solid #e2e8f0',
                padding: '12px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <i className="fa-solid fa-cloud-sun" style={{ color: '#16a34a', fontSize: '1.2rem', marginBottom: 4 }} />
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#15803d' }}>CHIỀU</div>
              <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 600 }}>13:30 - 17:00</div>
            </div>

            {weekDays.map((d, idx) => {
              const dStr = d.toISOString().split('T')[0];
              const dayItems = getItemsForDate(dStr);
              const { afternoon } = categorizeDayItems(dayItems);

              return (
                <div
                  key={idx}
                  style={{
                    borderRight: idx === 6 ? 'none' : '1px solid #f1f5f9',
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                  }}
                >
                  {afternoon.length === 0 ? (
                    <div
                      onClick={() => {
                        resetEventForm(dStr, '14:00');
                        setShowCreateEventModal(true);
                      }}
                      style={{
                        height: '100%',
                        minHeight: 90,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#cbd5e1',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        borderRadius: 6,
                        border: '1px dashed transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.color = '#94a3b8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.color = '#cbd5e1';
                      }}
                      title="Bấm để thêm cuộc họp / công việc chiều"
                    >
                      <i className="fa-solid fa-plus" style={{ marginRight: 3 }} /> Trống
                    </div>
                  ) : (
                    afternoon.map((item) => {
                      if (item.isTask) {
                        const tColor = getTaskColor(item.priority);
                        return (
                          <div
                            key={`wk_a_task_${item.id}`}
                            onClick={() => onOpenTaskDetailModal(item.id)}
                            style={{
                              background: tColor.bg,
                              border: `1px solid ${tColor.border}`,
                              borderLeft: `3px solid ${tColor.dot}`,
                              padding: '6px 8px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontWeight: 800, color: tColor.color, fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <i className="fa-solid fa-thumbtack" /> [Công việc]
                              </span>
                              <span className="badge" style={{ background: tColor.bg, color: tColor.color, border: `1px solid ${tColor.border}`, fontSize: '0.62rem', padding: '0 4px' }}>
                                {tColor.label}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                              {item.title}
                            </div>
                            {item.assigneeName && (
                              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="fa-solid fa-user-tie" /> {item.assigneeName}
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        const badge = getEventBadge(item.eventType);
                        return (
                          <div
                            key={`wk_a_event_${item.id}`}
                            onClick={() => {
                              setSelectedEvent(item);
                              setShowEventDetailModal(true);
                            }}
                            style={{
                              background: badge.bg,
                              borderLeft: `3px solid ${badge.border}`,
                              padding: '6px 8px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                              <span style={{ fontWeight: 800, color: badge.color, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <i className="fa-solid fa-clock" /> {new Date(item.startDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: '0.62rem', padding: '1px 4px' }}>
                                <i className={`fa-solid ${badge.icon}`} style={{ marginRight: 3 }} />
                                {badge.label}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                              {item.title}
                            </div>
                            {item.location && (
                              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="fa-solid fa-location-dot" /> {item.location}
                              </div>
                            )}
                          </div>
                        );
                      }
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // 3. RENDER DAY VIEW (Chi Tiết Ngày Theo Ca Sáng / Chiều Gộp)
  // ─────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const dayStr = currentDate.toISOString().split('T')[0];
    const dayItems = getItemsForDate(dayStr);
    const { morning, afternoon } = categorizeDayItems(dayItems);

    return (
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#ffffff',
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-calendar-day" style={{ color: '#2563eb' }} />
            <span>
              Lịch trình {currentDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-xs"
            onClick={() => {
              resetEventForm(dayStr);
              setShowCreateEventModal(true);
            }}
            style={{ fontWeight: 700, borderRadius: 6 }}
          >
            <i className="fa-solid fa-plus" /> Thêm cuộc họp
          </button>
        </div>

        {dayItems.length === 0 ? (
          <div style={{ padding: '36px 10px', textAlign: 'center', color: '#94a3b8' }}>
            <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
            Không có lịch làm việc hay sự kiện nào trong ngày này.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Buổi Sáng */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#fffbeb', padding: '8px 12px', fontWeight: 800, fontSize: '0.85rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-sun" style={{ color: '#d97706' }} /> BUỔI SÁNG (07:30 - 11:30) • {morning.length} mục
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#ffffff' }}>
                {morning.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '6px 0' }}>Không có lịch trình buổi sáng.</div>
                ) : (
                  morning.map((item) => {
                    if (item.isTask) {
                      const tColor = getTaskColor(item.priority);
                      return (
                        <div
                          key={`day_m_tsk_${item.id}`}
                          onClick={() => onOpenTaskDetailModal(item.id)}
                          style={{
                            background: tColor.bg,
                            borderLeft: `4px solid ${tColor.border}`,
                            padding: '10px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <i className="fa-solid fa-thumbtack" style={{ color: tColor.color }} /> [Công việc] {item.title}
                            </span>
                            <span className="badge" style={{ background: tColor.bg, color: tColor.color, border: `1px solid ${tColor.border}`, fontWeight: 700, fontSize: '0.7rem' }}>
                              {tColor.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span><i className="fa-solid fa-user-tie" /> Người thực hiện: <strong>{item.assigneeName || 'Cán bộ'}</strong></span>
                            <span>• Giao bởi: {item.assignerName || 'Lãnh đạo'}</span>
                          </div>
                        </div>
                      );
                    } else {
                      const badge = getEventBadge(item.eventType);
                      return (
                        <div
                          key={`day_m_evt_${item.id}`}
                          onClick={() => {
                            setSelectedEvent(item);
                            setShowEventDetailModal(true);
                          }}
                          style={{
                            background: badge.bg,
                            borderLeft: `4px solid ${badge.border}`,
                            padding: '10px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: badge.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <i className={`fa-solid ${badge.icon}`} /> [{badge.label}] {item.title}
                            </span>
                            <span className="badge" style={{ background: badge.bg, color: badge.color, fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <i className="fa-solid fa-clock" />
                              {new Date(item.startDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span><i className="fa-solid fa-location-dot" /> <strong>{item.location || 'UBND Xã Cát Ngạn'}</strong></span>
                            <span>• <i className="fa-solid fa-user-shield" /> Chủ trì: {item.organizerName || 'Ban tổ chức'}</span>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </div>

            {/* Buổi Chiều */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#f0fdf4', padding: '8px 12px', fontWeight: 800, fontSize: '0.85rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-cloud-sun" style={{ color: '#16a34a' }} /> BUỔI CHIỀU (13:30 - 17:00) • {afternoon.length} mục
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#ffffff' }}>
                {afternoon.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '6px 0' }}>Không có lịch trình buổi chiều.</div>
                ) : (
                  afternoon.map((item) => {
                    if (item.isTask) {
                      const tColor = getTaskColor(item.priority);
                      return (
                        <div
                          key={`day_a_tsk_${item.id}`}
                          onClick={() => onOpenTaskDetailModal(item.id)}
                          style={{
                            background: tColor.bg,
                            borderLeft: `4px solid ${tColor.border}`,
                            padding: '10px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <i className="fa-solid fa-thumbtack" style={{ color: tColor.color }} /> [Công việc] {item.title}
                            </span>
                            <span className="badge" style={{ background: tColor.bg, color: tColor.color, border: `1px solid ${tColor.border}`, fontWeight: 700, fontSize: '0.7rem' }}>
                              {tColor.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span><i className="fa-solid fa-user-tie" /> Người thực hiện: <strong>{item.assigneeName || 'Cán bộ'}</strong></span>
                            <span>• Giao bởi: {item.assignerName || 'Lãnh đạo'}</span>
                          </div>
                        </div>
                      );
                    } else {
                      const badge = getEventBadge(item.eventType);
                      return (
                        <div
                          key={`day_a_evt_${item.id}`}
                          onClick={() => {
                            setSelectedEvent(item);
                            setShowEventDetailModal(true);
                          }}
                          style={{
                            background: badge.bg,
                            borderLeft: `4px solid ${badge.border}`,
                            padding: '10px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: badge.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <i className={`fa-solid ${badge.icon}`} /> [{badge.label}] {item.title}
                            </span>
                            <span className="badge" style={{ background: badge.bg, color: badge.color, fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <i className="fa-solid fa-clock" />
                              {new Date(item.startDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span><i className="fa-solid fa-location-dot" /> <strong>{item.location || 'UBND Xã Cát Ngạn'}</strong></span>
                            <span>• <i className="fa-solid fa-user-shield" /> Chủ trì: {item.organizerName || 'Ban tổ chức'}</span>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 16,
        width: '100%',
        touchAction: 'pan-y',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Sidebar My Calendars (Desktop Only) ── */}
      {!isMobile && (
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nút + Tạo mới */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              style={{
                width: '100%',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 8,
              }}
            >
              <i className="fa-solid fa-plus" /> Tạo Mới Lịch
            </button>

            {showCreateMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 6,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowCreateMenu(false);
                    onOpenCreateTaskModal();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 0,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <i className="fa-solid fa-list-check" style={{ color: '#2563eb' }} /> Công việc mới (Task)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowCreateMenu(false);
                    resetEventForm();
                    setShowCreateEventModal(true);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 0,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <i className="fa-solid fa-calendar-day" style={{ color: '#d97706' }} /> Cuộc họp / Sự kiện mới
                </button>
              </div>
            )}
          </div>

          {/* My Calendars Filter Card */}
          <div className="card" style={{ padding: 14 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: '0.85rem',
                color: '#1e293b',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fa-solid fa-sliders" style={{ color: '#64748b' }} /> Lịch hiển thị
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} />
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0284c7', display: 'inline-block' }} />
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
      )}

      {/* ── Main Calendar Container ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, width: '100%' }}>
        {/* Responsive Header Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 10 : 12,
            background: '#ffffff',
            padding: isMobile ? '10px 12px' : '10px 16px',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          {/* Row 1: Nav Buttons (< Hôm nay >) + Month/Year Display */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: isMobile ? '100%' : 'auto', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleToday}
                style={{
                  fontWeight: 700,
                  minHeight: 38,
                  padding: '6px 12px',
                  borderRadius: 6,
                }}
              >
                Hôm nay
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handlePrev}
                style={{ minWidth: 38, minHeight: 38, padding: 0 }}
                title="Trước"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleNext}
                style={{ minWidth: 38, minHeight: 38, padding: 0 }}
                title="Sau"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>

            <h2
              style={{
                fontSize: isMobile ? '0.98rem' : '1.1rem',
                fontWeight: 800,
                margin: 0,
                color: '#0f172a',
                whiteSpace: 'nowrap',
              }}
            >
              {viewMode === 'month' && currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
              {viewMode === 'week' && `Lịch tuần (${currentDate.toLocaleDateString('vi-VN', { month: 'numeric', year: 'numeric' })})`}
              {viewMode === 'day' && currentDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </h2>

            {/* Mobile Filter Button */}
            {isMobile && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowFilterDrawer(true)}
                style={{ minWidth: 38, minHeight: 38, padding: 0, color: '#475569' }}
                title="Bộ lọc lịch"
              >
                <i className="fa-solid fa-filter" />
              </button>
            )}
          </div>

          {/* Row 2: View Switcher (Tháng / Tuần / Ngày) + Mobile "+ Tạo" button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8, flex: isMobile ? 1 : 'none' }}>
              <button
                type="button"
                className={`btn btn-xs ${viewMode === 'month' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('month')}
                style={{
                  fontWeight: 700,
                  flex: 1,
                  minHeight: 34,
                  borderRadius: 6,
                }}
              >
                Tháng
              </button>
              <button
                type="button"
                className={`btn btn-xs ${viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('week')}
                style={{
                  fontWeight: 700,
                  flex: 1,
                  minHeight: 34,
                  borderRadius: 6,
                }}
              >
                Tuần
              </button>
              <button
                type="button"
                className={`btn btn-xs ${viewMode === 'day' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('day')}
                style={{
                  fontWeight: 700,
                  flex: 1,
                  minHeight: 34,
                  borderRadius: 6,
                }}
              >
                Ngày
              </button>
            </div>

            {/* Mobile + Tạo Nhanh Button */}
            {isMobile && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateMenu(true)}
                style={{
                  fontWeight: 700,
                  minHeight: 38,
                  padding: '6px 12px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <i className="fa-solid fa-plus" /> Tạo
              </button>
            )}
          </div>
        </div>

        {/* Swipe Help Note on Mobile */}
        {isMobile && (
          <div
            style={{
              fontSize: '0.72rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: '#f8fafc',
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            <i className="fa-solid fa-arrows-left-right" style={{ color: '#94a3b8' }} />
            <span>Vuốt trái / phải để chuyển nhanh</span>
          </div>
        )}

        {/* Main Content Render */}
        <div style={{ width: '100%' }}>
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
        </div>
      </div>

      {/* ── Day Detail Bottom Sheet / Drawer ── */}
      {selectedDayDate && (
        <div
          className="welcome-modal-overlay"
          onClick={() => setSelectedDayDate(null)}
          style={{
            alignItems: isMobile ? 'flex-end' : 'center',
            padding: isMobile ? 0 : '16px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            className="welcome-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: isMobile ? '100%' : 560,
              width: '100%',
              borderRadius: isMobile ? '16px 16px 0 0' : 12,
              maxHeight: isMobile ? '80vh' : '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 18px',
              animation: isMobile ? 'slideUp 0.25s ease' : 'fadeIn 0.2s ease',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: 10,
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-calendar-day" style={{ color: '#2563eb' }} />
                  {selectedDayDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                  Tổng cộng: {selectedDayItems.length} mục
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedDayDate(null)}
                style={{ width: 34, height: 34, padding: 0 }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Quick Action in Day Drawer */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => {
                  const prefill = selectedDayDate.toISOString().split('T')[0];
                  setSelectedDayDate(null);
                  resetEventForm(prefill);
                  setShowCreateEventModal(true);
                }}
                style={{ fontWeight: 700, borderRadius: 6 }}
              >
                <i className="fa-solid fa-calendar-plus" style={{ color: '#d97706', marginRight: 4 }} />
                Thêm cuộc họp / sự kiện ngày này
              </button>
            </div>

            {/* Drawer Body Items List */}
            <div
              style={{
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingRight: 4,
              }}
            >
              {selectedDayItems.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                  Không có sự kiện hoặc công việc trong ngày này.
                </div>
              ) : (
                selectedDayItems.map((item) => {
                  if (item.isTask) {
                    const tColor = getTaskColor(item.priority);
                    return (
                      <div
                        key={`drawer_t_${item.id}`}
                        onClick={() => {
                          setSelectedDayDate(null);
                          onOpenTaskDetailModal(item.id);
                        }}
                        style={{
                          background: tColor.bg,
                          borderLeft: `4px solid ${tColor.border}`,
                          padding: '10px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="fa-solid fa-thumbtack" style={{ color: tColor.color }} /> {item.title}
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: tColor.bg,
                              color: tColor.color,
                              border: `1px solid ${tColor.border}`,
                              fontWeight: 700,
                              fontSize: '0.7rem',
                            }}
                          >
                            {tColor.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span><i className="fa-solid fa-user-tie" /> Người thực hiện: <strong>{item.assigneeName || 'Cán bộ'}</strong></span>
                          <span>• Giao bởi: {item.assignerName || 'Lãnh đạo'}</span>
                        </div>
                      </div>
                    );
                  } else {
                    const badge = getEventBadge(item.eventType);
                    return (
                      <div
                        key={`drawer_e_${item.id}`}
                        onClick={() => {
                          setSelectedDayDate(null);
                          setSelectedEvent(item);
                          setShowEventDetailModal(true);
                        }}
                        style={{
                          background: badge.bg,
                          borderLeft: `4px solid ${badge.border}`,
                          padding: '10px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: badge.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className={`fa-solid ${badge.icon}`} />
                            [{badge.label}] {item.title}
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <i className="fa-solid fa-clock" />
                            {new Date(item.startDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span><i className="fa-solid fa-location-dot" /> {item.location || 'UBND Xã Cát Ngạn'}</span>
                          <span>• <i className="fa-solid fa-user-shield" /> Chủ trì: {item.organizerName || 'Ban tổ chức'}</span>
                        </div>
                      </div>
                    );
                  }
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedDayDate(null)}
                style={{ width: isMobile ? '100%' : 'auto', minHeight: 38 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Filter Bottom Sheet ── */}
      {showFilterDrawer && (
        <div
          className="welcome-modal-overlay"
          onClick={() => setShowFilterDrawer(false)}
          style={{ alignItems: 'flex-end', padding: 0 }}
        >
          <div
            className="welcome-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              width: '100%',
              borderRadius: '16px 16px 0 0',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: 8,
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-sliders" style={{ color: '#2563eb' }} /> Bộ lọc Lịch
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowFilterDrawer(false)}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.92rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  style={{ width: 18, height: 18 }}
                  checked={showTasks}
                  onChange={(e) => setShowTasks(e.target.checked)}
                />
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#0284c7', display: 'inline-block' }} />
                <span>Công việc được giao</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.92rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  style={{ width: 18, height: 18 }}
                  checked={showEvents}
                  onChange={(e) => setShowEvents(e.target.checked)}
                />
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#d97706', display: 'inline-block' }} />
                <span>Cuộc họp & Sự kiện</span>
              </label>
            </div>

            <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowFilterDrawer(false)}
                style={{ width: '100%', minHeight: 40, fontWeight: 700 }}
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Action Modal (Mobile Popup) ── */}
      {showCreateMenu && isMobile && (
        <div
          className="welcome-modal-overlay"
          onClick={() => setShowCreateMenu(false)}
          style={{ alignItems: 'flex-end', padding: 0 }}
        >
          <div
            className="welcome-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              width: '100%',
              borderRadius: '16px 16px 0 0',
              padding: '18px 20px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 14, color: '#0f172a' }}>
              <i className="fa-solid fa-plus" style={{ marginRight: 6 }} /> Tạo mới mục lịch
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setShowCreateMenu(false);
                  onOpenCreateTaskModal();
                }}
                style={{
                  justifyContent: 'flex-start',
                  padding: '12px 14px',
                  borderRadius: 8,
                  fontSize: '0.92rem',
                  fontWeight: 700,
                }}
              >
                <i className="fa-solid fa-list-check" style={{ color: '#2563eb', marginRight: 8 }} />
                Giao Công Việc Mới (Task)
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setShowCreateMenu(false);
                  resetEventForm();
                  setShowCreateEventModal(true);
                }}
                style={{
                  justifyContent: 'flex-start',
                  padding: '12px 14px',
                  borderRadius: 8,
                  fontSize: '0.92rem',
                  fontWeight: 700,
                }}
              >
                <i className="fa-solid fa-calendar-day" style={{ color: '#d97706', marginRight: 8 }} />
                Thêm Cuộc Họp / Sự Kiện Mới
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowCreateMenu(false)}
                style={{ marginTop: 4 }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Event Modal ── */}
      {showCreateEventModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-calendar-plus" style={{ color: '#2563eb' }} />
                {editingEventId ? 'Chỉnh Sửa Cuộc Họp / Sự Kiện' : 'Tạo Cuộc Họp / Sự Kiện Mới'}
              </h3>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowCreateEventModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Tiêu đề */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>
                  Tiêu đề cuộc họp / sự kiện <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: Họp Thường trực UBND xã, Hội nghị tiếp xúc cử tri..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{ fontSize: '0.9rem', fontWeight: 600 }}
                />
              </div>

              {/* Loại sự kiện & Địa điểm */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
                    <option value="FieldTrip">Đi công tác / Khảo sát thực địa</option>
                    <option value="Other">Sự kiện khác</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Địa điểm</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="VD: Phòng họp số 1 - UBND Xã"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Checkbox Cả ngày */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="eventAllDayCheck"
                  checked={formIsAllDay}
                  onChange={(e) => setFormIsAllDay(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="eventAllDayCheck" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Sự kiện cả ngày (All-day)
                </label>
              </div>

              {/* Bắt đầu & Kết thúc */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Thời gian bắt đầu</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="date"
                      className="form-control"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                    />
                    {!formIsAllDay && (
                      <input
                        type="time"
                        className="form-control"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Thời gian kết thúc</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="date"
                      className="form-control"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                    />
                    {!formIsAllDay && (
                      <input
                        type="time"
                        className="form-control"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Mô tả chi tiết */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Nội dung chương trình / Ghi chú</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Nội dung, chương trình cuộc họp..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              {/* Người tham dự (Multi-Select Participants) */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', margin: 0 }}>
                    Thành phần tham dự ({formParticipants.length} người đã chọn)
                  </label>
                  {formParticipants.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setFormParticipants([])}
                      style={{ fontSize: '0.72rem', color: '#dc2626' }}
                    >
                      Bỏ chọn tất cả
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Tìm kiếm cán bộ theo tên, chức vụ..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  style={{ fontSize: '0.82rem', marginBottom: 6 }}
                />

                <div
                  style={{
                    maxHeight: 120,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: 6,
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {filteredUsers.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: 6 }}>
                      Không tìm thấy cán bộ phù hợp.
                    </div>
                  ) : (
                    filteredUsers.map((u: any) => {
                      const uId = u.id || u.userId;
                      const uName = u.fullName || u.name;
                      const uRole = u.role || u.rankLabel || u.departmentName;
                      const isChecked = formParticipants.includes(uId);

                      return (
                        <label
                          key={uId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 6px',
                            background: isChecked ? '#eff6ff' : '#ffffff',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormParticipants((prev) => [...prev, uId]);
                              } else {
                                setFormParticipants((prev) => prev.filter((id) => id !== uId));
                              }
                            }}
                          />
                          <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? '#1d4ed8' : '#1e293b' }}>
                            {uName}
                          </span>
                          {uRole && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>({uRole})</span>}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Mốc nhắc trước */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: 4 }}>
                  Mốc nhắc việc tự động (SignalR)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {REMINDER_OPTIONS.map((opt) => {
                    const isSelected = formReminders.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormReminders((prev) => prev.filter((v) => v !== opt.value));
                          } else {
                            setFormReminders((prev) => [...prev, opt.value]);
                          }
                        }}
                        style={{
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          border: `1px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                          color: isSelected ? '#1d4ed8' : '#475569',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.78rem',
                          padding: '4px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isSelected && <i className="fa-solid fa-check" />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCreateEventModal(false)}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  if (!formTitle.trim()) {
                    addToast('Thiếu thông tin', 'Vui lòng nhập tiêu đề sự kiện!', 'warning');
                    return;
                  }

                  let startIso: string;
                  let endIso: string;

                  try {
                    const startStr = `${formStartDate}T${formIsAllDay ? '00:00:00' : formStartTime}:00`;
                    const endStr = `${formEndDate}T${formIsAllDay ? '23:59:59' : formEndTime}:00`;
                    startIso = new Date(startStr).toISOString();
                    endIso = new Date(endStr).toISOString();

                    if (new Date(endIso) < new Date(startIso)) {
                      endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
                    }
                  } catch (err) {
                    addToast('Lỗi định dạng ngày', 'Vui lòng kiểm tra lại thời gian bắt đầu và kết thúc.', 'danger');
                    return;
                  }

                  if (editingEventId) {
                    const res = await updateCalendarEventApi(editingEventId, {
                      id: editingEventId,
                      title: formTitle.trim(),
                      description: formDesc,
                      eventType: formType,
                      startDateTime: startIso,
                      endDateTime: endIso,
                      isAllDay: formIsAllDay,
                      location: formLocation,
                      participantUserIds: formParticipants,
                      reminderOffsetsMinutes: formReminders.length ? formReminders : [30],
                    });

                    if (res.success) {
                      addToast('Thành công', 'Đã cập nhật sự kiện lịch!', 'success');
                      setShowCreateEventModal(false);
                      setEditingEventId(null);
                      fetchEvents();
                    } else {
                      addToast('Lỗi', res.error || 'Không thể cập nhật sự kiện.', 'danger');
                    }
                  } else {
                    const res = await createCalendarEventApi({
                      title: formTitle.trim(),
                      description: formDesc,
                      eventType: formType,
                      startDateTime: startIso,
                      endDateTime: endIso,
                      isAllDay: formIsAllDay,
                      location: formLocation,
                      participantUserIds: formParticipants,
                      reminderOffsetsMinutes: formReminders.length ? formReminders : [30],
                    });

                    if (res.success) {
                      addToast('Thành công', 'Đã khởi tạo sự kiện mới!', 'success');
                      setShowCreateEventModal(false);
                      resetEventForm();
                      fetchEvents();
                    } else {
                      addToast('Lỗi', res.error || 'Không thể tạo sự kiện.', 'danger');
                    }
                  }
                }}
              >
                <i className="fa-solid fa-floppy-disk" /> {editingEventId ? 'Lưu Cập Nhật' : 'Lưu Sự Kiện'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Detail Modal ── */}
      {showEventDetailModal && selectedEvent && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" style={{ maxWidth: 560, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
              <span className="badge" style={{ background: getEventBadge(selectedEvent.eventType).bg, color: getEventBadge(selectedEvent.eventType).color, fontWeight: 700 }}>
                <i className={`fa-solid ${getEventBadge(selectedEvent.eventType).icon}`} style={{ marginRight: 4 }} />
                {selectedEvent.eventTypeName || getEventBadge(selectedEvent.eventType).label}
              </span>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowEventDetailModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-calendar-day" style={{ color: '#2563eb' }} />
              {selectedEvent.title}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem', color: '#475569' }}>
              <div>
                <strong>Thời gian:</strong> {new Date(selectedEvent.startDateTime).toLocaleString('vi-VN')} — {new Date(selectedEvent.endDateTime).toLocaleString('vi-VN')}
                {selectedEvent.isAllDay && <span className="badge badge-secondary" style={{ marginLeft: 6 }}>Cả ngày</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-location-dot" style={{ color: '#64748b' }} />
                <span><strong>Địa điểm:</strong> {selectedEvent.location || 'UBND Xã Cát Ngạn'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-user-shield" style={{ color: '#64748b' }} />
                <span><strong>Người chủ trì / Ban tổ chức:</strong> {selectedEvent.organizerName || 'Ban tổ chức'}</span>
              </div>

              {selectedEvent.description && (
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, marginTop: 4 }}>
                  <strong>Nội dung:</strong> {selectedEvent.description}
                </div>
              )}

              {/* Thành phần tham gia */}
              {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <strong>Thành phần tham gia ({selectedEvent.participants.length} đồng chí):</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {selectedEvent.participants.map((p, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: '#f1f5f9',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <i className="fa-solid fa-user-tie" /> {p.userName || p.userId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mốc nhắc */}
              {selectedEvent.reminderOffsetsMinutes && selectedEvent.reminderOffsetsMinutes.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-bell" style={{ color: '#d97706' }} />
                  <span><strong>Nhắc nhở trước:</strong> {selectedEvent.reminderOffsetsMinutes.map((m) => (m >= 1440 ? `${m / 1440} ngày` : m >= 60 ? `${m / 60} giờ` : `${m} phút`)).join(', ')}</span>
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

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => openEditEventModal(selectedEvent)}
                >
                  <i className="fa-solid fa-pen" /> Sửa
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowEventDetailModal(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
