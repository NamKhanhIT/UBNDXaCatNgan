'use client';

import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { authenticateUser, verifyMfaLogin } from '../services/auth.service';
import { getApiBaseUrl, needsBearerAuth } from '../services/api.config';

gsap.registerPlugin(useGSAP);

export type RoleCode = 'ChuTichUBND' | 'BiThuDU' | 'ChuTichHDND' | 'TruongPhong' | 'ChuyenVien';

interface LoginPageProps {
  onLoginSuccess: (role: RoleCode) => void;
}

interface QuickRole {
  code: RoleCode;
  title: string;
  name: string;
  badgeBg: string;
  color: string;
  icon: string;
}

const QUICK_ROLES: QuickRole[] = [
  { code: 'ChuTichUBND', title: 'Chủ tịch UBND xã', name: 'Nguyễn Đình Hùng', badgeBg: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', icon: '🏛️' },
  { code: 'BiThuDU', title: 'Bí thư Đảng ủy xã', name: 'Trần Văn Nam', badgeBg: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24', icon: '⭐' },
  { code: 'ChuTichHDND', title: 'Chủ tịch HĐND xã', name: 'Lê Thị Hồng', badgeBg: 'rgba(220, 38, 38, 0.15)', color: '#f87171', icon: '📜' },
  { code: 'TruongPhong', title: 'Trưởng phòng Địa chính', name: 'Trần Thị Mai', badgeBg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', icon: '🏗️' },
  { code: 'ChuyenVien', title: 'Chuyên viên Văn phòng', name: 'Nguyễn Văn Nam', badgeBg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', icon: '👤' },
];

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [username, setUsername] = useState('admin@catngan.gov.vn');
  const [password, setPassword] = useState('catngan2026');
  const [selectedRole, setSelectedRole] = useState<RoleCode>('ChuTichUBND');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Xác thực 2 yếu tố (MFA/OTP) ──
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [mfaError, setMfaError] = useState('');

  // API URL config for remote/mobile access
  const [isRemote, setIsRemote] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    const remote = needsBearerAuth();
    setIsRemote(remote);
    if (remote) {
      const saved = localStorage.getItem('custom_api_url') || '';
      if (!saved) {
        // Tự động hiển thị cấu hình nếu chưa có URL API
        setShowApiConfig(true);
      }
      setApiUrl(saved);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 1. PARTICLE CANVAS ANIMATION (BACKGROUND)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes
    const numParticles = Math.min(Math.floor((width * height) / 12000), 75);
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
    }> = [];

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.3,
      });
    }

    let mouseX = width / 2;
    let mouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw background gradient
      const bgGrad = ctx.createRadialGradient(
        mouseX,
        mouseY,
        50,
        width / 2,
        height / 2,
        Math.max(width, height)
      );
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#090d16');
      bgGrad.addColorStop(1, '#030712');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render & connect particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Draw node dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, ${p.alpha})`;
        ctx.fill();

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const lineAlpha = (1 - dist / 130) * 0.25;
            ctx.strokeStyle = `rgba(96, 165, 250, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        // Connect to mouse
        const mdx = p.x - mouseX;
        const mdy = p.y - mouseY;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 180) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouseX, mouseY);
          const mAlpha = (1 - mdist / 180) * 0.4;
          ctx.strokeStyle = `rgba(234, 179, 8, ${mAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 2. GSAP ENTRANCE TIMELINE ANIMATION
  // ═══════════════════════════════════════════════════════════════
  useGSAP(
    () => {
      if (!cardRef.current) return;

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        cardRef.current,
        { scale: 0.88, opacity: 0, y: 30, filter: 'blur(12px)' },
        { scale: 1, opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1 }
      )
        .fromTo(
          '.gsap-anim-header',
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.15 },
          '-=0.7'
        )
        .fromTo(
          '.gsap-anim-input',
          { opacity: 0, x: -20 },
          { opacity: 1, x: 0, duration: 0.5, stagger: 0.1 },
          '-=0.4'
        )
        .fromTo(
          '.gsap-anim-quick',
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(1.4)' },
          '-=0.3'
        )
        .fromTo(
          '.gsap-anim-btn',
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
          '-=0.2'
        );
    },
    { scope: containerRef }
  );

  // ═══════════════════════════════════════════════════════════════
  // 3. LOGIN SUBMIT & GSAP EXIT TRANSITION
  // ═══════════════════════════════════════════════════════════════
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    // Lưu custom API URL nếu người dùng đã nhập
    if (isRemote && apiUrl.trim()) {
      localStorage.setItem('custom_api_url', apiUrl.trim());
    }

    try {
      const authRes = await authenticateUser(username, password);
      if (!authRes.success) {
        setErrorMessage(authRes.error || 'Đăng nhập không thành công.');
        setIsSubmitting(false);
        return;
      }

      // Tài khoản đã bật MFA → chuyển sang bước nhập mã OTP
      if (authRes.requiresMfa) {
        setMfaToken(authRes.mfaToken || '');
        setMfaRequired(true);
        setIsSubmitting(false);
        return;
      }

      if (!authRes.user) {
        setErrorMessage('Không nhận được thông tin tài khoản.');
        setIsSubmitting(false);
        return;
      }

      const activeRoleCode = (authRes.user.activeRole as RoleCode) || selectedRole;

      if (containerRef.current && cardRef.current) {
        const exitTl = gsap.timeline({
          onComplete: () => {
            onLoginSuccess(activeRoleCode);
          },
        });

        exitTl
          .to('.gsap-anim-btn', {
            scale: 0.96,
            duration: 0.15,
            yoyo: true,
            repeat: 1,
          })
          .to(cardRef.current, {
            scale: 1.06,
            opacity: 0,
            y: -25,
            filter: 'blur(16px)',
            duration: 0.65,
            ease: 'power3.inOut',
          });
      } else {
        onLoginSuccess(activeRoleCode);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống khi đăng nhập.');
      setIsSubmitting(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.trim();
    if (code.length < 6) {
      setMfaError('Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.');
      return;
    }

    setMfaError('');
    setIsVerifyingMfa(true);

    try {
      const authRes = await verifyMfaLogin(mfaToken, code);
      if (!authRes.success || !authRes.user) {
        setMfaError(authRes.error || 'Mã OTP không hợp lệ.');
        setIsVerifyingMfa(false);
        return;
      }

      const activeRoleCode = (authRes.user.activeRole as RoleCode) || selectedRole;

      if (containerRef.current && cardRef.current) {
        gsap.to(cardRef.current, {
          scale: 1.05,
          opacity: 0,
          y: -30,
          filter: 'blur(16px)',
          duration: 0.7,
          ease: 'power3.inOut',
          onComplete: () => {
            onLoginSuccess(activeRoleCode);
          },
        });
      } else {
        onLoginSuccess(activeRoleCode);
      }
    } catch (err: any) {
      setMfaError(err.message || 'Lỗi hệ thống khi xác thực mã OTP.');
      setIsVerifyingMfa(false);
    }
  };

  const handleBackToLogin = () => {
    setMfaRequired(false);
    setMfaToken('');
    setOtpCode('');
    setMfaError('');
    setErrorMessage('');
  };

  const handleQuickLogin = async (role: RoleCode) => {
    setSelectedRole(role);
    setIsSubmitting(true);

    // Map role code to default seeded account email if quick login button clicked
    let loginEmail = 'admin@catngan.gov.vn';
    let loginPass = 'catngan2026';

    const authRes = await authenticateUser(loginEmail, loginPass);
    if (!authRes.success) {
      setErrorMessage(authRes.error || 'Không thể đăng nhập bằng tài khoản thử nghiệm.');
      setIsSubmitting(false);
      return;
    }

    // Tài khoản đã bật MFA → chuyển sang bước nhập mã OTP
    if (authRes.requiresMfa) {
      setMfaToken(authRes.mfaToken || '');
      setMfaRequired(true);
      setIsSubmitting(false);
      return;
    }

    if (cardRef.current) {
      gsap.to(cardRef.current, {
        scale: 1.05,
        opacity: 0,
        y: -30,
        filter: 'blur(16px)',
        duration: 0.7,
        ease: 'power3.inOut',
        onComplete: () => {
          onLoginSuccess(role);
        },
      });
    } else {
      onLoginSuccess(role);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 3D Particle Canvas Background */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      />

      {/* Ambient Radial Glow Overlays */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '15%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '15%',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(217, 119, 6, 0.2) 0%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Main Glassmorphism Card */}
      <div
        ref={cardRef}
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '480px',
          margin: '20px',
          padding: '40px 36px',
          borderRadius: '24px',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
          color: '#f8fafc',
        }}
      >
        {/* Emblem & Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            className="gsap-anim-header"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2) 0%, rgba(185, 28, 28, 0.4) 100%)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              boxShadow: '0 8px 24px rgba(220, 38, 38, 0.25)',
              fontSize: '32px',
              marginBottom: '14px',
            }}
          >
            🏛️
          </div>
          <h1
            className="gsap-anim-header"
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0',
              background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            UBND XÃ CÁT NGẠN
          </h1>
          <p
            className="gsap-anim-header"
            style={{
              fontSize: '0.82rem',
              color: '#94a3b8',
              margin: 0,
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            Hệ Thống Số Hóa Quản Trị Công Việc & Đôn Đốc Chỉ Đạo
          </p>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(220, 38, 38, 0.18)',
              border: '1px solid rgba(248, 113, 113, 0.4)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '0.8rem',
              color: '#fca5a5',
              marginBottom: '18px',
              textAlign: 'center',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* API URL Config Panel — chỉ hiện khi truy cập remote/mobile */}
        {isRemote && (
          <div
            style={{
              background: showApiConfig ? 'rgba(234, 179, 8, 0.12)' : 'rgba(30, 41, 59, 0.5)',
              border: `1px solid ${showApiConfig ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '16px',
            }}
          >
            <button
              type="button"
              onClick={() => setShowApiConfig(!showApiConfig)}
              style={{
                background: 'none',
                border: 'none',
                color: showApiConfig ? '#fbbf24' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                justifyContent: 'space-between',
              }}
            >
              <span>⚙️ Cấu hình địa chỉ API Backend (Remote/Mobile)</span>
              <span>{showApiConfig ? '▲' : '▼'}</span>
            </button>

            {showApiConfig && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 6 }}>
                  Nhập URL của API Backend (ví dụ: <code style={{ color: '#fbbf24' }}>http://192.168.1.15:5015</code> hoặc Cloudflare API tunnel)
                </div>
                <input
                  id="api-url-input"
                  type="url"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  placeholder="http://192.168.x.x:5015"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (apiUrl.trim()) {
                        localStorage.setItem('custom_api_url', apiUrl.trim());
                        setShowApiConfig(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'rgba(234, 179, 8, 0.2)',
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      color: '#fbbf24',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    💾 Lưu & Áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('custom_api_url');
                      setApiUrl('');
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(100, 116, 139, 0.2)',
                      border: '1px solid rgba(100, 116, 139, 0.3)',
                      color: '#94a3b8',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Xóa
                  </button>
                </div>
                {apiUrl && (
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>
                    ✅ Sẽ kết nối: <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{apiUrl}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MFA OTP Step — hiện sau khi nhập đúng mật khẩu (tài khoản đã bật 2 lớp) */}
        {mfaRequired ? (
          <form ref={formRef} onSubmit={handleMfaVerify}>
            <div
              style={{
                textAlign: 'center',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  fontSize: '26px',
                  marginBottom: '10px',
                }}
              >
                🔐
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>
                Xác thực 2 yếu tố
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.5 }}>
                Nhập 6 chữ số từ ứng dụng Authenticator
                <br />
                (Google Authenticator / Ente Auth / Microsoft Authenticator)
              </div>
            </div>

            {mfaError && (
              <div
                style={{
                  background: 'rgba(220, 38, 38, 0.18)',
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '0.8rem',
                  color: '#fca5a5',
                  marginBottom: '18px',
                  textAlign: 'center',
                }}
              >
                ⚠️ {mfaError}
              </div>
            )}

            <div style={{ marginBottom: '22px' }}>
              <label
                htmlFor="login-otp"
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#cbd5e1',
                  marginBottom: '6px',
                }}
              >
                Mã OTP 6 chữ số
              </label>
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                disabled={isVerifyingMfa}
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  color: '#ffffff',
                  fontSize: '1.4rem',
                  letterSpacing: '0.6em',
                  textAlign: 'center',
                  fontWeight: 700,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isVerifyingMfa}
              className="gsap-anim-btn"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: isVerifyingMfa ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.4)',
                transition: 'transform 0.15s ease, background 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isVerifyingMfa ? (
                <>⏳ Đang xác thực mã OTP...</>
              ) : (
                <>✅ Xác Nhận & Đăng Nhập</>
              )}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              disabled={isVerifyingMfa}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '12px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '8px',
              }}
            >
              ← Quay lại nhập tài khoản
            </button>
          </form>
        ) : (
          <>
        {/* Login Form */}
        <form ref={formRef} onSubmit={handleLoginSubmit}>
          <div className="gsap-anim-input" style={{ marginBottom: '16px' }}>
            <label
              htmlFor="login-username"
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '6px',
              }}
            >
              Tên đăng nhập / Email công vụ
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="nhansu@catngan.gov.vn"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: '0.88rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div className="gsap-anim-input" style={{ marginBottom: '22px' }}>
            <label
              htmlFor="login-password"
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '6px',
              }}
            >
              Mật khẩu xác thực
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: '0.88rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Main Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="gsap-anim-btn"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: '1px solid rgba(96, 165, 250, 0.4)',
              color: '#ffffff',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
              transition: 'transform 0.15s ease, background 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isSubmitting ? (
              <>⏳ Đang xác thực & đăng nhập...</>
            ) : (
              <>🚀 Đăng Nhập Hệ Thống</>
            )}
          </button>
        </form>

        {/* Divider */}
        <div
          className="gsap-anim-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '24px 0 16px 0',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ padding: '0 12px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
            HOẶC ĐĂNG NHẬP NHANH DEMO
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* 1-Click Quick Login Role Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {QUICK_ROLES.map(role => (
            <button
              key={role.code}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleQuickLogin(role.code)}
              className="gsap-anim-quick"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: role.badgeBg,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: role.color,
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem' }}>{role.icon}</span>
                <span style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{role.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{role.name}</div>
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Đăng nhập ➔</span>
            </button>
          ))}
        </div>

        </>
        )}

        {/* Footer info */}
        <div
          style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '0.72rem',
            color: '#64748b',
          }}
        >
          © 2026 UBND Xã Cát Ngạn • Bản quyền hệ thống số hóa điều hành
        </div>
      </div>
    </div>
  );
}
