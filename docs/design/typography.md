# FieldOps — Typography System

---

## 1. Font Family Strategy

Typography in FieldOps must guarantee immediate legibility across diverse conditions: small mobile screens viewed in direct sunlight, low-end mobile devices without webfont downloads, and high-density web dispatch consoles.

### 1.1. Primary Font Stack
FieldOps standardizes on modern, highly legible geometric sans-serif fonts:
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```
- **Web Applications**: Self-hosted `Inter` variable font (WOFF2) with dynamic optical sizing (`opsz`) and tabular numeric variants enabled.
- **Mobile Applications (Android)**: Native `Roboto` / System Sans-Serif or bundled `Inter`.
- **Mobile Applications (iOS)**: Apple system font (`San Francisco` / `SF Pro`).
- **Data & Numeric Displays**: Monospace tabular stack for coordinates, clock-in timers, and timestamps:
```css
font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, Monaco, monospace;
font-feature-settings: 'tnum' on, 'zero' on;
```

---

## 2. Type Scale & Hierarchy

FieldOps utilizes a major-second typographic scale tailored for functional enterprise software.

| Level / Token | Font Size | Line Height | Weight | Letter Spacing | Purpose & Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `--font-display-lg` | 32px (`2.0rem`) | 40px (`1.25`) | Bold (700) | `-0.025em` | Marketing headings, primary login screen title |
| `--font-display-md` | 24px (`1.5rem`) | 32px (`1.33`) | Bold (700) | `-0.02em` | Mobile Home hero title ("Good Morning, Carlos") |
| `--font-heading-lg` | 20px (`1.25rem`) | 28px (`1.40`) | SemiBold (600) | `-0.015em` | Web dashboard page titles, modal header titles |
| `--font-heading-md` | 18px (`1.125rem`)| 24px (`1.33`) | SemiBold (600) | `-0.01em` | Task card titles, section headings |
| `--font-heading-sm` | 16px (`1.0rem`) | 24px (`1.50`) | SemiBold (600) | `0em` | Sub-section headers, widget panel titles |
| `--font-body-lg` | 16px (`1.0rem`) | 24px (`1.50`) | Regular (400) | `0em` | Mobile form inputs, primary task descriptions |
| `--font-body-md` | 14px (`0.875rem`)| 20px (`1.42`) | Regular (400) | `0em` | Standard web table rows, modal body text, notes |
| `--font-body-sm` | 13px (`0.8125rem`)| 18px (`1.38`)| Regular (400) | `+0.005em` | Metadata copy, checklist item subtext |
| `--font-label` | 12px (`0.75rem`) | 16px (`1.33`) | Medium (500) | `+0.01em` | Input field labels, table column headers, timestamps |
| `--font-button` | 15px (`0.9375rem`)| 20px (`1.33`)| SemiBold (600) | `+0.01em` | Action buttons ("Check In", "Start Task") |
| `--font-caption` | 11px (`0.6875rem`)| 14px (`1.27`)| Medium (500) | `+0.02em` | Footnotes, watermark text, badge labels |
| `--font-mono` | 13px (`0.8125rem`)| 18px (`1.38`)| Medium (500) | `0em` | GPS coordinates, duration timers, IDs |

---

## 3. Readability & Accessibility Rules

1. **Tabular Numerals (`tnum`)**: All numeric fields that update frequently (stopwatch shift timers, battery indicators, distance meters, countdowns) must enforce `font-feature-settings: 'tnum'` to prevent jarring horizontal jitter during updates.
2. **Minimum Readable Font Size**:
   - Web management tables: Never drop below **12px** (`--font-label`).
   - Mobile field views: Never drop below **13px** for any operational instruction or field data.
3. **Line Height Discipline**: Body copy maintains a minimum $1.42 \times$ line height ratio to prevent reading fatigue when reviewing lengthy job instructions.
4. **All-Caps Restraint**: All-caps text is restricted strictly to compact status badges (`ASSIGNED`, `IN_PROGRESS`, `VALID`) with tracked letter spacing (`letter-spacing: 0.05em`) to ensure instant word-shape recognition.
