'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { RoleCode, ROLE_HIERARCHY } from '../../services/role-hierarchy.service';
import { AuthUser, getCurrentUser, logoutUser, switchContext } from '../../services/auth.service';
import { clearSessionStorage, markSessionActive } from '../../services/api.config';
import { Permission, Scope, hasPermission, hasScope, createPermissionChecker } from '../../lib/permissions';

interface AuthContextType {
  user: AuthUser | null;
  activeRole: RoleCode;
  isLoggedIn: boolean;
  isLoading: boolean;
  can: (permission: Permission) => boolean;
  hasDataScope: (scope: Scope) => boolean;
  setSession: (user: AuthUser, role?: RoleCode) => void;
  setActiveRoleContext: (role: RoleCode) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_ROLE_KEY = 'ubnd_active_role';
const LOCAL_STORAGE_USER_KEY = 'ubnd_cached_user';

// BẢO MẬT (Audit M5): Vai trò dự phòng mặc định là vai trò quyền thấp nhất (Chuyên viên)
const SAFE_FALLBACK_ROLE: RoleCode = 'ChuyenVien';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeRole, setActiveRole] = useState<RoleCode>(SAFE_FALLBACK_ROLE);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Khởi tạo và kiểm tra phiên làm việc
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        // Kiểm tra cache local trước để UI mượt mà
        const cachedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as RoleCode | null;
        const cachedUserJson = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        if (cachedRole && ROLE_HIERARCHY[cachedRole]) {
          setActiveRole(cachedRole);
        }
        if (cachedUserJson) {
          try {
            const parsed = JSON.parse(cachedUserJson);
            setUser(parsed);
            setIsLoggedIn(true);
          } catch {
            // ignore invalid cache
          }
        }

        // Đồng bộ với API backend thật
        const serverUser = await getCurrentUser();
        if (isMounted) {
          if (serverUser) {
            setUser(serverUser);
            setIsLoggedIn(true);
            // BẢO MẬT (Audit M5): Fallback an toàn thấp nhất thay vì quyền cao nhất
            const role = (serverUser.activeRole as RoleCode) || cachedRole || SAFE_FALLBACK_ROLE;
            if (ROLE_HIERARCHY[role]) {
              setActiveRole(role);
              localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, role);
            }
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(serverUser));
          } else {
            // BẢO MẬT (Audit Mục 3): Phiên backend không hợp lệ -> dọn sạch toàn bộ session
            setUser(null);
            setIsLoggedIn(false);
            clearSessionStorage();
          }
        }
      } catch (err) {
        // BẢO MẬT (Audit C2): Lỗi mạng/ngoại lệ -> dọn sạch phiên để chống zombie session
        console.error('Lỗi khi kiểm tra phiên đăng nhập:', err);
        if (isMounted) {
          setUser(null);
          setIsLoggedIn(false);
          clearSessionStorage();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const setSession = useCallback((newUser: AuthUser, role?: RoleCode) => {
    // BẢO MẬT (Audit M5): Fallback an toàn thấp nhất khi thiết lập phiên
    const targetRole = role || (newUser.activeRole as RoleCode) || SAFE_FALLBACK_ROLE;
    setUser(newUser);
    setActiveRole(targetRole);
    setIsLoggedIn(true);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newUser));
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, targetRole);
    // BẢO MẬT (Audit H9): Đặt cookie marker cho middleware route protection
    markSessionActive();
  }, []);

  // BẢO MẬT (Audit M5): Đổi ngữ cảnh vai trò (chỉ cập nhật UI sau khi API xác nhận thành công)
  const setActiveRoleContext = useCallback(async (newRole: RoleCode): Promise<boolean> => {
    if (!user?.userId) return false;

    try {
      const res = await switchContext(user.userId, newRole);
      if (!res.success || !res.user) {
        console.warn('Switch context bị từ chối:', res.error);
        return false;
      }

      setUser(res.user);
      setActiveRole(newRole);
      localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(res.user));
      return true;
    } catch (err) {
      console.warn('Switch context API error:', err);
      return false;
    }
  }, [user]);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // ignore
    } finally {
      setUser(null);
      setIsLoggedIn(false);
      // BẢO MẬT (Audit Mục 3): Dọn sạch toàn bộ session storage & cookie marker
      clearSessionStorage();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  const checker = createPermissionChecker(activeRole);

  const can = useCallback((permission: Permission) => {
    return hasPermission(permission, activeRole);
  }, [activeRole]);

  const hasDataScope = useCallback((scope: Scope) => {
    return hasScope(scope, activeRole);
  }, [activeRole]);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        isLoggedIn,
        isLoading,
        can,
        hasDataScope,
        setSession,
        setActiveRoleContext,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
