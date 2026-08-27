'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import { getTasksApi, TaskItemDto } from '../../services/task.service';
import { getInboxDocumentsApi, InboxDocumentDto } from '../../services/inbox.service';
import { getOutgoingDocumentsApi, OutgoingDocumentDto } from '../../services/outgoing-document.service';
import { useToast } from '../../components/ui/ToastContext';
import { formatDateShort } from '../../lib/formatters';
import { useSignalREvent } from '../../hooks/use-signalr';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { CreateTaskModal } from './components/CreateTaskModal';

export type WorkCenterTab =
  | 'all'
  | 'tasks'
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

  const [activeTab, setActiveTab] = useState<WorkCenterTab>('all');
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [inboxDocs, setInboxDocs] = useState<InboxDocumentDto[]>([]);
  const [outgoingDocs, setOutgoingDocs] = useState<OutgoingDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter, Search & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals & Drawer State
  const [selectedTask, setSelectedTask] = useState<TaskItemDto | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, priorityFilter]);

  useEffect(() => {
    if (urlTab) {
      if (urlTab === 'today' || urlTab === 'tasks') setActiveTab('tasks');
      else if (urlTab === 'incoming' || urlTab === 'scheduled' || urlTab === 'documents') setActiveTab('documents');
      else if (urlTab === 'pending_review') setActiveTab('pending_review');
      else if (urlTab === 'completed') setActiveTab('completed');
    }
  }, [urlTab]);

  useEffect(() => {
    async function loadWorkspaceData() {
      try {
        setIsLoading(true);
        const [taskRes, inboxRes, outRes] = await Promise.all([
          getTasksApi({ page: 1, pageSize: 100 }),
          getInboxDocumentsApi({ page: 1, pageSize: 100 }),
          getOutgoingDocumentsApi({ page: 1, pageSize: 100 }),
        ]);

        if (taskRes.success && taskRes.data?.items) {
          setTasks(taskRes.data.items);
        }
        if (inboxRes.success && inboxRes.data?.items) {
          setInboxDocs(inboxRes.data.items);
        }
        if (outRes.success && outRes.data?.items) {
          setOutgoingDocs(outRes.data.items);
        }
      } catch (err) {
        console.warn('Lỗi tải dữ liệu WorkCenter:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspaceData();
  }, [activeRole]);

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
          estimatedEffortHours: data.estimatedEffortHours || 8,
          dueDate: data.dueDate || new Date().toISOString(),
          priority: data.priority || 'Cao',
          status: 'Dang_Xu_Ly',
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
                status: 'Hoan_Thanh',
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
        prev.map(t => (t.id === data.taskId ? { ...t, status: 'Tu_Choi' } : t))
      );
      addToast('Yêu cầu chỉnh sửa', `Báo cáo nhiệm vụ cần được bổ sung theo ý kiến lãnh đạo.`, 'warning');
    }
  });

  // Tab counts
  const tasksCount = tasks.length;
  const docsCount = inboxDocs.length + outgoingDocs.length;
  const actionNeededCount = tasks.filter(t => t.status === 'Dang_Xu_Ly' || t.status === 'Chua_Lam').length;
  const pendingReviewCount = tasks.filter(t => t.status === 'Cho_Duyet').length + outgoingDocs.filter(d => d.status === 'PendingSignature').length;
  const sentCount = outgoingDocs.filter(d => d.status === 'Issued' || d.status === 'Sent').length;
  const completedCount = tasks.filter(t => t.status === 'Hoan_Thanh').length;

  // Filtered lists
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (activeTab === 'action_needed' && t.status !== 'Dang_Xu_Ly' && t.status !== 'Chua_Lam' && t.status !== 'Tu_Choi') return false;
      if (activeTab === 'pending_review' && t.status !== 'Cho_Duyet') return false;
      if (activeTab === 'completed' && t.status !== 'Hoan_Thanh') return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.assigneeName && t.assigneeName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [tasks, activeTab, priorityFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  const handleTaskUpdated = (updated: TaskItemDto) => {
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. UNIFIED WORKSPACE 7 TABS ── */}
      <div className="dept-sub-tabs" role="tablist" aria-label="Trung tâm điều hành tác nghiệp">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`dept-sub-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <i className="fa-solid fa-layer-group" style={{ fontSize: 13 }} aria-hidden="true" />
          <span>Tất Cả ({tasksCount + docsCount})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tasks'}
          className={`dept-sub-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <i className="fa-solid fa-list-check" style={{ fontSize: 13 }} aria-hidden="true" />
          <span>Công Việc ({tasksCount})</span>
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
          >
            <option value="all">Mọi độ ưu tiên</option>
            <option value="Khan">🔴 Khẩn cấp</option>
            <option value="Cao">🟠 Cao</option>
            <option value="Binh_Thuong">🔵 Thường</option>
          </select>

          {(searchQuery.trim() !== '' || priorityFilter !== 'all') && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearchQuery('');
                setPriorityFilter('all');
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
              {activeTab === 'all'
                ? 'Không Gian Làm Việc Hợp Nhất'
                : activeTab === 'tasks'
                ? 'Danh Sách Nhiệm Vụ Công Vụ'
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
          <span className="badge badge-blue">{filteredTasks.length} mục</span>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {filteredTasks.length === 0 && activeTab !== 'documents' ? (
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
                    const isDone = task.status === 'Hoan_Thanh';
                    const isPending = task.status === 'Cho_Duyet';
                    const isOver = !isDone && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
                    const isUrgent = task.priority === 'Khan' || task.priority === 'Urgent';
                    const isHigh = task.priority === 'Cao' || task.priority === 'High';

                    return (
                      <tr
                        key={task.id}
                        style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                        onClick={() => setSelectedTask(task)}
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
          {filteredTasks.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: '1px solid #e2e8f0',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.82rem', color: '#64748b' }}>
                <span>
                  Hiển thị <strong>{(currentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(currentPage * pageSize, filteredTasks.length)}</strong> trong tổng số <strong>{filteredTasks.length}</strong> mục
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Số dòng:</span>
                  <select
                    className="form-select"
                    style={{ width: 'auto', padding: '2px 8px', height: 30, fontSize: '0.8rem' }}
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={5}>5 / trang</option>
                    <option value={10}>10 / trang</option>
                    <option value={20}>20 / trang</option>
                    <option value={50}>50 / trang</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{ height: 32, padding: '0 10px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    <i className="fa-solid fa-chevron-left" style={{ marginRight: 4 }} />
                    Trước
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setCurrentPage(p)}
                      style={{ height: 32, minWidth: 32, padding: '0 8px', fontSize: '0.8rem', fontWeight: p === currentPage ? 800 : 600 }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    style={{ height: 32, padding: '0 10px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Sau
                    <i className="fa-solid fa-chevron-right" style={{ marginLeft: 4 }} />
                  </button>
                </div>
              )}
            </div>
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
