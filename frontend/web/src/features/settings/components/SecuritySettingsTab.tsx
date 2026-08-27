'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../components/ui/ToastContext';
import { mfaSetup, mfaEnable, mfaDisable, sendMfaEmailCode, revokeOtherSessionsApi } from '../../../services/auth.service';
import type { MfaChannel } from '../../../services/auth.service';
import { OtpInput } from '../../../components/ui/OtpInput';

export function SecuritySettingsTab() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // MFA State
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(!!user?.mfaEnabled);
  const [mfaSecret, setMfaSecret] = useState<string>('');
  const [mfaUri, setMfaUri] = useState<string>('');
  const [mfaOtp, setMfaOtp] = useState<string>('');
  const [isMfaSettingUp, setIsMfaSettingUp] = useState<boolean>(false);
  const [isMfaLoading, setIsMfaLoading] = useState<boolean>(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState<boolean>(false);

  // ── Kênh xác thực khi bật MFA (Đợt 3): Authenticator hoặc Email thuần ──
  const [setupMethod, setSetupMethod] = useState<MfaChannel>('totp');
  const [emailMasked, setEmailMasked] = useState<string>('');
  const [emailCooldown, setEmailCooldown] = useState<number>(0);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState<boolean>(false);

  // Disable MFA confirmation
  const [isDisablingMfa, setIsDisablingMfa] = useState<boolean>(false);
  const [disableOtp, setDisableOtp] = useState<string>('');
  const [disableChannel, setDisableChannel] = useState<MfaChannel>('totp');

  // Đếm ngược gửi lại mã email (60s từ backend)
  useEffect(() => {
    let timer: any;
    if (emailCooldown > 0) {
      timer = setTimeout(() => setEmailCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [emailCooldown]);

  // Yêu cầu gửi mã OTP MFA qua email công vụ (đã đăng nhập — không cần token)
  const handleSendEmailCode = async () => {
    setIsSendingEmailCode(true);
    try {
      const res = await sendMfaEmailCode();
      setEmailMasked(res.maskedEmail);
      setEmailCooldown(res.cooldownSeconds);
      addToast('Đã gửi mã', `Mã xác thực đã gửi tới ${res.maskedEmail}, hiệu lực 5 phút`, 'info');
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể gửi mã qua email', 'danger');
    } finally {
      setIsSendingEmailCode(false);
    }
  };

  // Active Sessions
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1',
      device: 'Máy trạm UBND Xã (Windows 11 — Chrome 128)',
      ip: '192.168.1.45 (Mạng nội bộ LAN)',
      location: 'UBND Cấp Xã, Trụ sở cơ quan',
      isCurrent: true,
      lastActive: 'Đang hoạt động',
    },
    {
      id: 'sess-2',
      device: 'Điện thoại di động (iPhone — Safari)',
      ip: '14.232.18.90 (Mạng 4G Viettel)',
      location: 'Nghệ An',
      isCurrent: false,
      lastActive: 'Hôm qua lúc 18:45',
    },
  ]);

  const handleStartMfaSetup = async () => {
    try {
      setIsMfaLoading(true);
      const res = await mfaSetup();
      setMfaSecret(res.secret);
      setMfaUri(res.provisioningUri);
      setIsMfaSettingUp(true);
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể tạo mã xác thực 2 bước', 'danger');
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleConfirmMfaEnable = async () => {
    if (!mfaOtp || mfaOtp.length !== 6) {
      addToast('Cảnh báo', 'Vui lòng nhập đủ 6 chữ số mã OTP', 'warning');
      return;
    }
    try {
      setIsMfaLoading(true);
      await mfaEnable(mfaSecret, mfaOtp, setupMethod);
      setMfaEnabled(true);
      setIsMfaSettingUp(false);
      setMfaOtp('');
      addToast(
        'Thành công',
        setupMethod === 'email'
          ? 'Đã kích hoạt xác thực 2 yếu tố bằng Email công vụ!'
          : 'Đã kích hoạt xác thực 2 yếu tố (TOTP) thành công!',
        'success'
      );
    } catch (err: any) {
      addToast('Lỗi xác thực', err.message || 'Mã OTP không đúng hoặc đã hết hạn', 'danger');
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleConfirmMfaDisable = async () => {
    if (!disableOtp || disableOtp.length !== 6) {
      addToast('Cảnh báo', 'Vui lòng nhập mã OTP 6 số để xác nhận tắt MFA', 'warning');
      return;
    }
    try {
      setIsMfaLoading(true);
      await mfaDisable(disableOtp, disableChannel);
      setMfaEnabled(false);
      setIsDisablingMfa(false);
      setDisableOtp('');
      addToast('Đã tắt MFA', 'Đã tắt xác thực 2 yếu tố cho tài khoản', 'info');
    } catch (err: any) {
      addToast('Lỗi xác thực', err.message || 'Mã OTP không chính xác', 'danger');
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleLogoutOtherSessions = async () => {
    try {
      setIsRevokingSessions(true);
      const res = await revokeOtherSessionsApi();
      setSessions(prev => prev.filter(s => s.isCurrent));
      addToast('Thành công', res.message || 'Đã đăng xuất tài khoản khỏi tất cả các thiết bị khác trong cơ sở dữ liệu!', 'success');
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể đăng xuất các thiết bị khác.', 'danger');
    } finally {
      setIsRevokingSessions(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. BẢO MẬT 2 BƯỚC (MFA / TOTP) ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-shield-halved" style={{ color: '#2563eb' }} aria-hidden="true" />
            <span>Bảo Mật Xác Thực 2 Bước (MFA / TOTP RFC 6238)</span>
          </h2>
          <span className={`badge ${mfaEnabled ? 'badge-success' : 'badge-warning'}`}>
            {mfaEnabled ? '● Đang kích hoạt' : '○ Chưa kích hoạt'}
          </span>
        </div>

        <div className="card-body">
          <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, marginBottom: 16 }}>
            Bảo vệ tài khoản công vụ chống truy cập trái phép bằng cách yêu cầu mã OTP 6 số từ ứng dụng Authenticator (Google Authenticator, Microsoft Authenticator, Aegis) mỗi khi đăng nhập.
          </p>

          {!mfaEnabled ? (
            !isMfaSettingUp ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0, fontWeight: 600 }}>
                  Chọn phương thức xác thực 2 bước phù hợp với đồng chí:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { setSetupMethod('totp'); handleStartMfaSetup(); }}
                    disabled={isMfaLoading}
                    style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <i className="fa-solid fa-mobile-screen-button" aria-hidden="true" />
                    <span>{isMfaLoading && setupMethod === 'totp' ? 'Đang tạo key...' : 'Dùng ứng dụng Authenticator'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setSetupMethod('email'); setIsMfaSettingUp(true); setMfaOtp(''); }}
                    disabled={isMfaLoading || isSendingEmailCode}
                    style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, color: '#2563eb', borderColor: '#93c5fd', background: '#eff6ff' }}
                  >
                    <i className="fa-solid fa-envelope" aria-hidden="true" />
                    <span>Bật qua Email công vụ</span>
                  </button>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Không cần cài thêm ứng dụng — chọn Email nếu đồng chí muốn nhận mã xác thực qua hòm thư công vụ.
                </span>
              </div>
            ) : setupMethod === 'totp' ? (
              <div style={{ background: '#f8fafc', padding: 18, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, color: '#0f172a' }}>
                  1️⃣ Nhập mã Key bí mật vào ứng dụng Authenticator của đồng chí:
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.94rem', background: '#ecfdf5', padding: '10px 14px', borderRadius: 6, color: '#065f46', border: '1px dashed #34d399', marginBottom: 14, fontWeight: 700 }}>
                  {mfaSecret}
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6, color: '#0f172a' }}>
                  2️⃣ Nhập mã OTP 6 số hiển thị trên ứng dụng để xác nhận kích hoạt:
                </div>
                <div style={{ maxWidth: 380 }}>
                  <OtpInput value={mfaOtp} onChange={setMfaOtp} disabled={isMfaLoading} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirmMfaEnable}
                      disabled={isMfaLoading}
                      style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Xác nhận kích hoạt
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => { setIsMfaSettingUp(false); setMfaOtp(''); }}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── BẬT MFA QUA EMAIL (Đợt 3) ── */
              <div style={{ background: '#f8fafc', padding: 18, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6, color: '#0f172a' }}>
                  1️⃣ Gửi mã xác thực tới email công vụ:
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleSendEmailCode}
                  disabled={isSendingEmailCode || emailCooldown > 0}
                  style={{ fontWeight: 700, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <i className={`fa-solid ${isSendingEmailCode ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
                  <span>{emailCooldown > 0 ? `Gửi lại sau ${emailCooldown}s` : emailMasked ? `Gửi lại mã tới ${emailMasked}` : 'Gửi mã qua Email'}</span>
                </button>

                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6, color: '#0f172a' }}>
                  2️⃣ Nhập mã OTP 6 số vừa nhận được để kích hoạt:
                </div>
                <div style={{ maxWidth: 380 }}>
                  <OtpInput value={mfaOtp} onChange={setMfaOtp} disabled={isMfaLoading} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirmMfaEnable}
                      disabled={isMfaLoading || mfaOtp.length !== 6}
                      style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Xác nhận kích hoạt
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => { setIsMfaSettingUp(false); setMfaOtp(''); }}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontWeight: 700, fontSize: '0.88rem' }}>
                <i className="fa-solid fa-circle-check" aria-hidden="true" />
                <span>Tài khoản của đồng chí đang được bảo vệ nghiêm ngặt bằng 2 lớp xác thực TOTP.</span>
              </div>

              {!isDisablingMfa ? (
                <div>
                  <button
                    type="button"
                    className="btn btn-outline btn-danger btn-sm"
                    onClick={() => setIsDisablingMfa(true)}
                    style={{ fontWeight: 700 }}
                  >
                    Tắt Xác Thực 2 Bước
                  </button>
                </div>
              ) : (
                <div style={{ background: '#fef2f2', padding: 14, borderRadius: 8, border: '1px solid #fecaca', maxWidth: 460 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>
                    Xác nhận bằng mã OTP để tắt MFA — chọn kênh:
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <button
                      type="button"
                      onClick={() => setDisableChannel('totp')}
                      className={`btn btn-sm ${disableChannel === 'totp' ? 'btn-danger' : 'btn-outline'}`}
                      style={{ fontWeight: 700 }}
                    >
                      Authenticator
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDisableChannel('email'); setDisableOtp(''); }}
                      className={`btn btn-sm ${disableChannel === 'email' ? 'btn-danger' : 'btn-outline'}`}
                      style={{ fontWeight: 700 }}
                    >
                      Qua Email
                    </button>
                    {disableChannel === 'email' && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleSendEmailCode}
                        disabled={isSendingEmailCode || emailCooldown > 0}
                        style={{ fontWeight: 700 }}
                      >
                        <i className={`fa-solid ${isSendingEmailCode ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
                        <span>{emailCooldown > 0 ? `${emailCooldown}s` : emailMasked ? 'Gửi lại' : 'Gửi mã'}</span>
                      </button>
                    )}
                  </div>

                  <OtpInput value={disableOtp} onChange={setDisableOtp} disabled={isMfaLoading} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setIsDisablingMfa(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={handleConfirmMfaDisable}
                      disabled={isMfaLoading}
                      style={{ fontWeight: 700 }}
                    >
                      Tắt MFA
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. QUẢN LÝ PHIÊN ĐĂNG NHẬP (ACTIVE SESSIONS) ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-laptop-code" style={{ color: '#059669' }} aria-hidden="true" />
            <span>Thiết Bị & Phiên Đăng Nhập Hoạt Động (Active Sessions)</span>
          </h2>
          {sessions.length > 1 && (
            <button
              type="button"
              className="btn btn-outline btn-danger btn-sm"
              onClick={handleLogoutOtherSessions}
              disabled={isRevokingSessions}
              style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <i className={`fa-solid ${isRevokingSessions ? 'fa-spinner fa-spin' : 'fa-right-from-bracket'}`} aria-hidden="true" />
              <span>{isRevokingSessions ? 'Đang xử lý...' : 'Đăng Xuất Thiết Bị Khác'}</span>
            </button>
          )}
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sessions.map((sess, idx) => (
              <div
                key={sess.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: idx < sessions.length - 1 ? '1px solid #f1f5f9' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>{sess.device}</span>
                    {sess.isCurrent && (
                      <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                        Thiết bị này
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    IP: <strong>{sess.ip}</strong> • Vị trí: {sess.location}
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: sess.isCurrent ? '#166534' : '#64748b', fontWeight: 600 }}>
                  {sess.lastActive}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
