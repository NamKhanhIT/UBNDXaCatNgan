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

export interface DocumentAnalysisResult {
  category: 'MeetingInvitation' | 'SuperiorDirective' | 'TaskAssignmentDown' | 'ReportSubmissionUp' | 'Other';
  title?: string | null;
  summary?: string | null;
  deadlineDate?: string | null;
  eventStartDateTime?: string | null;
  eventEndDateTime?: string | null;
  subjects: string[];
  objectives?: string | null;
  suggestedDepartmentId?: string | null;
  suggestedDepartmentName?: string | null;
  confidence: number;
  deadlineSeemsUnreasonable: boolean;
  lowConfidence: boolean;
  validationWarnings?: string[];
}

export interface AlternativeCandidate {
  userId: string;
  fullName: string;
  reason: string;
}

export interface AssignmentSuggestion {
  suggestedUserId: string;
  suggestedUserName: string;
  reason: string;
  suggestedDepartmentId?: string | null;
  suggestedDepartmentName?: string | null;
  confidence: number;
  alternatives: AlternativeCandidate[];
}

export interface ConfirmClassificationRequest {
  aiCategory?: string;
  aiTitle?: string;
  aiSummary?: string;
  aiExtractedDeadline?: string | null;
  aiSuggestedDepartmentId?: string | null;
  aiObjectives?: string;
  aiExtractedSubjects?: string;
  route: 'event' | 'assign' | 'review';
}

export interface CreateTaskFromInboxRequest {
  assigneeId: string;
  departmentId?: string;
  priority?: number;
}

export interface SubTaskDto {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface ToggleSubTaskResult {
  subTaskId: string;
  isCompleted: boolean;
  progressPercentage: number;
  completedCount: number;
  totalCount: number;
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

export async function confirmClassificationApi(
  id: string,
  request: ConfirmClassificationRequest
): Promise<{ success: boolean; data?: any; error?: string }> {
  return await apiFetch<any>(`/api/v1/Inbox/${id}/confirm-classification`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function suggestAssignmentApi(
  id: string
): Promise<{ success: boolean; data?: AssignmentSuggestion; error?: string }> {
  return await apiFetch<AssignmentSuggestion>(`/api/v1/Inbox/${id}/suggest-assignment`, {
    method: 'POST',
  });
}

export async function createTaskFromInboxApi(
  id: string,
  request: CreateTaskFromInboxRequest
): Promise<{
  success: boolean;
  data?: {
    taskItemId: string;
    subTaskCount: number;
    subTasks: { id: string; title: string }[];
  };
  error?: string;
}> {
  return await apiFetch<any>(`/api/v1/Inbox/${id}/create-task`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function toggleSubTaskApi(
  subTaskId: string
): Promise<{ success: boolean; data?: ToggleSubTaskResult; error?: string }> {
  return await apiFetch<ToggleSubTaskResult>(`/api/v1/Inbox/subtask/${subTaskId}/toggle`, {
    method: 'POST',
  });
}
