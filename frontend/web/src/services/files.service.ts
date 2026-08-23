import { apiFetch, getApiBaseUrl, getStoredToken } from './api.config';

export interface DocumentAttachmentDto {
  id: string;
  documentId: string;
  targetType: string;
  fileName: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  attachmentType: string;
  isMainDocument: boolean;
  uploadedAt: string;
}

export async function getDocumentAttachmentsApi(
  documentId: string
): Promise<{ success: boolean; data?: DocumentAttachmentDto[]; error?: string }> {
  return await apiFetch<DocumentAttachmentDto[]>(`/api/v1/Files/document/${documentId}`, {
    method: 'GET',
  });
}

export function getFileViewUrl(attachmentId: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/v1/Files/${attachmentId}/view`;
}

export function getFileDownloadUrl(attachmentId: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/v1/Files/${attachmentId}/download`;
}

export async function uploadFileApi(
  file: File,
  documentId: string,
  targetType: string = 'Inbox',
  attachmentType: string = 'MainDocument'
): Promise<{ success: boolean; data?: string; error?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', documentId);
  formData.append('targetType', targetType);
  formData.append('attachmentType', attachmentType);

  const token = getStoredToken();
  const baseUrl = getApiBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/api/v1/Files/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const text = await res.text();
    let json: any = null;
    if (text && text.trim()) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }

    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || json?.message || `Lỗi tải lên tệp (Mã HTTP ${res.status})` };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi mạng khi upload file.' };
  }
}

export async function uploadAndAnalyzeApi(
  file: File,
  documentId?: string
): Promise<{
  success: boolean;
  data?: { attachmentId: string; documentId: string };
  analysisResult?: any;
  aiError?: string;
  error?: string;
  message?: string;
}> {
  const effectiveDocId = documentId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000000');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', effectiveDocId);

  const token = getStoredToken();
  const baseUrl = getApiBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/api/v1/Files/upload-and-analyze`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const text = await res.text();
    let json: any = null;
    if (text && text.trim()) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }

    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || json?.message || `Lỗi phân tích văn bản (Mã HTTP ${res.status})` };
    }
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi kết nối khi gửi file phân tích AI.' };
  }
}
