'use client';

import React, { useState } from 'react';

export interface DepartmentWorkloadItem {
  name: string;
  code: string;
  active: number;
  completed: number;
  overdue: number;
  total: number;
  progressPercentage: number;
  isOverloaded?: boolean;
}

export interface WorkloadBarChartProps {
  data: DepartmentWorkloadItem[];
}

export const WorkloadBarChart: React.FC<WorkloadBarChartProps> = ({ data }) => {
  const [hoveredDept, setHoveredDept] = useState<DepartmentWorkloadItem | null>(null);

  if (!data || data.length === 0) {
    return null;
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#475569',
          paddingBottom: 6,
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#16a34a' }} />
          <span>Đã hoàn thành</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#2563eb' }} />
          <span>Đang thực hiện</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#dc2626' }} />
          <span>Chậm tiến độ (Quá hạn)</span>
        </div>
      </div>

      {/* Bars List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.map(dept => {
          const completedWidth = (dept.completed / maxTotal) * 100;
          const activeWidth = (dept.active / maxTotal) * 100;
          const overdueWidth = (dept.overdue / maxTotal) * 100;

          return (
            <div
              key={dept.code}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                padding: '6px 8px',
                borderRadius: 8,
                backgroundColor: hoveredDept?.code === dept.code ? '#f8fafc' : 'transparent',
                transition: 'background-color 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={() => setHoveredDept(dept)}
              onMouseLeave={() => setHoveredDept(null)}
            >
              {/* Department Header info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{dept.name}</span>
                  {dept.isOverloaded && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 4,
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                      }}
                    >
                      ÁP LỰC CAO
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b' }}>
                    Tổng: <strong style={{ color: '#0f172a' }}>{dept.total}</strong> việc
                  </span>
                  <span
                    style={{
                      fontWeight: 800,
                      color: dept.progressPercentage >= 80 ? '#16a34a' : dept.progressPercentage >= 50 ? '#2563eb' : '#d97706',
                    }}
                  >
                    {dept.progressPercentage}%
                  </span>
                </div>
              </div>

              {/* Stacked Progress Bar */}
              <div
                style={{
                  height: 12,
                  width: '100%',
                  backgroundColor: '#f1f5f9',
                  borderRadius: 6,
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                {dept.completed > 0 && (
                  <div
                    style={{
                      width: `${completedWidth}%`,
                      backgroundColor: '#16a34a',
                      height: '100%',
                      transition: 'width 0.4s ease',
                    }}
                    title={`Đã hoàn thành: ${dept.completed}`}
                  />
                )}
                {dept.active > 0 && (
                  <div
                    style={{
                      width: `${activeWidth}%`,
                      backgroundColor: '#2563eb',
                      height: '100%',
                      transition: 'width 0.4s ease',
                    }}
                    title={`Đang thực hiện: ${dept.active}`}
                  />
                )}
                {dept.overdue > 0 && (
                  <div
                    style={{
                      width: `${overdueWidth}%`,
                      backgroundColor: '#dc2626',
                      height: '100%',
                      transition: 'width 0.4s ease',
                    }}
                    title={`Quá hạn: ${dept.overdue}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
