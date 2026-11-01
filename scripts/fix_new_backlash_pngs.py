#!/usr/bin/env python3
"""Fix the display of the two Mid-match Backlash cards added as raw WebP scans.

'Settle down son.png' (610x610 WebP) and 'Human highlight reel.png'
(500x333 WebP) were uploaded as raw scans and got stretched into the
portrait card frame by object-fit: fill.

This matches the convention used by scripts/add_set1509_backlash_pngs.py:
detect the card bounds, crop, scale to fit width 300, and center the
landscape card on a 300x420 black canvas — same look as the other
backlash cards. Output is saved as a real PNG.
"""

import os

from PIL import Image

OUT = r'C:\Users\patri\Downloads\raw-deal\public\cards'
TARGET_W, TARGET_H = 300, 420

CARDS = [
    'Settle down son.png',
    'Human highlight reel.png',
    'hhh-The King of Kings.png',
]


def detect_card_bbox(img):
    """Bounding box of the (bright) card against the black scan padding."""
    pixels = img.load()
    w, h = img.size
    threshold = 30  # luminance above this counts as "card"

    top = bottom = left = right = None

    for y in range(h):
        bright_count = sum(
            1 for x in range(w)
            if any(pixels[x, y][c] > threshold for c in range(3))
        )
        if bright_count > w * 0.15:
            if top is None:
                top = y
            bottom = y

    for x in range(w):
        bright_count = sum(
            1 for y in range(h)
            if any(pixels[x, y][c] > threshold for c in range(3))
        )
        if bright_count > h * 0.15:
            if left is None:
                left = x
            right = x

    if top is not None and left is not None:
        top = max(0, top - 2)
        left = max(0, left - 2)
        bottom = min(h - 1, bottom + 2)
        right = min(w - 1, right + 2)
        return (left, top, right + 1, bottom + 1)

    return None


def crop_and_resize(img, target_w, target_h):
    bbox = detect_card_bbox(img)
    if bbox:
        img = img.crop(bbox)

    iw, ih = img.size
    scale = min(target_w / iw, target_h / ih)
    new_w = int(iw * scale)
    new_h = int(ih * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGB', (target_w, target_h), (0, 0, 0))
    offset_x = (target_w - new_w) // 2
    offset_y = (target_h - new_h) // 2
    canvas.paste(img, (offset_x, offset_y))
    return canvas, bbox


for filename in CARDS:
    path = os.path.join(OUT, filename)
    img = Image.open(path).convert('RGB')
    result, bbox = crop_and_resize(img, TARGET_W, TARGET_H)
    result.save(path, 'PNG')
    size = os.path.getsize(path)
    fmt = Image.open(path).format
    print(f'OK {filename}: bbox={bbox} -> {result.size[0]}x{result.size[1]} '
          f'({size} bytes, {fmt})')
