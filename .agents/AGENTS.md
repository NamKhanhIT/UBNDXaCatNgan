# Workspace Behavioral Guidelines & Rules for UBND Xã Cát Ngạn Project

## ASP.NET Core & PowerShell Integration Guidelines
- Always register `JsonStringEnumConverter` and `PropertyNameCaseInsensitive = true` in `AddControllers().AddJsonOptions()`.
- Use class DTOs with get/set properties for API request bodies.
- When running PowerShell `Invoke-RestMethod` / `Invoke-WebRequest` tests with non-ASCII (Vietnamese) text, always encode string payloads via `[System.Text.Encoding]::UTF8.GetBytes($json)`.
- For cookie-based JWT authentication, configure `JwtBearerEvents.OnMessageReceived` to fallback to reading the `access_token` cookie when the `Authorization` header is not present.

## PostgreSQL & Frontend Synchronization Rules
- All user actions modifying state (e.g., document scheduling, task delegation, status updates) MUST be backed by a CQRS Command API that mutates PostgreSQL tables.
- In `DbInitializer`, check entity existence per table (e.g., `await context.InboxDocuments.AnyAsync()`) rather than relying on a global single entity check to guarantee new seed datasets are populated upon migrations.
- Always ensure `DateTime` values saved to PostgreSQL EF Core have `DateTimeKind.Utc`.

