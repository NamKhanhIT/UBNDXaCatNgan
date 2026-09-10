'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import { getTasksApi, getTaskDetailApi, TaskItemDto } from '../../services/task.service';
import { getInboxDocumentsApi, InboxDocumentDto } from '../../services/inbox.service';
import { getOutgoingDocumentsApi, OutgoingDocumentDto } from '../../services/outgoing-document.service';
import { useToast } from '../../components/ui/ToastContext';
import { formatDateShort } from '../../lib/formatters';
import { useSignalREvent } from '../../hooks/use-signalr';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { CreateTaskModal } from './components/CreateTaskModal';
import { Pagination } from '../../components/common/Pagination';
import { useDebounce } from '../../hooks/useDebounce';

export type WorkCenterTab =
  | 'today'
  | 'documents'
  | 'action_needed'
  | 'pending_review'
  | 'sent'
  | 'completed';

export function WorkCenterFeature() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');

  const { activeRole } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<WorkCenterTab>('today');
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [inboxDocs, setInboxDocs] = useState<InboxDocumentDto[]>([]);
  const [outgoingDocs, setOutgoingDocs] = useState<OutgoingDocumentDto[]>([]);
  const [taskTotalCount, setTaskTotalCount] = useState(0);
  const [inboxTotalCount, setInboxTotalCount] = useState(0);
  const [outgoingTotalCount, setOutgoingTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter, Search & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  // Audit 04-09-2026: Nâng cấp search — chọn trường nào trong DB sẽ được khớp.
  const [searchField, setSearchField] = useState<'all' | 'title' | 'description' | 'assignee' | 'documentNumber'>('all');
  // Audit 04-09-2026: Phạm vi dữ liệu (Hệ thống / Phòng ban tôi / Chỉ tôi). Mặc định 'mine'.
  const [scope, setScope] = useState<'system' | 'department' | 'mine'>('mine');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Bộ nhớ đệm Client cho danh sách nhiệm vụ
  const taskCacheRef = React.useRef<Map<string, { items: TaskItemDto[]; totalCount: number }>>(new Map());

  // Modals & Drawer State
  const [selectedTask, setSelectedTask] = useState<TaskItemDto | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearch, priorityFilter, searchField, scope]);

  useEffect(() => {
    if (urlTab) {
      // Audit 04-09-2026: "today" thay thế "all"/"tasks" là tab mặc định.
      if (urlTab === 'today' || urlTab === 'tasks' || urlTab === 'all') setActiveTab('today');
      else if (urlTab === 'incoming' || urlTab === 'scheduled' || urlTab === 'documents') setActiveTab('documents');
      else if (urlTab === 'pending_review') setActiveTab('pending_review');
      else if (urlTab === 'completed') setActiveTab('completed');
      else if (urlTab === 'action_needed') setActiveTab('action_needed');
      else if (urlTab === 'sent') setActiveTab('sent');
    }
  }, [urlTab]);

  const serverStatus =
    activeTab === 'action_needed' ? 'InProgress'
    : activeTab === 'pending_review' ? 'InReview'
    : activeTab === 'completed' ? 'Completed'
    : undefined;

  const [tabCounts, setTabCounts] = useState<{
    today: number;
    actionNeeded: number;
    pendingReview: number;
    completed: number;
  }>({
    today: 0,
    actionNeeded: 0,
    pendingReview: 0,
    completed: 0,
  });

  const loadTabCounts = useCallback(async () => {
    try {
      // Audit 04-09-2026: "Hôm Nay" thay thế "Tất Cả" + "Công Việc".
      const [todayRes, actionRes, reviewRes, doneRes] = await Promise.all([
        getTasksApi({ pageSize: 1, todayOnly: true }),
        getTasksApi({ pageSize: 1, status: 'InProgress' }),
        getTasksApi({ pageSize: 1, status: 'InReview' }),
        getTasksApi({ pageSize: 1, status: 'Completed' }),
      ]);
      setTabCounts({
        today: todayRes.success ? todayRes.data?.totalCount ?? 0 : 0,
        actionNeeded: actionRes.success ? actionRes.data?.totalCount ?? 0 : 0,
        pendingReview: reviewRes.success ? reviewRes.data?.totalCount ?? 0 : 0,
        completed: doneRes.success ? doneRes.data?.totalCount ?? 0 : 0,
      });
    } catch (err) {
      console.warn('Lỗi tải số lượng tab:', err);
    }
  }, []);

  useEffect(() => {
    loadTabCounts();
  }, [loadTabCounts, activeRole]);

  useEffect(() => {
    async function loadWorkspaceData() {
      try {
        setIsLoading(true);

        if (activeTab === 'documents') {
          const [inboxRes, outRes] = await Promise.all([
            getInboxDocumentsApi({ page: currentPage, pageSize, search: debouncedSearch.trim() || undefined }),
            getOutgoingDocumentsApi({ page: currentPage, pageSize, search: debouncedSearch.trim() || undefined }),
          ]);

          if (inboxRes.success && inboxRes.data?.items) {
            setInboxDocs(inboxRes.data.items);
            setInboxTotalCount(inboxRes.data.totalCount);
          }
          if (outRes.success && outRes.data?.items) {
            setOutgoingDocs(outRes.data.items);
            setOutgoingTotalCount(outRes.data.totalCount);
          }
        } else {
          const isToday = activeTab === 'today';
          const cacheKey = `${activeRole}_${activeTab}_${serverStatus}_${debouncedSearch}_${priorityFilter}_${searchField}_${scope}_${currentPage}_${pageSize}_${isToday}`;
          if (taskCacheRef.current.has(cacheKey)) {
            const cached = taskCacheRef.current.get(cacheKey)!;
            setTasks(cached.items);
            setTaskTotalCount(cached.totalCount);
          }

          const taskRes = await getTasksApi({
            page: currentPage,
            pageSize,
            status: serverStatus,
            q: debouncedSearch.trim() || undefined,
            priority: priorityFilter !== 'all' ? priorityFilter : undefined,
            todayOnly: isToday,
            searchField: searchField === 'all' ? undefined : searchField,
            scope,
          });

          if (taskRes.success && taskRes.data?.items) {
            setTasks(taskRes.data.items);
            setTaskTotalCount(taskRes.data.totalCount);
            taskCacheRef.current.set(cacheKey, {
              items: taskRes.data.items,
              totalCount: taskRes.data.totalCount,
            });
          }
        }
      } catch (err) {
        console.warn('Lỗi tải dữ liệu WorkCenter:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspaceData();
  }, [activeRole, activeTab, currentPage, pageSize, debouncedSearch, priorityFilter, serverStatus]);

  // Lắng nghe sự kiện SignalR Realtime
  useSignalREvent('TaskAssigned', (data: any) => {
    if (data?.title) {
      addToast('Nhiệm vụ mới', `Đã giao nhiệm vụ: ${data.title}`, 'info');
    }
    if (data?.taskId) {
      setTasks(prev => {
        if (prev.some(t => t.id === data.taskId)) return prev;
        const newTask: TaskItemDto = {
          id: data.taskId,
          title: data.title || 'Nhiệm vụ mới',
          description: data.description || '',
          assignerId: data.assignerId || '',
          assignerName: data.assignerName || 'Lãnh đạo',
          assigneeId: data.assigneeId || '',
          assigneeName: data.assigneeName || 'Chuyên viên',
          departmentName: data.departmentName || 'UBND Xã',
          type: data.type || 'Administrative',
          estimatedEffortHours: data.estimatedEffortHours ?? 0,
          dueDate: data.dueDate || new Date().toISOString(),
          priority: data.priority || 'Medium',
          status: 'InProgress',
          progressPercentage: 0,
          isEscalated: false,
          createdAt: new Date().toISOString(),
        };
        return [newTask, ...prev];
      });
    }
  });

  useSignalREvent('TaskUpdated', (data: any) => {
    if (data?.taskId) {
      setTasks(prev =>
        prev.map(t =>
          t.id === data.taskId
            ? { ...t, status: data.status || t.status, ratingScore: data.ratingScore ?? t.ratingScore }
            : t
        )
      );
    }
  });

  useSignalREvent('TaskDeadlineChanged', (data: any) => {
    if (data?.taskId && data?.newDueDate) {
      setTasks(prev =>
        prev.map(t => (t.id === data.taskId ? { ...t, dueDate: data.newDueDate } : t))
      );
      addToast('Điều chỉnh hạn chót', `Hạn xử lý nhiệm vụ đã được cập nhật.`, 'info');
    }
  });

  useSignalREvent('ReportApproved', (data: any) => {
    if (data?.taskId) {
      setTasks(prev =>
        prev.map(t =>
          t.id === data.taskId
            ? {
                ...t,
                status: 'Completed',
                ratingScore: data.ratingScore ?? t.ratingScore,
                progressPercentage: 100,
              }
            : t
        )
      );
      addToast('Nghiệm thu hoàn thành', `Nhiệm vụ đã được lãnh đạo phê duyệt và chấm điểm.`, 'success');
    }
  });

  useSignalREvent('ReportRejected', (data: any) => {
    if (data?.taskId) {
      setTasks(prev =>
        prev.map(t => (t.id === data.taskId ? { ...t, status: 'InProgress' } : t))
      );
      addToast('Yêu cầu chỉnh sửa', `Báo cáo nhiệm vụ cần được bổ sung theo ý kiến lãnh đạo.`, 'warning');
    }
  });

  // Tab counts
  const tasksCount = tabCounts.today;
  const docsCount = inboxTotalCount + outgoingTotalCount;
  const actionNeededCount = tabCounts.actionNeeded;
  const pendingReviewCount = tabCounts.pendingReview;
  const sentCount = outgoingTotalCount;
  const completedCount = tabCounts.completed;

  // Filtered lists
  const filteredTasks = useMemo(() => tasks, [tasks]);

  const paginatedTasks = filteredTasks;

  const handleTaskUpdated = (updated: TaskItemDto) => {
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  };

  const handleOpenTask = async (task: TaskItemDto) => {
    try {
      const response = await getTaskDetailApi(task.id);
      if (response.success && response.data) {
        setSelectedTask(response.data);
      } else {
        addToast('Không thể mở nhiệm vụ', response.error || 'Nhiệm vụ không còn trong phạm vi truy cập.', 'warning');
      }
    } catch (error: any) {
      addToast('Không thể mở nhiệm vụ', error?.message || 'Đã xảy ra lỗi khi tải chi tiết nhiệm vụ.', 'danger');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="dept-sub-tabs" role="tablist" aria-label="Trung tâm điều hành tác nghiệp">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'today'}
          className={`dept-sub-tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          <i className="fa-solid fa-calendar-day" style={{ fontSize: 13, color: '#2563eb' }} aria-hidden="true" />
          <span>Hôm Nay ({tasksCount})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'documents'}
          className={`dept-sub-tab ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <i className="fa-solid fa-envelope-open-text" style={{ fontSize: 13 }} aria-hidden="true" />
          <span>Văn Bản ({docsCount})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'action_needed'}
          className={`dept-sub-tab ${activeTab === 'action_needed' ? 'active' : ''}`}
          onClick={() => setActiveTab('action_needed')}
        >
          <i className="fa-solid fa-hourglass-half" style={{ fontSize: 13 }} aria-hidden="true" />
          <span>Chờ Xử Lý ({actionNeededCount})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pending_review'}
          className={`dept-sub-tab ${activeTab === 'pending_review' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending_review')}
        >
          <i className="fa-solid fa-stamp" style={{ fontSize: 13, color: pendingReviewCount > 0 ? '#7c3aed' : 'inherit' }} aria-hidden="true" />
          <span>Chờ Duyệt ({pendingReviewCount})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sent'}
          className={`dept-sub-tab ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          <i className="fa-solid fa-paper-plane" style={{ fontSize: 13 }} aria-hidden="true" />
          <span>Gửi Đi ({sentCount})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'completed'}
          className={`dept-sub-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <i className="fa-solid fa-circle-check" style={{ fontSize: 13, color: '#16a34a' }} aria-hidden="true" />
          <span>Đã Hoàn Thành ({completedCount})</span>
        </button>
      </div>

      {/* ── 2. SEARCH & ACTION TOOLBAR ── */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
            <input
              className="form-input"
              style={{ paddingLeft: 32, paddingRight: searchQuery ? 30 : 10, fontSize: '0.85rem', height: 36 }}
              placeholder="Tìm kiếm nhiệm vụ, văn bản, trích yếu, cán bộ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8', fontSize: 13 }} aria-hidden="true" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title="Xóa từ khóa tìm kiếm"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: 13 }} />
              </button>
            )}
          </div>

          <select
            className="form-select"
            style={{ width: 'auto', fontSize: '0.82rem', height: 36 }}
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            aria-label="Lọc theo độ ưu tiên"
          >
            <option value="all">Mọi độ ưu tiên</option>
            <option value="Khan">🔴 Khẩn cấp</option>
            <option value="Cao">🟠 Cao</option>
            <option value="Binh_Thuong">🔵 Thường</option>
          </select>

          {/* Audit 04-09-2026: chọn trường để tìm kiếm */}
          <select
            className="form-select"
            style={{ width: 'auto', fontSize: '0.82rem', height: 36 }}
            value={searchField}
            onChange={e => setSearchField(e.target.value as typeof searchField)}
            aria-label="Trường tìm kiếm"
            title="Trường dữ liệu được tìm"
          >
            <option value="all">Tìm: Tất cả</option>
            <option value="title">Tìm: Tiêu đề</option>
            <option value="description">Tìm: Trích yếu</option>
            <option value="assignee">Tìm: Cán bộ</option>
            <option value="documentNumber">Tìm: Số hiệu</option>
          </select>

          {/* Audit 04-09-2026: Lãnh đạo có thể mở rộng phạm vi — chỉ khi user có quyền ViewDepartmentDashboard */}
          {can('ViewDepartmentDashboard') && (
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '0.82rem', height: 36 }}
              value={scope}
              onChange={e => setScope(e.target.value as typeof scope)}
              aria-label="Phạm vi dữ liệu"
              title="Phạm vi dữ liệu (Hệ thống / Phòng ban tôi / Chỉ tôi)"
            >
              <option value="mine">Chỉ tôi</option>
              <option value="department">Phòng ban tôi</option>
              <option value="system">Toàn hệ thống</option>
            </select>
          )}

          {(searchQuery.trim() !== '' || priorityFilter !== 'all' || searchField !== 'all' || (can('ViewDepartmentDashboard') && scope !== 'mine')) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearchQuery('');
                setPriorityFilter('all');
                setSearchField('all');
                if (can('ViewDepartmentDashboard')) setScope('mine');
                addToast('Đã xóa bộ lọc', 'Danh sách đã được đặt lại về trạng thái mặc định.', 'info');
              }}
              style={{ color: '#dc2626', fontWeight: 700, height: 36, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <i className="fa-solid fa-rotate-left" />
              <span>Hủy bộ lọc</span>
            </button>
          )}
        </div>

        {can('AssignTask') && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowCreateModal(true)}
          >
            <i className="fa-solid fa-plus" style={{ fontSize: 13 }} aria-hidden="true" />
            <span>Giao Nhiệm Vụ Mới</span>
          </button>
        )}
      </div>

      {/* ── 3. WORKSPACE TABLE (UNIFIED TASKS & RECORDS) ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-table-list" style={{ color: '#2563eb' }} aria-hidden="true" />
            <span>
              {activeTab === 'today'
                ? 'Hôm Nay — nhiệm vụ hết hạn hoặc do bạn giao/nhận'
                : activeTab === 'documents'
                ? 'Sổ Văn Bản Đến & Văn Bản Đi'
                : activeTab === 'pending_review'
                ? 'Danh Sách Báo Cáo Chờ Lãnh Đạo Duyệt & Chấm Điểm'
                : activeTab === 'action_needed'
                ? 'Danh Sách Việc & Văn Bản Cần Xử Lý Ngay'
                : activeTab === 'sent'
                ? 'Danh Sách Văn Bản Đã Ban Hành / Gửi Đi'
                : 'Lưu Trữ Nhiệm Vụ Đã Nghiệm Thu Hoàn Thành'}
            </span>
          </h2>
          <span className="badge badge-blue">{activeTab === 'documents' ? (inboxTotalCount + outgoingTotalCount) : taskTotalCount} mục</span>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {paginatedTasks.length === 0 && activeTab !== 'documents' ? (
            <div style={{ padding: 36, textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              Không có dữ liệu phù hợp với tab và bộ lọc hiện tại.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '36%' }}>Tiêu đề nhiệm vụ / Trích yếu</th>
                    <th scope="col" style={{ width: '16%', textAlign: 'center' }}>Người thực hiện</th>
                    <th scope="col" style={{ width: '16%', textAlign: 'center' }}>Phòng ban</th>
                    <th scope="col" style={{ width: '12%', textAlign: 'center' }}>Hạn chót</th>
                    <th scope="col" style={{ width: '10%', textAlign: 'center' }}>Ưu tiên</th>
                    <th scope="col" style={{ width: '10%', textAlign: 'center' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTasks.map(task => {
                    const isDone = task.status === 'Completed' || task.status === 'Hoan_Thanh';
                    const isPending = task.status === 'InReview' || task.status === 'Cho_Duyet';
                    const isOver = !isDone && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
                    const isUrgent = task.priority === 'Khan' || task.priority === 'Urgent';
                    const isHigh = task.priority === 'Cao' || task.priority === 'High';

                    return (
                      <tr
                        key={task.id}
                        style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                        onClick={() => { void handleOpenTask(task); }}
                      >
                        <td>
                          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>{task.title}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            Mã: <strong>{task.id.substring(0, 12)}</strong> • Người giao: {task.assignerName}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.84rem' }}>{task.assigneeName}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{task.departmentName || 'UBND Xã'}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.82rem',
                              color: isOver ? '#dc2626' : '#334155',
                              fontWeight: isOver ? 800 : 600,
                              backgroundColor: isOver ? '#fef2f2' : 'transparent',
                              padding: isOver ? '2px 6px' : '0',
                              borderRadius: 4,
                            }}
                          >
                            {formatDateShort(task.dueDate)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${
                              isUrgent ? 'badge-urgent' : isHigh ? 'badge-warning' : 'badge-blue'
                            }`}
                            style={{ fontSize: '0.72rem' }}
                          >
                            {isUrgent ? 'Khẩn cấp' : isHigh ? 'Ưu tiên cao' : 'Bình thường'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${
                              isDone
                                ? 'badge-success'
                                : isPending
                                ? 'badge-warning'
                                : task.status === 'Tu_Choi'
                                ? 'badge-danger'
                                : 'badge-blue'
                            }`}
                            style={{ fontSize: '0.72rem' }}
                          >
                            {isDone
                              ? 'Đã hoàn thành'
                              : isPending
                              ? 'Chờ duyệt'
                              : task.status === 'Tu_Choi'
                              ? 'Trả lại'
                              : task.status === 'Dang_Xu_Ly'
                              ? 'Đang làm'
                              : 'Chưa làm'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Phân trang WorkCenter ── */}
          {(activeTab === 'documents' ? inboxTotalCount + outgoingTotalCount : taskTotalCount) > 0 && (
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={activeTab === 'documents' ? inboxTotalCount + outgoingTotalCount : taskTotalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20, 50]}
              itemName={activeTab === 'documents' ? 'văn bản' : 'nhiệm vụ'}
            />
          )}
        </div>
      </div>

      {/* ── 4. INTEGRATED TASK DETAIL DRAWER (Nộp + Duyệt + Lịch sử) ── */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* ── 5. CREATE TASK MODAL ── */}
      {showCreateModal && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onTaskCreated={newTask => {
            setTasks(prev => [newTask, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}
