# Đặc Tả Kỹ Thuật: Pipeline AI Phân Tích Văn Bản — Phân Loại, Trích Xuất, Gợi Ý Giao Việc, Tạo Tiến Độ

> **Prompt F** — Hệ Thống Quản Lý & Điều Hành UBND Xã Cát Ngạn
> **Phiên bản**: 2 (đã tích hợp bản vá: model mới, cảnh báo chủ quyền dữ liệu, sửa department ID)
> **Trạng thái**: Sẵn sàng chuyển cho AI coding agent

---

## 1. Mục Tiêu Tổng Quan

Xây dựng pipeline AI phân tích văn bản hành chính tự động: từ khi cán bộ tải file lên → AI trích xuất thông tin (tiêu đề, hạn chót, đối tượng, mục tiêu, phân loại) → người dùng kiểm duyệt kết quả AI → hệ thống rẽ nhánh tự động theo loại văn bản (tạo lịch / giao việc / nhận báo cáo) → AI gợi ý phòng ban & người thực hiện dựa trên tải việc + chuyên môn → AI đề xuất checklist tiến độ.

**Nguyên tắc cốt lõi**:
- **Human-in-the-loop**: AI chỉ đề xuất, không bao giờ tự tạo `TaskItem`/`CalendarEvent` chính thức.
- **Chống bịa đặt (Anti-hallucination)**: Mọi field không tìm thấy trong văn bản → trả `null`, không suy diễn.
- **Tự chủ dữ liệu**: Ưu tiên Ollama nội bộ; API bên ngoài là tuỳ chọn, **bị chặn theo mặc định** cho tới khi người có thẩm quyền chủ động xác nhận đã hiểu rủi ro dữ liệu rời khỏi máy chủ nội bộ.
- **Không tin tưởng mù quáng đầu ra AI**: mọi giá trị AI trả về (đặc biệt các ID tham chiếu tới dữ liệu thật như phòng ban) đều phải được validate lại bằng code trước khi lưu, không coi JSON hợp lệ cú pháp là đủ.

---

## 2. Quyết Định Thiết Kế Đã Xác Nhận

| # | Quyết Định | Lựa Chọn |
|---|---|---|
| 1 | AI Provider mặc định | Ollama, model `qwen3.6:35b-a3b` (MoE, ~12GB VRAM — phù hợp phần cứng phổ thông 1 GPU tầm trung; đổi `qwen3.5:4b` nếu chỉ chạy CPU/RAM hạn chế). Implement đầy đủ, test bằng mock/stub vì chưa có server Ollama thật lúc build. |
| 2 | OCR | Tesseract OCR (.NET wrapper `Tesseract` NuGet) + PdfPig cho PDF text + Open XML cho DOCX. **Bắt buộc test với ≥5-10 văn bản scan/photocopy thật** (có dấu mộc, chữ ký đè chữ in) trước khi coi pipeline đủ tin cậy — không chỉ test với PDF có sẵn lớp text. |
| 3 | Mở rộng User entity | Thêm `Expertise` (string tags) + `YearsOfExperience` (int, mặc định 0) + seed DbInitializer. **Lưu ý vận hành**: toàn bộ cán bộ hiện có sẽ có `YearsOfExperience = 0` sau migration → gợi ý giao việc AI ban đầu sẽ chủ yếu dựa vào tải việc, không phản ánh đúng năng lực thật cho tới khi có người nhập tay dữ liệu thật — đưa việc này vào checklist bàn giao sau triển khai. |
| 4 | File upload limits | 20MB mặc định / 50MB max cấu hình, chỉ pdf/doc/docx/jpg/jpeg/png/xlsx |
| 5 | Lưu kết quả AI | Ghi ngay vào `InboxDocument` (`AiReviewedByUserId = null`), trả về frontend |
| 6 | Thông báo SubTask tick | Cả Assigner + Assignee, dùng lại Notification + SignalR + Web Push |
| 7 | Chữ ký số | Chỉ tạo `ISignatureProvider` + `NoOpSignatureProvider`, ghi ADR (quyết định kiến trúc) để làm sau khi có nhà cung cấp thật |
| 8 | **Chủ quyền dữ liệu khi dùng API ngoài** | **Mới**: hệ thống **từ chối khởi động** nếu `AiProvider:Type = ApiCompatible` mà chưa có xác nhận `DataSovereigntyAcknowledged = true` trong cấu hình — xem mục 4.4 và 4.5. |
| 9 | **Gợi ý phòng ban từ AI** | **Mới**: AI chỉ được chọn `SuggestedDepartmentId` trong danh sách phòng ban thật lấy từ database (đưa kèm trong prompt), không tự sinh tên phòng ban mới. Kết quả trả về luôn được validate lại với bảng `Department` trước khi lưu — xem mục 4.3 và 5.2. |
| 10 | Phân giai đoạn | GĐ1 Backend AI → GĐ2 APIs nghiệp vụ → GĐ3 Frontend |

