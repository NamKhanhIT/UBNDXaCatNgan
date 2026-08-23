'use client';

import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../components/ui/ToastContext';
import { parseCvPdfWithAi, ExtractedCvWorkProfile } from '../services/cv-ai-parser.service';

interface SavedWorkProfile {
  yearsOfExperience: number;
  expertise: string[];
  education: {
    degree: string;
    institution: string;
    major: string;
    graduationYear?: number;
  };
  certifications: string[];
  foreignLanguages: string[];
  achievements: string[];
  previousPositions: string[];
}

const INITIAL_PROFILE: SavedWorkProfile = {
  yearsOfExperience: 7,
  expertise: ['Quản lý đất đai', 'Quy hoạch xây dựng nông thôn mới', 'Thẩm định hồ sơ chuyển mục đích sử dụng đất', 'Bồi thường GPMB'],
  education: {
    degree: 'Kỹ sư',
    institution: 'Học viện Nông nghiệp Việt Nam',
    major: 'Quản lý Đất đai',
    graduationYear: 2014,
  },
  certifications: [
    'Chứng chỉ Bồi dưỡng Quản lý Nhà nước ngạch Chuyên viên',
    'Chứng chỉ Hệ thống Thông tin Đất đai VBDLIS',
    'Chứng chỉ Kiến thức Quốc phòng - An ninh Đối tượng 4',
  ],
  foreignLanguages: ['Tiếng Anh B1 (CEFR)'],
  achievements: [
    'Chiến sĩ thi đua cấp cơ sở năm 2023, 2025',
    'Giấy khen Chủ tịch UBND huyện Thanh Chương',
  ],
  previousPositions: [
    'Công chức Địa chính - Xây dựng xã Cát Ngạn (2021 - nay)',
    'Cán bộ hợp đồng đo đạc địa chính xã Cát Ngạn (2019 - 2021)',
  ],
};

