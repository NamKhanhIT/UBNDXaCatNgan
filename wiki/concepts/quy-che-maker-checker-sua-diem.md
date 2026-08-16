# Quy Chế Kiểm Soát Chéo Sửa Điểm Đánh Giá (Maker-Checker)

> **Một dòng định nghĩa:** Cơ chế kiểm soát 2 cấp độc lập nhằm ngăn chặn việc tùy tiện nâng/hạ điểm đánh giá cán bộ, áp dụng ngưỡng chênh lệch 1.0 điểm kèm minh chứng tệp tin bắt buộc từ máy tính.

---

## 1. Nguyên Tắc Cốt Lõi

1. **Chống Tự Sửa Điểm**: Cán bộ được giao việc (Assignee) tuyệt đối không có quyền tự sửa đổi điểm số của chính mình.
2. **Giải Trình Chi Tiết**: Mọi yêu cầu điều chỉnh điểm bắt buộc phải có nội dung giải trình với độ dài tối thiểu **30 ký tự**.
3. **Minh Chứng Tệp Tin Từ Máy Tính (Local File Attachment)**:
   - Người đề xuất phải chọn tệp biên bản kiểm tra, ảnh chụp thực địa, tài liệu đối chiếu (PDF, Word, Excel, JPG, PNG) từ máy tính / điện thoại.
   - Không yêu cầu nhập đường dẫn URL web.
   - Hệ thống tự động mã hóa Base64 Data URI để lưu trữ và hiển thị trực tiếp cho Lãnh đạo cấp trên xem xét.

---

## 2. Luồng Phân Nhánh Xử Lý (Workflow Decision Tree)

```
              [Người giao việc / Lãnh đạo phòng đề xuất sửa điểm]
                                       │
                                       ▼
                     [Kiểm tra độ lệch |ĐiểmMới - ĐiểmCũ|]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
           Độ lệch ≤ 1.0 điểm                     Độ lệch > 1.0 điểm
                    │                                     │
                    ▼                                     ▼
        [Áp dụng ngay lập tức]                 [Trạng thái: CHỜ CẤP TRÊN DUYỆT]
       (ApprovalStatus = Applied)          (ApprovalStatus = PendingApproval)
                    │                                     │
                    ▼                                     ▼
         [Điểm nhiệm vụ cập nhật]                [Điểm cũ GIỮ NGUYÊN]
                                                          │
                                         ┌────────────────┴────────────────┐
                                         ▼                                 ▼
                             [Lãnh đạo Cấp 1 DUYỆT]             [Lãnh đạo Cấp 1 TỪ CHỐI]
                                         │                                 │
                                         ▼                                 ▼
                             [Điểm mới có hiệu lực]             [Giữ nguyên điểm cũ]
```

---

## 3. Cài Đặt Trong Hệ Thống Mã Nguồn

- **Backend**:
  - Entity: `RatingHistory.cs`
  - Command: `SubmitRatingRevisionCommand.cs`, `ApproveRatingRevisionCommand.cs`, `RejectRatingRevisionCommand.cs`
  - Options: `RatingRevisionOptions.cs` (`ApprovalThreshold = 1.0`, `MinReasonLength = 30`)
- **Frontend**:
  - Service: `rating-history.service.ts`
  - Modals: `showRatingRevisionModal`, `showPendingRatingRevisionsModal` trong `page.tsx`

---

## Các Trang Wiki Liên Quan

- [Thang Điểm 10 Đánh Giá Cán Bộ](thang-diem-10-danh-gia-can-bo.md)
- [Hệ Thống UBND Xã Cát Ngạn](../products/ubnd-xa-cat-ngan-system.md)
