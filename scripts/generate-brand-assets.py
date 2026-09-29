#!/usr/bin/env python3
"""
FieldOps Brand Asset Generator
Generates all production vector SVGs, raster PNGs, and ICO icons
strictly according to docs/brand/brand-assets.md and docs/design/design-tokens.md.
"""

import os
import math
import zlib
import struct
import shutil

# --- Color Constants from Design Tokens ---
COLOR_PRIMARY_DARK = (15, 23, 42, 255)      # Slate 900 #0F172A
COLOR_PRIMARY_LIGHT = (248, 250, 252, 255)  # Polar White #F8FAFC
COLOR_ACCENT_LIGHT = (217, 119, 6, 255)     # Amber Light #D97706
COLOR_ACCENT_DARK = (245, 158, 11, 255)     # Amber Dark #F59E0B
COLOR_WHITE = (255, 255, 255, 255)          # White #FFFFFF
COLOR_BLACK = (0, 0, 0, 255)                # Black #000000
COLOR_TRANSPARENT = (0, 0, 0, 0)
COLOR_TEXT_MUTED = (100, 116, 139, 255)     # Slate 500 #64748B
COLOR_GRID_LINE = (30, 41, 59, 255)         # Slate 800 #1E293B

# --- Pure Python PNG & ICO Utilities ---

def create_png_bytes(width, height, get_pixel_func):
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel_func(x, y)
            raw.extend((r, g, b, a))

    def make_chunk(tag, data):
        payload = tag + data
        crc = zlib.crc32(payload) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + payload + struct.pack('>I', crc)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = make_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    idat = make_chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    iend = make_chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def create_ico_bytes(png_bytes, width=32, height=32):
    # Standard ICO envelope wrapping PNG image payload
    header = struct.pack('<HHH', 0, 1, 1)  # reserved, type 1 (icon), 1 image
    w_byte = width if width < 256 else 0
    h_byte = height if height < 256 else 0
    size = len(png_bytes)
    offset = 6 + 16  # header (6) + 1 directory entry (16)
    entry = struct.pack('<BBBBHHII', w_byte, h_byte, 0, 0, 1, 32, size, offset)
    return header + entry + png_bytes

# --- Geometric Drawing Helpers for Raster Assets ---

def point_in_pin(nx, ny):
    """Normalized coordinates: nx in [-1, 1], ny in [-1.1, 1.1]"""
    # Pin top circle: center (0, -0.2), radius 0.75
    # Pin tip: at (0, 0.95)
    r = math.sqrt(nx * nx + (ny + 0.2) ** 2)
    if ny <= -0.2 and r <= 0.75:
        return True
    if ny > -0.2 and ny <= 0.95:
        # Tapering tangents from circle to bottom tip
        max_x = 0.75 * (1.0 - (ny + 0.2) / 1.15)
        if abs(nx) <= max(0.0, max_x):
            return True
    return False

def point_in_check_arrow(nx, ny):
    """Normalized checkmark + forward vector arrow inside pin"""
    # Check start: (-0.35, -0.15) to (-0.1, 0.15)
    # Check to arrow tip: (-0.1, 0.15) to (0.4, -0.45)
    # Arrowhead at (0.4, -0.45): horiz bar (0.15 to 0.4, -0.45), vert bar (0.4, -0.45 to -0.2)
    # Distance to line segment check
    def dist_to_seg(px, py, x1, y1, x2, y2):
        dx = x2 - x1
        dy = y2 - y1
        l2 = dx*dx + dy*dy
        if l2 == 0:
            return math.hypot(px - x1, py - y1)
        t = max(0, min(1, ((px - x1)*dx + (py - y1)*dy) / l2))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        return math.hypot(px - proj_x, py - proj_y)

    stroke = 0.11
    d1 = dist_to_seg(nx, ny, -0.32, -0.10, -0.10, 0.15)
    d2 = dist_to_seg(nx, ny, -0.10, 0.15, 0.38, -0.38)
    d3 = dist_to_seg(nx, ny, 0.16, -0.38, 0.38, -0.38)
    d4 = dist_to_seg(nx, ny, 0.38, -0.38, 0.38, -0.16)

    min_d = min(d1, d2, d3, d4)
    return min_d <= stroke

