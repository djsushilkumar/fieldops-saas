# FieldOps — Design Tokens Specification

---

## 1. Token Architecture

FieldOps uses a three-tier design token architecture:
1. **Global / Primitive Tokens**: Raw hex values, scales, and dimensional units.
2. **Semantic Tokens**: Contextual abstraction layer (e.g., `--color-primary`, `--color-surface-elevated`) that powers light and dark themes.
3. **Component Tokens**: Scoped component bindings referencing semantic tokens.

> [!IMPORTANT]
> All UI components must consume **Semantic Tokens**. Never hardcode raw hex values or component-specific names (e.g., use `--color-primary`, NOT `--blue-500-button`).

---

## 2. Semantic Color Palette

### 2.1. Light Theme (Default Core)

| Token Name | Hex Value | Purpose & Usage |
| :--- | :--- | :--- |
| `--color-primary` | `#0F172A` | Core brand identity, primary navigation headers, dominant buttons |
| `--color-primary-foreground` | `#FFFFFF` | Text and icons placed on top of `--color-primary` |
| `--color-secondary` | `#F1F5F9` | Secondary interactive elements, quiet buttons, pill backgrounds |
| `--color-secondary-foreground` | `#1E293B` | Text and icons placed on top of `--color-secondary` |
| `--color-accent` | `#D97706` | High-visibility action calls ("Clock In", "Check In"), primary alerts |
| `--color-accent-foreground` | `#FFFFFF` | Text and icons placed on top of `--color-accent` |
| `--color-background` | `#F8FAFC` | Application background canvas, page backdrop |
| `--color-surface` | `#FFFFFF` | Card containers, table rows, modal content areas |
| `--color-surface-elevated` | `#FFFFFF` | Flyouts, dropdown menus, floating action bars, popovers |
| `--color-border` | `#E2E8F0` | Structural dividers, card borders, subtle grid separators |
| `--color-border-strong` | `#CBD5E1` | Input field borders, high-contrast container edges |
| `--color-text` | `#0F172A` | Primary typography, high-contrast headings, main table data |
| `--color-text-muted` | `#64748B` | Secondary copy, timestamps, metadata labels, helper text |
| `--color-text-inverted` | `#F8FAFC` | Typography on dark or inverted surfaces |
| `--color-success` | `#059669` | Valid geofence check-ins, completed tasks, active shift status |
| `--color-success-foreground`| `#FFFFFF` | Text/icons on success surfaces |
| `--color-success-subtle` | `#ECFDF5` | Soft background for success badges and alerts |
| `--color-warning` | `#D97706` | Geofence exceptions, approaching deadlines, pending items |
| `--color-warning-foreground`| `#FFFFFF` | Text/icons on warning surfaces |
| `--color-warning-subtle` | `#FFFBEB` | Soft background for warning alerts and exception badges |
| `--color-error` | `#DC2626` | Blocked tasks, overdue visits, failed sync alerts, auth errors |
| `--color-error-foreground` | `#FFFFFF` | Text/icons on error surfaces |
| `--color-error-subtle` | `#FEF2F2` | Soft background for error cards and critical banners |
| `--color-info` | `#0284C7` | In-progress tasks, navigation links, neutral informational banners |
| `--color-info-foreground` | `#FFFFFF` | Text/icons on info surfaces |
| `--color-info-subtle` | `#F0F9FF` | Soft background for info badges and tooltips |

### 2.2. Dark Theme (Mobile Night Shift & Dispatch Consoles)

