'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#dc2626',
          color: '#ffffff',
          border: '1px solid #dc2626',
          boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
        };
      case 'secondary':
        return {
          backgroundColor: '#f1f5f9',
          color: '#334155',
          border: '1px solid #cbd5e1',
        };
      case 'outline':
        return {
          backgroundColor: '#ffffff',
          color: '#0f172a',
          border: '1px solid #cbd5e1',
        };
      case 'danger':
        return {
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          border: '1px solid #fecaca',
        };
      case 'success':
        return {
          backgroundColor: '#16a34a',
          color: '#ffffff',
          border: '1px solid #16a34a',
          boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#475569',
          border: '1px solid transparent',
        };
      default:
        return {};
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '5px 12px',
          fontSize: '0.78rem',
          height: '32px',
        };
      case 'lg':
        return {
          padding: '10px 24px',
          fontSize: '0.94rem',
          height: '44px',
        };
      case 'md':
      default:
        return {
          padding: '8px 16px',
          fontSize: '0.86rem',
          height: '38px',
        };
    }
  };

  return (
    <button
      className={`btn-ui-standard ${className}`}
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 8,
        fontWeight: 700,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.65 : 1,
        transition: 'all 0.15s ease-in-out',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {isLoading ? (
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '0.9em' }} aria-hidden="true" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
