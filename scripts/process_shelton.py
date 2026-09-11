#!/usr/bin/env python3
"""Process Shelton Benjamin card images."""
from pathlib import Path
from PIL import Image

CARDS_DIR = Path(__file__).resolve().parent.parent / "public" / "cards"
SRC_DIR = Path(__file__).resolve().parent.parent / "Decks" / "Shelton_Benjamin_extracted" / "word" / "media"

TARGET_W, TARGET_H = 300, 420

CARDS = [
    ("image1.jpg", "greco-roman-specialists"),
    ("image2.jpg", "aint-no-stopping-me-now"),
    ("image3.jpg", "sheltons-spinning-heel-kick"),
    ("image4.jpg", "sheltons-splash"),
    ("image5.jpg", "t-bone-exploder-suplex"),
    ("image6.jpg", "its-all-about-the-benjamins"),
    ("image7.jpg", "incredible-athleticism"),
    ("image8.jpg", "sheltons-lunging-lariat"),
    ("image9.jpg", "ive-seen-the-light"),
    ("image10.png", "superstar-shelton-benjamin"),
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
    for filename, slug in CARDS:
        src = SRC_DIR / filename
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
            left, top, right, bottom = 0, 0, w - 1, h - 1
        else:
            left = max(0, left - 1)
            top = max(0, top - 1)
            right = min(w - 1, right + 1)
            bottom = min(h - 1, bottom + 1)
            card = img.crop((left, top, right + 1, bottom + 1))
        card = card.resize((TARGET_W, TARGET_H), Image.LANCZOS)
        card.save(out, "PNG")
        print(f"  {slug}.png ({w}x{h}) -> crop({left},{top},{right},{bottom})")
    print("Done!")


if __name__ == "__main__":
    main()
