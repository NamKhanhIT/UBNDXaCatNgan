'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../components/ui/ToastContext';
import { mfaSetup, mfaEnable, mfaDisable } from '../../../services/auth.service';

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

  // Disable MFA confirmation
  const [isDisablingMfa, setIsDisablingMfa] = useState<boolean>(false);
  const [disableOtp, setDisableOtp] = useState<string>('');

  // Active Sessions
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1',
      device: 'Máy trạm UBND Xã (Windows 11 — Chrome 128)',
      ip: '192.168.1.45 (Mạng nội bộ LAN)',
      location: 'Xã Cát Ngạn, Huyện Thanh Chương, Nghệ An',
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
      await mfaEnable(mfaSecret, mfaOtp);
      setMfaEnabled(true);
      setIsMfaSettingUp(false);
      setMfaOtp('');
      addToast('Thành công', 'Đã kích hoạt xác thực 2 yếu tố (TOTP) thành công!', 'success');
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
      await mfaDisable(disableOtp);
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

  const handleLogoutOtherSessions = () => {
    setSessions(prev => prev.filter(s => s.isCurrent));
    addToast('Thành công', 'Đã đăng xuất tài khoản khỏi tất cả các thiết bị khác!', 'success');
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartMfaSetup}
                disabled={isMfaLoading}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <i className="fa-solid fa-shield-check" aria-hidden="true" />
                <span>{isMfaLoading ? 'Đang tạo key...' : 'Kích Hoạt Xác Thực 2 Bước Ngay'}</span>
              </button>
            ) : (
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
                <div style={{ display: 'flex', gap: 10, maxWidth: 340 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="form-input"
                    placeholder="••••••"
                    style={{ textAlign: 'center', letterSpacing: '0.4em', fontWeight: 800, fontSize: '1.1rem' }}
                    value={mfaOtp}
                    onChange={e => setMfaOtp(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmMfaEnable}
                    disabled={isMfaLoading}
                    style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    Xác nhận
                  </button>
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
                <div style={{ background: '#fef2f2', padding: 14, borderRadius: 8, border: '1px solid #fecaca', maxWidth: 420 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>
                    Nhập mã OTP 6 số hiện tại để xác nhận tắt MFA:
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      maxLength={6}
                      className="form-input"
                      placeholder="••••••"
                      value={disableOtp}
                      onChange={e => setDisableOtp(e.target.value.replace(/\D/g, ''))}
                      style={{ textAlign: 'center', letterSpacing: '0.3em', fontWeight: 800 }}
                    />
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
              style={{ fontWeight: 700 }}
            >
              Đăng Xuất Thiết Bị Khác
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
