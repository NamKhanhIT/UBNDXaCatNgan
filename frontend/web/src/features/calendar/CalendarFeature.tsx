'use client';

import React, { useState, useEffect } from 'react';
import { GoogleCalendarView } from '../../components/GoogleCalendarView';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { getTasksApi, getUsersApi, TaskItemDto, UserDto } from '../../services/task.service';

export function CalendarFeature() {
  const { activeRole } = useAuth();
  const { addToast } = useToast();

  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadCalendarData() {
      try {
        setIsLoading(true);
        const [taskRes, userRes] = await Promise.all([
          getTasksApi({ page: 1, pageSize: 100 }),
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
          onOpenTaskDetailModal={(taskId) => {
            addToast('Chi tiết nhiệm vụ', `Xem nhiệm vụ ${taskId}`, 'info');
          }}
          addToast={addToast}
        />
      )}
    </div>
  );
}
