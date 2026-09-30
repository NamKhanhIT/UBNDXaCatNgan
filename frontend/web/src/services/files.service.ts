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

const uploadRequestIds = new WeakMap<File, Map<string, string>>();

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
  const uploads = uploadRequestIds.get(file) || new Map<string, string>();
  const uploadKey = `${targetType}:${documentId}:${attachmentType}`;
  if (!uploads.has(uploadKey)) uploads.set(uploadKey, crypto.randomUUID());
  uploadRequestIds.set(file, uploads);
  formData.append('requestId', uploads.get(uploadKey)!);

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
  if (!documentId) return { success: false, error: 'Vui lòng lưu thông tin văn bản trước khi tải và phân tích tệp.' };
  const effectiveDocId = documentId;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', effectiveDocId);
  const uploads = uploadRequestIds.get(file) || new Map<string, string>();
  const uploadKey = `Inbox:${documentId}:MainDocument`;
  if (!uploads.has(uploadKey)) uploads.set(uploadKey, crypto.randomUUID());
  uploadRequestIds.set(file, uploads);
  formData.append('requestId', uploads.get(uploadKey)!);

  return await apiUpload('/api/v1/Files/upload-and-analyze', formData);
}
