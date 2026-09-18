import fitz
import os
from PIL import Image
import io

PDF_PATH = os.path.join(os.path.dirname(__file__), '..', 'Decks', 'belts.pdf')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'belts')
os.makedirs(OUT_DIR, exist_ok=True)

doc = fitz.open(PDF_PATH)
print(f'Pages: {len(doc)}')

belt_idx = 0
for i, page in enumerate(doc):
    images = page.get_images(full=True)
    print(f'Page {i}: {page.rect.width:.0f}x{page.rect.height:.0f}, images: {len(images)}')
    for j, img in enumerate(images):
        xref = img[0]
        base_image = doc.extract_image(xref)
        ext = base_image['ext']
        data = base_image['image']
        w = base_image['width']
        h = base_image['height']
        print(f'  Image {j}: {w}x{h} ({ext})')
        
        pil_img = Image.open(io.BytesIO(data)).convert('RGBA')
        
        # Remove white/near-white background
        pixels = pil_img.load()
        for y in range(pil_img.height):
            for x in range(pil_img.width):
                r, g, b, a = pixels[x, y]
                if r > 230 and g > 230 and b > 230:
                    pixels[x, y] = (r, g, b, 0)
        
        # Crop to bounding box of non-transparent pixels
        bbox = pil_img.getbbox()
        if bbox:
            pil_img = pil_img.crop(bbox)
        
        # Scale to max 300px wide, maintaining aspect ratio
        max_w = 300
        if pil_img.width > max_w:
            ratio = max_w / pil_img.width
            new_h = int(pil_img.height * ratio)
            pil_img = pil_img.resize((max_w, new_h), Image.LANCZOS)
        
        out_path = os.path.join(OUT_DIR, f'belt-{belt_idx}.png')
        pil_img.save(out_path, 'PNG')
        print(f'  Saved: {out_path} ({pil_img.width}x{pil_img.height})')
        belt_idx += 1

doc.close()
print(f'Done! Extracted {belt_idx} belts.')
