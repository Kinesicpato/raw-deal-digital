#!/usr/bin/env python3
"""Re-process ALL Set 11-09 card images with improved border detection."""
from pathlib import Path
from PIL import Image

CARDS_DIR = Path(__file__).resolve().parent.parent / "public" / "cards"
SET11_DIR = Path(__file__).resolve().parent.parent / "Decks" / "Set_11-09_extracted" / "word" / "media"

TARGET_W, TARGET_H = 300, 420

# All Set 11-09 new cards: (source_filename, output_slug)
SET11_CARDS = [
    ("image3.png", "no-chance-in-hell"),
    ("image4.png", "hellfire-chokeslam"),
    ("image10.png", "chicken-wing"),
    ("image14.png", "and-the-crowd-roars"),
    ("image18.png", "back-breaker-torture-rack"),
    ("image19.png", "chain-lashing"),
    ("image20.png", "shoot-kicker-hold"),
    ("image24.png", "technical-splash-in-the-corner"),
    ("image25.png", "german-suplex"),
    ("image26.png", "commission-er-rules"),
    ("image27.png", "j-r-style-slobber-knocker"),
    ("image28.png", "bait-opponent"),
    ("image29.png", "eye-rake"),
    ("image32.png", "wrist-lock"),
    ("image33.png", "judo-takedown"),
    ("image34.png", "hair-pull"),
    ("image35.png", "technical-monkey-flip"),
    ("image36.png", "split-finger-lock"),
    ("image37.png", "apply-illegal-leverage"),
    ("image39.png", "technical-bear-hug"),
    ("image41.png", "the-price-we-pay"),
    ("image43.png", "jockeying-for-position"),
    ("image44.png", "back-breaker"),
    ("image45.png", "reverse-ddt"),
]


def detect_card_bbox(img: Image.Image):
    """Detect card bounding box by finding non-black content."""
    w, h = img.size
    gray = img.convert("L")
    gpx = gray.load()

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
    out_path = CARDS_DIR / f"{slug}.png"
    img = Image.open(src_path).convert("RGB")
    w, h = img.size

    left, top, right, bottom = detect_card_bbox(img)
    card_w = right - left
    card_h = bottom - top

    # Skip if card fills >85% of image (already good)
    if card_w > w * 0.85 and card_h > h * 0.85:
        card = img.crop((0, 0, w, h))
    else:
        # Add small padding
        left = max(0, left - 1)
        top = max(0, top - 1)
        right = min(w - 1, right + 1)
        bottom = min(h - 1, bottom + 1)
        card = img.crop((left, top, right + 1, bottom + 1))

    card = card.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    card.save(out_path, "PNG")
    print(f"  {slug}.png ({w}x{h}) -> crop({left},{top},{right},{bottom}) = {right-left+1}x{bottom-top+1}")


def main():
    for filename, slug in SET11_CARDS:
        src_path = SET11_DIR / filename
        if not src_path.exists():
            print(f"  MISSING: {src_path}")
            continue
        process_card(src_path, slug)
    print("\nDone!")


if __name__ == "__main__":
    main()
