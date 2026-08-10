import { apiFetch, ApiResponse } from './api.config';

export type DocumentTypeEnum = 'QuyetDinh' | 'CongVan' | 'ThongBao' | 'BaoCao' | 'KeHoach' | 'ToTrinh' | 'CongDien';
export type OutgoingDocumentStatusEnum = 'Draft' | 'PendingSignature' | 'Issued' | 'Sent' | 'Rejected';

export interface OutgoingDocumentDto {
  id: string;
  documentNumber?: string;
  documentType: DocumentTypeEnum;
  documentTypeName: string;
  title: string;
  content: string;
  status: OutgoingDocumentStatusEnum;
  statusName: string;
  draftedByUserId: string;
  draftedByUserName: string;
  draftedAt: string;
  signedByUserId?: string;
  signedByUserName?: string;
  signedAt?: string;
  issuedDate?: string;
  recipientNote?: string;
  attachmentUrl?: string;
  relatedTaskItemId?: string;
  isUrgent: boolean;
  rejectionReason?: string;
  isCorrectionDocument: boolean;
  originalDocumentId?: string;
  documentSequenceNumber?: number;
  documentSymbol?: string;
  recallReason?: string;
  recalledAt?: string;
}

export interface PaginatedOutgoingDocumentsResponse {
  items: OutgoingDocumentDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GetOutgoingDocumentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OutgoingDocumentStatusEnum;
  documentType?: DocumentTypeEnum;
}

export interface CreateOutgoingDocumentData {
  documentType: DocumentTypeEnum;
  title: string;
  content: string;
  recipientNote?: string;
  attachmentUrl?: string;
  relatedTaskItemId?: string;
  isUrgent?: boolean;
  isCorrectionDocument?: boolean;
  originalDocumentId?: string;
}

export interface UpdateOutgoingDocumentData {
  documentType: DocumentTypeEnum;
  title: string;
  content: string;
  recipientNote?: string;
  attachmentUrl?: string;
  relatedTaskItemId?: string;
  isUrgent?: boolean;
}

export async function getOutgoingDocumentsApi(params: GetOutgoingDocumentsParams = {}): Promise<ApiResponse<PaginatedOutgoingDocumentsResponse>> {
  const queryParts: string[] = [];

  if (params.page !== undefined) queryParts.push(`page=${params.page}`);
  if (params.pageSize !== undefined) queryParts.push(`pageSize=${params.pageSize}`);
  if (params.search && params.search.trim()) queryParts.push(`search=${encodeURIComponent(params.search.trim())}`);
  if (params.status && params.status !== ('ALL' as any)) queryParts.push(`status=${encodeURIComponent(params.status)}`);
  if (params.documentType && params.documentType !== ('ALL' as any)) queryParts.push(`documentType=${encodeURIComponent(params.documentType)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  return await apiFetch<PaginatedOutgoingDocumentsResponse>(`/api/v1/OutgoingDocuments${queryString}`, {
    method: 'GET',
  });
}

export async function getOutgoingDocumentByIdApi(id: string): Promise<ApiResponse<OutgoingDocumentDto>> {
  return await apiFetch<OutgoingDocumentDto>(`/api/v1/OutgoingDocuments/${id}`, {
    method: 'GET',
  });
}

export async function createOutgoingDocumentApi(data: CreateOutgoingDocumentData): Promise<ApiResponse<string>> {
  return await apiFetch<string>('/api/v1/OutgoingDocuments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOutgoingDocumentApi(id: string, data: UpdateOutgoingDocumentData): Promise<ApiResponse<boolean>> {
  return await apiFetch<boolean>(`/api/v1/OutgoingDocuments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function submitOutgoingDocumentForSignatureApi(id: string): Promise<ApiResponse<boolean>> {
  return await apiFetch<boolean>(`/api/v1/OutgoingDocuments/${id}/submit-for-signature`, {
    method: 'POST',
  });
}

export async function signAndIssueOutgoingDocumentApi(id: string): Promise<ApiResponse<{ documentNumber: string }>> {
  return await apiFetch<{ documentNumber: string }>(`/api/v1/OutgoingDocuments/${id}/sign`, {
    method: 'POST',
  });
}

export async function rejectOutgoingDocumentApi(id: string, rejectionReason: string): Promise<ApiResponse<boolean>> {
  return await apiFetch<boolean>(`/api/v1/OutgoingDocuments/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason }),
  });
}

export async function revokeOutgoingDocumentApi(id: string): Promise<ApiResponse<boolean>> {
  return await apiFetch<boolean>(`/api/v1/OutgoingDocuments/${id}/revoke`, {
    method: 'POST',
  });
}

export async function revokeIssuedOutgoingDocumentApi(id: string, reason: string): Promise<ApiResponse<boolean>> {
  return await apiFetch<boolean>(`/api/v1/OutgoingDocuments/${id}/revoke-issued`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function cancelOutgoingDocumentApi(id: string, reason: string): Promise<ApiResponse<boolean>> {
  return await apiFetch<boolean>(`/api/v1/OutgoingDocuments/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function createDocumentVersionApi(
  id: string,
  data: { title: string; content: string; attachmentUrl?: string; changeReason: string }
): Promise<ApiResponse<string>> {
  return await apiFetch<string>(`/api/v1/OutgoingDocuments/${id}/versions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface DocumentVersionDto {
  id: string;
  documentId: string;
  versionNumber: number;
  versionName: string;
  title: string;
  content: string;
  documentNumber?: string;
  documentSymbol?: string;
  attachmentUrl?: string;
  changeReason: string;
  changedByUserId: string;
  changedByName: string;
  changedAt: string;
}

export async function getDocumentVersionsApi(id: string): Promise<ApiResponse<DocumentVersionDto[]>> {
  return await apiFetch<DocumentVersionDto[]>(`/api/v1/OutgoingDocuments/${id}/versions`, {
    method: 'GET',
  });
}