---

## 3. Kiến Trúc Tổng Thể

```
┌────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐       │
│  │ Upload File  │→│ AI Review    │→│ Route Decision        │       │
│  │ Component    │  │ Modal        │  │ (event/assign/review) │       │
│  └─────────────┘  └──────────────┘  └──────────────────────┘       │
└───────────────────────────┬────────────────────────────────────────┘
                            │ REST API
┌───────────────────────────▼────────────────────────────────────────┐
│                     BACKEND (.NET 8 Clean Architecture)             │
│                                                                      │
│  ┌─── Application Layer ──────────────────────────────────────┐     │
│  │                                                              │     │
│  │  IDocumentAiService        IOcrService                       │     │
│  │  ├─ AnalyzeDocumentAsync   ├─ ExtractTextAsync               │     │
│  │  ├─ SuggestAssignment      └─ SupportsImages                 │     │
│  │  └─ SuggestChecklist                                         │     │
│  │                                                              │     │
│  │  ISignatureProvider                                          │     │
│  │  └─ SignDocumentAsync                                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─── Infrastructure Layer ───────────────────────────────────┐     │
│  │                                                              │     │
│  │  OllamaDocumentAiService      ApiCompatibleDocumentAiService │     │
│  │  (localhost:11434/api/chat)    (OpenAI-compatible endpoint,   │     │
│  │                                 chặn nếu chưa xác nhận         │     │
│  │                                 DataSovereigntyAcknowledged)   │     │
│  │                                                              │     │
│  │  TesseractOcrService          PdfTextExtractor                │     │
│  │  (Tesseract.NET + vie lang)   (PdfPig + Open XML)            │     │
│  │                                                              │     │
│  │  NoOpSignatureProvider                                       │     │
│  └──────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. GIAI ĐOẠN 1 — Backend AI + OCR + Domain (Nền Tảng)

### 4.1. Domain: Mở Rộng Entities

#### `InboxDocument.cs` — Thêm Fields AI
```csharp
// ── Kết quả AI phân tích văn bản ──
public string? AiCategory { get; set; }             // DocumentCategory enum → string
public string? AiSummary { get; set; }               // Tóm tắt nội dung
public DateTime? AiExtractedDeadline { get; set; }   // Hạn chót trích xuất
public string? AiExtractedSubjects { get; set; }     // Đối tượng liên quan (JSON array)
public string? AiObjectives { get; set; }            // Mục tiêu/yêu cầu
public Guid? AiSuggestedDepartmentId { get; set; }   // Phòng ban gợi ý — LUÔN là Id thật đã validate, không lưu text tự do
public double? AiConfidenceScore { get; set; }        // Độ tin cậy 0.0 - 1.0
public string? AiTitle { get; set; }                 // Tiêu đề AI trích xuất
public DateTime? AiEventStartDateTime { get; set; }   // Thời gian bắt đầu (nếu là họp/sự kiện)
public DateTime? AiEventEndDateTime { get; set; }     // Thời gian kết thúc

