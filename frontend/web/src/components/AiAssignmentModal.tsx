'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Users,
  Sparkles,
  Briefcase,
  AlertCircle,
  X,
  ChevronDown,
  Plus,
  Trash2,
  FileText,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
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

/**
 * Assignable user returned by GET /api/v1/Users/assignable (Audit 04-09-2026).
 */
export interface AssignableUserDto {
  id: string;
  fullName: string;
  username: string;
  rankLevel: number;
  roleName?: string | null;
  primaryDepartmentId?: string | null;
  departmentName?: string | null;
  currentTaskCount: number;
  overdueTaskCount: number;
  last30DaysCompletionRate: number;
  utilizationRate: number;
  capabilityMatches: string[];
  capabilities: string[];
  matchConfidence: number;
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
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [suggestion, setSuggestion] = useState<AssignmentSuggestion | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [priority, setPriority] = useState<number>(2);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  // Audit 04-09-2026: Mới — Tài liệu/Chỉ thị AI + Hướng dẫn bổ sung + Checklist kết quả
  const [aiExtractedDocumentText, setAiExtractedDocumentText] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [requiredResults, setRequiredResults] = useState<string[]>([
    'Hoàn thành đúng hạn chót',
    'Báo cáo kết quả kèm minh chứng',
  ]);
  const [newRequiredResult, setNewRequiredResult] = useState<string>('');

  // Capability search
  const [capabilityFilter, setCapabilityFilter] = useState<string>('');

