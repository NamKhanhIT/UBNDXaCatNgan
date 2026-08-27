// Design Tokens & Quy chuẩn giao diện hành chính công vụ UBND Cấp Xã
export const DESIGN_TOKENS = {
  colors: {
    // Primary Red - Quốc kỳ & Hành chính
    primary: '#dc2626',
    primaryHover: '#b91c1c',
    primaryBg: '#fef2f2',
    primaryBorder: '#fecaca',

    // Secondary & Slate
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    border: '#e2e8f0',
    borderSubtle: '#f1f5f9',
    bgPrimary: '#f8fafc',
    bgCard: '#ffffff',
    bgHover: '#f8fafc',

    // Trạng thái nghiệp vụ
    success: '#16a34a',
    successBg: '#f0fdf4',
    successBorder: '#bbf7d0',
    successText: '#15803d',

    warning: '#d97706',
    warningBg: '#fffbeb',
    warningBorder: '#fde68a',
    warningText: '#b45309',

    danger: '#dc2626',
    dangerBg: '#fef2f2',
    dangerBorder: '#fecaca',
    dangerText: '#b91c1c',

    info: '#2563eb',
    infoBg: '#eff6ff',
    infoBorder: '#bfdbfe',
    infoText: '#1d4ed8',

    purple: '#7c3aed',
    purpleBg: '#f5f3ff',
    purpleBorder: '#ddd6fe',
    purpleText: '#6d28d9',
  },

  radii: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
  },

  typography: {
    fontFamily: "'Noto Sans', system-ui, -apple-system, sans-serif",
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.84rem',    // 13.5px
      base: '0.92rem',  // 14.7px
      md: '1.0rem',     // 16px
      lg: '1.15rem',    // 18.4px
      xl: '1.35rem',    // 21.6px
      '2xl': '1.65rem', // 26.4px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },

  breakpoints: {
    mobile: '375px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1280px',
  },
};