// ── Kiểm duyệt AI ──
public Guid? AiReviewedByUserId { get; set; }         // null = chưa duyệt
public DateTime? AiReviewedAt { get; set; }
public string? AiProcessingStatus { get; set; }       // "Pending" | "Analyzed" | "Reviewed" | "Confirmed"
```

#### `User.cs` — Thêm Chuyên Môn
```csharp
public string? Expertise { get; set; }       // "Đất đai, Quy hoạch, TTHC"
public int YearsOfExperience { get; set; } = 0;
```
> Ghi chú: sau migration, toàn bộ user hiện có sẽ có `YearsOfExperience = 0`. Đưa vào checklist bàn giao: cần cập nhật tay dữ liệu này cho từng cán bộ để tính năng gợi ý giao việc (mục 5.3) phát huy đúng giá trị.

#### Enum `DocumentCategory`
```csharp
public enum DocumentCategory
{
    MeetingInvitation,      // Họp / Thư mời
    SuperiorDirective,      // Chỉ đạo cấp trên
    TaskAssignmentDown,     // Giao việc xuống
    ReportSubmissionUp,     // Báo cáo cấp dưới gửi lên
    Other                   // Loại khác
}
```

### 4.2. Application: Interfaces AI

#### `IDocumentAiService`
```csharp
public interface IDocumentAiService
{
    Task<DocumentAnalysisResult> AnalyzeDocumentAsync(
        string extractedText,
        IEnumerable<DepartmentOption> availableDepartments,
        CancellationToken ct);

    Task<AssignmentSuggestion> SuggestAssignmentAsync(
        string taskDescription,
        IEnumerable<StaffWorkloadSnapshot> candidates,
        CancellationToken ct);

    Task<List<ProgressChecklistItem>> SuggestProgressChecklistAsync(string taskDescription, CancellationToken ct);
}

public class DepartmentOption
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
```
> `AnalyzeDocumentAsync` giờ nhận thêm `availableDepartments` — danh sách phòng ban thật lấy từ database, truyền vào để AI **chỉ được chọn trong danh sách này** khi gợi ý phòng ban (xem mục 4.4, 4.3).

#### `IOcrService`
```csharp
public interface IOcrService
{
    Task<string> ExtractTextAsync(Stream fileStream, string fileExtension, CancellationToken ct);
    bool SupportsFileType(string fileExtension);
}
```

#### `ISignatureProvider`
```csharp
public interface ISignatureProvider
{
    Task<SignatureResult> SignDocumentAsync(Guid documentId, Guid signerUserId, CancellationToken ct);
    bool IsConfigured { get; }
}
```

### 4.3. DTOs & Value Objects

#### `DocumentAnalysisResult`
```csharp
public class DocumentAnalysisResult
{
    public DocumentCategory Category { get; set; }
    public string? Title { get; set; }
    public string? Summary { get; set; }
    public DateTime? DeadlineDate { get; set; }
    public DateTime? EventStartDateTime { get; set; }
    public DateTime? EventEndDateTime { get; set; }
    public List<string> Subjects { get; set; } = new();
    public string? Objectives { get; set; }

    // Cặp Id + Name — KHÔNG dùng string tự do để tránh sai lệch tên↔ID
    public Guid? SuggestedDepartmentId { get; set; }
    public string? SuggestedDepartmentName { get; set; }

    public double Confidence { get; set; }

    // Validation flags
    public bool DeadlineSeemsUnreasonable { get; set; }
    public bool LowConfidence { get; set; }
}
```

#### `StaffWorkloadSnapshot`
```csharp
public class StaffWorkloadSnapshot
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string? Expertise { get; set; }
    public int YearsOfExperience { get; set; }
    public int ActiveTasksCount { get; set; }
    public double WorkloadPercentage { get; set; }
}
```

#### `AssignmentSuggestion`
```csharp
public class AssignmentSuggestion
{
    public Guid SuggestedUserId { get; set; }
    public string SuggestedUserName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public Guid? SuggestedDepartmentId { get; set; }
    public string? SuggestedDepartmentName { get; set; }
    public double Confidence { get; set; }
    public List<AlternativeCandidate> Alternatives { get; set; } = new();
}

public class AlternativeCandidate
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}
```
> Nếu candidate có `Expertise`/`YearsOfExperience` rỗng hoặc bằng 0 (phổ biến ngay sau triển khai — xem mục 2, quyết định #3), `Reason` do AI sinh ra **không được bịa lý do liên quan tới kinh nghiệm/chuyên môn** cho người đó — chỉ được lập luận dựa trên tải việc trong trường hợp này. Ràng buộc này cần đưa vào system prompt của `SuggestAssignmentAsync`.

### 4.4. Infrastructure: AI Providers

#### `OllamaDocumentAiService`
- Gọi `http://localhost:11434/api/chat` (cấu hình qua `AiProvider:Ollama:BaseUrl`)
- Model đọc từ `AiProvider:Ollama:Model` (mặc định `qwen3.6:35b-a3b`)
- Ép JSON output qua `format: "json"` trong request body
- System prompt bắt buộc gồm 2 ràng buộc:
  1. *"Chỉ điền trường nào có bằng chứng trực tiếp trong văn bản. Để null nếu không chắc chắn. Không suy luận, không phỏng đoán."*
  2. *"Với trường phòng ban gợi ý (`suggestedDepartmentId`), CHỈ được chọn 1 Id trong danh sách phòng ban được cung cấp dưới đây. Không tự đặt tên phòng ban mới, không suy diễn Id không có trong danh sách. Để null nếu không xác định được."* — kèm liệt kê `availableDepartments` (Id + Name) ngay trong prompt.

