# TECHNICAL MEMORY — UBND XÃ CÁT NGẠN WEB APP

## 1. Technical Stack
- **Framework**: Next.js 14 (App Router) + React 18 (Client Components)
- **Styling**: Vanilla CSS (`src/app/globals.css`), CSS Custom Properties design tokens
- **Iconography**: FontAwesome 6 Free (`font-awesome/6.5.1`) via `<Icon name="icon-name" />` component helper
- **Testing**: Automated Playwright sync tests (`scratch/test_hydration.py`) executed via `with_server.py`

## 2. Core Components & State Architecture
- `page.tsx`: Single-page compact dashboard layout
- `activeModule`: State key supporting 5 core modules:
  1. `overview`: Total system KPI overview, urgent tasks table, activity log, daily welcome popup.
  2. `tasks`: Weekly work schedule divided into 3 shifts (Morning 07:30-12:00, Afternoon 13:00-17:00, Evening 17:00-21:00).
  3. `departments`: **Unified HR & Department Module** with sub-tabs:
     - `phongban`: Department Overview Grid (5 commune departments)
     - `canbo`: Staff Profile Cards Grid (Rich staff details, contact, specializations)
     - `taiviec`: Workload Progress Bars (40h/week, overload alerts)
  4. `create-task`: Work assignment form with shift selection, priority, file dropzone, voice simulation, and OCR AI extraction.
  5. `reports`: GRAD staff capacity performance evaluation table.

## 3. UI/UX Rules & Guidelines
- **Light Mode Only**: White/slate backgrounds (`#f8fafc`, `#ffffff`), dark text (`#1e293b`).
- **Zero AI Slop**: Strict anti-slop rules — no purple gradient mesh, no floating glassmorphism, no emojis as icons.
- **Accessibility**: Keyboard navigable (`tabIndex={0}`, `role="button"`), contrast ratios >= 4.5:1.
