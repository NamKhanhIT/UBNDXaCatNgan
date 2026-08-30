'use client';

import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail,
  Landmark,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  RotateCw,
  Send,
  Users,
  UserCheck,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoleCode } from '../../services/role-hierarchy.service';
import {
  authenticateUser,
  verifyMfaLogin,
  sendMfaEmailCode,
  sendPasswordResetOtpApi,
  verifyResetOtpApi,
  verifyResetMfaApi,
  resetPasswordWithOtpApi,
  resetPasswordWithMfaApi,
  AuthUser
} from '../../services/auth.service';
import { Button, Input } from './travel-connect-signin-1';
import { OtpInput } from './OtpInput';
import { TurnstileWidget } from './TurnstileWidget';
import { WavesShaderCanvas } from './WavesShaderCanvas';

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

export interface SignInPageProps {
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>, role?: RoleCode, user?: AuthUser) => void;
  onQuickRoleSelect?: (role: RoleCode) => void;
}

export const OFFICIAL_ACCOUNTS = [
  {
    username: 'admin',
    email: 'admin@ubnd.gov.vn',
    name: 'Nguyễn Đình Hùng',
    roleName: 'Chủ tịch UBND',
    roleCode: 'ChuTichUBND' as RoleCode,
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    username: 'bithu',
    email: 'bithu@ubnd.gov.vn',
    name: 'Phan Văn Hà',
    roleName: 'Bí thư Đảng ủy',
    roleCode: 'BiThuDU' as RoleCode,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    username: 'pct',
    email: 'pct@ubnd.gov.vn',
    name: 'Nguyễn Văn Hoàng',
    roleName: 'Phó Chủ tịch UBND xã',
    roleCode: 'PhoChuTichUBND' as RoleCode,
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    username: 'chanh_vp',
    email: 'chanhvp@ubnd.gov.vn',
    name: 'Hoàng Đức Minh',
    roleName: 'Chánh Văn phòng HĐND & UBND',
    roleCode: 'ChanhVanPhong' as RoleCode,
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    username: 'tp_kt',
    email: 'tp_kt@ubnd.gov.vn',
    name: 'Lê Văn Tùng',
    roleName: 'Trưởng phòng Kinh tế',
    roleCode: 'TruongPhong' as RoleCode,
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    username: 'tp_vh',
    email: 'tp_vh@ubnd.gov.vn',
    name: 'Trần Thị Mai',
    roleName: 'Trưởng phòng VH-XH',
    roleCode: 'TruongPhong' as RoleCode,
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    username: 'nam',
    email: 'nam@ubnd.gov.vn',
    name: 'Nguyễn Văn Nam',
    roleName: 'Chuyên viên Địa chính',
    roleCode: 'ChuyenVien' as RoleCode,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    username: 'thu',
    email: 'thu@ubnd.gov.vn',
    name: 'Hoàng Thị Thu',
    roleName: 'Chuyên viên Văn thư',
    roleCode: 'ChuyenVien' as RoleCode,
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  {
    username: 'duc',
    email: 'duc@ubnd.gov.vn',
    name: 'Phạm Văn Đức',
    roleName: 'Chuyên viên Một cửa & CNTT',
    roleCode: 'ChuyenVien' as RoleCode,
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
];

export const SignInPage: React.FC<SignInPageProps> = ({
  onSignIn,
}) => {
  // Mode: 'password' (Đăng nhập mật khẩu) | 'otp-direct' (Nhập trực tiếp mã OTP)
  const [authMode, setAuthMode] = useState<'password' | 'otp-direct'>('password');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Inputs
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('khmsw101@');
  const [otpCode, setOtpCode] = useState('');

  // MFA Step state (khi đăng nhập mật khẩu đúng nhưng tài khoản đã bật 2 bước)
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaChannel, setMfaChannel] = useState<'totp' | 'email'>('totp');

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showAccountsDrawer, setShowAccountsDrawer] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  // ── Forgot Password Modal States (Wizard 2 Bước) ──
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotMethod, setForgotMethod] = useState<'email' | 'mfa'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotMfaCode, setForgotMfaCode] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotIsPasswordVisible, setForgotIsPasswordVisible] = useState(false);
  const [forgotIsConfirmVisible, setForgotIsConfirmVisible] = useState(false);
  const [forgotTurnstileToken, setForgotTurnstileToken] = useState<string | null>(null);
  const [forgotTurnstileResetKey, setForgotTurnstileResetKey] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [mfaSendingEmail, setMfaSendingEmail] = useState(false);
  const [mfaEmailCooldown, setMfaEmailCooldown] = useState(0);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Tiêu chí kiểm tra mật khẩu mạnh thời gian thực
  const pwdMinLength = forgotNewPassword.length >= 8;
  const pwdHasUpper = /[A-Z]/.test(forgotNewPassword);
  const pwdHasNumber = /[0-9]/.test(forgotNewPassword);
  const pwdHasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(forgotNewPassword);
  const pwdMatch = forgotNewPassword.length > 0 && forgotNewPassword === forgotConfirmPassword;
  const isNewPasswordValid = pwdMinLength && pwdHasUpper && pwdHasNumber && pwdHasSpecial && pwdMatch;

  // Countdown timer for resending OTP
  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Countdown timer for resending MFA Email OTP
  useEffect(() => {
    let timer: any;
    if (mfaEmailCooldown > 0) {
      timer = setTimeout(() => setMfaEmailCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [mfaEmailCooldown]);

  // Gửi mã OTP xác thực 2 bước qua Email khi đăng nhập
  const handleSendMfaEmailLogin = async () => {
    if (!mfaToken) return;
    try {
      setMfaSendingEmail(true);
      setErrorMessage('');
      const res = await sendMfaEmailCode(mfaToken);
      setMfaChannel('email');
      setMfaEmailCooldown(res.cooldownSeconds || 60);
      setSuccessMessage(`Đã gửi mã OTP tới ${res.maskedEmail}. Vui lòng kiểm tra email của Anh/Chị!`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể gửi mã qua email.');
    } finally {
      setMfaSendingEmail(false);
    }
  };

  // Quick select an account from official list
  const handleSelectAccount = (acc: typeof OFFICIAL_ACCOUNTS[0]) => {
    setEmail(acc.username);
    setPassword('khmsw101@');
    setErrorMessage('');
    setSuccessMessage(`Đã chọn tài khoản: ${acc.name} (${acc.roleName})`);
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  // Direct login with an account
  const handleQuickLogin = async (e: React.MouseEvent, acc: typeof OFFICIAL_ACCOUNTS[0]) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage(`Đang xác thực với vai trò ${acc.roleName}...`);
    setIsSubmitting(true);

    try {
      const authRes = await authenticateUser(acc.username, 'khmsw101@', turnstileToken || undefined);
      if (authRes.success && authRes.user) {
        setSuccessMessage(`Đăng nhập thành công với vai trò ${acc.roleName}!`);
        setTimeout(() => {
          if (onSignIn) {
            const role = (authRes.user?.activeRole as RoleCode) || acc.roleCode;
            onSignIn(e as any, role, authRes.user);
          }
        }, 300);
        return;
      }

      if (authRes.requiresMfa && authRes.mfaToken) {
        setMfaToken(authRes.mfaToken);
        setMfaRequired(true);
        setEmail(acc.username);
        setOtpCode('');
        setErrorMessage('Tài khoản này đã bật xác thực 2 bước (MFA). Vui lòng nhập mã OTP để tiếp tục.');
        return;
      }

      setTurnstileResetKey(k => k + 1);
      setErrorMessage(authRes.error || 'Đăng nhập không thành công.');
    } catch (err: any) {
      setTurnstileResetKey(k => k + 1);
      setErrorMessage(err.message || 'Lỗi kết nối khi xác thực.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý gửi biểu mẫu đăng nhập
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (mfaRequired) {
        // Đang ở bước 2: Xác thực mã OTP từ MFA Token
        if (!otpCode.trim() || otpCode.trim().length !== 6) {
          setErrorMessage('Vui lòng nhập đầy đủ 6 chữ số mã xác thực OTP.');
          setIsSubmitting(false);
          return;
        }

        const mfaRes = await verifyMfaLogin(mfaToken, otpCode.trim(), mfaChannel);
        if (mfaRes.success && mfaRes.user) {
          setSuccessMessage('Xác thực thành công. Đang chuyển hướng vào hệ thống...');
          setTimeout(() => {
            if (onSignIn) {
              const role = (mfaRes.user?.activeRole || (mfaRes.user as any)?.role || 'ChuTichUBND') as RoleCode;
              onSignIn(e, role, mfaRes.user);
            }
          }, 500);
          return;
        }

        setErrorMessage(mfaRes.error || 'Mã xác thực OTP không chính xác hoặc đã hết hạn.');
        setIsSubmitting(false);
        return;
      }

      if (authMode === 'otp-direct') {
        // Chế độ đăng nhập trực tiếp bằng mã OTP
        if (!email.trim()) {
          setErrorMessage('Vui lòng nhập tên đăng nhập hoặc email công vụ.');
          setIsSubmitting(false);
          return;
        }
        if (!otpCode.trim() || otpCode.trim().length !== 6) {
          setErrorMessage('Vui lòng nhập đầy đủ 6 chữ số mã xác thực.');
          setIsSubmitting(false);
          return;
        }

        const authRes = await authenticateUser(email.trim(), 'khmsw101@', turnstileToken || undefined);
        if (authRes.requiresMfa && authRes.mfaToken) {
          const mfaRes = await verifyMfaLogin(authRes.mfaToken, otpCode.trim());
          if (mfaRes.success && mfaRes.user) {
            setSuccessMessage('Đăng nhập thành công!');
            setTimeout(() => {
              if (onSignIn) {
                const role = (mfaRes.user?.activeRole as RoleCode) || 'ChuTichUBND';
                onSignIn(e, role, mfaRes.user);
              }
            }, 500);
            return;
          }
          setErrorMessage(mfaRes.error || 'Mã xác thực OTP không chính xác.');
          setIsSubmitting(false);
          return;
        }

        if (authRes.success && authRes.user) {
          setSuccessMessage('Đăng nhập thành công!');
          setTimeout(() => {
            if (onSignIn) {
              const role = (authRes.user?.activeRole as RoleCode) || 'ChuTichUBND';
              onSignIn(e, role, authRes.user);
            }
          }, 500);
          return;
        }

        setTurnstileResetKey(k => k + 1);
        setErrorMessage(authRes.error || 'Xác thực không thành công.');
        setIsSubmitting(false);
        return;
      }

      // Chế độ thông thường: Tên đăng nhập/Email + Mật khẩu
      if (!email.trim() || !password.trim()) {
        setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
        setIsSubmitting(false);
        return;
      }

      const authRes = await authenticateUser(email.trim(), password.trim(), turnstileToken || undefined);

      // Nếu backend yêu cầu MFA
      if ((authRes.requiresMfa || (authRes as any).mfaRequired) && authRes.mfaToken) {
        setMfaToken(authRes.mfaToken);
        setMfaRequired(true);
        setOtpCode('');
        setIsSubmitting(false);
        return;
      }

      if (authRes.success && authRes.user) {
        setSuccessMessage('Đăng nhập thành công!');
        setTimeout(() => {
          if (onSignIn) {
            const role = (authRes.user?.activeRole || (authRes.user as any)?.role || 'ChuTichUBND') as RoleCode;
            onSignIn(e, role, authRes.user);
          }
        }, 500);
        return;
      }

      setTurnstileResetKey(k => k + 1);
      setErrorMessage(authRes.error || 'Tài khoản hoặc mật khẩu không chính xác.');
      setIsSubmitting(false);
    } catch (err: any) {
      setTurnstileResetKey(k => k + 1);
      setErrorMessage(err.message || 'Lỗi kết nối khi xác thực.');
      setIsSubmitting(false);
    }
  };

  // ── Mở Modal Quên Mật Khẩu ──
  const handleOpenForgotModal = () => {
    const defaultEmail = email.includes('@') ? email : (email ? `${email}@ubnd.gov.vn` : '');
    setForgotEmail(defaultEmail);
    setForgotStep(1);
    setForgotMethod('email');
    setForgotOtp('');
    setForgotMfaCode('');
    setForgotResetToken('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotIsPasswordVisible(false);
    setForgotIsConfirmVisible(false);
    setForgotError('');
    setForgotSuccess('');
    setOtpSent(false);
    setOtpCountdown(0);
    setForgotTurnstileToken(null);
    setForgotTurnstileResetKey(k => k + 1);
    setShowForgotModal(true);
  };

  // ── Xử lý gửi OTP Quên mật khẩu qua Email ──
  const handleSendForgotOtp = async () => {
    if (!forgotEmail.trim()) {
      setForgotError('Vui lòng nhập địa chỉ email công vụ đã đăng ký.');
      return;
    }
    setForgotError('');
    setForgotSuccess('');
    setForgotSubmitting(true);

    try {
      const res = await sendPasswordResetOtpApi(forgotEmail.trim(), forgotTurnstileToken || undefined);
      if (res.success) {
        setOtpSent(true);
        setOtpCountdown(60);
        setForgotSuccess(res.message || 'Mã xác thực OTP đã được gửi về hòm thư của đồng chí.');
      } else {
        setForgotError(res.error || 'Không thể gửi mã xác thực. Vui lòng kiểm tra lại.');
        setForgotTurnstileResetKey(k => k + 1);
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Đã xảy ra lỗi khi gửi mã xác thực.');
      setForgotTurnstileResetKey(k => k + 1);
    } finally {
      setForgotSubmitting(false);
    }
  };

  // ── Bước 1: Xác thực OTP / MFA để lấy ResetToken ──
  const handleVerifyStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail.trim()) {
      setForgotError('Vui lòng nhập email công vụ.');
      return;
    }

    if (forgotMethod === 'email') {
      if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
        setForgotError('Vui lòng nhập đầy đủ 6 chữ số mã OTP nhận được qua email.');
        return;
      }

      setForgotSubmitting(true);
      try {
        const res = await verifyResetOtpApi(forgotEmail.trim(), forgotOtp.trim(), forgotTurnstileToken || undefined);
        if (res.success && res.resetToken) {
          setForgotResetToken(res.resetToken);
          setForgotStep(2);
          setForgotError('');
          setForgotSuccess('Xác thực danh tính thành công! Vui lòng thiết lập mật khẩu mới.');
          setTimeout(() => setForgotSuccess(''), 3500);
        } else {
          setForgotError(res.error || 'Mã xác thực OTP không chính xác hoặc đã hết hạn.');
          setForgotTurnstileResetKey(k => k + 1);
        }
      } catch (err: any) {
        setForgotError(err?.message || 'Đã xảy ra lỗi khi xác minh mã OTP.');
        setForgotTurnstileResetKey(k => k + 1);
      } finally {
        setForgotSubmitting(false);
      }
    } else {
      // Method: MFA Authenticator
      if (!forgotMfaCode.trim() || forgotMfaCode.trim().length !== 6) {
        setForgotError('Vui lòng nhập đầy đủ 6 chữ số mã từ ứng dụng Authenticator.');
        return;
      }

      setForgotSubmitting(true);
      try {
        const res = await verifyResetMfaApi(forgotEmail.trim(), forgotMfaCode.trim(), forgotTurnstileToken || undefined);
        if (res.success && res.resetToken) {
          setForgotResetToken(res.resetToken);
          setForgotStep(2);
          setForgotError('');
          setForgotSuccess('Xác thực 2 bước thành công! Vui lòng thiết lập mật khẩu mới.');
          setTimeout(() => setForgotSuccess(''), 3500);
        } else {
          setForgotError(res.error || 'Mã xác thực 2 bước không chính xác.');
          setForgotTurnstileResetKey(k => k + 1);
        }
      } catch (err: any) {
        setForgotError(err?.message || 'Đã xảy ra lỗi khi xác minh mã 2 bước.');
        setForgotTurnstileResetKey(k => k + 1);
      } finally {
        setForgotSubmitting(false);
      }
    }
  };

  // ── Bước 2: Hoàn tất Đặt lại mật khẩu mới ──
  const handleResetStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!isNewPasswordValid) {
      if (!pwdMinLength) setForgotError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      else if (!pwdHasUpper) setForgotError('Mật khẩu mới phải chứa ít nhất 1 chữ cái in hoa (A-Z).');
      else if (!pwdHasNumber) setForgotError('Mật khẩu mới phải chứa ít nhất 1 chữ số (0-9).');
      else if (!pwdHasSpecial) setForgotError('Mật khẩu mới phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...).');
      else if (!pwdMatch) setForgotError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    if (!forgotResetToken) {
      setForgotError('Phiên làm việc đã hết hạn. Vui lòng thực hiện lại từ Bước 1.');
      setForgotStep(1);
      return;
    }

    setForgotSubmitting(true);

    try {
      let res;
      if (forgotMethod === 'email') {
        res = await resetPasswordWithOtpApi(forgotResetToken, forgotNewPassword, forgotTurnstileToken || undefined);
      } else {
        res = await resetPasswordWithMfaApi(forgotResetToken, forgotNewPassword, forgotTurnstileToken || undefined);
      }

      if (res.success) {
        setForgotSuccess('Đổi mật khẩu thành công! Đồng chí có thể đăng nhập ngay.');
        setPassword(forgotNewPassword);
        setEmail(forgotEmail.trim());
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotSuccess('');
          setSuccessMessage('Đã cập nhật mật khẩu mới thành công. Vui lòng đăng nhập!');
          setTimeout(() => setSuccessMessage(''), 4000);
        }, 1500);
      } else {
        setForgotError(res.error || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Đã xảy ra lỗi khi hoàn tất đặt lại mật khẩu.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 antialiased text-slate-800 overflow-hidden font-sans">
      {/* ── HÌNH ẢNH NỀN ĐẤT NƯỚC VIỆT NAM VỚI DARK OVERLAY TRANG NHÃ ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-105"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=2000&q=85')`,
        }}
      />
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[6px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-900/50 pointer-events-none" />

      {/* ── CARD ĐĂNG NHẬP CHÍNH ── */}
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl flex flex-col md:flex-row bg-white shadow-2xl border border-slate-700/60 backdrop-blur-xl"
      >
        {/* ── CỘT TRÁI: WEBGL WAVES SHADER & ADMINISTRATIVE BRANDING ── */}
        <div className="hidden md:flex w-1/2 min-h-[640px] relative overflow-hidden flex-col justify-between p-9 bg-slate-950 text-white border-r border-slate-800 select-none">
          <WavesShaderCanvas className="opacity-65" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/75 pointer-events-none" />

          {/* Top Brand Header */}
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md backdrop-blur-md">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-200">
                ỦY BAN NHÂN DÂN
              </h2>
              <p className="text-xs text-amber-400 font-extrabold tracking-wider">
                CẤP XÃ
              </p>
            </div>
          </div>

          {/* Center Dignified Administrative Message */}
          <div className="relative z-10 space-y-3 my-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              <h1 className="text-2xl lg:text-3xl font-extrabold leading-tight tracking-tight text-white">
                Hệ Thống Quản Lý &amp; Điều Hành Công Việc
              </h1>
              <p className="text-xs lg:text-sm text-slate-300 leading-relaxed mt-2.5 font-normal max-w-sm">
                Nền tảng số hóa thực thi công vụ, giao ban chỉ đạo, phân luồng văn bản và đánh giá hiệu suất cán bộ theo tiêu chuẩn chính quyền số.
              </p>
            </motion.div>

            {/* Clean Technology Partner Attribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="pt-2 flex items-center gap-2 text-xs text-slate-300"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Phát triển và bảo trợ công nghệ bởi <strong className="text-amber-300 font-semibold">KHM Software</strong>
              </span>
            </motion.div>
          </div>

          {/* Left Footer Note */}
          <div className="relative z-10 text-[11px] text-slate-400 border-t border-white/10 pt-3.5 flex items-center justify-between">
            <span>Bảo mật dữ liệu nội bộ</span>
            <span className="text-slate-300 font-medium">Mật khẩu mặc định: <strong className="text-amber-300">khmsw101@</strong></span>
          </div>
        </div>

        {/* ── CỘT PHẢI: FORM ĐĂNG NHẬP THUẦN VIỆT ── */}
        <div className="w-full md:w-1/2 p-6 sm:p-10 flex flex-col justify-between bg-white overflow-y-auto max-h-[90vh] md:max-h-none">
          <div className="w-full max-w-sm mx-auto">
            {/* Header Form */}
            <div className="text-center md:text-left mb-5">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Đăng Nhập Hệ Thống
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Vui lòng sử dụng tài khoản công vụ được cấp để truy cập
              </p>
            </div>

            {/* Error / Success Alerts */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{errorMessage}</span>
                </motion.div>
              )}
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mode Tabs (chỉ hiện khi chưa ở bước MFA bắt buộc) */}
            {!mfaRequired && (
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('password');
                    setErrorMessage('');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'password'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Mật Khẩu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('otp-direct');
                    setErrorMessage('');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'otp-direct'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Mã OTP 2 Bước
                </button>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mfaRequired ? (
                /* Bước 2: Nhập OTP sau khi mật khẩu đúng */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Xác thực bảo mật 2 bước
                    </p>
                    <p className="text-slate-600">
                      Tài khoản đã bật bảo vệ 2 lớp. Nhập mã 6 số từ ứng dụng <strong>Authenticator</strong> hoặc nhận mã OTP qua <strong>Email công vụ</strong>:
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendMfaEmailLogin}
                      disabled={mfaSendingEmail || mfaEmailCooldown > 0}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer py-1"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>
                        {mfaSendingEmail
                          ? 'Đang gửi mã...'
                          : mfaEmailCooldown > 0
                            ? `Gửi lại mã qua Email (${mfaEmailCooldown}s)`
                            : 'Gửi mã xác thực qua Email công vụ'}
                      </span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Mã xác thực OTP (6 số) <span className="text-rose-500">*</span>
                    </label>
                    <OtpInput
                      value={otpCode}
                      onChange={setOtpCode}
                      autoFocus
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMfaRequired(false);
                        setMfaToken('');
                        setMfaChannel('totp');
                        setErrorMessage('');
                      }}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 py-2 px-3 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Quay lại
                    </button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || otpCode.length !== 6}
                      className="flex-1"
                    >
                      {isSubmitting ? 'Đang xác thực...' : 'Xác Nhận OTP'}
                    </Button>
                  </div>
                </motion.div>
              ) : authMode === 'password' ? (
                /* Tab 1: Đăng nhập mật khẩu */
                <>
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tên đăng nhập hoặc Email công vụ <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin hoặc admin@ubnd.gov.vn"
                        required
                        disabled={isSubmitting}
                        className="pl-10 text-xs sm:text-sm"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                        Mật khẩu <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleOpenForgotModal}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={isPasswordVisible ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Nhập mật khẩu"
                        required
                        disabled={isSubmitting}
                        className="pl-10 pr-10 text-xs sm:text-sm"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      >
                        {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileResetKey} />
                  </div>

                  <div className="pt-1">
                    <motion.div
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.985 }}
                      onHoverStart={() => setIsHovered(true)}
                      onHoverEnd={() => setIsHovered(false)}
                    >
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full relative overflow-hidden py-3"
                      >
                        <span className="flex items-center justify-center font-bold text-sm">
                          {isSubmitting ? 'Đang kiểm tra thông tin...' : 'Đăng Nhập'}
                          {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                        </span>
                        {isHovered && !isSubmitting && (
                          <motion.span
                            initial={{ left: "-100%" }}
                            animate={{ left: "100%" }}
                            transition={{ duration: 0.9, ease: "easeInOut" }}
                            className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                            style={{ filter: "blur(6px)" }}
                          />
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </>
              ) : (
                /* Tab 2: Xác thực trực tiếp bằng OTP */
                <>
                  <div>
                    <label htmlFor="otp-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tên đăng nhập hoặc Email công vụ <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="otp-email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin hoặc admin@ubnd.gov.vn"
                        required
                        disabled={isSubmitting}
                        className="pl-10"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="otp-code" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Mã xác thực OTP (6 chữ số) <span className="text-rose-500">*</span>
                    </label>
                    <OtpInput
                      value={otpCode}
                      onChange={setOtpCode}
                      disabled={isSubmitting}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Mã sinh ra từ ứng dụng Authenticator đã được liên kết với tài khoản.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileResetKey} />
                  </div>

                  <div className="pt-1">
                    <Button
                      type="submit"
                      disabled={isSubmitting || otpCode.length !== 6}
                      className="w-full py-3"
                    >
                      <span className="flex items-center justify-center font-bold text-sm">
                        {isSubmitting ? 'Đang xác thực...' : 'Đăng Nhập Bằng Mã OTP'}
                        {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                      </span>
                    </Button>
                  </div>
                </>
              )}
            </form>

            {/* ── COLLAPSIBLE: DANH SÁCH TÀI KHOẢN CÔNG VỤ ── */}
            <div className="mt-4 pt-3 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => setShowAccountsDrawer(!showAccountsDrawer)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-blue-700 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Danh sách tài khoản công vụ (8 chức danh)
                </span>
                {showAccountsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <AnimatePresence>
                {showAccountsDrawer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-2"
                  >
                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 max-h-48 overflow-y-auto text-xs">
                      <p className="text-[11px] text-slate-500 px-1 pb-1 font-medium border-b border-slate-200">
                        Nhấp để tự động điền thông tin (Mật khẩu: <strong className="text-slate-800">khmsw101@</strong>):
                      </p>
                      {OFFICIAL_ACCOUNTS.map((acc) => (
                        <div
                          key={acc.username}
                          className="flex items-center justify-between p-1.5 bg-white hover:bg-blue-50/70 border border-slate-200/70 rounded-xl transition-all group"
                        >
                          <div
                            onClick={() => handleSelectAccount(acc)}
                            className="flex-1 cursor-pointer pr-2"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-[11px]">{acc.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${acc.badge}`}>
                                {acc.roleName}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {acc.username} • {acc.email}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleQuickLogin(e, acc)}
                            title="Đăng nhập trực tiếp vai trò này"
                            className="px-2 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0"
                          >
                            <UserCheck className="w-3 h-3" />
                            Vào ngay
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-6 pt-3 border-t border-slate-100 text-center space-y-0.5">
            <p className="text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-blue-600" />
              Ủy ban nhân dân Cấp Xã
            </p>
            <p className="text-[11px] text-slate-400">
              © 2026 Bản quyền thuộc UBND Cấp Xã • KHM Software
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── MODAL KHÔI PHỤC MẬT KHẨU (GỬI EMAIL THẬT / XÁC THỰC 2 BƯỚC) ── */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setShowForgotModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              {/* Header Modal */}
              <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">Khôi Phục Mật Khẩu</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                          Bước {forgotStep}/2
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {forgotStep === 1
                          ? 'Xác minh danh tính qua mã bảo mật 6 số'
                          : 'Thiết lập mật khẩu mới đạt chuẩn bảo mật'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-300"
                    style={{ width: forgotStep === 1 ? '50%' : '100%' }}
                  />
                </div>
              </div>

              {/* Body Modal */}
              <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Alerts */}
                {forgotError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="font-medium">{forgotError}</span>
                  </motion.div>
                )}
                {forgotSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="font-medium">{forgotSuccess}</span>
                  </motion.div>
                )}

                {/* ── BƯỚC 1: XÁC THỰC DANH TÍNH & MÃ OTP 6 SỐ ── */}
                {forgotStep === 1 && (
                  <form onSubmit={handleVerifyStep1Submit} className="space-y-4">
                    {/* Method Switcher */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Phương thức xác thực
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => {
                            setForgotMethod('email');
                            setForgotError('');
                            setForgotSuccess('');
                          }}
                          className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            forgotMethod === 'email'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Mã OTP Qua Email
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotMethod('mfa');
                            setForgotError('');
                            setForgotSuccess('');
                          }}
                          className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            forgotMethod === 'mfa'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Mã 2 Bước Authenticator
                        </button>
                      </div>
                    </div>

                    {/* Email Field */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email công vụ đã đăng ký <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="canbo@ubnd.gov.vn"
                            required
                            disabled={forgotSubmitting}
                            className="pl-9"
                          />
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                        </div>
                        {forgotMethod === 'email' && (
                          <button
                            type="button"
                            onClick={handleSendForgotOtp}
                            disabled={forgotSubmitting || otpCountdown > 0 || !forgotEmail.trim()}
                            className="px-3.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            {forgotSubmitting ? (
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            {otpCountdown > 0 ? `${otpCountdown}s` : otpSent ? 'Gửi lại mã' : 'Gửi mã OTP'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Cloudflare Turnstile Widget (Chống Bot) */}
                    <div className="flex justify-center py-1">
                      <TurnstileWidget
                        resetKey={forgotTurnstileResetKey}
                        onToken={setForgotTurnstileToken}
                      />
                    </div>

                    {/* Khung nhập 6 số xác thực bằng OtpInput */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          {forgotMethod === 'email'
                            ? 'Mã xác thực OTP (6 chữ số gửi về email)'
                            : 'Mã xác thực 2 bước (6 chữ số từ Authenticator)'}
                          <span className="text-rose-500 ml-0.5">*</span>
                        </label>
                        {forgotMethod === 'email' && otpSent && (
                          <span className="text-[11px] text-emerald-600 font-medium">
                            Đã gửi mã thành công
                          </span>
                        )}
                      </div>

                      <OtpInput
                        length={6}
                        value={forgotMethod === 'email' ? forgotOtp : forgotMfaCode}
                        onChange={forgotMethod === 'email' ? setForgotOtp : setForgotMfaCode}
                        autoFocus={forgotMethod === 'mfa' || otpSent}
                        disabled={forgotSubmitting}
                      />

                      <p className="text-[11px] text-slate-500 mt-2 text-center">
                        {forgotMethod === 'email'
                          ? 'Vui lòng kiểm tra hòm thư công vụ và nhập chính xác 6 số.'
                          : 'Nhập mã 6 chữ số đang hiển thị trên ứng dụng Google/Microsoft Authenticator.'}
                      </p>
                    </div>

                    {/* Action Buttons Step 1 */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(false)}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Hủy bỏ
                      </button>
                      <Button
                        type="submit"
                        disabled={
                          forgotSubmitting ||
                          !forgotEmail.trim() ||
                          (forgotMethod === 'email' ? forgotOtp.length !== 6 : forgotMfaCode.length !== 6)
                        }
                        className="flex-1 py-2.5 flex items-center justify-center gap-1.5"
                      >
                        {forgotSubmitting ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            Đang xác thực...
                          </>
                        ) : (
                          <>
                            Tiếp tục sang bước 2
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}

                {/* ── BƯỚC 2: THIẾT LẬP MẬT KHẨU MỚI & KIỂM TRA MẬT KHẨU MẠNH ── */}
                {forgotStep === 2 && (
                  <form onSubmit={handleResetStep2Submit} className="space-y-4">
                    {/* Thông tin tài khoản đã xác thực */}
                    <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-blue-900">Đã xác minh danh tính thành công</p>
                        <p className="text-xs text-blue-700 truncate font-medium">{forgotEmail}</p>
                      </div>
                    </div>

                    {/* Mật khẩu mới */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Mật khẩu mới <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Input
                          type={forgotIsPasswordVisible ? "text" : "password"}
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          placeholder="Nhập mật khẩu mới"
                          required
                          disabled={forgotSubmitting}
                          className="pl-9 pr-9"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                          onClick={() => setForgotIsPasswordVisible(!forgotIsPasswordVisible)}
                        >
                          {forgotIsPasswordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Xác nhận mật khẩu mới */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Xác nhận lại mật khẩu mới <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Input
                          type={forgotIsConfirmVisible ? "text" : "password"}
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới"
                          required
                          disabled={forgotSubmitting}
                          className="pl-9 pr-9"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                          onClick={() => setForgotIsConfirmVisible(!forgotIsConfirmVisible)}
                        >
                          {forgotIsConfirmVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Bảng Checklist Tiêu Chuẩn Bảo Mật Thời Gian Thực */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
                      <p className="text-xs font-bold text-slate-700">Yêu cầu tiêu chuẩn bảo mật mật khẩu:</p>
                      <div className="space-y-1.5">
                        <div className={`flex items-center gap-2 text-xs transition-colors ${
                          pwdMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                            pwdMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span>Độ dài tối thiểu 8 ký tự</span>
                        </div>

                        <div className={`flex items-center gap-2 text-xs transition-colors ${
                          pwdHasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                            pwdHasUpper ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span>Chứa ít nhất 1 chữ cái in hoa (A-Z)</span>
                        </div>

                        <div className={`flex items-center gap-2 text-xs transition-colors ${
                          pwdHasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                            pwdHasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span>Chứa ít nhất 1 chữ số (0-9)</span>
                        </div>

                        <div className={`flex items-center gap-2 text-xs transition-colors ${
                          pwdHasSpecial ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                            pwdHasSpecial ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span>Chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)</span>
                        </div>

                        <div className={`flex items-center gap-2 text-xs transition-colors ${
                          pwdMatch ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                            pwdMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span>Mật khẩu xác nhận trùng khớp</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Step 2 */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotStep(1);
                          setForgotError('');
                          setForgotSuccess('');
                        }}
                        disabled={forgotSubmitting}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Quay lại
                      </button>
                      <Button
                        type="submit"
                        disabled={forgotSubmitting || !isNewPasswordValid}
                        className="flex-1 py-2.5 flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {forgotSubmitting ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            Đang cập nhật...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            Đặt Lại Mật Khẩu
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SignInPage;
