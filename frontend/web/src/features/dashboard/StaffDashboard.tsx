'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { isTaskActionable, isTaskOpen, isTaskOverdue } from '../../lib/task-workflow';
import { taskLabel } from '../workflow/workflow.service';
import { useAuth } from '../auth/AuthContext';
import { getTasksApi, TaskItemDto } from '../../services/task.service';
import { formatAdministrativeDate, formatDateShort } from '../../lib/formatters';
import { ChartContainer } from '../../components/ui/charts/ChartContainer';
import { TaskCompletionDonut } from '../../components/ui/charts/TaskCompletionDonut';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

interface StaffDashboardProps {
  onOpenTaskDetail?: (taskId: string) => void;
}

export function StaffDashboard({ onOpenTaskDetail }: StaffDashboardProps) {
  const { user } = useAuth();
  const [myTasks, setMyTasks] = useState<TaskItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMyTasks = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await getTasksApi({ page: 1, pageSize: 50 });
      if (res.success && res.data?.items) {
        const items = res.data.items;
        // Lọc công việc được giao cho chuyên viên hiện tại
        const filtered = items.filter(
          t => t.assigneeId === user?.userId
        );
        setMyTasks(filtered);
      }
    } catch (err: any) {
      console.warn('Lỗi tải dữ liệu Staff Dashboard:', err);
      setLoadError(err?.message || 'Không thể kết nối máy chủ dữ liệu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMyTasks();
  }, [user]);

  const activeMyTasks = myTasks.filter(isTaskActionable);
  const pendingMyTasks = myTasks.filter(t => t.status === 'InReview');
  const completedMyTasks = myTasks.filter(t => t.status === 'Completed');
  const overdueMyTasks = myTasks.filter(
    t => isTaskOverdue(t)
  );

  const currentDateText = formatAdministrativeDate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── BANNER NHIỆM VỤ CÁ NHÂN ── */}
      <div
        className="alert alert-info"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderColor: '#93c5fd',
          borderWidth: '1.5px',
          borderRadius: 10,
          padding: '14px 18px',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#2563eb',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '1.1rem',
          }}
        >
          <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
        </div>
        <div style={{ flex: 1, fontSize: '0.88rem', lineHeight: 1.55, color: '#1e3a8a' }}>
          <strong>Lịch làm việc cá nhân ({currentDateText}):</strong> Đồng chí có{' '}
          <strong>{activeMyTasks.length}</strong> nhiệm vụ đang thực hiện, <strong>{pendingMyTasks.length}</strong> việc đã nộp đang chờ thẩm định, và{' '}
          <strong>{overdueMyTasks.length}</strong> việc cần hoàn tất gấp.
        </div>
      </div>

      {/* ── 1. ACTION SUMMARY CARDS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="kpi-label">Việc Đang Triển Khai</div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{activeMyTasks.length}</div>
          <div className="kpi-hint">Đang xử lý trong ca làm việc</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="kpi-label">Đã Nộp (Chờ Phê Duyệt)</div>
          <div className="kpi-value" style={{ color: '#7c3aed' }}>{pendingMyTasks.length}</div>
          <div className="kpi-hint">Báo cáo kết quả công việc đã gửi</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="kpi-label">Nhiệm Vụ Chậm Tiến Độ</div>
          <div className="kpi-value" style={{ color: overdueMyTasks.length > 0 ? '#dc2626' : '#16a34a' }}>
            {overdueMyTasks.length}
          </div>
          <div className="kpi-hint">
            {overdueMyTasks.length > 0 ? 'Ưu tiên nộp kết quả ngay' : '100% đúng tiến độ quy định'}
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="kpi-label">Đã Hoàn Thành Nghiệm Thu</div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{completedMyTasks.length}</div>
          <div className="kpi-hint">Đã được người nghiệm thu xác nhận</div>
        </div>
      </div>

      {/* ── 2. DATA VISUALIZATION: TIẾN ĐỘ CÁ NHÂN & BẢNG VIỆC CẦN XỬ LÝ ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 18,
        }}
      >
        {/* Biểu đồ tròn tiến độ cá nhân */}
        <ChartContainer
          title="Tỷ Lệ Hoàn Thành Nhiệm Vụ Cá Nhân"
          subtitle="Cơ cấu tình trạng các công việc được lãnh đạo phân công"
          icon={<i className="fa-solid fa-chart-pie" aria-hidden="true" />}
          isLoading={isLoading}
          isEmpty={myTasks.length === 0}
          emptyTitle="Chưa có nhiệm vụ nào"
          emptyDescription="Đồng chí hiện chưa được phân công nhiệm vụ mới."
          error={loadError}
          onRetry={loadMyTasks}
        >
          <TaskCompletionDonut
            completed={completedMyTasks.length}
            inProgress={activeMyTasks.length}
            pendingReview={pendingMyTasks.length}
            overdue={overdueMyTasks.length}
            cancelled={myTasks.filter(t => t.status === 'Cancelled').length}
          />
        </ChartContainer>

        {/* Khối Điểm thi đua GRAD cá nhân */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="card-header"
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fafcff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a' }}>
              <i className="fa-solid fa-medal" style={{ color: '#d97706' }} aria-hidden="true" />
              <span>Đánh giá thi đua cá nhân</span>
            </div>
            <Link href="/evaluation" style={{ textDecoration: 'none' }}>
              <Button size="sm" variant="outline">
                Xem Bảng Điểm
              </Button>
            </Link>
          </div>

          <div style={{ padding: 20 }}><p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>Xem kết quả đánh giá theo kỳ và bằng chứng công việc tại Đánh giá thi đua.</p></div>
        </div>
      </div>

      {/* ── 3. BẢNG DANH SÁCH CÔNG VIỆC CẦN LÀM HÔM NAY ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="card-header"
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a' }}>
            <i className="fa-solid fa-list-check" style={{ color: '#2563eb' }} aria-hidden="true" />
            <span>Danh Sách Công Việc Được Phân Công ({myTasks.length})</span>
          </div>
          <Link href="/workcenter" style={{ textDecoration: 'none' }}>
            <Button size="sm" variant="outline">
              Vào Không Gian Giao Việc &rarr;
            </Button>
          </Link>
        </div>

        <div style={{ padding: 0, overflowX: 'auto' }}>
          {myTasks.length === 0 ? (
            <EmptyState compact title="Không có công việc cần làm" description="Đồng chí đã hoàn tất toàn bộ nhiệm vụ được giao." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '40%' }}>Tên nhiệm vụ</th>
                  <th scope="col" style={{ width: '20%', textAlign: 'center' }}>Người giao việc</th>
                  <th scope="col" style={{ width: '20%', textAlign: 'center' }}>Hạn chót</th>
                  <th scope="col" style={{ width: '20%', textAlign: 'center' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {myTasks.slice(0, 5).map(task => {
                  const isDone = task.status === 'Completed';
                  const isPending = task.status === 'InReview';
                  const isOver = isTaskOverdue(task);

                  return (
                    <tr
                      key={task.id}
                      style={{ cursor: onOpenTaskDetail ? 'pointer' : 'default' }}
                      onClick={() => onOpenTaskDetail && onOpenTaskDetail(task.id)}
                    >
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div
                            style={{
                              fontSize: '0.76rem',
                              color: '#64748b',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 340,
                            }}
                          >
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>
                        {task.assignerName || 'Lãnh đạo'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge variant={isOver ? 'danger' : 'neutral'} size="sm">
                          {formatDateShort(task.dueDate)}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge variant={isDone ? 'success' : isPending ? 'warning' : 'info'} size="sm" dot>{taskLabel(task)}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
