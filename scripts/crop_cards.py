from PIL import Image, ImageChops
import os

def crop_whitespace(img, threshold=240):
    bg = Image.new(img.mode, img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -threshold)
    bbox = diff.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

cards = [
    'arm-breaker',
    'double-leg-takedown',
    'european-uppercut',
    'fall-away-suplex',
    'samoan-drop',
    'sidewalk-slam',
    'shoot-punch',
    'snap-neckbreaker',
    'super-hold',
    'bookend',
    'spinning-straight-elbow',
]

for c in cards:
    path = f'public/cards/{c}.png'
    if not os.path.exists(path):
        print(f'SKIP {c}.png NOT FOUND')
        continue
    img = Image.open(path).convert('RGB')
    orig = img.size
    cropped = crop_whitespace(img)
    # Resize to standard 300x420
    result = cropped.resize((300, 420), Image.LANCZOS)
    result.save(path, 'PNG')
    print(f'{c}.png: {orig} -> cropped {cropped.size} -> resized {result.size}')
