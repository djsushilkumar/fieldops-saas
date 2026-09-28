# FieldOps — Component Design Inventory

---

## 1. Component Architecture Overview

FieldOps UI components are architected as accessible, headless, themeable primitives shared conceptually across Web (React / Tailwind) and Mobile (Flutter / React Native). Each component conforms to strict semantic states, keyboard navigation contracts, and WCAG accessibility standards.

---

## 2. Core Primitives

### 2.1. Button (`Button`)
- **Variants**: `Primary` (Slate/Dark), `Accent` (Amber action), `Secondary` (Slate outline/subtle), `Destructive` (Red), `Ghost` (Icon-only or transparent).
- **Sizes**: `Small` (32px height, web tables), `Medium` (40px, standard web), `Large` (48px – 56px, mobile primary action).
- **States**: `Default`, `Hover`, `Pressed / Active`, `Focused` (visible outline ring), `Disabled`, `Loading` (inline spinner replaces or precedes icon, click suppressed).
- **Props**: `variant`, `size`, `isLoading`, `isDisabled`, `leftIcon`, `rightIcon`, `fullWidth`, `aria-label`.

### 2.2. Text Input (`Input`) & Textarea (`Textarea`)
- **Variants**: `Default`, `Filled`, `Monospace` (coordinates/codes).
- **States**: `Default`, `Hover`, `Focused` (2px brand focus ring), `Error` (red border + message), `Disabled`, `ReadOnly`.
- **Props**: `label`, `placeholder`, `helperText`, `errorMessage`, `isInvalid`, `isRequired`, `prefixIcon`, `suffixIcon`, `maxLength`.
- **Accessibility**: Explicit `<label>` binding with `htmlFor` / `aria-describedby` referencing error messages.

### 2.3. Selection Controls (`Select`, `Checkbox`, `Radio`, `Switch`)
- **Select**: Native picker on mobile; custom searchable dropdown on web with keyboard navigation (Arrows, Enter, Escape).
- **Checkbox**: For checklist items; supports `Unchecked`, `Checked`, `Indeterminate`. Minimum 48px touch bounding box on mobile.
- **Switch**: For boolean toggles (e.g. "Require Photo Proof", "Active Employee"). Includes role `switch` and `aria-checked`.

### 2.4. Informational Primitives (`Badge`, `Avatar`, `Tooltip`)
- **Badge**: Semantic variants (`Neutral`, `Success`, `Warning`, `Error`, `Info`). Supports pill shape, uppercase tracking, and optional dot indicator.
- **Avatar**: Renders user profile photo with fallback to 2-letter initials and role indicator badge.
- **Tooltip**: Desktop hover / keyboard focus tooltip; suppresses on mobile touch screens to avoid sticky UI bugs.

---

## 3. Navigation Components

| Component | Target Platform | Variants & Layout | States & Behaviors |
| :--- | :--- | :--- | :--- |
| **Sidebar** | Web Desktop | Collapsible (240px expanded vs 64px icon-rail) | Active item highlight, badge count for exceptions, keyboard navigable. |
| **Bottom Navigation** | Mobile (iOS/Android) | Fixed bottom bar, 5 slots (Home, Tasks, Visits, Activity, Profile) | Active tab tint, unread badge dot, haptic tap feedback, safe-area inset aware. |
| **Header / App Bar** | Web & Mobile | Web: Breadcrumbs, search, notification bell, user menu. Mobile: Back button, title, sync badge. | Sticky on scroll (`z-index: 200`), elevation on scroll. |
| **Tabs** | Web & Mobile | Underline tabs (content switching) or Pill tabs (filtering) | Keyboard switchable (`ArrowLeft` / `ArrowRight`), animated indicator bar. |
| **Breadcrumbs** | Web | Hierarchical path (`Operations / Tasks / TSK-1042`) | Truncates on small viewports; accessible `aria-label="Breadcrumb"`. |

---

## 4. Data Display Components

| Component | Usage & Layout | Key Capabilities & Features |
| :--- | :--- | :--- |
| **Table** | Web management views (Tasks, Workforce, Attendance) | Dense tabular grid, sortable column headers, fixed header on scroll, row selection checkboxes, pagination/virtual scrolling. |
| **Card** | Web overview widgets & Mobile content containers | Bordered container, optional header action, hover elevation. |
| **List / Virtual List** | Mobile task and visit feeds | Virtualized scrolling for 500+ items, pull-to-refresh, swipe-to-action (e.g. quick call client). |
| **Timeline** | Visit schedule & Audit logs | Vertical connecting line with timestamped nodes, status color-coding, expandable payload details. |
| **Status Indicator** | Global presence | Micro-dot or pill reflecting live worker status: `Online` (green), `Offline` (gray), `Exception` (amber). |
| **Empty State** | Zero-data views | Centered illustration/icon, clear explanation ("No visits scheduled for today"), primary CTA button ("Schedule Visit"). |

---

## 5. Operations-Specific Domain Components

### 5.1. Task Card (`TaskCard`)
- **Mobile Variant**: Full-width swipeable card displaying task title, due time, priority pill, checklist completion ratio (`3/5`), and single-tap action button ("Start").
- **Web Kanban Variant**: Compact draggable card for dispatch boards, displaying assignee avatar, customer location, and priority indicator.

### 5.2. Priority Badge (`PriorityBadge`)
- **Levels**:
  - `LOW`: Slate subtle background (`#F1F5F9`), slate text (`#475569`).
  - `MEDIUM`: Sky subtle background (`#F0F9FF`), sky text (`#0284C7`).
  - `HIGH`: Amber subtle background (`#FFFBEB`), amber text (`#D97706`).
  - `URGENT`: Crimson subtle background (`#FEF2F2`), bold crimson text (`#DC2626`) with pulsing alert dot.

### 5.3. Visit Card (`VisitCard`)
- Displays scheduled arrival window (e.g., `09:00 - 11:00 AM`), customer destination name, street address, and direct "Navigate" button (external map launcher).
- When active, displays distance-to-site counter (e.g., `42m away • Within geofence`).

### 5.4. Attendance Status Card (`AttendanceStatusCard`)
- Primary mobile home card showing: Duty state (`CLOCKED_IN` / `CLOCKED_OUT`), running shift timer (`04:32:15`), GPS accuracy indicator (`±12m`), and primary action button (`Clock Out`).

---

## 6. Feedback & Notification Components

| Component | Scope | Variants & Behavior |
| :--- | :--- | :--- |
| **Toast** | Global Web & Mobile | Transient notification (Success, Info, Warning, Error). Auto-dismisses after 4 seconds; swipeable to dismiss. Positioned top-right on web, bottom-center on mobile. |
| **Alert / Banner** | Page or Container Level | Non-modal alert bar (e.g., "Network Offline: 3 mutations queued"). High contrast with optional inline action button ("Retry"). |
| **Dialog** | Web & Mobile | Centered modal with backdrop blur, trapped focus, Esc key dismiss. Used for complex sub-forms (e.g., Add Team Member). |
| **Confirmation Dialog** | Web & Mobile | High-friction confirmation for destructive or irreversible operations (e.g., "Cancel Visit", "Deactivate Worker", "Delete Location"). Requires explicit text confirmation or distinct colored button. |
| **Loading State** | Container / Element | Skeleton loader placeholder matching table/card layout or centered spinner for full-screen loading. |
| **Error State** | Screen / Module | Screen-level failure fallback with illustration, clear diagnostic message, and "Try Again" button. |
