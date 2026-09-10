/**
 * Document AI Intelligence Service — Dịch vụ phân tích văn bản công vụ và trích xuất chứng cứ
 * 
 * Tuân thủ nghiêm ngặt nguyên tắc:
 * 1. Mọi trường thông tin quan trọng bắt buộc có đủ 4 thành phần: value, confidence, sourcePage, sourceText.
 * 2. Quy tắc chống bịa đặt: Nếu văn bản không đề cập, value phải là null.
 * 3. AI không tự động ra quyết định thay cho con người — luôn qua bước cán bộ kiểm tra và xác nhận.
 * 4. Dữ liệu phân tích và gợi ý cán bộ được truy vấn trực tiếp từ API backend PostgreSQL; không dùng mock deterministic.
 */

export interface DocumentExtractedField<T> {
  value: T | null;
  confidence: number;
  sourcePage: number;
  sourceText: string;
}

export interface DocumentAnalysisReport {
  documentId: string;
  documentType: DocumentExtractedField<'ChiDao' | 'GiaoViec' | 'BaoCao' | 'HopThuMoi' | 'ThongBao' | 'QuyetDinh'>;
  documentNumber: DocumentExtractedField<string>;
  documentSymbol: DocumentExtractedField<string>;
  issuingAgency: DocumentExtractedField<string>;
  issuedDate: DocumentExtractedField<string>;
  deadlineDate: DocumentExtractedField<string>; // Có thể null nếu văn bản không yêu cầu hạn chót
  priority: DocumentExtractedField<'Khan' | 'Thuong'>;
  summary: DocumentExtractedField<string>;
  keyObjectives: DocumentExtractedField<string[]>;
  targetSubjects: DocumentExtractedField<string[]>;
  relatedDepartments: DocumentExtractedField<string[]>;
  eventDetails?: DocumentExtractedField<{
    startDateTime: string;
    endDateTime: string;
    location: string;
    attendees: string;
  }>;
}

export interface AssigneeCandidate {
  userId: string;
  fullName: string;
  roleName: string;
  departmentName: string;
  scorePercentage: number;
  positiveReasons: string[];
  negativeReasons: string[];
  currentWorkloadPercentage: number;
  assignedTasksCount: number;
}

export interface GeneratedSubTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

/**
 * Tự động tạo danh sách đầu việc con (Checklist) từ mục tiêu trích xuất thực tế của văn bản
 */
export function generateTaskChecklist(docReport: DocumentAnalysisReport): GeneratedSubTask[] {
  const objectives = docReport.keyObjectives.value || [];

  if (objectives.length === 0) {
    return [];
  }

  return objectives.map((obj, idx) => ({
    id: `st-${idx + 1}`,
    title: obj,
    isCompleted: false,
  }));
}
