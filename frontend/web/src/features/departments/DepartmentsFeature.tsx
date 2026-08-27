'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import { getDepartmentsApi, DepartmentDto } from '../../services/task.service';
import { getUsersPaginatedApi, UserDto as PaginatedUserDto } from '../../services/user.service';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { OfficerDetailDrawer } from './components/OfficerDetailDrawer';
import { WorkloadBalancingView } from './components/WorkloadBalancingView';
import { useToast } from '../../components/ui/ToastContext';

// 5 Phòng ban chuyên môn chuẩn theo CSDL & Bối cảnh hành chính UBND Cấp Xã
export function DepartmentsFeature() {
  const { activeRole } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  const [subTab, setSubTab] = useState<'phongban' | 'canbo' | 'taiviec'>('phongban');
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [users, setUsers] = useState<PaginatedUserDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search, Filter, Sort & Pagination in 'canbo' tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterLoadStatus, setFilterLoadStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'load-desc' | 'load-asc' | 'experience'>('name');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Officer Detail Drawer State
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<PaginatedUserDto | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadDeptData() {
      try {
        setIsLoading(true);
        const [deptRes, userRes] = await Promise.all([
          getDepartmentsApi(),
          getUsersPaginatedApi({ page: 1, pageSize: 50 }),
        ]);

        if (deptRes.success && deptRes.data) {
          setDepartments(deptRes.data);
        }
        if (userRes.success && userRes.data?.items) {
          setUsers(userRes.data.items);
        }
      } catch (err) {
        console.warn('Lỗi tải danh mục phòng ban:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDeptData();
  }, [activeRole]);

  // Navigate to staff list filtered by chosen department
  const handleSelectDepartment = (deptName: string) => {
    setFilterDepartment(deptName);
    setSubTab('canbo');
    setCurrentPage(1);
    addToast('Đã chọn phòng ban', `Đang hiển thị danh sách cán bộ thuộc ${deptName}.`, 'info');
  };

  // Handle open drawer
  const handleOpenDrawer = (user: PaginatedUserDto) => {
    setSelectedUserForDrawer(user);
    setIsDrawerOpen(true);
  };

  // Handle profile updated from drawer
  const handleProfileUpdated = (userId: string, updatedData: Partial<PaginatedUserDto>) => {
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...updatedData } : u)));
  };

  // Handle workload transfer update
  const handleUpdateWorkload = (fromUserId: string, toUserId: string, hours: number) => {
    setUsers(prev =>
      prev.map(u => {
        if (u.id === fromUserId) {
          const newAssigned = Math.max(0, (u.assignedHours || 0) - hours);
          const maxH = u.maxHours || 40;
          return {
            ...u,
            assignedHours: newAssigned,
            utilizationRate: Math.min(100, (newAssigned / maxH) * 100),
            isOverloaded: newAssigned > 38,
          };
        }
        if (u.id === toUserId) {
          const newAssigned = (u.assignedHours || 0) + hours;
          const maxH = u.maxHours || 40;
          return {
            ...u,
            assignedHours: newAssigned,
            utilizationRate: Math.min(100, (newAssigned / maxH) * 100),
            isOverloaded: newAssigned > 38,
          };
        }
        return u;
      })
    );
  };

  // Filtered & Sorted staff for Tab 2 (canbo)
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search
      const matchSearch =
        searchQuery.trim() === '' ||
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.roleName && u.roleName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.expertise && u.expertise.toLowerCase().includes(searchQuery.toLowerCase()));

      // Department filter
      const matchDept =
        filterDepartment === 'all' ||
        u.departmentName === filterDepartment ||
        (u.departmentName && u.departmentName.toLowerCase().includes(filterDepartment.toLowerCase())) ||
        (filterDepartment && filterDepartment.toLowerCase().includes(u.departmentName?.toLowerCase() || ''));

      // Load status filter
      const rate = ((u.assignedHours || 0) / (u.maxHours || 40)) * 100;
      let matchLoad = true;
      if (filterLoadStatus === 'overloaded') matchLoad = u.isOverloaded || rate > 85;
      else if (filterLoadStatus === 'optimal') matchLoad = rate >= 60 && rate <= 85;
      else if (filterLoadStatus === 'available') matchLoad = rate < 60;

      return matchSearch && matchDept && matchLoad;
    });
  }, [users, searchQuery, filterDepartment, filterLoadStatus]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      if (sortBy === 'name') return a.fullName.localeCompare(b.fullName);
      if (sortBy === 'load-desc') return (b.assignedHours || 0) - (a.assignedHours || 0);
      if (sortBy === 'load-asc') return (a.assignedHours || 0) - (b.assignedHours || 0);
      if (sortBy === 'experience') return (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0);
      return 0;
    });
  }, [filteredUsers, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(sortedUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, currentPage, pageSize]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Sub-Tab Navigation ── */}
      <div className="dept-sub-tabs" role="tablist" aria-label="Quản lý nhân sự và phòng ban">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'phongban'}
          className={`dept-sub-tab ${subTab === 'phongban' ? 'active' : ''}`}
          onClick={() => setSubTab('phongban')}
        >
          <i className="fa-solid fa-sitemap" style={{ fontSize: 14 }} aria-hidden="true" />
          <span>Cơ Cấu 5 Khối Phòng Ban ({departments.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'canbo'}
          className={`dept-sub-tab ${subTab === 'canbo' ? 'active' : ''}`}
          onClick={() => setSubTab('canbo')}
        >
          <i className="fa-solid fa-id-card" style={{ fontSize: 14 }} aria-hidden="true" />
          <span>Hồ Sơ Cán Bộ Toàn Xã ({users.length})</span>
        </button>

        {can('AssignTask') && (
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'taiviec'}
            className={`dept-sub-tab ${subTab === 'taiviec' ? 'active' : ''}`}
            onClick={() => setSubTab('taiviec')}
          >
            <i className="fa-solid fa-chart-column" style={{ fontSize: 14 }} aria-hidden="true" />
            <span>Tải Công Việc & Cân Bằng</span>
          </button>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SUBTAB 1: CƠ CẤU 5 KHỐI PHÒNG BAN (BẤM VÀO ĐỂ XEM HỒ SƠ)                */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'phongban' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Danh Mục 05 Đơn Vị Chuyên Môn Trực Thuộc UBND Xã
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Bấm vào từng khối phòng ban để mở danh sách hồ sơ cán bộ thuộc đơn vị đó.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterDepartment('all');
                setSubTab('canbo');
              }}
            >
              <i className="fa-solid fa-users" style={{ marginRight: 6 }} />
              Xem toàn bộ cán bộ ({users.length})
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {departments.map(dept => {
              const deptMembers = users.filter(
                u =>
                  u.departmentName?.toLowerCase().includes(dept.name.toLowerCase()) ||
                  dept.name.toLowerCase().includes(u.departmentName?.toLowerCase() || '')
              );
              const totalAssigned = deptMembers.reduce((acc, m) => acc + (m.assignedHours || 0), 0);
              const totalCapacity = deptMembers.length * 40;
              const deptAvgLoad = totalCapacity > 0 ? (totalAssigned / totalCapacity) * 100 : 50;

              return (
                <div
                  key={dept.id}
                  className="dept-card"
                  onClick={() => handleSelectDepartment(dept.name)}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                  title={`Bấm để xem danh sách nhân sự ${dept.name}`}
                >
                  <div>
                    <div className="dept-card-header">
                      <div
                        className="dept-card-icon"
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        <i className="fa-solid fa-building-columns" style={{ fontSize: 18 }} aria-hidden="true" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="dept-card-title" style={{ color: '#0f172a', fontWeight: 800 }}>
                          {dept.name}
                        </div>
                        <div className="dept-card-head" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Mã: <strong style={{ fontFamily: 'monospace' }}>{dept.code}</strong> • {deptMembers.length || dept.memberCount || 4} cán bộ
                        </div>
                      </div>
                    </div>

                    <div style={{ margin: '14px 0 10px 0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>
                      Định mức tải việc hiện tại: <strong>{deptAvgLoad.toFixed(0)}%</strong> ({totalAssigned}h / {totalCapacity || 40}h)
                    </div>

                    {/* Mini progress bar */}
                    <div className="progress-bar" style={{ height: 6, marginBottom: 12 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, deptAvgLoad)}%`,
                          background: deptAvgLoad > 85 ? '#dc2626' : deptAvgLoad > 60 ? '#2563eb' : '#16a34a',
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      paddingTop: 10,
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.76rem', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Xem danh sách cán bộ</span>
                      <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} />
                    </span>
                    <Badge variant="info">
                      {deptMembers.length} Cán bộ
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SUBTAB 2: HỒ SƠ CÁN BỘ TOÀN XÃ (SEARCH, FILTER, SORT, PAGINATION)        */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'canbo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Active Department Filter Banner */}
          {filterDepartment !== 'all' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-filter" style={{ color: '#2563eb', fontSize: 14 }} />
                <span style={{ fontSize: '0.84rem', color: '#1e40af', fontWeight: 600 }}>
                  Đang lọc danh sách cán bộ theo: <strong>{filterDepartment}</strong> ({filteredUsers.length} cán bộ)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterDepartment('all')}
                style={{ color: '#2563eb', fontWeight: 700 }}
              >
                <i className="fa-solid fa-xmark" style={{ marginRight: 4 }} />
                Xem tất cả phòng ban
              </Button>
            </div>
          )}

          {/* Controls Bar */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {/* Search input */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="staff-search-input" style={{ fontSize: '0.78rem' }}>
                  Tìm kiếm cán bộ:
                </label>
                <div style={{ position: 'relative' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8', fontSize: 13 }} />
                  <input
                    id="staff-search-input"
                    type="text"
                    className="form-input"
                    placeholder="Tìm theo tên, email, chức danh..."
                    style={{ paddingLeft: 30, paddingRight: searchQuery ? 30 : 10 }}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setCurrentPage(1);
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      title="Xóa từ khóa tìm kiếm"
                      aria-label="Xóa từ khóa tìm kiếm"
                    >
                      <i className="fa-solid fa-xmark" style={{ fontSize: 13 }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Department filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="dept-filter-select" style={{ fontSize: '0.78rem' }}>
                  Lọc theo Phòng ban:
                </label>
                <select
                  id="dept-filter-select"
                  className="form-select"
                  value={filterDepartment}
                  onChange={(e) => {
                    setFilterDepartment(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">-- Tất cả 5 phòng ban --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Workload status filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="load-filter-select" style={{ fontSize: '0.78rem' }}>
                  Lọc theo Tải việc:
                </label>
                <select
                  id="load-filter-select"
                  className="form-select"
                  value={filterLoadStatus}
                  onChange={(e) => {
                    setFilterLoadStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">-- Tất cả trạng thái --</option>
                  <option value="overloaded">🔴 Quá tải việc (&gt;85%)</option>
                  <option value="optimal">🔵 Tải trọng tối ưu (60-85%)</option>
                  <option value="available">🟢 Còn dung lượng (&lt;60%)</option>
                </select>
              </div>

              {/* Sort by */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sort-by-select" style={{ fontSize: '0.78rem' }}>
                  Sắp xếp theo:
                </label>
                <select
                  id="sort-by-select"
                  className="form-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="name">Họ và tên (A-Z)</option>
                  <option value="load-desc">Tải việc (Cao → Thấp)</option>
                  <option value="load-asc">Tải việc (Thấp → Cao)</option>
                  <option value="experience">Thâm niên công tác</option>
                </select>
              </div>
            </div>

            {/* Nút hủy tất cả bộ lọc & tìm kiếm */}
            {(searchQuery.trim() !== '' || filterDepartment !== 'all' || filterLoadStatus !== 'all' || sortBy !== 'name') && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Đang lọc {filteredUsers.length} / {users.length} cán bộ
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterDepartment('all');
                    setFilterLoadStatus('all');
                    setSortBy('name');
                    setCurrentPage(1);
                    addToast('Đã xóa bộ lọc', 'Danh sách cán bộ đã được đặt lại về trạng thái mặc định.', 'info');
                  }}
                  style={{ color: '#dc2626', fontWeight: 700 }}
                >
                  <i className="fa-solid fa-rotate-left" style={{ marginRight: 6 }} />
                  Hủy tất cả tìm kiếm & bộ lọc
                </Button>
              </div>
            )}
          </div>

          {/* Table of Officers */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-users-viewfinder" style={{ color: '#2563eb' }} />
                <span>Danh Sách Cán Bộ & Năng Lực Chuyên Môn ({sortedUsers.length})</span>
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Hiển thị:</span>
                <select
                  className="form-select"
                  style={{ width: 70, padding: '2px 6px', fontSize: '0.78rem' }}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>

            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '25%' }}>Họ và tên cán bộ</th>
                      <th scope="col" style={{ width: '20%' }}>Email công vụ</th>
                      <th scope="col" style={{ width: '20%' }}>Phòng ban</th>
                      <th scope="col" style={{ width: '12%', textAlign: 'center' }}>Thâm niên</th>
                      <th scope="col" style={{ width: '13%', textAlign: 'center' }}>Tải việc (40h)</th>
                      <th scope="col" style={{ width: '10%', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          Không tìm thấy cán bộ nào phù hợp với điều kiện tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map(u => {
                        const assigned = u.assignedHours || 0;
                        const maxH = u.maxHours || 40;
                        const rate = u.utilizationRate ?? Math.min(100, (assigned / maxH) * 100);
                        const isOver = u.isOverloaded || rate > 85;

                        return (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: '#1e293b',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {u.fullName.split(' ').pop()?.[0] || 'CB'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{u.fullName}</div>
                                  <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                                    {u.roleName || 'Chuyên viên'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 500 }}>
                                {u.email || `${u.username}@ubnd.gov.vn`}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.82rem', color: '#334155' }}>
                                {u.departmentName || 'Văn phòng HĐND & UBND'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.86rem' }}>
                                {u.yearsOfExperience || 5} Năm
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: 800, color: isOver ? '#dc2626' : '#1e40af', fontSize: '0.86rem' }}>
                                {assigned}h / {maxH}h ({rate.toFixed(0)}%)
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenDrawer(u)}
                              >
                                <i className="fa-solid fa-id-card-clip" style={{ marginRight: 4 }} />
                                Chi Tiết
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (Tổng số {sortedUsers.length} cán bộ)
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    >
                      <i className="fa-solid fa-chevron-left" style={{ marginRight: 4 }} />
                      Trước
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <Button
                        key={p}
                        variant={p === currentPage ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    >
                      Sau
                      <i className="fa-solid fa-chevron-right" style={{ marginLeft: 4 }} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SUBTAB 3: TẢI CÔNG VIỆC & CÂN BẰNG NHIỆM VỤ (GOVTECH PRO)                 */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'taiviec' && (
        <WorkloadBalancingView
          users={users}
          onOpenOfficerDrawer={handleOpenDrawer}
          onUpdateUserWorkload={handleUpdateWorkload}
        />
      )}

      {/* ── Slide-Out Officer Detail Drawer ── */}
      <OfficerDetailDrawer
        user={selectedUserForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedUserForDrawer(null);
        }}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}
