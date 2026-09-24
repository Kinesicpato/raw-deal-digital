#!/usr/bin/env python3
"""Re-crop the Extras card art that was re-exported as raw 610x610 squares.

The last import copied the untouched docx images back into public/cards, so
those cards rendered narrow (the card only occupies ~71% of the frame, the
rest being transparent/black padding). This script strips the background,
then resizes each card to the standard 300x420 so it fills the full width.
"""

import os

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
CARDS_DIR = os.path.join(ROOT, "public", "cards")
TARGET_W, TARGET_H = 300, 420

EXTRAS_IDS = [
    "bash-punch",
    "rolling-neck-breaker",
    "stretch-opponent",
    "shoot-lock-up",
    "fujiwara-arm-bar",
    "precision-suplex",
    "quick-snap-suplex",
    "bash-headlock",
    "the-power-is-back",
    "listen-loud-and-clear",
    "headlock-takedown",
    "no-pain-no-chain",
    "precision-figure-four",
    "fisticuffs",
    "give-and-take",
    "kidney-punch",
    "knee-breaker",
    "back-fist",
    "wrist-breaker",
    "standing-drop-kick",
    "stagger",
    "running-spinebuster",
    "not-yet",
    "360-degree-clothesline",
    "great-technical-knowledge",
    "dont-cross-the-boss",
]


def content_bbox(img):
    """Bounding box of the card itself, ignoring transparent/black padding."""
    if img.mode in ("RGBA", "LA") or "transparency" in img.info:
        alpha = img.convert("RGBA").getchannel("A")
        bbox = alpha.getbbox()
        if bbox:
            return bbox

    rgb = img.convert("RGB")
    background = Image.new("RGB", rgb.size, (0, 0, 0))
    diff = ImageChops.difference(rgb, background)
    # Ignore near-black noise from antialiasing.
    return diff.point(lambda v: 255 if v > 12 else 0).getbbox()


def process(card_id):
    path = os.path.join(CARDS_DIR, f"{card_id}.png")
    if not os.path.exists(path):
        print(f"  SKIP {card_id}: not found")
        return

    img = Image.open(path)
    if img.size == (TARGET_W, TARGET_H):
        print(f"  OK   {card_id}: already {img.size}")
        return

    src_size = img.size
    bbox = content_bbox(img)
    img = img.convert("RGB")
    if bbox:
        img = img.crop(bbox)

    iw, ih = img.size
    # Fit the whole card inside the frame, maximizing the used width.
    scale = min(TARGET_W / iw, TARGET_H / ih)
    new_w = min(TARGET_W, int(round(iw * scale)))
    new_h = min(TARGET_H, int(round(ih * scale)))
    img = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (TARGET_W, TARGET_H), (0, 0, 0))
    canvas.paste(img, ((TARGET_W - new_w) // 2, (TARGET_H - new_h) // 2))
    canvas.save(path)
    print(
        f"  FIXED {card_id}: {src_size} -> bbox {bbox} -> "
        f"{new_w}x{new_h} on {TARGET_W}x{TARGET_H}"
    )


print("=== Extras cards (strip background, widen to 300x420) ===")
for cid in EXTRAS_IDS:
    process(cid)
print("\nDone!")
