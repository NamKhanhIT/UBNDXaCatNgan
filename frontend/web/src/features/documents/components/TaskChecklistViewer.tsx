'use client';

import React, { useState } from 'react';
import { GeneratedSubTask } from '../services/document-ai.service';

interface TaskChecklistViewerProps {
  initialSubTasks: GeneratedSubTask[];
  onSubTasksChange?: (updatedSubTasks: GeneratedSubTask[]) => void;
}

export function TaskChecklistViewer({ initialSubTasks, onSubTasksChange }: TaskChecklistViewerProps) {
  const [subTasks, setSubTasks] = useState<GeneratedSubTask[]>(initialSubTasks);
  const [newTitle, setNewTitle] = useState<string>('');

  const completedCount = subTasks.filter(st => st.isCompleted).length;
  const totalCount = subTasks.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = (id: string) => {
    const updated = subTasks.map(st => (st.id === id ? { ...st, isCompleted: !st.isCompleted } : st));
    setSubTasks(updated);
    if (onSubTasksChange) onSubTasksChange(updated);
  };

  const handleAddSubTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: GeneratedSubTask = {
      id: `st-custom-${Date.now()}`,
      title: newTitle.trim(),
      isCompleted: false,
    };

    const updated = [...subTasks, newItem];
    setSubTasks(updated);
    setNewTitle('');
    if (onSubTasksChange) onSubTasksChange(updated);
  };

  const handleDelete = (id: string) => {
    const updated = subTasks.filter(st => st.id !== id);
    setSubTasks(updated);
    if (onSubTasksChange) onSubTasksChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tiến độ hoàn thành */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
          Tiến Độ Thực Hiện Đầu Việc ({completedCount}/{totalCount}):
        </span>
        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: progressPercentage === 100 ? '#16a34a' : '#2563eb' }}>
          {progressPercentage}% Hoàn Thành
        </span>
      </div>

      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${progressPercentage}%`,
            background: progressPercentage === 100 ? '#16a34a' : '#2563eb',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Danh sách đầu việc con */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        {subTasks.map(st => (
          <div
            key={st.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 6,
              background: st.isCompleted ? '#f0fdf4' : '#f8fafc',
              border: st.isCompleted ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, margin: 0 }}>
              <input
                type="checkbox"
                checked={st.isCompleted}
                onChange={() => handleToggle(st.id)}
                style={{ width: 16, height: 16, accentColor: '#16a34a' }}
              />
              <span
                style={{
                  fontSize: '0.84rem',
                  color: st.isCompleted ? '#166534' : '#1e293b',
                  textDecoration: st.isCompleted ? 'line-through' : 'none',
                  fontWeight: st.isCompleted ? 600 : 700,
                }}
              >
                {st.title}
              </span>
            </label>

            <button
              type="button"
              className="btn btn-ghost btn-xs"
              style={{ color: '#94a3b8', padding: '2px 6px' }}
              onClick={() => handleDelete(st.id)}
              title="Xóa đầu việc này"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Thêm đầu việc con mới */}
      <form onSubmit={handleAddSubTask} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <input
          type="text"
          className="form-input"
          placeholder="Thêm đầu việc con mới..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          style={{ fontSize: '0.82rem', padding: '6px 12px' }}
        />
        <button type="submit" className="btn btn-outline btn-sm" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
          + Thêm
        </button>
      </form>
    </div>
  );
}
