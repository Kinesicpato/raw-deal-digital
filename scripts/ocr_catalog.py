# Builds a structured OCR catalog of every unique card face in the bank.
# The card's top band holds the printed title, Fortitude value and subtypes;
# the body holds the effect text. Output: scripts/generated/ocr_catalog.json
import json
import os
import re

from PIL import Image
from rapidocr_onnxruntime import RapidOCR

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
BANK = os.path.join(HERE, "generated", "bank")
OUT = os.path.join(HERE, "generated", "ocr_catalog.json")

SUBTYPES = [
    ("trademark finisher", "Trademark Finisher"),
    ("high risk", "High Risk"),
    ("submission", "Submission"),
    ("strike", "Strike"),
    ("grapple", "Grapple"),
]

TRAITS = [
    ("universally unique", "Universally Unique"),
    ("unique", "Unique"),
    ("chain", "Chain"),
    ("set-up", "Set-up"),
    ("foreign object", "Foreign Object"),
    ("run-in", "Run-in"),
    ("special", "Special"),
    ("multi", "Multi"),
    ("volley", "Volley"),
    ("heat", "Heat"),
    ("active", "Active"),
    ("permanent", "Permanent"),
    ("restricted modification", "Restricted Modification"),
    ("face", "Face"),
    ("heel", "Heel"),
    ("raw", "Raw"),
    ("smackdown", "SmackDown"),
    ("throwback", "Throwback"),
    ("wrestling", "Wrestling"),
    ("event", "Event"),
    ("venue", "Venue"),
    ("feud", "Feud"),
    ("stipulation", "Stipulation"),
    ("manager", "Manager"),
    ("object", "Object"),
    ("set up", "Set-up"),
]

# Titles that are not player cards.
SKIP_TITLES = {
    "kurt", "mankind", "rvd", "hand size", "backstage area", "backstage",
    "authentic", "what a maneuver", "managed by", "sustained damage",
}


def norm(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def compact(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _ocr(engine, im, tmp):
    try:
        res, _ = engine(tmp)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    if not res:
        return []
    return [(txt, (r[0][1], r[0][0])) for r in res for txt in [r[1]]]


def ocr_band(path, frac):
    im = Image.open(path)
    W, H = im.size
    band = im.crop((0, 0, W, int(H * frac)))
    if max(band.size) > 1100:
        sc = 1100.0 / max(band.size)
        band = band.resize((int(band.width * sc), int(band.height * sc)), Image.LANCZOS)
    tmp = path + ".ocr.png"
    band.save(tmp)
    engine = getattr(ocr_band, "_engine", None)
    if engine is None:
        engine = RapidOCR()
        ocr_band._engine = engine
    lines = _ocr(engine, band, tmp)
    lines.sort(key=lambda x: (x[1][1], x[1][0]))
    return [t for t, _ in lines]


def is_footer(title):
    return bool(re.match(r"^\d+\s*/\s*\d+", title)) or compact(title).startswith("fantasy")


def main():
    cards_meta = json.load(open(os.path.join(HERE, "generated", "cards.json"), encoding="utf-8"))
    existing = set(norm(c["name"]) for c in cards_meta["cards"])
    by_title = {}
    for stem in sorted(os.listdir(BANK)):
        outdir = os.path.join(BANK, stem)
        if not os.path.isdir(outdir):
            continue
        for f in sorted(os.listdir(outdir)):
            if not f.endswith((".png", ".jpg")) or f.startswith("sheet_src"):
                continue
            p = os.path.join(outdir, f)
            band = ocr_band(p, 0.16)
            if not band:
                continue
            title = band[0].strip()
            tn = norm(title)
            if not tn or tn in SKIP_TITLES or is_footer(title):
                continue
            body = ocr_band(p, 1.0)
            # If the top band read a footer number, fall back to full-page first line.
            if not tn:
                continue
            if tn in existing:
                continue  # already defined in the app
            if tn not in by_title:
                full = " ".join(body).lower()
                fortitude = 0
                damage = 0
                for i, ln in enumerate(body):
                    s = ln.strip()
                    if s.lower() == "fortitude":
                        for j in range(i + 1, min(i + 3, len(body))):
                            if re.match(r"^\d+$", body[j].strip()):
                                fortitude = int(body[j].strip())
                                break
                    if s.lower() == "damage":
                        for j in range(i + 1, min(i + 3, len(body))):
                            if re.match(r"^\d+$", body[j].strip()):
                                damage = int(body[j].strip())
                                break
                # type detection over the top band + body keywords
                top = " ".join(band[1:]).lower()
                card_type = "Action"
                if "trademark finisher" in full or "finisher" in top:
                    card_type = "Maneuver"
                elif "high risk" in full or "highrisk" in compact(top):
                    card_type = "Maneuver"
                elif re.search(r"reversal\s*:", full) or "reversal:special" in compact(full) or "reversal" in top:
                    card_type = "Reversal"
                elif re.search(r"\bmaneuver\b", full) or any(s in top for s in ("strike", "grapple", "submission")):
                    card_type = "Maneuver"
                elif "action" in top or "mid-matchaction" in compact(top) or "pre-match" in full:
                    card_type = "Action"
                subtypes = []
                for pat, s in SUBTYPES:
                    if re.search(r"\b%s\b" % re.escape(pat), top) and s not in subtypes:
                        subtypes.append(s)
                traits = []
                for pat, t in TRAITS:
                    if re.search(r"\b%s\b" % re.escape(pat), full) and t not in traits:
                        traits.append(t)
                text_lines = []
                for ln in body:
                    s = ln.strip()
                    ls = s.lower()
                    if not s or s == title:
                        continue
                    if ls in ("fortitude", "damage") or re.match(r"^\d+$", s):
                        continue
                    if "not for resale" in ls or "fair use" in ls or "fair guidelines" in ls or re.match(r"^\d+/\d+", s):
                        continue
                    text_lines.append(s)
                text = re.sub(r"\s+", " ", " ".join(text_lines)).strip()
                by_title[tn] = {
                    "key": tn,
                    "sample": "%s/%s" % (stem, f),
                    "title": title,
                    "fortitude": fortitude,
                    "damage": damage,
                    "type": card_type,
                    "subtypes": subtypes,
                    "traits": traits,
                    "text": text,
                }
    catalog = sorted(by_title.values(), key=lambda c: c["key"])
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(catalog, fh, ensure_ascii=False, indent=1)
    print("new-card catalog entries:", len(catalog), "->", OUT)


if __name__ == "__main__":
    main()
