'use client';

import React, { useState } from 'react';
import { authenticateUser } from '../../services/auth.service';
import type { RoleCode } from '../../services/auth.service';

// Re-export for backward compatibility
export type { RoleCode };

/* ═══════════════════════════════════════════════════════════════
   FONTAWESOME ICON HELPER (đồng nhất với page.tsx)
   ═══════════════════════════════════════════════════════════════ */
const Icon = ({ name, size = 16, className = '', style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) => (
  <i className={`fa-solid fa-${name} ${className}`} style={{ fontSize: size, ...style }} aria-hidden="true" />
);

/* ═══════════════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

export interface QuickRoleOption {
  code: RoleCode;
  title: string;
  name: string;
  email: string;
  badgeBg: string;
  textColor: string;
  icon: string; // FontAwesome icon name
}

export const OFFICIAL_ROLES: QuickRoleOption[] = [
  // Đảng ủy — cao nhất
  { code: 'BiThuDU', title: 'Bí thư Đảng ủy xã', name: 'Trần Văn Nam', email: 'bithu@catngan.gov.vn', badgeBg: 'bg-red-700/10 border-red-700/30', textColor: 'text-red-700 dark:text-red-400', icon: 'star' },
  // UBND
  { code: 'ChuTichUBND', title: 'Chủ tịch UBND xã', name: 'Nguyễn Đình Hùng', email: 'chutich@catngan.gov.vn', badgeBg: 'bg-blue-600/10 border-blue-600/30', textColor: 'text-blue-700 dark:text-blue-400', icon: 'landmark' },
  { code: 'PhoChuTichUBND_ChanhVP', title: 'Phó CT UBND (Chánh VP)', name: 'Lê Văn Bình', email: 'phoctubnd.chanhvp@catngan.gov.vn', badgeBg: 'bg-blue-400/10 border-blue-400/30', textColor: 'text-blue-600 dark:text-blue-300', icon: 'building-columns' },
  { code: 'PhoChuTichUBND_TTPHCC', title: 'Phó CT UBND (GĐ TTPHCC)', name: 'Nguyễn Thị Lan', email: 'phoctubnd.ttphcc@catngan.gov.vn', badgeBg: 'bg-sky-500/10 border-sky-500/30', textColor: 'text-sky-600 dark:text-sky-400', icon: 'building' },
  // HĐND
  { code: 'ChuTichHDND', title: 'Chủ tịch HĐND xã', name: 'Lê Thị Hồng', email: 'hdnd@catngan.gov.vn', badgeBg: 'bg-amber-600/10 border-amber-600/30', textColor: 'text-amber-700 dark:text-amber-400', icon: 'scroll' },
  { code: 'PhoChuTichHDND', title: 'Phó CT HĐND (chuyên trách)', name: 'Phạm Văn Đức', email: 'phocthdnd@catngan.gov.vn', badgeBg: 'bg-amber-400/10 border-amber-400/30', textColor: 'text-amber-600 dark:text-amber-300', icon: 'scale-balanced' },
  // Phòng/Ban
  { code: 'TruongPhong', title: 'Trưởng phòng Địa chính', name: 'Trần Thị Mai', email: 'truongphong@catngan.gov.vn', badgeBg: 'bg-emerald-500/10 border-emerald-500/30', textColor: 'text-emerald-600 dark:text-emerald-400', icon: 'helmet-safety' },
  { code: 'PhoPhong', title: 'Phó Trưởng phòng', name: 'Đặng Văn Lộc', email: 'phophong@catngan.gov.vn', badgeBg: 'bg-teal-500/10 border-teal-500/30', textColor: 'text-teal-600 dark:text-teal-400', icon: 'user-tie' },
  // Chuyên viên
  { code: 'ChuyenVien', title: 'Chuyên viên Văn phòng', name: 'Nguyễn Văn Nam', email: 'chuyenvien@catngan.gov.vn', badgeBg: 'bg-purple-500/10 border-purple-500/30', textColor: 'text-purple-600 dark:text-purple-400', icon: 'user' },
];

export interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>, role?: RoleCode) => void;
  onQuickRoleSelect?: (role: RoleCode) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md transition-all focus-within:border-blue-500/70 focus-within:ring-4 focus-within:ring-blue-500/10 shadow-sm">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial; delay: string }) => (
  <div className={`animate-testimonial ${delay} flex items-start gap-3.5 rounded-3xl bg-slate-900/75 dark:bg-slate-900/85 backdrop-blur-xl border border-white/20 p-5 w-80 shadow-2xl text-white`}>
    <img src={testimonial.avatarSrc} className="h-11 w-11 object-cover rounded-2xl border border-white/20 shadow-md flex-shrink-0" alt="avatar" />
    <div className="text-xs leading-relaxed">
      <p className="flex items-center gap-1.5 font-bold text-sm text-slate-100">
        {testimonial.name}
        <Icon name="circle-check" size={14} style={{ color: '#60a5fa' }} />
      </p>
      <p className="text-slate-400 font-medium">{testimonial.handle}</p>
      <p className="mt-1.5 text-slate-200/90 font-normal leading-snug">{testimonial.text}</p>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN SIGN IN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export const SignInPage: React.FC<SignInPageProps> = ({
  title = (
    <span className="font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-600 shadow-sm">
        <Icon name="landmark" size={24} />
      </span>
      UBND Xã Cát Ngạn
    </span>
  ),
  description = "Hệ thống số hóa quản trị công việc, đôn đốc chỉ đạo & đánh giá năng lực cán bộ xã Cát Ngạn",
  heroImageSrc = "/images/hero-signin.png",
  testimonials = [],
  onSignIn,
  onQuickRoleSelect,
  onResetPassword,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRoleSelect = (role: QuickRoleOption) => {
    setSelectedRole(role.code);
    setEmail(role.email);
    setPassword('catngan2026');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validate inputs
    if (!email.trim()) {
      setErrorMessage('Vui lòng nhập tên đăng nhập / email công vụ.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Vui lòng nhập mật khẩu xác thực.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authenticateUser(email, password);

      if (!result.success || !result.user) {
        setErrorMessage(result.error || 'Đã xảy ra lỗi khi đăng nhập.');
        setIsSubmitting(false);
        return;
      }

      // Login success
      const user = result.user;
      const roleCode = (user.activeRole as RoleCode) || 'ChuTichUBND';
      setSelectedRole(roleCode);
      setSuccessMessage(`Đăng nhập thành công! Chào mừng đồng chí ${user.fullName} (${user.activeRole}). Đang chuyển hướng...`);

      setTimeout(() => {
        if (onSignIn) {
          onSignIn(e, roleCode);
        }
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống khi đăng nhập.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row font-sans w-[100dvw] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-16">
        <div className="w-full max-w-lg">
          <div className="flex flex-col gap-6">
            
            {/* Header / Title */}
            <div className="space-y-2">
              <div className="animate-element animate-delay-100 text-3xl md:text-4xl font-extrabold leading-tight">
                {title}
              </div>
              <p className="animate-element animate-delay-200 text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed">
                {description}
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="animate-element flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-sm">
                <Icon name="circle-exclamation" size={18} style={{ marginTop: 1, flexShrink: 0, color: '#dc2626' }} />
                <div>
                  <div className="font-bold text-red-800 dark:text-red-200" style={{ marginBottom: 2 }}>Đăng nhập thất bại</div>
                  <div>{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="animate-element flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200 text-sm">
                <Icon name="circle-check" size={18} style={{ marginTop: 1, flexShrink: 0, color: '#16a34a' }} />
                <div>
                  <div className="font-bold text-emerald-900 dark:text-emerald-100" style={{ marginBottom: 2 }}>Đăng nhập thành công</div>
                  <div>{successMessage}</div>
                </div>
              </div>
            )}

            {/* Quick Login Role Badges */}
            <div className="animate-element animate-delay-300 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Icon name="user-check" size={14} style={{ color: '#3b82f6' }} /> Chọn vai trò đôn đốc nhanh (Demo):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OFFICIAL_ROLES.map((role) => (
                  <button
                    key={role.code}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    disabled={isSubmitting}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all duration-200 ${
                      selectedRole === role.code
                        ? `${role.badgeBg} border-blue-500 ring-2 ring-blue-500/20 shadow-sm scale-[1.01]`
                        : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800">
                      <Icon name={role.icon} size={14} style={{ color: 'inherit' }} />
                    </span>
                    <div className="truncate">
                      <div className={`text-xs font-bold ${role.textColor} truncate`}>{role.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{role.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Login Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="animate-element animate-delay-400 space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Icon name="building" size={14} style={{ color: '#94a3b8' }} /> Tên đăng nhập / Email công vụ
                </label>
                <GlassInputWrapper>
                  <input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrorMessage(''); }}
                    placeholder="nhansu@catngan.gov.vn"
                    required
                    disabled={isSubmitting}
                    className={`w-full bg-transparent text-sm p-3.5 rounded-2xl focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400 ${isSubmitting ? 'opacity-60' : ''}`}
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Icon name="lock" size={14} style={{ color: '#94a3b8' }} /> Mật khẩu xác thực
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrorMessage(''); }}
                      placeholder="••••••••"
                      required
                      disabled={isSubmitting}
                      className={`w-full bg-transparent text-sm p-3.5 pr-12 rounded-2xl focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400 ${isSubmitting ? 'opacity-60' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      <Icon name={showPassword ? 'eye-slash' : 'eye'} size={16} />
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-600 flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 dark:text-slate-400">
                  <input type="checkbox" name="rememberMe" defaultChecked className="custom-checkbox" />
                  <span>Duy trì đăng nhập an toàn</span>
                </label>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); onResetPassword?.(); }}
                  className="hover:underline font-semibold text-blue-600 dark:text-blue-400 transition-colors"
                >
                  Quên mật khẩu?
                </a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`animate-element animate-delay-700 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] py-3.5 font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 flex items-center justify-center gap-2 text-sm ${isSubmitting ? 'opacity-80 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (
                  <>
                    <Icon name="spinner" size={16} className="fa-spin" /> Đang xác thực...
                  </>
                ) : (
                  <>
                    <Icon name="shield-halved" size={16} /> Đăng Nhập Hệ Thống
                  </>
                )}
              </button>
            </form>

            {/* Password hint for demo */}
            <div className="animate-element animate-delay-800 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              <Icon name="circle-info" size={12} style={{ marginRight: 4 }} />
              Demo: Chọn vai trò phía trên để tự điền thông tin. Mật khẩu mặc định: <strong className="text-slate-600 dark:text-slate-300">catngan2026</strong>
            </div>

            {/* Footer Notice */}
            <div className="animate-element animate-delay-800 text-center pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p className="flex items-center justify-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                <Icon name="award" size={14} style={{ color: '#d97706' }} /> Hệ Thống Quản Lý Số Hóa UBND Xã Cát Ngạn
              </p>
              <p>© 2026 Bản quyền thuộc UBND Xã Cát Ngạn</p>
            </div>

          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center shadow-2xl overflow-hidden"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          >
            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-900/20" />

            {/* Hero Overlay Badge */}
            <div className="absolute top-8 left-8 p-4 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-white/10 text-white max-w-sm">
              <div className="flex items-center gap-2 font-bold text-sm text-blue-400 mb-1">
                <Icon name="landmark" size={14} /> Chuyển Đổi Số Cấp Xã
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Minh bạch hóa luồng đôn đốc chỉ đạo 2 chiều giữa Chủ tịch xã, Trưởng phòng & Cán bộ chuyên viên.
              </p>
            </div>

            {/* Testimonials at bottom */}
            {testimonials.length > 0 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-6 w-full justify-center">
                <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
                {testimonials[1] && (
                  <div className="hidden xl:flex">
                    <TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" />
                  </div>
                )}
                {testimonials[2] && (
                  <div className="hidden 2xl:flex">
                    <TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default SignInPage;
