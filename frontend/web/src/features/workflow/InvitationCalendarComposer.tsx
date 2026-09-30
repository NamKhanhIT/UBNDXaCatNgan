'use client';
import { useRef, useState, type FormEvent } from 'react';
import { createCalendarEventApi, type CreateCalendarEventData } from '../../services/calendar-event.service';
import { formatDateShort, formatTimeShort, vietnamDateTimeToUtc } from '../../lib/formatters';
import { WorkflowDialog } from './WorkflowDialog';
import { WorkflowError } from './WorkflowFeedback';
import { useRequestKey, useWorkflowQuery } from './useWorkflow';
import { dataOf, WorkflowApiError, type DocumentDetail, type Person } from './workflow.service';
import styles from './workflow.module.css';

export function InvitationCalendarComposer({ source, onClose, onCreated }: {
  source: DocumentDetail; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState(source.document.title);
  const [dates, setDates] = useState({
    startDate: source.suggestedEventStart ? formatDateShort(source.suggestedEventStart) : '',
    startTime: source.suggestedEventStart ? formatTimeShort(source.suggestedEventStart) : '',
    endDate: source.suggestedEventEnd ? formatDateShort(source.suggestedEventEnd) : '',
    endTime: source.suggestedEventEnd ? formatTimeShort(source.suggestedEventEnd) : '',
  });
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<Error>();
  const frozen = useRef<CreateCalendarEventData>();
  const people = useWorkflowQuery<Person[]>('/api/v1/WorkflowPermissions/people?purpose=calendar');
  const keyFor = useRequestKey();
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(undefined);
    try {
      let payload = uncertain ? frozen.current : undefined;
      if (!payload) {
        const startDateTime = vietnamDateTimeToUtc(dates.startDate, dates.startTime);
        const endDateTime = vietnamDateTimeToUtc(dates.endDate, dates.endTime);
        if (!startDateTime || !endDateTime || endDateTime <= startDateTime) throw new Error('Vui lòng xác nhận giờ kết thúc sau giờ bắt đầu.');
        if (!confirmed || !location.trim() || !participants.length) throw new Error('Vui lòng xác nhận địa điểm, thời gian và ít nhất một người tham dự.');
        const values = { title, description: source.summary || '', eventType: 'Meeting' as const, startDateTime, endDateTime,
          location, participantUserIds: participants, reminderOffsetsMinutes: remind ? [30] : [],
          sourceInboxDocumentId: source.document.id, sourceDocumentVersion: source.document.version };
        payload = { ...values, requestId: keyFor(values) }; frozen.current = payload;
      }
      if (!payload) return;
      onCreated(dataOf(await createCalendarEventApi(payload)));
    } catch (issue) { setError(issue as Error); setUncertain(issue instanceof WorkflowApiError && issue.status === 0); }
    finally { setBusy(false); }
  };
  return <WorkflowDialog title="Xác nhận lịch từ giấy mời" onClose={onClose} dirty busy={busy}>
    <form className={styles.form} onSubmit={save}>
      <p className={styles.notice}>Kiểm tra theo giấy mời trước khi lưu. Thông tin gợi ý có thể sửa; giờ hiển thị theo Việt Nam.</p>
      <WorkflowError error={error || people.error} />
      <fieldset disabled={busy || uncertain}>
        <label className={styles.field}>Tên lịch<input required value={title} onChange={e => { setTitle(e.target.value); setConfirmed(false); }} /></label>
        <div className={styles.columns}>
          {([{ key: 'startDate', label: 'Ngày bắt đầu', type: 'text' }, { key: 'startTime', label: 'Giờ bắt đầu', type: 'time' },
            { key: 'endDate', label: 'Ngày kết thúc', type: 'text' }, { key: 'endTime', label: 'Giờ kết thúc', type: 'time' }] as const).map(field =>
            <label key={field.key} className={styles.field}>{field.label}<input required type={field.type} placeholder={field.type === 'text' ? 'DD-MM-YYYY' : undefined}
              value={dates[field.key]} onChange={e => { setDates(value => ({ ...value, [field.key]: e.target.value })); setConfirmed(false); }} /></label>)}
        </div>
        <label className={styles.field}>Địa điểm<input required value={location} onChange={e => { setLocation(e.target.value); setConfirmed(false); }} /></label>
        <fieldset><legend>Người tham dự ({participants.length})</legend>
          {people.data?.map(person => <label key={person.id} className={styles.row}><input type="checkbox" checked={participants.includes(person.id)} onChange={e => {
            setParticipants(ids => e.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id)); setConfirmed(false);
          }} />{person.fullName}</label>)}
        </fieldset>
        <label className={styles.row}><input type="checkbox" checked={remind} onChange={e => setRemind(e.target.checked)} />Nhắc trước 30 phút</label>
        <label className={styles.row}><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Tôi đã kiểm tra thời gian, địa điểm và danh sách theo giấy mời.</label>
      </fieldset>
      {uncertain && <p className={styles.notice}>Chưa nhận được phản hồi. Gửi lại cùng yêu cầu để kiểm tra kết quả, không tạo thêm lịch.</p>}
      <button className={styles.button} disabled={busy || people.loading || !source.canCreateCalendar}>{busy ? 'Đang lưu…' : uncertain ? 'Gửi lại yêu cầu' : 'Xác nhận tạo lịch'}</button>
    </form>
  </WorkflowDialog>;
}
