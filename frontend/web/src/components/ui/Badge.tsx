'use client';

import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon,
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = (): { bg: string; text: string; border: string; dotColor: string } => {
    switch (variant) {
      case 'success':
        return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dotColor: '#16a34a' };
      case 'warning':
        return { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dotColor: '#d97706' };
      case 'danger':
        return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dotColor: '#dc2626' };
      case 'info':
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dotColor: '#2563eb' };
      case 'purple':
        return { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', dotColor: '#7c3aed' };
      case 'neutral':
      default:
        return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', dotColor: '#94a3b8' };
    }
  };

  const vStyles = getVariantStyles();

  const isSmall = size === 'sm';

  return (
    <span
      className={`badge-ui-standard ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? 4 : 6,
        padding: isSmall ? '2px 6px' : '3px 9px',
        fontSize: isSmall ? '0.72rem' : '0.78rem',
        fontWeight: 700,
        borderRadius: 6,
        backgroundColor: vStyles.bg,
        color: vStyles.text,
        border: `1px solid ${vStyles.border}`,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: isSmall ? 5 : 6,
            height: isSmall ? 5 : 6,
            borderRadius: '50%',
            backgroundColor: vStyles.dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