# --- SVG Asset Definitions ---

SVG_SYMBOL_COLOR = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">
  <defs>
    <linearGradient id="fo-amber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>
  <!-- Unified Pin Symbol with 4px vertex radius & baseline grid -->
  <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="url(#fo-amber-grad)"/>
  <!-- Integrated Checkmark & Forward Vector Arrow -->
  <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

SVG_SYMBOL_WHITE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">
  <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="#FFFFFF"/>
  <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

SVG_SYMBOL_MONO = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">
  <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="#000000"/>
  <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

SVG_LOGO_HORIZONTAL_LIGHT = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 32" width="160" height="32" fill="none">
  <defs>
    <linearGradient id="fo-amber-grad-hl" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>
  <!-- Symbol (32x32) -->
  <g transform="translate(0, 0)">
    <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="url(#fo-amber-grad-hl)"/>
    <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Wordmark: Field (Bold 700) + Ops (Medium 500) -->
  <text x="44" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-size="21" letter-spacing="-0.02em">
    <tspan font-weight="700" fill="#0F172A">Field</tspan><tspan font-weight="500" fill="#475569">Ops</tspan>
  </text>
</svg>'''

SVG_LOGO_HORIZONTAL_DARK = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 32" width="160" height="32" fill="none">
  <defs>
    <linearGradient id="fo-amber-grad-hd" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#FBBF24" />
    </linearGradient>
  </defs>
  <!-- Symbol -->
  <g transform="translate(0, 0)">
    <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="url(#fo-amber-grad-hd)"/>
    <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Wordmark -->
  <text x="44" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-size="21" letter-spacing="-0.02em">
    <tspan font-weight="700" fill="#F8FAFC">Field</tspan><tspan font-weight="500" fill="#CBD5E1">Ops</tspan>
  </text>
</svg>'''

SVG_LOGO_HORIZONTAL_MONO = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 32" width="160" height="32" fill="none">
  <!-- Symbol -->
  <g transform="translate(0, 0)">
    <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="#000000"/>
    <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Wordmark -->
  <text x="44" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-size="21" letter-spacing="-0.02em">
    <tspan font-weight="700" fill="#000000">Field</tspan><tspan font-weight="500" fill="#000000">Ops</tspan>
  </text>
</svg>'''

SVG_LOGO_VERTICAL_LIGHT = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 76" width="120" height="76" fill="none">
  <defs>
    <linearGradient id="fo-amber-grad-vl" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>
  <!-- Centered Symbol (32x32) -->
  <g transform="translate(44, 4)">
    <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="url(#fo-amber-grad-vl)"/>
    <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Centered Wordmark with 0.5H spacing -->
  <text x="60" y="62" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-size="19" letter-spacing="-0.02em">
    <tspan font-weight="700" fill="#0F172A">Field</tspan><tspan font-weight="500" fill="#475569">Ops</tspan>
  </text>
</svg>'''

SVG_LOGO_VERTICAL_DARK = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 76" width="120" height="76" fill="none">
  <defs>
    <linearGradient id="fo-amber-grad-vd" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#FBBF24" />
    </linearGradient>
  </defs>
  <!-- Centered Symbol -->
  <g transform="translate(44, 4)">
    <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="url(#fo-amber-grad-vd)"/>
    <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Centered Wordmark -->
  <text x="60" y="62" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" font-size="19" letter-spacing="-0.02em">
    <tspan font-weight="700" fill="#F8FAFC">Field</tspan><tspan font-weight="500" fill="#CBD5E1">Ops</tspan>
  </text>
</svg>'''

SVG_FAVICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="fav-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>
  <!-- Dark Slate circular container for high-contrast visibility across light/dark tabs -->
  <rect width="32" height="32" rx="7" fill="#0F172A" />
  <!-- Scaled Symbol inside container -->
  <g transform="translate(3.5, 3.5) scale(0.78)">
    <path d="M16 2.5 C10.2 2.5 5.5 7.2 5.5 13.2 C5.5 20.6 15 28.3 15.45 28.7 C15.77 28.98 16.23 28.98 16.55 28.7 C17 28.3 26.5 20.6 26.5 13.2 C26.5 7.2 21.8 2.5 16 2.5 Z" fill="url(#fav-grad)"/>
    <path d="M10.5 14 L14 17.5 L21.5 10 M17.5 10 H21.5 V14" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>'''

