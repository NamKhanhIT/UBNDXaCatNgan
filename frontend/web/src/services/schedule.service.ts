/**
 * Schedule Service — Quản lý lịch từ hộp thư & nhắc việc
 */

export interface ScheduleEntry {
  id: string;
  title: string;
  description: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime?: string;
  shift: 'Sang' | 'Chieu';
  sourceType: 'inbox' | 'manual' | 'task';
  sourceId?: string;   // ID của inbox item hoặc task gốc
  sourceSubject?: string; // Tiêu đề văn bản gốc
  createdAt: string;
  reminders: Reminder[];
}

export interface Reminder {
  id: string;
  scheduleId: string;
  type: 'before'; // Nhắc trước X phút/giờ/ngày
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
  frequency: 'once' | 'repeat';
  message: string;
  isActive: boolean;
  lastTriggered?: string;
}

export interface ScheduleCreateData {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string;
  shift: 'Sang' | 'Chieu';
}

/**
 * Tạo lịch từ hộp thư (inbox item)
 */
export function createScheduleFromInbox(
  inboxItemId: string,
  inboxSubject: string,
  data: ScheduleCreateData,
): ScheduleEntry {
  return {
    id: `SCH-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    title: data.title,
    description: data.description,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    shift: data.shift,
    sourceType: 'inbox',
    sourceId: inboxItemId,
    sourceSubject: inboxSubject,
    createdAt: new Date().toLocaleString('vi-VN'),
    reminders: [],
  };
}

/**
 * Tạo lịch thủ công
 */
export function createManualSchedule(data: ScheduleCreateData): ScheduleEntry {
  return {
    id: `SCH-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    title: data.title,
    description: data.description,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    shift: data.shift,
    sourceType: 'manual',
    createdAt: new Date().toLocaleString('vi-VN'),
    reminders: [],
  };
}

/**
 * Tự động xếp lịch dựa trên mức độ khẩn cấp (AI simulation)
 * Tìm slot trống gần nhất trên lịch tuần.
 */
export function autoScheduleFromInbox(
  inboxItemId: string,
  inboxSubject: string,
  isUrgent: boolean,
  existingSchedules: ScheduleEntry[],
  weekStartDate: string,
): ScheduleEntry {
  // Giả lập logic AI: tìm slot trống
  const [y, m, d] = weekStartDate.split('-').map(Number);
  
  // Nếu khẩn cấp → ngày mai buổi sáng, nếu không → 2 ngày sau buổi chiều
  const daysOffset = isUrgent ? 1 : 2;
  const targetDate = new Date(Date.UTC(y, m - 1, d + daysOffset));
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const shift = isUrgent ? 'Sang' : 'Chieu';
  const startTime = isUrgent ? '07:00' : '13:00';

  return createScheduleFromInbox(inboxItemId, inboxSubject, {
    title: inboxSubject,
    description: `Tự động xếp lịch từ công văn: ${inboxSubject}`,
    date: dateStr,
    startTime,
    shift,
  });
}

/**
 * Tạo nhắc nhở cho một lịch
 */
export function createReminder(
  scheduleId: string,
  amount: number,
  unit: 'minutes' | 'hours' | 'days',
  frequency: 'once' | 'repeat',
  message: string,
): Reminder {
  return {
    id: `RMD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    scheduleId,
    type: 'before',
    amount,
    unit,
    frequency,
    message,
    isActive: true,
  };
}

/**
 * Lấy lịch trong tuần
 */
export function getWeekSchedules(
  allSchedules: ScheduleEntry[],
  weekStartDate: string,
): ScheduleEntry[] {
  const [y, m, d] = weekStartDate.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 7));
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  return allSchedules.filter(s => s.date >= startStr && s.date < endStr);
}

/**
 * Format nhắc việc cho hiển thị
 */
export function formatReminderLabel(reminder: Reminder): string {
  const unitLabels: Record<string, string> = {
    minutes: 'phút',
    hours: 'giờ',
    days: 'ngày',
  };
  const freqLabel = reminder.frequency === 'once' ? 'Một lần' : 'Lặp lại';
  return `Nhắc trước ${reminder.amount} ${unitLabels[reminder.unit]} (${freqLabel})`;
}
