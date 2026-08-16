# Imports real card-face images from the card bank (scripts/generated/bank/)
# into public/cards/*.png so the UI shows the actual card artwork instead of
# generated placeholders.
#
# The bank is built by scripts/extract_pdf.py from any PDF in Decks/ (PDFs are
# an undifferentiated card source, not a specific superstar's deck). Each bank
# entry carries the OCR'd printed title; this script matches that title against
# cards.json and writes a 300x420 PNG per matched card.
#
# Usage:
#   python scripts/extract_pdf.py            # first: build the bank
#   python scripts/import_pdf_cards.py       # then: import matches
import json
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BANK = os.path.join(HERE, "generated", "bank")
CARDS = json.load(open(os.path.join(HERE, "generated", "cards.json"), encoding="utf-8"))["cards"]
OUT = os.path.abspath(os.path.join(HERE, "..", "public", "cards"))

# Manual overrides when OCR is ambiguous. Keys are bank-relative paths
# ("<pdf-stem>/<file>") -> card id. These were verified against the printed
# titles read from the PDFs in Decks/. Any bank entry without a verified
# mapping falls back to OCR name matching.
OVERRIDES = {
    # Kurt.pdf
    "Kurt/28.png": "kurt-angles-german-suplex",
    "Kurt/30.png": "kurt-angles-uppercut",
    "Kurt/32.jpg": "kurt-armed-dangerous",
    "Kurt/33.png": "kurt-handcuffed",
    "Kurt/35.jpg": "kurt-ankle-lock",
    "Kurt/36.jpg": "kurt-scoop-slam",
    "Kurt/37.jpg": "kurt-strangle-hold",
    "Kurt/38.jpg": "kurt-bear-hug",
    "Kurt/39.jpg": "kurt-garbage-can-lid",
    "Kurt/40.jpg": "kurt-atomic-driver",
    "Kurt/41.jpg": "kurt-everything-and-the-kitchen-sink",
    "Kurt/42.jpg": "kurt-atomic-body-lock",
    "Kurt/43.jpg": "kurt-brass-nuks-shot",
    "Kurt/44.jpg": "kurt-olympic-slam",
    "Kurt/45.png": "kurt-angle-lock",
    "Kurt/47.png": "kurt-angles-leg-bar",
    "Kurt/49.jpg": "kurt-take-your-own-medicine",
    "Kurt/50.jpg": "kurt-abdominal-rake",
    "Kurt/51.png": "kurt-microphone-cord",
    "Kurt/53.jpg": "kurt-steel-chain-shot",
    "Kurt/54.jpg": "kurt-the-maneuver-of-doom",
    "Kurt/55.jpg": "kurt-always-have-a-plan-b",
    "Kurt/56.jpg": "kurt-chain-wrestling",
    "Kurt/57.jpg": "kurt-chained-heat",
    "Kurt/58.jpg": "kurt-integrity",
    "Kurt/59.jpg": "kurt-intelligence",
    "Kurt/60.jpg": "kurt-intensity",
    "Kurt/61.png": "kurt-its-true-its-true",
    "Kurt/63.png": "kurt-hardcore-timekeepers-bell",
    "Kurt/66.jpg": "kurt-chained-aggression",
    "Kurt/67.jpg": "kurt-oh-its-true",
    "Kurt/68.jpg": "kurt-submit",
    "Kurt/69.jpg": "kurt-whoo",
    "Kurt/70.jpg": "kurt-ill-make-you-tap",
    "Kurt/71.png": "kurt-i-wont-stop",
    "Kurt/72.jpg": "kurt-where-are-your-medals",
    "Kurt/73.jpg": "kurt-the-switch",
    "Kurt/74.jpg": "kurt-do-you-live-by-the-three-is",
    "Kurt/75.jpg": "kurt-wrestling-with-a-broken-freakin-neck",
    "Kurt/78.png": "kurt-tap-match",
    "Kurt/80.jpg": "kurt-hold-on",
    "Kurt/65.jpg": "kurt-armageddon",
    # Kurt_merged.pdf — same deck with the same cards under different xrefs;
    # map each duplicate to the same card id so OCR never misassigns them.
    "Kurt_merged/17.jpg": None,
    "Kurt_merged/18.png": "kurt-angles-german-suplex",
    "Kurt_merged/20.png": "kurt-angles-uppercut",
    "Kurt_merged/22.jpg": "kurt-armed-dangerous",
    "Kurt_merged/23.png": "kurt-handcuffed",
    "Kurt_merged/25.jpg": "kurt-ankle-lock",
    "Kurt_merged/26.jpg": "kurt-scoop-slam",
    "Kurt_merged/27.jpg": "kurt-strangle-hold",
    "Kurt_merged/28.jpg": "kurt-bear-hug",
    "Kurt_merged/29.jpg": "kurt-garbage-can-lid",
    "Kurt_merged/30.jpg": "kurt-atomic-driver",
    "Kurt_merged/31.jpg": "kurt-everything-and-the-kitchen-sink",
    "Kurt_merged/32.jpg": "kurt-atomic-body-lock",
    "Kurt_merged/33.jpg": "kurt-brass-nuks-shot",
    "Kurt_merged/34.jpg": "kurt-olympic-slam",
    "Kurt_merged/35.png": "kurt-angle-lock",
    "Kurt_merged/37.png": "kurt-angles-leg-bar",
    "Kurt_merged/39.jpg": "kurt-take-your-own-medicine",
    "Kurt_merged/40.jpg": "kurt-abdominal-rake",
    "Kurt_merged/41.png": "kurt-microphone-cord",
    "Kurt_merged/43.jpg": "kurt-steel-chain-shot",
    "Kurt_merged/44.jpg": "kurt-the-maneuver-of-doom",
    "Kurt_merged/45.jpg": "kurt-always-have-a-plan-b",
    "Kurt_merged/46.jpg": "kurt-chain-wrestling",
    "Kurt_merged/47.jpg": "kurt-chained-heat",
    "Kurt_merged/48.jpg": "kurt-integrity",
    "Kurt_merged/49.jpg": "kurt-intelligence",
    "Kurt_merged/50.jpg": "kurt-intensity",
    "Kurt_merged/51.png": "kurt-its-true-its-true",
    "Kurt_merged/53.png": "kurt-hardcore-timekeepers-bell",
    "Kurt_merged/55.jpg": None,
    "Kurt_merged/56.jpg": "kurt-chained-aggression",
    "Kurt_merged/57.jpg": "kurt-oh-its-true",
    "Kurt_merged/58.jpg": "kurt-submit",
    "Kurt_merged/59.jpg": "kurt-whoo",
    "Kurt_merged/60.jpg": "kurt-ill-make-you-tap",
    "Kurt_merged/61.png": "kurt-i-wont-stop",
    "Kurt_merged/62.jpg": "kurt-where-are-your-medals",
    "Kurt_merged/63.jpg": "kurt-the-switch",
    "Kurt_merged/64.jpg": "kurt-do-you-live-by-the-three-is",
    "Kurt_merged/65.jpg": "kurt-wrestling-with-a-broken-freakin-neck",
    "Kurt_merged/66.png": None,
    "Kurt_merged/68.png": "kurt-tap-match",
    "Kurt_merged/70.jpg": "kurt-hold-on",
    "Kurt_merged/85.jpg": None,  # the sheet itself is not a single card
    "Kurt_merged/s_r0c0.png": "kurt-angles-something",
    "Kurt_merged/s_r0c1.png": "kurt-the-straps-are-down",
    "Kurt_merged/s_r1c1.png": "kurt-suicide-lariat",
    "Kurt_merged/s_r1c2.png": "kurt-let-me-get-a-shot-in",
    "Kurt_merged/s_r2c0.png": "kurt-body-lock",
    "Kurt_merged/s_r2c2.png": "kurt-atomic-power-slam",
    # elpepe-raw-deal.pdf single-cell crops: the real card face for these ids
    # (they used to match the multi-card sheet raster and render as a 3x3 grid).
    "elpepe-raw-deal/s_367_r0c0.png": "gen-elbow-to-the-face",
    "elpepe-raw-deal/s_451_r1c2.png": "gen-step-aside",
    "elpepe-raw-deal/s_487_r1c0.png": "gen-spit-at-opponent",
    "RVD/24.png": "gen-kick",
    "elpepe-raw-deal/s_367_r2c0.png": "superkick",
    "elpepe-raw-deal/s_167_r2c0.png": "punch",
    "elpepe-raw-deal/s_367_r1c0.png": "chop",
    "elpepe-raw-deal/s_487_r1c2.png": "between-the-ropes",
    "elpepe-raw-deal/s_451_r0c1.png": "break-the-hold",
    "elpepe-raw-deal/s_167_r0c0.png": "front-chancery",
    "elpepe-raw-deal/s_487_r0c1.png": "hold-the-phone",
    "elpepe-raw-deal/s_262_r0c1.png": "kane-s-chokeslam",
    "elpepe-raw-deal/s_262_r0c2.png": "kane-s-flying-clothesline",
    "elpepe-raw-deal/s_456_r0c1.png": "knee-to-the-gut",
    # Superstar Cards (page 1 of each scanned deck).
    "Kurt/27.jpg": "superstar-kurt-angle",
    "Mankind/27.png": "superstar-mankind",
    "RVD/19.jpg": "superstar-rvd",
    # Cactus Jack.doc.pdf — Cactus Jack's deck (Mick Foley). Several cards are
    # shared with Mankind and already have art imported; map them to the same id
    # so the Cactus scan reinforces (not duplicates) them. Backstage-area cards
    # (17.png "The Hardcore Legend Returns!", 27.png "From Truth or
    # Consequences") are not playable Arsenal cards and are skipped.
    "Cactus Jack.doc/5.jpg": "cactus-clothesline",
    "Cactus Jack.doc/7.jpg": "superstar-cactus-jack",
    "Cactus Jack.doc/8.jpg": "cactus-bang-bang",
    "Cactus Jack.doc/9.jpg": "cactus-barbed-wire-baseball-bat",
    "Cactus Jack.doc/10.jpg": "cactus-s-double-arm-ddt",
    "Cactus Jack.doc/11.jpg": "tree-of-woe",
    "Cactus Jack.doc/12.jpg": "cactus-foley-is-good",
    "Cactus Jack.doc/13.jpg": "three-faces-of-foley",
    "Cactus Jack.doc/16.jpg": "get-hardcore",
    "Cactus Jack.doc/17.png": None,
    "Cactus Jack.doc/18.png": "cactus-stump-puller-piledriver",
    "Cactus Jack.doc/19.jpg": "kurt-hardcore-timekeepers-bell",
    "Cactus Jack.doc/20.jpg": "cactus-hardcore-til-the-end",
    "Cactus Jack.doc/21.jpg": "cactus-im-hardcore",
    "Cactus Jack.doc/22.jpg": "you-don-t-want-to-go-where-i-ve-been",
    "Cactus Jack.doc/23.png": "cactus-the-hardcore-diaries",
    "Cactus Jack.doc/26.png": "cactus-hardcore-assault",
    "Cactus Jack.doc/27.png": None,
    "Cactus Jack.doc/28.png": "cactus-extreme-promo-skills",
    "Cactus Jack.doc/29.jpg": "cactus-wwf-hardcore-title-belt",
    "Cactus Jack.doc/30.png": "cactus-screeching-car-crash",
    # Jericho.pdf — Chris Jericho's deck. 19.jpg is the Superstar card itself.
    "Jericho/19.jpg": "superstar-jericho",
    "Jericho/20.png": "kurt-ankle-lock",
    "Jericho/22.png": "arm-bar",
    "Jericho/24.png": "fireman-s-carry",
    "Jericho/26.png": "punch",
    "Jericho/27.png": "gen-kick",
    "Jericho/29.png": "cross-body-block",
    "Jericho/31.png": "chop",
    "Jericho/33.png": "chin-lock",
    "Jericho/35.png": "kurt-bear-hug",
    "Jericho/37.jpg": "lionsault",
    "Jericho/38.png": "body-slam",
    "Jericho/40.jpg": "break-the-hold",
    "Jericho/41.jpg": "escape-move",
    "Jericho/42.jpg": "gen-step-aside",
    "Jericho/43.png": "dont-think-too-hard",
    "Jericho/45.png": "hmmm",
    "Jericho/47.png": "knee-to-the-gut",
    "Jericho/48.jpg": "rolling-takedown",
    "Jericho/49.jpg": "dont-you-never-eeeever",
    "Jericho/50.png": "shake-it-off",
    "Jericho/52.png": "roll-out-of-the-ring",
    "Jericho/54.png": "not-yet",
    "Jericho/56.png": "recovery",
    "Jericho/58.jpg": "y2j",
    "Jericho/59.jpg": "irish-whip",
}

