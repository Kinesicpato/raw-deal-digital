import json, os, re, sys
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

sys.stdout.reconfigure(encoding="utf-8")
BANK = r"scripts\generated\bank\Extras Jericho"
engine = RapidOCR()

def ocr(p):
    try:
        res, _ = engine(p)
        return [] if not res else res
    except Exception:
        return []

def band_text(p, frac):
    im = Image.open(p)
    W, H = im.size
    band = im.crop((0, 0, W, int(H * frac)))
    if max(band.size) > 1100:
        sc = 1100.0 / max(band.size)
        band = band.resize((int(band.width * sc), int(band.height * sc)), Image.LANCZOS)
    tmp = p + ".ocr.png"
    band.save(tmp)
    res = ocr(tmp)
    if os.path.exists(tmp):
        os.remove(tmp)
    lines = sorted([(t, (r[0][1], r[0][0])) for r in res for t in [r[1]]], key=lambda x: (x[1][1], x[1][0]))
    return [t for t, _ in lines]

for f in sorted(os.listdir(BANK)):
    if not f.endswith((".png", ".jpg")) or f.startswith("sheet_src"):
        continue
    p = os.path.join(BANK, f)
    top = band_text(p, 0.16)
    print("=" * 70)
    print(f, "| top:", " / ".join(top))
    # stats boxes: OCR right column area around F and D labels is unreliable,
    # try full image and grab lines around 'Fortitude'/'Damage'
    full = band_text(p, 1.0)
    print("   body:", " / ".join(full[:22]))