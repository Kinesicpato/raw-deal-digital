#!/usr/bin/env python3
"""Fix Greco Roman Specialists - fit within 300x420 preserving full card."""
from pathlib import Path
from PIL import Image

CARDS_DIR = Path(__file__).resolve().parent.parent / "public" / "cards"
SRC = Path(__file__).resolve().parent.parent / "Decks" / "Shelton_Benjamin_extracted" / "word" / "media" / "image1.jpg"

TARGET_W, TARGET_H = 300, 420

img = Image.open(SRC).convert("RGB")
w, h = img.size

# Crop thin outer border (white edges + very dark border)
left, top, right, bottom = 4, 23, 636, 453
card = img.crop((left, top, right, bottom))
cw, ch = card.size

# FIT within target (not fill) - preserves full card
scale = min(TARGET_W / cw, TARGET_H / ch)
new_w = int(cw * scale)
new_h = int(ch * scale)
card = card.resize((new_w, new_h), Image.LANCZOS)

# Center on dark canvas
canvas = Image.new("RGB", (TARGET_W, TARGET_H), (10, 10, 12))
x_off = (TARGET_W - new_w) // 2
y_off = (TARGET_H - new_h) // 2
canvas.paste(card, (x_off, y_off))

out = CARDS_DIR / "greco-roman-specialists.png"
canvas.save(out, "PNG")
print(f"Saved: {out.name} ({TARGET_W}x{TARGET_H}) card was {cw}x{ch} -> {new_w}x{new_h}")
