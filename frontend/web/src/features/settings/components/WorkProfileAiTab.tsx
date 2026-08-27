'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../components/ui/ToastContext';
import { parseCvPdfWithAi, ExtractedCvWorkProfile, ProofItem } from '../services/cv-ai-parser.service';
import { getUserProfileApi, updateUserProfileApi } from '../../../services/user.service';
import { ProofDocumentViewerModal, ViewingProofData } from './ProofDocumentViewerModal';
import { formatDateShort } from '../../../lib/formatters';

export interface EducationProfile {
  degree: string;
  institution: string;
  major: string;
  graduationYear?: number;
  proofFileName?: string;
  proofFileUrl?: string;
  proofFileType?: string;
  proofFileSize?: string;
  proofUploadedAt?: string;
}

export interface SavedWorkProfile {
  yearsOfExperience: number;
  expertise: string[];
  education: EducationProfile;
  certifications: (ProofItem | string)[];
  foreignLanguages: string[];
  achievements: (ProofItem | string)[];
  previousPositions: (ProofItem | string)[];
}

const DEFAULT_FALLBACK_PROFILE: SavedWorkProfile = {
  yearsOfExperience: 5,
  expertise: ['Quản lý nhà nước cấp xã', 'Thẩm định hồ sơ hành chính', 'Ứng dụng CNTT'],
  education: {
    degree: 'Cử nhân',
    institution: 'Học viện Hành chính Quốc gia',
    major: 'Quản lý Nhà nước',
    graduationYear: 2018,
  },
  certifications: [
    {
      name: 'Chứng chỉ Bồi dưỡng Quản lý Nhà nước ngạch Chuyên viên',
    },
    {
      name: 'Chứng chỉ Kiến thức Quốc phòng - An ninh Đối tượng 4',
    },
  ],
  foreignLanguages: ['Tiếng Anh B1 (CEFR)'],
  achievements: [
    {
      name: 'Chiến sĩ thi đua cấp cơ sở năm 2025',
    },
  ],
  previousPositions: [
    {
      name: 'Chuyên viên công tác tại UBND Xã (2020 - nay)',
    },
  ],
};

// Helper chuẩn hóa danh sách item có thể là string hoặc ProofItem
function normalizeProofItems(items: (ProofItem | string)[]): ProofItem[] {
  return (items || []).map(item => {
    if (typeof item === 'string') {
      return { name: item };
    }
    return item;
  });
}

