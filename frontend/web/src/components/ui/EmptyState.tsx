'use client';

import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compact ? '24px 16px' : '48px 24px',
        backgroundColor: '#ffffff',
        borderRadius: 10,
        border: '1px dashed #cbd5e1',
        margin: '8px 0',
      }}
    >
      <div
        style={{
          width: compact ? 42 : 56,
          height: compact ? 42 : 56,
          borderRadius: '50%',
          backgroundColor: '#f1f5f9',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? '1.2rem' : '1.6rem',
          marginBottom: 12,
        }}
      >
        {icon || <i className="fa-solid fa-inbox" aria-hidden="true" />}
      </div>
      <h4
        style={{
          fontSize: compact ? '0.92rem' : '1.02rem',
          fontWeight: 700,
          color: '#1e293b',
          margin: 0,
        }}
      >
        {title}
      </h4>
      {description && (
        <p
          style={{
            fontSize: '0.82rem',
            color: '#64748b',
            maxWidth: 420,
            margin: '6px 0 0 0',
            lineHeight: 1.45,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
};
