'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch, apiFileBlob } from '../../services/api.config';
import { uploadFileApi, type DocumentAttachmentDto } from '../../services/files.service';
import { WorkflowError, WorkflowLoading } from './WorkflowFeedback';
import { useWorkflowQuery } from './useWorkflow';
import { dataOf, workflowChanged, WorkflowApiError } from './workflow.service';
import styles from './workflow.module.css';

export async function downloadProtectedFile(id: string, name: string) {
  const blob = dataOf(await apiFileBlob(`/api/v1/Files/${id}/download`));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProtectedFilePreview({ documentId, kind, canUpload = false, onBusyChange, onDirtyChange }: {
  documentId: string; kind: string; canUpload?: boolean; onBusyChange?: (value: boolean) => void; onDirtyChange?: (value: boolean) => void;
}) {
  const files = useWorkflowQuery<DocumentAttachmentDto[]>(`/api/v1/Files/document/${documentId}?targetType=${kind}`);
  const [selected, setSelected] = useState('');
  const current = files.data?.find(file => file.id === selected) || files.data?.[0];
  const [loaded, setLoaded] = useState<{ url: string; blob: Blob }>();
  const [error, setError] = useState<Error>();
  const [upload, setUpload] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState('');
  const uploadInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => { onDirtyChange?.(!!upload || uncertain); }, [upload, uncertain, onDirtyChange]);
  const saveFile = async () => {
    if (!upload || lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      const id = dataOf(await uploadFileApi(upload, documentId, kind, 'Supplement'));
      setUpload(undefined); setUncertain(false); setSelected(id); setNotice('Đã lưu tệp bổ sung.');
      if (uploadInput.current) uploadInput.current.value = '';
      workflowChanged(); files.refresh();
    } catch (issue) { setError(issue as Error); setUncertain(issue instanceof WorkflowApiError && issue.status === 0); }
    finally { lock.current = false; setBusy(false); }
  };
  const analyze = async () => {
    if (!current || lock.current) return;
    lock.current = true; setBusy(true); setError(undefined); setNotice('');
    try {
      const response = await apiFetch<{ attachmentId: string }>(`/api/v1/Files/${current.id}/analyze`, { method: 'POST' }) as Awaited<ReturnType<typeof apiFetch<{ attachmentId: string }>>> & { aiError?: string };
      dataOf(response); setNotice(response.aiError || response.message || 'Đã lưu gợi ý. Kiểm tra nội dung trước khi giao việc.'); workflowChanged();
    } catch (issue) { setError(issue as Error); }
    finally { lock.current = false; setBusy(false); }
  };
  const docx = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setLoaded(undefined); setError(undefined);
    if (!current) return;
    const controller = new AbortController();
    let active = true; let url: string | undefined;
    apiFileBlob(`/api/v1/Files/${current.id}/view`, controller.signal).then(result => {
      if (!active) return;
      const blob = dataOf(result); url = URL.createObjectURL(blob); setLoaded({ url, blob });
    }).catch(issue => { if (active) setError(issue); });
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [current?.id]);
  const fileType = current?.fileType?.toLowerCase().replace('.', '');
  useEffect(() => {
    if (!loaded || fileType !== 'docx' || !docx.current) return;
    let active = true;
    const host = docx.current;
    host.replaceChildren();
    import('docx-preview').then(module => { if (active) return module.renderAsync(loaded.blob, host, undefined, { inWrapper: false }); })
      .catch(issue => { if (active) setError(issue); });
    return () => { active = false; host.replaceChildren(); };
  }, [loaded, fileType]);
  return <section>
    <WorkflowError error={files.error || error} retry={files.refresh} />
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {(canUpload || uncertain) && <form className={styles.form} onSubmit={event => { event.preventDefault(); void saveFile(); }}>
      <label className={styles.field}>Tệp bổ sung<input ref={uploadInput} type="file" required disabled={busy || uncertain} onChange={event => setUpload(event.target.files?.[0])} /></label>
      {uncertain && <p className={styles.notice}>Chưa xác nhận được kết quả. Gửi lại sẽ kiểm tra chính tệp đã gửi.</p>}
      <button type="submit" className={styles.secondary} disabled={busy || !upload}>{busy ? 'Đang xử lý…' : uncertain ? 'Kiểm tra tệp đã gửi' : 'Lưu tệp bổ sung'}</button>
    </form>}
    {files.loading && <WorkflowLoading />}
    {files.data?.length === 0 && <p className={styles.notice}>Văn bản chưa có tệp đính kèm.</p>}
    {!!files.data?.length && <>
      <label className={styles.field}>Tệp đang xem<select value={current?.id} onChange={event => setSelected(event.target.value)}>
        {files.data.map(file => <option key={file.id} value={file.id}>{file.originalFileName}</option>)}
      </select></label>
      <div className={styles.preview} style={{ marginTop: 12 }}>
        {!loaded && !error && <WorkflowLoading />}
        {loaded && fileType === 'pdf' && <iframe src={loaded.url} title={current?.originalFileName || 'Nội dung văn bản'} />}
        {loaded && ['png', 'jpg', 'jpeg', 'webp'].includes(fileType || '') && <img src={loaded.url} alt={current?.originalFileName || 'Văn bản'} />}
        <div ref={docx} hidden={fileType !== 'docx'} />
        {loaded && !['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'].includes(fileType || '') && <p className={styles.notice}>Định dạng này có thể tải về để mở bằng ứng dụng phù hợp.</p>}
      </div>
      <button type="button" className={styles.secondary} onClick={() => current && downloadProtectedFile(current.id, current.originalFileName).catch(setError)}>Tải tệp đang xem</button>
      {canUpload && kind === 'Inbox' && <button type="button" className={styles.secondary} disabled={busy || uncertain || !!upload} onClick={analyze}>Gợi ý từ nội dung tệp bằng AI</button>}
    </>}
  </section>;
}
