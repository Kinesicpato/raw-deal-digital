#!/usr/bin/env python3
"""Crop and resize the docx-extracted card images to match existing 300x420 dimensions."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
CARDS_DIR = os.path.join(ROOT, "public", "cards")

TARGET_W, TARGET_H = 300, 420
TARGET_RATIO = TARGET_W / TARGET_H  # 0.714

MIDMATCH_IDS = [
    'dirty-low-blow', 'backlash-card', 'chain-barrier',
    'tormented-tomfoolery', 'precision-personified', 'backfire',
]

EXTRAS_IDS = [
    'bash-punch', 'rolling-neck-breaker', 'stretch-opponent', 'shoot-lock-up',
    'fujiwara-arm-bar', 'precision-suplex', 'quick-snap-suplex', 'bash-headlock',
    'the-power-is-back', 'listen-loud-and-clear', 'headlock-takedown',
    'no-pain-no-chain', 'precision-figure-four', 'fisticuffs', 'give-and-take',
    'kidney-punch', 'knee-breaker', 'back-fist', 'wrist-breaker',
    'standing-drop-kick', 'stagger', 'running-spinebuster', 'pendulum-back-breaker',
    'not-yet', '360-degree-clothesline', 'great-technical-knowledge', 'dont-cross-the-boss',
]

def crop_to_ratio(img):
    """Crop a square image to the target aspect ratio by trimming equally from left and right."""
    w, h = img.size
    current_ratio = w / h
    if abs(current_ratio - TARGET_RATIO) < 0.01:
        return img
    if current_ratio > TARGET_RATIO:
        # Too wide — trim width
        new_w = int(h * TARGET_RATIO)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    else:
        # Too tall — trim height
        new_h = int(w / TARGET_RATIO)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))
    return img

def process_card(card_id):
    path = os.path.join(CARDS_DIR, f"{card_id}.png")
    if not os.path.exists(path):
        print(f"  SKIP {card_id}: not found")
        return
    img = Image.open(path)
    if img.size == (TARGET_W, TARGET_H):
        print(f"  OK {card_id}: already {img.size}")
        return
    
    # Auto-trim black borders
    bbox = img.getbbox()
    if bbox:
        # Check if there are significant black borders
        left, top, right, bottom = bbox
        border_pct = (left + top + (img.width - right) + (img.height - bottom)) / (img.width + img.height)
        if border_pct > 0.02:
            img = img.crop(bbox)
    
    # Crop to target ratio
    img = crop_to_ratio(img)
    
    # Resize to target dimensions
    img = img.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    img.save(path)
    print(f"  FIXED {card_id}: -> {img.size}")

print("=== Midmatch backlash cards ===")
for cid in MIDMATCH_IDS:
    process_card(cid)

print("\n=== Extras cards ===")
for cid in EXTRAS_IDS:
    process_card(cid)

print("\nDone!")
