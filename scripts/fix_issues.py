#!/usr/bin/env python3
"""Fix all card issues reported by user."""
from PIL import Image, ImageChops
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_CARDS = os.path.join(ROOT, 'public', 'cards')
BANK = os.path.join(ROOT, 'scripts', 'generated', 'bank')
DECKS = os.path.join(ROOT, 'Decks')

W, H = 300, 420

def crop_whitespace(img, threshold=240):
    bg = Image.new(img.mode, img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -threshold)
    bbox = diff.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

def process_regular(src_path, dest_id):
    """Portrait card: crop whitespace, resize to 300x420."""
    img = Image.open(src_path).convert('RGBA')
    orig = img.size
    cropped = crop_whitespace(img)
    result = cropped.resize((W, H), Image.LANCZOS)
    dest = os.path.join(PUBLIC_CARDS, f'{dest_id}.png')
    result.save(dest, 'PNG')
    print(f'  {dest_id}.png: {orig} -> {result.size}')

def process_backlash(src_path, dest_id):
    """Landscape/backlash card: crop, fit into 300x420 canvas centered."""
    img = Image.open(src_path).convert('RGBA')
    orig = img.size
    cropped = crop_whitespace(img)
    cw, ch = cropped.size
    scale = min(W / cw, H / ch)
    new_w = int(cw * scale)
    new_h = int(ch * scale)
    resized = cropped.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    x = (W - new_w) // 2
    y = (H - new_h) // 2
    canvas.paste(resized, (x, y), resized)
    dest = os.path.join(PUBLIC_CARDS, f'{dest_id}.png')
    canvas.save(dest, 'PNG')
    print(f'  {dest_id}.png: {orig} -> {canvas.size}')

# ── 1. Edge superstar card ──────────────────────────────────────────────
print('=== 1. Edge superstar card ===')
edge_src = os.path.join(PUBLIC_CARDS, 'edge.png')
superstar_edge_dest = os.path.join(PUBLIC_CARDS, 'superstar-edge.png')
if os.path.exists(edge_src):
    img = Image.open(edge_src)
    img.save(superstar_edge_dest, 'PNG')
    print(f'  Created superstar-edge.png ({img.size})')
else:
    print('  ERROR: edge.png not found')

# ── 2. Enough With the Trash Talk (landscape source 500x333, was squeezed) ─
print('\n=== 2. Enough With the Trash Talk ===')
# Source: Decks/set909_extracted/word/media/image35.png (500x333 landscape)
src = os.path.join(DECKS, 'set909_extracted', 'word', 'media', 'image35.png')
if os.path.exists(src):
    process_backlash(src, 'enough-with-the-trash-talk')
else:
    print(f'  Source not found: {src}')

# ── 3. Beating the Odds ─────────────────────────────────────────────────
print('\n=== 3. Beating the Odds ===')
# Source: Decks/set909_extracted/word/media/image33.png (610x610)
src = os.path.join(DECKS, 'set909_extracted', 'word', 'media', 'image33.png')
if os.path.exists(src):
    process_regular(src, 'beating-the-odds')
else:
    print(f'  Source not found: {src}')

# ── 4. Knee Lift (bigger) ───────────────────────────────────────────────
print('\n=== 4. Knee Lift ===')
src = os.path.join(BANK, 'elpepe-raw-deal', '84.png')
if os.path.exists(src):
    process_regular(src, 'knee-lift')
else:
    print(f'  Source not found: {src}')

# ── 5. Diversion (bigger) ───────────────────────────────────────────────
print('\n=== 5. Diversion ===')
src = os.path.join(BANK, 'elpepe-raw-deal', '122.png')
if os.path.exists(src):
    process_regular(src, 'diversion')
else:
    print(f'  Source not found: {src}')

# ── 6. Chop to the Chest (bigger) ───────────────────────────────────────
print('\n=== 6. Chop to the Chest ===')
src = os.path.join(BANK, 'elpepe-raw-deal', '424.png')
if os.path.exists(src):
    process_regular(src, 'chop-to-the-chest')
else:
    print(f'  Source not found: {src}')

# ── 7. Apply Legal Leverage (bigger) ────────────────────────────────────
print('\n=== 7. Apply Legal Leverage ===')
src = os.path.join(BANK, 'elpepe-raw-deal', '150.png')
if os.path.exists(src):
    process_regular(src, 'apply-legal-leverage')
else:
    print(f'  Source not found: {src}')

# ── 8. Cactus Extreme Promo Skills (rotate + fix) ───────────────────────
print('\n=== 8. Cactus Extreme Promo Skills ===')
# This is a Mid-match backlash card (horizontal).
# Source is from Cactus Jack PDF scan. Current image is 300x420 portrait.
# We need to find the original source and process as landscape.
current = os.path.join(PUBLIC_CARDS, 'cactus-extreme-promo-skills.png')
if os.path.exists(current):
    img = Image.open(current).convert('RGBA')
    print(f'  Current: {img.size} (w={img.width}, h={img.height})')
    # The image should be horizontal. If it's portrait (h > w), rotate it.
    if img.height > img.width:
        img = img.rotate(90, expand=True)
        print(f'  Rotated 90° -> {img.size}')
    # Process as backlash (landscape)
    cropped = crop_whitespace(img)
    cw, ch = cropped.size
    scale = min(W / cw, H / ch)
    new_w = int(cw * scale)
    new_h = int(ch * scale)
    resized = cropped.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    x = (W - new_w) // 2
    y = (H - new_h) // 2
    canvas.paste(resized, (x, y), resized)
    canvas.save(current, 'PNG')
    print(f'  Fixed -> {canvas.size}')

print('\nDone!')
