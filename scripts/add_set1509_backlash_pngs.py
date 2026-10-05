#!/usr/bin/env python3
"""Generate PNGs for the 3 Set 15-09 Mid-match Backlash cards that were missing.

Sources are in Decks/Set_15-09_v5/word/media. Note the numbering shift: that
extraction has no image16, so files 17..19 there are one slot lower than in a
full docx extraction (which numbers them 18, 19, 17 respectively):

    v5 image19.png -> You Knew It Would End This Way...
    v5 image17.png -> Really, That's Enough
    v5 image18.png -> Real Predictable...

Processing matches scripts/fix_set1509_arsenal_pngs.py: detect card bounds,
crop, resize to fit 300x420, center on a black canvas.
"""

import os

from PIL import Image

MEDIA = r'C:\Users\patri\Downloads\raw-deal\Decks\Set_15-09_v5\word\media'
OUT = r'C:\Users\patri\Downloads\raw-deal\public\cards'
TARGET_W, TARGET_H = 300, 420

CARDS = [
    ('image19.png', 'you-knew-it-would-end-this-way'),
    ('image17.png', 'really-thats-enough'),
    ('image18.png', 'real-predictable'),
]


def detect_card_bbox(img):
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
