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
}

export async function getInboxDocumentsApi(channel?: string): Promise<{ success: boolean; data?: InboxDocumentDto[]; error?: string }> {
  const url = channel ? `/api/v1/Inbox?channel=${channel}` : `/api/v1/Inbox`;
  return await apiFetch<InboxDocumentDto[]>(url, { method: 'GET' });
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

