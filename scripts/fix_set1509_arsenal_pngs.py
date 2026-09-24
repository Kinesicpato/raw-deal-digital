#!/usr/bin/env python3
"""Regenerate Set 15-09 arsenal card PNGs with the correct artwork.

The 3 arsenal cards (Bulldog Lariat, Flying Lariat, Tilt-a-Whirl Powerslam)
were previously exported using the wrong source images (the Mid-match cards
Human Suplex Machine / Fully Loaded / Do Something). This script maps them to
their real sources in the Set 15-09 docx extraction (image13/14/15) and
processes them exactly like the other cards: detect card bounds, crop, resize
to fit 300x420, center on a black canvas.
"""

import os

from PIL import Image

MEDIA = r'C:\Users\patri\Downloads\raw-deal\Decks\Set_15-09_v5\word\media'
OUT = r'C:\Users\patri\Downloads\raw-deal\public\cards'
TARGET_W, TARGET_H = 300, 420

CARDS = [
    ('image13.png', 'bulldog-lariat'),
    ('image14.png', 'flying-lariat'),
    ('image15.png', 'tilt-a-whirl-powerslam'),
]


def detect_card_bbox(img):
    """Detect card boundary using bright pixel detection (recrop_set11 approach)."""
    pixels = img.load()
    w, h = img.size
    threshold = 30

    top = bottom = left = right = None

    for y in range(h):
        bright_count = sum(1 for x in range(w) if any(pixels[x, y][c] > threshold for c in range(3)))
        if bright_count > w * 0.15:
            if top is None:
                top = y
            bottom = y

    for x in range(w):
        bright_count = sum(1 for y in range(h) if any(pixels[x, y][c] > threshold for c in range(3)))
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
    """Crop to card bounds and resize to target dimensions."""
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


for filename, slug in CARDS:
    src = os.path.join(MEDIA, filename)
    dst = os.path.join(OUT, f'{slug}.png')
    img = Image.open(src).convert('RGB')
    result, bbox = crop_and_resize(img, TARGET_W, TARGET_H)
    result.save(dst)
    print(f'OK {slug}: {filename} bbox={bbox} -> {result.size[0]}x{result.size[1]} ({os.path.getsize(dst)} bytes)')
