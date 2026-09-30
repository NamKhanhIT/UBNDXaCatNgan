'use client';

import React, { useState } from 'react';
import { GoogleCalendarView } from '../../components/GoogleCalendarView';
import { useToast } from '../../components/ui/ToastContext';
import type { TaskItemDto } from '../../services/task.service';
import { useWorkflowQuery } from '../workflow/useWorkflow';
import { WorkflowError } from '../workflow/WorkflowFeedback';
import { loadCalendarTasks } from './calendarData';
import { WorkflowTaskDetail } from '../workflow/WorkflowTaskDetail';
import { TaskComposer } from '../workflow/TaskComposer';
import { useSearchParams } from 'next/navigation';

export function CalendarFeature() {
  const eventId = useSearchParams().get('eventId');
  const { addToast } = useToast();

  const query = useWorkflowQuery<TaskItemDto[]>('/api/v1/Tasks?scope=mine', loadCalendarTasks);
  const tasks = query.data || [];
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WorkflowError error={query.error} retry={query.refresh} />
      {query.loading && !query.data ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 26, marginBottom: 10, color: '#2563eb' }} aria-hidden="true" />
          <div style={{ fontWeight: 600 }}>Đang tải lịch công tác tuần và sự kiện...</div>
        </div>
      ) : (
        <GoogleCalendarView
          eventId={eventId}
          tasks={tasks}
          users={[]}
          onOpenCreateTaskModal={() => setCreatingTask(true)}
          onOpenTaskDetailModal={setSelectedTask}
          addToast={addToast}
        />
      )}
      {selectedTask && (
        <WorkflowTaskDetail
          taskId={selectedTask}
          onClose={() => setSelectedTask(null)}
          onOpenTask={setSelectedTask}
        />
      )}
      {creatingTask && <TaskComposer onClose={() => setCreatingTask(false)} onCreated={task => { setCreatingTask(false); setSelectedTask(task.id); }} />}
    </div>
  );
}
