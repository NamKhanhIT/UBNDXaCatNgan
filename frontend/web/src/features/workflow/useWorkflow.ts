'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../services/api.config';
import { useAuth } from '../auth/AuthContext';
import { useSignalR, useSignalREvent } from '../../hooks/use-signalr';
import { dataOf, workflowMutation, WorkflowApiError, type WorkflowPermissions } from './workflow.service';

const defaultWorkflowLoader = async <T,>(path: string, signal: AbortSignal): Promise<T> => dataOf(await apiFetch<T>(path, { signal }));
export function useWorkflowQuery<T>(path: string | null, loader: (path: string, signal: AbortSignal) => Promise<T> = defaultWorkflowLoader) {
  const { user } = useAuth();
  const { isConnected } = useSignalR();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  const identity = `${user?.userId || ''}:${path || ''}`;
  const [state, setState] = useState<{ identity?: string; data?: T; error?: Error; loading: boolean }>({ loading: !!path });
  useSignalREvent('ReceiveNotification', refresh);
  useSignalREvent('SYSTEM_RECONNECTED', refresh);
  useEffect(() => {
    window.addEventListener('workflow:changed', refresh);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    const interval = !isConnected ? window.setInterval(visible, 30000) : undefined;
    return () => {
      window.removeEventListener('workflow:changed', refresh);
      document.removeEventListener('visibilitychange', visible);
      if (interval) window.clearInterval(interval);
    };
  }, [isConnected, refresh]);
  useEffect(() => {
    if (!path) { setState({ identity, loading: false }); return; }
    const controller = new AbortController();
    let current = true;
    setState(previous => ({ identity, data: previous.identity === identity ? previous.data : undefined, loading: true }));
    loader(path, controller.signal).then(data => {
      if (current) setState({ identity, data, loading: false });
    }).catch(error => {
      if (current) setState(previous => ({ identity, error, loading: false,
        data: error instanceof WorkflowApiError && [401, 403, 404].includes(error.status || 0) ? undefined : previous.identity === identity ? previous.data : undefined }));
    });
    return () => { current = false; controller.abort(); };
  }, [path, revision, identity, loader]);
  return { ...state, data: state.identity === identity ? state.data : undefined,
    error: state.identity === identity ? state.error : undefined, refresh, isConnected };
}

export const useWorkflowPermissions = () => useWorkflowQuery<WorkflowPermissions>('/api/v1/WorkflowPermissions/me');

/** Reuse the same logical request after a transport failure; new content receives a new key. */
export function useRequestKey() {
  const request = useRef<{ content: string; id: string }>();
  return useCallback((payload: object) => {
    const content = JSON.stringify(payload);
    if (request.current?.content !== content) request.current = { content, id: crypto.randomUUID() };
    return request.current!.id;
  }, []);
}

/** Keep the submitted operation intact until a network failure has been resolved. */
export function useWorkflowMutation(onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<Error>();
  const locked = useRef(false);
  const frozen = useRef<{ path: string; payload: object; method: string }>();
  const saved = useRef(onSaved); saved.current = onSaved;
  const execute = async (operation: { path: string; payload: object; method: string }) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(undefined); frozen.current = operation;
    try {
      await workflowMutation(operation.path, operation.payload, operation.method);
      frozen.current = undefined; setUncertain(false); saved.current();
    } catch (issue) {
      const unknown = issue instanceof WorkflowApiError && issue.status === 0;
      setError(issue as Error); setUncertain(unknown);
      if (!unknown) frozen.current = undefined;
    } finally { locked.current = false; setBusy(false); }
  };
  return { busy, uncertain, error,
    run: (path: string, payload: object, method = 'POST') => execute(frozen.current || {
      path, method, payload: { ...payload, requestId: crypto.randomUUID() }
    }),
    retry: () => { if (frozen.current) void execute(frozen.current); }
  };
}
