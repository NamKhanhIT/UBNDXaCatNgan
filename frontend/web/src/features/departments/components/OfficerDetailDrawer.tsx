'use client';

import React, { useState } from 'react';
import { UserDto as PaginatedUserDto } from '../../../services/user.service';
import { parseCvPdfWithAi, ExtractedCvWorkProfile } from '../../settings/services/cv-ai-parser.service';
import { useToast } from '../../../components/ui/ToastContext';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface OfficerDetailDrawerProps {
  user: PaginatedUserDto | null;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (userId: string, updatedData: Partial<PaginatedUserDto>) => void;
}

interface SavedWorkProfile {
  yearsOfExperience: number;
  expertise: string[];
  education: {
    degree: string;
    institution: string;
    major: string;
    graduationYear: number;
  };
  certifications: string[];
  foreignLanguages: string[];
  achievements: string[];
  previousPositions: string[];
}

const DEFAULT_PROFILE: SavedWorkProfile = {
  yearsOfExperience: 6,
  expertise: ['Quản lý đất đai', 'Địa chính cấp xã', 'Thẩm định hồ sơ', 'Quy hoạch nông thôn mới'],
  education: {
    degree: 'Kỹ sư / Cử nhân',
    institution: 'Học viện Hành chính Quốc gia / ĐH Nông nghiệp',
    major: 'Quản lý Đất đai & Hành chính công',
    graduationYear: 2018,
  },
  certifications: [
    'Chứng chỉ Quản lý Nhà nước ngạch Chuyên viên',
    'Chứng chỉ Ứng dụng CNTT trong cơ quan nhà nước',
    'Chứng chỉ Bồi dưỡng Kiến thức Quốc phòng - An ninh Đối tượng 4',
  ],
  foreignLanguages: ['Tiếng Anh B1 (Khung Châu Âu)'],
  achievements: [
    'Chiến sĩ thi đua cấp cơ sở năm 2024, 2025',
    'Giấy khen của Chủ tịch UBND xã về thành tích xuất sắc trong công tác chuyển đổi số',
  ],
  previousPositions: [
    'Chuyên viên phụ trách chuyên môn (2020 - nay)',
    'Cán bộ hợp đồng hành chính (2018 - 2020)',
  ],
};

