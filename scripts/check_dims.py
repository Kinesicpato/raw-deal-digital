from PIL import Image
import os

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
    if os.path.exists(path):
        img = Image.open(path)
        print(f'{c}.png: {img.size} mode={img.mode}')
    else:
        print(f'{c}.png: NOT FOUND')
