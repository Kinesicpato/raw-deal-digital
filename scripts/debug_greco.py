#!/usr/bin/env python3
"""Debug: sample pixel values along edges."""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).resolve().parent.parent / "Decks" / "Shelton_Benjamin_extracted" / "word" / "media" / "image1.jpg"
img = Image.open(SRC).convert("RGB")
w, h = img.size
print(f"Image: {w}x{h}")

# Sample top rows
print("\nTop rows (middle column):")
for y in [0, 5, 10, 15, 20, 25, 30, 35, 40]:
    px = img.getpixel((w//2, y))
    print(f"  y={y}: RGB={px} sum={sum(px)}")

# Sample bottom rows
print("\nBottom rows (middle column):")
for y in [h-1, h-5, h-10, h-15, h-20, h-25, h-30]:
    px = img.getpixel((w//2, y))
    print(f"  y={y}: RGB={px} sum={sum(px)}")

# Sample left columns
print("\nLeft columns (middle row):")
for x in [0, 5, 10, 15, 20, 25, 30]:
    px = img.getpixel((x, h//2))
    print(f"  x={x}: RGB={px} sum={sum(px)}")

# Sample right columns
print("\nRight columns (middle row):")
for x in [w-1, w-5, w-10, w-15, w-20, w-25, w-30]:
    px = img.getpixel((x, h//2))
    print(f"  x={x}: RGB={px} sum={sum(px)}")
