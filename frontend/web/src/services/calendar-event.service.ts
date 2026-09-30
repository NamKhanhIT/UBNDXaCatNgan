import { apiFetch, ApiResponse } from './api.config';

export type EventTypeEnum = 'Meeting' | 'Conference' | 'Training' | 'FieldTrip' | 'Other';

export interface EventParticipantDto {
  userId: string;
  userName: string;
  hasResponded: boolean;
  responseStatus: string;
}

export interface CalendarEventDto {
  id: string;
  version: string;
  sourceInboxDocumentId?: string;
  canEdit: boolean;
  title: string;
  description: string;
  eventType: EventTypeEnum;
  eventTypeName: string;
  startDateTime: string;
  endDateTime: string;
  isAllDay: boolean;
  location?: string;
  organizerId: string;
  organizerName: string;
  departmentId?: string;
  departmentName?: string;
  colorTag?: string;
  relatedTaskItemId?: string;
  participants: EventParticipantDto[];
  reminderOffsetsMinutes: number[];
}

export interface CreateCalendarEventData {
  requestId?: string;
  sourceInboxDocumentId?: string;
  sourceDocumentVersion?: string;
  title: string;
  description?: string;
  eventType: EventTypeEnum;
  startDateTime: string;
  endDateTime: string;
  isAllDay?: boolean;
  location?: string;
  organizerId?: string;
  departmentId?: string;
  colorTag?: string;
  relatedTaskItemId?: string;
  participantUserIds?: string[];
  reminderOffsetsMinutes?: number[];
}

export interface UpdateCalendarEventData {
  id: string;
  version: string;
  title: string;
  description?: string;
  eventType: EventTypeEnum;
  startDateTime: string;
  endDateTime: string;
  isAllDay?: boolean;
  location?: string;
  departmentId?: string;
  colorTag?: string;
  participantUserIds?: string[];
  reminderOffsetsMinutes?: number[];
}

export async function getCalendarEventsApi(params: {
  from?: string;
  to?: string;
  departmentId?: string;
  userId?: string;
} = {}): Promise<ApiResponse<CalendarEventDto[]>> {
  const queryParts: string[] = [];
  if (params.from) queryParts.push(`from=${encodeURIComponent(params.from)}`);
  if (params.to) queryParts.push(`to=${encodeURIComponent(params.to)}`);
  if (params.departmentId) queryParts.push(`departmentId=${encodeURIComponent(params.departmentId)}`);
  if (params.userId) queryParts.push(`userId=${encodeURIComponent(params.userId)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return await apiFetch<CalendarEventDto[]>(`/api/v1/CalendarEvents${queryString}`, {
    method: 'GET',
  });
}

const pendingRequests = new Map<string, string>();
async function mutateCalendar<T>(path: string, method: string, data: object): Promise<ApiResponse<T>> {
  const fingerprint = JSON.stringify([path, method, data]);
  const requestId = (data as { requestId?: string }).requestId || pendingRequests.get(fingerprint) || crypto.randomUUID();
  pendingRequests.set(fingerprint, requestId);
  const response = await apiFetch<T>(path, { method, body: JSON.stringify({ ...data, requestId }) });
  if (response.success) { pendingRequests.delete(fingerprint); window.dispatchEvent(new Event('workflow:changed')); }
  return response;
}
export async function createCalendarEventApi(data: CreateCalendarEventData): Promise<ApiResponse<string>> {
  return mutateCalendar('/api/v1/CalendarEvents', 'POST', data);
}

export async function updateCalendarEventApi(id: string, data: UpdateCalendarEventData): Promise<ApiResponse<boolean>> {
  return mutateCalendar(`/api/v1/CalendarEvents/${id}`, 'PUT', data);
}

export async function deleteCalendarEventApi(id: string, version: string): Promise<ApiResponse<boolean>> {
  return mutateCalendar(`/api/v1/CalendarEvents/${id}`, 'DELETE', { version });
}