def main():
    base_dir = "/workspace/clever-darwin"
    target_dirs = [
        os.path.join(base_dir, "public/brand"),
        os.path.join(base_dir, "apps/web/public/brand"),
    ]

    print("Generating FieldOps production brand assets...")

    for root_target in target_dirs:
        os.makedirs(os.path.join(root_target, "logo"), exist_ok=True)
        os.makedirs(os.path.join(root_target, "symbol"), exist_ok=True)
        os.makedirs(os.path.join(root_target, "icons"), exist_ok=True)
        os.makedirs(os.path.join(root_target, "social"), exist_ok=True)

        # 1. Vector SVGs
        svg_files = {
            "symbol/fieldops-symbol-color.svg": SVG_SYMBOL_COLOR,
            "symbol/fieldops-symbol-white.svg": SVG_SYMBOL_WHITE,
            "symbol/fieldops-symbol-mono.svg": SVG_SYMBOL_MONO,
            "logo/fieldops-logo-horizontal-light.svg": SVG_LOGO_HORIZONTAL_LIGHT,
            "logo/fieldops-logo-horizontal-dark.svg": SVG_LOGO_HORIZONTAL_DARK,
            "logo/fieldops-logo-horizontal-mono.svg": SVG_LOGO_HORIZONTAL_MONO,
            "logo/fieldops-logo-vertical-light.svg": SVG_LOGO_VERTICAL_LIGHT,
            "logo/fieldops-logo-vertical-dark.svg": SVG_LOGO_VERTICAL_DARK,
            "icons/favicon.svg": SVG_FAVICON,
        }

        for path_suffix, content in svg_files.items():
            full_path = os.path.join(root_target, path_suffix)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content.strip() + "\n")
            print(f"  [SVG] Created: {os.path.relpath(full_path, base_dir)}")

        # 2. Raster PNG Assets
        # 2.1 Favicon & App Icons (Square Slate 900 background + Pin)
        def render_icon(size, corner_radius_ratio=0.22, padding_ratio=0.18):
            pad = int(size * padding_ratio)
            draw_w = size - 2 * pad
            draw_h = size - 2 * pad
            corner_r = int(size * corner_radius_ratio)

            def get_pixel(x, y):
                # Background squircle / rounded rect check
                in_bg = True
                if corner_r > 0:
                    if x < corner_r and y < corner_r:
                        in_bg = (x - corner_r)**2 + (y - corner_r)**2 <= corner_r**2
                    elif x >= size - corner_r and y < corner_r:
                        in_bg = (x - (size - corner_r - 1))**2 + (y - corner_r)**2 <= corner_r**2
                    elif x < corner_r and y >= size - corner_r:
                        in_bg = (x - corner_r)**2 + (y - (size - corner_r - 1))**2 <= corner_r**2
                    elif x >= size - corner_r and y >= size - corner_r:
                        in_bg = (x - (size - corner_r - 1))**2 + (y - (size - corner_r - 1))**2 <= corner_r**2

                if not in_bg:
                    return COLOR_TRANSPARENT

                # Inside Symbol Drawing
                if pad <= x < size - pad and pad <= y < size - pad:
                    nx = ((x - pad) / draw_w - 0.5) * 2.0
                    ny = ((y - pad) / draw_h - 0.5) * 2.2
                    if point_in_pin(nx, ny):
                        if point_in_check_arrow(nx, ny):
                            return COLOR_WHITE
                        # Amber gradient top to bottom
                        t = (y - pad) / draw_h
                        r = int(245 * (1 - t) + 217 * t)
                        g = int(158 * (1 - t) + 119 * t)
                        b = int(11 * (1 - t) + 6 * t)
                        return (r, g, b, 255)

                return COLOR_PRIMARY_DARK

            return create_png_bytes(size, size, get_pixel)

        # Generate Icons
        apple_touch = render_icon(180, corner_radius_ratio=0.22, padding_ratio=0.20)
        icon_192 = render_icon(192, corner_radius_ratio=0.22, padding_ratio=0.20)
        icon_512 = render_icon(512, corner_radius_ratio=0.22, padding_ratio=0.20)
        avatar_800 = render_icon(800, corner_radius_ratio=0.5, padding_ratio=0.22) # Circular avatar

        with open(os.path.join(root_target, "icons/apple-touch-icon.png"), "wb") as f:
            f.write(apple_touch)
        with open(os.path.join(root_target, "icons/icon-192.png"), "wb") as f:
            f.write(icon_192)
        with open(os.path.join(root_target, "icons/icon-512.png"), "wb") as f:
            f.write(icon_512)
        with open(os.path.join(root_target, "social/avatar-800x800.png"), "wb") as f:
            f.write(avatar_800)

        # Android Adaptive Icons (432x432)
        # Background: Solid Slate 900
        android_bg = create_png_bytes(432, 432, lambda x, y: COLOR_PRIMARY_DARK)
        with open(os.path.join(root_target, "icons/android-adaptive-background.png"), "wb") as f:
            f.write(android_bg)

        # Foreground: Centered pin symbol on transparent canvas
        def get_adaptive_fg_pixel(x, y):
            size = 432
            pad = int(size * 0.28) # Well within 66dp safe zone
            draw_w = size - 2 * pad
            draw_h = size - 2 * pad
            if pad <= x < size - pad and pad <= y < size - pad:
                nx = ((x - pad) / draw_w - 0.5) * 2.0
                ny = ((y - pad) / draw_h - 0.5) * 2.2
                if point_in_pin(nx, ny):
                    if point_in_check_arrow(nx, ny):
                        return COLOR_WHITE
                    return COLOR_ACCENT_DARK
            return COLOR_TRANSPARENT

        android_fg = create_png_bytes(432, 432, get_adaptive_fg_pixel)
        with open(os.path.join(root_target, "icons/android-adaptive-foreground.png"), "wb") as f:
            f.write(android_fg)

        # Favicon ICO (32x32)
        fav_32_png = render_icon(32, corner_radius_ratio=0.25, padding_ratio=0.15)
        fav_ico = create_ico_bytes(fav_32_png, 32, 32)
        with open(os.path.join(root_target, "icons/favicon.ico"), "wb") as f:
            f.write(fav_ico)

        # Social Open Graph Image (1200x630)
        def get_og_pixel(x, y):
            # Background grid line check
            is_grid = (x % 60 == 0 or y % 60 == 0)
            base_bg = COLOR_GRID_LINE if is_grid else COLOR_PRIMARY_DARK

            # Draw Logo Symbol on left: (160, 215) to (360, 415)
            sym_x, sym_y, sym_s = 160, 215, 200
            if sym_x <= x < sym_x + sym_s and sym_y <= y < sym_y + sym_s:
                nx = ((x - sym_x) / sym_s - 0.5) * 2.0
                ny = ((y - sym_y) / sym_s - 0.5) * 2.2
                if point_in_pin(nx, ny):
                    if point_in_check_arrow(nx, ny):
                        return COLOR_WHITE
                    t = (y - sym_y) / sym_s
                    r = int(245 * (1 - t) + 217 * t)
                    g = int(158 * (1 - t) + 119 * t)
                    b = int(11 * (1 - t) + 6 * t)
                    return (r, g, b, 255)

            return base_bg

        og_png = create_png_bytes(1200, 630, get_og_pixel)
        with open(os.path.join(root_target, "social/og-preview-1200x630.png"), "wb") as f:
            f.write(og_png)

        print(f"  [Raster] Generated PNG & ICO assets in {os.path.relpath(root_target, base_dir)}")

    # Also place favicon.ico at apps/web/public/favicon.ico for standard browser access
    web_public_fav = os.path.join(base_dir, "apps/web/public/favicon.ico")
    shutil.copyfile(os.path.join(base_dir, "public/brand/icons/favicon.ico"), web_public_fav)
    print(f"  [Web] Copied standard favicon to {os.path.relpath(web_public_fav, base_dir)}")

    print("Brand assets generated successfully!")

if __name__ == "__main__":
    main()