#### `ApiCompatibleDocumentAiService`
- Gọi endpoint tương thích chuẩn OpenAI Chat Completions (`/v1/chat/completions`)
- Đọc `AiProvider:Api:BaseUrl`, `AiProvider:Api:ApiKey`, `AiProvider:Api:Model` từ config
- Dùng `response_format: { type: "json_object" }` để ép JSON
- Cùng 2 ràng buộc system prompt như `OllamaDocumentAiService` ở trên (chống bịa đặt + chỉ chọn department trong danh sách cho trước)
- **Bắt buộc kiểm tra `AiProvider:Api:DataSovereigntyAcknowledged` trước khi service này được đăng ký/sử dụng** — xem chi tiết cơ chế fail-fast ở mục 4.5.

#### `TesseractOcrService`
- NuGet: `Tesseract` (.NET wrapper cho Tesseract OCR engine)
- Language pack tiếng Việt: `vie.traineddata` đặt trong `tessdata/`
- Hỗ trợ: jpg, jpeg, png + PDF scan (chuyển page → image → OCR)
- **Trước khi coi là sẵn sàng dùng chính thức**: test với ≥5-10 văn bản scan/photocopy thật của xã (có dấu mộc đỏ, chữ ký tay đè lên chữ in) — chất lượng OCR với loại tài liệu này thường kém hơn nhiều so với PDF có lớp text sẵn, cần đánh giá thực tế trước khi tin tưởng.

#### `PdfTextExtractorService` (thêm vào `IOcrService` implementation chính)
- NuGet: `PdfPig` (extract text layer từ PDF)
- NuGet: `DocumentFormat.OpenXml` (extract từ DOCX)

#### Đăng ký DI + Fail-fast chủ quyền dữ liệu

Trong `Program.cs`/module DI của Infrastructure:

```csharp
var aiProviderType = configuration["AiProvider:Type"];

if (aiProviderType == "ApiCompatible")
{
    var acknowledged = configuration.GetValue<bool>("AiProvider:Api:DataSovereigntyAcknowledged");
    if (!acknowledged)
    {
        throw new InvalidOperationException(
            "Bạn đang cấu hình gửi nội dung văn bản hành chính ra ngoài máy chủ nội bộ tới nhà " +
            "cung cấp AI bên thứ ba (AiProvider:Api:BaseUrl). Đây là quyết định chính sách dữ liệu, " +
            "không phải quyết định kỹ thuật — cần được người có thẩm quyền của xã xác nhận. Nếu đã " +
            "hiểu rõ và đồng ý, đặt AiProvider:Api:DataSovereigntyAcknowledged = true trong cấu hình.");
    }
}
```
Đăng ký service tương ứng (`OllamaDocumentAiService` hoặc `ApiCompatibleDocumentAiService`) chỉ sau khi qua được kiểm tra trên — lỗi này phải làm ứng dụng **dừng khởi động hẳn**, không chỉ log cảnh báo rồi chạy tiếp.

Nếu về sau có màn hình Cài đặt cho phép đổi provider ngay trên giao diện (chưa có ở bản này): khi làm UI đó, phải hiện banner cảnh báo tương đương, yêu cầu tick xác nhận đã đọc trước khi cho lưu — ghi lại thành việc cần làm khi bổ sung UI đổi provider.

### 4.5. Configuration (`appsettings.json`)

```json
{
  "AiProvider": {
    "Type": "Ollama",
    "ConfidenceThreshold": 0.6,
    "Ollama": {
      "BaseUrl": "http://localhost:11434",
      "Model": "qwen3.6:35b-a3b"
    },
    "Api": {
      "BaseUrl": "",
      "ApiKey": "",
      "Model": "",
      "DataSovereigntyAcknowledged": false
    }
  },
  "FileUpload": {
    "MaxFileSizeMB": 20,
    "AllowedExtensions": "pdf,doc,docx,jpg,jpeg,png,xlsx"
  }
}
```

