'use client';

import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import { ExecutiveDashboard } from './ExecutiveDashboard';
import { DepartmentDashboard } from './DepartmentDashboard';
import { StaffDashboard } from './StaffDashboard';

export function DashboardFeature() {
  const { can } = usePermission();

  // 1. Lãnh đạo cấp xã (Chủ tịch, Bí thư, Phó Chủ tịch) -> Executive Dashboard (Decision Support)
  if (can('ViewExecutiveDashboard')) {
    return <ExecutiveDashboard />;
  }

  // 2. Lãnh đạo phòng ban (Trưởng phòng, Phó phòng) -> Department Dashboard (Departmental Management)
  if (can('ViewDepartmentDashboard')) {
    return <DepartmentDashboard />;
  }

  // 3. Chuyên viên / Nhân viên thực thi -> Staff Dashboard (Action Support)
  return <StaffDashboard />;
}
