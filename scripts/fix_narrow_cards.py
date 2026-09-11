#!/usr/bin/env python3
"""Re-process 7 card images that were too narrow due to black borders."""
import os
from pathlib import Path
from PIL import Image

CARDS_DIR = Path(__file__).resolve().parent.parent / "public" / "cards"
SET11_DIR = Path(__file__).resolve().parent.parent / "Decks" / "Set_11-09_extracted" / "word" / "media"

TARGET_W, TARGET_H = 300, 420

# Cards to re-process: (source_filename, output_slug)
REPROCESS = [
    ("image41.png", "the-price-we-pay"),
    ("image14.png", "and-the-crowd-roars"),
    ("image4.png", "hellfire-chokeslam"),
    ("image3.png", "no-chance-in-hell"),
    ("image18.png", "back-breaker-torture-rack"),
    ("image19.png", "chain-lashing"),
    ("image20.png", "shoot-kicker-hold"),
]


def detect_card_bbox(img: Image.Image):
    """Detect card bounding box by finding non-black content."""
    w, h = img.size
    gray = img.convert("L")
    gpx = gray.load()

    # Find non-black pixels (threshold higher to exclude dark backgrounds)
    threshold = 30

    top = 0
    for y in range(h):
        row_bright = sum(1 for x in range(w) if gpx[x, y] > threshold)
        if row_bright > w * 0.15:
            top = y
            break

    bottom = h - 1
    for y in range(h - 1, -1, -1):
        row_bright = sum(1 for x in range(w) if gpx[x, y] > threshold)
        if row_bright > w * 0.15:
            bottom = y
            break

    left = 0
    for x in range(w):
        col_bright = sum(1 for y in range(h) if gpx[x, y] > threshold)
        if col_bright > h * 0.15:
            left = x
            break

    right = w - 1
    for x in range(w - 1, -1, -1):
        col_bright = sum(1 for y in range(h) if gpx[x, y] > threshold)
        if col_bright > h * 0.15:
            right = x
            break

    return left, top, right, bottom


def process_card(src_path: Path, slug: str):
    """Process a single card image."""
    out_path = CARDS_DIR / f"{slug}.png"

    img = Image.open(src_path).convert("RGB")
    w, h = img.size
    print(f"  Source: {src_path.name} ({w}x{h})")

    left, top, right, bottom = detect_card_bbox(img)
    card_w = right - left
    card_h = bottom - top
    print(f"  Detected card area: ({left},{top}) -> ({right},{bottom}) = {card_w}x{card_h}")

    # Crop to card area with 1px padding
    left = max(0, left - 1)
    top = max(0, top - 1)
    right = min(w - 1, right + 1)
    bottom = min(h - 1, bottom + 1)

    card = img.crop((left, top, right + 1, bottom + 1))
    card = card.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    card.save(out_path, "PNG")
    print(f"  Saved: {out_path.name}")


def main():
    for filename, slug in REPROCESS:
        src_path = SET11_DIR / filename
        if not src_path.exists():
            print(f"  MISSING: {src_path}")
            continue
        process_card(src_path, slug)
    print("\nDone!")


if __name__ == "__main__":
    main()
