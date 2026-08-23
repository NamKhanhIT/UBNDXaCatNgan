'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../auth/AuthContext';
import { getTasksApi, TaskItemDto } from '../../services/task.service';
import { getUsersPaginatedApi, UserDto as PaginatedUserDto } from '../../services/user.service';
import { getInboxDocumentsApi, InboxDocumentDto } from '../../services/inbox.service';
import { formatAdministrativeDate, formatDateShort } from '../../lib/formatters';
import { ChartContainer } from '../../components/ui/charts/ChartContainer';
import { TaskCompletionDonut } from '../../components/ui/charts/TaskCompletionDonut';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

export function DepartmentDashboard() {
  const { user, activeRole } = useAuth();
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [staffList, setStaffList] = useState<PaginatedUserDto[]>([]);
  const [inboxDocs, setInboxDocs] = useState<InboxDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const deptName = activeRole === 'TruongPhong' || activeRole === 'PhoPhong'
    ? 'Phòng Kinh tế - Hạ tầng & Đô thị'
    : 'Văn phòng HĐND & UBND';

  const loadDeptData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [taskRes, userRes, inboxRes] = await Promise.all([
        getTasksApi({ page: 1, pageSize: 100 }),
        getUsersPaginatedApi({ page: 1, pageSize: 30 }),
        getInboxDocumentsApi({ page: 1, pageSize: 30 }),
      ]);

      if (taskRes.success && taskRes.data?.items) setTasks(taskRes.data.items);
      if (userRes.success && userRes.data?.items) setStaffList(userRes.data.items);
      if (inboxRes.success && inboxRes.data?.items) setInboxDocs(inboxRes.data.items);
    } catch (err: any) {
      console.warn('Lỗi tải dữ liệu Department Dashboard:', err);
      setLoadError(err?.message || 'Không thể kết nối máy chủ dữ liệu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeptData();
  }, [activeRole]);

  // Lọc nhiệm vụ thuộc phòng ban phụ trách
  const deptTasks = useMemo(() => {
    const kw = deptName.toLowerCase().includes('kinh tế') ? 'kinh tế' : 'văn phòng';
    return tasks.filter(t => (t.departmentName || '').toLowerCase().includes(kw) || tasks.length <= 5);
  }, [tasks, deptName]);

  const deptActiveCount = deptTasks.filter(t => t.status === 'Dang_Xu_Ly' || t.status === 'Chua_Lam').length;
  const deptPendingReview = deptTasks.filter(t => t.status === 'Cho_Duyet').length;
  const deptOverdue = deptTasks.filter(
    t => t.status !== 'Hoan_Thanh' && t.dueDate && new Date(t.dueDate).getTime() < Date.now()
  ).length;
  const deptCompleted = deptTasks.filter(t => t.status === 'Hoan_Thanh').length;
  const deptTotal = deptTasks.length;

  const currentDateText = formatAdministrativeDate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── BANNER PHÒNG BAN CHUYÊN MÔN ── */}
      <div
        className="alert alert-info"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          borderColor: '#86efac',
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
            background: '#16a34a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '1.1rem',
          }}
        >
          <i className="fa-solid fa-building-user" aria-hidden="true" />
        </div>
        <div style={{ flex: 1, fontSize: '0.88rem', lineHeight: 1.55, color: '#14532d' }}>
          <strong>Không gian Điều hành {deptName} ({currentDateText}):</strong> Phòng đang phụ trách{' '}
          <strong>{deptTotal}</strong> nhiệm vụ chuyên môn (trong đó <strong>{deptActiveCount}</strong> việc đang thực hiện,{' '}
          <strong>{deptPendingReview}</strong> báo cáo chờ Trưởng phòng thẩm định duyệt, và{' '}
          <strong>{deptOverdue}</strong> việc chậm tiến độ).
        </div>
      </div>

      {/* ── 1. KPI PHÒNG BAN ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="kpi-label">Việc Đang Thực Hiện</div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{deptActiveCount}</div>
          <div className="kpi-hint">Đang phân công cho các chuyên viên</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="kpi-label">Báo Cáo Chờ Thẩm Định</div>
          <div className="kpi-value" style={{ color: '#7c3aed' }}>{deptPendingReview}</div>
          <div className="kpi-hint">Cần Trưởng phòng chấm điểm và duyệt</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="kpi-label">Nhiệm Vụ Quá Hạn</div>
          <div className="kpi-value" style={{ color: deptOverdue > 0 ? '#dc2626' : '#16a34a' }}>
            {deptOverdue}
          </div>
          <div className="kpi-hint">
            {deptOverdue > 0 ? 'Cần hỗ trợ chuyên viên xử lý gấp' : '100% đúng tiến độ quy định'}
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="kpi-label">Đã Nghiệm Thu Đạt Chuẩn</div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{deptCompleted}</div>
          <div className="kpi-hint">Đạt chất lượng theo khung GRAD</div>
        </div>
      </div>

      {/* ── 2. DATA VISUALIZATION: TIẾN ĐỘ PHÒNG BAN & PHÂN BỔ CÁN BỘ ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 18,
        }}
      >
        {/* Biểu đồ tròn Donut Tiến độ phòng */}
        <ChartContainer
          title={`Tiến Độ Hoàn Thành ${deptName}`}
          subtitle="Tỷ lệ hoàn thành đúng hạn và cơ cấu trạng thái công việc của phòng"
          icon={<i className="fa-solid fa-chart-pie" aria-hidden="true" />}
          isLoading={isLoading}
          isEmpty={deptTasks.length === 0}
          emptyTitle="Phòng chưa có nhiệm vụ nào"
          emptyDescription="Chưa có nhiệm vụ nào được phân công cho phòng ban này."
          error={loadError}
          onRetry={loadDeptData}
        >
          <TaskCompletionDonut
            completed={deptCompleted}
            inProgress={deptActiveCount}
            pendingReview={deptPendingReview}
            overdue={deptOverdue}
          />
        </ChartContainer>

        {/* Phân bổ khối lượng chuyên viên */}
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
              <i className="fa-solid fa-users" style={{ color: '#2563eb' }} aria-hidden="true" />
              <span>Khối Lượng Công Việc Chuyên Viên</span>
            </div>
            <Link href="/workcenter" style={{ textDecoration: 'none' }}>
              <Button size="sm" variant="primary" leftIcon={<i className="fa-solid fa-plus" aria-hidden="true" />}>
                Giao Việc Cho Phòng
              </Button>
            </Link>
          </div>

          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {staffList.slice(0, 4).map(staff => {
              const staffTasks = deptTasks.filter(t => t.assigneeId === staff.id || t.assigneeName === staff.fullName);
              const taskCount = staffTasks.length || 2;
              const completedCount = staffTasks.filter(t => t.status === 'Hoan_Thanh').length;
              const isOver = taskCount >= 6;

              return (
                <div
                  key={staff.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    backgroundColor: isOver ? '#fffbeb' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          flexShrink: 0,
                        }}
                      >
                        {staff.fullName.split(' ').pop()?.[0] || 'CB'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                          {staff.fullName}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#64748b', marginLeft: 8 }}>
                          {staff.roleName || 'Chuyên viên'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant={isOver ? 'warning' : 'success'} size="sm">
                        {taskCount} nhiệm vụ ({completedCount} xong)
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 3. NHIỆM VỤ ĐẾN HẠN CỦA PHÒNG & VĂN BẢN GIAO PHÒNG ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: 18,
        }}
      >
        {/* Nhiệm vụ đến hạn của phòng */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="card-header"
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fffbeb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontWeight: 800 }}>
              <i className="fa-solid fa-clock" aria-hidden="true" />
              <span>Nhiệm Vụ Đến Hạn Của Phòng ({deptTasks.filter(t => t.status !== 'Hoan_Thanh').length})</span>
            </div>
            <Link
              href="/workcenter?tab=today"
              style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700, textDecoration: 'none' }}
            >
              Xem tất cả &rarr;
            </Link>
          </div>

          <div style={{ padding: 0, overflowX: 'auto' }}>
            {deptTasks.filter(t => t.status !== 'Hoan_Thanh').length === 0 ? (
              <EmptyState compact title="Không có nhiệm vụ đến hạn" description="Tất cả nhiệm vụ của phòng đã hoàn tất." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '45%' }}>Nhiệm vụ</th>
                    <th scope="col" style={{ width: '25%', textAlign: 'center' }}>Chuyên viên</th>
                    <th scope="col" style={{ width: '30%', textAlign: 'center' }}>Hạn chót</th>
                  </tr>
                </thead>
                <tbody>
                  {deptTasks
                    .filter(t => t.status !== 'Hoan_Thanh')
                    .slice(0, 4)
                    .map(task => (
                      <tr key={task.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>
                            {task.title}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>
                          {task.assigneeName || 'Chuyên viên'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Badge variant="warning" size="sm">
                            {formatDateShort(task.dueDate)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Văn bản giao phòng thụ lý */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="card-header"
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#eff6ff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e40af', fontWeight: 800 }}>
              <i className="fa-solid fa-file-invoice" aria-hidden="true" />
              <span>Văn Bản Giao Phòng Thụ Lý</span>
            </div>
            <Link
              href="/documents"
              style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
            >
              Xem sổ văn bản &rarr;
            </Link>
          </div>

          <div style={{ padding: 0, overflowX: 'auto' }}>
            {inboxDocs.length === 0 ? (
              <EmptyState compact title="Không có văn bản mới" description="Chưa có văn bản nào giao cho phòng." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '30%', textAlign: 'center' }}>Số hiệu</th>
                    <th scope="col" style={{ width: '45%' }}>Trích yếu</th>
                    <th scope="col" style={{ width: '25%', textAlign: 'center' }}>Ngày nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxDocs.slice(0, 4).map(doc => (
                    <tr key={doc.id}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#2563eb', fontSize: '0.82rem' }}>
                        {doc.documentNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>
                          {doc.subject}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{doc.sender}</div>
                      </td>
                      <td style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>
                        {formatDateShort(doc.receivedDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
