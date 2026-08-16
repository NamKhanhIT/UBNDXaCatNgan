# Thang Điểm 10 Đánh Giá Thi Đua Cán Bộ, Công Chức

> **Một dòng định nghĩa:** Mô hình lượng hóa kết quả thực hiện nhiệm vụ công vụ trên thang điểm 10.0, kết hợp giữa 3.0 điểm hệ thống tự động ghi nhận và 7.0 điểm thẩm định chất lượng của Lãnh đạo giao việc.

---

## 1. Cơ Chế Phân Bổ Điểm Số

Hệ thống đánh giá gồm 2 cấu phần độc lập, đảm bảo cả tính khách quan của dữ liệu và thẩm quyền chuyên môn của cấp trên:

$$\text{Tổng Điểm Thi Đua} = \text{Điểm Hệ Thống (Max 3.0)} + \text{Điểm Lãnh Đạo (Max 7.0)}$$

### A. Điểm Hệ Thống Tự Động (Tối đa 3.0 điểm)
Được máy tính tính toán tất định 100% không phụ thuộc cảm tính:
1. **Tiêu chí Đúng hạn (Tối đa 1.5 điểm)**:
   - Hoàn thành trước hoặc đúng hạn: `+1.5` điểm.
   - Trễ hạn: Trừ `0.2` điểm cho mỗi ngày trễ (`(CompletedAt - DueDate).TotalDays`). Mức điểm tối thiểu là `0.0`.
2. **Tiêu chí Hoàn thành Checklist (Tối đa 1.0 điểm)**:
   - Điểm tỷ lệ: `(Số mục checklist đã hoàn thành / Tổng số mục checklist) * 1.0`.
3. **Tiêu chí Chất lượng hồ sơ (Tối đa 0.5 điểm)**:
   - Hồ sơ được duyệt ngay lần đầu: `+0.5` điểm.
   - Mỗi lần bị Lãnh đạo trả lại yêu cầu sửa đổi: Trừ `0.25` điểm/lần.

### B. Điểm Lãnh Đạo Thẩm Định (Tối đa 7.0 điểm)
- Do Người có thẩm quyền hoặc Lãnh đạo trực tiếp chấm khi nghiệm thu công việc.
- Đánh giá chất lượng chiều sâu, mức độ chính xác của số liệu, tính khả thi của văn bản tham mưu.

---

## 2. Khung Xếp Loại Thi Đua Cán Bộ

| Khung Điểm Tổng | Danh Hiệu Thi Đua | Màu Sắc / Badge | Tiêu Chuẩn Đạt Được |
|---|---|---|---|
| **$\ge 9.0$ điểm** | **Hoàn thành xuất sắc nhiệm vụ** | `badge-success` (Xanh lá) | Vượt tiến độ, chất lượng xuất sắc, không có sai sót |
| **$7.5 - 8.9$ điểm** | **Hoàn thành tốt nhiệm vụ** | `badge-blue` (Xanh dương) | Đúng tiến độ, chất lượng đạt yêu cầu đầy đủ |
| **$6.0 - 7.4$ điểm** | **Hoàn thành nhiệm vụ** | `badge-warning` (Vàng/Cam) | Đạt mức cơ bản, có sai sót nhỏ đã khắc phục |
| **$4.0 - 5.9$ điểm** | **Cần cải thiện** | `badge-danger` (Cam đậm) | Chậm tiến độ, hồ sơ bị trả lại nhiều lần |
| **$< 4.0$ điểm** | **Không hoàn thành nhiệm vụ** | `badge-urgent` (Đỏ) | Không hoàn thành nhiệm vụ hoặc vi phạm quy định |

---

## 3. Cài Đặt Trong Hệ Thống Mã Nguồn

- **Backend**:
  - Interface: `ISystemScoreCalculator.cs`
  - Implementation: `SystemScoreCalculator.cs`
  - Options: `ScoringOptions.cs` (`MaxSystemScore = 3.0`, `MaxEvaluatorScore = 7.0`, `TotalMaxScore = 10.0`)
- **Frontend**:
  - Service: `report.service.ts`
  - Component: `page.tsx` (Tab `reportSubTab === 'evaluation'`)

---

## Các Trang Wiki Liên Quan

- [Hệ Thống UBND Xã Cát Ngạn](../products/ubnd-xa-cat-ngan-system.md)
- [Quy Chế Maker-Checker Sửa Điểm](quy-che-maker-checker-sua-diem.md)
