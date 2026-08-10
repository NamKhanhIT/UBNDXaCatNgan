# Technical Design: Rating Revision with Anti-Bias Controls (Sửa Lại Đánh Giá — Có Kiểm Soát Chống Thiên Vị)

**Date:** 2026-08-10  
**Status:** Approved  
**Module:** Work Management & Governance (`Quanlycongviec`)  

---

## 1. Overview & Purpose
Currently, task ratings (`TaskItem.RatingScore`) are single-shot evaluations with no revision mechanism and no history trail. This feature allows task raters and higher-level managers to revise previously submitted ratings while enforcing strict anti-bias controls (Maker-Checker validation, mandatory audit reasons, evidence attachments, and superior approval for significant score changes).

---

## 2. Core Domain Model (`RatingHistory`)

### Entity Schema
- **`Id`**: `Guid` (Primary Key, inheriting `BaseEntity`)
- **`TaskItemId`**: `Guid` (Foreign Key to `TaskItem`)
- **`OldScore`**: `double?` (Score prior to revision, null if initial rating)
- **`NewScore`**: `double` (Proposed new score, range 1.0 – 10.0)
- **`ScoreDelta`**: `double` (`Math.Abs(NewScore - (OldScore ?? NewScore))`)
- **`ChangedByUserId`**: `Guid` (ID of the user submitting the revision)
- **`ChangedAt`**: `DateTime` (UTC timestamp)
- **`Reason`**: `string` (Mandatory, minimum 30 characters)
- **`EvidenceUrl`**: `string` (Mandatory proof file URL / document link)
- **`ApprovalStatus`**: `RatingApprovalStatusEnum` (`Applied`, `PendingApproval`, `ApprovedBySuperior`, `RejectedBySuperior`)
- **`ApprovedByUserId`**: `Guid?` (ID of superior leader approving/rejecting)
- **`ApprovedAt`**: `DateTime?`
- **`RejectionReason`**: `string?` (Mandatory if rejected, minimum 10 characters)

### Immutable Audit Trail Principle
The `RatingHistory` table is **append-only**. No API endpoints are provided to update or soft-delete existing history records.

---

## 3. Anti-Bias Control Rules

### Rule 3.1: Requester Authorization
- **Allowed:** Original assigner (`TaskItem.AssignerId`) OR a user with an equal or higher organizational rank (`RankLevel` ≤ Assigner's `RankLevel`).
- **Blocked:** The ratee (`TaskItem.AssigneeId`) is strictly forbidden from revising their own score (returns HTTP 403 Forbidden).

### Rule 3.2: Maker-Checker Threshold (`ApprovalThreshold`)
- Configured via `appsettings.json` under `RatingRevisionOptions:ApprovalThreshold` (default = `1.0`).
- **If `ScoreDelta` ≤ 1.0:**
  - Status set to `RatingApprovalStatusEnum.Applied`.
  - `TaskItem.RatingScore` is updated immediately.
- **If `ScoreDelta` > 1.0:**
  - Status set to `RatingApprovalStatusEnum.PendingApproval`.
  - `TaskItem.RatingScore` remains **UNCHANGED** at `OldScore`.
  - Requires approval from a superior user (`Approver.RankLevel` < `Proposer.RankLevel` AND `Approver.RankLevel` < `Assigner.RankLevel`).

### Rule 3.3: Transparency for Ratees
- Any user whose `TaskItem.AssigneeId` matches their User ID can view the entire `RatingHistory` timeline (including `PendingApproval` entries).

---

## 4. API Endpoints

1. `POST /api/v1/Tasks/{id}/rating-revision`
   - **Body:** `{ newScore: double, reason: string, evidenceUrl: string }`
   - Submits a new revision proposal.

2. `GET /api/v1/Tasks/{id}/rating-history`
   - Returns the complete history list for a task.

3. `GET /api/v1/RatingHistory/pending`
   - Returns all revisions awaiting superior approval.

4. `POST /api/v1/RatingHistory/{id}/approve`
   - Approves a pending revision and applies `NewScore` to `TaskItem.RatingScore`.

5. `POST /api/v1/RatingHistory/{id}/reject`
   - **Body:** `{ rejectionReason: string }`
   - Rejects a pending revision (requires `rejectionReason` ≥ 10 chars).

---

## 5. UI / UX Design

### Task Detail Drawer Integration
- Displays current rating score with a **"Yêu cầu sửa đánh giá"** button for authorized users.
- Modal opens with:
  - 10-tier score selector.
  - Mandatory reason text area with live character counter (min 30 chars).
  - Mandatory evidence URL input.
  - Live warning banner when `|NewScore - OldScore| > 1.0`.
- Audit history timeline displaying previous scores, deltas, reasons, evidence links, status badges, and approver info.

### Superior Approval Widget
- Displays pending revision requests for leaders with one-click **Approve** or **Reject** (with reason modal).
