'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '../../../components/ui/ToastContext';
import { applyAppearanceToDom, DEFAULT_APPEARANCE, AppearanceSettings } from '../../../lib/appearance';
import { getUserProfileApi, updateUserProfileApi } from '../../../services/user.service';

export function AppearanceSettingsTab() {
  const { addToast } = useToast();

  const [selectedFont, setSelectedFont] = useState<'Be Vietnam Pro' | 'Roboto' | 'Inter'>('Be Vietnam Pro');
  const [displayDensity, setDisplayDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [themeColor, setThemeColor] = useState<'govt-red' | 'classic-blue'>('govt-red');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    async function loadAppearance() {
      try {
        let loaded: Partial<AppearanceSettings> | null = null;
        // Thử lấy từ DB
        const profileRes = await getUserProfileApi();
        if (profileRes.success && profileRes.data?.appearancePreferences) {
          try {
            loaded = JSON.parse(profileRes.data.appearancePreferences);
          } catch {}
        }

        // Fallback localStorage
        if (!loaded) {
          const cached = localStorage.getItem('ubnd_appearance_settings');
          if (cached) {
            try {
              loaded = JSON.parse(cached);
            } catch {}
          }
        }

        if (loaded) {
          if (loaded.font) setSelectedFont(loaded.font);
          if (loaded.density) setDisplayDensity(loaded.density);
          if (loaded.theme) setThemeColor(loaded.theme);
          applyAppearanceToDom({ ...DEFAULT_APPEARANCE, ...loaded });
        }
      } catch (err) {
        console.warn('Lỗi nạp cài đặt giao diện:', err);
      }
    }
    loadAppearance();
  }, []);

  const handleSaveAppearance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const settings: AppearanceSettings = {
        font: selectedFont,
        density: displayDensity,
        theme: themeColor,
      };

      // Áp dụng ngay trên DOM
      applyAppearanceToDom(settings);

      // Lưu vào localStorage
      localStorage.setItem('ubnd_appearance_settings', JSON.stringify(settings));

      // Lưu vào PostgreSQL
      const res = await updateUserProfileApi({
        appearancePreferences: JSON.stringify(settings),
      });

      if (res.success) {
        addToast('Thành công', `Đã lưu cài đặt giao diện vào cơ sở dữ liệu PostgreSQL với phông chữ ${selectedFont}!`, 'success');
      } else {
        addToast('Lỗi Lưu CSDL', res.error || 'Không thể lưu cài đặt giao diện vào cơ sở dữ liệu. Vui lòng kiểm tra kết nối Backend API.', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Không thể lưu cài đặt giao diện vào CSDL.', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-palette" style={{ color: '#dc2626' }} aria-hidden="true" />
            <span>Tùy Chỉnh Giao Diện & Kiểu Chữ Hành Chính</span>
          </h2>
        </div>

        <div className="card-body">
          <form onSubmit={handleSaveAppearance} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Chọn Font chữ */}
            <div>
              <label style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 6 }}>
                1. Font chữ hiển thị toàn hệ thống (Typography):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: selectedFont === 'Be Vietnam Pro' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selectedFont === 'Be Vietnam Pro' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedFont('Be Vietnam Pro')}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', fontFamily: '"Be Vietnam Pro", sans-serif' }}>
                    Be Vietnam Pro
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 700, marginTop: 4 }}>
                    ★ Chuẩn mực hành chính VN
                  </div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: selectedFont === 'Roboto' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selectedFont === 'Roboto' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedFont('Roboto')}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', fontFamily: 'Roboto, sans-serif' }}>
                    Roboto
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                    Hiện đại, rõ ràng
                  </div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: selectedFont === 'Inter' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selectedFont === 'Inter' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedFont('Inter')}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                    Inter
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                    Tối ưu UI công nghệ
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Mật độ hiển thị */}
            <div>
              <label style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 6 }}>
                2. Mật độ hiển thị bảng và danh sách (Display Density):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: displayDensity === 'comfortable' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: displayDensity === 'comfortable' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDisplayDensity('comfortable')}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                    Tiêu chuẩn (Comfortable)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                    Khoảng cách thoáng, dễ đọc trên màn hình lớn
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: displayDensity === 'compact' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: displayDensity === 'compact' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDisplayDensity('compact')}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                    Tinh gọn (Compact)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                    Hiển thị nhiều dữ liệu hơn trên một màn hình
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontWeight: 700, padding: '8px 20px' }}
              >
                Lưu Cài Đặt Giao Diện
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
