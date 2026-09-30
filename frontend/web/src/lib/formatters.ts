/** Administrative display uses Vietnam time, independently of the device time zone. */
const unknownDate = 'Chưa xác định';
const vnDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function parseSafeDate(input?: string | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const value = input.trim();
  const vn = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (vn || iso) {
    const [year, month, day] = vn ? [Number(vn[3]), Number(vn[2]), Number(vn[1])]
      : [Number(iso![1]), Number(iso![2]), Number(iso![3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }
  // A timestamp without an offset has no unambiguous instant.
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function parts(input?: string | Date | null) {
  const date = parseSafeDate(input);
  if (!date) return null;
  return Object.fromEntries(vnDateTime.formatToParts(date).map(part => [part.type, part.value]));
}
export function formatDateShort(input?: string | Date | null): string {
  const p = parts(input);
  return p ? `${p.day}-${p.month}-${p.year}` : unknownDate;
}
export function formatDateLong(input?: string | Date | null): string {
  const p = parts(input);
  return p ? `Ngày ${p.day} tháng ${p.month} năm ${p.year}` : unknownDate;
}
export function formatDateTimeShort(input?: string | Date | null): string {
  const p = parts(input);
  return p ? `${p.hour}:${p.minute}, ${p.day}-${p.month}-${p.year}` : unknownDate;
}
export function formatTimeShort(input?: string | Date | null): string {
  const p = parts(input);
  return p ? `${p.hour}:${p.minute}` : unknownDate;
}
/** Internal calendar key, never a user-facing date label. */
export function vietnamDateKey(input?: string | Date | null): string {
  const p = parts(input);
  return p ? `${p.year}-${p.month}-${p.day}` : '';
}
/** UTC-midnight cursor representing a Vietnam calendar day, independent of device settings. */
export function vietnamCalendarDate(input: string | Date = new Date()): Date {
  return new Date(`${vietnamDateKey(input)}T00:00:00Z`);
}
export function formatAdministrativeDate(input: Date | string = new Date()): string {
  const p = parts(input);
  if (!p) return unknownDate;
  const dateOnly = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return `${weekdays[dateOnly.getUTCDay()]}, ngày ${p.day} tháng ${p.month} năm ${p.year}`;
}
/** User-entered DD-MM-YYYY + HH:mm in Vietnam -> API timestamp with an explicit UTC offset. */
export function vietnamDateTimeToUtc(date: string, time: string): string | null {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  if (!parseSafeDate(date)) return null;
  const [day, month, year] = date.split('-');
  return new Date(`${year}-${month}-${day}T${time}:00+07:00`).toISOString();
}