export function OfficerDetailDrawer({ user, isOpen, onClose, onProfileUpdated }: OfficerDetailDrawerProps) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'cv-upload'>('profile');
  const [profile, setProfile] = useState<SavedWorkProfile>(DEFAULT_PROFILE);

  // AI Extraction States
  const [isUploading, setIsUploading] = useState(false);
  const [aiPreviewData, setAiPreviewData] = useState<ExtractedCvWorkProfile | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  if (!isOpen || !user) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && !file.name.toLowerCase().endsWith('.docx')) {
      addToast('Định dạng không hỗ trợ', 'Vui lòng chọn tệp CV định dạng PDF hoặc DOCX.', 'warning');
      return;
    }

    try {
      setIsUploading(true);
      setUploadedFileName(file.name);
      const extracted = await parseCvPdfWithAi(file);
      setAiPreviewData(extracted);
      addToast('Bóc tách CV thành công', `AI đã trích xuất thành công hồ sơ từ tệp "${file.name}".`, 'success');
    } catch (err) {
      console.error('Lỗi khi bóc tách CV:', err);
      addToast('Lỗi bóc tách CV', 'Không thể xử lý tệp CV này. Vui lòng kiểm tra lại.', 'danger');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyAiProfile = () => {
    if (!aiPreviewData) return;

    const newProfile: SavedWorkProfile = {
      yearsOfExperience: aiPreviewData.yearsOfExperience.value ?? profile.yearsOfExperience,
      expertise: aiPreviewData.expertise.value ?? profile.expertise,
      education: aiPreviewData.education.value
        ? {
            degree: aiPreviewData.education.value.degree,
            institution: aiPreviewData.education.value.institution,
            major: aiPreviewData.education.value.major,
            graduationYear: aiPreviewData.education.value.graduationYear ?? profile.education.graduationYear,
          }
        : profile.education,
      certifications: aiPreviewData.certifications.value ?? profile.certifications,
      foreignLanguages: aiPreviewData.foreignLanguages.value ?? profile.foreignLanguages,
      achievements: aiPreviewData.achievements.value ?? profile.achievements,
      previousPositions: aiPreviewData.previousPositions.value ?? profile.previousPositions,
    };

    setProfile(newProfile);
    if (onProfileUpdated) {
      onProfileUpdated(user.id, {
        yearsOfExperience: newProfile.yearsOfExperience,
        expertise: newProfile.expertise.join(', '),
      });
    }

    addToast('Đã cập nhật hồ sơ', `Hồ sơ năng lực của cán bộ ${user.fullName} đã được đồng bộ từ CV AI.`, 'success');
    setActiveTab('profile');
    setAiPreviewData(null);
  };

  const assignedHours = user.assignedHours || 0;
  const maxHours = user.maxHours || 40;
  const loadRate = user.utilizationRate ?? Math.min(100, (assignedHours / maxHours) * 100);
  const isOver = user.isOverloaded || loadRate > 80;

  return (
    <div className="drawer-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.1rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              {user.fullName.split(' ').pop()?.[0] || 'CB'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {user.fullName}
                </h2>
                <Badge variant={user.rankLevel === 1 ? 'info' : user.rankLevel <= 3 ? 'success' : 'neutral'}>
                  {user.roleName || 'Cán bộ công chức'}
                </Badge>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                <i className="fa-solid fa-building-columns" style={{ marginRight: 5 }} />
                {user.departmentName || 'Văn phòng HĐND & UBND'} • Mã: <span style={{ fontFamily: 'monospace' }}>{user.username}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Đóng ngăn kéo"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Capacity Quick Banner */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Định mức tải việc tuần:</span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isOver ? '#dc2626' : '#0f172a' }}>
              {assignedHours}h / {maxHours}h ({loadRate.toFixed(0)}%)
            </span>
          </div>
          <div style={{ width: 140 }}>
            <div className="progress-bar" style={{ height: 6 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(100, loadRate)}%`,
                  background: isOver ? '#dc2626' : loadRate > 70 ? '#d97706' : '#2563eb',
                }}
              />
            </div>
          </div>
          <Badge variant={isOver ? 'danger' : loadRate > 70 ? 'warning' : 'success'}>
            {isOver ? 'Quá tải việc' : loadRate > 70 ? 'Tải tối ưu' : 'Còn dung lượng'}
          </Badge>
        </div>

        {/* Drawer Tabs */}
        <div className="drawer-tabs">
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <i className="fa-solid fa-id-card-clip" />
            <span>Hồ Sơ Năng Lực & CV</span>
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'cv-upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('cv-upload')}
          >
            <i className="fa-solid fa-wand-magic-sparkles" />
            <span>Bóc Tách CV Bằng AI</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {activeTab === 'profile' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 1. Thông tin liên hệ công vụ */}
              <div className="profile-section-card">
                <h3 className="profile-section-title">
                  <i className="fa-solid fa-address-card" />
                  <span>Thông Tin Hành Chính</span>
                </h3>
                <div className="profile-grid">
                  <div>
                    <span className="profile-label">Email công vụ:</span>
                    <span className="profile-value">{user.email || `${user.username}@catngan.gov.vn`}</span>
                  </div>
                  <div>
                    <span className="profile-label">Số điện thoại:</span>
                    <span className="profile-value">0912.345.678 (Nội bộ)</span>
                  </div>
                  <div>
                    <span className="profile-label">Ngạch công chức:</span>
                    <span className="profile-value">{user.rankLevel <= 3 ? 'Chuyên viên chính / Lãnh đạo' : 'Chuyên viên quản lý nhà nước'}</span>
                  </div>
                  <div>
                    <span className="profile-label">Thâm niên công tác:</span>
                    <span className="profile-value" style={{ fontWeight: 800, color: '#2563eb' }}>
                      {profile.yearsOfExperience} Năm kinh nghiệm
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Trình độ học vấn */}
              <div className="profile-section-card">
                <h3 className="profile-section-title">
                  <i className="fa-solid fa-graduation-cap" />
                  <span>Trình Độ Đào Tạo & Học Vấn</span>
                </h3>
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                    {profile.education.degree} — {profile.education.major}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                    {profile.education.institution} (Tốt nghiệp năm {profile.education.graduationYear})
                  </div>
                </div>
              </div>

              {/* 3. Kỹ năng & Chuyên môn trọng tâm */}
              <div className="profile-section-card">
                <h3 className="profile-section-title">
                  <i className="fa-solid fa-briefcase" />
                  <span>Lĩnh Vực Chuyên Môn Trọng Tâm</span>
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {profile.expertise.map((exp, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        padding: '4px 10px',
                        borderRadius: 14,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      {exp}
                    </span>
                  ))}
                </div>
              </div>

              {/* 4. Chứng chỉ & Bồi dưỡng chuyên ngành */}
              <div className="profile-section-card">
                <h3 className="profile-section-title">
                  <i className="fa-solid fa-certificate" />
                  <span>Chứng Chỉ Bồi Dưỡng Chuyên Ngành</span>
                </h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {profile.certifications.map((cert, idx) => (
                    <li key={idx}>{cert}</li>
                  ))}
                </ul>
              </div>

              {/* 5. Khen thưởng & Thành tích */}
              <div className="profile-section-card">
                <h3 className="profile-section-title">
                  <i className="fa-solid fa-award" />
                  <span>Khen Thưởng & Quá Trình Công Tác</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {profile.achievements.map((ach, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#166534' }}>
                      <i className="fa-solid fa-medal" style={{ color: '#d97706' }} />
                      <span>{ach}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Upload Box */}
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: 10,
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileUpload}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                  disabled={isUploading}
                />
                <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 32, color: '#2563eb', marginBottom: 10 }} />
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                  {isUploading ? 'AI đang đọc và bóc tách dữ liệu CV...' : 'Tải lên tệp CV (PDF / DOCX)'}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '6px 0 0 0' }}>
                  Hệ thống AI sẽ tự động đọc hiểu học vị, chuyên ngành, số năm kinh nghiệm và chứng chỉ công vụ.
                </p>
                {uploadedFileName && (
                  <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
                    <i className="fa-solid fa-file-pdf" style={{ marginRight: 6 }} />
                    {uploadedFileName}
                  </div>
                )}
              </div>

              {/* AI Extraction Results Preview */}
              {aiPreviewData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fa-solid fa-brain" style={{ color: '#7c3aed' }} />
                      <span>Kết Quả AI Bóc Tách (4 Thành Phần)</span>
                    </h3>
                    <Button variant="primary" size="sm" onClick={handleApplyAiProfile}>
                      <i className="fa-solid fa-check" style={{ marginRight: 6 }} />
                      Cập Nhật Vào Hồ Sơ
                    </Button>
                  </div>

                  {/* Bảng đối soát 4 thành phần */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Năm kinh nghiệm */}
                    <div className="ai-extracted-field-card">
                      <div className="ai-field-header">
                        <span className="ai-field-name">Số năm kinh nghiệm</span>
                        <span className="ai-confidence-badge">{(aiPreviewData.yearsOfExperience.confidence * 100).toFixed(0)}% tin cậy</span>
                      </div>
                      <div className="ai-field-value">{aiPreviewData.yearsOfExperience.value} Năm</div>
                      <div className="ai-field-quote">
                        Trang {aiPreviewData.yearsOfExperience.sourcePage}: "{aiPreviewData.yearsOfExperience.sourceText}"
                      </div>
                    </div>

                    {/* Học vấn */}
                    <div className="ai-extracted-field-card">
                      <div className="ai-field-header">
                        <span className="ai-field-name">Trình độ học vấn</span>
                        <span className="ai-confidence-badge">{(aiPreviewData.education.confidence * 100).toFixed(0)}% tin cậy</span>
                      </div>
                      <div className="ai-field-value">
                        {aiPreviewData.education.value?.degree} — {aiPreviewData.education.value?.major} ({aiPreviewData.education.value?.institution})
                      </div>
                      <div className="ai-field-quote">
                        Trang {aiPreviewData.education.sourcePage}: "{aiPreviewData.education.sourceText}"
                      </div>
                    </div>

                    {/* Kỹ năng chuyên môn */}
                    <div className="ai-extracted-field-card">
                      <div className="ai-field-header">
                        <span className="ai-field-name">Kỹ năng chuyên môn</span>
                        <span className="ai-confidence-badge">{(aiPreviewData.expertise.confidence * 100).toFixed(0)}% tin cậy</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0' }}>
                        {aiPreviewData.expertise.value?.map((exp, i) => (
                          <span key={i} className="badge badge-blue" style={{ fontSize: '0.75rem' }}>{exp}</span>
                        ))}
                      </div>
                      <div className="ai-field-quote">
                        Trang {aiPreviewData.expertise.sourcePage}: "{aiPreviewData.expertise.sourceText}"
                      </div>
                    </div>

                    {/* Chứng chỉ */}
                    <div className="ai-extracted-field-card">
                      <div className="ai-field-header">
                        <span className="ai-field-name">Chứng chỉ bồi dưỡng</span>
                        <span className="ai-confidence-badge">{(aiPreviewData.certifications.confidence * 100).toFixed(0)}% tin cậy</span>
                      </div>
                      <ul style={{ margin: '4px 0', paddingLeft: 16, fontSize: '0.8rem', color: '#334155' }}>
                        {aiPreviewData.certifications.value?.map((cert, i) => (
                          <li key={i}>{cert}</li>
                        ))}
                      </ul>
                      <div className="ai-field-quote">
                        Trang {aiPreviewData.certifications.sourcePage}: "{aiPreviewData.certifications.sourceText}"
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
