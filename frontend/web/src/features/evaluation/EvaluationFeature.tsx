'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import { getGRADReportApi, OfficerGRADScoreDto } from '../../services/report.service';
import { useToast } from '../../components/ui/ToastContext';
import { EvaluateOfficerModal } from './components/EvaluateOfficerModal';
import { EvaluationTimelineModal } from './components/EvaluationTimelineModal';

export function EvaluationFeature() {
  const { activeRole } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  const [officers, setOfficers] = useState<OfficerGRADScoreDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search, Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals
  const [gradingOfficer, setGradingOfficer] = useState<OfficerGRADScoreDto | null>(null);
  const [timelineOfficer, setTimelineOfficer] = useState<OfficerGRADScoreDto | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterGrade]);

  useEffect(() => {
    async function loadGradScores() {
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
    }

    loadGradScores();
  }, [activeRole]);

  // Dashboard Stats Calculations
  const totalOfficers = officers.length;
  const gradeACount = officers.filter(o => (o.finalScore100 || 0) >= 90).length;
  const gradeBCount = officers.filter(o => (o.finalScore100 || 0) >= 75 && (o.finalScore100 || 0) < 90).length;
  const avgScore = totalOfficers > 0 ? (officers.reduce((acc, o) => acc + (o.finalScore100 || 85) / 10, 0) / totalOfficers).toFixed(1) : '8.5';

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
              style={{ paddingLeft: 32, paddingRight: searchQuery ? 30 : 10, fontSize: '0.85rem', height: 36 }}
              placeholder="Tìm theo tên cán bộ, chức vụ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8', fontSize: 13 }} aria-hidden="true" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
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
            onChange={e => setFilterGrade(e.target.value)}
          >
            <option value="all">Tất cả xếp loại</option>
            <option value="A">Loại A (Xuất sắc ≥ 9.0)</option>
            <option value="B">Loại B (Tốt 7.5 - 8.9)</option>
            <option value="C">Loại C (Hoàn thành 6.0 - 7.4)</option>
          </select>

          {(searchQuery.trim() !== '' || filterGrade !== 'all') && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearchQuery('');
                setFilterGrade('all');
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
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-trophy" style={{ color: '#dc2626' }} aria-hidden="true" />
            <span>Bảng Tổng Hợp Đánh Giá Thi Đua & Xếp Loại Công Vụ (GRAD) ({filteredOfficers.length})</span>
          </h2>
          <span className="badge badge-blue" style={{ fontWeight: 700 }}>
            Thang 10: 3.0đ Tự động + 7.0đ Lãnh đạo
          </span>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '22%' }}>Cán bộ, công chức</th>
                  <th scope="col" style={{ width: '20%' }}>Chức danh & Phòng ban</th>
                  <th scope="col" style={{ width: '12%', textAlign: 'center' }}>Số việc HT/Giao</th>
                  <th scope="col" style={{ width: '12%', textAlign: 'center' }}>Điểm TĐ (3.0đ)</th>
                  <th scope="col" style={{ width: '12%', textAlign: 'center' }}>Lãnh đạo (7.0đ)</th>
                  <th scope="col" style={{ width: '11%', textAlign: 'center' }}>Tổng điểm (10đ)</th>
                  <th scope="col" style={{ width: '11%', textAlign: 'center' }}>Xếp loại</th>
                  <th scope="col" style={{ width: '10%', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: '#2563eb', display: 'block', marginBottom: 10 }} aria-hidden="true" />
                      <span style={{ fontWeight: 600 }}>Đang nạp bảng điểm thi đua GRAD từ hệ thống máy chủ...</span>
                    </td>
                  </tr>
                ) : filteredOfficers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      Không tìm thấy cán bộ nào phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  paginatedOfficers.map(officer => {
                    const sysScore = Math.min(3.0, officer.systemAutoScore30 ?? (officer.checklistProgressScore40 ? (officer.checklistProgressScore40 / 40) * 3 : 2.7));
                    const leadScore = Math.min(7.0, officer.leaderEvaluationScore70 ?? (officer.leaderQualityScore60 ? (officer.leaderQualityScore60 / 60) * 7 : 6.2));
                    const totalScore = officer.finalGRADScore != null && officer.finalGRADScore > 0
                      ? Math.min(10.0, officer.finalGRADScore)
                      : officer.finalScore100 != null && officer.finalScore100 > 10
                      ? Math.min(10.0, officer.finalScore100 / 10.0)
                      : Math.min(10.0, sysScore + leadScore);

                    const isExc = totalScore >= 9.0;
                    const isGood = totalScore >= 7.5;
                    const isFair = totalScore >= 6.0;

                    return (
                      <tr key={officer.userId}>
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

                        {/* Số việc hoàn thành/giao (CĂN GIỮA) */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>{officer.completedTasksCount}</span>
                          <span style={{ color: '#64748b' }}>/{officer.totalTasksAssigned}</span>
                        </td>

                        {/* Điểm tự động (CĂN GIỮA) */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: 4, fontSize: '0.82rem' }}>
                            {sysScore.toFixed(1)}/3.0
                          </span>
                        </td>

                        {/* Điểm lãnh đạo (CĂN GIỮA) */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', padding: '3px 8px', borderRadius: 4, fontSize: '0.82rem' }}>
                            {leadScore.toFixed(1)}/7.0
                          </span>
                        </td>

                        {/* Tổng điểm thang 10 (CĂN GIỮA) */}
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

                        {/* Xếp loại thi đua (CĂN GIỮA) */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${isExc ? 'badge-success' : isGood ? 'badge-blue' : isFair ? 'badge-warning' : 'badge-danger'}`}
                            style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                          >
                            {isExc ? 'Loại A' : isGood ? 'Loại B' : isFair ? 'Loại C' : 'Loại D'}
                          </span>
                        </td>

                        {/* Thao tác (CĂN GIỮA) */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              style={{ fontWeight: 700 }}
                              title="Lãnh đạo chấm điểm"
                              onClick={() => setGradingOfficer(officer)}
                            >
                              <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              style={{ color: '#64748b' }}
                              title="Xem lịch sử đánh giá"
                              onClick={() => setTimelineOfficer(officer)}
                            >
                              <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
                            </button>
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
    </div>
  );
}
