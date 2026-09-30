'use client';

import React, { useMemo } from 'react';
import { formatDateShort, formatTimeShort, vietnamDateTimeToUtc } from '../lib/formatters';

export interface VnDateTimeInputProps {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  dateOnly?: boolean;
  id?: string;
}

const isoToLocalTuple = (
  iso: string | null | undefined,
): { y: number; m: number; d: number; hh: number; mm: number } => {
  const value = iso || new Date();
  const [d, m, y] = formatDateShort(value).split('-').map(Number);
  const [hh, mm] = formatTimeShort(value).split(':').map(Number);
  return { y, m, d, hh, mm };
};

const buildIso = (y: number, m: number, d: number, hh: number, mm: number): string => {
  return vietnamDateTimeToUtc(`${pad2(d)}-${pad2(m)}-${y}`, `${pad2(hh)}:${pad2(mm)}`) || '';
};

// Helper pad số → 2 chữ số
const pad2 = (n: number) => String(n).padStart(2, '0');

// Days in month (handle leap year)
const daysInMonth = (year: number, month1to12: number): number => {
  return new Date(year, month1to12, 0).getDate();
};

export function VnDateTimeInput({ value, onChange, disabled, dateOnly = false, id }: VnDateTimeInputProps) {
  const t = useMemo(() => isoToLocalTuple(value), [value]);

  // Cập nhật 1 phần của tuple rồi build lại ISO
  const update = (part: Partial<{ y: number; m: number; d: number; hh: number; mm: number }>) => {
    const merged = { ...t, ...part };
    merged.d = Math.min(merged.d, daysInMonth(merged.y, merged.m));
    onChange(buildIso(merged.y, merged.m, merged.d, merged.hh, merged.mm));
  };

  // Options
  const years = useMemo(() => {
    const arr: number[] = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 5; y <= currentYear + 10; y++) arr.push(y);
    return arr;
  }, []);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: daysInMonth(t.y, t.m) }, (_, i) => i + 1);
  }, [t.y, t.m]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  // Validate day khi month/year thay đổi (vd 31-02 không tồn tại)
  const safeDay = Math.min(t.d, daysInMonth(t.y, t.m));

  // Style chung cho select — ép class "form-control" để khớp với form hiện tại
  const selectStyle: React.CSSProperties = {
    padding: '4px 6px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: disabled ? '#f3f4f6' : '#fff',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#111827',
    cursor: disabled ? 'not-allowed' : 'pointer',
    minWidth: 0,
  };

  return (
    <div
      id={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* DD */}
      <select
        aria-label="Ngày"
        disabled={disabled}
        style={{ ...selectStyle, width: 50 }}
        value={safeDay}
        onChange={(e) => update({ d: Number(e.target.value) })}
      >
        {days.map((d) => (
          <option key={d} value={d}>
            {pad2(d)}
          </option>
        ))}
      </select>
      <span style={{ color: '#6b7280', fontWeight: 700 }}>-</span>
      {/* MM */}
      <select
        aria-label="Tháng"
        disabled={disabled}
        style={{ ...selectStyle, width: 56 }}
        value={t.m}
        onChange={(e) => update({ m: Number(e.target.value) })}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {pad2(m)}
          </option>
        ))}
      </select>
      <span style={{ color: '#6b7280', fontWeight: 700 }}>-</span>
      {/* YYYY */}
      <select
        aria-label="Năm"
        disabled={disabled}
        style={{ ...selectStyle, width: 72 }}
        value={t.y}
        onChange={(e) => update({ y: Number(e.target.value) })}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {/* HH */}
      {!dateOnly && <>
      <select
        aria-label="Giờ"
        disabled={disabled}
        style={{ ...selectStyle, width: 56, marginLeft: 6 }}
        value={t.hh}
        onChange={(e) => update({ hh: Number(e.target.value) })}
      >
        {hours.map((h) => (
          <option key={h} value={h}>
            {pad2(h)}
          </option>
        ))}
      </select>
      <span style={{ color: '#6b7280', fontWeight: 700 }}>:</span>
      {/* mm */}
      <select
        aria-label="Phút"
        disabled={disabled}
        style={{ ...selectStyle, width: 56 }}
        value={t.mm}
        onChange={(e) => update({ mm: Number(e.target.value) })}
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {pad2(m)}
          </option>
        ))}
      </select>
      </>}
    </div>
  );
}

export default VnDateTimeInput;
