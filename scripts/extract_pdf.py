# Extracts every card face from a Raw Deal PDF into the card bank.
#
# A PDF is treated as an undifferentiated source of card art (it is NOT assumed
# to be a specific superstar's deck). The extraction:
#   1. collects every placed card-sized image (portrait and landscape),
#   2. detects multi-card sheets (a big raster holding a 3x3 grid) and crops
#      each cell, so no card is missed,
#   3. saves everything to scripts/generated/bank/<pdf-stem>/ as PNG files and
#      writes an index.json with each file's OCR'd printed title.
#
# Usage:
#   python scripts/extract_pdf.py [path/to/Deck.pdf]
#   (defaults to processing every *.pdf in the Decks/ folder)
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
DECKS = os.path.join(ROOT, "Decks")
BANK = os.path.join(HERE, "generated", "bank")

MIN_EDGE = 100  # pt; ignore tiny stamps/logos
SHEET_MIN = 500  # pt; a raster larger than this is a multi-card sheet


def collect_page(doc, page):
    """Return placed (xref, width_pt, height_pt) for card-sized images."""
    placed = []
    for im in page.get_images(full=True):
        xref = im[0]
        try:
            rects = page.get_image_rects(xref)
        except Exception:
            rects = []
        for rr in rects:
            if rr.width > MIN_EDGE and rr.height > MIN_EDGE:
                placed.append((xref, rr.width, rr.height))
    return placed


def is_sheet(place_w, place_h):
    """A multi-card sheet is placed much larger than a 180x254pt card."""
    return max(place_w, place_h) > SHEET_MIN


def export_image(doc, xref, dest):
    info = doc.extract_image(xref)
    ext = "jpg" if info["ext"] == "jpeg" else info["ext"]
    fp = os.path.join(dest, "%d.%s" % (xref, ext))
    with open(fp, "wb") as f:
        f.write(info["image"])
    return fp, info


def crop_sheet(doc, xref, outdir):
    """A big raster sheet holds several cards; crop a grid from it."""
    info = doc.extract_image(xref)
    ext = "jpg" if info["ext"] == "jpeg" else info["ext"]
    src = os.path.join(outdir, "sheet_src.%s" % ext)
    with open(src, "wb") as f:
        f.write(info["image"])
    try:
        from PIL import Image
        from rapidocr_onnxruntime import RapidOCR
    except Exception as e:
        print("   (skip sheet crop: %s)" % e)
        return []
    im = Image.open(src)
    W, H = im.size
    cols = [0, W // 3, 2 * W // 3, W]
    rows = [0, H // 3, 2 * H // 3, H]
    engine = RapidOCR()
    cells = []
    for r in range(3):
        for c in range(3):
            crop = im.crop((cols[c], rows[r], cols[c + 1], rows[r + 1]))
            # Include the sheet xref: one PDF can hold several sheets and the
            # cells must not collide with each other.
            fp = os.path.join(outdir, "s_%d_r%dc%d.png" % (xref, r, c))
            crop.save(fp)
            title = ""
            try:
                res, _ = engine(fp)
                if res:
                    title = " / ".join(t for _, t, _ in res[:2])
            except Exception:
                pass
            cells.append({"file": os.path.basename(fp), "ocr": title})
    os.remove(src)
    return cells


def process(pdf):
    import fitz

    stem = os.path.splitext(os.path.basename(pdf))[0]
    outdir = os.path.join(BANK, stem)
    os.makedirs(outdir, exist_ok=True)
    doc = fitz.open(pdf)

    unique = {}  # xref -> path
    for page in doc:
        for xref, w, h in collect_page(doc, page):
            if xref not in unique:
                fp, info = export_image(doc, xref, outdir)
                unique[xref] = {"path": fp, "w": info["width"], "h": info["height"], "pw": w, "ph": h}

    # Detect multi-card sheets among the extracted rasters (by placement size).
    index = []
    for xref, meta in unique.items():
        big = is_sheet(meta["pw"], meta["ph"])
        entry = {"file": os.path.basename(meta["path"]), "ocr": "", "sheet": big}
        index.append(entry)
        if big:
            print("  sheet xref %d placed %.0fx%.0f (%dx%d px) -> cropping grid" % (
                xref, meta["pw"], meta["ph"], meta["w"], meta["h"]))
            for cell in crop_sheet(doc, xref, outdir):
                if cell["file"] not in [x["file"] for x in index]:
                    index.append(cell)

    with open(os.path.join(outdir, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"source": os.path.basename(pdf), "cards": index}, f, ensure_ascii=False, indent=1)
    print("%s: %d card images -> %s" % (stem, len(index), outdir))


def main():
    pdfs = []
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if arg and os.path.isfile(arg):
        pdfs = [arg]
    else:
        pdfs = [os.path.join(DECKS, f) for f in sorted(os.listdir(DECKS)) if f.lower().endswith(".pdf")]
    if not pdfs:
        print("No PDFs found in %s" % DECKS)
        return
    for pdf in pdfs:
        print("processing", pdf)
        process(pdf)


if __name__ == "__main__":
    main()