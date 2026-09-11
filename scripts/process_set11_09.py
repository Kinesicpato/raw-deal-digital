#!/usr/bin/env python3
"""Process card images from Set 11-09 and Mid Match Virtual (new backlash cards).

Crops source images to card area and resizes to 300x420 PNG.
"""
import os
from pathlib import Path
from PIL import Image

CARDS_DIR = Path(__file__).resolve().parent.parent / "public" / "cards"
MMV_DIR = Path(__file__).resolve().parent.parent / "Decks" / "Mid_Match_Virtual_extracted" / "word" / "media"
SET11_DIR = Path(__file__).resolve().parent.parent / "Decks" / "Set_11-09_extracted" / "word" / "media"

TARGET_W, TARGET_H = 300, 420

# (source_dir, image_filename, output_slug)
NEW_CARDS = [
    # --- Mid Match Virtual (new backlash cards) ---
    (MMV_DIR, "image1.png", "unscrupulous-s-o-b"),
    (MMV_DIR, "image2.png", "brothers-til-the-end"),
    (MMV_DIR, "image5.png", "you-dont-want-to-go-where-ive-been"),
    (MMV_DIR, "image6.png", "old-fashioned-lock-up"),
    (MMV_DIR, "image7.png", "journey-into-darkness"),
    (MMV_DIR, "image8.png", "the-king-interferes"),
    # --- Set 11-09 ---
    (SET11_DIR, "image3.png", "no-chance-in-hell"),
    (SET11_DIR, "image4.png", "hellfire-chokeslam"),
    (SET11_DIR, "image10.png", "chicken-wing"),
    (SET11_DIR, "image14.png", "and-the-crowd-roars"),
    (SET11_DIR, "image18.png", "back-breaker-torture-rack"),
    (SET11_DIR, "image19.png", "chain-lashing"),
    (SET11_DIR, "image20.png", "shoot-kicker-hold"),
    (SET11_DIR, "image24.png", "technical-splash-in-the-corner"),
    (SET11_DIR, "image25.png", "german-suplex"),
    (SET11_DIR, "image26.png", "commission-er-rules"),
    (SET11_DIR, "image27.png", "j-r-style-slobber-knocker"),
    (SET11_DIR, "image28.png", "bait-opponent"),
    (SET11_DIR, "image29.png", "eye-rake"),
    (SET11_DIR, "image32.png", "wrist-lock"),
    (SET11_DIR, "image33.png", "judo-takedown"),
    (SET11_DIR, "image34.png", "hair-pull"),
    (SET11_DIR, "image35.png", "technical-monkey-flip"),
    (SET11_DIR, "image36.png", "split-finger-lock"),
    (SET11_DIR, "image37.png", "apply-illegal-leverage"),
    (SET11_DIR, "image39.png", "technical-bear-hug"),
    (SET11_DIR, "image41.png", "the-price-we-pay"),
    (SET11_DIR, "image43.png", "jockeying-for-position"),
    (SET11_DIR, "image44.png", "back-breaker"),
    (SET11_DIR, "image45.png", "reverse-ddt"),
]


def detect_card_bbox(img: Image.Image):
    """Detect the card bounding box by finding dark borders."""
    w, h = img.size
    pixels = img.load()

    # Convert to grayscale
    gray = img.convert("L")
    gpx = gray.load()

    # Find dark pixels (card borders are black/dark)
    threshold = 60

    # Scan from edges inward to find card boundaries
    top = 0
    for y in range(h):
        row_dark = sum(1 for x in range(w) if gpx[x, y] < threshold)
        if row_dark > w * 0.3:
            top = y
            break

    bottom = h - 1
    for y in range(h - 1, -1, -1):
        row_dark = sum(1 for x in range(w) if gpx[x, y] < threshold)
        if row_dark > w * 0.3:
            bottom = y
            break

    left = 0
    for x in range(w):
        col_dark = sum(1 for y in range(h) if gpx[x, y] < threshold)
        if col_dark > h * 0.3:
            left = x
            break

    right = w - 1
    for x in range(w - 1, -1, -1):
        col_dark = sum(1 for y in range(h) if gpx[x, y] < threshold)
        if col_dark > h * 0.3:
            right = x
            break

    return left, top, right, bottom


def process_card(src_path: Path, slug: str):
    """Process a single card image."""
    out_path = CARDS_DIR / f"{slug}.png"
    if out_path.exists():
        print(f"  SKIP (exists): {slug}.png")
        return

    img = Image.open(src_path).convert("RGB")
    w, h = img.size
    print(f"  Source: {src_path.name} ({w}x{h})")

    # Detect card bounding box
    left, top, right, bottom = detect_card_bbox(img)
    card_w = right - left
    card_h = bottom - top
    print(f"  Detected card area: ({left},{top}) -> ({right},{bottom}) = {card_w}x{card_h}")

    # If detection failed or card is too small, use center crop
    if card_w < w * 0.4 or card_h < h * 0.4:
        print(f"  WARNING: Detection seems off, using center crop")
        aspect = TARGET_W / TARGET_H
        if w / h > aspect:
            new_h = h
            new_w = int(h * aspect)
            left = (w - new_w) // 2
            top = 0
            right = left + new_w
            bottom = h
        else:
            new_w = w
            new_h = int(w / aspect)
            left = 0
            top = (h - new_h) // 2
            right = w
            bottom = top + new_h

    # Crop to card area
    card = img.crop((left, top, right + 1, bottom + 1))

    # Resize to target dimensions
    card = card.resize((TARGET_W, TARGET_H), Image.LANCZOS)

    # Save
    card.save(out_path, "PNG")
    print(f"  Saved: {out_path.name}")


def main():
    print(f"Processing {len(NEW_CARDS)} new card images...")
    print(f"Output: {CARDS_DIR}\n")

    for src_dir, filename, slug in NEW_CARDS:
        src_path = src_dir / filename
        if not src_path.exists():
            print(f"  MISSING: {src_path}")
            continue
        process_card(src_path, slug)

    print("\nDone!")


if __name__ == "__main__":
    main()
