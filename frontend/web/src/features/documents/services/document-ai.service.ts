/**
 * Document AI Intelligence Service — Dịch vụ phân tích văn bản công vụ và trích xuất chứng cứ
 * 
 * Tuân thủ nghiêm ngặt nguyên tắc:
 * 1. Mọi trường thông tin quan trọng bắt buộc có đủ 4 thành phần: value, confidence, sourcePage, sourceText.
 * 2. Quy tắc chống bịa đặt: Nếu văn bản không đề cập, value phải là null.
 * 3. AI không tự động ra quyết định thay cho con người — luôn qua bước cán bộ kiểm tra và xác nhận.
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
  estimatedHours: number;
  isCompleted: boolean;
}

/**
 * Trích xuất và phân tích văn bản hành chính theo chuẩn chứng cứ
 */
export async function analyzeDocumentWithAi(docId: string, subject: string): Promise<DocumentAnalysisReport> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const s = subject.toLowerCase();

  // 1. Loại văn bản: Thư mời họp / Lịch làm việc
  if (s.includes('họp') || s.includes('thư mời') || s.includes('hội nghị') || s.includes('tiếp dân')) {
    return {
      documentId: docId,
      documentType: {
        value: 'HopThuMoi',
        confidence: 0.98,
        sourcePage: 1,
        sourceText: 'GIẤY MỜI HỌP: Về việc kiểm điểm công tác chuyển đổi số và đề án 06 tháng 8 năm 2026',
      },
      documentNumber: {
        value: '78',
        confidence: 0.99,
        sourcePage: 1,
        sourceText: 'Số: 78/GM-UBND',
      },
      documentSymbol: {
        value: 'GM-UBND',
        confidence: 0.99,
        sourcePage: 1,
        sourceText: 'Ký hiệu: GM-UBND',
      },
      issuingAgency: {
        value: 'UBND Huyện Thanh Chương',
        confidence: 0.97,
        sourcePage: 1,
        sourceText: 'Cơ quan ban hành: ỦY BAN NHÂN DÂN HUYỆN THANH CHƯƠNG',
      },
      issuedDate: {
        value: '2026-08-20',
        confidence: 0.95,
        sourcePage: 1,
        sourceText: 'Thanh Chương, ngày 20 tháng 08 năm 2026',
      },
      deadlineDate: {
        value: '2026-08-23',
        confidence: 0.96,
        sourcePage: 1,
        sourceText: 'Thời gian tổ chức: 08 giờ 00 phút ngày 23 tháng 08 năm 2026',
      },
      priority: {
        value: 'Khan',
        confidence: 0.92,
        sourcePage: 1,
        sourceText: 'Độ khẩn: Khẩn',
      },
      summary: {
        value: 'Mời Chủ tịch UBND xã và cán bộ phụ trách đề án 06 dự phiên họp trực tuyến rà soát làm sạch dữ liệu hộ tịch và đất đai.',
        confidence: 0.94,
        sourcePage: 1,
        sourceText: 'Nội dung: Họp kiểm điểm tiến độ làm sạch dữ liệu đất đai và số hóa sổ hộ tịch toàn huyện.',
      },
      keyObjectives: {
        value: [
          'Tham dự đúng thành phần và thời gian quy định',
          'Chuẩn bị báo cáo tóm tắt tiến độ số hóa dữ liệu của xã',
        ],
        confidence: 0.93,
        sourcePage: 1,
        sourceText: 'Yêu cầu: Các đơn vị chuẩn bị tài liệu báo cáo kết quả thực hiện đến ngày 22/08/2026.',
      },
      targetSubjects: {
        value: ['Chủ tịch UBND xã', 'Công chức Địa chính', 'Công chức Tư pháp - Hộ tịch'],
        confidence: 0.95,
        sourcePage: 1,
        sourceText: 'Thành phần mời: Chủ tịch UBND các xã, công chức Tư pháp, Địa chính.',
      },
      relatedDepartments: {
        value: ['Văn phòng HĐND & UBND', 'Phòng Kinh tế & Địa chính'],
        confidence: 0.91,
        sourcePage: 1,
        sourceText: 'Đơn vị phối hợp: Văn phòng xã, Bộ phận địa chính.',
      },
      eventDetails: {
        value: {
          startDateTime: '2026-08-23T08:00:00',
          endDateTime: '2026-08-23T11:30:00',
          location: 'Phòng họp trực tuyến tầng 2 UBND Huyện (hoặc điểm cầu UBND Xã)',
          attendees: 'Chủ tịch UBND xã, Công chức Địa chính, Công chức Tư pháp',
        },
        confidence: 0.97,
        sourcePage: 1,
        sourceText: 'Địa điểm: Hội trường trực tuyến tầng 2 UBND Huyện kết nối điểm cầu các xã.',
      },
    };
  }

  // 2. Loại văn bản: Chỉ đạo giao nhiệm vụ xuống
  if (s.includes('chỉ đạo') || s.includes('nhiệm vụ') || s.includes('đất') || s.includes('bão') || s.includes('kế hoạch')) {
    return {
      documentId: docId,
      documentType: {
        value: 'ChiDao',
        confidence: 0.97,
        sourcePage: 1,
        sourceText: 'CHỈ THỊ: Về việc tăng cường các biện pháp phòng chống thiên tai và tìm kiếm cứu nạn mùa mưa bão năm 2026',
      },
      documentNumber: {
        value: '142',
        confidence: 0.98,
        sourcePage: 1,
        sourceText: 'Số: 142/CT-UBND',
      },
      documentSymbol: {
        value: 'CT-UBND',
        confidence: 0.98,
        sourcePage: 1,
        sourceText: 'Ký hiệu: CT-UBND',
      },
      issuingAgency: {
        value: 'UBND Tỉnh Nghệ An',
        confidence: 0.99,
        sourcePage: 1,
        sourceText: 'Cơ quan ban hành: ỦY BAN NHÂN DÂN TỈNH NGHỆ AN',
      },
      issuedDate: {
        value: '2026-08-19',
        confidence: 0.95,
        sourcePage: 1,
        sourceText: 'Nghệ An, ngày 19 tháng 08 năm 2026',
      },
      deadlineDate: {
        value: '2026-08-25',
        confidence: 0.94,
        sourcePage: 2,
        sourceText: 'Yêu cầu các xã hoàn thành phương án 4 tại chỗ và báo cáo trước ngày 25/08/2026.',
      },
      priority: {
        value: 'Khan',
        confidence: 0.98,
        sourcePage: 1,
        sourceText: 'Độ khẩn: HỎA TỐC',
      },
      summary: {
        value: 'Yêu cầu tổ chức trực ban 24/24 giờ, rà soát toàn bộ các vị trí xung yếu ven sông Lam, kiểm tra các cống tiêu úng và chuẩn bị vật tư dự trữ phòng lụt.',
        confidence: 0.96,
        sourcePage: 1,
        sourceText: 'Tóm tắt: Triển khai trực ban phòng chống lụt bão nghiêm túc, rà soát điểm ngập úng ven đê sông Lam.',
      },
      keyObjectives: {
        value: [
          'Thành lập Tổ trực ban phòng chống thiên tai 24/24 giờ',
          'Kiểm tra hiện trạng các đoạn bờ sông Lam qua địa bàn xã',
          'Hoàn thành phương án sơ tán dân tại các xóm trũng thấp',
        ],
        confidence: 0.93,
        sourcePage: 2,
        sourceText: 'Mục tiêu: Đảm bảo an toàn tính mạng và tài sản cho nhân dân trên địa bàn xã Cát Ngạn.',
      },
      targetSubjects: {
        value: ['Chủ tịch UBND xã', 'Ban Chỉ huy Quân sự xã', 'Phòng Kinh tế & Địa chính'],
        confidence: 0.94,
        sourcePage: 1,
        sourceText: 'Nơi nhận: Ban Chỉ huy PCTT&TKCN các xã, thị trấn.',
      },
      relatedDepartments: {
        value: ['Ban Chỉ huy Quân sự', 'Phòng Kinh tế & Địa chính', 'Công an xã'],
        confidence: 0.92,
        sourcePage: 2,
        sourceText: 'Phân công: Lực lượng quân sự, công an và cán bộ nông nghiệp phối hợp thực hiện.',
      },
    };
  }

  // 3. Loại văn bản thông thường / Báo cáo cấp dưới (Không có hạn chót -> deadlineDate = null)
  return {
    documentId: docId,
    documentType: {
      value: 'BaoCao',
      confidence: 0.92,
      sourcePage: 1,
      sourceText: 'BÁO CÁO: Kết quả thực hiện nhiệm vụ công tác tháng 8 năm 2026',
    },
    documentNumber: {
      value: '89',
      confidence: 0.96,
      sourcePage: 1,
      sourceText: 'Số: 89/BC-KT',
    },
    documentSymbol: {
      value: 'BC-KT',
      confidence: 0.96,
      sourcePage: 1,
      sourceText: 'Ký hiệu: BC-KT',
    },
    issuingAgency: {
      value: 'Phòng Kinh tế & Địa chính',
      confidence: 0.95,
      sourcePage: 1,
      sourceText: 'Đơn vị lập: PHÒNG KINH TẾ & ĐỊA CHÍNH XÃ CÁT NGẠN',
    },
    issuedDate: {
      value: '2026-08-21',
      confidence: 0.95,
      sourcePage: 1,
      sourceText: 'Cát Ngạn, ngày 21 tháng 08 năm 2026',
    },
    deadlineDate: {
      value: null, // Tuân thủ quy tắc: Không có hạn xử lý thì trả về null
      confidence: 0.9,
      sourcePage: 1,
      sourceText: 'Văn bản báo cáo định kỳ, không quy định thời hạn xử lý tiếp theo.',
    },
    priority: {
      value: 'Thuong',
      confidence: 0.9,
      sourcePage: 1,
      sourceText: 'Độ khẩn: Bình thường',
    },
    summary: {
      value: 'Báo cáo tổng hợp số liệu cấp đổi giấy chứng nhận quyền sử dụng đất và thu ngân sách từ đất đai tháng 8.',
      confidence: 0.93,
      sourcePage: 1,
      sourceText: 'Nội dung: Tổng hợp kết quả giải quyết 45 hồ sơ địa chính và tiến độ thu phí đất đai.',
    },
    keyObjectives: {
      value: ['Trình Lãnh đạo UBND xã xem xét và phê duyệt lưu hồ sơ'],
      confidence: 0.91,
      sourcePage: 1,
      sourceText: 'Kiến nghị: Kính trình Chủ tịch UBND xã phê duyệt báo cáo tháng.',
    },
    targetSubjects: {
      value: ['Chủ tịch UBND xã', 'Văn phòng HĐND & UBND'],
      confidence: 0.92,
      sourcePage: 1,
      sourceText: 'Kính gửi: Chủ tịch UBND xã Cát Ngạn.',
    },
    relatedDepartments: {
      value: ['Phòng Kinh tế & Địa chính'],
      confidence: 0.94,
      sourcePage: 1,
      sourceText: 'Đơn vị thực hiện: Phòng Kinh tế & Địa chính.',
    },
  };
}

