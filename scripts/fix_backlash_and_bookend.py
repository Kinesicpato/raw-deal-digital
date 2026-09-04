#!/usr/bin/env python3
"""
Fix midmatch backlash cards: trim black borders from landscape source,
save at 300x420 with landscape content centered (contain on black canvas).
No rotation. Fix bookend too.
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
CARDS_DIR = os.path.join(ROOT, "public", "cards")
EXTRACT_DIR = os.path.join(ROOT, 'Decks', 'midmatch_extracted', 'word', 'media')

TARGET_W, TARGET_H = 300, 420

MIDMATCH = [
    ('dirty-low-blow', 'image1.png'),
    ('backlash-card', 'image2.png'),
    ('chain-barrier', 'image3.png'),
    ('tormented-tomfoolery', 'image4.png'),
    ('precision-personified', 'image5.png'),
    ('backfire', 'image6.png'),
]

def trim_black(img, threshold=15):
    rgb = img.convert('RGB')
    px = rgb.load()
    min_x, min_y = img.width, img.height
    max_x, max_y = 0, 0
    for y in range(0, img.height, 2):
        for x in range(0, img.width, 2):
            r, g, b = px[x, y]
            if r > threshold or g > threshold or b > threshold:
                min_x, min_y = min(min_x, x), min(min_y, y)
                max_x, max_y = max(max_x, x), max(max_y, y)
    return img.crop((max(0, min_x-1), max(0, min_y-1), min(img.width, max_x+2), min(img.height, max_y+2)))

def contain_in_target(img, tw, th):
    """Scale image to fit inside tw x th, center on black canvas."""
    src_ratio = img.width / img.height
    tgt_ratio = tw / th
    if src_ratio > tgt_ratio:
        new_w, new_h = tw, int(tw / src_ratio)
    else:
        new_h, new_w = th, int(th * src_ratio)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 255))
    canvas.paste(img, ((tw - new_w) // 2, (th - new_h) // 2))
    return canvas

print("=== Midmatch backlash cards ===")
for card_id, orig_file in MIDMATCH:
    orig_path = os.path.join(EXTRACT_DIR, orig_file)
    out_path = os.path.join(CARDS_DIR, f"{card_id}.png")
    if not os.path.exists(orig_path):
        print(f"  SKIP {card_id}"); continue

    img = Image.open(orig_path).convert('RGBA')
    print(f"  {card_id}: {img.size}")

    img = trim_black(img)
    print(f"    trimmed: {img.size}")

    # Scale to fit inside 300x420, center on black canvas
    img = contain_in_target(img, TARGET_W, TARGET_H)
    img.save(out_path)
    print(f"    -> {img.size}")

print("\n=== Bookend ===")
bank_path = os.path.join(ROOT, "scripts", "generated", "bank", "PDF FINAL RAW DEAL RVD BOOKER T", "7.jpg")
out_path = os.path.join(CARDS_DIR, "bookend.png")
if os.path.exists(bank_path):
    img = Image.open(bank_path).convert('RGBA')
    print(f"  bookend: {img.size}")
    img = trim_black(img)
    print(f"    trimmed: {img.size}")
    img = contain_in_target(img, TARGET_W, TARGET_H)
    img.save(out_path)
    print(f"    -> {img.size}")

print("\nDone!")
