'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './workflow.module.css';

export function WorkflowDialog({ title, children, onClose, dirty = false, busy = false, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; dirty?: boolean; busy?: boolean; wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const draftFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const close = () => { if (!busy) { if (dirty) {
    if (!confirmDiscard) draftFocus.current = document.activeElement as HTMLElement | null;
    setConfirmDiscard(true);
  } else onClose(); } };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    if (confirmDiscard) continueButton.current?.focus();
    else if (draftFocus.current?.isConnected && dialog.current?.contains(draftFocus.current)) {
      draftFocus.current.focus();
      draftFocus.current = null;
    }
  }, [confirmDiscard]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  return <dialog ref={dialog} className={`${styles.dialog} ${wide ? styles.wide : ''}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <header className={styles.dialogHeader}>
      <h2 id={titleId}>{title}</h2>
      <button type="button" className={styles.secondary} onClick={close} disabled={busy} aria-label="Đóng cửa sổ">Đóng</button>
    </header>
    <div className={styles.dialogBody}>
      {confirmDiscard && <section role="alert" className={styles.form}>
        <h3>Nội dung chưa được lưu</h3><p className={styles.muted}>Bạn có muốn tiếp tục chỉnh sửa để giữ nội dung đang nhập?</p>
        <div className={styles.row}>
          <button ref={continueButton} type="button" className={styles.button} onClick={() => setConfirmDiscard(false)}>Tiếp tục chỉnh sửa</button>
          <button type="button" className={styles.danger} onClick={onClose}>Bỏ thay đổi và đóng</button>
        </div>
      </section>}
      <div hidden={confirmDiscard}>{children}</div>
    </div>
  </dialog>;
}
