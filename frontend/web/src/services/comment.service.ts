import { apiFetch } from './api.config';

export interface TaskCommentDto {
  id: string;
  taskItemId: string;
  userId: string;
  userFullName: string;
  content: string;
  createdAt: string;
}

export interface CreateCommentResultDto {
  success: boolean;
  message?: string;
  commentId?: string;
  mentionedUsers?: string[];
}

export async function getCommentsApi(taskId: string) {
  return await apiFetch<TaskCommentDto[]>(`/api/v1/Tasks/${taskId}/comments`, {
    method: 'GET',
  });
}

export async function createCommentApi(taskId: string, content: string) {
  return await apiFetch<CreateCommentResultDto>(`/api/v1/Tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}
