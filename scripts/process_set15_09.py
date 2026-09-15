#!/usr/bin/env python3
"""Process Set 15-09 card images: crop portraits to 300x420, handle landscape backlash cards."""

import os
from PIL import Image

MEDIA = r'C:\Users\patri\Downloads\raw-deal\Decks\Set_15-09_extracted\word\media'
OUT = r'C:\Users\patri\Downloads\raw-deal\public\cards'
TARGET_W, TARGET_H = 300, 420


def detect_card_bbox(img):
    """Detect card boundary using bright pixel detection (recrop_set11 approach)."""
    pixels = img.load()
    w, h = img.size
    
    # Use bright pixel detection - look for pixels brighter than threshold
    threshold = 30
    
    top = bottom = left = right = None
    
    # Scan rows
    for y in range(h):
        bright_count = sum(1 for x in range(w) if any(pixels[x, y][c] > threshold for c in range(3)))
        if bright_count > w * 0.15:
            if top is None:
                top = y
            bottom = y
    
    # Scan columns
    for x in range(w):
        bright_count = sum(1 for y in range(h) if any(pixels[x, y][c] > threshold for c in range(3)))
        if bright_count > h * 0.15:
            if left is None:
                left = x
            right = x
    
    if top is not None and left is not None:
        # Add padding
        top = max(0, top - 2)
        left = max(0, left - 2)
        bottom = min(h - 1, bottom + 2)
        right = min(w - 1, right + 2)
        return (left, top, right + 1, bottom + 1)
    
    return None


def crop_and_resize(img, target_w, target_h):
    """Crop to card bounds and resize to target dimensions."""
    bbox = detect_card_bbox(img)
    if bbox:
        img = img.crop(bbox)
    
    # Scale to fit within target
    iw, ih = img.size
    scale = min(target_w / iw, target_h / ih)
    new_w = int(iw * scale)
    new_h = int(ih * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    
    # Center on black background
    canvas = Image.new('RGB', (target_w, target_h), (0, 0, 0))
    offset_x = (target_w - new_w) // 2
    offset_y = (target_h - new_h) // 2
    canvas.paste(img, (offset_x, offset_y))
    return canvas


def process_landscape_backlash(img, target_w, target_h):
    """Process landscape backlash card: remove black background, fit to portrait dimensions."""
    # Find the card content using bright pixel detection
    bbox = detect_card_bbox(img)
    if bbox:
        img = img.crop(bbox)
    
    # Now fit the landscape image into portrait dimensions
    iw, ih = img.size
    
    # For backlash cards, we want to preserve the full card
    # Scale to fill width, then center vertically
    scale = target_w / iw
    new_w = target_w
    new_h = int(ih * scale)
    
    if new_h > target_h:
        # If too tall, scale down to fit height
        scale = target_h / ih
        new_w = int(iw * scale)
        new_h = target_h
    
    img = img.resize((new_w, new_h), Image.LANCZOS)
    
    # Center on black background
    canvas = Image.new('RGB', (target_w, target_h), (0, 0, 0))
    offset_x = (target_w - new_w) // 2
    offset_y = (target_h - new_h) // 2
    canvas.paste(img, (offset_x, offset_y))
    return canvas


# Portrait cards: image1-8
portrait_cards = [
    ('image1.png', 'your-brush-with-greatness-is-over'),
    ('image2.png', 'million-dollar-smile'),
    ('image4.png', 'bash-suplex'),
    ('image5.png', 'bear-hug'),
    ('image6.png', 'cause-i-want-more'),
    ('image7.png', 'big-splash-in-the-corner'),
    ('image8.png', 'backed-by-stephanie-mcmahon'),
]

# Edge superstar card (image3) - crop and save separately
EDGE_SUPERSTAR_SRC = os.path.join(MEDIA, 'image3.png')
EDGE_SUPERSTAR_DST = os.path.join(OUT, 'superstar-edge.png')

# Landscape backlash cards: image9-11
backlash_cards = [
    ('image9.png', 'the-edgeucation-of-adam-copeland'),
    ('image10.png', 'big-slide-into-the-ring'),
    ('image11.png', 'big-slide-in-the-ring'),
]

print("Processing Edge superstar card...")
img = Image.open(EDGE_SUPERSTAR_SRC).convert('RGB')
result = crop_and_resize(img, TARGET_W, TARGET_H)
result.save(EDGE_SUPERSTAR_DST)
print(f'  OK superstar-edge ({result.size[0]}x{result.size[1]})')

print("\nProcessing portrait cards...")
for filename, slug in portrait_cards:
    src = os.path.join(MEDIA, filename)
    dst = os.path.join(OUT, f'{slug}.png')
    # Force reprocess all
    img = Image.open(src).convert('RGB')
    result = crop_and_resize(img, TARGET_W, TARGET_H)
    result.save(dst)
    print(f'  OK {slug} ({result.size[0]}x{result.size[1]})')

print("\nProcessing landscape backlash cards...")
for filename, slug in backlash_cards:
    src = os.path.join(MEDIA, filename)
    dst = os.path.join(OUT, f'{slug}.png')
    img = Image.open(src).convert('RGB')
    result = process_landscape_backlash(img, TARGET_W, TARGET_H)
    result.save(dst)
    print(f'  OK {slug} ({result.size[0]}x{result.size[1]})')

print("\nDone!")
