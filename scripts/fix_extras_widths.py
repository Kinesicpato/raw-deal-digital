#!/usr/bin/env python3
"""Normalize card art: strip the black/transparent frame and fit 300x420.

Some imports copied the raw docx scans back into public/cards (610x610
squares with transparent padding, or unsized scans). Those cards render
narrow because the padding eats the frame. This script crops the background
away and re-renders every card that is not already 300x420 at the standard
size, using as much of the frame as the card's aspect ratio allows
(landscape cards keep the usual letterbox, like the other Backlash cards).
"""

import os

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
CARDS_DIR = os.path.join(ROOT, "public", "cards")
TARGET_W, TARGET_H = 300, 420


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


def process(path, img):
    name = os.path.basename(path)
    src_size = img.size
    bbox = content_bbox(img)
    img = img.convert("RGB")
    if bbox:
        img = img.crop(bbox)

    iw, ih = img.size
    # Fit the whole card inside the frame, maximizing the used area.
    scale = min(TARGET_W / iw, TARGET_H / ih)
    new_w = min(TARGET_W, int(round(iw * scale)))
    new_h = min(TARGET_H, int(round(ih * scale)))
    img = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (TARGET_W, TARGET_H), (0, 0, 0))
    canvas.paste(img, ((TARGET_W - new_w) // 2, (TARGET_H - new_h) // 2))
    canvas.save(path)
    print(
        f"  FIXED {name}: {src_size} -> bbox {bbox} -> "
        f"{new_w}x{new_h} on {TARGET_W}x{TARGET_H}"
    )


def main():
    print("=== Cards not yet 300x420 (strip background, normalize) ===")
    fixed = skipped = 0
    for name in sorted(os.listdir(CARDS_DIR)):
        if not name.lower().endswith(".png"):
            continue
        path = os.path.join(CARDS_DIR, name)
        try:
            img = Image.open(path)
        except Exception as exc:  # noqa: BLE001 - report and keep going
            print(f"  SKIP {name}: unreadable ({exc})")
            skipped += 1
            continue
        if img.size == (TARGET_W, TARGET_H):
            continue
        process(path, img)
        fixed += 1
    print(f"\nDone! {fixed} fixed, {skipped} skipped.")


if __name__ == "__main__":
    main()
