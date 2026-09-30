import { apiFetch } from '../../services/api.config';
import type { TaskItemDto } from '../../services/task.service';
import { dataOf, type Page } from '../workflow/workflow.service';

/** Calendar navigation must not silently stop at the first task page or a fixed month window. */
export async function loadCalendarTasks(path: string, signal: AbortSignal): Promise<TaskItemDto[]> {
  const tasks: TaskItemDto[] = [];
  for (let page = 1; ; page++) {
    const result = dataOf(await apiFetch<Page<TaskItemDto>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=100`, { signal }));
    tasks.push(...result.items);
    if (tasks.length >= result.totalCount || result.items.length === 0) return tasks;
  }
}
