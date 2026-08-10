import { apiFetch, getApiBaseUrl } from './api.config';

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

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const baseUrl = getApiBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/api/v1/Files/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Upload file thất bại.' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi mạng khi upload file.' };
  }
}