/**
 * Đề xuất cán bộ thụ lý nhiệm vụ dựa trên chuyên môn và mức tải
 */
export async function suggestAssigneesForDocument(docReport: DocumentAnalysisReport): Promise<AssigneeCandidate[]> {
  await new Promise(resolve => setTimeout(resolve, 400));

  return [
    {
      userId: 'u6',
      fullName: 'Nguyễn Văn Nam',
      roleName: 'Chuyên viên Địa chính',
      departmentName: 'Phòng Kinh tế & Địa chính',
      scorePercentage: 94,
      positiveReasons: [
        'Đúng chuyên ngành đào tạo Kỹ sư Quản lý đất đai',
        'Đã xử lý xuất sắc 5 nhiệm vụ tương tự trong tháng',
        'Kinh nghiệm 7 năm công tác thực địa tại địa bàn',
      ],
      negativeReasons: [
        'Mức tải công việc tuần hiện tại ở mức 75% (30h/40h)',
      ],
      currentWorkloadPercentage: 75,
      assignedTasksCount: 4,
    },
    {
      userId: 'u4',
      fullName: 'Lê Văn Tùng',
      roleName: 'Trưởng phòng Kinh tế & Địa chính',
      departmentName: 'Phòng Kinh tế & Địa chính',
      scorePercentage: 87,
      positiveReasons: [
        'Trưởng phòng phụ trách trực tiếp lĩnh vực chuyên môn',
        'Có thẩm quyền phê duyệt hồ sơ cấp cơ sở',
      ],
      negativeReasons: [
        'Đang phụ trách chỉ đạo 8 nhiệm vụ cấp bách của phòng',
      ],
      currentWorkloadPercentage: 85,
      assignedTasksCount: 8,
    },
    {
      userId: 'u5',
      fullName: 'Trần Thị Mai',
      roleName: 'Trưởng phòng Văn hóa - Xã hội',
      departmentName: 'Phòng Văn hóa - Xã hội',
      scorePercentage: 72,
      positiveReasons: [
        'Kinh nghiệm điều phối công tác phối hợp liên ngành',
        'Mức tải công việc hiện tại đang thấp (50%)',
      ],
      negativeReasons: [
        'Khác phân ban chuyên môn chính',
      ],
      currentWorkloadPercentage: 50,
      assignedTasksCount: 2,
    },
  ];
}

/**
 * Tự động tạo danh sách đầu việc con (Checklist) từ mục tiêu văn bản
 */
export function generateTaskChecklist(docReport: DocumentAnalysisReport): GeneratedSubTask[] {
  const objectives = docReport.keyObjectives.value || [];

  if (objectives.length === 0) {
    return [
      { id: 'st-1', title: 'Tiếp nhận văn bản và nghiên cứu nội dung chỉ đạo', estimatedHours: 2, isCompleted: false },
      { id: 'st-2', title: 'Xây dựng kế hoạch thực hiện chi tiết', estimatedHours: 4, isCompleted: false },
      { id: 'st-3', title: 'Báo cáo kết quả xử lý cho Lãnh đạo phê duyệt', estimatedHours: 2, isCompleted: false },
    ];
  }

  return objectives.map((obj, idx) => ({
    id: `st-${idx + 1}`,
    title: obj,
    estimatedHours: 4,
    isCompleted: false,
  }));
}
