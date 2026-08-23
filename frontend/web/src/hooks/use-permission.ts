'use client';

import { useAuth } from '../features/auth/AuthContext';
import { Permission, Scope } from '../lib/permissions';

export function usePermission() {
  const { can, hasDataScope, activeRole, user, isLoggedIn } = useAuth();

  return {
    can,
    hasDataScope,
    activeRole,
    user,
    isLoggedIn,
    canViewExecutiveDashboard: () => can('ViewExecutiveDashboard'),
    canViewDepartmentDashboard: () => can('ViewDepartmentDashboard'),
    canAssignTask: () => can('AssignTask'),
    canEvaluateOfficer: () => can('EvaluateOfficer'),
    canManageDepartments: () => can('ManageDepartments'),
    canManageUsers: () => can('ManageUsers'),
    canApproveDocument: () => can('ApproveDocument'),
  };
}
