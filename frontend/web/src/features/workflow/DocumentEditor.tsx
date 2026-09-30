'use client';

import { useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '../../services/api.config';
import { uploadFileApi } from '../../services/files.service';
import type { OutgoingDocumentDto } from '../../services/outgoing-document.service';
import { WorkflowDialog } from './WorkflowDialog';
import { WorkflowError } from './WorkflowFeedback';
import { dataOf, workflowChanged, workflowMutation, WorkflowApiError, type DocumentKind } from './workflow.service';
import { useRequestKey } from './useWorkflow';
import styles from './workflow.module.css';

export function DocumentEditor({ kind, existing, onClose, onSaved }: {
  kind: DocumentKind; existing?: OutgoingDocumentDto; onClose: () => void; onSaved: (kind: DocumentKind, id: string) => void;
}) {
  const [title, setTitle] = useState(existing?.title || '');
  const [sender, setSender] = useState(existing?.recipientNote || '');
  const [number, setNumber] = useState('');
  const [documentType, setDocumentType] = useState(existing?.documentType || 'CongVan');
  const [content, setContent] = useState(existing?.content || '');
  const [urgent, setUrgent] = useState(existing?.isUrgent || false);
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<Error>();
  const [createdId, setCreatedId] = useState<string>();
  const [metadataSaved, setMetadataSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const frozenMetadata = useRef<{ path: string; values: object; method: string }>();
  const uploaded = useRef(false);
  const requestKey = useRequestKey();
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(undefined);
    try {
      let id = existing?.id || createdId;
      if (!metadataSaved) {
        let operation = uncertain ? frozenMetadata.current : undefined;
        if (!operation) {
          const values = existing ? { ...existing, title, content, documentType, recipientNote: sender, isUrgent: urgent, autoCreateTask: false }
            : kind === 'Inbox' ? { subject: title, sender, documentNumber: number, isUrgent: urgent, channel: 'Internal' }
            : { title, content, documentType, recipientNote: sender, isUrgent: urgent, autoCreateTask: false };
          operation = { path: existing ? `/api/v1/OutgoingDocuments/${existing.id}` : kind === 'Inbox' ? '/api/v1/Inbox' : '/api/v1/OutgoingDocuments',
            method: existing ? 'PUT' : 'POST', values: { ...values, requestId: requestKey(values) } };
          frozenMetadata.current = operation;
        }
        if (existing) await workflowMutation(operation.path, operation.values, operation.method);
        else id = dataOf(await apiFetch<string>(operation.path, { method: operation.method, body: JSON.stringify(operation.values) }));
        setCreatedId(id); setMetadataSaved(true); setUncertain(false);
      }
      if (!id) throw new Error('Chưa nhận được mã văn bản đã lưu.');
      if (file && !uploaded.current) { dataOf(await uploadFileApi(file, id, kind, 'MainDocument')); uploaded.current = true; }
      workflowChanged(); setDirty(false); onSaved(kind, id);
    } catch (issue) { setError(issue as Error); setUncertain(issue instanceof WorkflowApiError && issue.status === 0); } finally { setBusy(false); }
  };
  return <WorkflowDialog title={existing ? 'Chỉnh sửa văn bản nháp' : kind === 'Inbox' ? 'Tải văn bản vào kho' : 'Soạn văn bản đi'} onClose={onClose} dirty={dirty || !!createdId} busy={busy}>
    <form className={styles.form} onSubmit={submit} onChange={() => setDirty(true)}>
      <WorkflowError error={error} />
      {createdId && error && <p className={styles.notice}>Thông tin văn bản đã được lưu. Gửi lại sẽ tiếp tục tải tệp cho chính văn bản này.</p>}
      {uncertain && <p className={styles.notice}>Chưa nhận được kết quả từ máy chủ. Gửi lại cùng yêu cầu để kiểm tra, tránh tạo văn bản trùng.</p>}
      <fieldset disabled={busy || metadataSaved || uncertain}>
        <label className={styles.field}>Trích yếu<input required maxLength={500} value={title} onChange={e => setTitle(e.target.value)} /></label>
        {kind === 'Inbox' ? <>
          <label className={styles.field}>Số / ký hiệu<input value={number} onChange={e => setNumber(e.target.value)} placeholder="Để trống nếu văn bản chưa có số" /></label>
          <label className={styles.field}>Nguồn gửi<input required value={sender} onChange={e => setSender(e.target.value)} /></label>
        </> : <>
          <label className={styles.field}>Loại văn bản<select value={documentType} onChange={e => setDocumentType(e.target.value as typeof documentType)}>
            {Object.entries({ CongVan: 'Công văn', QuyetDinh: 'Quyết định', BaoCao: 'Báo cáo', ThongBao: 'Thông báo', KeHoach: 'Kế hoạch', ToTrinh: 'Tờ trình', CongDien: 'Công điện' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className={styles.field}>Nơi nhận<input value={sender} onChange={e => setSender(e.target.value)} /></label>
          <label className={styles.field}>Nội dung<textarea required rows={9} value={content} onChange={e => setContent(e.target.value)} /></label>
        </>}
        <label className={styles.row}><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} /> Văn bản khẩn</label>
      </fieldset>
      <label className={styles.field}>Tệp văn bản{kind === 'Outgoing' ? ' (không bắt buộc)' : ''}<input type="file" disabled={busy || uploaded.current || uncertain} required={kind === 'Inbox'} accept=".pdf,.docx,.doc,.xlsx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0])} /></label>
      <p className={styles.muted}>Tệp và thông tin được lưu vào kho. Bạn có thể trình xử lý hoặc giao việc sau khi kiểm tra văn bản.</p>
      <div className={styles.actions}><button type="submit" className={styles.button} disabled={busy}>{busy ? 'Đang lưu…' : createdId ? 'Tiếp tục tải tệp' : 'Lưu văn bản'}</button></div>
    </form>
  </WorkflowDialog>;
}
