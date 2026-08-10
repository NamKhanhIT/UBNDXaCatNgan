import { apiFetch } from './api.config';

export interface InboxDocumentDto {
  id: string;
  documentNumber: string;
  subject: string;
  category: string;
  sender: string;
  receivedDate: string;
  isUrgent: boolean;
  channel?: 'Internal' | 'PublicService';
  citizenName?: string;
  citizenPhone?: string;
  serviceCode?: string;
  isScheduled: boolean;
  scheduledDate?: string;
  scheduledShift?: string;
  scheduledTaskId?: string;

  // ── Thông tin nghiệp vụ văn bản theo NĐ 30/2020 ──
  documentSymbol?: string;
  issuingAgency?: string;
  signerName?: string;
  attachmentUrl?: string;
  issuedDate?: string;
}

export interface PaginatedInboxResponse {
  items: InboxDocumentDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GetInboxParams {
  page?: number;
  pageSize?: number;
  isScheduled?: boolean;
  channel?: string;
  search?: string;
  isUrgent?: boolean;
}

export async function getInboxDocumentsApi(
  params?: GetInboxParams
): Promise<{ success: boolean; data?: PaginatedInboxResponse; error?: string }> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.append('page', String(params.page));
  if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
  if (params?.isScheduled !== undefined) searchParams.append('isScheduled', String(params.isScheduled));
  if (params?.channel) searchParams.append('channel', params.channel);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.isUrgent !== undefined) searchParams.append('isUrgent', String(params.isUrgent));

  const qs = searchParams.toString();
  const url = `/api/v1/Inbox${qs ? `?${qs}` : ''}`;
  return await apiFetch<PaginatedInboxResponse>(url, { method: 'GET' });
}

export async function getInboxDocumentByIdApi(
  id: string
): Promise<{ success: boolean; data?: InboxDocumentDto; error?: string }> {
  return await apiFetch<InboxDocumentDto>(`/api/v1/Inbox/${id}`, { method: 'GET' });
}

export async function scheduleInboxDocumentApi(
  id: string,
  scheduledDate: string,
  scheduledShift: string = 'Sang',
  assigneeId?: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  return await apiFetch<string>(`/api/v1/Inbox/${id}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ scheduledDate, scheduledShift, assigneeId }),
  });
}
