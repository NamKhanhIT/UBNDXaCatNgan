'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { RoleCode, ROLE_HIERARCHY } from '../../services/role-hierarchy.service';
import { AuthUser, getCurrentUser, logoutUser, switchContext } from '../../services/auth.service';
import { Permission, Scope, hasPermission, hasScope, createPermissionChecker } from '../../lib/permissions';

interface AuthContextType {
  user: AuthUser | null;
  activeRole: RoleCode;
  isLoggedIn: boolean;
  isLoading: boolean;
  can: (permission: Permission) => boolean;
  hasDataScope: (scope: Scope) => boolean;
  setSession: (user: AuthUser, role?: RoleCode) => void;
  setActiveRoleContext: (role: RoleCode) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_ROLE_KEY = 'ubnd_active_role';
const LOCAL_STORAGE_USER_KEY = 'ubnd_cached_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeRole, setActiveRole] = useState<RoleCode>('ChuTichUBND');
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
            const role = (serverUser.activeRole as RoleCode) || cachedRole || 'ChuTichUBND';
            if (ROLE_HIERARCHY[role]) {
              setActiveRole(role);
              localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, role);
            }
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(serverUser));
          } else {
            // Phiên làm việc backend không tồn tại hoặc đã hết hạn
            setUser(null);
            setIsLoggedIn(false);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            localStorage.removeItem(LOCAL_STORAGE_ROLE_KEY);
          }
        }
      } catch (err) {
        console.error('Lỗi khi kiểm tra phiên đăng nhập:', err);
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
    const targetRole = role || (newUser.activeRole as RoleCode) || 'ChuTichUBND';
    setUser(newUser);
    setActiveRole(targetRole);
    setIsLoggedIn(true);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newUser));
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, targetRole);
  }, []);

  const setActiveRoleContext = useCallback(async (newRole: RoleCode) => {
    setActiveRole(newRole);
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);

    if (user?.userId) {
      try {
        const res = await switchContext(user.userId, newRole);
        if (res.success && res.user) {
          setUser(res.user);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(res.user));
        }
      } catch (err) {
        console.warn('Switch context API error:', err);
      }
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
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      localStorage.removeItem(LOCAL_STORAGE_ROLE_KEY);
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