  // Fetch assignable users (capability-aware)
  const [assignableUsers, setAssignableUsers] = useState<AssignableUserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchAssignmentSuggestion();
      fetchAssignableUsers();
      // Tải AI document text (readonly) từ phân tích văn bản gốc
      const summary =
        (analysisData?.title ? `${analysisData.title}\n\n` : '') +
        (analysisData?.summary || '');
      setAiExtractedDocumentText(summary.trim());
    }
  }, [isOpen, documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAssignmentSuggestion = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await suggestAssignmentApi(documentId);
      if (res.success && res.data) {
        setSuggestion(res.data);
        setSelectedUserIds(res.data.suggestedUserId ? [res.data.suggestedUserId] : []);
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

  const fetchAssignableUsers = async () => {
    if (!user?.userId) return;
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/v1/Users/assignable`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.success && Array.isArray(body.data)) {
          setAssignableUsers(body.data);
        }
      }
    } catch {
      // Silent fallback to legacy allUsers list
    } finally {
      setLoadingUsers(false);
    }
  };

  if (!isOpen) return null;

  const toggleSelectedUser = (uid: string) => {
    // BẢO MẬT (Audit 04-09-2026): Không cho phép tự giao việc cho chính mình.
    if (user?.userId === uid) {
      setErrorMsg('Không thể tự giao việc cho chính mình theo quy chuẩn hành chính.');
      return;
    }
    setErrorMsg(null);
    setSelectedUserIds(prev =>
      prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
    );
  };

  const addRequiredResult = () => {
    const trimmed = newRequiredResult.trim();
    if (!trimmed) return;
    setRequiredResults(prev => [...prev, trimmed]);
    setNewRequiredResult('');
  };

  const removeRequiredResult = (idx: number) => {
    setRequiredResults(prev => prev.filter((_, i) => i !== idx));
  };

  // Filtered list of assignable users
  const visibleUsers = useMemo(() => {
    let list = assignableUsers;
    if (selectedDeptId) {
      list = list.filter(u => u.primaryDepartmentId === selectedDeptId);
    }
    if (capabilityFilter.trim()) {
      list = list.filter(u =>
        u.capabilities.some(c =>
          c.toLowerCase().includes(capabilityFilter.trim().toLowerCase())
        )
      );
    }
    return list;
  }, [assignableUsers, selectedDeptId, capabilityFilter]);

  const handleCreateTask = async () => {
    if (selectedUserIds.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 cán bộ thực hiện nhiệm vụ.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Lưu ý: createTaskFromInboxApi chỉ nhận 1 assignee. Nếu multi, vẫn dùng assigner đầu tiên
      // và serialize các checker vào RequiredResults.
      const primaryAssignee = selectedUserIds[0];
      const docText = [
        aiExtractedDocumentText,
        instructions.trim() ? `\n\nHướng dẫn bổ sung:\n${instructions.trim()}` : '',
        requiredResults.length
          ? `\n\nKết quả mong đợi:\n- ${requiredResults.join('\n- ')}`
          : '',
      ].join('');

      const res = await createTaskFromInboxApi(documentId, {
        assigneeId: primaryAssignee,
        departmentId: selectedDeptId || undefined,
        priority,
        // Mở rộng payload (cần backend hỗ trợ — server side sẽ ghép vào requirements)
        description: docText,
        // Multi-assignee — serialize để format Requirements nhiều dòng
        requirements: requiredResults.join('\n'),
      } as any);

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
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
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
                  Phân Công Nhiệm Vụ Bằng AI
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  Tham mưu phân công
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Hệ thống rà soát năng lực và tải việc để đề xuất cán bộ phù hợp.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Đóng hộp thoại"
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
                Đang rà soát phân bổ khối lượng công việc của cán bộ...
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
              {/* 0. TÀI LIỆU / CHỈ THỊ AI (READONLY) + HƯỚNG DẪN BỔ SUNG (EDIT) */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Tài liệu / Chỉ thị AI đã rà soát (read-only)
                  </h3>
                  <textarea
                    readOnly
                    rows={4}
                    value={aiExtractedDocumentText || 'Không có nội dung phân tích trước.'}
                    className="mt-1 w-full text-xs p-3 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Hướng dẫn bổ sung (tối đa 1000 ký tự)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    placeholder="VD: Cần phối hợp với Phòng Tư pháp xác minh hồ sơ lý lịch tư pháp."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </section>

              {/* 1. KẾT QUẢ MONG ĐỢI (CHECKLIST) */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-2">
                  <ListChecks className="w-3.5 h-3.5 text-slate-500" />
                  Kết quả mong đợi (checklist)
                </h3>
                <div className="space-y-2">
                  {requiredResults.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-50/60 border border-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 rounded"
                        aria-label={`Kết quả ${idx + 1}`}
                      />
                      <span className="flex-1 text-sm text-slate-700">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeRequiredResult(idx)}
                        className="text-rose-600 hover:bg-rose-50 p-1 rounded"
                        aria-label="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </label>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newRequiredResult}
                      onChange={(e) => setNewRequiredResult(e.target.value)}
                      placeholder="Thêm mục kết quả mới..."
                      className="flex-1 text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addRequiredResult();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addRequiredResult}
                      className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm mục
                    </button>
                  </div>
                </div>
              </section>

              {/* 2. AI Top-Pick Recommendation */}
              {selectedUserIds.length === 0 && (
                <div className="p-4.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-white border-2 border-indigo-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                      ⭐ Đề Xuất Phù Hợp Nhất
                    </span>
                    <span className="text-xs font-semibold text-indigo-700">
                      Độ tương thích: {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      suggestion.suggestedUserId && toggleSelectedUser(suggestion.suggestedUserId)
                    }
                    className="text-left w-full"
                  >
                    <div className="text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                      {suggestion.suggestedUserName}
                    </div>
                    <div className="mt-2 p-3 bg-white/80 backdrop-blur-xs rounded-xl border border-indigo-100/80 text-xs text-slate-700 leading-relaxed">
                      <strong className="text-indigo-900 font-semibold block mb-1">
                        💡 Căn cứ đề xuất:
                      </strong>
                      {suggestion.reason}
                    </div>
                  </button>
                </div>
              )}

              {/* 3. CAPABILITY-AWARE ASSIGNABLE USER PICKER */}
              <section className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    Phòng ban & năng lực cán bộ (chọn 1 hoặc nhiều)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManualOverride(!isManualOverride)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    {isManualOverride ? 'Ẩn danh sách' : 'Mở rộng'}
                  </button>
                </div>

                {isManualOverride && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Lọc theo phòng ban
                        </label>
                        <div className="relative">
                          <select
                            value={selectedDeptId}
                            onChange={(e) => {
                              setSelectedDeptId(e.target.value);
                            }}
                            className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">-- Tất cả phòng ban --</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Lọc theo năng lực / chuyên môn
                        </label>
                        <input
                          type="text"
                          placeholder="VD: Địa chính, Hộ tịch, Tư pháp, Văn phòng, ..."
                          value={capabilityFilter}
                          onChange={(e) => setCapabilityFilter(e.target.value)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {loadingUsers && (
                        <div className="text-xs text-slate-500 italic">Đang tải danh sách cán bộ...</div>
                      )}
                      {!loadingUsers && visibleUsers.length === 0 && (
                        <div className="text-xs text-slate-500 italic">
                          Không có cán bộ phù hợp bộ lọc hiện tại.
                        </div>
                      )}
                      {visibleUsers.map((u) => {
                        const isSelf = user?.userId === u.id;
                        const checked = selectedUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                              checked
                                ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                                : isSelf
                                ? 'bg-rose-50/40 border-rose-200 opacity-70'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={`usr-${u.id}`}
                              checked={checked}
                              disabled={isSelf}
                              onChange={() => toggleSelectedUser(u.id)}
                              className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                              aria-label={u.fullName}
                              title={isSelf ? 'Không thể tự giao việc cho chính mình' : undefined}
                            />
                            <label htmlFor={`usr-${u.id}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <div className="font-bold text-sm text-slate-900">
                                  {u.fullName} {isSelf && <span className="text-xs text-rose-600">(chính bạn — không thể chọn)</span>}
                                </div>
                                <div className="text-xs text-indigo-600 font-semibold">
                                  AI: {Math.round(u.matchConfidence * 100)}%
                                </div>
                              </div>
                              <div className="text-xs text-slate-600 mt-1 space-x-2">
                                {u.roleName && <span>{u.roleName}</span>}
                                {u.departmentName && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                                    {u.departmentName}
                                  </span>
                                )}
                                <span className="text-slate-500">
                                  Tải: {u.utilizationRate}% • Quá hạn: {u.overdueTaskCount} • Hiện tại: {u.currentTaskCount}
                                </span>
                              </div>
                              {u.capabilityMatches && u.capabilityMatches.length > 0 && (
                                <div className="mt-1 text-[11px] text-emerald-700 italic">
                                  Trùng: {u.capabilityMatches.join(', ')}
                                </div>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* 4. Task Priority Selector */}
              <section>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
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
              </section>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 inline-block mr-1" />
                  {errorMsg}
                </div>
              )}

              {/* Selected summary */}
              {selectedUserIds.length > 0 && (
                <div className="text-xs text-slate-700 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-200">
                  <strong>{selectedUserIds.length}</strong> cán bộ đã chọn:{' '}
                  {selectedUserIds
                    .map(
                      (id) =>
                        visibleUsers.find((u) => u.id === id)?.fullName ||
                        allUsers.find((u) => u.id === id)?.name ||
                        id
                    )
                    .join(', ')}
                </div>
              )}
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
            disabled={isSubmitting || loading || selectedUserIds.length === 0}
            onClick={handleCreateTask}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang tạo nhiệm vụ và chuyển giao...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                Phê Chuẩn & Giao Việc
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
