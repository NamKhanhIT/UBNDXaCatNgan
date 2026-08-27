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
import { getUserProfileApi, updateUserProfileApi, sendTestSmsApi } from '../../../services/user.service';

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
  const [channelSms, setChannelSms] = useState<boolean>(true);
  const [channelZalo, setChannelZalo] = useState<boolean>(false);

  const [userPhone, setUserPhone] = useState<string>('');
  const [isPhoneConfirmed, setIsPhoneConfirmed] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTestPushing, setIsTestPushing] = useState<boolean>(false);
  const [isTestSmsing, setIsTestSmsing] = useState<boolean>(false);
  const [smsGatewayStatus, setSmsGatewayStatus] = useState<string>('Trình phát SMS Miễn Phí (Đang hoạt động)');

  useEffect(() => {
    async function loadSettings() {
      try {
        if (isPushNotificationSupported()) {
          const sub = await getExistingPushSubscription();
          setIsPushSubscribed(!!sub);
        }
        const subs = await getMyPushSubscriptionsApi();
        if (Array.isArray(subs)) setPushSubscriptions(subs);

        // Nạp cấu hình từ DB
        const profileRes = await getUserProfileApi();
        let loadedPrefs: any = null;
        if (profileRes.success && profileRes.data) {
          if (profileRes.data.zaloPhoneNumber) setUserPhone(profileRes.data.zaloPhoneNumber);
          setIsPhoneConfirmed(Boolean(profileRes.data.phoneNumberConfirmed));

          if (profileRes.data.notificationPreferences) {
            try {
              loadedPrefs = JSON.parse(profileRes.data.notificationPreferences);
            } catch {}
          }
        }

        // Fallback localStorage nếu DB chưa có
        if (!loadedPrefs) {
          const localCached = localStorage.getItem('ubnd_notification_preferences');
          if (localCached) {
            try {
              loadedPrefs = JSON.parse(localCached);
            } catch {}
          }
        }

        if (loadedPrefs) {
          if (typeof loadedPrefs.notifyNewTask === 'boolean') setNotifyNewTask(loadedPrefs.notifyNewTask);
          if (typeof loadedPrefs.notifyDeadline === 'boolean') setNotifyDeadline(loadedPrefs.notifyDeadline);
          if (typeof loadedPrefs.notifyIncomingDoc === 'boolean') setNotifyIncomingDoc(loadedPrefs.notifyIncomingDoc);
          if (typeof loadedPrefs.notifyApproval === 'boolean') setNotifyApproval(loadedPrefs.notifyApproval);
          if (typeof loadedPrefs.notifyDailyDigest === 'boolean') setNotifyDailyDigest(loadedPrefs.notifyDailyDigest);
          if (typeof loadedPrefs.channelWebPush === 'boolean') setChannelWebPush(loadedPrefs.channelWebPush);
          if (typeof loadedPrefs.channelEmail === 'boolean') setChannelEmail(loadedPrefs.channelEmail);
          if (typeof loadedPrefs.channelSms === 'boolean') setChannelSms(loadedPrefs.channelSms);
          if (typeof loadedPrefs.channelZalo === 'boolean') setChannelZalo(loadedPrefs.channelZalo);
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra cài đặt thông báo:', err);
      }
    }
    loadSettings();
  }, []);

  const handleTogglePush = async () => {
    try {
      setIsPushLoading(true);
      if (isPushSubscribed) {
        await unsubscribeCurrentDevice();
        setIsPushSubscribed(false);
        addToast('Đã tắt', 'Đã hủy nhận thông báo đẩy trên thiết bị này.', 'info');
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
      setIsTestPushing(true);
      if (!isPushSubscribed) {
        addToast('Chưa đăng ký', 'Vui lòng nhấn "Bật Thông Báo Đẩy Thiết Bị" trước khi gửi tin thử nghiệm.', 'warning');
        return;
      }
      const res = await sendTestPushApi();
      if (res.success) {
        addToast('Thành công', res.message || 'Đã gửi thông báo đẩy thử nghiệm! Hãy kiểm tra màn hình thiết bị.', 'success');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Lỗi gửi thông báo WebPush', 'danger');
    } finally {
      setIsTestPushing(false);
    }
  };

  const handleSendTestSms = async () => {
    try {
      setIsTestSmsing(true);
      const res = await sendTestSmsApi();
      if (res.success) {
        if (res.data?.gatewayStatus) setSmsGatewayStatus(res.data.gatewayStatus);
        addToast('Thành công', res.message || 'Đã phát tin nhắn SMS thử nghiệm thành công tới điện thoại của đồng chí!', 'success');
      } else {
        addToast('Cảnh báo SMS', res.error || 'Chưa cập nhật số điện thoại trong hồ sơ cá nhân.', 'warning');
      }
    } catch (err: any) {
      addToast('Lỗi SMS', err.message || 'Lỗi gửi tin nhắn SMS thử nghiệm.', 'danger');
    } finally {
      setIsTestSmsing(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const prefs = {
        notifyNewTask,
        notifyDeadline,
        notifyIncomingDoc,
        notifyApproval,
        notifyDailyDigest,
        channelWebPush,
        channelEmail,
        channelSms,
        channelZalo,
      };

      // Lưu vào localStorage
      localStorage.setItem('ubnd_notification_preferences', JSON.stringify(prefs));

      // Lưu vào PostgreSQL qua API
      const res = await updateUserProfileApi({
        notificationPreferences: JSON.stringify(prefs),
      });

      if (res.success) {
        addToast('Thành công', 'Đã lưu cấu hình thông báo vào cơ sở dữ liệu PostgreSQL thành công!', 'success');
      } else {
        addToast('Lỗi Lưu CSDL', res.error || 'Không thể lưu cấu hình thông báo vào cơ sở dữ liệu.', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể lưu cài đặt thông báo vào CSDL.', 'danger');
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

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className={`btn ${isPushSubscribed ? 'btn-outline btn-danger' : 'btn-primary'}`}
              onClick={handleTogglePush}
              disabled={isPushLoading || isTestPushing}
              style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <i className={`fa-solid ${isPushSubscribed ? 'fa-bell-slash' : 'fa-bell'}`} aria-hidden="true" />
              <span>{isPushLoading ? 'Đang xử lý...' : isPushSubscribed ? 'Tắt Thông Báo Trên Thiết Bị Này' : 'Bật Thông Báo Đẩy Thiết Bị'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleSendTestPush}
              disabled={isPushLoading || isTestPushing}
              style={{
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderColor: '#3b82f6',
                color: '#1d4ed8',
                background: '#eff6ff'
              }}
            >
              <i className={`fa-solid ${isTestPushing ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
              <span>{isTestPushing ? 'Đang gửi...' : 'Gửi WebPush Thử Nghiệm'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. KÊNH NHẬN THÔNG BÁO ĐA KÊNH (WEBPUSH + SMS + EMAIL) ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-satellite-dish" style={{ color: '#059669' }} aria-hidden="true" />
            <span>Kênh Nhận Thông Báo Đa Kênh (WebPush, SMS & Email)</span>
          </h2>
          <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
            Miễn Phí 100%
          </span>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {/* Kênh 1: WebPush */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 8, border: channelWebPush ? '1.5px solid #2563eb' : '1px solid #e2e8f0', background: channelWebPush ? '#eff6ff' : '#ffffff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={channelWebPush}
                onChange={e => setChannelWebPush(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2563eb', marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-tower-broadcast" style={{ color: '#2563eb' }} />
                  WebPush Trình Duyệt
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                  Thông báo đẩy tức thì trên máy tính và điện thoại PWA.
                </div>
              </div>
            </label>

            {/* Kênh 2: Tin Nhắn SMS Điện Thoại (iOS & Android) */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 8, border: channelSms ? '1.5px solid #059669' : '1px solid #e2e8f0', background: channelSms ? '#f0fdf4' : '#ffffff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={channelSms}
                onChange={e => setChannelSms(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#059669', marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-mobile-screen-button" style={{ color: '#059669' }} />
                  Tin Nhắn SMS Điện Thoại
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                  Gửi SMS nhắc việc khẩn trực tiếp đến số điện thoại {userPhone ? `(${userPhone})` : ''} (iOS & Android).
                </div>
              </div>
            </label>

            {/* Kênh 3: Email */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 8, border: channelEmail ? '1.5px solid #d97706' : '1px solid #e2e8f0', background: channelEmail ? '#fffbeb' : '#ffffff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={channelEmail}
                onChange={e => setChannelEmail(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#d97706', marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa-solid fa-envelope" style={{ color: '#d97706' }} />
                  Email Công Vụ
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                  Nhận báo cáo định kỳ và tóm tắt tiến độ qua hòm thư công vụ.
                </div>
              </div>
            </label>
          </div>

          {/* Công cụ kiểm tra SMS Gateway */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-server" style={{ color: '#059669' }} />
                Trạng thái SMS Gateway: <span style={{ color: '#16a34a' }}>{smsGatewayStatus}</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Số điện thoại người nhận: <strong>{userPhone || 'Chưa thiết lập'}</strong> {isPhoneConfirmed ? '✓ (Đã xác thực)' : '⚠️ (Chưa xác thực)'}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleSendTestSms}
              disabled={isTestSmsing || !userPhone}
              style={{
                fontWeight: 700,
                borderColor: '#059669',
                color: '#059669',
                background: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className={`fa-solid ${isTestSmsing ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
              <span>{isTestSmsing ? 'Đang phát tin SMS...' : 'Gửi Thử Tin Nhắn SMS'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. CẤU HÌNH CÁC LOẠI SỰ KIỆN THÔNG BÁO ── */}
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
