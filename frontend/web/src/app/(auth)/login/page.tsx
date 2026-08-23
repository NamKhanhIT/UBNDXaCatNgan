'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignInPage, Testimonial } from '../../../components/ui/sign-in';
import { AuthProvider, useAuth } from '../../../features/auth/AuthContext';
import { ToastProvider, useToast } from '../../../components/ui/ToastContext';
import { RoleCode, ROLE_HIERARCHY } from '../../../services/role-hierarchy.service';

const sampleTestimonials: Testimonial[] = [
  {
    avatarSrc: '/images/avatar-1.png',
    name: 'Nguyễn Đình Hùng',
    handle: 'Chủ tịch UBND xã Cát Ngạn',
    text: 'Hệ thống đôn đốc công vụ giúp xử lý 100% văn bản chỉ đạo đúng hạn, minh bạch và kịp thời.',
  },
  {
    avatarSrc: '/images/avatar-2.png',
    name: 'Trần Thị Mai',
    handle: 'Trưởng phòng Kinh tế & Địa chính',
    text: 'Bảng phân ca Sáng - Chiều minh bạch, tránh trùng lặp lịch công tác của cán bộ.',
  },
  {
    avatarSrc: '/images/avatar-3.png',
    name: 'Nguyễn Văn Nam',
    handle: 'Chuyên viên Văn phòng',
    text: 'Hệ thống điều hành trực quan, hỗ trợ số hóa và tiếp nhận văn bản chỉ đạo nhanh chóng, chính xác.',
  },
];

function LoginContent() {
  const router = useRouter();
  const { isLoggedIn, setSession } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/dashboard');
    }
  }, [isLoggedIn, router]);

  return (
    <SignInPage
      heroImageSrc="/images/hero-signin.png"
      testimonials={sampleTestimonials}
      onSignIn={(e, role, user) => {
        const targetRole = role || (user?.activeRole as RoleCode) || 'ChuTichUBND';
        if (user) {
          setSession(user, targetRole);
        }
        const roleLabel = ROLE_HIERARCHY[targetRole]?.label || 'Cán bộ';
        addToast('Đăng nhập thành công', `Chào mừng ${roleLabel} đến với Hệ thống Quản lý Công việc Cấp Xã`, 'success');
        router.push('/dashboard');
      }}
      onQuickRoleSelect={(role) => {
        const targetRole = role || 'ChuTichUBND';
        const roleLabel = ROLE_HIERARCHY[targetRole]?.label || 'Cán bộ';
        addToast('Đăng nhập thành công', `Chào mừng ${roleLabel} đến với Hệ thống Quản lý Công việc Cấp Xã`, 'success');
        router.push('/dashboard');
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LoginContent />
      </ToastProvider>
    </AuthProvider>
  );
}
