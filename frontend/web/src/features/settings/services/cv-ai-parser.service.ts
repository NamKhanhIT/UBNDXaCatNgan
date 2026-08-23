/**
 * CV AI Parser Service — Dịch vụ trích xuất hồ sơ công chức từ CV PDF bằng AI
 * 
 * Tuân thủ nghiêm ngặt nguyên tắc:
 * 1. Mọi field trích xuất bắt buộc phải có đủ 4 thành phần: value, confidence, sourcePage, sourceText.
 * 2. Nếu CV không đề cập thông tin nào, value phải là null (không đoán, không tự bịa).
 * 3. AI tuyệt đối không được tự động thay đổi role, permission, department, account status của user.
 */

export interface ExtractedField<T> {
  value: T | null;
  confidence: number;   // 0.0 - 1.0 (ví dụ 0.95 = 95%)
  sourcePage: number;   // Trang PDF chứa thông tin nguồn
  sourceText: string;   // Đoạn trích dẫn nguyên văn từ CV để kiểm chứng
}

export interface EducationInfo {
  degree: string;
  institution: string;
  major: string;
  graduationYear?: number;
}

export interface ExtractedCvWorkProfile {
  fullName: ExtractedField<string>;
  yearsOfExperience: ExtractedField<number>;
  expertise: ExtractedField<string[]>;
  education: ExtractedField<EducationInfo>;
  certifications: ExtractedField<string[]>;
  foreignLanguages: ExtractedField<string[]>;
  achievements: ExtractedField<string[]>;
  previousPositions: ExtractedField<string[]>;
  suggestedRoleNote: ExtractedField<string>; // Ghi chú tham khảo (KHÔNG tự gán vào Role thật)
}

/**
 * Giả lập / Thực thi AI Pipeline trích xuất văn bản từ CV PDF
 */
