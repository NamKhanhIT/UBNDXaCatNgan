'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
  File,
  Cpu,
  Eye
} from 'lucide-react';
import { uploadAndAnalyzeApi } from '../services/files.service';
import { DocumentAnalysisResult } from '../services/inbox.service';

export interface AiUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentNumberSymbol?: string;
  onAnalysisComplete: (result: DocumentAnalysisResult) => void;
}

export const AiUploadModal: React.FC<AiUploadModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentNumberSymbol,
  onAnalysisComplete
}) => {
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<'idle' | 'uploading' | 'analyzing' | 'done'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMsg(null);
    const maxBytes = 20 * 1024 * 1024; // 20MB
    if (file.size > maxBytes) {
      setErrorMsg(`File quá lớn (${(file.size / (1024 * 1024)).toFixed(1)}MB). Giới hạn tối đa là 20MB.`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'xlsx'];
    if (!ext || !allowed.includes(ext)) {
      setErrorMsg(`Định dạng .${ext} không được hỗ trợ. Chỉ nhận: PDF, DOCX, JPG, PNG, XLSX.`);
      return;
    }

    setSelectedFile(file);
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;

    setErrorMsg(null);
    setStep('uploading');

    try {
      // Small simulated step update for UX
      setTimeout(() => {
        setStep('analyzing');
      }, 1000);

      const res = await uploadAndAnalyzeApi(selectedFile, documentId);

      if (!res.success) {
        setErrorMsg(res.error || 'Upload hoặc phân tích AI thất bại.');
        setStep('idle');
        return;
      }

      if (res.analysisResult) {
        setStep('done');
        setTimeout(() => {
          onClose();
          onAnalysisComplete(res.analysisResult);
        }, 600);
      } else if (res.aiError) {
        setErrorMsg(res.aiError);
        setStep('idle');
      } else {
        setErrorMsg('Không nhận được kết quả phân tích từ AI.');
        setStep('idle');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi mạng khi tải file lên máy chủ.');
      setStep('idle');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Tải Lên & Phân Tích AI
              </h2>
              <p className="text-xs text-slate-500">
                {documentNumberSymbol ? `Văn bản: ${documentNumberSymbol}` : 'Trích xuất OCR và phân loại văn bản tự động'}
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {step === 'idle' ? (
            <>
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/60 bg-slate-50/30'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Kéo thả văn bản scan / PDF vào đây hoặc{' '}
                    <span className="text-indigo-600 underline">duyệt từ máy</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Hỗ trợ: PDF, DOCX, JPG, PNG scan có dấu mộc (Tối đa 20MB)
                  </p>
                </div>
              </div>

              {/* Selected File Preview */}
              {selectedFile && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <div className="flex items-center gap-3">
                    <File className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-10 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-indigo-600 animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-slate-800">
                  {step === 'uploading'
                    ? 'Đang tải file lên máy chủ nội bộ...'
                    : step === 'analyzing'
                    ? 'Đang OCR & Phân tích văn bản với Qwen AI...'
                    : 'Phân tích hoàn tất!'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  {step === 'uploading'
                    ? 'Lưu trữ tài liệu bảo mật trên server xã Cát Ngạn'
                    : 'Trích xuất tiêu đề, hạn chót, phòng ban & tóm tắt cốt lõi'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'idle' && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Hủy
            </button>

            <button
              type="button"
              disabled={!selectedFile}
              onClick={handleStartAnalysis}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Bắt Đầu Phân Tích AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
