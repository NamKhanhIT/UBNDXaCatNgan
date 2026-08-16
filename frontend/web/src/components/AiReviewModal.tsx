'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  UserCheck,
  FileCheck,
  AlertTriangle,
  Clock,
  Building2,
  Tag,
  CheckCircle2,
  X,
  Target,
  FileText
} from 'lucide-react';
import {
  DocumentAnalysisResult,
  ConfirmClassificationRequest,
  confirmClassificationApi
} from '../services/inbox.service';

export interface AiReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  initialData?: DocumentAnalysisResult | null;
  departments: { id: string; name: string }[];
  onConfirmSuccess?: (route: 'event' | 'assign' | 'review', data: any) => void;
  onProceedToAssign?: (documentId: string, analysisData: DocumentAnalysisResult) => void;
}

export const AiReviewModal: React.FC<AiReviewModalProps> = ({
  isOpen,
  onClose,
  documentId,
  initialData,
  departments,
  onConfirmSuccess,
  onProceedToAssign
}) => {
  const [category, setCategory] = useState<string>('TaskAssignmentDown');
  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [deadlineDate, setDeadlineDate] = useState<string>('');
  const [eventStartDateTime, setEventStartDateTime] = useState<string>('');
  const [eventEndDateTime, setEventEndDateTime] = useState<string>('');
  const [objectives, setObjectives] = useState<string>('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubjectInput, setNewSubjectInput] = useState<string>('');
  const [suggestedDepartmentId, setSuggestedDepartmentId] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0.85);
  const [deadlineSeemsUnreasonable, setDeadlineSeemsUnreasonable] = useState<boolean>(false);
  const [lowConfidence, setLowConfidence] = useState<boolean>(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setCategory(initialData.category || 'TaskAssignmentDown');
      setTitle(initialData.title || '');
      setSummary(initialData.summary || '');
      setDeadlineDate(
        initialData.deadlineDate ? initialData.deadlineDate.split('T')[0] : ''
      );
      setEventStartDateTime(
        initialData.eventStartDateTime
          ? initialData.eventStartDateTime.substring(0, 16)
          : ''
      );
      setEventEndDateTime(
        initialData.eventEndDateTime
          ? initialData.eventEndDateTime.substring(0, 16)
          : ''
      );
      setObjectives(initialData.objectives || '');
      setSubjects(initialData.subjects || []);
      setSuggestedDepartmentId(initialData.suggestedDepartmentId || '');
      setConfidence(initialData.confidence ?? 0.85);
      setDeadlineSeemsUnreasonable(initialData.deadlineSeemsUnreasonable || false);
      setLowConfidence(initialData.lowConfidence || (initialData.confidence < 0.6));
      setValidationWarnings(initialData.validationWarnings || []);
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleAddSubject = () => {
    if (newSubjectInput.trim() && !subjects.includes(newSubjectInput.trim())) {
      setSubjects([...subjects, newSubjectInput.trim()]);
      setNewSubjectInput('');
    }
  };

  const handleRemoveSubject = (tagToRemove: string) => {
    setSubjects(subjects.filter((t) => t !== tagToRemove));
  };

  const handleRouteAction = async (route: 'event' | 'assign' | 'review') => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const payload: ConfirmClassificationRequest = {
      aiCategory: category,
      aiTitle: title || undefined,
      aiSummary: summary || undefined,
      aiExtractedDeadline: deadlineDate ? new Date(deadlineDate).toISOString() : null,
      aiSuggestedDepartmentId: suggestedDepartmentId || null,
      aiObjectives: objectives || undefined,
      aiExtractedSubjects: subjects.length > 0 ? JSON.stringify(subjects) : undefined,
      route
    };

    try {
      const res = await confirmClassificationApi(documentId, payload);
      if (!res.success) {
        setErrorMsg(res.error || 'Xác nhận kiểm duyệt thất bại.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);

      if (route === 'assign' && onProceedToAssign) {
        onClose();
        onProceedToAssign(documentId, {
          category: category as any,
          title,
          summary,
          deadlineDate: deadlineDate || null,
          eventStartDateTime: eventStartDateTime || null,
          eventEndDateTime: eventEndDateTime || null,
          subjects,
          objectives,
          suggestedDepartmentId: suggestedDepartmentId || null,
          suggestedDepartmentName:
            departments.find((d) => d.id === suggestedDepartmentId)?.name || null,
          confidence,
          deadlineSeemsUnreasonable,
          lowConfidence
        });
      } else {
        if (onConfirmSuccess) {
          onConfirmSuccess(route, res.data);
        }
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi mạng khi gửi kiểm duyệt.');
      setIsSubmitting(false);
    }
  };

  const getConfidenceBadge = () => {
    const percent = Math.round(confidence * 100);
    if (confidence >= 0.8) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Độ tin cậy cao ({percent}%)
        </span>
      );
    }
    if (confidence >= 0.6) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Độ tin cậy vừa ({percent}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        Độ tin cậy thấp ({percent}%)
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Kiểm Duyệt Kết Quả AI Phân Tích
                </h2>
                {getConfidenceBadge()}
              </div>
              <p className="text-xs text-slate-500">
                Mô hình Qwen AI đã trích xuất thông tin. Cán bộ có thể chỉnh sửa trước khi chọn hướng xử lý.
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

        {/* Alerts / Warnings */}
        <div className="px-6 pt-4 space-y-2">
          {lowConfidence && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Cảnh báo độ tin cậy thấp:</strong> AI không chắc chắn về một số trường dữ liệu do bản scan mờ hoặc văn bản phức tạp. Vui lòng rà soát kỹ các trường bên dưới.
              </div>
            </div>
          )}

          {deadlineSeemsUnreasonable && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Hạn chót bất thường:</strong> Ngày hạn chót trích xuất nằm trong quá khứ hoặc quá gần. Vui lòng xác minh lại hạn xử lý thực tế.
              </div>
            </div>
          )}

          {validationWarnings.map((warn, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs"
            >
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>{warn}</div>
            </div>
          ))}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Loại văn bản (AI phân loại)
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
                >
                  <option value="MeetingInvitation">📅 Thư mời / Lịch họp</option>
                  <option value="SuperiorDirective">📜 Chỉ đạo cấp trên</option>
                  <option value="TaskAssignmentDown">📋 Giao việc xuống</option>
                  <option value="ReportSubmissionUp">📥 Báo cáo gửi lên</option>
                  <option value="Other">📄 Loại khác</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Tiêu đề trích xuất
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tiêu đề chính của văn bản..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Tóm tắt nội dung cốt lõi
                </label>
                <textarea
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Tóm tắt 2-3 câu nội dung chính của văn bản..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 leading-relaxed"
                />
              </div>

              {/* Objectives */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  Mục tiêu / Yêu cầu hành động
                </label>
                <input
                  type="text"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="Yêu cầu cụ thể cần thực hiện..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Deadline */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Hạn chót xử lý / Báo cáo
                </label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                />
              </div>

              {/* If Meeting: Start & End DateTime */}
              {category === 'MeetingInvitation' && (
                <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3">
                  <div className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Thời gian diễn ra cuộc họp / sự kiện
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">Bắt đầu</span>
                      <input
                        type="datetime-local"
                        value={eventStartDateTime}
                        onChange={(e) => setEventStartDateTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">Kết thúc</span>
                      <input
                        type="datetime-local"
                        value={eventEndDateTime}
                        onChange={(e) => setEventEndDateTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  Phòng ban thực hiện (AI đề xuất)
                </label>
                <select
                  value={suggestedDepartmentId}
                  onChange={(e) => setSuggestedDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 font-medium"
                >
                  <option value="">-- Chưa chỉ định phòng ban --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  AI chỉ chọn phòng ban có thật trong danh sách hệ thống.
                </span>
              </div>

              {/* Subjects / Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-purple-600" />
                  Đối tượng / Cá nhân liên quan
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {subjects.length === 0 && (
                    <span className="text-xs text-slate-400 italic">Chưa có đối tượng nào</span>
                  )}
                  {subjects.map((sub, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
                    >
                      {sub}
                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(sub)}
                        className="hover:text-purple-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubjectInput}
                    onChange={(e) => setNewSubjectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubject();
                      }
                    }}
                    placeholder="Thêm đối tượng liên quan..."
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer: 3 Routes */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Đóng
          </button>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Route 1: Event */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRouteAction('event')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              Xếp Lịch Họp
            </button>

            {/* Route 3: Review */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRouteAction('review')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <FileCheck className="w-4 h-4 text-slate-600" />
              Nhận Báo Cáo
            </button>

            {/* Route 2: Assign (Primary) */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRouteAction('assign')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              <UserCheck className="w-4 h-4 text-white" />
              Giao Việc Cho Cán Bộ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
