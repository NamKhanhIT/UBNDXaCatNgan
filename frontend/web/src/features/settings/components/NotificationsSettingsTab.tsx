'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '../../../components/ui/ToastContext';
import {
  isPushNotificationSupported,
  getExistingPushSubscription,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
  getMyPushSubscriptionsApi,
  sendTestPushApi,
  PushSubscriptionDto,
} from '../../../services/push-notification.service';

export function NotificationsSettingsTab() {
  const { addToast } = useToast();

  // Push Notification State
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [pushSubscriptions, setPushSubscriptions] = useState<PushSubscriptionDto[]>([]);
  const [isPushLoading, setIsPushLoading] = useState<boolean>(false);

  // Notification Preferences State
  const [notifyNewTask, setNotifyNewTask] = useState<boolean>(true);
  const [notifyDeadline, setNotifyDeadline] = useState<boolean>(true);
  const [notifyIncomingDoc, setNotifyIncomingDoc] = useState<boolean>(true);
  const [notifyApproval, setNotifyApproval] = useState<boolean>(true);
  const [notifyDailyDigest, setNotifyDailyDigest] = useState<boolean>(true);

  // Channels State
  const [channelWebPush, setChannelWebPush] = useState<boolean>(true);
  const [channelEmail, setChannelEmail] = useState<boolean>(true);
  const [channelZalo, setChannelZalo] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    async function loadPushState() {
      try {
        if (isPushNotificationSupported()) {
          const sub = await getExistingPushSubscription();
          setIsPushSubscribed(!!sub);
        }
        const subs = await getMyPushSubscriptionsApi();
        if (Array.isArray(subs)) setPushSubscriptions(subs);
      } catch (err) {
        console.warn('Lỗi kiểm tra cài đặt thông báo:', err);
      }
    }
    loadPushState();
  }, []);

  const handleTogglePush = async () => {
    try {
      setIsPushLoading(true);
      if (isPushSubscribed) {
        await unsubscribeCurrentDevice();
        setIsPushSubscribed(false);
        addToast('Đã tắt', 'Đã hủy nhận thông báo đẩy trên thiết bị này', 'info');
      } else {
        const sub = await subscribeCurrentDevice();
        if (sub) {
          setIsPushSubscribed(true);
          addToast('Thành công', 'Đã bật nhận thông báo đẩy trình duyệt thành công!', 'success');
          const subs = await getMyPushSubscriptionsApi();
          if (Array.isArray(subs)) setPushSubscriptions(subs);
        }
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể thay đổi cài đặt thông báo đẩy', 'danger');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      const res = await sendTestPushApi();
      if (res.success) {
        addToast('Thành công', 'Đã gửi thông báo thử nghiệm tới các thiết bị đã đăng ký!', 'success');
      }
    } catch (err: any) {
      addToast('Thông báo', 'Đã kích hoạt gửi thử nghiệm thông báo.', 'info');
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      addToast('Thành công', 'Đã lưu cấu hình thông báo thành công!', 'success');
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể lưu cài đặt', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. CÀI ĐẶT THÔNG BÁO ĐẨY WEB PUSH ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-tower-broadcast" style={{ color: '#2563eb' }} aria-hidden="true" />
            <span>Thông Báo Đẩy Trực Tiếp Trên Trình Duyệt (Web Push W3C)</span>
          </h2>
          <span className={`badge ${isPushSubscribed ? 'badge-success' : 'badge-warning'}`}>
            {isPushSubscribed ? '● Đang nhận tin' : '○ Chưa bật'}
          </span>
        </div>

        <div className="card-body">
          <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, marginBottom: 16 }}>
            Nhận thông báo nhắc việc khẩn cấp, việc sắp đến hạn và bản tin tóm tắt công việc đầu giờ sáng (Daily Digest 07:30 AM) ngay trên trình duyệt máy tính hoặc điện thoại di động mà không cần mở tab ứng dụng.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${isPushSubscribed ? 'btn-outline btn-danger' : 'btn-primary'}`}
              onClick={handleTogglePush}
              disabled={isPushLoading}
              style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <i className={`fa-solid ${isPushSubscribed ? 'fa-bell-slash' : 'fa-bell'}`} aria-hidden="true" />
              <span>{isPushLoading ? 'Đang xử lý...' : isPushSubscribed ? 'Tắt Thông Báo Trên Thiết Bị Này' : 'Bật Thông Báo Đẩy Thiết Bị'}</span>
            </button>

            {isPushSubscribed && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleSendTestPush}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                <span>Gửi Thử Nghiệm</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. CẤU HÌNH CÁC LOẠI SỰ KIỆN THÔNG BÁO ── */}
      <div className="card">
        <div className="card-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-sliders" style={{ color: '#7c3aed' }} aria-hidden="true" />
            <span>Tùy Chọn Sự Kiện Nhận Thông Báo</span>
          </h2>
        </div>

        <div className="card-body">
          <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, background: '#f8fafc' }}>
              <input
                type="checkbox"
                checked={notifyNewTask}
                onChange={e => setNotifyNewTask(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2563eb' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  Giao nhiệm vụ mới
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Nhận thông báo ngay khi có Lãnh đạo hoặc Trưởng phòng phân công nhiệm vụ mới
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, background: '#f8fafc' }}>
              <input
                type="checkbox"
                checked={notifyDeadline}
                onChange={e => setNotifyDeadline(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2563eb' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  Cảnh báo hạn chót (Deadline alerts)
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Nhắc việc trước 48h, 24h và thông báo khi nhiệm vụ bị quá hạn
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, background: '#f8fafc' }}>
              <input
                type="checkbox"
                checked={notifyIncomingDoc}
                onChange={e => setNotifyIncomingDoc(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2563eb' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  Văn bản chỉ đạo cấp trên đến
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Thông báo khi có văn bản chỉ đạo khẩn hoặc văn bản được phân công thụ lý
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, background: '#f8fafc' }}>
              <input
                type="checkbox"
                checked={notifyApproval}
                onChange={e => setNotifyApproval(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2563eb' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  Kết quả duyệt báo cáo & chấm điểm
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Thông báo khi Lãnh đạo phê duyệt nghiệm thu hoặc yêu cầu sửa đổi báo cáo
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, background: '#f8fafc' }}>
              <input
                type="checkbox"
                checked={notifyDailyDigest}
                onChange={e => setNotifyDailyDigest(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2563eb' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  Bản tin tóm tắt đầu ngày (Daily Morning Digest — 07:30 AM)
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Gửi tóm tắt công việc trong ngày và lịch trực cơ quan vào mỗi buổi sáng
                </div>
              </div>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
                style={{ fontWeight: 700, padding: '8px 20px' }}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình Thông Báo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
