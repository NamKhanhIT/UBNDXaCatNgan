'use client';

import React from 'react';
import { EmptyState } from '../EmptyState';
import { Skeleton } from '../LoadingSkeleton';

export interface ChartContainerProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  icon,
  action,
  isLoading = false,
  isEmpty = false,
  emptyTitle = 'Chưa có dữ liệu thống kê',
  emptyDescription = 'Hệ thống chưa ghi nhận dữ liệu trong chu kỳ này.',
  error,
  onRetry,
  children,
  style,
  className = '',
}) => {
  return (
    <div
      className={`card chart-container ${className}`}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Chart Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          backgroundColor: '#fafcff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.95rem',
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <h4
              style={{
                fontSize: '0.96rem',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {title}
            </h4>
            {subtitle && (
              <p
                style={{
                  fontSize: '0.78rem',
                  color: '#64748b',
                  margin: '2px 0 0 0',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Chart Content Area */}
      <div
        style={{
          padding: '18px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 200,
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 0' }}>
            <Skeleton height={20} width="60%" />
            <Skeleton height={140} />
            <div style={{ display: 'flex', gap: 10 }}>
              <Skeleton height={16} width="30%" />
              <Skeleton height={16} width="30%" />
              <Skeleton height={16} width="30%" />
            </div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <div style={{ color: '#dc2626', fontSize: '1.8rem', marginBottom: 8 }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            </div>
            <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.92rem' }}>
              Không thể tải dữ liệu biểu đồ
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>{error}</div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  marginTop: 12,
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                Thử lại
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <EmptyState compact title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </div>
    </div>
  );
};