---

## 5. GIAI ĐOẠN 2 — APIs Luồng Nghiệp Vụ Rẽ Nhánh

### 5.1. Sửa `FilesController`
1. **Xóa `CreateDemoPdfBuffer`** và toàn bộ fallback file giả → trả `404` khi file vật lý không tồn tại.
2. **Thêm validation**: dung lượng ≤ 20MB, extension trong whitelist.
3. **Endpoint mới**: `POST /api/v1/Files/upload-and-analyze`
   - Nhận file → lưu vào đĩa → OCR/extract text → lấy danh sách `Department` thật từ database → gọi `IDocumentAiService.AnalyzeDocumentAsync(text, departments, ct)`
   - **Validate `SuggestedDepartmentId` trả về**: nếu không khớp bất kỳ `Department.Id` thật nào → set về `null`, ghi log cảnh báo (không throw lỗi làm hỏng cả luồng, chỉ bỏ trường này)
   - Ghi kết quả AI vào `InboxDocument` (status = "Analyzed", `AiReviewedByUserId = null`)
   - Trả về `DocumentAnalysisResult` cho frontend kiểm duyệt

### 5.2. API Xác Nhận Sau Kiểm Duyệt
`POST /api/v1/Inbox/{id}/confirm-classification`
- Body: các field AI đã sửa lại bởi người dùng + `route` (event / assign / review)
- Ghi `AiReviewedByUserId` + `AiReviewedAt`
- Rẽ nhánh:
  - `route: 'event'` → Tạo `CalendarEvent` draft từ dữ liệu AI đã duyệt
  - `route: 'assign'` → Chuyển sang bước gợi ý giao việc (5.3)
  - `route: 'review'` → Gắn với luồng nghiệm thu/đánh giá đã có

### 5.3. API Gợi Ý Giao Việc
`POST /api/v1/Inbox/{id}/suggest-assignment`
- Lấy danh sách cán bộ + tải việc thực tế + `Expertise` + `YearsOfExperience`
- Gọi `IDocumentAiService.SuggestAssignmentAsync`
- Trả về gợi ý kèm lý do bằng lời (đúng ràng buộc ở mục 4.3: không bịa lý do kinh nghiệm nếu dữ liệu candidate rỗng)

### 5.4. API Tạo Tiến Độ Tự Động (Checklist)
Khi `route: 'assign'` được xác nhận + `TaskItem` chính thức được tạo:
- Gọi `IDocumentAiService.SuggestProgressChecklistAsync`
- Tạo `SubTask` entities gắn với `TaskItem`
- Cập nhật `TaskItem.ProgressPercentage` = 0%

### 5.5. Tick SubTask → Thông Báo 2 Chiều
Sửa/tạo `ToggleSubTaskCommand`:
- Đếm `SubTask.IsCompleted` → cập nhật `TaskItem.ProgressPercentage`
- Tạo `Notification` cho cả Assigner + Assignee
- Gửi qua SignalR Hub + Web Push (dùng lại service đã có)

---

## 6. GIAI ĐOẠN 3 — Frontend UI

### 6.1. Modal Kiểm Duyệt AI
- Hiển thị kết quả AI: Phân loại, Tiêu đề, Tóm tắt, Hạn chót, Đối tượng, Phòng ban gợi ý (hiện `SuggestedDepartmentName`, không hiện Id thô)
- Highlight đỏ nếu `Confidence < 0.6` hoặc `DeadlineSeemsUnreasonable`
- Cho phép sửa mọi field trước khi xác nhận, bao gồm đổi phòng ban gợi ý (chọn từ dropdown danh sách phòng ban thật, không cho gõ tự do)
- 3 nút route: "Xếp Lịch" / "Giao Việc" / "Nhận Báo Cáo"

### 6.2. Panel Gợi Ý Giao Việc
- Hiển thị AI gợi ý: tên cán bộ + lý do + % tải việc
- Danh sách ứng viên thay thế
- Cho phép chọn người khác thay vì theo gợi ý

