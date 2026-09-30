'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { isTaskActionable, isTaskOpen, isTaskOverdue } from '../../lib/task-workflow';
import { useAuth } from '../auth/AuthContext';
import { getNotifications, NotificationItem } from '../../services/notification.service';
import { getTasksApi, TaskItemDto } from '../../services/task.service';
import { getInboxDocumentsApi, InboxDocumentDto } from '../../services/inbox.service';
import { getOutgoingDocumentsApi, OutgoingDocumentDto } from '../../services/outgoing-document.service';
import { formatAdministrativeDate, formatDateShort, formatDateTimeShort } from '../../lib/formatters';
import { ChartContainer } from '../../components/ui/charts/ChartContainer';
import { WorkloadBarChart, DepartmentWorkloadItem } from '../../components/ui/charts/WorkloadBarChart';
import { TaskCompletionDonut } from '../../components/ui/charts/TaskCompletionDonut';
import { DocumentFlowChart } from '../../components/ui/charts/DocumentFlowChart';
import { DeadlineDistributionBar } from '../../components/ui/charts/DeadlineDistributionBar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export function ExecutiveDashboard() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [inboxDocs, setInboxDocs] = useState<InboxDocumentDto[]>([]);
  const [outgoingDocs, setOutgoingDocs] = useState<OutgoingDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [notifRes, taskRes, inboxRes, outRes] = await Promise.all([
        getNotifications(),
        getTasksApi({ page: 1, pageSize: 200 }),
        getInboxDocumentsApi({ page: 1, pageSize: 100 }),
        getOutgoingDocumentsApi({ page: 1, pageSize: 100 }),
      ]);

      if (Array.isArray(notifRes)) setNotifications(notifRes);
      if (taskRes.success && taskRes.data?.items) setTasks(taskRes.data.items);
      if (inboxRes.success && inboxRes.data?.items) setInboxDocs(inboxRes.data.items);
      if (outRes.success && outRes.data?.items) setOutgoingDocs(outRes.data.items);
    } catch (err: any) {
      console.warn('Lỗi tải dữ liệu Executive Dashboard:', err);
      setLoadError(err?.message || 'Không thể kết nối máy chủ dữ liệu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. Task Metrics (Real data calculation)
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const inProgressTasks = tasks.filter(isTaskActionable).length;
  const pendingReviewTasks = tasks.filter(t => t.status === 'InReview').length;
  const overdueTasks = tasks.filter(
    t => isTaskOverdue(t)
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 2. Document Metrics (Real data calculation)
  const urgentInboxCount = inboxDocs.filter(d => d.isUrgent).length;
  const pendingOutgoingCount = outgoingDocs.filter(d => d.status === 'PendingSignature').length;
  const issuedOutgoingCount = outgoingDocs.filter(d => d.status === 'Sent').length;
  const pendingAssignmentInbox = inboxDocs.filter(d => !d.isScheduled && !d.scheduledTaskId).length;

  // 3. Department Workload Breakdown (Real data calculation for 5 departments)
  const departmentsWorkload: DepartmentWorkloadItem[] = useMemo(() => {
    const DEPARTMENTS = [
      { name: 'Văn phòng HĐND & UBND', code: 'VAN_PHONG', keywords: ['văn phòng', 'hđnd', 'ubnd', 'vp_ubnd', 'van_phong', 'văn thư'] },
      { name: 'Phòng Kinh tế - Hạ tầng & Đô thị', code: 'KINH_TE', keywords: ['kinh tế', 'địa chính', 'hạ tầng', 'đô thị', 'kinh_te', 'đất đai'] },
      { name: 'Phòng Văn hóa - Xã hội', code: 'VAN_HOA_XA_HOI', keywords: ['văn hóa', 'xã hội', 'van_hoa', 'y tế', 'giáo dục'] },
      { name: 'Trung tâm Phục vụ Hành chính công', code: 'HANH_CHINH_CONG', keywords: ['hành chính công', 'một cửa', 'tthc', 'hanh_chinh_cong'] },
      { name: 'Khối Đảng - HĐND - UBMTTQ', code: 'KHOI_DANG_DOAN_THE', keywords: ['đảng', 'đảng ủy', 'mặt trận', 'ubmttq', 'đoàn thể'] },
    ];

    return DEPARTMENTS.map(dept => {
      const deptTasks = tasks.filter(t => {
        const dName = (t.departmentName || '').toLowerCase();
        const aName = (t.assigneeName || '').toLowerCase();
        return dept.keywords.some(kw => dName.includes(kw) || aName.includes(kw));
      });

      const active = deptTasks.filter(isTaskActionable).length;
      const completed = deptTasks.filter(t => t.status === 'Completed').length;
      const overdue = deptTasks.filter(
        t => isTaskOverdue(t)
      ).length;
      const total = deptTasks.length;
      const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        name: dept.name,
        code: dept.code,
        active: Math.max(0, active - overdue),
        completed,
        overdue,
        total,
        progressPercentage,
        isOverloaded: active >= 8,
      };
    });
  }, [tasks]);

  // 4. Deadline & Priority Distribution Breakdown
  const deadlineDistributionData = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    let dueToday = 0;
    let dueWithin3Days = 0;
    let dueThisWeek = 0;
    let overdue = 0;
    let urgentPriority = 0;
    let highPriority = 0;
    let normalPriority = 0;

    tasks.forEach(t => {
      if (!isTaskActionable(t)) return;

      const prio = (t.priority || '').toLowerCase();
      if (prio === 'urgent' || prio === 'khẩn cấp' || prio === 'khan_cap') urgentPriority++;
      else if (prio === 'high' || prio === 'cao') highPriority++;
      else normalPriority++;

      if (t.dueDate) {
        const dueTime = new Date(t.dueDate).getTime();
        const diffMs = dueTime - now;

        if (diffMs < 0) {
          overdue++;
        } else if (formatDateShort(t.dueDate) === formatDateShort(new Date(now))) {
          dueToday++;
        } else if (diffMs <= 3 * oneDayMs) {
          dueWithin3Days++;
        } else if (diffMs <= 7 * oneDayMs) {
          dueThisWeek++;
        }
      }
    });

    return {
      dueToday,
      dueWithin3Days,
      dueThisWeek,
      overdue,
      urgentPriority,
      highPriority,
      normalPriority,
    };
  }, [tasks]);

  // 5. Document Flow Data
  const documentFlowData = useMemo(() => {
    return {
      incomingTotal: inboxDocs.length,
      incomingUrgent: urgentInboxCount,
      incomingPendingAssignment: pendingAssignmentInbox,
      outgoingTotal: outgoingDocs.length,
      outgoingPendingSignature: pendingOutgoingCount,
      outgoingIssued: issuedOutgoingCount,
    };
  }, [inboxDocs, outgoingDocs, urgentInboxCount, pendingAssignmentInbox, pendingOutgoingCount, issuedOutgoingCount]);

  const currentDateText = formatAdministrativeDate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── CẢNH BÁO TRỌNG ĐIỂM CHỈ ĐẠO ĐIỀU HÀNH ── */}
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
          <i className="fa-solid fa-gauge-high" aria-hidden="true" />
        </div>
        <div style={{ flex: 1, fontSize: '0.88rem', lineHeight: 1.55, color: '#1e3a8a' }}>
          <strong>Trung tâm Chỉ đạo Điều hành UBND Xã ({currentDateText}):</strong> Toàn xã đang theo dõi{' '}
          <strong>{totalTasks}</strong> nhiệm vụ (trong đó <strong>{inProgressTasks}</strong> việc đang triển khai,{' '}
          <strong>{pendingReviewTasks}</strong> việc chờ thẩm định duyệt, <strong>{overdueTasks}</strong> việc chậm tiến độ),{' '}
          <strong>{urgentInboxCount}</strong> văn bản khẩn đến, và <strong>{pendingOutgoingCount}</strong> văn bản đi chờ ký số ban hành.
        </div>
      </div>

      {/* ── 1. KPI EXECUTIVE CARDS (HÀNG THẺ CHỈ SỐ ĐIỀU HÀNH) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 16,
        }}
      >
        <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="kpi-label">Công Việc Đang Thực Thi</div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{inProgressTasks}</div>
          <div className="kpi-hint">Trên tổng số {totalTasks} nhiệm vụ toàn cơ quan</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="kpi-label">Tỷ Lệ Đã Nghiệm Thu</div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{completionRate}%</div>
          <div className="kpi-hint">Đã nghiệm thu đạt chuẩn {completedTasks} nhiệm vụ</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="kpi-label">Nhiệm Vụ Chậm Tiến Độ</div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>{overdueTasks}</div>
          <div className="kpi-hint">Cần Lãnh đạo UBND đôn đốc khẩn</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="kpi-label">Hồ Sơ Chờ Phê Duyệt</div>
          <div className="kpi-value" style={{ color: '#7c3aed' }}>{pendingReviewTasks + pendingOutgoingCount}</div>
          <div className="kpi-hint">Bao gồm {pendingReviewTasks} báo cáo việc và {pendingOutgoingCount} văn bản đi</div>
        </div>
      </div>

      {/* ── 2. DATA VISUALIZATION HÀNG 1: KHỐI LƯỢNG 5 PHÒNG BAN & TIẾN ĐỘ HOÀN THÀNH ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 18,
        }}
      >
        {/* Biểu đồ Cột khối lượng 5 Phòng ban */}
        <ChartContainer
          title="Khối Lượng Công Việc 5 Phòng Ban"
          subtitle="Tỷ lệ phân bổ và tình trạng xử lý nhiệm vụ theo đơn vị chuyên môn"
          icon={<i className="fa-solid fa-chart-column" aria-hidden="true" />}
          isLoading={isLoading}
          isEmpty={tasks.length === 0}
          emptyTitle="Chưa có dữ liệu nhiệm vụ phòng ban"
          emptyDescription="Chưa có nhiệm vụ nào được phân công cho các phòng ban trong hệ thống."
          error={loadError}
          onRetry={loadData}
        >
          <WorkloadBarChart data={departmentsWorkload} />
        </ChartContainer>

        {/* Biểu đồ Donut Hoàn thành đúng hạn */}
        <ChartContainer
          title="Cơ Cấu Trạng Thái Hoàn Thành"
          subtitle="Phân bố trạng thái công việc đã lưu trong hệ thống"
          icon={<i className="fa-solid fa-chart-pie" aria-hidden="true" />}
          isLoading={isLoading}
          isEmpty={tasks.length === 0}
          emptyTitle="Chưa có dữ liệu trạng thái"
          emptyDescription="Chưa ghi nhận dữ liệu hoàn thành công việc để trực quan hóa."
          error={loadError}
          onRetry={loadData}
        >
          <TaskCompletionDonut
            completed={completedTasks}
            inProgress={inProgressTasks}
            pendingReview={pendingReviewTasks}
            overdue={overdueTasks}
            cancelled={tasks.filter(t => t.status === 'Cancelled').length}
          />
        </ChartContainer>
      </div>

      {/* ── 3. DATA VISUALIZATION HÀNG 2: PHÂN LUỒNG VĂN BẢN & MỐC HẠN CHÓT ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 18,
        }}
      >
        {/* Biểu đồ Luồng Văn bản Đến & Đi */}
        <ChartContainer
          title="Luồng Phân Phối Văn Bản Hành Chính"
          subtitle="Tỷ lệ văn bản đến/đi, văn bản khẩn và trạng thái ký số ban hành"
          icon={<i className="fa-solid fa-envelope-open-text" aria-hidden="true" />}
          isLoading={isLoading}
          isEmpty={inboxDocs.length === 0 && outgoingDocs.length === 0}
          emptyTitle="Chưa có dữ liệu văn bản"
          emptyDescription="Hệ thống chưa tiếp nhận hoặc ban hành văn bản nào."
          error={loadError}
          onRetry={loadData}
        >
          <DocumentFlowChart data={documentFlowData} />
        </ChartContainer>

        {/* Biểu đồ Phân bổ Hạn chót & Mức độ ưu tiên */}
        <ChartContainer
          title="Phân Bố Hạn Chót & Mức Độ Ưu Tiên"
          subtitle="Thống kê các mốc hạn xử lý và phân loại mức độ khẩn cấp"
          icon={<i className="fa-solid fa-hourglass-half" aria-hidden="true" />}
          isLoading={isLoading}
          isEmpty={tasks.length === 0}
          emptyTitle="Chưa có hạn chót nhiệm vụ"
          emptyDescription="Không có nhiệm vụ nào đang trong diện theo dõi hạn chót."
          error={loadError}
          onRetry={loadData}
        >
          <DeadlineDistributionBar data={deadlineDistributionData} />
        </ChartContainer>
      </div>

      {/* ── 4. BẢNG THEO DÕI CÔNG VIỆC KHẨN CẤP & VĂN BẢN ĐẾN CẦN CHỈ ĐẠO ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: 18,
        }}
      >
        {/* Bảng Văn bản Khẩn đến */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="card-header"
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fff5f5',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontWeight: 800 }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>Văn Bản Đến Khẩn Cần Chỉ Đạo ({urgentInboxCount})</span>
            </div>
            <Link
              href="/documents"
              style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 700, textDecoration: 'none' }}
            >
              Xem tất cả &rarr;
            </Link>
          </div>

          <div style={{ padding: 0, overflowX: 'auto' }}>
            {inboxDocs.filter(d => d.isUrgent).length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', marginRight: 6 }} aria-hidden="true" />
                Hiện không có văn bản khẩn nào cần xử lý gấp.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '25%', textAlign: 'center' }}>Số hiệu</th>
                    <th scope="col" style={{ width: '45%' }}>Trích yếu nội dung</th>
                    <th scope="col" style={{ width: '30%', textAlign: 'center' }}>Ngày tiếp nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxDocs
                    .filter(d => d.isUrgent)
                    .slice(0, 4)
                    .map(doc => (
                      <tr key={doc.id}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>
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

        {/* Bảng Nhiệm vụ trọng tâm cần đôn đốc */}
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
              <i className="fa-solid fa-list-check" aria-hidden="true" />
              <span>Nhiệm Vụ Trọng Tâm Cần Đôn Đốc</span>
            </div>
            <Link
              href="/workcenter"
              style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
            >
              Xem tất cả &rarr;
            </Link>
          </div>

          <div style={{ padding: 0, overflowX: 'auto' }}>
            {tasks.filter(isTaskOpen).length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', marginRight: 6 }} aria-hidden="true" />
                Tất cả nhiệm vụ trọng tâm đã được hoàn thành.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '45%' }}>Nhiệm vụ</th>
                    <th scope="col" style={{ width: '25%', textAlign: 'center' }}>Cán bộ thực hiện</th>
                    <th scope="col" style={{ width: '30%', textAlign: 'center' }}>Hạn chót</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks
                    .filter(isTaskOpen)
                    .slice(0, 4)
                    .map(t => {
                      const isOver = t.dueDate && new Date(t.dueDate).getTime() < Date.now();
                      return (
                        <tr key={t.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              {t.departmentName || 'UBND Xã'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>
                            {t.assigneeName || 'Chuyên viên'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Badge variant={isOver ? 'danger' : 'warning'} size="sm">
                              {formatDateShort(t.dueDate)}
                            </Badge>
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
    </div>
  );
}
