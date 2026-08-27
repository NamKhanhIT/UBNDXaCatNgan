'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { usePermission } from '../../../hooks/use-permission';
import { useToast } from '../../../components/ui/ToastContext';
import {
  getUserProfileApi,
  updateUserProfileApi,
  requestChangeEmailApi,
  confirmChangeEmailApi,
  sendPhoneOtpApi,
  verifyPhoneOtpApi,
} from '../../../services/user.service';
import { sendChangePasswordOtpApi, verifyChangePasswordStep1Api, completeChangePasswordApi } from '../../../services/auth.service';
import { OtpInput } from '../../../components/ui/OtpInput';
import { TurnstileWidget } from '../../../components/ui/TurnstileWidget';

export function AccountSettingsTab() {
  const { user, activeRole } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [initialEmail, setInitialEmail] = useState(user?.email || '');
  const [zaloPhone, setZaloPhone] = useState('');
  const [isPhoneConfirmed, setIsPhoneConfirmed] = useState(false);
  const [departmentName, setDepartmentName] = useState('UBND Cấp Xã');
  const [roleName, setRoleName] = useState(
    activeRole === 'ChuTichUBND'
      ? 'Chủ tịch UBND Xã'
      : activeRole === 'TruongPhong'
      ? 'Trưởng phòng Kinh tế & Địa chính'
      : 'Chuyên viên Địa chính'
  );

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // State: Modal xác thực cập nhật email công vụ
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState<1 | 2>(1);
  const [emailCurrentPass, setEmailCurrentPass] = useState('');
  const [showEmailCurrentPass, setShowEmailCurrentPass] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpCountdown, setEmailOtpCountdown] = useState(0);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  // State: Modal xác thực số điện thoại qua tin nhắn SMS
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);

  // State: Đổi mật khẩu tài khoản (quy trình 2 bước bảo mật dạng dropdown thu gọn)
  const [isChangePasswordExpanded, setIsChangePasswordExpanded] = useState<boolean>(false);
  const [changePassStep, setChangePassStep] = useState<1 | 2>(1);
  const [changePassMethod, setChangePassMethod] = useState<'email' | 'totp'>('email');

  // Bước 1: Mật khẩu hiện tại & Xác thực OTP/MFA
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [changePassOtp, setChangePassOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [changePasswordToken, setChangePasswordToken] = useState('');
  const [isSubmittingStep1, setIsSubmittingStep1] = useState(false);

  // Bước 2: Mật khẩu mới & Xác nhận
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingStep2, setIsSubmittingStep2] = useState(false);

  // Thông báo lỗi/thành công riêng cho form Đổi mật khẩu
  const [stepError, setStepError] = useState('');
  const [stepSuccess, setStepSuccess] = useState('');

  // Bộ đếm ngược 60s cooldown gửi OTP Đổi mật khẩu
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Bộ đếm ngược 60s cooldown gửi OTP Đổi Email
  useEffect(() => {
    if (emailOtpCountdown > 0) {
      const timer = setTimeout(() => setEmailOtpCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailOtpCountdown]);

  // Bộ đếm ngược 60s cooldown gửi OTP SMS
  useEffect(() => {
    if (phoneOtpCountdown > 0) {
      const timer = setTimeout(() => setPhoneOtpCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneOtpCountdown]);

  // Kiểm tra Realtime Checklist độ mạnh mật khẩu (PasswordPolicy)
  const pwdMinLength = newPassword.length >= 8;
  const pwdHasUpper = /[A-Z]/.test(newPassword);
  const pwdHasNumber = /[0-9]/.test(newPassword);
  const pwdHasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
  const pwdMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);
  const isStep2Valid = pwdMinLength && pwdHasUpper && pwdHasNumber && pwdHasSpecial && pwdMatch;

  useEffect(() => {
    async function loadProfile() {
      try {
        setIsLoadingProfile(true);
        const res = await getUserProfileApi();
        if (res.success && res.data) {
          const loadedEmail = res.data.email || user?.email || '';
          setFullName(res.data.fullName || user?.fullName || '');
          setEmail(loadedEmail);
          setInitialEmail(loadedEmail);
          if (res.data.zaloPhoneNumber) {
            setZaloPhone(res.data.zaloPhoneNumber);
            setPhoneInput(res.data.zaloPhoneNumber);
          }
          setIsPhoneConfirmed(Boolean(res.data.phoneNumberConfirmed));
          if (res.data.departmentName) setDepartmentName(res.data.departmentName);
        }
      } catch (err) {
        console.warn('Lỗi nạp hồ sơ cá nhân:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    loadProfile();
  }, [user]);

  const isEmailChanged = email.trim().toLowerCase() !== initialEmail.trim().toLowerCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      addToast('Cảnh báo', 'Họ và tên không được để trống.', 'warning');
      return;
    }

    const cleanPhone = zaloPhone.trim();
    if (cleanPhone) {
      if (!/^0\d{9}$/.test(cleanPhone)) {
        addToast('Cảnh báo', 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0 (Ví dụ: 0912345678).', 'warning');
        return;
      }
    }

    // Nếu email công vụ bị thay đổi trên form -> Yêu cầu xác thực OTP email
    if (isEmailChanged) {
      setEmailStep(1);
      setEmailCurrentPass('');
      setEmailOtp('');
      setEmailError('');
      setShowEmailModal(true);
      return;
    }

    try {
      setIsSavingProfile(true);
      const res = await updateUserProfileApi({
        fullName: fullName.trim(),
        zaloPhoneNumber: cleanPhone || undefined,
      });

      if (res.success) {
        const cached = localStorage.getItem('ubnd_cached_user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            parsed.fullName = fullName.trim();
            localStorage.setItem('ubnd_cached_user', JSON.stringify(parsed));
          } catch {}
        }

        addToast('Thành công', 'Đã lưu thay đổi hồ sơ cá nhân vào cơ sở dữ liệu thành công!', 'success');
      } else {
        addToast('Lỗi', res.error || 'Không thể lưu thông tin hồ sơ.', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể lưu thông tin hồ sơ', 'danger');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handlers: Xác thực cập nhật email công vụ
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    if (!emailCurrentPass) {
      setEmailError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setEmailError('Địa chỉ email công vụ không hợp lệ.');
      return;
    }

    setIsEmailSubmitting(true);
    try {
      const res = await requestChangeEmailApi(emailCurrentPass, email.trim());
      if (res.success) {
        setEmailStep(2);
        setEmailOtpCountdown(res.data?.cooldownSeconds || 60);
        addToast('Thành công', res.message || 'Mã xác thực OTP đã được gửi đến địa chỉ email mới!', 'success');
      } else {
        setEmailError(res.error || 'Mật khẩu hiện tại không chính xác.');
        addToast('Cảnh báo', res.error || 'Yêu cầu không thành công.', 'warning');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Đã xảy ra lỗi khi gửi yêu cầu xác thực.');
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setEmailError('Vui lòng nhập đầy đủ 6 chữ số mã OTP.');
      return;
    }

    setIsEmailSubmitting(true);
    try {
      const res = await confirmChangeEmailApi(emailOtp.trim());
      if (res.success) {
        const updatedEmail = res.data?.newEmail || email.trim();
        setEmail(updatedEmail);
        setInitialEmail(updatedEmail);
        setShowEmailModal(false);

        // Cập nhật local storage cache
        const cached = localStorage.getItem('ubnd_cached_user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            parsed.email = updatedEmail;
            localStorage.setItem('ubnd_cached_user', JSON.stringify(parsed));
          } catch {}
        }

        addToast('Thành công', 'Đã cập nhật địa chỉ Email công vụ thành công!', 'success');
      } else {
        setEmailError(res.error || 'Mã xác thực OTP không chính xác hoặc đã hết hạn.');
        addToast('Lỗi', res.error || 'Đổi email thất bại.', 'danger');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Đã xảy ra lỗi khi xác nhận đổi email.');
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  // Handlers: Xác thực số điện thoại qua tin nhắn SMS
  const handleOpenPhoneModal = () => {
    setPhoneInput(zaloPhone || '');
    setPhoneOtp('');
    setPhoneError('');
    setPhoneOtpSent(false);
    setShowPhoneModal(true);
  };

  const handleSendPhoneOtp = async () => {
    setPhoneError('');
    const clean = phoneInput.trim();
    if (!clean || !/^0\d{9}$/.test(clean)) {
      setPhoneError('Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0 (Ví dụ: 0912345678).');
      return;
    }

    setIsPhoneSubmitting(true);
    try {
      const res = await sendPhoneOtpApi(clean);
      if (res.success) {
        setPhoneOtpSent(true);
        setPhoneOtpCountdown(res.data?.cooldownSeconds || 60);
        addToast('Thành công', res.message || 'Mã xác thực đã được gửi đến số điện thoại của đồng chí.', 'success');
      } else {
        setPhoneError(res.error || 'Không thể gửi tin nhắn SMS xác thực.');
        addToast('Cảnh báo', res.error || 'Gửi tin nhắn xác thực thất bại.', 'warning');
      }
    } catch (err: any) {
      setPhoneError(err.message || 'Đã xảy ra lỗi khi gửi mã xác thực.');
    } finally {
      setIsPhoneSubmitting(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    if (!phoneOtp.trim() || phoneOtp.trim().length !== 6) {
      setPhoneError('Vui lòng nhập đầy đủ 6 chữ số mã xác thực nhận được qua tin nhắn SMS.');
      return;
    }

    setIsPhoneSubmitting(true);
    try {
      const res = await verifyPhoneOtpApi(phoneInput.trim(), phoneOtp.trim());
      if (res.success) {
        const confirmedNumber = res.data?.confirmedPhoneNumber || phoneInput.trim();
        setZaloPhone(confirmedNumber);
        setIsPhoneConfirmed(true);
        setShowPhoneModal(false);
        addToast('Thành công', 'Đã xác thực số điện thoại công vụ thành công!', 'success');
      } else {
        setPhoneError(res.error || 'Mã xác thực không chính xác.');
        addToast('Lỗi', res.error || 'Xác thực số điện thoại thất bại.', 'danger');
      }
    } catch (err: any) {
      setPhoneError(err.message || 'Đã xảy ra lỗi khi xác thực số điện thoại.');
    } finally {
      setIsPhoneSubmitting(false);
    }
  };

  // Handlers: Đổi mật khẩu tài khoản 2 bước
  const handleSendOtp = async () => {
    if (otpCountdown > 0 || isSubmittingStep1) return;
    setStepError('');
    setStepSuccess('');
    setIsSubmittingStep1(true);

    try {
      const res = await sendChangePasswordOtpApi(turnstileToken || undefined);
      if (res.success) {
        setOtpSent(true);
        setOtpCountdown(60);
        setStepSuccess(res.message || 'Mã xác thực OTP đã được gửi về email công vụ của đồng chí.');
        addToast('Thành công', res.message || 'Mã OTP đã được gửi đến email công vụ.', 'success');
      } else {
        setStepError(res.error || 'Không thể gửi mã xác thực. Vui lòng kiểm tra lại.');
        addToast('Cảnh báo', res.error || 'Không thể gửi mã xác thực.', 'warning');
        setTurnstileResetKey(k => k + 1);
      }
    } catch (err: any) {
      setStepError(err?.message || 'Đã xảy ra lỗi khi gửi mã OTP.');
      addToast('Lỗi', err?.message || 'Đã xảy ra lỗi khi gửi mã OTP.', 'danger');
      setTurnstileResetKey(k => k + 1);
    } finally {
      setIsSubmittingStep1(false);
    }
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');
    setStepSuccess('');

    if (!currentPassword) {
      setStepError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (changePassMethod === 'email') {
      if (!changePassOtp.trim() || changePassOtp.trim().length !== 6) {
        setStepError('Vui lòng nhập đầy đủ 6 chữ số mã OTP nhận được qua email.');
        return;
      }
    } else {
      if (!changePassOtp.trim() || changePassOtp.trim().length !== 6) {
        setStepError('Vui lòng nhập đầy đủ 6 chữ số mã từ ứng dụng Authenticator.');
        return;
      }
    }

    setIsSubmittingStep1(true);
    try {
      const res = await verifyChangePasswordStep1Api(
        currentPassword,
        changePassOtp.trim(),
        changePassMethod,
        turnstileToken || undefined
      );

      if (res.success && res.changePasswordToken) {
        setChangePasswordToken(res.changePasswordToken);
        setChangePassStep(2);
        setStepError('');
        setStepSuccess('Xác minh danh tính thành công! Vui lòng thiết lập mật khẩu mới.');
        addToast('Thành công', 'Xác minh Bước 1 thành công! Vui lòng nhập mật khẩu mới.', 'success');
      } else {
        setStepError(res.error || 'Mã xác thực không hợp lệ hoặc mật khẩu hiện tại không đúng.');
        addToast('Lỗi', res.error || 'Xác thực không thành công.', 'danger');
        setTurnstileResetKey(k => k + 1);
      }
    } catch (err: any) {
      setStepError(err?.message || 'Đã xảy ra lỗi khi xác minh danh tính.');
      addToast('Lỗi', err?.message || 'Đã xảy ra lỗi khi xác minh danh tính.', 'danger');
      setTurnstileResetKey(k => k + 1);
    } finally {
      setIsSubmittingStep1(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');
    setStepSuccess('');

    if (!isStep2Valid) {
      setStepError('Vui lòng đáp ứng đầy đủ tất cả các tiêu chuẩn bảo mật mật khẩu trước khi lưu.');
      return;
    }

    setIsSubmittingStep2(true);
    try {
      const res = await completeChangePasswordApi(changePasswordToken, newPassword, confirmPassword);
      if (res.success) {
        addToast('Thành công', 'Đã cập nhật mật khẩu mới cho tài khoản công vụ thành công!', 'success');
        setChangePassStep(1);
        setCurrentPassword('');
        setChangePassOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setChangePasswordToken('');
        setOtpSent(false);
        setOtpCountdown(0);
        setStepSuccess('Đã đổi mật khẩu thành công! Mật khẩu mới đã có hiệu lực ngay lập tức.');
        setTurnstileResetKey(k => k + 1);
        setIsChangePasswordExpanded(false);
      } else {
        setStepError(res.error || 'Đổi mật khẩu thất bại. Vui lòng thử lại.');
        addToast('Lỗi', res.error || 'Đổi mật khẩu thất bại.', 'danger');
      }
    } catch (err: any) {
      setStepError(err?.message || 'Đã xảy ra lỗi khi đổi mật khẩu.');
      addToast('Lỗi', err?.message || 'Đã xảy ra lỗi khi đổi mật khẩu.', 'danger');
    } finally {
      setIsSubmittingStep2(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Phần 1: Thông tin cá nhân & tài khoản công vụ */}
      <div className="card">
        <div className="card-header">
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-user-pen" style={{ color: '#2563eb' }} aria-hidden="true" />
            <span>Thông Tin Cá Nhân & Tài Khoản Công Vụ</span>
          </h2>
        </div>

        <div className="card-body">
          {/* Avatar Profile Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.4rem',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
              }}
            >
              {fullName.split(' ').pop()?.[0] || 'CB'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{fullName}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                Tài khoản: <strong>{user?.username || 'admin'}</strong> • Trạng thái: <span style={{ color: '#16a34a', fontWeight: 700 }}>● Đang công tác</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                  Họ và tên hiển thị (*):
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                  Tên đăng nhập (Username):
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={user?.username || 'admin'}
                  readOnly
                  disabled
                  style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', fontSize: '0.9rem', padding: '8px 12px' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Tên đăng nhập hệ thống không thể thay đổi</span>
              </div>
            </div>

            {/* Khối Email Công Vụ & Số Điện Thoại */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Email Công Vụ */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    Email công vụ (*):
                  </label>
                  {isEmailChanged && (
                    <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>
                      ● Đã chỉnh sửa (Cần xác thực khi lưu)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{
                      flex: 1,
                      fontSize: '0.9rem',
                      padding: '8px 12px',
                      borderColor: isEmailChanged ? '#3b82f6' : undefined,
                      background: isEmailChanged ? '#eff6ff' : undefined,
                    }}
                  />
                  {!isEmailChanged && (
                    <span
                      style={{
                        background: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <i className="fa-solid fa-circle-check" /> Chính Thức
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Địa chỉ email tiếp nhận thông báo và mã xác thực an toàn thông tin
                </span>
              </div>

              {/* Số Điện Thoại & Xác Thực SMS */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    Số điện thoại liên lạc / Zalo:
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenPhoneModal}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isPhoneConfirmed ? '#16a34a' : '#ea580c',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: 0,
                    }}
                  >
                    <i className={`fa-solid ${isPhoneConfirmed ? 'fa-pen' : 'fa-mobile-screen-button'}`} />
                    {isPhoneConfirmed ? 'Thay Đổi Số Điện Thoại' : 'Xác Thực Qua SMS'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="0912345678"
                    maxLength={10}
                    value={zaloPhone}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setZaloPhone(digits);
                    }}
                    style={{ flex: 1, fontSize: '0.9rem', padding: '8px 12px' }}
                  />
                  {isPhoneConfirmed ? (
                    <span
                      style={{
                        background: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Số điện thoại đã được xác thực qua hệ thống tin nhắn SMS công vụ"
                    >
                      <i className="fa-solid fa-shield-check" /> Đã Xác Thực SMS
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenPhoneModal}
                      style={{
                        background: '#fffbeb',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <i className="fa-solid fa-triangle-exclamation" /> Chưa Xác Thực SMS
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Số điện thoại tiếp nhận thông báo chỉ đạo điều hành và tin nhắn nhắc việc của UBND Cấp Xã
                </span>
              </div>
            </div>

            {/* Khối Phòng ban & Chức vụ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                  Phòng ban công tác:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={departmentName}
                  readOnly
                  disabled={!can('ManageDepartments')}
                  style={{ background: !can('ManageDepartments') ? '#f1f5f9' : '#fff', color: '#334155', fontSize: '0.9rem', padding: '8px 12px' }}
                />
                {!can('ManageDepartments') && (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Chỉ Lãnh đạo UBND mới có quyền điều chuyển phòng ban</span>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                  Chức danh / Vai trò tác nghiệp:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={roleName}
                  readOnly
                  disabled={!can('ManageUsers')}
                  style={{ background: !can('ManageUsers') ? '#f1f5f9' : '#fff', color: '#334155', fontSize: '0.9rem', padding: '8px 12px' }}
                />
                {!can('ManageUsers') && (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Chỉ Ban Tổ chức / Lãnh đạo mới có quyền bổ nhiệm vai trò</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingProfile}
                style={{ fontWeight: 700, padding: '10px 24px', fontSize: '0.9rem' }}
              >
                {isSavingProfile ? 'Đang lưu...' : 'Lưu Thay Đổi Thông Tin'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Phần 2: Đổi mật khẩu tài khoản (dạng dropdown thu gọn) */}
      <div className="card">
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '14px 20px',
          }}
          onClick={() => {
            setIsChangePasswordExpanded(prev => !prev);
            setStepError('');
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-shield-halved" style={{ color: '#d97706' }} aria-hidden="true" />
              <span>Đổi Mật Khẩu Tài Khoản</span>
            </h2>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '4px 12px', borderRadius: 999 }}>
              Quy trình 2 bước bảo mật
            </span>
          </div>

          <button
            type="button"
            className={`btn btn-sm ${isChangePasswordExpanded ? 'btn-secondary' : 'btn-outline'}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsChangePasswordExpanded(prev => !prev);
              setStepError('');
            }}
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <i className={`fa-solid ${isChangePasswordExpanded ? 'fa-chevron-up' : 'fa-key'}`} />
            <span>{isChangePasswordExpanded ? 'Thu Gọn' : 'Đổi Mật Khẩu'}</span>
          </button>
        </div>

        {isChangePasswordExpanded && (
          <div className="card-body">
            {/* Thanh tiến trình 2 bước */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    background: changePassStep === 1 ? '#2563eb' : '#10b981',
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  {changePassStep === 1 ? '1' : <i className="fa-solid fa-check" />}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: changePassStep === 1 ? 800 : 600, color: changePassStep === 1 ? '#1d4ed8' : '#334155' }}>
                  Bước 1: Xác Minh Danh Tính
                </div>
              </div>

              <div style={{ flex: 1, height: 2, background: changePassStep === 2 ? '#10b981' : '#e2e8f0' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    background: changePassStep === 2 ? '#2563eb' : '#e2e8f0',
                    color: changePassStep === 2 ? '#ffffff' : '#64748b',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  2
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: changePassStep === 2 ? 800 : 500, color: changePassStep === 2 ? '#1d4ed8' : '#94a3b8' }}>
                  Bước 2: Thiết Lập Mật Khẩu Mới
                </div>
              </div>
            </div>

            {stepError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 8, fontSize: '0.86rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-circle-exclamation" />
                <span>{stepError}</span>
              </div>
            )}

            {stepSuccess && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: 8, fontSize: '0.86rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-circle-check" />
                <span>{stepSuccess}</span>
              </div>
            )}

            {/* Bước 1: Xác minh danh tính */}
            {changePassStep === 1 && (
              <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                    Mật khẩu hiện tại (*):
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Nhập mật khẩu hiện tại của đồng chí"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      style={{ paddingRight: 42, fontSize: '0.9rem', padding: '10px 14px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 4
                      }}
                      title={showCurrentPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      <i className={`fa-solid ${showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 8 }}>
                    Phương thức nhận mã xác thực OTP:
                  </label>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <label
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: changePassMethod === 'email' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: changePassMethod === 'email' ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="radio"
                        name="changePassMethod"
                        value="email"
                        checked={changePassMethod === 'email'}
                        onChange={() => { setChangePassMethod('email'); setChangePassOtp(''); setStepError(''); }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                          <i className="fa-solid fa-envelope" style={{ color: '#2563eb', marginRight: 6 }} />
                          Email công vụ
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>
                          Mã OTP gửi đến: {initialEmail}
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: changePassMethod === 'totp' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: changePassMethod === 'totp' ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="radio"
                        name="changePassMethod"
                        value="totp"
                        checked={changePassMethod === 'totp'}
                        onChange={() => { setChangePassMethod('totp'); setChangePassOtp(''); setStepError(''); }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                          <i className="fa-solid fa-mobile-screen-button" style={{ color: '#059669', marginRight: 6 }} />
                          Ứng dụng Authenticator
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>
                          Google Authenticator / Microsoft Authenticator
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {changePassMethod === 'email' ? (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                        Mã xác thực OTP từ Email (*):
                      </label>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpCountdown > 0 || isSubmittingStep1}
                        className="btn btn-outline btn-sm"
                        style={{ fontWeight: 700, fontSize: '0.78rem', padding: '6px 12px' }}
                      >
                        <i className="fa-solid fa-paper-plane" style={{ marginRight: 4 }} />
                        {otpCountdown > 0 ? `Gửi lại sau (${otpCountdown}s)` : otpSent ? 'Gửi lại mã OTP' : 'Gửi mã OTP qua Email'}
                      </button>
                    </div>

                    <OtpInput
                      value={changePassOtp}
                      onChange={setChangePassOtp}
                      disabled={isSubmittingStep1}
                    />
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 8 }}>
                      Nhập 6 chữ số mã xác thực OTP nhận được trong hòm thư email công vụ.
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 10 }}>
                      Mã 6 chữ số từ ứng dụng Authenticator (*):
                    </label>
                    <OtpInput
                      value={changePassOtp}
                      onChange={setChangePassOtp}
                      disabled={isSubmittingStep1}
                    />
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 8 }}>
                      Mở ứng dụng xác thực trên điện thoại và nhập 6 chữ số hiển thị hiện tại.
                    </div>
                  </div>
                )}

                {/* Cloudflare Turnstile */}
                <div>
                  <TurnstileWidget
                    onToken={(token: string | null) => setTurnstileToken(token)}
                    resetKey={turnstileResetKey}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmittingStep1 || !currentPassword || changePassOtp.length !== 6}
                    style={{ fontWeight: 700, padding: '10px 28px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {isSubmittingStep1 ? (
                      <span>Đang xác minh...</span>
                    ) : (
                      <span>Tiếp Tục: Thiết Lập Mật Khẩu Mới <i className="fa-solid fa-arrow-right" /></span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Bước 2: Thiết lập mật khẩu mới */}
            {changePassStep === 2 && (
              <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                    Mật khẩu mới (*):
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Nhập mật khẩu mới"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      style={{ paddingRight: 42, fontSize: '0.9rem', padding: '10px 14px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 4
                      }}
                      title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      <i className={`fa-solid ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                    Xác nhận lại mật khẩu mới (*):
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      style={{ paddingRight: 42, fontSize: '0.9rem', padding: '10px 14px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 4
                      }}
                      title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                {/* Bảng Checklist Tiêu Chuẩn Bảo Mật Realtime */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    Tiêu chuẩn an toàn thông tin mật khẩu:
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: pwdMinLength ? '#15803d' : '#64748b', fontWeight: pwdMinLength ? 700 : 500 }}>
                      <i className={`fa-solid ${pwdMinLength ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: pwdMinLength ? '#16a34a' : '#cbd5e1' }} />
                      <span>Độ dài tối thiểu 8 ký tự</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: pwdHasUpper ? '#15803d' : '#64748b', fontWeight: pwdHasUpper ? 700 : 500 }}>
                      <i className={`fa-solid ${pwdHasUpper ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: pwdHasUpper ? '#16a34a' : '#cbd5e1' }} />
                      <span>Chứa ít nhất 1 chữ cái in hoa (A-Z)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: pwdHasNumber ? '#15803d' : '#64748b', fontWeight: pwdHasNumber ? 700 : 500 }}>
                      <i className={`fa-solid ${pwdHasNumber ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: pwdHasNumber ? '#16a34a' : '#cbd5e1' }} />
                      <span>Chứa ít nhất 1 chữ số (0-9)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: pwdHasSpecial ? '#15803d' : '#64748b', fontWeight: pwdHasSpecial ? 700 : 500 }}>
                      <i className={`fa-solid ${pwdHasSpecial ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: pwdHasSpecial ? '#16a34a' : '#cbd5e1' }} />
                      <span>Chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: pwdMatch ? '#15803d' : '#64748b', fontWeight: pwdMatch ? 700 : 500 }}>
                      <i className={`fa-solid ${pwdMatch ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: pwdMatch ? '#16a34a' : '#cbd5e1' }} />
                      <span>Mật khẩu xác nhận trùng khớp</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setChangePassStep(1); setStepError(''); }}
                    className="btn btn-outline"
                    disabled={isSubmittingStep2}
                    style={{ fontWeight: 700, padding: '10px 20px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <i className="fa-solid fa-arrow-left" />
                    <span>Quay lại Bước 1</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmittingStep2 || !isStep2Valid}
                    style={{ fontWeight: 700, padding: '10px 28px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {isSubmittingStep2 ? (
                      <span>Đang cập nhật...</span>
                    ) : (
                      <span><i className="fa-solid fa-check" /> Cập Nhật Mật Khẩu Mới</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Modal 1: Xác thực cập nhật email công vụ */}
      {showEmailModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowEmailModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 620,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              background: '#ffffff',
              borderRadius: 14,
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <i className="fa-solid fa-envelope-circle-check" style={{ fontSize: '1.35rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Xác Thực Cập Nhật Email Công Vụ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer', padding: 4 }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ padding: '24px 28px' }}>
              {/* Thông tin email đang thao tác */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Địa chỉ Email công vụ mới cần cập nhật:</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>{email}</div>
              </div>

              {emailError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 8, fontSize: '0.86rem', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-circle-exclamation" />
                  <span>{emailError}</span>
                </div>
              )}

              {emailStep === 1 ? (
                <form onSubmit={handleRequestEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                      Mật khẩu hiện tại của cán bộ (*):
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showEmailCurrentPass ? 'text' : 'password'}
                        className="form-input"
                        placeholder="Nhập mật khẩu hiện tại để xác minh danh tính"
                        value={emailCurrentPass}
                        onChange={e => setEmailCurrentPass(e.target.value)}
                        required
                        style={{ paddingRight: 42, fontSize: '0.95rem', padding: '10px 14px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailCurrentPass(!showEmailCurrentPass)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: 4
                        }}
                      >
                        <i className={`fa-solid ${showEmailCurrentPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
                      Hệ thống sẽ gửi mã xác thực gồm 6 chữ số đến địa chỉ email mới trên.
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowEmailModal(false)}
                      disabled={isEmailSubmitting}
                      style={{ padding: '9px 20px', fontSize: '0.88rem', fontWeight: 600 }}
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isEmailSubmitting}
                      style={{ fontWeight: 700, padding: '9px 24px', fontSize: '0.88rem' }}
                    >
                      {isEmailSubmitting ? 'Đang gửi mã...' : 'Gửi Mã Xác Thực OTP'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConfirmEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 10 }}>
                      Mã xác thực OTP (gồm 6 chữ số) (*):
                    </label>
                    <OtpInput
                      value={emailOtp}
                      onChange={setEmailOtp}
                      disabled={isEmailSubmitting}
                    />
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
                      Mã có hiệu lực trong thời hạn 05 phút. Đề nghị đồng chí kiểm tra hòm thư email.
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setEmailStep(1)}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <i className="fa-solid fa-arrow-left" /> Nhập lại mật khẩu
                    </button>

                    <button
                      type="button"
                      onClick={handleRequestEmailChange}
                      disabled={emailOtpCountdown > 0 || isEmailSubmitting}
                      style={{ background: 'none', border: 'none', color: emailOtpCountdown > 0 ? '#94a3b8' : '#2563eb', fontWeight: 700, fontSize: '0.82rem', cursor: emailOtpCountdown > 0 ? 'not-allowed' : 'pointer' }}
                    >
                      {emailOtpCountdown > 0 ? `Gửi lại mã (${emailOtpCountdown}s)` : 'Gửi lại mã OTP'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowEmailModal(false)}
                      disabled={isEmailSubmitting}
                      style={{ padding: '9px 20px', fontSize: '0.88rem', fontWeight: 600 }}
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isEmailSubmitting || emailOtp.length !== 6}
                      style={{ fontWeight: 700, padding: '9px 24px', fontSize: '0.88rem' }}
                    >
                      {isEmailSubmitting ? 'Đang xác thực...' : 'Xác Nhận Cập Nhật Email'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Xác thực số điện thoại qua tin nhắn SMS */}
      {showPhoneModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowPhoneModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 620,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              background: '#ffffff',
              borderRadius: 14,
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                background: 'linear-gradient(90deg, #1e3a8a 0%, #047857 100%)',
                color: '#ffffff',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <i className="fa-solid fa-mobile-screen-button" style={{ fontSize: '1.35rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Xác Thực Số Điện Thoại Công Vụ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer', padding: 4 }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ padding: '24px 28px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-shield-check" style={{ color: '#059669', fontSize: '1.1rem' }} />
                  Hệ Thống Tin Nhắn SMS Công Vụ
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 6, lineHeight: 1.6 }}>
                  Hệ thống gửi mã xác thực gồm 6 chữ số qua tin nhắn SMS đến số điện thoại di động của cán bộ nhằm bảo đảm an toàn thông tin và phục vụ công tác chỉ đạo điều hành.
                </div>
              </div>

              {phoneError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 8, fontSize: '0.86rem', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-circle-exclamation" />
                  <span>{phoneError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyPhoneOtp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                    Số điện thoại cán bộ (*):
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="0912345678"
                      maxLength={10}
                      value={phoneInput}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhoneInput(digits);
                      }}
                      required
                      style={{ flex: 1, fontSize: '0.95rem', padding: '10px 14px' }}
                    />
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={phoneOtpCountdown > 0 || isPhoneSubmitting || !phoneInput}
                      className="btn btn-outline"
                      style={{ fontWeight: 700, whiteSpace: 'nowrap', padding: '10px 18px', fontSize: '0.88rem' }}
                    >
                      <i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />
                      {phoneOtpCountdown > 0 ? `Gửi lại (${phoneOtpCountdown}s)` : phoneOtpSent ? 'Gửi Lại Mã' : 'Gửi Mã Xác Thực SMS'}
                    </button>
                  </div>
                </div>

                {phoneOtpSent && (
                  <div>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 10 }}>
                      Mã xác thực OTP (gồm 6 chữ số) (*):
                    </label>
                    <OtpInput
                      value={phoneOtp}
                      onChange={setPhoneOtp}
                      disabled={isPhoneSubmitting}
                    />
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
                      Mã xác thực có hiệu lực trong thời hạn 05 phút. Đề nghị đồng chí kiểm tra tin nhắn trên điện thoại di động.
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPhoneModal(false)}
                    disabled={isPhoneSubmitting}
                    style={{ padding: '9px 20px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    Đóng
                  </button>
                  {phoneOtpSent && (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isPhoneSubmitting || phoneOtp.length !== 6}
                      style={{ fontWeight: 700, background: '#059669', borderColor: '#059669', padding: '9px 24px', fontSize: '0.88rem' }}
                    >
                      {isPhoneSubmitting ? 'Đang xác thực...' : 'Xác Nhận & Lưu Số Điện Thoại'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