| Token Name | Hex Value | Purpose & Usage |
| :--- | :--- | :--- |
| `--color-primary` | `#F8FAFC` | Inverted primary brand actions |
| `--color-primary-foreground` | `#0F172A` | Text on dark-mode primary buttons |
| `--color-secondary` | `#1E293B` | Subtle card backings, secondary buttons |
| `--color-secondary-foreground` | `#F8FAFC` | Text on secondary elements |
| `--color-accent` | `#F59E0B` | High-visibility vibrant amber for dark mode |
| `--color-accent-foreground` | `#0F172A` | Text on dark-mode accent buttons |
| `--color-background` | `#090D16` | Deep slate page canvas |
| `--color-surface` | `#111827` | Cards, list items, table rows |
| `--color-surface-elevated` | `#1F2937` | Modals, flyouts, floating sheets |
| `--color-border` | `#1E293B` | Low-luminance structural borders |
| `--color-border-strong` | `#334155` | Focused input outlines |
| `--color-text` | `#F8FAFC` | High-contrast body typography |
| `--color-text-muted` | `#94A3B8` | Subdued metadata text |
| `--color-success` | `#10B981` | Emerald status indicators |
| `--color-success-subtle` | `#064E3B` | Soft dark success backing |
| `--color-warning` | `#F59E0B` | Amber exception tags |
| `--color-warning-subtle` | `#78350F` | Soft dark warning backing |
| `--color-error` | `#EF4444` | High-visibility red alarms |
| `--color-error-subtle` | `#7F1D1D` | Soft dark error backing |
| `--color-info` | `#38BDF8` | Cyan-blue informational badges |
| `--color-info-subtle` | `#0C4A6E` | Soft dark info backing |

---

## 3. Dimensional Tokens: Spacing & Layout

FieldOps uses a strict **4px/8px baseline grid**.

| Token | Rem Value | Pixel Value | Typical Application |
| :--- | :--- | :--- | :--- |
| `--space-1` | `0.25rem` | 4px | Micro-spacing, inline icon offsets |
| `--space-2` | `0.5rem` | 8px | Padding within compact badges, tight list item gaps |
| `--space-3` | `0.75rem` | 12px | Compact button padding, input internal vertical padding |
| `--space-4` | `1.0rem` | 16px | Standard card padding, standard grid gutters |
| `--space-6` | `1.5rem` | 24px | Section separation, modal padding |
| `--space-8` | `2.0rem` | 32px | Dashboard module margins, top-level layout gaps |
| `--space-12` | `3.0rem` | 48px | Desktop page headers, full hero blocks |
| `--space-16` | `4.0rem` | 64px | Maximum macro layout separation |

---

## 4. Border Radius Tokens

| Token | CSS Value | Typical Application |
| :--- | :--- | :--- |
| `--radius-sm` | `4px` | Checkboxes, compact status badges, small tags |
| `--radius-md` | `8px` | Form inputs, standard buttons, task cards, alert boxes |
| `--radius-lg` | `12px` | Modals, flyout panels, bottom sheets on mobile |
| `--radius-xl` | `16px` | Large floating cards, photo preview dialogs |
| `--radius-full` | `9999px` | Avatars, rounded pills, circular action buttons |

---

## 5. Elevation & Box Shadow Tokens

| Token | CSS Box Shadow Value | Purpose |
| :--- | :--- | :--- |
| `--shadow-none` | `none` | Flat containers with border delineation |
| `--shadow-sm` | `0 1px 2px 0 rgba(15, 23, 42, 0.05)` | Resting table cards, input fields |
| `--shadow-md` | `0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1)` | Hovered cards, floating quick filters |
| `--shadow-lg` | `0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.1)` | Mobile bottom sheets, navigation flyouts |
| `--shadow-xl` | `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)` | Top-level confirmation modals, dialog alerts |

---

## 6. Z-Index Layering Tokens

| Token | Value | Component Usage |
| :--- | :--- | :--- |
| `--z-base` | `0` | Default document content canvas |
| `--z-sticky` | `100` | Table sticky headers, timeline milestone headers |
| `--z-header` | `200` | Fixed web navigation bar, mobile bottom bar |
| `--z-dropdown` | `300` | Select dropdown menus, date pickers, overflow menus |
| `--z-overlay` | `400` | Dimmed modal backdrop overlay |
| `--z-modal` | `500` | Action dialogs, full-screen mobile signature canvas |
| `--z-toast` | `600` | System alert toasts, network offline banner |
