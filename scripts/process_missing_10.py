#!/usr/bin/env python3
"""Process 10 missing Set 11-09 card images."""
from pathlib import Path
from PIL import Image

CARDS_DIR = Path(__file__).resolve().parent.parent / "public" / "cards"
SET11_DIR = Path(__file__).resolve().parent.parent / "Decks" / "Set_11-09_extracted" / "word" / "media"

TARGET_W, TARGET_H = 300, 420

NEW_CARDS = [
    ("image1.png", "flawless-execution"),
    ("image5.png", "big-enough-to-eat-somebody"),
    ("image6.png", "in-the-presence-of-the-kanenites"),
    ("image7.png", "helps-on-the-way"),
    ("image8.png", "masked-vengeance"),
    ("image9.png", "kanes-rage"),
    ("image11.png", "vise-lock"),
    ("image12.png", "testicular-fortitude"),
    ("image15.png", "small-package"),
    ("image16.png", "body-lock"),
]


def detect_card_bbox(img):
    w, h = img.size
    gray = img.convert("L")
    gpx = gray.load()
    threshold = 30

    top = 0
    for y in range(h):
        if sum(1 for x in range(w) if gpx[x, y] > threshold) > w * 0.15:
            top = y
            break

    bottom = h - 1
    for y in range(h - 1, -1, -1):
        if sum(1 for x in range(w) if gpx[x, y] > threshold) > w * 0.15:
            bottom = y
            break

    left = 0
    for x in range(w):
        if sum(1 for y in range(h) if gpx[x, y] > threshold) > h * 0.15:
            left = x
            break

    right = w - 1
    for x in range(w - 1, -1, -1):
        if sum(1 for y in range(h) if gpx[x, y] > threshold) > h * 0.15:
            right = x
            break

    return left, top, right, bottom


def main():
    for filename, slug in NEW_CARDS:
        src = SET11_DIR / filename
        out = CARDS_DIR / f"{slug}.png"
        if not src.exists():
            print(f"MISSING: {src}")
            continue
        img = Image.open(src).convert("RGB")
        w, h = img.size
        left, top, right, bottom = detect_card_bbox(img)
        cw, ch = right - left, bottom - top
        if cw > w * 0.85 and ch > h * 0.85:
            card = img.copy()
        else:
            left = max(0, left - 1)
            top = max(0, top - 1)
            right = min(w - 1, right + 1)
            bottom = min(h - 1, bottom + 1)
            card = img.crop((left, top, right + 1, bottom + 1))
        card = card.resize((TARGET_W, TARGET_H), Image.LANCZOS)
        card.save(out, "PNG")
        print(f"  {slug}.png ({w}x{h}) -> {cw}x{ch}")
    print("Done!")


if __name__ == "__main__":
    main()
