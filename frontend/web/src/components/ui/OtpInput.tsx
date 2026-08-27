'use client';

import React, { useCallback, useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   OTP INPUT — 6 ô riêng biệt chuẩn ngân hàng (Audit Đợt 3)
   ───────────────────────────────────────────────────────────────
   • Mỗi ô chỉ nhận đúng 1 chữ số — chặn cấu trúc ký tự thừa/chữ cái
   • Auto-advance khi gõ; Backspace ở ô rỗng lùi về ô trước và xóa
   • Phím ←/→ di chuyển giữa các ô
   • Paste chuỗi số vào bất kỳ ô nào → tự phân bổ toàn bộ
   • Hidden input với autoComplete="one-time-code" giữ tính năng tự
     điền mã OTP của iOS Safari / Chrome mobile (autofill nhắm vào
     input đơn, không nhắm vào chuỗi ô rời)
   ═══════════════════════════════════════════════════════════════ */

interface OtpInputProps {
  /** Chuỗi hiện tại (tối đa `length` chữ số) */
  value: string;
  onChange: (value: string) => void;
  /** Số ô — mặc định 6 */
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
}: OtpInputProps) {
  const cellsRef = useRef<Array<HTMLInputElement | null>>([]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const focusCell = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    const cell = cellsRef.current[clamped];
    cell?.focus({ preventScroll: true });
    cell?.select();
  }, [length]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      const t = setTimeout(() => focusCell(0), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus, disabled, focusCell]);

  const handleCellChange = (index: number, raw: string) => {
    const incomingDigits = raw.replace(/\D/g, '');
    if (!incomingDigits) return;

    const chars = Array.from({ length }, (_, i) => value[i] ?? '');

    if (incomingDigits.length === 1) {
      // Gõ bình thường: ghi 1 chữ số rồi nhảy ô tiếp theo
      chars[index] = incomingDigits;
      onChange(chars.join(''));
      if (index < length - 1) {
        focusCell(index + 1);
      }
    } else {
      // Dán nhiều chữ số vào một ô: phân bổ lần lượt từ vị trí hiện tại
      for (let k = 0; k < incomingDigits.length && index + k < length; k++) {
        chars[index + k] = incomingDigits[k];
      }
      onChange(chars.join(''));
      focusCell(Math.min(index + incomingDigits.length, length - 1));
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = Array.from({ length }, (_, i) => value[i] ?? '');
      if (chars[index]) {
        // Ô đang có số → xóa số tại chỗ, giữ nguyên tiêu điểm
        chars.splice(index, 1);
        onChange(chars.join('').padEnd(0));
        focusCell(index);
      } else if (index > 0) {
        // Ô rỗng → lùi về ô trước và xóa số ở đó (chuẩn UX ngân hàng)
        chars.splice(index - 1, 1);
        onChange(chars.join(''));
        focusCell(index - 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusCell(index - 1);
      return;
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      focusCell(index + 1);
    }
  };

  return (
    <div
      className="relative flex items-center justify-between gap-2"
      role="group"
      aria-label={`Nhập ${length} chữ số mã xác thực OTP`}
    >
      {/* Hidden input cho autofill one-time-code của iOS/Chrome */}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          left: '-9999px',
        }}
        onChange={(e) => {
          const autoFilled = e.target.value.replace(/\D/g, '');
          if (autoFilled) {
            onChange(autoFilled.slice(0, length));
            focusCell(Math.min(autoFilled.length, length - 1));
          }
          e.target.value = '';
        }}
      />

      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            cellsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          value={digit}
          disabled={disabled}
          aria-label={`Chữ số thứ ${index + 1}`}
          autoFocus={autoFocus && index === 0}
          onChange={(e) => handleCellChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
            if (pasted) handleCellChange(0, pasted);
          }}
          className="w-full h-14 text-center text-xl font-mono font-bold rounded-xl border border-slate-300 bg-slate-50/60 text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      ))}
    </div>
  );
}
