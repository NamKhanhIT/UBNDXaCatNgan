/**
 * ============================================================================
 * QUY CHUẨN ĐỊNH DẠNG NGÀY THÁNG CÔNG VỤ VIỆT NAM (MANDATORY DATE FORMATTERS)
 * ============================================================================
 * Quy chuẩn bắt buộc theo văn bản hành chính Việt Nam:
 * 1. Chuẩn ngắn: DD-MM-YYYY (Ví dụ: 27-09-2026)
 * 2. Chuẩn dài:  Ngày DD tháng MM năm YYYY (Ví dụ: Ngày 27 tháng 09 năm 2025)
 * 3. Chuẩn giờ:  HH:mm, DD-MM-YYYY (Ví dụ: 08:30, 27-09-2026)
 * ============================================================================
 */

/**
 * Phân tích an toàn đầu vào thành Date object
 */
function parseSafeDate(input?: string | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  const str = String(input).trim();
  if (!str) return null;

  // Nếu đầu vào đã là định dạng DD-MM-YYYY hoặc DD/MM/YYYY
  const vnMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (vnMatch) {
    const day = parseInt(vnMatch[1], 10);
    const month = parseInt(vnMatch[2], 10) - 1;
    const year = parseInt(vnMatch[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // Thử parse chuẩn ISO / UTC
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 1. Định dạng ngày ngắn chuẩn duy nhất: DD-MM-YYYY (VD: 27-09-2026)
 */
export function formatDateShort(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = parseSafeDate(dateInput);
  if (!d) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

/**
 * 2. Định dạng ngày dài hành chính chuẩn: Ngày DD tháng MM năm YYYY (VD: Ngày 27 tháng 09 năm 2025)
 */
export function formatDateLong(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = parseSafeDate(dateInput);
  if (!d) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `Ngày ${day} tháng ${month} năm ${year}`;
}

/**
 * 3. Định dạng ngày giờ hành chính cho Header: Thứ X, ngày DD tháng MM năm YYYY (VD: Thứ Bảy, ngày 22 tháng 08 năm 2026)
 */
export function formatAdministrativeDate(dateInput: Date | string = new Date()): string {
  const d = parseSafeDate(dateInput) || new Date();
  const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = daysOfWeek[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${dayName}, ngày ${day} tháng ${month} năm ${year}`;
}

/**
 * 4. Định dạng ngày giờ chi tiết: HH:mm, DD-MM-YYYY (VD: 08:30, 27-09-2026)
 */
export function formatDateTimeShort(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = parseSafeDate(dateInput);
  if (!d) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');

  return `${hours}:${mins}, ${day}-${month}-${year}`;
}
