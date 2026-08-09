import { apiFetch } from './api.config';

export interface ReadReceiptItemDto {
  userId: string;
  userFullName: string;
  readAt: string;
}

export interface ReadReceiptsResultDto {
  readers: ReadReceiptItemDto[];
  readCount: number;
}

export async function markReadReceiptApi(targetEntityType: string, targetEntityId: string) {
  return await apiFetch<{ success: boolean; message?: string; alreadyRead?: boolean }>('/api/v1/ReadReceipts', {
    method: 'POST',
    body: JSON.stringify({ targetEntityType, targetEntityId }),
  });
}

export async function getReadReceiptsApi(targetEntityType: string, targetEntityId: string) {
  return await apiFetch<ReadReceiptsResultDto>(`/api/v1/ReadReceipts/${targetEntityType}/${targetEntityId}`, {
    method: 'GET',
  });
}
