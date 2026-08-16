# Generates full card-face PNGs for the Raw Deal digital game:
# border, name, type bar, fortitude badge, stars, damage and text all drawn
# into the image so a card never depends on HTML/CSS overlays.
# Run: python scripts/generate_cards.py
import json
import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, "generated", "cards.json"), encoding="utf-8"))
OUT = os.path.abspath(os.path.join(HERE, "..", "public", "cards"))
os.makedirs(OUT, exist_ok=True)

W, H = 300, 420

TYPE_BAR = {
    "Maneuver": (168, 122, 26),
    "Reversal": (177, 32, 47),
    "Action": (36, 87, 163),
    "Hybrid": (139, 63, 181),
    "Superstar": (140, 32, 140),
}
TYPE_ACCENT = {
    "Maneuver": (216, 169, 47),
    "Reversal": (214, 40, 57),
    "Action": (46, 107, 192),
    "Hybrid": (155, 89, 205),
    "Superstar": (180, 60, 200),
}
HEEL = (214, 40, 57)
FACE = (46, 107, 192)
GOLD = (216, 169, 47)
BG_DARK = (21, 21, 26)
TEXT_LIGHT = (240, 240, 245)

FONT_DIR = "C:/Windows/Fonts"


def font(name, size):
    path = os.path.join(FONT_DIR, name)
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def type_of(card):
    if card["type"] == "Superstar":
        return "Superstar"
    if card["type"] == "Reversal" or "Reversal" in card["extraTypes"]:
        return "Reversal"
    if card["type"] == "Action":
        return "Action"
    if card["type"] == "Hybrid":
        return "Hybrid"
    return "Maneuver"


def type_label(card):
    parts = [card["type"]]
    for e in card["extraTypes"]:
        if e not in parts:
            parts.append(e)
    if card["subtypes"]:
        parts.append("/".join(card["subtypes"]))
    return " · ".join(parts)


def emblem(card):
    sup = next((s for s in DATA["superstars"] if s["id"] in card["superstar"]), None)
    if sup:
        initials = "".join(w[0] for w in sup["name"].split()).upper()
        hue = HEEL if sup["alignment"] == "Heel" else FACE
        return initials, hue
    return "★", GOLD


def wrap_text(draw, text, f, max_width):
    lines = []
    for para in text.split("\n"):
        if not para:
            lines.append("")
            continue
        words = para.split()
        line = ""
        for w in words:
            trial = (line + " " + w).strip()
            if draw.textlength(trial, font=f) <= max_width:
                line = trial
            else:
                if line:
                    lines.append(line)
                line = w
        if line:
            lines.append(line)
    return lines


def draw_card(card):
    kind = type_of(card)
    bar = TYPE_BAR[kind]
    accent = TYPE_ACCENT[kind]
    img = Image.new("RGB", (W, H), BG_DARK)
    d = ImageDraw.Draw(img)

    # Border by type.
    d.rectangle([0, 0, W - 1, H - 1], fill=None, outline=bar, width=8)

    # Top: name + fortitude badge.
    f_name = font("arialbd.ttf", 22)
    f_small = font("arialbd.ttf", 18)
    name = card["name"].upper()
    d.rectangle([4, 4, W - 4, 40], fill=(30, 30, 38))
    d.text((12, 22), name, font=f_name, fill=TEXT_LIGHT)
    badge = f"{card['fortitude']}F"
    bw = d.textlength(badge, font=f_small) + 14
    bx = W - bw - 10
    d.rounded_rectangle([bx, 6, bx + bw, 32], radius=8, fill=accent)
    d.text((bx + bw / 2, 19), badge, font=f_small, fill=(255, 255, 255), anchor="mm")

    # Type bar.
    f_type = font("arialbd.ttf", 15)
    d.rectangle([6, 42, W - 6, 62], fill=bar)
    d.text((W / 2, 52), type_label(card), font=f_type, fill=(255, 255, 255), anchor="mm")

    # Art medallion.
    cy = 190
    f_glyph = font("arialbd.ttf", 96)
    d.ellipse([W / 2 - 88, cy - 88, W / 2 + 88, cy + 88], fill=(14, 14, 20), outline=(255, 255, 255, 90), width=4)
    glyph, hue = emblem(card)
    if glyph == "★":
        d.text((W / 2, cy + 3), glyph, font=f_glyph, fill=GOLD, anchor="mm")
    else:
        d.text((W / 2, cy), glyph, font=f_glyph, fill=hue, anchor="mm")

    # Stars (stun).
    y_st = 300
    if card["stun"]:
        f_star = font("arial.ttf", 22)
        d.text((W / 2, y_st), "★ " * card["stun"], font=f_star, fill=GOLD, anchor="mm")

    # Damage on a plaque.
    dmg = f"{card['damage']}D"
    f_dmg = font("arialbd.ttf", 26)
    if card["damage"] == 0:
        d.text((W / 2, 342), dmg, font=f_dmg, fill=(120, 120, 130), anchor="mm")
    else:
        pw = d.textlength(dmg, font=f_dmg) + 24
        d.rounded_rectangle([W / 2 - pw / 2, 322, W / 2 + pw / 2, 362], radius=12, fill=accent)
        d.text((W / 2, 342), dmg, font=f_dmg, fill=(255, 255, 255), anchor="mm")

    # Card text box.
    block_top = 30 if card["stun"] else 20
    text_img = Image.new("RGB", (W - 24, 120), (15, 15, 20))
    td = ImageDraw.Draw(text_img)
    f_text = font("arial.ttf", 16)
    body = card["text"] if card["text"] else "Sin texto."
    lines = wrap_text(td, body, f_text, W - 40)
    yy = 10
    for ln in lines[:7]:
        td.text((10, yy), ln, font=f_text, fill=TEXT_LIGHT)
        yy += 17
    img.paste(text_img, (12, 286))

    img.save(os.path.join(OUT, f"{card['id']}.png"), optimize=True)


def draw_back():
    img = Image.new("RGB", (W, H), (80, 16, 24))
    d = ImageDraw.Draw(img)
    for y in range(0, H, 24):
        d.rectangle([0, y, W, y + 12], fill=(58, 11, 16))
    d.ellipse([W / 2 - 80, H / 2 - 80, W / 2 + 80, H / 2 + 80], fill=(12, 12, 18), outline=GOLD, width=6)
    f = font("arialbd.ttf", 70)
    d.text((W / 2, H / 2), "RD", font=f, fill=GOLD, anchor="mm")
    img.save(os.path.join(OUT, "__back.png"), optimize=True)


# Cards whose face was imported from the Kurt Angle PDF (see import_pdf_cards.py).
# Their real artwork must not be overwritten by the generated placeholder.
PDF_MANIFEST = os.path.join(HERE, "generated", "pdf_cards.txt")
PDF_IMPORTED = set()
if os.path.exists(PDF_MANIFEST):
    with open(PDF_MANIFEST, encoding="utf-8") as f:
        PDF_IMPORTED = {ln.strip() for ln in f if ln.strip()}

for card in DATA["cards"]:
    if card["id"] in PDF_IMPORTED:
        continue
    draw_card(card)
draw_back()
print(f"generated {len(DATA['cards'])} full card images + back in {OUT}")