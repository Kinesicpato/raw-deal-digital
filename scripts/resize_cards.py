#!/usr/bin/env python3
"""Make specific cards bigger/wider as requested."""
from PIL import Image, ImageChops
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC = os.path.join(ROOT, 'public', 'cards')
BANK = os.path.join(ROOT, 'scripts', 'generated', 'bank')
DECKS = os.path.join(ROOT, 'Decks')
W, H = 300, 420

def crop_whitespace(img, threshold=240):
    bg = Image.new(img.mode, img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -threshold)
    bbox = diff.getbbox()
    return img.crop(bbox) if bbox else img

def save(img, card_id):
    img.save(os.path.join(PUBLIC, f'{card_id}.png'), 'PNG')
    print(f'  {card_id}.png -> {img.size}')

# ── Enough With the Trash Talk: 15% bigger in all dimensions ──
# Source is landscape (500x333). Current uses backlash fit with margin.
# Make it fill 85% of canvas instead of fitting with default margin.
print('=== Enough With the Trash Talk (+15%) ===')
src = Image.open(os.path.join(DECKS, 'set909_extracted', 'word', 'media', 'image35.png')).convert('RGBA')
cropped = crop_whitespace(src)
cw, ch = cropped.size
# Target: 85% of canvas (was ~75% with default fit)
target_w = int(W * 0.88)
target_h = int(H * 0.88)
scale = min(target_w / cw, target_h / ch)
new_w, new_h = int(cw * scale), int(ch * scale)
resized = cropped.resize((new_w, new_h), Image.LANCZOS)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
canvas.paste(resized, ((W - new_w) // 2, (H - new_h) // 2), resized)
save(canvas, 'enough-with-the-trash-talk')

# ── Beating the Odds: wider only ──
# Source 610x610 (square). Make it wider within 300x420 canvas.
print('=== Beating the Odds (wider) ===')
src = Image.open(os.path.join(DECKS, 'set909_extracted', 'word', 'media', 'image33.png')).convert('RGBA')
cropped = crop_whitespace(src)
cw, ch = cropped.size
# Scale to use 90% of width, height proportional
target_w = int(W * 0.92)
scale = target_w / cw
new_w, new_h = int(cw * scale), int(ch * scale)
# Cap height at 85% of canvas
max_h = int(H * 0.88)
if new_h > max_h:
    scale2 = max_h / new_h
    new_w, new_h = int(new_w * scale2), max_h
resized = cropped.resize((new_w, new_h), Image.LANCZOS)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
canvas.paste(resized, ((W - new_w) // 2, (H - new_h) // 2), resized)
save(canvas, 'beating-the-odds')

# ── Triangle Choke: bigger in all dimensions ──
print('=== Triangle Choke (bigger) ===')
src = Image.open(os.path.join(BANK, 'elpepe-raw-deal', '305.png')).convert('RGBA')
cropped = crop_whitespace(src)
cw, ch = cropped.size
target_w = int(W * 0.90)
target_h = int(H * 0.90)
scale = min(target_w / cw, target_h / ch)
new_w, new_h = int(cw * scale), int(ch * scale)
resized = cropped.resize((new_w, new_h), Image.LANCZOS)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
canvas.paste(resized, ((W - new_w) // 2, (H - new_h) // 2), resized)
save(canvas, 'triangle-choke')

# ── Knee Lift: wider ──
print('=== Knee Lift (wider) ===')
src = Image.open(os.path.join(BANK, 'elpepe-raw-deal', '84.png')).convert('RGBA')
cropped = crop_whitespace(src)
cw, ch = cropped.size
target_w = int(W * 0.92)
scale = target_w / cw
new_w, new_h = int(cw * scale), int(ch * scale)
max_h = int(H * 0.88)
if new_h > max_h:
    scale2 = max_h / new_h
    new_w, new_h = int(new_w * scale2), max_h
resized = cropped.resize((new_w, new_h), Image.LANCZOS)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
canvas.paste(resized, ((W - new_w) // 2, (H - new_h) // 2), resized)
save(canvas, 'knee-lift')

# ── Diversion: wider ──
print('=== Diversion (wider) ===')
src = Image.open(os.path.join(BANK, 'elpepe-raw-deal', '122.png')).convert('RGBA')
cropped = crop_whitespace(src)
cw, ch = cropped.size
target_w = int(W * 0.92)
scale = target_w / cw
new_w, new_h = int(cw * scale), int(ch * scale)
max_h = int(H * 0.88)
if new_h > max_h:
    scale2 = max_h / new_h
    new_w, new_h = int(new_w * scale2), max_h
resized = cropped.resize((new_w, new_h), Image.LANCZOS)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 255))
canvas.paste(resized, ((W - new_w) // 2, (H - new_h) // 2), resized)
save(canvas, 'diversion')

print('\nDone!')