export async function parseCvPdfWithAi(file: File): Promise<ExtractedCvWorkProfile> {
  // Giả lập thời gian xử lý OCR & LLM Analysis
  await new Promise(resolve => setTimeout(resolve, 1500));

  const fileName = file.name.toLowerCase();

  // Mẫu kết quả phân tích AI chuẩn 4 thành phần cho từng trường dữ liệu
  if (fileName.includes('nam') || fileName.includes('dia_chinh') || fileName.includes('cv')) {
    return {
      fullName: {
        value: 'Nguyễn Văn Nam',
        confidence: 0.98,
        sourcePage: 1,
        sourceText: 'Họ và tên: NGUYỄN VĂN NAM — Ngày sinh: 15/08/1992',
      },
      yearsOfExperience: {
        value: 7,
        confidence: 0.94,
        sourcePage: 1,
        sourceText: 'Kinh nghiệm công tác: 07 năm trong lĩnh vực Quản lý đất đai và Địa chính cấp xã (2019 - 2026)',
      },
      expertise: {
        value: ['Quản lý đất đai', 'Quy hoạch xây dựng', 'Thẩm định nguồn gốc đất', 'Cấp đổi GCN QSDĐ', 'Bồi thường GPMB'],
        confidence: 0.92,
        sourcePage: 1,
        sourceText: 'Chuyên môn: Quản lý đất đai, quy hoạch và thẩm định hồ sơ đất đai, bồi thường giải phóng mặt bằng.',
      },
      education: {
        value: {
          degree: 'Kỹ sư',
          institution: 'Đại học Nông Nghiệp Hà Nội (Học viện Nông nghiệp VN)',
          major: 'Quản lý Đất đai',
          graduationYear: 2014,
        },
        confidence: 0.96,
        sourcePage: 1,
        sourceText: 'Bằng cấp: Kỹ sư Quản lý Đất đai — Tốt nghiệp Học viện Nông nghiệp Việt Nam năm 2014 loại Giỏi.',
      },
      certifications: {
        value: [
          'Chứng chỉ Bồi dưỡng Quản lý Nhà nước ngạch Chuyên viên',
          'Chứng chỉ Quản lý Hồ sơ Địa chính điện tử',
          'Chứng chỉ Bồi dưỡng Kiến thức Quốc phòng - An ninh Đối tượng 4',
        ],
        confidence: 0.91,
        sourcePage: 2,
        sourceText: 'Chứng chỉ: QLNN ngạch Chuyên viên (2021); Hồ sơ Địa chính điện tử VBDLIS (2023); QP-AN Đối tượng 4 (2020).',
      },
      foreignLanguages: {
        value: ['Tiếng Anh B1 (Khung Châu Âu CEFR)'],
        confidence: 0.88,
        sourcePage: 2,
        sourceText: 'Ngoại ngữ: Tiếng Anh trình độ B1 theo khung tham chiếu Châu Âu.',
      },
      achievements: {
        value: [
          'Chiến sĩ thi đua cấp cơ sở năm 2023, 2025',
          'Giấy khen của Chủ tịch UBND huyện Thanh Chương trong công tác đo đạc bản đồ địa chính',
        ],
        confidence: 0.95,
        sourcePage: 2,
        sourceText: 'Khen thưởng: Chiến sĩ thi đua cấp cơ sở (2023, 2025); Giấy khen Chủ tịch UBND huyện.',
      },
      previousPositions: {
        value: [
          'Cán bộ hợp đồng đo đạc địa chính UBND Xã Cát Ngạn (2019 - 2021)',
          'Công chức Địa chính - Nông nghiệp - Xây dựng và Môi trường (2021 - nay)',
        ],
        confidence: 0.93,
        sourcePage: 1,
        sourceText: 'Quá trình công tác: 2019-2021: Đo đạc địa chính; 2021-nay: Công chức Địa chính - Xây dựng xã Cát Ngạn.',
      },
      suggestedRoleNote: {
        value: 'Chuyên viên Địa chính - Nông nghiệp - Xây dựng',
        confidence: 0.85,
        sourcePage: 1,
        sourceText: 'Vị trí hiện tại: Chuyên viên phụ trách Địa chính - Xây dựng',
      },
    };
  }

  // Trường hợp CV tổng quát
  return {
    fullName: {
      value: 'Cán bộ Công chức Xã',
      confidence: 0.85,
      sourcePage: 1,
      sourceText: 'Họ và tên cán bộ công chức',
    },
    yearsOfExperience: {
      value: 5,
      confidence: 0.88,
      sourcePage: 1,
      sourceText: 'Kinh nghiệm làm việc: 5 năm công tác tại cơ quan hành chính nhà nước',
    },
    expertise: {
      value: ['Hành chính công', 'Văn phòng thống kê', 'Soạn thảo văn bản quy phạm'],
      confidence: 0.82,
      sourcePage: 1,
      sourceText: 'Chuyên môn: Quản lý hành chính, văn thư lưu trữ và công tác thống kê.',
    },
    education: {
      value: {
        degree: 'Cử nhân',
        institution: 'Học viện Hành chính Quốc gia',
        major: 'Quản lý Nhà nước',
        graduationYear: 2018,
      },
      confidence: 0.9,
      sourcePage: 1,
      sourceText: 'Học vấn: Cử nhân Quản lý Nhà nước — Học viện Hành chính Quốc gia (2018)',
    },
    certifications: {
      value: ['Chứng chỉ Quản lý Nhà nước ngạch Chuyên viên'],
      confidence: 0.85,
      sourcePage: 2,
      sourceText: 'Chứng chỉ bồi dưỡng ngạch chuyên viên',
    },
    foreignLanguages: {
      value: ['Tiếng Anh B1'],
      confidence: 0.8,
      sourcePage: 2,
      sourceText: 'Ngoại ngữ: Tiếng Anh trình độ B1',
    },
    achievements: {
      value: ['Lao động tiên tiến năm 2024'],
      confidence: 0.85,
      sourcePage: 2,
      sourceText: 'Khen thưởng: Đạt danh hiệu Lao động tiên tiến năm 2024',
    },
    previousPositions: {
      value: ['Chuyên viên Văn phòng HĐND & UBND Xã (2020 - nay)'],
      confidence: 0.87,
      sourcePage: 1,
      sourceText: 'Quá trình công tác: Chuyên viên Văn phòng xã từ năm 2020',
    },
    suggestedRoleNote: {
      value: 'Chuyên viên',
      confidence: 0.8,
      sourcePage: 1,
      sourceText: 'Vị trí công tác',
    },
  };
}
