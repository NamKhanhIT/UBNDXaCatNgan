type TaskState = { status: string; dueDate?: string };

export function isTaskActionable(task: TaskState): boolean {
  return task.status === 'Todo' || task.status === 'InProgress';
}

export function isTaskOpen(task: TaskState): boolean {
  return isTaskActionable(task) || task.status === 'InReview';
}

// Matches the server's overdue filter. Waiting for review is separate from late submission.
export function isTaskOverdue(task: TaskState, now = Date.now()): boolean {
  return isTaskActionable(task) && !!task.dueDate && Date.parse(task.dueDate) < now;
}

export function taskStatusDistribution(counts: { completed: number; active: number; pendingReview: number; overdue: number; cancelled: number }) {
  return { ...counts, active: Math.max(0, counts.active - counts.overdue) };
}
