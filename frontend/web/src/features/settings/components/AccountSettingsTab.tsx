'use client';

import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { usePermission } from '../../../hooks/use-permission';
import { useToast } from '../../../components/ui/ToastContext';

export function AccountSettingsTab() {
  const { user, activeRole } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || 'Nguyễn Đình Hùng');
  const [email, setEmail] = useState(user?.email || 'nguyendinhhung@catngan.nghean.gov.vn');
  const [zaloPhone, setZaloPhone] = useState('0912345678');
  const [departmentName] = useState('UBND Xã Cát Ngạn');
  const [roleName] = useState(
    activeRole === 'ChuTichUBND'
      ? 'Chủ tịch UBND Xã'
      : activeRole === 'TruongPhong'
      ? 'Trưởng phòng Kinh tế & Địa chính'
      : 'Chuyên viên Địa chính'
  );

  // Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      await new Promise(resolve => setTimeout(resolve, 600));

      // Cập nhật session cache
      const cached = localStorage.getItem('ubnd_cached_user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          parsed.fullName = fullName;
          parsed.email = email;
          localStorage.setItem('ubnd_cached_user', JSON.stringify(parsed));
        } catch {}
      }

      addToast('Thành công', 'Đã cập nhật thông tin tài khoản thành công!', 'success');
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể lưu thông tin', 'danger');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      addToast('Cảnh báo', 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Cảnh báo', 'Mật khẩu mới và xác nhận mật khẩu không khớp', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      addToast('Cảnh báo', 'Mật khẩu mới phải có tối thiểu 6 ký tự', 'warning');
      return;
    }

    try {
      setIsChangingPass(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      addToast('Thành công', 'Đã cập nhật mật khẩu mới cho tài khoản công vụ!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể đổi mật khẩu', 'danger');
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── 1. THÔNG TIN HỒ SƠ CÁ NHÂN ── */}
      <div className="card">
        <div className="card-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Họ và tên hiển thị (*):
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Tên đăng nhập (Username):
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={user?.username || 'admin'}
                  disabled
                  style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Tên đăng nhập hệ thống không thể thay đổi</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Email công vụ:
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Số điện thoại Zalo:
                </label>
                <input
                  type="tel"
                  className="form-input"
                  value={zaloPhone}
                  onChange={e => setZaloPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Khối Phòng ban & Chức vụ (Chỉ quản trị viên mới được sửa) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Phòng ban công tác:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={departmentName}
                  disabled={!can('ManageDepartments')}
                  style={{ background: !can('ManageDepartments') ? '#f1f5f9' : '#fff', color: '#334155' }}
                />
                {!can('ManageDepartments') && (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Chỉ Lãnh đạo UBND mới có quyền điều chuyển phòng ban</span>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Chức danh / Vai trò tác nghiệp:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={roleName}
                  disabled={!can('ManageUsers')}
                  style={{ background: !can('ManageUsers') ? '#f1f5f9' : '#fff', color: '#334155' }}
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
                style={{ fontWeight: 700, padding: '8px 20px' }}
              >
                {isSavingProfile ? 'Đang lưu...' : 'Lưu Thay Đổi Thông Tin'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── 2. ĐỔI MẬT KHẨU TÀI KHOẢN ── */}
      <div className="card">
        <div className="card-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-key" style={{ color: '#d97706' }} aria-hidden="true" />
            <span>Đổi Mật Khẩu Tài Khoản</span>
          </h2>
        </div>

        <div className="card-body">
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Mật khẩu hiện tại:
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Mật khẩu mới:
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Tối thiểu 6 ký tự"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Xác nhận mật khẩu mới:
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <button
                type="submit"
                className="btn btn-outline"
                disabled={isChangingPass}
                style={{ fontWeight: 700, marginTop: 4 }}
              >
                {isChangingPass ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu Mới'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