// Helper đọc file sang Data URL (Base64) và chuẩn hóa MIME type
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let result = reader.result as string;
      const lowerName = file.name.toLowerCase();
      // Chuẩn hóa MIME type chuẩn trong Data URL nếu trình duyệt nhận diện thành octet-stream hoặc rỗng
      if (lowerName.endsWith('.pdf') && (result.startsWith('data:application/octet-stream') || result.startsWith('data:;'))) {
        result = result.replace(/^data:[^;]*/, 'data:application/pdf');
      } else if (lowerName.match(/\.(jpg|jpeg)$/) && (result.startsWith('data:application/octet-stream') || result.startsWith('data:;'))) {
        result = result.replace(/^data:[^;]*/, 'data:image/jpeg');
      } else if (lowerName.endsWith('.png') && (result.startsWith('data:application/octet-stream') || result.startsWith('data:;'))) {
        result = result.replace(/^data:[^;]*/, 'data:image/png');
      } else if (lowerName.endsWith('.webp') && (result.startsWith('data:application/octet-stream') || result.startsWith('data:;'))) {
        result = result.replace(/^data:[^;]*/, 'data:image/webp');
      }
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function WorkProfileAiTab() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Hồ sơ năng lực chính thức
  const [profile, setProfile] = useState<SavedWorkProfile>(DEFAULT_FALLBACK_PROFILE);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Input states thêm mới mục
  const [newExpertiseTag, setNewExpertiseTag] = useState<string>('');
  
  // Thêm chứng chỉ mới
  const [newCertName, setNewCertName] = useState<string>('');
  const [newCertFile, setNewCertFile] = useState<File | null>(null);
  const [newCertDataUrl, setNewCertDataUrl] = useState<string | null>(null);

  // Thêm thành tích mới
  const [newAchName, setNewAchName] = useState<string>('');
  const [newAchFile, setNewAchFile] = useState<File | null>(null);
  const [newAchDataUrl, setNewAchDataUrl] = useState<string | null>(null);

  // Thêm quá trình công tác mới
  const [newPosName, setNewPosName] = useState<string>('');
  const [newPosFile, setNewPosFile] = useState<File | null>(null);
  const [newPosDataUrl, setNewPosDataUrl] = useState<string | null>(null);

  // Trạng thái Upload & AI Preview tạm thời
  const [isParsingAi, setIsParsingAi] = useState<boolean>(false);
  const [aiPreviewData, setAiPreviewData] = useState<ExtractedCvWorkProfile | null>(null);
  const [uploadedCvFileName, setUploadedCvFileName] = useState<string>('');
  const [uploadedCvDataUrl, setUploadedCvDataUrl] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);

  // Modal xem chi tiết minh chứng
  const [viewingProof, setViewingProof] = useState<ViewingProofData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadWorkProfile() {
      try {
        const res = await getUserProfileApi();
        if (res.success && res.data) {
          if (res.data.workProfileJson) {
            try {
              const parsed = JSON.parse(res.data.workProfileJson);
              setProfile(prev => ({
                ...prev,
                ...parsed,
                education: { ...prev.education, ...(parsed.education || {}) },
                certifications: parsed.certifications || prev.certifications,
                achievements: parsed.achievements || prev.achievements,
                previousPositions: parsed.previousPositions || prev.previousPositions,
              }));
              return;
            } catch {}
          }

          const expList = res.data.expertise
            ? res.data.expertise.split(',').map(s => s.trim()).filter(Boolean)
            : DEFAULT_FALLBACK_PROFILE.expertise;

          setProfile(prev => ({
            ...prev,
            yearsOfExperience: res.data?.yearsOfExperience || prev.yearsOfExperience,
            expertise: expList.length > 0 ? expList : prev.expertise,
          }));
        }
      } catch (err) {
        console.warn('Lỗi nạp hồ sơ năng lực:', err);
      }
    }
    loadWorkProfile();
  }, [user]);

  // Xử lý đọc tệp CV bằng AI
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.docx') && !lowerName.endsWith('.doc')) {
      addToast('Định dạng không hỗ trợ', 'Hệ thống hỗ trợ tải lên tệp hồ sơ định dạng PDF hoặc DOCX.', 'warning');
      return;
    }

    try {
      setIsParsingAi(true);
      setUploadedCvFileName(file.name);

      // Đọc DataURL để hỗ trợ xem trước tệp gốc
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setUploadedCvDataUrl(dataUrl);
      } catch {}

      addToast('Đang phân tích', `Hệ thống đang đọc và đối soát cấu trúc hồ sơ "${file.name}"...`, 'info');

      const extracted = await parseCvPdfWithAi(file, user?.fullName);
      setAiPreviewData(extracted);

      if (!extracted.isCvValid) {
        addToast('Tệp không hợp lệ', extracted.invalidReason || 'Tệp tải lên không phải là Hồ sơ năng lực hợp lệ.', 'danger');
      } else if (extracted.nameMatchStatus === 'MATCH') {
        addToast('Trích xuất thành công', 'Đã phân tích xong hồ sơ. Tên trong CV trùng khớp với tài khoản cán bộ!', 'success');
      } else if (extracted.nameMatchStatus === 'MISMATCH') {
        addToast('Cảnh báo danh tính', extracted.nameMatchMessage, 'warning');
      } else {
        addToast('Trích xuất xong', 'Đã bóc tách dữ liệu. Vui lòng kiểm tra bản xem trước trước khi lưu!', 'info');
      }
    } catch (err: any) {
      addToast('Lỗi phân tích', err.message || 'Không thể trích xuất thông tin từ tệp đính kèm.', 'danger');
    } finally {
      setIsParsingAi(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Lưu hồ sơ năng lực chính thức
  const handleSaveProfile = async (profileToSave: SavedWorkProfile) => {
    try {
      setIsSaving(true);
      const res = await updateUserProfileApi({
        expertise: profileToSave.expertise.join(', '),
        yearsOfExperience: profileToSave.yearsOfExperience,
        workProfileJson: JSON.stringify(profileToSave),
      });

      if (res.success) {
        setProfile(profileToSave);
        setIsEditing(false);
        addToast('Thành công', 'Đã cập nhật hồ sơ năng lực và minh chứng thành công!', 'success');
      } else {
        addToast('Lỗi', res.error || 'Không thể lưu hồ sơ năng lực.', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể lưu hồ sơ năng lực.', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // Xác nhận áp dụng hồ sơ AI bóc tách
  const handleConfirmAiProfile = async () => {
    if (!aiPreviewData || !aiPreviewData.isCvValid) return;

    const newProfile: SavedWorkProfile = {
      yearsOfExperience: aiPreviewData.yearsOfExperience.value ?? profile.yearsOfExperience,
      expertise: aiPreviewData.expertise.value ?? profile.expertise,
      education: {
        degree: aiPreviewData.education.value?.degree || profile.education.degree,
        institution: aiPreviewData.education.value?.institution || profile.education.institution,
        major: aiPreviewData.education.value?.major || profile.education.major,
        graduationYear: aiPreviewData.education.value?.graduationYear || profile.education.graduationYear,
        proofFileName: profile.education.proofFileName,
        proofFileUrl: profile.education.proofFileUrl,
        proofUploadedAt: profile.education.proofUploadedAt,
      },
      certifications: aiPreviewData.certifications.value?.map(c => ({ name: c })) ?? profile.certifications,
      foreignLanguages: aiPreviewData.foreignLanguages.value ?? profile.foreignLanguages,
      achievements: aiPreviewData.achievements.value?.map(a => ({ name: a })) ?? profile.achievements,
      previousPositions: aiPreviewData.previousPositions.value?.map(p => ({ name: p })) ?? profile.previousPositions,
    };

    await handleSaveProfile(newProfile);
    setAiPreviewData(null);
    setUploadedCvFileName('');
  };

  // Thêm thẻ chuyên môn
  const handleAddExpertise = () => {
    if (!newExpertiseTag.trim()) return;
    if (profile.expertise.includes(newExpertiseTag.trim())) {
      addToast('Thông báo', 'Chuyên môn này đã có trong danh sách.', 'info');
      return;
    }
    setProfile(prev => ({
      ...prev,
      expertise: [...prev.expertise, newExpertiseTag.trim()],
    }));
    setNewExpertiseTag('');
  };

  const handleRemoveExpertise = (tagToRemove: string) => {
    setProfile(prev => ({
      ...prev,
      expertise: prev.expertise.filter(t => t !== tagToRemove),
    }));
  };

  // Minh chứng bằng cấp học vấn
  const handleEduProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfile(prev => ({
        ...prev,
        education: {
          ...prev.education,
          proofFileName: file.name,
          proofFileUrl: dataUrl,
          proofFileType: file.type || 'application/pdf',
          proofFileSize: `${(file.size / 1024).toFixed(1)} KB`,
          proofUploadedAt: formatDateShort(new Date()),
        },
      }));
      addToast('Đã chọn tệp', `Đã đính kèm minh chứng bằng cấp: "${file.name}"`, 'success');
    } catch {
      addToast('Lỗi', 'Không thể nạp tệp minh chứng.', 'danger');
    }
  };

  // Cập nhật tệp minh chứng cho một Chứng chỉ hiện có trong danh sách
  const handleCertItemFileChange = async (index: number, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const list = normalizeProofItems(profile.certifications);
      list[index] = {
        ...list[index],
        proofFileName: file.name,
        proofFileUrl: dataUrl,
        proofFileType: file.type || 'application/pdf',
        proofFileSize: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: formatDateShort(new Date()),
      };
      setProfile(prev => ({ ...prev, certifications: list }));
      addToast('Đã đính kèm', `Đã gắn minh chứng cho: "${list[index].name}"`, 'success');
    } catch {
      addToast('Lỗi', 'Không thể đọc tệp minh chứng.', 'danger');
    }
  };

  // Thêm Chứng chỉ bồi dưỡng kèm Minh chứng mới
  const handleAddCertWithProof = async () => {
    if (!newCertName.trim()) {
      addToast('Cảnh báo', 'Vui lòng nhập tên chứng chỉ bồi dưỡng.', 'warning');
      return;
    }

    let fileUrl = newCertDataUrl || undefined;
    if (newCertFile && !fileUrl) {
      try {
        fileUrl = await readFileAsDataUrl(newCertFile);
      } catch {}
    }

    const newItem: ProofItem = {
      name: newCertName.trim(),
      proofFileName: newCertFile ? newCertFile.name : undefined,
      proofFileUrl: fileUrl,
      proofFileType: newCertFile?.type,
      proofFileSize: newCertFile ? `${(newCertFile.size / 1024).toFixed(1)} KB` : undefined,
      uploadedAt: formatDateShort(new Date()),
    };

    setProfile(prev => ({
      ...prev,
      certifications: [...normalizeProofItems(prev.certifications), newItem],
    }));

    setNewCertName('');
    setNewCertFile(null);
    setNewCertDataUrl(null);
    addToast('Thành công', 'Đã thêm chứng chỉ bồi dưỡng vào danh sách.', 'success');
  };

  const handleRemoveCert = (index: number) => {
    const list = normalizeProofItems(profile.certifications);
    list.splice(index, 1);
    setProfile(prev => ({ ...prev, certifications: list }));
  };

  // Cập nhật tệp minh chứng cho một Khen thưởng hiện có trong danh sách
  const handleAchItemFileChange = async (index: number, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const list = normalizeProofItems(profile.achievements);
      list[index] = {
        ...list[index],
        proofFileName: file.name,
        proofFileUrl: dataUrl,
        proofFileType: file.type || 'application/pdf',
        proofFileSize: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: formatDateShort(new Date()),
      };
      setProfile(prev => ({ ...prev, achievements: list }));
      addToast('Đã đính kèm', `Đã gắn minh chứng khen thưởng cho: "${list[index].name}"`, 'success');
    } catch {
      addToast('Lỗi', 'Không thể đọc tệp minh chứng.', 'danger');
    }
  };

  // Thêm Khen thưởng kèm Minh chứng mới
  const handleAddAchWithProof = async () => {
    if (!newAchName.trim()) {
      addToast('Cảnh báo', 'Vui lòng nhập tên danh hiệu / hình thức khen thưởng.', 'warning');
      return;
    }

    let fileUrl = newAchDataUrl || undefined;
    if (newAchFile && !fileUrl) {
      try {
        fileUrl = await readFileAsDataUrl(newAchFile);
      } catch {}
    }

    const newItem: ProofItem = {
      name: newAchName.trim(),
      proofFileName: newAchFile ? newAchFile.name : undefined,
      proofFileUrl: fileUrl,
      proofFileType: newAchFile?.type,
      proofFileSize: newAchFile ? `${(newAchFile.size / 1024).toFixed(1)} KB` : undefined,
      uploadedAt: formatDateShort(new Date()),
    };

    setProfile(prev => ({
      ...prev,
      achievements: [...normalizeProofItems(prev.achievements), newItem],
    }));

    setNewAchName('');
    setNewAchFile(null);
    setNewAchDataUrl(null);
    addToast('Thành công', 'Đã thêm thành tích khen thưởng.', 'success');
  };

  const handleRemoveAch = (index: number) => {
    const list = normalizeProofItems(profile.achievements);
    list.splice(index, 1);
    setProfile(prev => ({ ...prev, achievements: list }));
  };

  // Cập nhật tệp minh chứng cho một Quá trình công tác hiện có trong danh sách
  const handlePosItemFileChange = async (index: number, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const list = normalizeProofItems(profile.previousPositions);
      list[index] = {
        ...list[index],
        proofFileName: file.name,
        proofFileUrl: dataUrl,
        proofFileType: file.type || 'application/pdf',
        proofFileSize: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: formatDateShort(new Date()),
      };
      setProfile(prev => ({ ...prev, previousPositions: list }));
      addToast('Đã đính kèm', `Đã gắn minh chứng công tác cho: "${list[index].name}"`, 'success');
    } catch {
      addToast('Lỗi', 'Không thể đọc tệp minh chứng.', 'danger');
    }
  };

  // Thêm Quá trình công tác kèm Minh chứng mới
  const handleAddPosWithProof = async () => {
    if (!newPosName.trim()) {
      addToast('Cảnh báo', 'Vui lòng nhập vị trí / giai đoạn công tác.', 'warning');
      return;
    }

    let fileUrl = newPosDataUrl || undefined;
    if (newPosFile && !fileUrl) {
      try {
        fileUrl = await readFileAsDataUrl(newPosFile);
      } catch {}
    }

    const newItem: ProofItem = {
      name: newPosName.trim(),
      proofFileName: newPosFile ? newPosFile.name : undefined,
      proofFileUrl: fileUrl,
      proofFileType: newPosFile?.type,
      proofFileSize: newPosFile ? `${(newPosFile.size / 1024).toFixed(1)} KB` : undefined,
      uploadedAt: formatDateShort(new Date()),
    };

    setProfile(prev => ({
      ...prev,
      previousPositions: [...normalizeProofItems(prev.previousPositions), newItem],
    }));

    setNewPosName('');
    setNewPosFile(null);
    setNewPosDataUrl(null);
    addToast('Thành công', 'Đã thêm quá trình công tác.', 'success');
  };

  const handleRemovePos = (index: number) => {
    const list = normalizeProofItems(profile.previousPositions);
    list.splice(index, 1);
    setProfile(prev => ({ ...prev, previousPositions: list }));
  };

  // Tải file mẫu CV chuẩn Word (.docx)
  const handleDownloadStandardCvTemplate = () => {
    const templateContent = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------------

SƠ YẾU LÝ LỊCH VÀ HỒ SƠ NĂNG LỰC CÁN BỘ CÔNG CHỨC

I. THÔNG TIN CÁ NHÂN:
- Họ và tên: [NGUYỄN VĂN A]
- Ngày sinh: [01/01/1990]       - Giới tính: [Nam/Nữ]
- Số CCCD: [012345678901]       - Dân tộc: [Kinh]
- Quê quán: [Xã Cát Ngạn, Huyện Thanh Chương, Tỉnh Nghệ An]
- Số điện thoại: [0912345678]   - Email công vụ: [nguyenvana@catngan.gov.vn]
- Đơn vị công tác hiện nay: UBND Xã Cát Ngạn
- Vị trí / Chức danh: [Công chức Địa chính - Xây dựng]

II. TRÌNH ĐỘ HỌC VẤN VÀ ĐÀO TẠO:
- Bằng cấp / Học vị cao nhất: Cử nhân / Kỹ sư
- Chuyên ngành đào tạo: Quản lý Đất đai / Quản lý Nhà nước
- Cơ sở đào tạo: Trường Đại học Nông Nghiệp / Học viện Hành chính Quốc gia
- Năm tốt nghiệp: 2018 (Xếp loại: Khá/Giỏi)
- Minh chứng đính kèm: Bản sao Bằng cử nhân

III. CHỨNG CHỈ BỒI DƯỠNG NGHIỆP VỤ:
1. Chứng chỉ Bồi dưỡng Quản lý Nhà nước ngạch Chuyên viên (Năm 2020)
2. Chứng chỉ Bồi dưỡng Kiến thức Quốc phòng - An ninh Đối tượng 4 (Năm 2021)
3. Chứng chỉ Chuẩn kỹ năng ứng dụng CNTT nâng cao (Năm 2022)
4. Chứng chỉ Ngoại ngữ: Tiếng Anh Bậc 3 (Khung B1 Châu Âu)

IV. QUÁ TRÌNH CÔNG TÁC:
- Từ 01/2020 - nay: Công chức chuyên môn tại UBND Xã Cát Ngạn.
- Từ 01/2018 - 12/2019: Cán bộ hợp đồng hành chính địa phương.

V. KHEN THƯỞNG VÀ THÀNH TÍCH:
- Danh hiệu Chiến sĩ thi đua cấp cơ sở năm 2024, 2025.
- Giấy khen của Chủ tịch UBND Huyện về thành tích xuất sắc trong công tác Cải cách hành chính.

Người khai ký tên: .............................`;

    const blob = new Blob([templateContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Mau_So_Yeu_Ly_Lich_Ho_So_Nang_Luc_Can_Bo.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Tải mẫu thành công', 'Đã tải xuống tệp mẫu Sơ yếu lý lịch chuẩn.', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. KHỐI TRỢ LÝ TRÍCH XUẤT TỰ ĐỘNG TỪ CV ── */}
      <div
        className="card"
        style={{
          border: '1.5px dashed #3b82f6',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
        }}
      >
        <div className="card-body" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ maxWidth: 580 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="badge badge-blue" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                  <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 4 }} /> Trợ Lý AI
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Trích Xuất Hồ Sơ & Minh Chứng Tự Động Từ CV (PDF/DOCX)
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                Hệ thống tự động thẩm định và trích xuất thông tin quá trình công tác, bằng cấp, chứng chỉ. 
                Dữ liệu chỉ được cập nhật khi đồng chí đối soát và bấm <strong>Lưu Hồ Sơ</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowTemplateModal(true)}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: '#cbd5e1' }}
              >
                <i className="fa-solid fa-file-lines" style={{ color: '#2563eb' }} />
                <span>Xem Mẫu Hồ Sơ Chuẩn</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                id="cv-pdf-upload"
                accept=".pdf,.docx,.doc"
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
                <i className={`fa-solid ${isParsingAi ? 'fa-circle-notch fa-spin' : 'fa-file-arrow-up'}`} aria-hidden="true" />
                <span>{isParsingAi ? 'Đang Phân Tích...' : 'Tải Lên Hồ Sơ (PDF/Word)'}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KHỐI CẢNH BÁO TỆP KHÔNG HỢP LỆ VÀ HƯỚNG DẪN MẪU CHUẨN ── */}
      {aiPreviewData && !aiPreviewData.isCvValid && (
        <div
          className="card"
          style={{
            border: '2px solid #ef4444',
            background: '#fffaf0',
            boxShadow: '0 8px 24px rgba(239,68,68,0.12)',
          }}
        >
          <div
            className="card-header"
            style={{
              background: '#fee2e2',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #fecaca',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ color: '#dc2626', fontSize: 20 }} />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                  Cảnh Báo: Tệp Tải Lên Không Hợp Lệ ({uploadedCvFileName})
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: 2 }}>
                  {aiPreviewData.invalidReason || 'Nội dung tệp không đúng định dạng Hồ sơ năng lực / CV công chức.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setAiPreviewData(null); setUploadedCvFileName(''); }}
              style={{ color: '#991b1b', fontWeight: 700 }}
            >
              Đóng thông báo
            </button>
          </div>

          <div className="card-body" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.86rem', color: '#334155', marginBottom: 16, lineHeight: 1.6 }}>
              Để hệ thống trích xuất chính xác, tệp hồ sơ tải lên cần trình bày theo cấu trúc chuẩn hóa (gồm đầy đủ các phần: Thông tin nhân thân, Trình độ học vấn, Chứng chỉ bồi dưỡng, Quá trình công tác).
            </div>

            {/* Khung Mẫu Hồ Sơ Chuẩn Trực Quan */}
            <div style={{ background: '#ffffff', border: '1.5px solid #fed7aa', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#c2410c', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-file-signature" />
                  <span>CẤU TRÚC HỒ SƠ NĂNG LỰC CÔNG CHỨC TIÊU CHUẨN:</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadStandardCvTemplate}
                  className="btn btn-outline btn-sm"
                  style={{ fontWeight: 700, borderColor: '#f97316', color: '#ea580c' }}
                >
                  <i className="fa-solid fa-download" style={{ marginRight: 6 }} />
                  <span>Tải Mẫu Chuẩn (.doc)</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, fontSize: '0.8rem' }}>
                <div style={{ background: '#fff7ed', padding: 10, borderRadius: 6, border: '1px solid #ffedd5' }}>
                  <div style={{ fontWeight: 800, color: '#9a3412', marginBottom: 4 }}>1. Thông tin cá nhân</div>
                  <div style={{ color: '#64748b' }}>Họ tên, Ngày sinh, Quê quán, CCCD, Email công vụ, Vị trí công tác.</div>
                </div>

                <div style={{ background: '#fff7ed', padding: 10, borderRadius: 6, border: '1px solid #ffedd5' }}>
                  <div style={{ fontWeight: 800, color: '#9a3412', marginBottom: 4 }}>2. Trình độ học vấn</div>
                  <div style={{ color: '#64748b' }}>Bằng Đại học / Sau đại học, Chuyên ngành, Cơ sở đào tạo, Năm tốt nghiệp.</div>
                </div>

                <div style={{ background: '#fff7ed', padding: 10, borderRadius: 6, border: '1px solid #ffedd5' }}>
                  <div style={{ fontWeight: 800, color: '#9a3412', marginBottom: 4 }}>3. Chứng chỉ bồi dưỡng</div>
                  <div style={{ color: '#64748b' }}>QLNN ngạch Chuyên viên, QPAN, Lý luận chính trị, Tin học, Ngoại ngữ.</div>
                </div>

                <div style={{ background: '#fff7ed', padding: 10, borderRadius: 6, border: '1px solid #ffedd5' }}>
                  <div style={{ fontWeight: 800, color: '#9a3412', marginBottom: 4 }}>4. Quá trình công tác</div>
                  <div style={{ color: '#64748b' }}>Các mốc thời gian, Vị trí đảm nhiệm, Đơn vị hành chính công tác.</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontWeight: 700 }}
              >
                <i className="fa-solid fa-arrow-rotate-right" style={{ marginRight: 6 }} />
                <span>Tải Lên Tệp Khác</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. KHỐI PREVIEW TRÍCH XUẤT HỢP LỆ TỪ CV ── */}
      {aiPreviewData && aiPreviewData.isCvValid && (
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
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#7c3aed', fontSize: 18 }} />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#5b21b6', margin: 0 }}>
                  Bản Xem Trước Thông Tin Trích Xuất Từ CV ({uploadedCvFileName})
                </h3>
                <div style={{ fontSize: '0.76rem', color: '#6b21a8', marginTop: 2 }}>
                  Vui lòng đối soát dữ liệu và danh tính trước khi bấm lưu chính thức.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {uploadedCvDataUrl && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setViewingProof({
                    title: `Tệp Hồ Sơ / CV Gốc: ${uploadedCvFileName}`,
                    fileName: uploadedCvFileName,
                    fileUrl: uploadedCvDataUrl,
                    category: 'CV_DOCUMENT',
                    recipientName: user?.fullName || 'Nguyễn Văn A',
                    uploadedAt: formatDateShort(new Date()),
                  })}
                  style={{ borderColor: '#a855f7', color: '#7e22ce', fontWeight: 700 }}
                >
                  <i className="fa-solid fa-file-magnifying-glass" style={{ marginRight: 6 }} />
                  <span>Xem Tệp Gốc</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setAiPreviewData(null); setUploadedCvFileName(''); setUploadedCvDataUrl(null); }}
                style={{ color: '#6b21a8', fontWeight: 700 }}
              >
                Hủy xem trước
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmAiProfile}
                disabled={isSaving}
                style={{ background: '#7c3aed', borderColor: '#7c3aed', fontWeight: 800, padding: '6px 16px' }}
              >
                <i className={`fa-solid ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-check'}`} style={{ marginRight: 6 }} />
                <span>{isSaving ? 'Đang lưu...' : 'Áp Dụng & Lưu Hồ Sơ'}</span>
              </button>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px' }}>
            {/* Banner đối chiếu danh tính */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                border:
                  aiPreviewData.nameMatchStatus === 'MATCH'
                    ? '1.5px solid #86efac'
                    : aiPreviewData.nameMatchStatus === 'MISMATCH'
                    ? '1.5px solid #fca5a5'
                    : '1.5px solid #cbd5e1',
                background:
                  aiPreviewData.nameMatchStatus === 'MATCH'
                    ? '#f0fdf4'
                    : aiPreviewData.nameMatchStatus === 'MISMATCH'
                    ? '#fef2f2'
                    : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <i
                className={`fa-solid ${
                  aiPreviewData.nameMatchStatus === 'MATCH'
                    ? 'fa-circle-check'
                    : aiPreviewData.nameMatchStatus === 'MISMATCH'
                    ? 'fa-triangle-exclamation'
                    : 'fa-circle-info'
                }`}
                style={{
                  fontSize: 22,
                  color:
                    aiPreviewData.nameMatchStatus === 'MATCH'
                      ? '#16a34a'
                      : aiPreviewData.nameMatchStatus === 'MISMATCH'
                      ? '#dc2626'
                      : '#2563eb',
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    color:
                      aiPreviewData.nameMatchStatus === 'MATCH'
                        ? '#166534'
                        : aiPreviewData.nameMatchStatus === 'MISMATCH'
                        ? '#991b1b'
                        : '#1e293b',
                  }}
                >
                  {aiPreviewData.nameMatchStatus === 'MATCH'
                    ? '✓ Khớp Danh Tính: Hồ sơ CV thuộc về cán bộ đang đăng nhập'
                    : aiPreviewData.nameMatchStatus === 'MISMATCH'
                    ? '⚠️ CẢNH BÁO: Tên trong CV không khớp với cán bộ đang đăng nhập'
                    : 'Thông Tin Đối Soát Danh Tính Cán Bộ'}
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: 2, color: aiPreviewData.nameMatchStatus === 'MATCH' ? '#15803d' : '#991b1b' }}>
                  {aiPreviewData.nameMatchMessage}
                </div>
              </div>
            </div>

            {/* Trích xuất 1: Kinh nghiệm */}
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a', marginBottom: 4 }}>
                1. Kinh nghiệm công tác trích xuất: <strong>{aiPreviewData.yearsOfExperience.value} năm</strong>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                <em>Nguồn trích xuất:</em> "{aiPreviewData.yearsOfExperience.sourceText}"
              </div>
            </div>

            {/* Trích xuất 2: Chuyên môn */}
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a', marginBottom: 6 }}>
                2. Chuyên môn & Lĩnh vực phụ trách:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {aiPreviewData.expertise.value?.map((item, idx) => (
                  <span key={idx} className="badge badge-blue" style={{ fontSize: '0.78rem' }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Trích xuất 3: Học vấn */}
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a', marginBottom: 4 }}>
                3. Học vấn & Bằng cấp:
              </div>
              <div style={{ fontSize: '0.86rem', color: '#1e293b' }}>
                {aiPreviewData.education.value?.degree} — {aiPreviewData.education.value?.major} ({aiPreviewData.education.value?.institution}, {aiPreviewData.education.value?.graduationYear})
              </div>
            </div>

            {/* Trích xuất 4: Chứng chỉ */}
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a', marginBottom: 4 }}>
                4. Chứng chỉ bồi dưỡng:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.84rem', color: '#334155' }}>
                {aiPreviewData.certifications.value?.map((c, idx) => (
                  <li key={idx} style={{ marginBottom: 2 }}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. BẢNG HỒ SƠ NĂNG LỰC CHÍNH THỨC & QUẢN LÝ MINH CHỨNG ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-id-card" style={{ color: '#2563eb' }} aria-hidden="true" />
              <span>Hồ Sơ Năng Lực & Minh Chứng Công Tác</span>
            </h2>
            <span className="badge badge-success" style={{ fontSize: '0.74rem' }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: 4 }} /> Hồ Sơ Chính Thức
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`btn btn-sm ${isEditing ? 'btn-ghost' : 'btn-outline'}`}
              onClick={() => setIsEditing(!isEditing)}
              style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <i className={`fa-solid ${isEditing ? 'fa-xmark' : 'fa-pen-to-square'}`} />
              <span>{isEditing ? 'Hủy Chỉnh Sửa' : 'Chỉnh Sửa Hồ Sơ & Minh Chứng'}</span>
            </button>

            {isEditing && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleSaveProfile(profile)}
                disabled={isSaving}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <i className={`fa-solid ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`} />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu Hồ Sơ Năng Lực'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {isEditing ? (
            /* ═══════════════ CHẾ ĐỘ CHỈNH SỬA & ĐÍNH KÈM MINH CHỨNG ═══════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* 1. Kinh nghiệm & Chuyên môn tags */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 6 }}>
                    Số năm kinh nghiệm công tác:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={profile.yearsOfExperience}
                    onChange={e => setProfile(prev => ({ ...prev, yearsOfExperience: parseInt(e.target.value, 10) || 0 }))}
                    className="form-input"
                    style={{ fontWeight: 700 }}
                  />
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                    Dùng để tính thâm niên và gợi ý phân bổ nhiệm vụ hành chính.
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 6 }}>
                    Thẻ lĩnh vực chuyên môn:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {profile.expertise.map((tag, idx) => (
                      <span
                        key={idx}
                        className="badge badge-blue"
                        style={{
                          fontSize: '0.8rem',
                          padding: '4px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{tag}</span>
                        <i
                          className="fa-solid fa-xmark"
                          style={{ cursor: 'pointer', opacity: 0.8 }}
                          onClick={() => handleRemoveExpertise(tag)}
                          title="Xóa thẻ này"
                        />
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Nhập lĩnh vực chuyên môn mới (Địa chính, Văn phòng, Tư pháp...)"
                      value={newExpertiseTag}
                      onChange={e => setNewExpertiseTag(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExpertise();
                        }
                      }}
                      className="form-input"
                      style={{ fontSize: '0.84rem' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddExpertise}
                      style={{ fontWeight: 700 }}
                    >
                      + Thêm Thẻ
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Trình độ học vấn & Minh chứng Bằng cấp */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 12px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-graduation-cap" style={{ color: '#2563eb' }} />
                  <span>Trình Độ Học Vấn & Minh Chứng Bằng Cấp</span>
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Học vị / Bằng cấp (*):
                    </label>
                    <input
                      type="text"
                      value={profile.education.degree}
                      onChange={e => setProfile(prev => ({ ...prev, education: { ...prev.education, degree: e.target.value } }))}
                      className="form-input"
                      placeholder="Cử nhân, Kỹ sư, Thạc sĩ..."
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Chuyên ngành đào tạo (*):
                    </label>
                    <input
                      type="text"
                      value={profile.education.major}
                      onChange={e => setProfile(prev => ({ ...prev, education: { ...prev.education, major: e.target.value } }))}
                      className="form-input"
                      placeholder="Quản lý Đất đai, Luật, Quản lý Nhà nước..."
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Trường / Cơ sở đào tạo (*):
                    </label>
                    <input
                      type="text"
                      value={profile.education.institution}
                      onChange={e => setProfile(prev => ({ ...prev, education: { ...prev.education, institution: e.target.value } }))}
                      className="form-input"
                      placeholder="Học viện Hành chính Quốc gia, Đại học..."
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Năm tốt nghiệp:
                    </label>
                    <input
                      type="number"
                      value={profile.education.graduationYear || 2018}
                      onChange={e => setProfile(prev => ({ ...prev, education: { ...prev.education, graduationYear: parseInt(e.target.value, 10) || undefined } }))}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Phần đính kèm Minh chứng Bằng cấp */}
                <div style={{ background: '#ffffff', padding: 12, borderRadius: 6, border: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="fa-solid fa-file-certificate" style={{ color: '#2563eb', fontSize: 18 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                        Minh chứng bằng cấp: {profile.education.proofFileName || 'Chưa đính kèm tệp'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Hỗ trợ bản scan / ảnh chụp bằng tốt nghiệp (.pdf, .jpg, .png, .docx)
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {profile.education.proofFileUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setViewingProof({
                          title: `Minh Chứng: ${profile.education.degree} ${profile.education.major}`,
                          fileName: profile.education.proofFileName || 'Minh_chung_bang_cap.pdf',
                          fileUrl: profile.education.proofFileUrl,
                          category: 'EDUCATION',
                          recipientName: user?.fullName || 'Nguyễn Văn A',
                          degreeMajor: profile.education.major,
                          institution: profile.education.institution,
                          graduationYear: profile.education.graduationYear || 2018,
                        })}
                        style={{ color: '#2563eb', fontWeight: 700 }}
                      >
                        <i className="fa-solid fa-eye" style={{ marginRight: 4 }} /> Xem Thử
                      </button>
                    )}

                    <input
                      type="file"
                      id="edu-proof-upload"
                      accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                      style={{ display: 'none' }}
                      onChange={handleEduProofChange}
                    />
                    <label htmlFor="edu-proof-upload" className="btn btn-outline btn-sm" style={{ cursor: 'pointer', fontWeight: 700 }}>
                      <i className="fa-solid fa-upload" style={{ marginRight: 4 }} />
                      <span>{profile.education.proofFileName ? 'Đổi Tệp Minh Chứng' : 'Tải Lên Minh Chứng'}</span>
                    </label>

                    {profile.education.proofFileName && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setProfile(prev => ({ ...prev, education: { ...prev.education, proofFileName: undefined, proofFileUrl: undefined } }))}
                        style={{ color: '#dc2626', fontWeight: 700 }}
                        title="Gỡ bỏ tệp minh chứng"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Chứng chỉ bồi dưỡng & Minh chứng */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 12px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-certificate" style={{ color: '#d97706' }} />
                  <span>Chứng Chỉ Bồi Dưỡng & Minh Chứng Nghiệp Vụ</span>
                </h4>

                {/* Danh sách chứng chỉ hiện có */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {normalizeProofItems(profile.certifications).map((cert, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: '0.84rem',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <i className="fa-solid fa-award" style={{ color: '#d97706' }} />
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{cert.name}</span>
                        {cert.proofFileName ? (
                          <span className="badge badge-success" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <i className="fa-solid fa-paperclip" />
                            <span>{cert.proofFileName}</span>
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>(Chưa có minh chứng)</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {cert.proofFileUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingProof({
                              title: `Minh Chứng: ${cert.name}`,
                              fileName: cert.proofFileName || 'Chung_chi.pdf',
                              fileUrl: cert.proofFileUrl,
                              category: 'CERTIFICATION',
                              recipientName: user?.fullName || 'Nguyễn Văn A',
                              degreeMajor: cert.name,
                            })}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.72rem', color: '#d97706', padding: '2px 6px', fontWeight: 700 }}
                          >
                            <i className="fa-solid fa-eye" style={{ marginRight: 4 }} /> Xem Thử
                          </button>
                        )}

                        {/* Nút đính kèm / đổi tệp cho chứng chỉ hiện có */}
                        <input
                          type="file"
                          id={`cert-file-${idx}`}
                          accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                          style={{ display: 'none' }}
                          onChange={e => handleCertItemFileChange(idx, e.target.files?.[0] || null)}
                        />
                        <label
                          htmlFor={`cert-file-${idx}`}
                          className="btn btn-outline btn-sm"
                          style={{ cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px' }}
                        >
                          <i className="fa-solid fa-paperclip" style={{ marginRight: 4 }} />
                          {cert.proofFileName ? 'Đổi tệp' : '+ Đính kèm tệp'}
                        </label>

                        <button
                          type="button"
                          onClick={() => handleRemoveCert(idx)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#dc2626', padding: '2px 8px' }}
                          title="Xóa chứng chỉ này"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Thêm chứng chỉ mới + đính kèm file */}
                <div style={{ background: '#ffffff', padding: 12, borderRadius: 6, border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                    + Thêm chứng chỉ bồi dưỡng mới kèm minh chứng:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Tên chứng chỉ (ví dụ: QLNN ngạch Chuyên viên, QPAN Đối tượng 4...)"
                      value={newCertName}
                      onChange={e => setNewCertName(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.84rem' }}
                    />

                    <div>
                      <input
                        type="file"
                        id="new-cert-file"
                        accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                        style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0] || null;
                          setNewCertFile(file);
                          if (file) {
                            try {
                              const url = await readFileAsDataUrl(file);
                              setNewCertDataUrl(url);
                            } catch {}
                          } else {
                            setNewCertDataUrl(null);
                          }
                        }}
                      />
                      <label
                        htmlFor="new-cert-file"
                        className="btn btn-outline btn-sm"
                        style={{ cursor: 'pointer', width: '100%', textAlign: 'center', fontSize: '0.76rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <i className="fa-solid fa-paperclip" style={{ marginRight: 4 }} />
                        <span>{newCertFile ? newCertFile.name : 'Đính kèm tệp...'}</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddCertWithProof}
                      style={{ fontWeight: 700, padding: '7px 14px' }}
                    >
                      + Thêm
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Khen thưởng & Quá trình công tác */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Khen thưởng */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-award" style={{ color: '#16a34a' }} />
                    <span>Khen Thưởng & Thành Tích</span>
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {normalizeProofItems(profile.achievements).map((ach, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          background: '#ffffff',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          border: '1px solid #e2e8f0',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600 }}>{ach.name}</span>
                          {ach.proofFileName && (
                            <span style={{ fontSize: '0.7rem', color: '#16a34a', marginLeft: 6 }}>
                              <i className="fa-solid fa-paperclip" /> {ach.proofFileName}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {ach.proofFileUrl && (
                            <button
                              type="button"
                              onClick={() => setViewingProof({
                                title: `Quyết Định Khen Thưởng: ${ach.name}`,
                                fileName: ach.proofFileName || 'Quyet_dinh.pdf',
                                fileUrl: ach.proofFileUrl,
                                category: 'ACHIEVEMENT',
                                recipientName: user?.fullName || 'Nguyễn Văn A',
                                degreeMajor: ach.name,
                              })}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.7rem', color: '#16a34a', padding: '1px 4px', fontWeight: 700 }}
                            >
                              <i className="fa-solid fa-eye" /> Xem Thử
                            </button>
                          )}

                          <input
                            type="file"
                            id={`ach-file-${idx}`}
                            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                            style={{ display: 'none' }}
                            onChange={e => handleAchItemFileChange(idx, e.target.files?.[0] || null)}
                          />
                          <label
                            htmlFor={`ach-file-${idx}`}
                            className="btn btn-outline btn-sm"
                            style={{ cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px' }}
                          >
                            <i className="fa-solid fa-paperclip" style={{ marginRight: 3 }} />
                            {ach.proofFileName ? 'Đổi tệp' : '+ Tệp'}
                          </label>

                          <i
                            className="fa-solid fa-trash"
                            style={{ cursor: 'pointer', color: '#dc2626' }}
                            onClick={() => handleRemoveAch(idx)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Danh hiệu thi đua, Bằng khen..."
                      value={newAchName}
                      onChange={e => setNewAchName(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.8rem' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="file"
                        id="new-ach-file"
                        accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                        style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0] || null;
                          setNewAchFile(file);
                          if (file) {
                            try {
                              const url = await readFileAsDataUrl(file);
                              setNewAchDataUrl(url);
                            } catch {}
                          } else {
                            setNewAchDataUrl(null);
                          }
                        }}
                      />
                      <label htmlFor="new-ach-file" className="btn btn-outline btn-sm" style={{ flex: 1, cursor: 'pointer', fontSize: '0.74rem' }}>
                        <i className="fa-solid fa-paperclip" /> {newAchFile ? newAchFile.name : 'Tệp minh chứng...'}
                      </label>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddAchWithProof}>
                        + Thêm
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quá trình công tác */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 10px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-briefcase" style={{ color: '#7c3aed' }} />
                    <span>Quá Trình Công Tác</span>
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {normalizeProofItems(profile.previousPositions).map((pos, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          background: '#ffffff',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          border: '1px solid #e2e8f0',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600 }}>{pos.name}</span>
                          {pos.proofFileName && (
                            <span style={{ fontSize: '0.7rem', color: '#7c3aed', marginLeft: 6 }}>
                              <i className="fa-solid fa-paperclip" /> {pos.proofFileName}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {pos.proofFileUrl && (
                            <button
                              type="button"
                              onClick={() => setViewingProof({
                                title: `Minh Chứng Công Tác: ${pos.name}`,
                                fileName: pos.proofFileName || 'Minh_chung_cong_tac.pdf',
                                fileUrl: pos.proofFileUrl,
                                category: 'POSITION',
                                recipientName: user?.fullName || 'Nguyễn Văn A',
                                degreeMajor: pos.name,
                              })}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.7rem', color: '#7c3aed', padding: '1px 4px', fontWeight: 700 }}
                            >
                              <i className="fa-solid fa-eye" /> Xem Thử
                            </button>
                          )}

                          <input
                            type="file"
                            id={`pos-file-${idx}`}
                            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                            style={{ display: 'none' }}
                            onChange={e => handlePosItemFileChange(idx, e.target.files?.[0] || null)}
                          />
                          <label
                            htmlFor={`pos-file-${idx}`}
                            className="btn btn-outline btn-sm"
                            style={{ cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px' }}
                          >
                            <i className="fa-solid fa-paperclip" style={{ marginRight: 3 }} />
                            {pos.proofFileName ? 'Đổi tệp' : '+ Tệp'}
                          </label>

                          <i
                            className="fa-solid fa-trash"
                            style={{ cursor: 'pointer', color: '#dc2626' }}
                            onClick={() => handleRemovePos(idx)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Giai đoạn & Vị trí công tác..."
                      value={newPosName}
                      onChange={e => setNewPosName(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.8rem' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="file"
                        id="new-pos-file"
                        accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                        style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0] || null;
                          setNewPosFile(file);
                          if (file) {
                            try {
                              const url = await readFileAsDataUrl(file);
                              setNewPosDataUrl(url);
                            } catch {}
                          } else {
                            setNewPosDataUrl(null);
                          }
                        }}
                      />
                      <label htmlFor="new-pos-file" className="btn btn-outline btn-sm" style={{ flex: 1, cursor: 'pointer', fontSize: '0.74rem' }}>
                        <i className="fa-solid fa-paperclip" /> {newPosFile ? newPosFile.name : 'Minh chứng bổ nhiệm...'}
                      </label>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddPosWithProof}>
                        + Thêm
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsEditing(false)}
                  style={{ fontWeight: 700 }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSaveProfile(profile)}
                  disabled={isSaving}
                  style={{ fontWeight: 800, padding: '8px 22px' }}
                >
                  <i className={`fa-solid ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`} style={{ marginRight: 8 }} />
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu Hồ Sơ Năng Lực'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* ═══════════════ CHẾ ĐỘ HIỂN THỊ XEM HỒ SƠ CHÍNH THỨC ═══════════════ */
            <>
              {/* Chuyên môn & Thâm niên */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>
                    THÂM NIÊN CÔNG TÁC
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
                      <span key={idx} className="badge badge-blue" style={{ fontSize: '0.78rem', padding: '4px 9px' }}>
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Học vấn & Chứng chỉ (Kèm Nút Xem Minh Chứng) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fa-solid fa-graduation-cap" style={{ color: '#2563eb' }} />
                      <span>Trình Độ Học Vấn & Bằng Cấp</span>
                    </div>
                    {profile.education.proofFileUrl || profile.education.proofFileName ? (
                      <button
                        type="button"
                        onClick={() => setViewingProof({
                          title: `Minh Chứng Bằng Cấp: ${profile.education.degree} ${profile.education.major}`,
                          fileName: profile.education.proofFileName || 'Minh_chung_bang_cap.pdf',
                          fileUrl: profile.education.proofFileUrl,
                          category: 'EDUCATION',
                          recipientName: user?.fullName || 'Nguyễn Văn A',
                          degreeMajor: profile.education.major,
                          institution: profile.education.institution,
                          graduationYear: profile.education.graduationYear || 2018,
                          uploadedAt: profile.education.proofUploadedAt,
                        })}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.72rem', color: '#2563eb', padding: '2px 6px', fontWeight: 700 }}
                      >
                        <i className="fa-solid fa-eye" style={{ marginRight: 4 }} />
                        <span>Xem minh chứng</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>(Chưa có minh chứng)</span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                    {profile.education.degree} — {profile.education.major}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                    {profile.education.institution} ({profile.education.graduationYear})
                  </div>
                  {profile.education.proofFileName && (
                    <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="fa-solid fa-paperclip" />
                      <span>Tệp đính kèm: {profile.education.proofFileName}</span>
                    </div>
                  )}
                </div>

                <div style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-certificate" style={{ color: '#d97706' }} />
                    <span>Chứng Chỉ Bồi Dưỡng Nghiệp Vụ</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {normalizeProofItems(profile.certifications).map((cert, idx) => (
                      <div key={idx} style={{ fontSize: '0.82rem', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>• {cert.name}</span>
                        {cert.proofFileUrl || cert.proofFileName ? (
                          <button
                            type="button"
                            onClick={() => setViewingProof({
                              title: `Minh Chứng: ${cert.name}`,
                              fileName: cert.proofFileName || 'Chung_chi.pdf',
                              fileUrl: cert.proofFileUrl,
                              category: 'CERTIFICATION',
                              recipientName: user?.fullName || 'Nguyễn Văn A',
                              degreeMajor: cert.name,
                              uploadedAt: cert.uploadedAt,
                            })}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.7rem', color: '#d97706', padding: '1px 6px', fontWeight: 700 }}
                          >
                            <i className="fa-solid fa-eye" style={{ marginRight: 4 }} />
                            <span>Xem minh chứng</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>(Chưa có tệp)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Khen thưởng & Quá trình công tác */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-award" style={{ color: '#16a34a' }} />
                    <span>Khen Thưởng & Thành Tích</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {normalizeProofItems(profile.achievements).map((ach, idx) => (
                      <div key={idx} style={{ fontSize: '0.82rem', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>• {ach.name}</span>
                        {ach.proofFileUrl || ach.proofFileName ? (
                          <button
                            type="button"
                            onClick={() => setViewingProof({
                              title: `Minh Chứng Khen Thưởng: ${ach.name}`,
                              fileName: ach.proofFileName || 'Quyet_dinh.pdf',
                              fileUrl: ach.proofFileUrl,
                              category: 'ACHIEVEMENT',
                              recipientName: user?.fullName || 'Nguyễn Văn A',
                              degreeMajor: ach.name,
                              uploadedAt: ach.uploadedAt,
                            })}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.7rem', color: '#16a34a', padding: '1px 6px', fontWeight: 700 }}
                          >
                            <i className="fa-solid fa-eye" style={{ marginRight: 4 }} />
                            <span>Xem quyết định</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>(Chưa có tệp)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-briefcase" style={{ color: '#7c3aed' }} />
                    <span>Quá Trình Công Tác</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {normalizeProofItems(profile.previousPositions).map((pos, idx) => (
                      <div key={idx} style={{ fontSize: '0.82rem', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>• {pos.name}</span>
                        {pos.proofFileUrl || pos.proofFileName ? (
                          <button
                            type="button"
                            onClick={() => setViewingProof({
                              title: `Minh Chứng Công Tác: ${pos.name}`,
                              fileName: pos.proofFileName || 'Minh_chung_cong_tac.pdf',
                              fileUrl: pos.proofFileUrl,
                              category: 'POSITION',
                              recipientName: user?.fullName || 'Nguyễn Văn A',
                              degreeMajor: pos.name,
                              uploadedAt: pos.uploadedAt,
                            })}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.7rem', color: '#7c3aed', padding: '1px 6px', fontWeight: 700 }}
                          >
                            <i className="fa-solid fa-eye" style={{ marginRight: 4 }} />
                            <span>Xem minh chứng</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>(Chưa có tệp)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODAL XEM MẪU HỒ SƠ CHUẨN (.DOCX) ── */}
      {showTemplateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 640,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-file-signature" style={{ color: '#2563eb', fontSize: 18 }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Mẫu Hồ Sơ Năng Lực & Sơ Yếu Lý Lịch Chuẩn
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowTemplateModal(false)}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
                Để AI tự động trích xuất chính xác 100%, đồng chí có thể sử dụng mẫu văn bản sau hoặc bấm tải file Word về máy:
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: 14,
                  fontSize: '0.8rem',
                  color: '#334155',
                  fontFamily: 'monospace',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
{`CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

SƠ YẾU LÝ LỊCH VÀ HỒ SƠ NĂNG LỰC CÔNG CHỨC

I. THÔNG TIN CÁ NHÂN:
- Họ và tên: [Nguyễn Văn A]
- Ngày sinh: [01/01/1990]  - Quê quán: [Xã Cát Ngạn]
- CCCD: [012345678901]    - Email công vụ: [nguyenvana@catngan.gov.vn]
- Đơn vị công tác: UBND Cấp Xã

II. TRÌNH ĐỘ HỌC VẤN:
- Bằng cấp cao nhất: Cử nhân / Kỹ sư
- Chuyên ngành: Quản lý Đất đai / Quản lý Nhà nước
- Cơ sở đào tạo: Học viện Hành chính Quốc gia (Năm 2018)

III. CHỨNG CHỈ BỒI DƯỠNG:
- Chứng chỉ QLNN ngạch Chuyên viên
- Chứng chỉ QPAN Đối tượng 4
- Chứng chỉ Tiếng Anh B1 / Tin học nâng cao

IV. QUÁ TRÌNH CÔNG TÁC & KHEN THƯỞNG:
- 2020 - nay: Công chức chuyên môn tại UBND Xã
- Danh hiệu Chiến sĩ thi đua cấp cơ sở`}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadStandardCvTemplate}
                  style={{ fontWeight: 700 }}
                >
                  <i className="fa-solid fa-download" style={{ marginRight: 6 }} />
                  <span>Tải File Mẫu Word (.doc)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL XEM CHI TIẾT & ĐỐI SOÁT MINH CHỨNG THẬT ── */}
      {viewingProof && (
        <ProofDocumentViewerModal
          proof={viewingProof}
          onClose={() => setViewingProof(null)}
        />
      )}
    </div>
  );
}
