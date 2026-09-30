'use client';

import React, { useState } from 'react';
import { taskStatusDistribution } from '../../../lib/task-workflow';

export interface DonutSegment {
  label: string;
  count: number;
  color: string;
  percentage: number;
}

export interface TaskCompletionDonutProps {
  completed: number;
  inProgress: number;
  pendingReview: number;
  overdue: number;
  cancelled?: number;
}

export const TaskCompletionDonut: React.FC<TaskCompletionDonutProps> = ({
  completed,
  inProgress,
  pendingReview,
  overdue,
  cancelled = 0,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const counts = taskStatusDistribution({ completed, active: inProgress, pendingReview, overdue, cancelled });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return null;
  }

  const completionRate = Math.round((completed / total) * 100);

  const segments: DonutSegment[] = [
    { label: 'Đã nghiệm thu', count: completed, color: '#16a34a', percentage: Math.round((completed / total) * 100) },
    { label: 'Cần xử lý', count: counts.active, color: '#2563eb', percentage: Math.round((counts.active / total) * 100) },
    { label: 'Chờ nghiệm thu', count: pendingReview, color: '#7c3aed', percentage: Math.round((pendingReview / total) * 100) },
    { label: 'Chậm tiến độ (Quá hạn)', count: overdue, color: '#dc2626', percentage: Math.round((overdue / total) * 100) },
    { label: 'Đã hủy', count: cancelled, color: '#64748b', percentage: Math.round((cancelled / total) * 100) },
  ].filter(s => s.count > 0);

  // SVG Donut geometry
  const radius = 64;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        flexWrap: 'wrap',
        padding: '10px 0',
      }}
    >
      {/* SVG Donut Circle */}
      <div style={{ position: 'relative', width: 170, height: 170, flexShrink: 0 }}>
        <svg width="170" height="170" viewBox="0 0 170 170" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background track */}
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Segments */}
          {segments.map((segment, index) => {
            const strokeDasharray = `${(segment.count / total) * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedOffset;
            accumulatedOffset += (segment.count / total) * circumference;

            const isHovered = hoveredIndex === index;

            return (
              <circle
                key={segment.label}
                cx="85"
                cy="85"
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: 'all 0.25s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center Text inside Donut */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.1,
            }}
          >
            {completionRate}%
          </span>
          <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
            HOÀN THÀNH
          </span>
        </div>
      </div>

      {/* Legend & Breakdown List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200, flex: 1 }}>
        {segments.map((seg, idx) => (
          <div
            key={seg.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: '0.82rem',
              padding: '4px 8px',
              borderRadius: 6,
              backgroundColor: hoveredIndex === idx ? '#f8fafc' : 'transparent',
              transition: 'background-color 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: seg.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#334155', fontWeight: 600 }}>{seg.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <strong style={{ color: '#0f172a' }}>{seg.count}</strong>
              <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>({seg.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
