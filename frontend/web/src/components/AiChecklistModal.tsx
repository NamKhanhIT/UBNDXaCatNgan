'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Square,
  Sparkles,
  Plus,
  Trash2,
  X,
  ListTodo,
  TrendingUp,
  PartyPopper
} from 'lucide-react';
import {
  toggleSubTaskApi,
  ToggleSubTaskResult
} from '../services/inbox.service';

export interface AiChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskItemId: string;
  taskTitle: string;
  subTasks: { id: string; title: string; isCompleted?: boolean }[];
  onSubTaskToggled?: (result: ToggleSubTaskResult) => void;
}

export const AiChecklistModal: React.FC<AiChecklistModalProps> = ({
  isOpen,
  onClose,
  taskItemId,
  taskTitle,
  subTasks: initialSubTasks = [],
  onSubTaskToggled
}) => {
  const [subTasks, setSubTasks] = useState(
    initialSubTasks.map((s) => ({ ...s, isCompleted: s.isCompleted ?? false }))
  );
  const [newTitle, setNewTitle] = useState<string>('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const completedCount = subTasks.filter((s) => s.isCompleted).length;
  const totalCount = subTasks.length;
  const progressPercent =
    totalCount > 0 ? Math.round((100 * completedCount) / totalCount) : 0;

  const handleToggle = async (subTaskId: string) => {
    setTogglingId(subTaskId);

    // Optimistic UI update
    setSubTasks((prev) =>
      prev.map((s) =>
        s.id === subTaskId ? { ...s, isCompleted: !s.isCompleted } : s
      )
    );

    try {
      const res = await toggleSubTaskApi(subTaskId);
      if (res.success && res.data) {
        if (onSubTaskToggled) {
          onSubTaskToggled(res.data);
        }
      }
    } catch (err) {
      console.error('Lỗi khi toggle subtask:', err);
      // Revert optimistic update
      setSubTasks((prev) =>
        prev.map((s) =>
          s.id === subTaskId ? { ...s, isCompleted: !s.isCompleted } : s
        )
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleAddLocalSubTask = () => {
    if (newTitle.trim()) {
      setSubTasks([
        ...subTasks,
        { id: `temp-${Date.now()}`, title: newTitle.trim(), isCompleted: false }
      ]);
      setNewTitle('');
    }
  };

  const handleDeleteLocalSubTask = (id: string) => {
    setSubTasks(subTasks.filter((s) => s.id !== id));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Tiến Độ & Đầu Việc Nhiệm Vụ
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  AI Suggested
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1 max-w-md">
                {taskTitle || 'Nhiệm vụ vừa tạo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Tiến độ hoàn thành
            </span>
            <span className="text-emerald-700 font-bold">
              {completedCount}/{totalCount} mục ({progressPercent}%)
            </span>
          </div>

          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {progressPercent === 100 && totalCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 animate-pulse">
              <PartyPopper className="w-4 h-4 text-emerald-600" />
              Tuyệt vời! Toàn bộ đầu việc đã được hoàn thành.
            </div>
          )}
        </div>

        {/* SubTask List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {subTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Chưa có đầu việc con nào. Hãy thêm mục đầu tiên bên dưới.
            </div>
          ) : (
            subTasks.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  item.isCompleted
                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-xs'
                }`}
              >
                <button
                  type="button"
                  disabled={togglingId === item.id}
                  onClick={() => handleToggle(item.id)}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  {item.isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                  ) : (
                    <Square className="w-5 h-5 hover:text-slate-600" />
                  )}
                </button>

                <div className="flex-1 text-sm">
                  <span
                    className={`block leading-snug ${
                      item.isCompleted ? 'line-through text-slate-400 font-normal' : 'font-medium'
                    }`}
                  >
                    {item.title}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteLocalSubTask(item.id)}
                  className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                  title="Xóa đầu việc"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add SubTask Input */}
        <div className="px-6 py-3 border-t border-slate-100 bg-white flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddLocalSubTask();
              }
            }}
            placeholder="Thêm đầu việc mới..."
            className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
          />
          <button
            type="button"
            onClick={handleAddLocalSubTask}
            className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-xs"
          >
            Hoàn Tất & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
