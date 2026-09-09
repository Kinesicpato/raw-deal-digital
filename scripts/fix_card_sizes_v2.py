#!/usr/bin/env python3
"""Reprocess cards with proper content detection (handles black backgrounds)."""
from PIL import Image, ImageChops
import os, statistics

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC = os.path.join(ROOT, 'public', 'cards')
BANK = os.path.join(ROOT, 'scripts', 'generated', 'bank')
DECKS = os.path.join(ROOT, 'Decks')
W, H = 300, 420

def find_content_bbox(img, bg_threshold=30):
    """Find bounding box of actual content, detecting both white and black backgrounds."""
    # Convert to RGB for analysis
    rgb = img.convert('RGB')
    pixels = list(rgb.getdata())
    w, h = rgb.size

    # Sample corners to determine background color
    corner_samples = [
        pixels[0], pixels[w-1], pixels[(h-1)*w], pixels[(h-1)*w + w-1],
        pixels[w//2], pixels[(h-1)*w + w//2],  # top/bottom center
        pixels[(h//2)*w], pixels[(h//2)*w + w-1],  # left/right center
    ]
    # Use median of corner samples as background
    bg_r = statistics.median([p[0] for p in corner_samples])
    bg_g = statistics.median([p[1] for p in corner_samples])
    bg_b = statistics.median([p[2] for p in corner_samples])

    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[y * w + x]
            # Distance from background
            dist = ((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2) ** 0.5
            if dist > bg_threshold:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
                found = True

    if found:
        # Add small padding (2px)
        min_x = max(0, min_x - 2)
        min_y = max(0, min_y - 2)
        max_x = min(w - 1, max_x + 2)
        max_y = min(h - 1, max_y + 2)
        return (min_x, min_y, max_x + 1, max_y + 1)
    return (0, 0, w, h)

def process_card(src_path, card_id, fill_pct=0.92):
    """Crop to actual content, resize to fill fill_pct of canvas."""
    img = Image.open(src_path).convert('RGBA')
    orig = img.size

    bbox = find_content_bbox(img)
    cropped = img.crop(bbox)
    cw, ch = cropped.size

    target_w = int(W * fill_pct)
    target_h = int(H * fill_pct)
    scale = min(target_w / cw, target_h / ch)
    new_w, new_h = int(cw * scale), int(ch * scale)
    resized = cropped.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    canvas.paste(resized, ((W - new_w) // 2, (H - new_h) // 2), resized)
    canvas.save(os.path.join(PUBLIC, f'{card_id}.png'), 'PNG')
    print(f'  {card_id}: {orig} crop={bbox} cropped={cropped.size} -> {canvas.size} (fill {new_w*100//W}%x{new_h*100//H}%)')

# ── Enough With the Trash Talk: fill 92% ──
print('=== Enough With the Trash Talk ===')
process_card(
    os.path.join(DECKS, 'set909_extracted', 'word', 'media', 'image35.png'),
    'enough-with-the-trash-talk', fill_pct=0.92)

# ── Beating the Odds: fill 92% ──
print('=== Beating the Odds ===')
process_card(
    os.path.join(DECKS, 'set909_extracted', 'word', 'media', 'image33.png'),
    'beating-the-odds', fill_pct=0.92)

# ── Triangle Choke: fill 92% ──
print('=== Triangle Choke ===')
process_card(
    os.path.join(BANK, 'elpepe-raw-deal', '305.png'),
    'triangle-choke', fill_pct=0.92)

# ── Knee Lift: fill 92% ──
print('=== Knee Lift ===')
process_card(
    os.path.join(BANK, 'elpepe-raw-deal', '84.png'),
    'knee-lift', fill_pct=0.92)

# ── Diversion: fill 92% ──
print('=== Diversion ===')
process_card(
    os.path.join(BANK, 'elpepe-raw-deal', '122.png'),
    'diversion', fill_pct=0.92)

# ── Cactus Extreme Promo Skills: rotate 180°, fill 95% height ──
print('=== Cactus Extreme Promo Skills (180° rotation) ===')
src = os.path.join(PUBLIC, 'cactus-extreme-promo-skills.png')
img = Image.open(src).convert('RGBA')
# Rotate 180 degrees
img = img.rotate(180, expand=False)
# Find content and reprocess
bbox = find_content_bbox(img)
cropped = img.crop(bbox)
cw, ch = cropped.size
# Make it fill height more (user wants it longer)
target_h = int(H * 0.95)
scale = target_h / ch
new_w, new_h = int(cw * scale), int(ch * scale)
# Cap width at canvas
if new_w > W:
    scale2 = W / new_w
    new_w, new_h = W, int(new_h * scale2)
resized = cropped.resize((new_w, new_h), Image.LANCZOS)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
canvas.paste(resized, ((W - new_w) // 2, (H - new_h) // 2), resized)
canvas.save(src, 'PNG')
print(f'  rotated -> crop={bbox} cropped={cropped.size} -> {canvas.size}')

print('\nDone!')
