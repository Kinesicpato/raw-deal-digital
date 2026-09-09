#!/usr/bin/env python3
"""Process Mid Match Virtual (backlash) and Set 9-09 card images."""
from PIL import Image, ImageChops
import os, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_CARDS = os.path.join(ROOT, 'public', 'cards')
os.makedirs(PUBLIC_CARDS, exist_ok=True)

def crop_whitespace(img, threshold=240):
    bg = Image.new(img.mode, img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -threshold)
    bbox = diff.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

def process_card(src_path, dest_id, is_backlash=False):
    """Crop, resize to 300x420, save as PNG."""
    img = Image.open(src_path).convert('RGBA')
    orig = img.size

    if is_backlash:
        # Backlash cards are horizontal - crop whitespace then resize
        cropped = crop_whitespace(img)
        # Resize maintaining aspect, then fit to 300x420
        cw, ch = cropped.size
        scale = min(300 / cw, 420 / ch)
        new_w = int(cw * scale)
        new_h = int(ch * scale)
        resized = cropped.resize((new_w, new_h), Image.LANCZOS)
        # Paste centered on 300x420 black background
        canvas = Image.new('RGBA', (300, 420), (0, 0, 0, 255))
        x = (300 - new_w) // 2
        y = (420 - new_h) // 2
        canvas.paste(resized, (x, y), resized)
        result = canvas
    else:
        # Regular cards - crop whitespace then resize to 300x420
        cropped = crop_whitespace(img)
        result = cropped.resize((300, 420), Image.LANCZOS)

    dest_path = os.path.join(PUBLIC_CARDS, f'{dest_id}.png')
    result.save(dest_path, 'PNG')
    print(f'  {dest_id}.png: {orig} -> {result.size}')

# --- Mid Match Virtual (backlash cards, horizontal) ---
MIDMATCH_VIRTUAL = [
    ('image1.png', 'sustained-damage'),
    ('image2.png', 'you-think-you-know-me'),
    ('image3.png', 'mr-monday-night'),
    ('image4.png', 'dude-nice-hang-time'),
    ('image5.png', 'when-you-thought-you-had-all-the-answers'),
    ('image6.png', 'the-ref-takes-control'),
]

print('=== MID MATCH VIRTUAL (backlash) ===')
midmatch_dir = os.path.join(ROOT, 'Decks', 'midmatch_virtual_extracted', 'word', 'media')
for img_name, card_id in MIDMATCH_VIRTUAL:
    src = os.path.join(midmatch_dir, img_name)
    if os.path.exists(src):
        process_card(src, card_id, is_backlash=True)
    else:
        print(f'  SKIP {img_name} not found')

# --- Set 9-09 (individual card images, portrait) ---
SET909 = [
    ('image1.png', 'edge'),
    ('image2.png', 'counter-assault'),
    ('image3.png', 'atomic-lariat'),
    ('image4.png', 'booby-trap'),
    ('image5.png', 'the-raw-deal-revolution'),
    ('image6.png', 'takedown'),
    ('image7.png', 'youre-just-a-puppet'),
    ('image8.png', 'thats-how-i-roll'),
    ('image9.png', 'sharmell-sizzling-spouse'),
    ('image10.png', 'a-revolution-of-the-mind'),
    ('image11.png', 'counter-throw'),
    ('image12.png', 'downward-spiral'),
    ('image13.png', 'once-is-enough'),
    ('image14.png', 'edges-running-spear'),
    ('image15.png', 'edges-spear'),
    ('image16.png', 'edge-o-matic'),
    ('image17.png', 'scream-if-you-want-it'),
    ('image18.png', 'running-spinebuster'),
    ('image19.png', 'precision-kick'),
    ('image20.png', 'precision-haymaker'),
    ('image21.png', 'spine-buster'),
    ('image22.png', 'shoot-lock-up'),
    ('image23.png', 'listen-you-reekazoid'),
    ('image24.png', 'pump-kick'),
    ('image25.png', 'death-valley-driver'),
    ('image26.png', 'the-rated-r-superstar'),
    ('image27.png', 'edge-auction'),
    ('image28.png', 'its-great-to-be-back-here-in'),
    ('image29.png', 'manager-interferes'),
    ('image30.png', 'edge-kick'),
    ('image31.png', 'sodas-rule'),
    ('image32.png', 'all-talk-no-action'),
    ('image33.png', 'beating-the-odds'),
    ('image34.png', 'spine-buster-throwback'),
    ('image35.png', 'enough-with-the-trash-talk'),
]

print('\n=== SET 9-09 ===')
set909_dir = os.path.join(ROOT, 'Decks', 'set909_extracted', 'word', 'media')
for img_name, card_id in SET909:
    src = os.path.join(set909_dir, img_name)
    if os.path.exists(src):
        process_card(src, card_id)
    else:
        print(f'  SKIP {img_name} not found')

print('\nDone!')
