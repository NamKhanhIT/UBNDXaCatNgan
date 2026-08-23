'use client';

import React, { useState, useMemo } from 'react';
import { UserDto as PaginatedUserDto } from '../../../services/user.service';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { useToast } from '../../../components/ui/ToastContext';

export interface WorkloadBalancingViewProps {
  users: PaginatedUserDto[];
  onOpenOfficerDrawer?: (user: PaginatedUserDto) => void;
  onUpdateUserWorkload?: (fromUserId: string, toUserId: string, hours: number) => void;
}

export function WorkloadBalancingView({
  users,
  onOpenOfficerDrawer,
  onUpdateUserWorkload,
}: WorkloadBalancingViewProps) {
  const { addToast } = useToast();
  const [selectedUserForTransfer, setSelectedUserForTransfer] = useState<PaginatedUserDto | null>(null);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [transferHours, setTransferHours] = useState<number>(4);
  const [transferNote, setTransferNote] = useState<string>('Điều chuyển cân đối định mức công vụ tuần.');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Search, Filter, Sort & Pagination States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterLoadStatus, setFilterLoadStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'load-desc' | 'load-asc' | 'name' | 'hours-desc'>('load-desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Filter active state & reset handler
  const isFilterActive = searchQuery.trim() !== '' || filterDepartment !== 'all' || filterLoadStatus !== 'all' || sortBy !== 'load-desc';

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterDepartment('all');
    setFilterLoadStatus('all');
    setSortBy('load-desc');
    setCurrentPage(1);
    addToast('Đã xóa bộ lọc', 'Danh sách đã được đặt lại về trạng thái mặc định.', 'info');
  };
  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => {
      if (u.departmentName) set.add(u.departmentName);
    });
    return Array.from(set);
  }, [users]);

  // Statistics calculation (Whole commune)
  const totalOfficers = users.length;
  const overloadedOfficers = users.filter(u => u.isOverloaded || ((u.assignedHours || 0) / (u.maxHours || 40)) > 0.85);
  const optimalOfficers = users.filter(u => {
    const rate = ((u.assignedHours || 0) / (u.maxHours || 40));
    return rate >= 0.6 && rate <= 0.85;
  });
  const availableOfficers = users.filter(u => ((u.assignedHours || 0) / (u.maxHours || 40)) < 0.6);

  const totalAssignedHours = users.reduce((acc, u) => acc + (u.assignedHours || 0), 0);
  const totalCapacityHours = users.reduce((acc, u) => acc + (u.maxHours || 40), 0);
  const overallUtilizationRate = totalCapacityHours > 0 ? (totalAssignedHours / totalCapacityHours) * 100 : 0;

  // Filtered & Sorted list for the table
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.roleName && u.roleName.toLowerCase().includes(q)) ||
        (u.departmentName && u.departmentName.toLowerCase().includes(q));

      // Department filter
      const matchDept = filterDepartment === 'all' || u.departmentName === filterDepartment;

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
      const rateA = ((a.assignedHours || 0) / (a.maxHours || 40)) * 100;
      const rateB = ((b.assignedHours || 0) / (b.maxHours || 40)) * 100;

      if (sortBy === 'load-desc') return rateB - rateA;
      if (sortBy === 'load-asc') return rateA - rateB;
      if (sortBy === 'hours-desc') return (b.assignedHours || 0) - (a.assignedHours || 0);
      if (sortBy === 'name') return a.fullName.localeCompare(b.fullName);
      return 0;
    });
  }, [filteredUsers, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(sortedUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, currentPage, pageSize]);

  const handleOpenTransfer = (user: PaginatedUserDto) => {
    setSelectedUserForTransfer(user);
    const candidate = availableOfficers.find(o => o.id !== user.id) || users.find(o => o.id !== user.id);
    if (candidate) {
      setTargetUserId(candidate.id);
    }
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = () => {
    if (!selectedUserForTransfer || !targetUserId) return;

    if (onUpdateUserWorkload) {
      onUpdateUserWorkload(selectedUserForTransfer.id, targetUserId, transferHours);
    }

    const targetUser = users.find(u => u.id === targetUserId);
    addToast(
      'Điều chuyển nhiệm vụ thành công',
      `Đã điều chuyển ${transferHours}h công việc từ ${selectedUserForTransfer.fullName} sang ${targetUser?.fullName || 'cán bộ tiếp nhận'}.`,
      'success'
    );

    setIsTransferModalOpen(false);
    setSelectedUserForTransfer(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. KPI Summary Cards (GovTech Clean) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {/* Card 1: Tổng Định Mức Toàn Xã */}
        <div className="workload-kpi-card">
          <div className="workload-kpi-header">
            <span className="workload-kpi-label">Tổng Định Mức Toàn Xã</span>
            <div className="workload-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <i className="fa-solid fa-gauge-high" />
            </div>
          </div>
          <div className="workload-kpi-value">
            {overallUtilizationRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
            {totalAssignedHours}h / {totalCapacityHours}h (Định mức 40h/người/tuần)
          </div>
        </div>

        {/* Card 2: Cán Bộ Cần Giảm Tải */}
        <div className="workload-kpi-card" style={{ borderLeft: '3px solid #dc2626' }}>
          <div className="workload-kpi-header">
            <span className="workload-kpi-label" style={{ color: '#dc2626' }}>Cán Bộ Quá Tải (&gt;85%)</span>
            <div className="workload-kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <i className="fa-solid fa-triangle-exclamation" />
            </div>
          </div>
          <div className="workload-kpi-value" style={{ color: '#dc2626' }}>
            {overloadedOfficers.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>cán bộ</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
            Cần điều chuyển bớt nhiệm vụ
          </div>
        </div>

        {/* Card 3: Cán Bộ Tải Tối Ưu */}
        <div className="workload-kpi-card" style={{ borderLeft: '3px solid #2563eb' }}>
          <div className="workload-kpi-header">
            <span className="workload-kpi-label" style={{ color: '#1e40af' }}>Tải Tối Ưu (60-85%)</span>
            <div className="workload-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <i className="fa-solid fa-circle-check" />
            </div>
          </div>
          <div className="workload-kpi-value" style={{ color: '#1e40af' }}>
            {optimalOfficers.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>cán bộ</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
            Hiệu suất công vụ chuẩn hóa
          </div>
        </div>

        {/* Card 4: Cán Bộ Sẵn Sàng Nhận Việc */}
        <div className="workload-kpi-card" style={{ borderLeft: '3px solid #16a34a' }}>
          <div className="workload-kpi-header">
            <span className="workload-kpi-label" style={{ color: '#15803d' }}>Còn Dung Lượng (&lt;60%)</span>
            <div className="workload-kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <i className="fa-solid fa-user-plus" />
            </div>
          </div>
          <div className="workload-kpi-value" style={{ color: '#15803d' }}>
            {availableOfficers.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>cán bộ</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
            Sẵn sàng tiếp nhận nhiệm vụ mới
          </div>
        </div>
      </div>

      {/* ── 2. Search, Filter & Sort Controls Bar ── */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {/* Ô Tìm Kiếm */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="workload-search-input" style={{ fontSize: '0.78rem' }}>
              Tìm kiếm cán bộ:
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8', fontSize: 13 }} />
              <input
                id="workload-search-input"
                type="text"
                className="form-input"
                placeholder="Tìm theo tên, chức danh..."
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

          {/* Lọc Theo Phòng Ban */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="workload-dept-select" style={{ fontSize: '0.78rem' }}>
              Lọc theo Phòng ban:
            </label>
            <select
              id="workload-dept-select"
              className="form-select"
              value={filterDepartment}
              onChange={(e) => {
                setFilterDepartment(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">-- Tất cả phòng ban --</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Lọc Theo Trạng Thái Tải */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="workload-status-select" style={{ fontSize: '0.78rem' }}>
              Lọc theo Mức độ tải:
            </label>
            <select
              id="workload-status-select"
              className="form-select"
              value={filterLoadStatus}
              onChange={(e) => {
                setFilterLoadStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">-- Tất cả mức tải --</option>
              <option value="overloaded">🔴 Quá tải (&gt;85%)</option>
              <option value="optimal">🔵 Tối ưu (60-85%)</option>
              <option value="available">🟢 Còn dung lượng (&lt;60%)</option>
            </select>
          </div>

          {/* Sắp Xếp */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="workload-sort-select" style={{ fontSize: '0.78rem' }}>
              Sắp xếp theo:
            </label>
            <select
              id="workload-sort-select"
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="load-desc">Tỷ lệ tải (Cao → Thấp)</option>
              <option value="load-asc">Tỷ lệ tải (Thấp → Cao)</option>
              <option value="hours-desc">Số giờ giao việc (Nhiều nhất)</option>
              <option value="name">Họ và tên cán bộ (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Nút hủy tất cả các trường tìm kiếm & bộ lọc */}
        {isFilterActive && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Đang áp dụng bộ lọc tùy biến ({filteredUsers.length} / {users.length} cán bộ)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              style={{ color: '#dc2626', fontWeight: 700 }}
            >
              <i className="fa-solid fa-rotate-left" style={{ marginRight: 6 }} />
              Hủy tất cả tìm kiếm & bộ lọc
            </Button>
          </div>
        )}
      </div>

      {/* ── 3. Workload Matrix Table ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-table-cells" style={{ color: '#2563eb' }} />
              <span>Ma Trận Tải Trọng Công Vụ Toàn Xã ({sortedUsers.length} cán bộ)</span>
            </h3>
          </div>
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
                  <th scope="col" style={{ width: '22%' }}>Cán bộ / Vị trí</th>
                  <th scope="col" style={{ width: '20%' }}>Phòng ban</th>
                  <th scope="col" style={{ width: '13%', textAlign: 'center' }}>Số giờ phân bổ</th>
                  <th scope="col" style={{ width: '20%' }}>Phân bổ tải (40h/tuần)</th>
                  <th scope="col" style={{ width: '10%', textAlign: 'center' }}>Trạng thái</th>
                  <th scope="col" style={{ width: '15%', textAlign: 'center' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      Không tìm thấy cán bộ nào phù hợp với điều kiện tìm kiếm/lọc.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map(user => {
                    const assigned = user.assignedHours || 0;
                    const maxH = user.maxHours || 40;
                    const rate = user.utilizationRate ?? Math.min(100, (assigned / maxH) * 100);
                    const isOver = user.isOverloaded || rate > 85;
                    const isOpt = rate >= 60 && rate <= 85;

                    return (
                      <tr key={user.id}>
                        {/* Cán bộ */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: isOver ? '#fef2f2' : '#f1f5f9',
                                color: isOver ? '#dc2626' : '#1e293b',
                                border: isOver ? '1px solid #fecaca' : '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                              }}
                            >
                              {user.fullName.split(' ').pop()?.[0] || 'CB'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{user.fullName}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {user.roleName || 'Chuyên viên'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phòng ban */}
                        <td>
                          <span style={{ fontSize: '0.82rem', color: '#334155' }}>
                            {user.departmentName || 'Văn phòng HĐND & UBND'}
                          </span>
                        </td>

                        {/* Số giờ đã giao */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              color: isOver ? '#dc2626' : isOpt ? '#1e40af' : '#15803d',
                            }}
                          >
                            {assigned}h / {maxH}h
                          </span>
                        </td>

                        {/* Thanh phân bổ tải */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ flex: 1, height: 8 }}>
                              <div
                                className="progress-bar-fill"
                                style={{
                                  width: `${Math.min(100, rate)}%`,
                                  background: isOver ? '#dc2626' : isOpt ? '#2563eb' : '#16a34a',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                width: 44,
                                textAlign: 'right',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: isOver ? '#dc2626' : '#334155',
                              }}
                            >
                              {rate.toFixed(0)}%
                            </span>
                          </div>
                        </td>

                        {/* Trạng thái */}
                        <td style={{ textAlign: 'center' }}>
                          <Badge variant={isOver ? 'danger' : isOpt ? 'info' : 'success'}>
                            {isOver ? 'Quá tải' : isOpt ? 'Tối ưu' : 'Dư tải'}
                          </Badge>
                        </td>

                        {/* Hành động */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                            {isOver ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleOpenTransfer(user)}
                                title="Điều chuyển bớt giờ sang cán bộ khác"
                              >
                                <i className="fa-solid fa-arrows-split-up-and-left" style={{ marginRight: 4 }} />
                                Giảm tải
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenOfficerDrawer && onOpenOfficerDrawer(user)}
                                title="Xem hồ sơ năng lực chi tiết"
                              >
                                <i className="fa-solid fa-id-card" style={{ marginRight: 4 }} />
                                Chi tiết
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
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

      {/* ── 4. Modal Điều Chuyển Nhiệm Vụ ── */}
      {isTransferModalOpen && selectedUserForTransfer && (
        <Modal
          isOpen={isTransferModalOpen}
          title="Điều Chuyển & Cân Bằng Tải Công Vụ"
          onClose={() => setIsTransferModalOpen(false)}
          maxWidth="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" onClick={() => setIsTransferModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button variant="primary" onClick={handleConfirmTransfer}>
                <i className="fa-solid fa-check" style={{ marginRight: 6 }} />
                Xác nhận điều chuyển
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.82rem', color: '#991b1b' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />
              Cán bộ <strong>{selectedUserForTransfer.fullName}</strong> đang được giao <strong>{selectedUserForTransfer.assignedHours}h</strong> (vượt quá định mức chuẩn 40h/tuần).
            </div>

            <div className="form-group">
              <label className="form-label">Chọn cán bộ tiếp nhận chuyển giao:</label>
              <select
                className="form-select"
                value={targetUserId}
                onChange={e => setTargetUserId(e.target.value)}
              >
                {availableOfficers
                  .filter(u => u.id !== selectedUserForTransfer.id)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.roleName || 'Chuyên viên'}) — Đang tải: {u.assignedHours || 0}h / {u.maxHours || 40}h (Còn trống {Math.max(0, (u.maxHours || 40) - (u.assignedHours || 0))}h)
                    </option>
                  ))}
                {optimalOfficers
                  .filter(u => u.id !== selectedUserForTransfer.id)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.roleName || 'Chuyên viên'}) — Đang tải: {u.assignedHours || 0}h / {u.maxHours || 40}h
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Số giờ công vụ điều chuyển (giờ):</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={1}
                  max={Math.min(20, selectedUserForTransfer.assignedHours || 10)}
                  value={transferHours}
                  onChange={e => setTransferHours(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#2563eb', width: 45, textAlign: 'right' }}>
                  {transferHours}h
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Lý do điều chuyển:</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={transferNote}
                onChange={e => setTransferNote(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
