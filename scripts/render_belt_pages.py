import fitz
import os
from PIL import Image
import io

PDF_PATH = os.path.join(os.path.dirname(__file__), '..', 'Decks', 'belts.pdf')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'Decks')
os.makedirs(OUT_DIR, exist_ok=True)

doc = fitz.open(PDF_PATH)
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=150)
    out = os.path.join(OUT_DIR, f'belt-page-{i}.png')
    pix.save(out)
    print(f'Saved page {i} -> {out}')
doc.close()