W, H = 300, 420


def norm(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def compact(s):
    """OCR often glues words together (e.g. 'SpitAtOpponent'); drop all
    non-alphanumerics so a substring test can still match."""
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def score(name, ocrname):
    a = set(norm(name).split())
    b = set(norm(ocrname).split())
    inter = len(a & b)
    if a and b and (a <= b or b <= a):
        inter += 1
    return inter


def fit(im):
    im = im.convert("RGB")
    if im.width == W and im.height == H:
        return im
    src_ratio = im.width / im.height
    dst_ratio = W / H
    if abs(src_ratio - dst_ratio) < 0.02:
        return im.resize((W, H), Image.LANCZOS)
    # landscape card: fit inside portrait canvas centered on dark background
    canvas = Image.new("RGB", (W, H), (21, 21, 26))
    if im.width / im.height >= dst_ratio:
        nw = W
        nh = int(W / src_ratio)
    else:
        nh = H
        nw = int(H * src_ratio)
    thumb = im.resize((nw, nh), Image.LANCZOS)
    canvas.paste(thumb, ((W - nw) // 2, (H - nh) // 2))
    return canvas


def ocr_text(path):
    """Return the first OCR'd line of an image (its printed card title)."""
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception:
        return ""
    engine = getattr(ocr_text, "_engine", None)
    if engine is None:
        engine = RapidOCR()
        ocr_text._engine = engine
    tmp = path
    im = Image.open(path)
    if max(im.size) > 900 or min(im.size) < 300:
        # RapidOCR chokes on very large (and very small) images; normalize.
        scale = 900.0 / max(im.size)
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
        tmp = path + ".ocr.png"
        im.save(tmp)
    try:
        res, _ = engine(tmp)
    except Exception:
        return ""
    finally:
        if tmp != path and os.path.exists(tmp):
            os.remove(tmp)
    return " / ".join(t for _, t, _ in res[:2]) if res else ""


def main():
    os.makedirs(OUT, exist_ok=True)
    # Optional: only process a single bank subfolder, e.g.
    #   python scripts/import_pdf_cards.py "Cactus Jack.doc"
    only_stem = sys.argv[1] if len(sys.argv) > 1 else None
    # Cards already given real art stay fixed: OCR from other decks may match
    # same-named cards (e.g. RVD's "Bear Hug") and must not overwrite them.
    manifest_path = os.path.join(HERE, "generated", "pdf_cards.txt")
    already = set()
    if os.path.exists(manifest_path):
        already = set(l.strip() for l in open(manifest_path, encoding="utf-8") if l.strip())
    imported_ids = list(already)
    matched = 0
    unmatched = []
    for stem in sorted(os.listdir(BANK)):
        if only_stem and stem != only_stem:
            continue
        index_path = os.path.join(BANK, stem, "index.json")
        if not os.path.exists(index_path):
            continue
        index = json.load(open(index_path, encoding="utf-8"))
        for entry in index["cards"]:
            # Full multi-card sheets are never a card face on their own; their
            # cells (s_* entries) are already listed separately in the index.
            if entry.get("sheet"):
                continue
            src = os.path.join(BANK, stem, entry["file"])
            if not os.path.exists(src):
                continue
            key = "%s/%s" % (stem, entry["file"])
            cid = OVERRIDES.get(key)
            if cid is None and key in OVERRIDES:
                # explicit skip (e.g. the sheet raster itself)
                continue
            if cid is None:
                title = entry.get("ocr") or ocr_text(src)
                # Prefer the card whose full compact name appears verbatim in
                # the OCR (handles glued OCR like 'SpitAtOpponent'), then fall
                # back to the word-score over all cards.
                ctc = compact(title)
                sub = [c for c in CARDS if compact(c["name"]) and compact(c["name"]) in ctc]
                if len(sub) == 1 and sub[0]["id"] not in already:
                    cid = sub[0]["id"]
                else:
                    best = max(CARDS, key=lambda c: score(c["name"], title))
                    sc = score(best["name"], title)
                    a = set(norm(best["name"]).split())
                    b = set(norm(title).split())
                    if best["id"] not in already and (sc >= 3 or (a and a <= b)):
                        cid = best["id"]
            if cid is None:
                unmatched.append((key, entry.get("ocr")))
                continue
            im = Image.open(src)
            im = fit(im)
            im.save(os.path.join(OUT, cid + ".png"), optimize=True)
            if cid not in imported_ids:
                imported_ids.append(cid)
            matched += 1
    # Manifest so generate_cards.py knows which faces come from the bank.
    with open(manifest_path, "w") as f:
        f.write("\n".join(sorted(set(imported_ids))))
    print("imported %d card images -> %s" % (matched, OUT))
    print("manifest: scripts/generated/pdf_cards.txt")
    if unmatched:
        print("unmatched bank entries (need a manual override):")
        for fn, ocr in unmatched:
            print("   ", fn, "->", ocr)


if __name__ == "__main__":
    main()