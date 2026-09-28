# FieldOps — Brand Asset Specifications

---

## 1. Asset Strategy & Specification Overview

To ensure consistency across web consoles, mobile applications, digital documentation, and customer-facing materials, this specification defines the geometric proportions, clear space rules, colorways, minimum sizes, and export standards for all FieldOps brand assets.

> [!NOTE]
> Per Phase 01 governance, production SVG/PNG graphical files are not generated as mock files in this phase. This document serves as the formal design and engineering blueprint for brand asset generation in subsequent delivery phases.

---

## 2. Core Asset Identity Specifications

### 2.1. Primary Symbol (Logomark)
- **Concept**: A unified geometric icon combining a stylized physical location pin, an operational checkmark, and a forward vector arrow.
- **Grid & Geometry**: Constructed on a 32x32 pixel baseline grid with 4px border radius on exterior vertices and 2.5px uniform stroke weight.
- **Aspect Ratio**: 1:1 square bounding box.
- **Clear Space**: Minimum exclusion zone equal to $0.5 \times \text{height}$ ($0.5H$) on all four sides. No typography, icons, or interface borders may encroach inside this perimeter.
- **Minimum Digital Sizing**:
  - Standard display: 24px × 24px
  - Compact icon: 16px × 16px (simplified pixel-aligned version without sub-pixel strokes)

### 2.2. Wordmark (Logotype)
- **Typography**: Set in bespoke geometric sans-serif (derived from Inter / Space Grotesk geometry) with tightened letter tracking (-0.02em).
- **Casing & Weight**: Title case (`FieldOps`) with `Field` in Bold (700) and `Ops` in Medium (500) to create subtle hierarchy.
- **Baseline Alignment**: Centered vertically with the symbol cap height.
- **Clear Space**: $0.5H$ exclusion boundary around the entire composite mark.
- **Minimum Digital Sizing**: Height of 18px (web navbar).

### 2.3. Combined Lockups
- **Horizontal Lockup (Primary Web & Desktop Header)**:
  - Layout: `[Symbol]` + `[Spacing = 0.4H]` + `[Wordmark]`
  - Standard height: 32px
- **Stacked / Vertical Lockup (Splash Screens & Print Collateral)**:
  - Layout: `[Symbol]` centered above `[Wordmark]` with `[Spacing = 0.5H]`
  - Minimum width: 120px

---

## 3. Comprehensive Asset Inventory & Specifications

| Asset Name | Target Environment | Aspect Ratio | Dimensions / Formats | Colorways & Background Rules |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Logo (Light Mode)** | Web header, white invoices, documentation | Horizontal (~4:1) | SVG (vector), PNG @ 1x, 2x, 3x | Symbol in Amber `#D97706` + Slate 900 `#0F172A` text on pure white / slate-50. |
| **Primary Logo (Dark Mode)** | Mobile dark theme, terminal, dark dashboards | Horizontal (~4:1) | SVG, PNG @ 1x, 2x, 3x | Symbol in Amber `#F59E0B` + Polar White `#F8FAFC` text on slate-900 / dark surface. |
| **Monochrome Logo** | Black & white print, laser-engraved badges | Horizontal (~4:1) | SVG, PDF, EPS | 100% Solid Black (`#000000`) on white, or 100% White (`#FFFFFF`) on black. |
| **App Icon (Android)** | Android Launcher (Adaptive Icon) | 1:1 (Square) | 512×512 master (Adaptive: 432×432 foreground + background) | Background: Solid Slate 900 (`#0F172A`). Foreground: Symbol in Amber `#F59E0B` + White `#FFFFFF`. Must respect 66dp safe circular cutout. |
| **App Icon (iOS)** | iOS Home Screen, App Store | 1:1 (Square) | 1024×1024 master PNG (no alpha) | Solid Slate 900 background with centered mark. iOS automatically applies squircle mask. |
| **Favicon** | Browser tabs, web bookmarks | 1:1 (Square) | ICO (16x16, 32x32, 48x48), SVG (vector favicon), PNG (32x32, 192x192) | Simplified high-contrast symbol in Emerald/Amber on Slate 900 circular backing. |
| **Social Avatar** | GitHub, LinkedIn, Twitter/X, Slack | 1:1 (Square / Circle) | 800×800 PNG / JPG | Symbol centered in 800x800 canvas with $160\text{px}$ inner padding to prevent circular crop clipping. |
| **Open Graph (OG) Image** | Social sharing cards, preview unfurls | 1.91:1 (Landscape) | 1200×630 PNG | Dark slate background (`#0F172A`), combined logo, tagline (*"Assign the work. Verify the work."*), and subtle isometric operational grid. |
| **App Splash Screen** | Mobile app cold boot initialization | 9:19.5 (Portrait) | Vector storyboard / Android 12+ SplashScreen API | Background: Slate 900 (`#0F172A`). Center icon: 240×240 symbol with smooth subtle launch fade. |
| **Email Signature Mark** | Transactional alerts, dispatch emails | Horizontal (~3:1) | 300×75 PNG (rendered @ 150×37.5) | Web-safe RGB PNG; optimized for high-DPI displays with alt text "FieldOps". |

---

## 4. File Structure & Delivery Naming Conventions

When asset generation commences in Phase 05/06, files will be published strictly under `/public/brand/` according to this deterministic schema:

```
public/brand/
├── logo/
│   ├── fieldops-logo-horizontal-light.svg
│   ├── fieldops-logo-horizontal-dark.svg
│   ├── fieldops-logo-horizontal-mono.svg
│   ├── fieldops-logo-vertical-light.svg
│   └── fieldops-logo-vertical-dark.svg
├── symbol/
│   ├── fieldops-symbol-color.svg
│   ├── fieldops-symbol-white.svg
│   └── fieldops-symbol-mono.svg
├── icons/
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── apple-touch-icon.png (180x180)
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── android-adaptive-foreground.png
│   └── android-adaptive-background.png
└── social/
    ├── og-preview-1200x630.png
    └── avatar-800x800.png
```
