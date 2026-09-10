import { apiFetch, apiUpload, getApiBaseUrl } from './api.config';

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
  documentId: string,
  targetType: string = 'Inbox'
): Promise<{ success: boolean; data?: DocumentAttachmentDto[]; error?: string }> {
  return await apiFetch<DocumentAttachmentDto[]>(
    `/api/v1/Files/document/${documentId}?targetType=${encodeURIComponent(targetType)}`,
    {
      method: 'GET',
    }
  );
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
  // BẢO MẬT (Audit M7): Upload file qua apiUpload (hỗ trợ Bearer auth & retry 401)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', documentId);
  formData.append('targetType', targetType);
  formData.append('attachmentType', attachmentType);

  return await apiUpload<string>('/api/v1/Files/upload', formData);
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
  // BẢO MẬT (Audit M7): Upload và phân tích AI qua apiUpload (hỗ trợ Bearer auth & retry 401)
  const effectiveDocId = documentId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000000');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', effectiveDocId);

  return await apiUpload('/api/v1/Files/upload-and-analyze', formData);
}
