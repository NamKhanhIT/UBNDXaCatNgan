'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import {
  getGRADReportApi,
  OfficerGRADScoreDto,
  exportEvaluationExcelApi,
  RatingPeriodType,
} from '../../services/report.service';
import { useToast } from '../../components/ui/ToastContext';
import { EvaluateOfficerModal } from './components/EvaluateOfficerModal';
import { EvaluationTimelineModal } from './components/EvaluationTimelineModal';
import { ViewOfficerDetailModal } from './components/ViewOfficerDetailModal';
import { DeleteOfficerRatingModal } from './components/DeleteOfficerRatingModal';

export function EvaluationFeature() {
  const { activeRole, user } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  const [officers, setOfficers] = useState<OfficerGRADScoreDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search, Filter & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals
  const [gradingOfficer, setGradingOfficer] = useState<OfficerGRADScoreDto | null>(null);
  const [timelineOfficer, setTimelineOfficer] = useState<OfficerGRADScoreDto | null>(null);
  const [detailOfficer, setDetailOfficer] = useState<OfficerGRADScoreDto | null>(null);
  const [deleteOfficer, setDeleteOfficer] = useState<OfficerGRADScoreDto | null>(null);

  // Tab chấm điểm theo period
  const [activePeriodTab, setActivePeriodTab] = useState<RatingPeriodType>('week');

  // Excel export
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setShowExportMenu(false);
    try {
      setIsExporting(true);
      const blob = await exportEvaluationExcelApi(activePeriodTab, undefined, undefined, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DanhGiaThiDua_${activePeriodTab}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast(
        'Xuất báo cáo thành công',
        `Đã tải báo cáo thi đua theo ${activePeriodTab === 'week' ? 'tuần' : activePeriodTab === 'month' ? 'tháng' : activePeriodTab === 'quarter' ? 'quý' : activePeriodTab === 'halfyear' ? '6 tháng' : 'năm'} (${format === 'xlsx' ? 'Excel .xlsx chuẩn' : 'CSV mở được bằng Excel'}).`,
        'success'
      );
    } catch (err: any) {
      addToast('Lỗi xuất báo cáo', err?.message || 'Không thể xuất báo cáo.', 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  const currentUserId = user?.userId ?? '';

  // Load GRAD scores — extracted thành function để có thể reload sau delete/edit
  const loadGradScores = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getGRADReportApi();
      if (res.success && res.data?.officers) {
        setOfficers(res.data.officers);
      }
    } catch (err) {
      console.warn('Lỗi tải bảng điểm GRAD:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterGrade]);

  useEffect(() => {
    loadGradScores();
  }, [activeRole, loadGradScores]);

  // Dashboard Stats Calculations — thống nhất thang 10
  const totalOfficers = officers.length;
  const gradeACount = officers.filter(o => (o.finalScore ?? o.finalGRADScore ?? 0) >= 9.0).length;
  const gradeBCount = officers.filter(o => {
    const s = o.finalScore ?? o.finalGRADScore ?? 0;
    return s >= 7.5 && s < 9.0;
  }).length;
  const avgScore = totalOfficers > 0
    ? (officers.reduce((acc, o) => acc + (o.finalScore ?? o.finalGRADScore ?? 0), 0) / totalOfficers).toFixed(1)
    : '0.0';

  const handleOfficerGraded = (updated: OfficerGRADScoreDto) => {
    setOfficers(prev => prev.map(o => (o.userId === updated.userId ? updated : o)));
  };

  const filteredOfficers = useMemo(() => {
    return officers.filter(o => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        o.fullName.toLowerCase().includes(q) ||
        (o.roleName && o.roleName.toLowerCase().includes(q)) ||
        (o.departmentName && o.departmentName.toLowerCase().includes(q));

      const totalScore = o.finalGRADScore != null && o.finalGRADScore > 0
        ? Math.min(10.0, o.finalGRADScore)
        : o.finalScore100 != null && o.finalScore100 > 10
        ? Math.min(10.0, o.finalScore100 / 10.0)
        : 8.0;

      let matchGrade = true;
      if (filterGrade === 'A') matchGrade = totalScore >= 9.0;
      else if (filterGrade === 'B') matchGrade = totalScore >= 7.5 && totalScore < 9.0;
      else if (filterGrade === 'C') matchGrade = totalScore >= 6.0 && totalScore < 7.5;

      return matchSearch && matchGrade;
    });
  }, [officers, searchQuery, filterGrade]);

  const totalPages = Math.max(1, Math.ceil(filteredOfficers.length / pageSize));

  const paginatedOfficers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOfficers.slice(start, start + pageSize);
  }, [filteredOfficers, currentPage, pageSize]);

  // Kiểm tra phân quyền can('EvaluateOfficer')
  if (!can('EvaluateOfficer')) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: '#94a3b8', marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
          Không có quyền truy cập Đánh Giá Công Vụ
        </h2>
        <p style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: 460, margin: '8px auto 0' }}>
          Chức năng đánh giá và xếp hạng công vụ (GRAD) chỉ dành riêng cho Lãnh đạo UBND, Thường trực HĐND và Trưởng phòng chuyên môn.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. KPI DASHBOARD ĐÁNH GIÁ THI ĐUA LÃNH ĐẠO ── */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="kpi-label">Tổng Số Cán Bộ Đánh Giá</div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{totalOfficers}</div>
          <div className="kpi-hint">Toàn thể cán bộ, công chức xã</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="kpi-label">Điểm Trung Bình Toàn Xã</div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{avgScore}/10.0</div>
          <div className="kpi-hint">Đạt chuẩn xếp loại Tốt trở lên</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="kpi-label">Hoàn Thành Xuất Sắc (Loại A)</div>
          <div className="kpi-value" style={{ color: '#7c3aed' }}>{gradeACount}</div>
          <div className="kpi-hint">Điểm tổng kết ≥ 9.0 điểm</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="kpi-label">Hoàn Thành Tốt (Loại B)</div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{gradeBCount}</div>
          <div className="kpi-hint">Điểm tổng kết từ 7.5 - 8.9 điểm</div>
        </div>
      </div>

      {/* ── 2. ALERT GIẢI THÍCH THANG ĐIỂM 10 ── */}
      <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <i className="fa-solid fa-award" style={{ fontSize: 22, color: '#2563eb' }} aria-hidden="true" />
        <div style={{ fontSize: '0.86rem', lineHeight: 1.5 }}>
          Đánh giá thi đua cán bộ UBND Cấp Xã theo <strong>Thang điểm 10</strong>: Điểm hệ thống ghi nhận tự động theo tiến độ (tối đa <strong>3.0 điểm</strong>) kết hợp Điểm thẩm định chất lượng của Lãnh đạo (tối đa <strong>7.0 điểm</strong>).
        </div>
      </div>

      {/* ── 3. SEARCH & FILTER CONTROLS ── */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 340 }}>
            <input
              className="form-input"
              style={{ paddingLeft: 32, paddingRight: searchInput ? 30 : 10, fontSize: '0.85rem', height: 36 }}
              placeholder="Tìm theo tên cán bộ, chức vụ..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setSearchQuery(searchInput);
                  setCurrentPage(1);
                }
              }}
            />
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8', fontSize: 13 }} aria-hidden="true" />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
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

          <select
            className="form-select"
            style={{ width: 'auto', fontSize: '0.82rem', height: 36 }}
            value={filterGrade}
            onChange={e => {
              setFilterGrade(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Tất cả xếp loại</option>
            <option value="A">Loại A (Xuất sắc ≥ 9.0)</option>
            <option value="B">Loại B (Tốt 7.5 - 8.9)</option>
            <option value="C">Loại C (Hoàn thành 6.0 - 7.4)</option>
          </select>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={searchInput === searchQuery}
            onClick={() => {
              setSearchQuery(searchInput);
              setCurrentPage(1);
            }}
            style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            title="Áp dụng từ khóa tìm kiếm"
          >
            <i className="fa-solid fa-check" />
            <span>Xác nhận tìm kiếm</span>
          </button>

          {(searchQuery.trim() !== '' || filterGrade !== 'all') && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
                setFilterGrade('all');
                setCurrentPage(1);
                addToast('Đã xóa bộ lọc', 'Bảng điểm thi đua đã được đặt lại về trạng thái mặc định.', 'info');
              }}
              style={{ color: '#dc2626', fontWeight: 700, height: 36, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <i className="fa-solid fa-rotate-left" />
              <span>Hủy bộ lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 4. BẢNG ĐÁNH GIÁ CÔNG VỤ (CĂN GIỮA CỘT SỐ 100%) ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-trophy" style={{ color: '#dc2626' }} aria-hidden="true" />
            <span>Bảng Tổng Hợp Đánh Giá Thi Đua & Xếp Loại Công Vụ ({filteredOfficers.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Tabs period — chấm tuần/tháng/quý/6tháng/năm */}
            <div style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
              {(['week', 'month', 'quarter', 'halfyear', 'year'] as RatingPeriodType[]).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`btn btn-sm ${activePeriodTab === p ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActivePeriodTab(p)}
                  style={{ borderRadius: 0, height: 32, fontSize: '0.78rem', fontWeight: 600 }}
                >
                  {p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : p === 'quarter' ? 'Quý' : p === 'halfyear' ? '6 tháng' : 'Năm'}
                </button>
              ))}
            </div>

            <span className="badge badge-blue" style={{ fontWeight: 700 }}>
              Thang 10: 3.0đ Tự động + 7.0đ Lãnh đạo
            </span>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-success btn-sm"
                disabled={isExporting}
                onClick={() => setShowExportMenu(v => !v)}
                style={{ fontWeight: 700, height: 32 }}
                title="Xuất báo cáo thi đua (chọn định dạng)"
              >
                {isExporting ? (
                  <><i className="fa-solid fa-spinner fa-spin" /> <span>Đang xuất...</span></>
                ) : (
                  <><i className="fa-solid fa-file-export" /> <span>Xuất báo cáo</span> <i className="fa-solid fa-caret-down" style={{ marginLeft: 4 }} /></>
                )}
              </button>
              {showExportMenu && !isExporting && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    minWidth: 240,
                    overflow: 'hidden'
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', padding: '10px 14px', borderRadius: 0, fontWeight: 600 }}
                    onClick={() => handleExport('csv')}
                  >
                    <i className="fa-solid fa-file-csv" style={{ marginRight: 8, color: '#16a34a' }} />
                    <span>CSV (mở được bằng Excel)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', padding: '10px 14px', borderRadius: 0, fontWeight: 600, borderTop: '1px solid #f1f5f9' }}
                    onClick={() => handleExport('xlsx')}
                  >
                    <i className="fa-solid fa-file-excel" style={{ marginRight: 8, color: '#16a34a' }} />
                    <span>Excel .xlsx (chuẩn nhiều sheet)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '8%', textAlign: 'center' }}>STT</th>
                  <th scope="col" style={{ width: '28%' }}>Cán bộ, công chức</th>
                  <th scope="col" style={{ width: '25%' }}>Chức danh & Phòng ban</th>
                  <th scope="col" style={{ width: '14%', textAlign: 'center' }}>Tổng điểm (10đ)</th>
                  <th scope="col" style={{ width: '12%', textAlign: 'center' }}>Xếp loại</th>
                  <th scope="col" style={{ width: '13%', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: '#2563eb', display: 'block', marginBottom: 10 }} aria-hidden="true" />
                      <span style={{ fontWeight: 600 }}>Đang nạp bảng điểm thi đua từ hệ thống máy chủ...</span>
                    </td>
                  </tr>
                ) : filteredOfficers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      Không tìm thấy cán bộ nào phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  paginatedOfficers.map((officer, idx) => {
                    const sysScore = Math.min(3.0, officer.systemScore ?? officer.systemAutoScore30 ?? 2.7);
                    const leadScore = Math.min(7.0, officer.leaderScore ?? officer.leaderEvaluationScore70 ?? 6.2);
                    const totalScore = officer.finalScore != null
                      ? Math.min(10.0, officer.finalScore)
                      : officer.finalScore100 != null && officer.finalScore100 > 10
                      ? Math.min(10.0, officer.finalScore100 / 10.0)
                      : Math.min(10.0, officer.finalGRADScore || sysScore + leadScore);

                    const isExc = totalScore >= 9.0;
                    const isGood = totalScore >= 7.5;
                    const isFair = totalScore >= 6.0;
                    const isSelf = currentUserId !== '' && officer.userId === currentUserId;

                    return (
                      <tr key={officer.userId}>
                        {/* STT */}
                        <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>

                        {/* Cán bộ */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#eff6ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                color: '#2563eb',
                                flexShrink: 0,
                              }}
                            >
                              {officer.fullName.split(' ').pop()?.[0] || 'CB'}
                            </div>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{officer.fullName}</span>
                          </div>
                        </td>

                        {/* Chức vụ & Phòng ban */}
                        <td>
                          <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.84rem' }}>{officer.roleName || 'Cán bộ'}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{officer.departmentName}</div>
                        </td>

                        {/* Tổng điểm thang 10 */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.94rem',
                              color: isExc ? '#166534' : isGood ? '#1e40af' : '#1e293b',
                              background: isExc ? '#f0fdf4' : isGood ? '#eff6ff' : '#f8fafc',
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: isExc ? '1px solid #bbf7d0' : isGood ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            }}
                          >
                            {totalScore.toFixed(1)}/10.0
                          </span>
                        </td>

                        {/* Xếp loại thi đua */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${isExc ? 'badge-success' : isGood ? 'badge-blue' : isFair ? 'badge-warning' : 'badge-danger'}`}
                            style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                          >
                            {isExc ? 'Loại A' : isGood ? 'Loại B' : isFair ? 'Loại C' : 'Loại D'}
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              style={{ fontWeight: 700, color: '#0ea5e9', borderColor: '#0ea5e9' }}
                              title="Xem chi tiết"
                              onClick={() => setDetailOfficer(officer)}
                            >
                              <i className="fa-solid fa-eye" aria-hidden="true" />
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                style={{ fontWeight: 700 }}
                                title="Lãnh đạo chấm điểm"
                                onClick={() => setGradingOfficer(officer)}
                              >
                                <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              style={{ color: '#64748b' }}
                              title="Xem lịch sử đánh giá"
                              onClick={() => setTimelineOfficer(officer)}
                            >
                              <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{ color: '#dc2626' }}
                                title="Xóa điểm (chỉ lãnh đạo cấp cao)"
                                onClick={() => setDeleteOfficer(officer)}
                              >
                                <i className="fa-solid fa-trash" aria-hidden="true" />
                              </button>
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

          {/* ── Phân trang Evaluation ── */}
          {filteredOfficers.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: '1px solid #e2e8f0',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.82rem', color: '#64748b' }}>
                <span>
                  Hiển thị <strong>{(currentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(currentPage * pageSize, filteredOfficers.length)}</strong> trong tổng số <strong>{filteredOfficers.length}</strong> cán bộ
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Số dòng:</span>
                  <select
                    className="form-select"
                    style={{ width: 'auto', padding: '2px 8px', height: 30, fontSize: '0.8rem' }}
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={5}>5 / trang</option>
                    <option value={10}>10 / trang</option>
                    <option value={20}>20 / trang</option>
                    <option value={50}>50 / trang</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{ height: 32, padding: '0 10px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    <i className="fa-solid fa-chevron-left" style={{ marginRight: 4 }} />
                    Trước
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setCurrentPage(p)}
                      style={{ height: 32, minWidth: 32, padding: '0 8px', fontSize: '0.8rem', fontWeight: p === currentPage ? 800 : 600 }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    style={{ height: 32, padding: '0 10px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Sau
                    <i className="fa-solid fa-chevron-right" style={{ marginLeft: 4 }} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. EVALUATION MODALS ── */}
      {gradingOfficer && (
        <EvaluateOfficerModal
          officer={gradingOfficer}
          currentUserId={currentUserId}
          onClose={() => setGradingOfficer(null)}
          onGraded={handleOfficerGraded}
        />
      )}

      {timelineOfficer && (
        <EvaluationTimelineModal
          officer={timelineOfficer}
          onClose={() => setTimelineOfficer(null)}
        />
      )}

      {detailOfficer && (
        <ViewOfficerDetailModal
          officer={detailOfficer}
          onClose={() => setDetailOfficer(null)}
        />
      )}

      {deleteOfficer && (
        <DeleteOfficerRatingModal
          officer={deleteOfficer}
          currentUserId={currentUserId}
          evaluationPeriod={activePeriodTab === 'week' ? undefined : '2026-09'}
          onClose={() => setDeleteOfficer(null)}
          onDeleted={(_userId, tasksReset) => {
            addToast('Đã xóa điểm', `Reset ${tasksReset} đầu việc cho cán bộ.`, 'success');
            // Reload data để cập nhật lại bảng
            loadGradScores();
          }}
        />
      )}
    </div>
  );
}
