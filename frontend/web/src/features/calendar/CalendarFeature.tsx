'use client';

import React, { useState, useEffect } from 'react';
import { GoogleCalendarView } from '../../components/GoogleCalendarView';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { getTasksApi, getUsersApi, getTaskDetailApi, TaskItemDto, TaskDetailDto, UserDto } from '../../services/task.service';
import { TaskDetailDrawer } from '../workcenter/components/TaskDetailDrawer';

export function CalendarFeature() {
  const { activeRole } = useAuth();
  const { addToast } = useToast();

  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTask, setSelectedTask] = useState<TaskDetailDto | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const openTaskDetail = async (taskId: string) => {
    try {
      setIsDetailLoading(true);
      const response = await getTaskDetailApi(taskId);
      if (response.success && response.data) {
        setSelectedTask(response.data);
      } else {
        addToast('Không thể mở nhiệm vụ', response.error || 'Nhiệm vụ không còn trong phạm vi truy cập.', 'warning');
      }
    } catch (error: any) {
      addToast('Không thể mở nhiệm vụ', error?.message || 'Đã xảy ra lỗi khi tải chi tiết nhiệm vụ.', 'danger');
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    async function loadCalendarData() {
      try {
        setIsLoading(true);
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

        const [taskRes, userRes] = await Promise.all([
          getTasksApi({ dueDateFrom: start, dueDateTo: end, pageSize: 200 }),
          getUsersApi(),
        ]);
        if (taskRes.success && taskRes.data?.items) {
          setTasks(taskRes.data.items);
        }
        if (userRes.success && userRes.data) {
          const userItems = Array.isArray(userRes.data) ? userRes.data : (userRes.data as any).items || [];
          setUsers(userItems);
        }
      } catch (err) {
        console.warn('Lỗi tải dữ liệu lịch:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCalendarData();
  }, [activeRole]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 26, marginBottom: 10, color: '#2563eb' }} aria-hidden="true" />
          <div style={{ fontWeight: 600 }}>Đang tải lịch công tác tuần và sự kiện...</div>
        </div>
      ) : (
        <GoogleCalendarView
          tasks={tasks}
          users={users}
          onOpenCreateTaskModal={() => {
            addToast('Giao việc', 'Chức năng giao việc từ lịch công tác', 'info');
          }}
          onOpenTaskDetailModal={openTaskDetail}
          addToast={addToast}
        />
      )}
      {isDetailLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998, display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,0.18)' }}>
          <span className="badge badge-blue">Đang tải chi tiết nhiệm vụ...</span>
        </div>
      )}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={(updated) => setSelectedTask(prev => prev ? { ...prev, ...updated } : prev)}
        />
      )}
    </div>
  );
}
