'use client';

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Users,
  Sparkles,
  Award,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import {
  AssignmentSuggestion,
  DocumentAnalysisResult,
  suggestAssignmentApi,
  createTaskFromInboxApi
} from '../services/inbox.service';

export interface AiAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  analysisData?: DocumentAnalysisResult | null;
  departments: { id: string; name: string }[];
  allUsers?: { id: string; name: string; role?: string; departmentId?: string; departmentName?: string }[];
  onTaskCreated?: (taskItemId: string, subTasks: { id: string; title: string }[]) => void;
}

export const AiAssignmentModal: React.FC<AiAssignmentModalProps> = ({
  isOpen,
  onClose,
  documentId,
  analysisData,
  departments,
  allUsers = [],
  onTaskCreated
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [suggestion, setSuggestion] = useState<AssignmentSuggestion | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [priority, setPriority] = useState<number>(2); // 1: Low, 2: Medium, 3: High, 4: Urgent
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchAssignmentSuggestion();
    }
  }, [isOpen, documentId]);

  const fetchAssignmentSuggestion = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await suggestAssignmentApi(documentId);
      if (res.success && res.data) {
        setSuggestion(res.data);
        setSelectedUserId(res.data.suggestedUserId);
        setSelectedDeptId(
          res.data.suggestedDepartmentId ||
            analysisData?.suggestedDepartmentId ||
            ''
        );
      } else {
        setErrorMsg(res.error || 'Không thể lấy gợi ý giao việc từ AI.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối khi gọi AI gợi ý giao việc.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateTask = async () => {
    if (!selectedUserId) {
      setErrorMsg('Vui lòng chọn cán bộ thực hiện nhiệm vụ.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createTaskFromInboxApi(documentId, {
        assigneeId: selectedUserId,
        departmentId: selectedDeptId || undefined,
        priority
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Tạo nhiệm vụ thất bại.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onClose();

      if (onTaskCreated && res.data) {
        onTaskCreated(res.data.taskItemId, res.data.subTasks || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi mạng khi tạo nhiệm vụ.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Gợi Ý Giao Việc Thông Minh
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  AI Matching
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Đề xuất cán bộ dựa trên mức tải việc thực tế, phòng ban và chuyên môn.
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-600">
                AI đang phân tích năng lực & tải việc của các cán bộ...
              </p>
            </div>
          ) : errorMsg && !suggestion ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                {errorMsg}
              </div>
              <button
                onClick={fetchAssignmentSuggestion}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : suggestion ? (
            <>
              {/* Top AI Match Recommendation */}
              <div className="p-4.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-white border-2 border-indigo-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                      ⭐ Đề Xuất Phù Hợp Nhất
                    </span>
                    {suggestion.suggestedDepartmentName && (
                      <span className="text-xs text-slate-500 font-medium">
                        Phòng ban: <strong>{suggestion.suggestedDepartmentName}</strong>
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-indigo-700">
                    Độ tin cậy: {Math.round(suggestion.confidence * 100)}%
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <input
                    type="radio"
                    id="top-suggestion"
                    name="assignedUser"
                    checked={selectedUserId === suggestion.suggestedUserId && !isManualOverride}
                    onChange={() => {
                      setSelectedUserId(suggestion.suggestedUserId);
                      setIsManualOverride(false);
                    }}
                    className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="top-suggestion"
                      className="cursor-pointer block text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                    >
                      {suggestion.suggestedUserName}
                    </label>

                    {/* AI Reason */}
                    <div className="mt-2 p-3 bg-white/80 backdrop-blur-xs rounded-xl border border-indigo-100/80 text-xs text-slate-700 leading-relaxed">
                      <strong className="text-indigo-900 font-semibold block mb-1">
                        💡 Lý do đề xuất từ AI:
                      </strong>
                      {suggestion.reason}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alternatives List */}
              {suggestion.alternatives && suggestion.alternatives.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Ứng Viên Thay Thế Đề Xuất
                  </h4>

                  <div className="grid grid-cols-1 gap-2.5">
                    {suggestion.alternatives.map((alt) => (
                      <div
                        key={alt.userId}
                        onClick={() => {
                          setSelectedUserId(alt.userId);
                          setIsManualOverride(false);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                          selectedUserId === alt.userId && !isManualOverride
                            ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-300'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          type="radio"
                          id={`alt-${alt.userId}`}
                          name="assignedUser"
                          checked={selectedUserId === alt.userId && !isManualOverride}
                          onChange={() => {
                            setSelectedUserId(alt.userId);
                            setIsManualOverride(false);
                          }}
                          className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={`alt-${alt.userId}`}
                            className="cursor-pointer font-semibold text-sm text-slate-900 block"
                          >
                            {alt.fullName}
                          </label>
                          <p className="text-xs text-slate-600 mt-0.5 leading-normal">
                            {alt.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Override Option */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    Hoặc chọn cán bộ khác thủ công
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManualOverride(!isManualOverride)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    {isManualOverride ? 'Ẩn danh sách' : 'Tùy chọn khác'}
                  </button>
                </div>

                {isManualOverride && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cán bộ thực hiện
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
                      >
                        <option value="">-- Chọn cán bộ --</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role || u.departmentName || 'Cán bộ'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Phòng ban phụ trách
                      </label>
                      <select
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
                      >
                        <option value="">-- Chọn phòng ban --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Task Priority Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Độ ưu tiên nhiệm vụ
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 1, label: 'Thường', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                    { val: 2, label: 'Trung bình', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { val: 3, label: 'Cao', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { val: 4, label: 'Khẩn cấp', color: 'bg-rose-50 text-rose-700 border-rose-200' },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setPriority(p.val)}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-center ${
                        priority === p.val
                          ? `${p.color} ring-2 ring-indigo-500/30 font-bold shadow-xs`
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={isSubmitting || loading || !selectedUserId}
            onClick={handleCreateTask}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang tạo nhiệm vụ & sinh checklist...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                Tạo Nhiệm Vụ & Sinh Tiến Độ AI
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