### 6.3. Checklist Tiến Độ Tự Sinh
- Sau khi tạo TaskItem → hiển thị danh sách SubTask do AI đề xuất
- Cho phép thêm/bớt/sửa trước khi xác nhận cuối cùng

---

## 7. Kế Hoạch Kiểm Thử

### 7.1. Unit Tests
- AI trả `null` cho field không có trong text mẫu
- `DeadlineDate` trong quá khứ → gắn cờ `DeadlineSeemsUnreasonable`
- `Confidence < 0.6` → gắn cờ `LowConfidence`
- `SuggestedDepartmentId` không khớp `Department` thật trong DB → bị set về `null`, có log cảnh báo, không làm hỏng response
- File >20MB → bị từ chối với lỗi rõ ràng
- File .exe → bị từ chối
- File vật lý bị xóa → trả `404`, không sinh file giả
- **Mới**: `AiProvider:Type = ApiCompatible` + `DataSovereigntyAcknowledged = false` → ứng dụng throw exception lúc khởi động, không start được
- **Mới**: `AiProvider:Type = ApiCompatible` + `DataSovereigntyAcknowledged = true` → khởi động bình thường, `ApiCompatibleDocumentAiService` được đăng ký đúng

### 7.2. Integration Tests (Mock AI)
- Upload PDF có text → OCR thành công → AI mock trả kết quả → lưu InboxDocument
- Confirm classification route='event' → tạo CalendarEvent draft
- Confirm classification route='assign' → gợi ý giao việc → tạo TaskItem + SubTasks
- Toggle SubTask → ProgressPercentage cập nhật → 2 Notifications tạo

### 7.3. Đổi Provider Không Build Lại
- Đổi `AiProvider:Type` từ `Ollama` → `ApiCompatible` (kèm `DataSovereigntyAcknowledged = true`) qua biến môi trường → xác nhận inject đúng service, không cần build lại code

### 7.4. Kiểm thử thủ công bắt buộc trước khi bàn giao
- Test OCR với ≥5-10 văn bản scan/photocopy thật (mục 2, quyết định #2) — ghi lại tỷ lệ đọc đúng thực tế để người dùng biết mức độ tin cậy hiện tại.
- Test với ≥3 loại văn bản khác nhau (thư mời họp, văn bản giao việc, báo cáo cấp dưới gửi lên) — xác nhận rẽ đúng nhánh, không bịa dữ liệu ngoài văn bản gốc.
- Pull thử model `qwen3.6:35b-a3b` qua Ollama trên phần cứng thật của xã, đo thời gian phân tích 1 văn bản trung bình — báo lại con số thật để người dùng biết trải nghiệm thực tế (không chỉ tin số liệu benchmark).

---

## GHI CHÚ VẬN HÀNH (đưa vào README bàn giao)

- OCR bằng Tesseract có thể đọc sai nhiều hơn với văn bản có dấu mộc đỏ/chữ ký tay đè lên chữ in — đã yêu cầu test thật ở mục 7.4, nhắc lại ở đây để không bỏ sót khi bàn giao.
- `User.YearsOfExperience` mặc định = 0 cho toàn bộ cán bộ hiện có sau migration — cần nhập tay dữ liệu `Expertise`/`YearsOfExperience` thật cho từng cán bộ ngay sau triển khai để tính năng gợi ý giao việc phát huy đúng giá trị, không phải chờ lỗi rồi mới sửa.
- Model Ollama khuyến nghị (`qwen3.6:35b-a3b`) đúng tại thời điểm viết tài liệu này (8/2026) — công nghệ mô hình mở thay đổi nhanh, nên kiểm tra lại lựa chọn model phù hợp phần cứng thực tế trước khi triển khai chính thức, không coi đây là lựa chọn cố định vĩnh viễn.
- Nếu sau này quyết định bật `ApiCompatible` (gọi AI ngoài): đây là quyết định chính sách cần người có thẩm quyền của xã xác nhận, không phải việc kỹ thuật viên tự bật — cơ chế fail-fast ở mục 4.4 đảm bảo không ai vô tình bật nhầm.

---

## KHÔNG LÀM TRONG PHẠM VI NÀY

Không tích hợp nhà cung cấp chữ ký số cụ thể (chỉ chuẩn bị interface `ISignatureProvider`), không động vào lịch (đã có prompt riêng), không động vào thang điểm đánh giá (đã có prompt riêng).