'use client';
import { useState } from 'react';
import { apiFetch } from '../../../services/api.config';
import { DocumentEditor } from '../../workflow/DocumentEditor';
import { WorkflowDialog } from '../../workflow/WorkflowDialog';
import { dataOf, type DocumentDetail, type DocumentKind } from '../../workflow/workflow.service';
export function DocumentUploadModal({ onUploadSuccess, onClose }: {
  onUploadSuccess: (document: any) => void; onClose: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind>();
  if (!kind) return <WorkflowDialog title="Thêm văn bản vào kho" onClose={onClose}>
    <div style={{ display: 'flex', gap: 12 }}>
      <button className="btn btn-primary" onClick={() => setKind('Inbox')}>Tải văn bản đầu vào</button>
      <button className="btn btn-outline" onClick={() => setKind('Outgoing')}>Soạn văn bản đi</button>
    </div>
  </WorkflowDialog>;
  return <DocumentEditor kind={kind} onClose={onClose} onSaved={async (savedKind, id) => {
    const response = await apiFetch<DocumentDetail>(`/api/v1/Documents/${savedKind}/${id}`);
    if (response.success) onUploadSuccess(dataOf(response));
  }} />;
}