export function WorkProfileAiTab() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Hồ sơ đã lưu chính thức (Persisted state)
  const [profile, setProfile] = useState<SavedWorkProfile>(INITIAL_PROFILE);

  // Trạng thái Upload & AI Preview tạm thời (F5 sẽ mất — tuân thủ quy tắc không lưu ngầm)
  const [isParsingAi, setIsParsingAi] = useState<boolean>(false);
  const [aiPreviewData, setAiPreviewData] = useState<ExtractedCvWorkProfile | null>(null);
  const [uploadedCvFileName, setUploadedCvFileName] = useState<string>('');

  // Xử lý khi chọn file CV PDF
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      addToast('Định dạng không hợp lệ', 'Hệ thống yêu cầu tải lên tệp hồ sơ định dạng PDF', 'warning');
      return;
    }

    try {
      setIsParsingAi(true);
      setUploadedCvFileName(file.name);
      addToast('Đang phân tích', `Trí tuệ nhân tạo đang trích xuất dữ liệu từ CV: ${file.name}...`, 'info');

      const extracted = await parseCvPdfWithAi(file);
      setAiPreviewData(extracted);
      addToast('Trích xuất thành công', 'AI đã phân tích xong cấu trúc CV. Vui lòng kiểm tra bản xem trước!', 'success');
    } catch (err: any) {
      addToast('Lỗi phân tích', err.message || 'Không thể trích xuất hồ sơ từ CV', 'danger');
    } finally {
      setIsParsingAi(false);
    }
  };

  // Người dùng xác nhận lưu bản trích xuất AI vào cơ sở dữ liệu hồ sơ
  const handleConfirmAiProfile = () => {
    if (!aiPreviewData) return;

    const newProfile: SavedWorkProfile = {
      yearsOfExperience: aiPreviewData.yearsOfExperience.value ?? profile.yearsOfExperience,
      expertise: aiPreviewData.expertise.value ?? profile.expertise,
      education: aiPreviewData.education.value ?? profile.education,
      certifications: aiPreviewData.certifications.value ?? profile.certifications,
      foreignLanguages: aiPreviewData.foreignLanguages.value ?? profile.foreignLanguages,
      achievements: aiPreviewData.achievements.value ?? profile.achievements,
      previousPositions: aiPreviewData.previousPositions.value ?? profile.previousPositions,
    };

    setProfile(newProfile);
    setAiPreviewData(null);
    setUploadedCvFileName('');
    addToast('Xác nhận thành công', 'Đã lưu hồ sơ công vụ chính thức vào cơ sở dữ liệu!', 'success');
  };

  // Hủy bản xem trước AI
  const handleCancelAiPreview = () => {
    setAiPreviewData(null);
    setUploadedCvFileName('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. KHỐI UPLOAD CV AI PIPELINE ── */}
      <div
        className="card"
        style={{
          border: '1.5px dashed #3b82f6',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
        }}
      >
        <div className="card-body" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ maxWidth: 540 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-blue" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                  AI Human-In-The-Loop
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Trích Xuất Hồ Sơ Công Vụ Tự Động Từ CV (PDF)
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                Hệ thống AI tự động phân tích CV, trích dẫn số trang và đoạn văn gốc. Dữ liệu chỉ được cập nhật khi đồng chí duyệt và bấm <strong>Xác Nhận</strong>.
              </p>
            </div>

            <div>
              <input
                type="file"
                id="cv-pdf-upload"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isParsingAi}
              />
              <label
                htmlFor="cv-pdf-upload"
                className="btn btn-primary"
                style={{
                  cursor: isParsingAi ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                }}
              >
                <i className={`fa-solid ${isParsingAi ? 'fa-circle-notch fa-spin' : 'fa-file-pdf'}`} aria-hidden="true" />
                <span>{isParsingAi ? 'AI Đang Xử Lý...' : 'Tải Lên CV (PDF)'}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KHỐI PREVIEW TRÍCH XUẤT AI (KHI ĐANG XEM TRƯỚC) ── */}
      {aiPreviewData && (
        <div
          className="card"
          style={{
            border: '2px solid #8b5cf6',
            background: '#faf5ff',
            boxShadow: '0 8px 24px rgba(139,92,246,0.15)',
          }}
        >
          <div
            className="card-header"
            style={{
              background: '#f3e8ff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e9d5ff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#7c3aed', fontSize: 18 }} aria-hidden="true" />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#5b21b6', margin: 0 }}>
                  Bản Xem Trước Trích Xuất AI (Chưa lưu Database — Tệp: {uploadedCvFileName})
                </h3>
                <div style={{ fontSize: '0.76rem', color: '#6b21a8', marginTop: 2 }}>
                  Vui lòng đối soát từng trường dữ liệu với trích dẫn gốc trước khi xác nhận ghi vào hồ sơ.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCancelAiPreview}
                style={{ color: '#6b21a8', fontWeight: 700 }}
              >
                Hủy xem trước
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmAiProfile}
                style={{ background: '#7c3aed', borderColor: '#7c3aed', fontWeight: 800, padding: '6px 16px' }}
              >
                <i className="fa-solid fa-check" style={{ marginRight: 6 }} aria-hidden="true" />
                Xác Nhận & Cập Nhật Hồ Sơ
              </button>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
            {/* Field 1: Kinh nghiệm */}
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>
                  1. Số năm kinh nghiệm công tác:
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  Độ tin cậy: {Math.round(aiPreviewData.yearsOfExperience.confidence * 100)}% (Trang {aiPreviewData.yearsOfExperience.sourcePage})
                </span>
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>
                {aiPreviewData.yearsOfExperience.value} năm
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: 4 }}>
                <em>Trích dẫn gốc:</em> "{aiPreviewData.yearsOfExperience.sourceText}"
              </div>
            </div>

            {/* Field 2: Chuyên môn */}
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>
                  2. Chuyên môn & Lĩnh vực phụ trách:
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  Độ tin cậy: {Math.round(aiPreviewData.expertise.confidence * 100)}% (Trang {aiPreviewData.expertise.sourcePage})
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {aiPreviewData.expertise.value?.map((item, idx) => (
                  <span key={idx} className="badge badge-blue" style={{ fontSize: '0.78rem' }}>
                    {item}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: 4 }}>
                <em>Trích dẫn gốc:</em> "{aiPreviewData.expertise.sourceText}"
              </div>
            </div>

            {/* Field 3: Trình độ học vấn */}
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>
                  3. Trình độ học vấn & Bằng cấp:
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  Độ tin cậy: {Math.round(aiPreviewData.education.confidence * 100)}% (Trang {aiPreviewData.education.sourcePage})
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                {aiPreviewData.education.value?.degree} — Chuyên ngành: {aiPreviewData.education.value?.major}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}>
                Cơ sở đào tạo: {aiPreviewData.education.value?.institution} ({aiPreviewData.education.value?.graduationYear})
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: 4 }}>
                <em>Trích dẫn gốc:</em> "{aiPreviewData.education.sourceText}"
              </div>
            </div>

            {/* Field 4: Chứng chỉ đào tạo */}
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>
                  4. Chứng chỉ bồi dưỡng & Nghiệp vụ:
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  Độ tin cậy: {Math.round(aiPreviewData.certifications.confidence * 100)}% (Trang {aiPreviewData.certifications.sourcePage})
                </span>
              </div>
              <ul style={{ margin: '0 0 6px 0', paddingLeft: 20, fontSize: '0.84rem', color: '#334155' }}>
                {aiPreviewData.certifications.value?.map((cert, idx) => (
                  <li key={idx} style={{ marginBottom: 2 }}>{cert}</li>
                ))}
              </ul>
              <div style={{ fontSize: '0.74rem', color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: 4 }}>
                <em>Trích dẫn gốc:</em> "{aiPreviewData.certifications.sourceText}"
              </div>
            </div>

            {/* Ghi chú bảo vệ quyền/role của AI */}
            <div style={{ padding: '8px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, fontSize: '0.78rem', color: '#92400e' }}>
              🛡️ <strong>Nguyên tắc an toàn công vụ:</strong> Vị trí công tác gợi ý từ CV (<em>"{aiPreviewData.suggestedRoleNote.value}"</em>) chỉ được hiển thị để tham khảo và <strong>KHÔNG</strong> tự động thay đổi Chức vụ/Phân quyền chính thức trên hệ thống.
            </div>
          </div>
        </div>
      )}

      {/* ── 3. BẢNG HỒ SƠ CÔNG VỤ HIỆN TẠI (PERSISTED WORK PROFILE) ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-id-card" style={{ color: '#2563eb' }} aria-hidden="true" />
            <span>Hồ Sơ Năng Lực & Quá Trình Công Tác Cán Bộ</span>
          </h2>
          <span className="badge badge-success">Dữ liệu chính thức</span>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section: Chuyên môn & Kinh nghiệm */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>
                KINH NGHIỆM CÔNG TÁC
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1d4ed8' }}>
                {profile.yearsOfExperience} Năm
              </div>
              <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 4 }}>
                Trong ngành quản lý hành chính nhà nước cấp xã
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, marginBottom: 6 }}>
                LĨNH VỰC CHUYÊN MÔN CHỦ CHỐT
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {profile.expertise.map((exp, idx) => (
                  <span key={idx} className="badge badge-blue" style={{ fontSize: '0.78rem', padding: '3px 8px' }}>
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Học vấn & Chứng chỉ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-graduation-cap" style={{ color: '#2563eb' }} aria-hidden="true" />
                <span>Trình Độ Học Vấn & Bằng Cấp</span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                {profile.education.degree} — {profile.education.major}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                {profile.education.institution} ({profile.education.graduationYear})
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-certificate" style={{ color: '#d97706' }} aria-hidden="true" />
                <span>Chứng Chỉ Bồi Dưỡng Nghiệp Vụ</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: '#334155' }}>
                {profile.certifications.map((cert, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{cert}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section: Khen thưởng & Lịch sử công tác */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-award" style={{ color: '#16a34a' }} aria-hidden="true" />
                <span>Khen Thưởng & Thành Tích</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: '#334155' }}>
                {profile.achievements.map((ach, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{ach}</li>
                ))}
              </ul>
            </div>

            <div style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-briefcase" style={{ color: '#7c3aed' }} aria-hidden="true" />
                <span>Quá Trình Công Tác</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: '#334155' }}>
                {profile.previousPositions.map((pos, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{pos}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
