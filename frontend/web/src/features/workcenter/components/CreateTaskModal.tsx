'use client';

import React, { useState, useEffect } from 'react';
import { createTaskApi, CreateTaskPayload, TaskItemDto } from '../../../services/task.service';
import { getUsersPaginatedApi, UserDto } from '../../../services/user.service';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../components/ui/ToastContext';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (newTask: TaskItemDto) => void;
}

// BẢO MẬT (Audit M6): Danh sách cán bộ fallback mẫu (chỉ nạp khi bật NEXT_PUBLIC_DEMO_MODE)
const FALLBACK_USERS: UserDto[] = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? [
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    username: 'nam',
    fullName: 'Nguyễn Văn Nam',
    email: 'nam@ubnd.gov.vn',
    primaryDepartmentId: '10000000-0000-0000-0000-000000000002',
    departmentName: 'Phòng Kinh tế & Địa chính',
    roleName: 'Chuyên viên Địa chính',
    rankLevel: 5,
    assignedHours: 24,
    maxHours: 40,
    utilizationRate: 60,
    isOverloaded: false,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    username: 'tp_vh',
    fullName: 'Trần Thị Mai',
    email: 'tp_vh@ubnd.gov.vn',
    primaryDepartmentId: '10000000-0000-0000-0000-000000000003',
    departmentName: 'Phòng Văn hóa - Xã hội',
    roleName: 'Trưởng phòng VH-XH',
    rankLevel: 3,
    assignedHours: 32,
    maxHours: 40,
    utilizationRate: 80,
    isOverloaded: false,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    username: 'tp_kt',
    fullName: 'Lê Văn Tùng',
    email: 'tp_kt@ubnd.gov.vn',
    primaryDepartmentId: '10000000-0000-0000-0000-000000000002',
    departmentName: 'Phòng Kinh tế & Địa chính',
    roleName: 'Trưởng phòng Kinh tế',
    rankLevel: 3,
    assignedHours: 28,
    maxHours: 40,
    utilizationRate: 70,
    isOverloaded: false,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    username: 'hoang',
    fullName: 'Nguyễn Văn Hoàng',
    email: 'hoang@ubnd.gov.vn',
    primaryDepartmentId: '10000000-0000-0000-0000-000000000001',
    departmentName: 'Văn phòng HĐND & UBND',
    roleName: 'Phó Chủ tịch - Chánh VP',
    rankLevel: 2,
    assignedHours: 20,
    maxHours: 40,
    utilizationRate: 50,
    isOverloaded: false,
  },
] : [];

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function CreateTaskModal({ isOpen, onClose, onTaskCreated }: CreateTaskModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [userList, setUserList] = useState<UserDto[]>(FALLBACK_USERS);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Khan' | 'Cao' | 'Binh_Thuong'>('Cao');
  const [isLoading, setIsLoading] = useState(false);

  // Tải danh sách cán bộ thực tế từ API khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    async function loadUsers() {
      try {
        const res = await getUsersPaginatedApi({ page: 1, pageSize: 50 });
        if (res.success && res.data?.items && res.data.items.length > 0) {
          setUserList(res.data.items);
          if (!res.data.items.some(u => u.id === assigneeId)) {
            setAssigneeId(res.data.items[0].id);
          }
        }
      } catch (err) {
        console.warn('Dùng danh sách cán bộ dự phòng:', err);
      }
    }

    loadUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  // BẢO MẬT (Audit 04-09-2026): Quy chuẩn hành chính — không cho phép tự giao việc cho chính mình.
  const isSelfAssignment =
    user?.userId && assigneeId && user.userId === assigneeId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast('Cảnh báo', 'Vui lòng nhập tiêu đề nhiệm vụ', 'warning');
      return;
    }
    if (!requirements.trim()) {
      addToast('Cảnh báo', 'Vui lòng nêu yêu cầu hoặc kết quả cần đạt.', 'warning');
      return;
    }
    // BẢO MẬT (Audit 04-09-2026): fail-fast client-side — không cho phép tự giao việc.
    if (user?.userId && assigneeId && user.userId === assigneeId) {
      addToast('Cảnh báo', 'Không thể tự giao việc cho chính mình theo quy chuẩn hành chính.', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const mappedPriority: 'Low' | 'Medium' | 'High' | 'Urgent' =
        priority === 'Khan' ? 'Urgent' : priority === 'Cao' ? 'High' : 'Medium';

      // M6: không còn fallback cán bộ giả ở production — thiếu assignee thì chặn gửi
      const targetAssignee = userList.find(u => u.id === assigneeId);
      if (!targetAssignee) {
        addToast('Thiếu người thực hiện', 'Vui lòng chọn cán bộ thụ lý từ danh sách.', 'warning');
        setIsLoading(false);
        return;
      }
      const validAssignerId = user?.userId && GUID_REGEX.test(user.userId) ? user.userId : '';
      if (!validAssignerId) {
        addToast('Phiên làm việc', 'Không xác định được tài khoản đang thao tác.', 'danger');
        setIsLoading(false);
        return;
      }

      const validAssigneeId = assigneeId && GUID_REGEX.test(assigneeId) ? assigneeId : '';
      if (!validAssigneeId) {
        addToast('Thiếu người thực hiện', 'Danh sách cán bộ chưa sẵn sàng.', 'warning');
        setIsLoading(false);
        return;
      }

      const validDeptId = targetAssignee.primaryDepartmentId && GUID_REGEX.test(targetAssignee.primaryDepartmentId)
        ? targetAssignee.primaryDepartmentId
        : undefined;

      const payload: CreateTaskPayload = {
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        assignerId: validAssignerId,
        assigneeId: validAssigneeId,
        dueDate: dueDate || undefined,
        priority: mappedPriority,
        type: 'BAU',
        departmentId: validDeptId,
      };

      const res = await createTaskApi(payload);
      if (res.success) {
        addToast('Thành công', 'Đã giao nhiệm vụ mới thành công!', 'success');
        onTaskCreated({
          id: (typeof res.data === 'string' && res.data) ? res.data : `TSK-${Date.now()}`,
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim(),
          assignerId: validAssignerId,
          assignerName: user?.fullName || 'Chủ tịch UBND',
          assigneeId: validAssigneeId,
          assigneeName: targetAssignee.fullName || targetAssignee.username,
          departmentName: targetAssignee.departmentName || 'Phòng Kinh tế & Địa chính',
          dueDate: dueDate || undefined,
          priority: mappedPriority,
          status: 'Todo',
          type: 'BAU',
          estimatedEffortHours: 0,
          progressPercentage: 0,
          isEscalated: false,
          createdAt: new Date().toISOString(),
        });
        onClose();
      } else {
        addToast('Lỗi', res.error || 'Không thể tạo nhiệm vụ', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Lỗi kết nối khi tạo nhiệm vụ', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
            📋 Phiếu Giao Nhiệm Vụ Công Vụ Mới
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
              Tiêu đề nhiệm vụ (*):
            </label>
            <input
              className="form-input"
              placeholder="VD: Thẩm định hồ sơ cấp đổi Giấy chứng nhận QSDĐ..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
              Nội dung & Yêu cầu chỉ đạo:
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Nêu rõ yêu cầu chất lượng, căn cứ pháp lý, tài liệu cần nộp..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Cán bộ thực hiện:
              </label>
              <select
                className="form-select"
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                aria-invalid={!!isSelfAssignment}
                style={isSelfAssignment ? { borderColor: '#dc2626' } : undefined}
              >
                {userList.map(u => (
                  <option
                    key={u.id}
                    value={u.id}
                    disabled={user?.userId === u.id}
                    title={user?.userId === u.id ? 'Không thể tự giao việc cho chính mình' : undefined}
                  >
                    {u.fullName} {u.roleName ? `(${u.roleName})` : ''}
                    {user?.userId === u.id ? ' — chính bạn (không thể chọn)' : ''}
                  </option>
                ))}
              </select>
              {isSelfAssignment && (
                <div style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: 4, fontWeight: 700 }}>
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> Không thể tự giao việc cho chính mình theo quy chuẩn hành chính.
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Hạn chót hoàn thành:
              </label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
              Yêu cầu / kết quả cần đạt (*):
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Nêu rõ kết quả, sản phẩm hoặc hồ sơ cần hoàn thành..."
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
              Mức độ ưu tiên:
            </label>
            <select
              className="form-select"
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
            >
              <option value="Binh_Thuong">Thường</option>
              <option value="Cao">Cao</option>
              <option value="Khan">Khẩn cấp</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !!isSelfAssignment}
              style={{ fontWeight: 700 }}
              title={isSelfAssignment ? 'Không thể tự giao việc cho chính mình theo quy chuẩn hành chính' : undefined}
            >
              {isLoading ? 'Đang giao...' : 'Giao Việc Ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
