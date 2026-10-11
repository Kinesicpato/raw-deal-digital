#!/usr/bin/env python3
"""Process Vitoco.docx card images: crop to card bounds, remove black
background/borders, resize to 300x420 PNGs for public/cards/.

Sources in Decks/Vitoco_extracted/word/media (all 610x610 RGBA scans):

    Backlash deck (page 1, landscape on black):
        image1  -> You Don't Want to Go Where I've Been  (refresh existing PNG)
        image2  -> How Important Is It?                  (new)
    Arsenal (portrait):
        image3  -> mind-games
        image4  -> im-hardcore-im-hardcore
        image5  -> dem-damn-dudleyz
        image6  -> recover-again
        image8  -> struck-by-a-kendo-stick-tb   (F3/D7 throwback)
        image11 -> struck-by-a-kendo-stick      (F6/D5)
        image12 -> overhand-chairshot
        image13 -> struck-by-an-unknown-foreign-object
    Skipped: image7/9/10 Chair Shot (already in game as chair-shot, F10/D10).

Processing matches scripts/fix_set1509_arsenal_pngs.py for portrait cards
and scripts/process_set15_09.py process_landscape_backlash for landscape.
"""

import os

from PIL import Image

MEDIA = r'C:\Users\patri\Downloads\raw-deal\Decks\Vitoco_extracted\word\media'
OUT = r'C:\Users\patri\Downloads\raw-deal\public\cards'
TARGET_W, TARGET_H = 300, 420

PORTRAIT_CARDS = [
    ('image3.png', 'mind-games'),
    ('image4.png', 'im-hardcore-im-hardcore'),
    ('image5.png', 'dem-damn-dudleyz'),
    ('image6.png', 'recover-again'),
    ('image8.png', 'struck-by-a-kendo-stick-tb'),
    ('image11.png', 'struck-by-a-kendo-stick'),
    ('image12.png', 'overhand-chairshot'),
    ('image13.png', 'struck-by-an-unknown-foreign-object'),
]

BACKLASH_CARDS = [
    ('image1.png', 'you-dont-want-to-go-where-ive-been'),
    ('image2.png', 'how-important-is-it'),
]


def detect_card_bbox(img):
    """Detect card boundary using bright pixel detection."""
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
    """Crop to card bounds and resize to fit target, centered on black."""
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


def process_landscape_backlash(img, target_w, target_h):
    """Remove black background from landscape card, fit into portrait canvas."""
    bbox = detect_card_bbox(img)
    if bbox:
        img = img.crop(bbox)

    iw, ih = img.size
    scale = target_w / iw
    new_w = target_w
    new_h = int(ih * scale)

    if new_h > target_h:
        scale = target_h / ih
        new_w = int(iw * scale)
        new_h = target_h

    img = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGB', (target_w, target_h), (0, 0, 0))
    offset_x = (target_w - new_w) // 2
    offset_y = (target_h - new_h) // 2
    canvas.paste(img, (offset_x, offset_y))
    return canvas, bbox


print('Processing portrait arsenal cards...')
for filename, slug in PORTRAIT_CARDS:
    src = os.path.join(MEDIA, filename)
    dst = os.path.join(OUT, f'{slug}.png')
    img = Image.open(src).convert('RGB')
    result, bbox = crop_and_resize(img, TARGET_W, TARGET_H)
    result.save(dst)
    print(f'OK {slug}: {filename} bbox={bbox} -> {result.size[0]}x{result.size[1]} ({os.path.getsize(dst)} bytes)')

print('\nProcessing landscape backlash cards...')
for filename, slug in BACKLASH_CARDS:
    src = os.path.join(MEDIA, filename)
    dst = os.path.join(OUT, f'{slug}.png')
    img = Image.open(src).convert('RGB')
    result, bbox = process_landscape_backlash(img, TARGET_W, TARGET_H)
    result.save(dst)
    print(f'OK {slug}: {filename} bbox={bbox} -> {result.size[0]}x{result.size[1]} ({os.path.getsize(dst)} bytes)')

print('\nDone!')
