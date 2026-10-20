#!/usr/bin/env python3
"""Process Chyna.docx card images: crop to card bounds, resize to 300x420 PNGs.

Source: Decks/Chyna_extracted/word/media (EMF files image2/image6 were
pre-converted to PNG with System.Drawing).

Sheet 1 (arsenal + superstar):
    image3  -> superstar-chyna                (Superstar, HS7 SV3)
    image1  -> handspring-elbow               (Strike F9/D7, unique)
    image2  -> chynas-press-slam              (Trademark Finisher F35/D25, unique, stun 3)
    image4  -> handspring-elbow-vc            (Strike F6/D7, unique) [velacarts, landscape bg]
    image5  -> id-rather-be-in-chyna          (Action F0/D0, unique)
    image6  -> chynas-running-lariat          (Strike+Strike/Reversal:Special F9/D9, multi unique, stun 1)
    image7  -> chynas-patented-low-blow       (Strike/Reversal:Grapple F9/D8, unique)
    image8  -> 9th-wonder-of-the-world        (Action F9/D0, unique)
    image9  -> chynas-pedigree                (Trademark Finisher/Action F25/D20, unique, stun 3)
Sheet 2 (arsenal):
    image12 -> throw-you-around-like-a-rag-doll (Action F15/D0, unique)
    image11 -> suplex-into-the-ring            (Action/Reversal:Special F0/D0, throwback)
    image10 -> hes-playing-possum              (Action F1/D0)
    image15 -> scream-if-you-want-it           (Reversal:Special F7/D0, unique)
    image14 -> listen-you-reekazoid            (Action F0/D0, unique)
    image13 -> technical-drop-kick             (Strike/Action:Set-up F0/D4, unique, stun 1)
    image18 -> shove-off-the-top-rope          (Action/Reversal:Special F1/D0)
    image17 -> fall-away-slam                  (Grapple/Reversal:Special F4/D9, stun 1)
    image16 -> wraparound-wrist-lock           (Submission:Chain F0/D3)
    image19 -> quick-snap-body-slam            (Grapple:Chain F0/D4)
    image20 -> toss                            (Grapple:Chain F2/D5)
Sheet 3+ (backlash):
    image24 -> ovicular-fortitude              (Mid-match Action F10/D0, unique) [landscape]
    image23 -> greco-roman-holiday             (Mid-match Grapple F5/D5)
    image22 -> atomic-bear-hug                 (Mid-match Submission:Chain F3/D7)
    image21 -> liaison-with-lita               (Mid-match Action F2/D0, cheater)

NOTE: Image indices shift each time the docx is updated. Always re-run
inspect_chyna.py after extracting a new docx. D values verified by
cropping damage boxes and reading them at 3x zoom.

D values verified against card scans (damage boxes cropped and read).
"""

import os

from PIL import Image

MEDIA = r'C:\Users\patri\Downloads\raw-deal\Decks\Chyna_extracted\word\media'
OUT = r'C:\Users\patri\Downloads\raw-deal\public\cards'
TARGET_W, TARGET_H = 300, 420

# Portrait cards: (filename, slug)
PORTRAIT_CARDS = [
    ('image3.png', 'superstar-chyna'),
    ('image1.png', 'handspring-elbow'),
    ('image2.png', 'chynas-press-slam'),
    ('image5.png', 'id-rather-be-in-chyna'),
    ('image6.png', 'chynas-running-lariat'),
    ('image7.png', 'chynas-patented-low-blow'),
    ('image8.png', '9th-wonder-of-the-world'),
    ('image9.png', 'chynas-pedigree'),
    ('image12.png', 'throw-you-around-like-a-rag-doll'),
    ('image10.png', 'hes-playing-possum'),
    ('image11.png', 'suplex-into-the-ring'),
    ('image15.png', 'scream-if-you-want-it'),
    ('image14.png', 'listen-you-reekazoid'),
    ('image13.png', 'technical-drop-kick'),
    ('image18.png', 'shove-off-the-top-rope'),
    ('image17.png', 'fall-away-slam'),
    ('image16.png', 'wraparound-wrist-lock'),
    ('image19.png', 'quick-snap-body-slam'),
    ('image20.png', 'toss'),
]

# Cards needing manual bbox (photo backgrounds / non-black borders).
# image4: portrait card composited on arena photo, left-center of 1024x572.
MANUAL_BBOX = {
    'image4.png': (302, 12, 722, 568),
}

# Landscape backlash cards: (filename, slug)
LANDSCAPE_CARDS = [
    ('image24.png', 'ovicular-fortitude'),
    ('image23.png', 'greco-roman-holiday'),
    ('image22.png', 'atomic-bear-hug'),
    ('image21.png', 'liaison-with-lita'),
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


def fit_on_black(img, target_w, target_h):
    """Resize to fit target, centered on black."""
    iw, ih = img.size
    scale = min(target_w / iw, target_h / ih)
    new_w = int(iw * scale)
    new_h = int(ih * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGB', (target_w, target_h), (0, 0, 0))
    offset_x = (target_w - new_w) // 2
    offset_y = (target_h - new_h) // 2
    canvas.paste(img, (offset_x, offset_y))
    return canvas


def process_portrait(img):
    bbox = detect_card_bbox(img)
    if bbox:
        img = img.crop(bbox)
    return fit_on_black(img, TARGET_W, TARGET_H), bbox


def process_landscape(img):
    """Landscape card: fit width, center vertically on black."""
    bbox = detect_card_bbox(img)
    if bbox:
        img = img.crop(bbox)
    iw, ih = img.size
    scale = TARGET_W / iw
    new_w = TARGET_W
    new_h = int(ih * scale)
    if new_h > TARGET_H:
        scale = TARGET_H / ih
        new_w = int(iw * scale)
        new_h = TARGET_H
    img = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGB', (TARGET_W, TARGET_H), (0, 0, 0))
    canvas.paste(img, ((TARGET_W - new_w) // 2, (TARGET_H - new_h) // 2))
    return canvas, bbox


print('Processing portrait cards...')
for filename, slug in PORTRAIT_CARDS:
    src = os.path.join(MEDIA, filename)
    dst = os.path.join(OUT, f'{slug}.png')
    img = Image.open(src).convert('RGB')
    result, bbox = process_portrait(img)
    result.save(dst)
    print(f'OK {slug}: {filename} bbox={bbox} ({os.path.getsize(dst)} bytes)')

print('\nProcessing manual-bbox cards...')
for filename, bbox in MANUAL_BBOX.items():
    src = os.path.join(MEDIA, filename)
    img = Image.open(src).convert('RGB')
    card = img.crop(bbox)
    slug = {
        'image4.png': 'handspring-elbow-vc',
    }[filename]
    dst = os.path.join(OUT, f'{slug}.png')
    result = fit_on_black(card, TARGET_W, TARGET_H)
    result.save(dst)
    print(f'OK {slug}: {filename} bbox={bbox} ({os.path.getsize(dst)} bytes)')

print('\nProcessing landscape backlash cards...')
for filename, slug in LANDSCAPE_CARDS:
    src = os.path.join(MEDIA, filename)
    dst = os.path.join(OUT, f'{slug}.png')
    img = Image.open(src).convert('RGB')
    result, bbox = process_landscape(img)
    result.save(dst)
    print(f'OK {slug}: {filename} bbox={bbox} ({os.path.getsize(dst)} bytes)')

print('\nDone!')
