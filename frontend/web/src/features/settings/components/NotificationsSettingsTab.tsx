'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '../../../components/ui/ToastContext';
import {
  isPushNotificationSupported,
  getExistingPushSubscription,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
  getMyPushSubscriptionsApi,
  unsubscribePushApi,
  sendTestPushApi,
  PushSubscriptionDto,
} from '../../../services/push-notification.service';
import { getUserProfileApi, updateUserProfileApi, sendTestSmsApi } from '../../../services/user.service';
import { formatDateTimeShort } from '../../../lib/formatters';

export function NotificationsSettingsTab() {
  const { addToast } = useToast();

  // Trạng thái thông báo đẩy WebPush
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [pushSubscriptions, setPushSubscriptions] = useState<PushSubscriptionDto[]>([]);
  const [isPushLoading, setIsPushLoading] = useState<boolean>(false);

  // Cấu hình sự kiện nhận thông báo
  const [notifyNewTask, setNotifyNewTask] = useState<boolean>(true);
  const [notifyDeadline, setNotifyDeadline] = useState<boolean>(true);
  const [notifyIncomingDoc, setNotifyIncomingDoc] = useState<boolean>(true);
  const [notifyApproval, setNotifyApproval] = useState<boolean>(true);
  const [notifyDailyDigest, setNotifyDailyDigest] = useState<boolean>(true);

  // Cấu hình kênh nhận thông báo đa kênh
  const [channelWebPush, setChannelWebPush] = useState<boolean>(true);
  const [channelEmail, setChannelEmail] = useState<boolean>(true);
  const [channelSms, setChannelSms] = useState<boolean>(true);
  const [channelZalo, setChannelZalo] = useState<boolean>(false);

  // Thông tin liên lạc cán bộ
  const [userPhone, setUserPhone] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isPhoneConfirmed, setIsPhoneConfirmed] = useState<boolean>(false);

  // Trạng thái thao tác & kiểm thử
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTestPushing, setIsTestPushing] = useState<boolean>(false);
  const [isTestSmsing, setIsTestSmsing] = useState<boolean>(false);
  const [smsGatewayStatus, setSmsGatewayStatus] = useState<string>('Trình phát SMS Miễn Phí (Đang hoạt động)');

  // Nạp dữ liệu cấu hình ban đầu
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
          if (profileRes.data.email) setUserEmail(profileRes.data.email);
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

  // Bật/tắt nhận tin WebPush trên thiết bị hiện tại
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

  // Hủy liên kết một thiết bị nhận WebPush
  const handleRemoveDevice = async (endpoint: string, id: string) => {
    try {
      const ok = await unsubscribePushApi(endpoint, id);
      if (ok) {
        setPushSubscriptions(prev => prev.filter(s => s.id !== id && s.endpoint !== endpoint));
        const currentSub = await getExistingPushSubscription();
        if (currentSub?.endpoint === endpoint) {
          setIsPushSubscribed(false);
        }
        addToast('Thành công', 'Đã hủy liên kết thiết bị nhận thông báo.', 'success');
      } else {
        addToast('Lỗi', 'Không thể hủy liên kết thiết bị.', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể hủy liên kết thiết bị.', 'danger');
    }
  };

  // Gửi thông báo WebPush thử nghiệm
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

  // Gửi tin nhắn SMS thử nghiệm
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

  // Lưu toàn bộ cấu hình thông báo (Kênh + Sự kiện)
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
        addToast('Thành công', 'Đã lưu cấu hình kênh và sự kiện thông báo vào cơ sở dữ liệu thành công!', 'success');
      } else {
        addToast('Lỗi Lưu CSDL', res.error || 'Không thể lưu cấu hình thông báo vào cơ sở dữ liệu.', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể lưu cài đặt thông báo vào CSDL.', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // Hàm che số điện thoại hiển thị an toàn
  const maskedPhone = userPhone && userPhone.length >= 7
    ? userPhone.slice(0, 3) + '****' + userPhone.slice(-3)
    : userPhone || 'Chưa thiết lập';

  // Hàm che email hiển thị an toàn
  const maskedEmail = userEmail && userEmail.includes('@')
    ? userEmail.slice(0, 2) + '****@' + userEmail.split('@')[1]
    : userEmail || 'Chưa thiết lập';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. TỔNG QUAN TRẠNG THÁI KẾT NỐI ĐA KÊNH */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {/* Kênh WebPush */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <i className="fa-solid fa-tower-broadcast" style={{ fontSize: '1.1rem' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b' }}>WebPush Trình Duyệt</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {pushSubscriptions.length} thiết bị đã liên kết
              </div>
            </div>
          </div>
          <span className={`badge ${isPushSubscribed ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.72rem' }}>
            {isPushSubscribed ? '● Đang nhận tin' : '○ Chưa kích hoạt'}
          </span>
        </div>

        {/* Kênh SMS Viễn Thông */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <i className="fa-solid fa-mobile-screen-button" style={{ fontSize: '1.1rem' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b' }}>SMS Điện Thoại</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {maskedPhone}
              </div>
            </div>
          </div>
          <span className={`badge ${isPhoneConfirmed ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.72rem' }}>
            {isPhoneConfirmed ? '✓ Đã xác thực' : '⚠️ Chưa xác thực'}
          </span>
        </div>

        {/* Kênh Email Công Vụ */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <i className="fa-solid fa-envelope" style={{ fontSize: '1.1rem' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b' }}>Email Công Vụ</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {maskedEmail}
              </div>
            </div>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
            ✓ Sẵn sàng
          </span>
        </div>
      </div>

      {/* 2. BIỂU MẪU CẤU HÌNH THÔNG BÁO TOÀN DIỆN (KÊNH + SỰ KIỆN + NÚT LƯU) */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-sliders" style={{ color: '#2563eb' }} aria-hidden="true" />
            <span>Cấu Hình Tùy Chọn & Kênh Nhận Thông Báo</span>
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            Tự động đồng bộ CSDL công vụ
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Phân nhóm A: Kênh nhận tin */}
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-satellite-dish" style={{ color: '#059669' }} />
                <span>1. Kênh Nhận Tin Đa Kênh (Bật/Tắt các kênh đồng chí muốn nhận)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                {/* Kênh 1: WebPush */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 8, border: channelWebPush ? '1.5px solid #2563eb' : '1px solid #e2e8f0', background: channelWebPush ? '#eff6ff' : '#ffffff', cursor: 'pointer', transition: 'all 0.15s ease' }}>
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
                      Nhận tin đẩy tức thì trên PC, Laptop & Mobile PWA.
                    </div>
                  </div>
                </label>

                {/* Kênh 2: SMS */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 8, border: channelSms ? '1.5px solid #059669' : '1px solid #e2e8f0', background: channelSms ? '#f0fdf4' : '#ffffff', cursor: 'pointer', transition: 'all 0.15s ease' }}>
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
                      Gửi tin SMS nhắc việc khẩn tới số {maskedPhone}.
                    </div>
                  </div>
                </label>

                {/* Kênh 3: Email */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 8, border: channelEmail ? '1.5px solid #d97706' : '1px solid #e2e8f0', background: channelEmail ? '#fffbeb' : '#ffffff', cursor: 'pointer', transition: 'all 0.15s ease' }}>
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
                      Nhận bản tin tóm tắt và báo cáo tiến độ qua {maskedEmail}.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Phân nhóm B: Sự kiện nhận thông báo */}
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-bell" style={{ color: '#7c3aed' }} />
                <span>2. Tùy Chọn Sự Kiện Nhận Thông Báo (Kích hoạt cho các loại sự kiện)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Sự kiện 1 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: notifyNewTask ? '1.5px solid #cbd5e1' : '1px solid #e2e8f0', background: notifyNewTask ? '#f8fafc' : '#ffffff', transition: 'all 0.15s ease' }}>
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
                      Nhận thông báo ngay khi có Lãnh đạo hoặc Trưởng phòng phân công nhiệm vụ mới cho đồng chí.
                    </div>
                  </div>
                </label>

                {/* Sự kiện 2 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: notifyDeadline ? '1.5px solid #cbd5e1' : '1px solid #e2e8f0', background: notifyDeadline ? '#f8fafc' : '#ffffff', transition: 'all 0.15s ease' }}>
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
                      Tự động nhắc việc trước 48h, 24h và gửi cảnh báo khi nhiệm vụ có nguy cơ trễ hạn.
                    </div>
                  </div>
                </label>

                {/* Sự kiện 3 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: notifyIncomingDoc ? '1.5px solid #cbd5e1' : '1px solid #e2e8f0', background: notifyIncomingDoc ? '#f8fafc' : '#ffffff', transition: 'all 0.15s ease' }}>
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
                      Thông báo khi có văn bản chỉ đạo hỏa tốc hoặc văn bản được phân công thụ lý trực tiếp.
                    </div>
                  </div>
                </label>

                {/* Sự kiện 4 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: notifyApproval ? '1.5px solid #cbd5e1' : '1px solid #e2e8f0', background: notifyApproval ? '#f8fafc' : '#ffffff', transition: 'all 0.15s ease' }}>
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
                      Thông báo khi Lãnh đạo nghiệm thu hoàn thành hoặc yêu cầu hoàn thiện bổ sung báo cáo.
                    </div>
                  </div>
                </label>

                {/* Sự kiện 5 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: notifyDailyDigest ? '1.5px solid #cbd5e1' : '1px solid #e2e8f0', background: notifyDailyDigest ? '#f8fafc' : '#ffffff', transition: 'all 0.15s ease' }}>
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
                      Tổng hợp nhiệm vụ trọng tâm trong ngày và lịch phân công trực công vụ mỗi buổi sáng.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Nút lưu cấu hình nổi bật */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                💡 Cấu hình sẽ được lưu cố định cho tài khoản của đồng chí trên mọi thiết bị.
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
                style={{ fontWeight: 800, padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
              >
                <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} />
                <span>{isSaving ? 'Đang lưu CSDL...' : 'Lưu Toàn Bộ Cấu Hình Thông Báo'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 3. TRUNG TÂM KIỂM THỬ THÔNG BÁO ĐA KÊNH (TEST CENTER) */}
      <div className="card" style={{ border: '1px solid #cbd5e1' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-vial-circle-check" style={{ color: '#059669' }} aria-hidden="true" />
            <span>Trung Tâm Kiểm Thử Kênh Nhận Thông Báo (Test Center)</span>
          </h2>
          <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
            Kiểm thử thời gian thực
          </span>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
            Đồng chí có thể gửi thông báo thử nghiệm trực tiếp đến thiết bị hiện tại hoặc số điện thoại để kiểm tra tốc độ phát tin và khả năng hiển thị trước khi nhận thông báo công việc thực tế.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {/* Card Test 1: WebPush */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-tower-broadcast" style={{ color: '#2563eb' }} />
                  <span>Kiểm Thử WebPush Trình Duyệt</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 4 }}>
                  Trạng thái thiết bị này: <strong>{isPushSubscribed ? 'Đã bật nhận tin' : 'Chưa bật nhận tin'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${isPushSubscribed ? 'btn-outline btn-danger' : 'btn-primary'}`}
                  onClick={handleTogglePush}
                  disabled={isPushLoading || isTestPushing}
                  style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <i className={`fa-solid ${isPushSubscribed ? 'fa-bell-slash' : 'fa-bell'}`} />
                  <span>{isPushLoading ? 'Đang xử lý...' : isPushSubscribed ? 'Tắt Thiết Bị Này' : 'Bật Thiết Bị Này'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleSendTestPush}
                  disabled={isPushLoading || isTestPushing || !isPushSubscribed}
                  style={{
                    fontWeight: 700,
                    borderColor: '#2563eb',
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <i className={`fa-solid ${isTestPushing ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
                  <span>{isTestPushing ? 'Đang gửi...' : 'Gửi WebPush Thử Nghiệm'}</span>
                </button>
              </div>
            </div>

            {/* Card Test 2: SMS Gateway */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-mobile-screen-button" style={{ color: '#059669' }} />
                  <span>Kiểm Thử SMS Viễn Thông</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 4 }}>
                  Số đích: <strong>{maskedPhone}</strong> | Gateway: <span style={{ color: '#16a34a' }}>{smsGatewayStatus}</span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleSendTestSms}
                  disabled={isTestSmsing || !userPhone}
                  style={{
                    fontWeight: 700,
                    borderColor: '#059669',
                    color: '#059669',
                    background: '#f0fdf4',
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
        </div>
      </div>

      {/* 4. QUẢN LÝ DANH SÁCH THIẾT BỊ NHẬN WEBPUSH */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-laptop-medical" style={{ color: '#3b82f6' }} aria-hidden="true" />
            <span>Danh Sách Thiết Bị Nhận Thông Báo Đẩy ({pushSubscriptions.length})</span>
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Hỗ trợ máy tính, máy tính bảng & điện thoại PWA
          </span>
        </div>

        <div className="card-body">
          {pushSubscriptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#64748b' }}>
              <i className="fa-solid fa-bell-slash" style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: '0.86rem' }}>Chưa có thiết bị nào được kích hoạt nhận thông báo đẩy.</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>Hãy nhấn "Bật Thiết Bị Này" ở trên để kích hoạt nhận tin tức thì.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pushSubscriptions.map((sub, idx) => (
                <div
                  key={sub.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: sub.isActive ? '#ffffff' : '#f8fafc',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                      <i className="fa-solid fa-display" style={{ fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1e293b' }}>
                        {sub.deviceLabel || 'Thiết bị làm việc cá nhân'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        Đăng ký: {formatDateTimeShort(sub.createdAt)} {sub.lastUsedAt ? `• Sử dụng gần nhất: ${formatDateTimeShort(sub.lastUsedAt)}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${sub.isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                      {sub.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-danger btn-sm"
                      onClick={() => handleRemoveDevice(sub.endpoint, sub.id)}
                      title="Hủy liên kết thiết bị này"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
