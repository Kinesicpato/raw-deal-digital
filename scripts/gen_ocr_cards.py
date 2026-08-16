# Generates src/data/ocrCards.ts.
# Source of truth for titles: titles.json (full-page OCR first line, deduped).
# Stats are parsed from a fresh full-page OCR of each sample image.
import json
import os
import re
import unicodedata

from PIL import Image
from rapidocr_onnxruntime import RapidOCR

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
GEN = os.path.join(HERE, "generated")
BANK = os.path.join(GEN, "bank")

cards_meta = json.load(open(os.path.join(GEN, "cards.json"), encoding="utf-8"))
existing_compact = {re.sub(r"[^a-z0-9]+", "", c["name"].lower()) for c in cards_meta["cards"]}

titles = json.load(open(r"C:\Users\patri\AppData\Local\Temp\opencode\titles.json", encoding="utf-8"))

SKIP_NAMES = {
    "Kurt", "Mankind", "RVD", "Hand Size", "Backstage Area", "W Backstage Area",
    "Authentic", "What a Maneuver!", "Managed by Shane O'Mac", "Sustained Damage",
    "Fantasy Cards", "The Kurt Angle Invitational", "Armageddon",
    "First to Tap Out Match", "Houston, Texas", "Old School Manager",
    "Raw Intercontinental Title Belt", "Product Endorsements",
    "Candice: Internet Icon", "Backed by Stephanie McMahon",
    "I'm Vincent Kennedy McMahon, Dammit!", "Angle's Moonsault",
    "KURTAngle", "MANKIND", "KiNe", "Kane",
    "Just Hold On a Second, Mister!", "Where Are Your Medals?",
    "Do YOU Live by the Three I's?",     "Wrestling with a Broken Freakin' Neck",
    "I'm Gonna Put You Through the Ring", "I'm Vincent Kennedy McMahon, Dammit!",
    "I'm Vincent Kennedy McMahon, Dammit!Fortitude", "I'm Vincent Kennedy McMahon, DammittFortitude",
}
SKIP_SAMPLES = {
    "Mankind/27.png", "Kurt/27.jpg", "RVD/19.jpg", "Mankind/29.jpg",
    "Mankind/30.jpg", "Mankind/88.png", "Mankind/90.jpg", "Mankind/86.jpg",
    "Mankind/87.jpg", "Mankind/84.jpg", "Mankind/82.png", "Mankind/72.jpg",
    "Mankind/85.jpg", "Mankind/79.jpg", "Mankind/75.jpg",
    "Kurt/76.png", "Kurt/65.jpg", "Kurt/78.png", "Kurt/80.jpg",
    "Kurt/72.jpg", "Kurt/74.jpg", "Kurt/75.jpg", "Kurt/27.jpg",
}
SKIP_COMPACT = {
    "fantasycardsnotforresaleallimagesusedunderfairguidelines",
    "i", "ine", "justholdonasecondmister",
}

RENAME = {
    "AnkleLock": "Ankle Lock",
    "ArmBreaker": "Arm Breaker",
    "AtomicBack BodyDrop": "Atomic Back Body Drop",
    "Backedby StephanieMcMahon": "Backed by Stephanie McMahon",
    "Betweenthe Ropes": "Between the Ropes",
    "BlatantChokehold": "Blatant Chokehold",
    "ChainedAgression": "Chained Aggression",
    "ClumsyOpponent": "Clumsy Opponent",
    "DoubleArm DDT": "Double Arm DDT",
    "DoubleLegTakedown": "Double Leg Takedown",
    "DynamicFinisher": "Dynamic Finisher",
    "EuropeanUppercut": "European Uppercut",
    "ExtremeMonkey.Flip": "Extreme Monkey Flip",
    "Fall-awaySuplex": "Fall-Away Suplex",
    "FiveStarFrogSplash": "Five Star Frog Splash",
    "FoleyisGood!": "Foley is Good!",
    "FromtheTopRope": "From the Top Rope",
    "FrontChancery": "Front Chancery",
    "Getthe\"F\"Out!": "Get the \"F\" Out!",
    "GofortheCheapPop!": "Go for the Cheap Pop!",
    "Hold the Phonel": "Hold the Phone!",
    "I Can'tBe Reading ThisRight": "I Can't Be Reading This Right",
    "ImmunetoPain": "Immune to Pain",
    "InTheInterestOf Fairness": "In the Interest of Fairness",
    "Kane'sFlying Clothesline": "Kane's Flying Clothesline",
    "Kane's TombstonePiledriver rortitude": "Kane's Tombstone Piledriver",
    "Kane'sReturn": "Kane's Return",
    "MandibleClaw": "Mandible Claw",
    "Mr. Socko": "Mr. Socko",
    "OfferHandshake": "Offer Handshake",
    "Over Sell Maneuver": "Over Sell Maneuver",
    "PanicGrab": "Panic Grab",
    "RollOutoftheWay": "Roll Out of the Way",
    "ShootAction": "Shoot Action",
    "ShootCounter": "Shoot Counter",
    "ShootHeadlock": "Shoot Headlock",
    "ShootPunch": "Shoot Punch",
    "Sloppy... Very Sloppy": "Sloppy... Very Sloppy",
    "SnapNeckbreaker": "Snap Neckbreaker",
    "Spinning Cresent Kick": "Spinning Crescent Kick",
    "StepOverToeHold": "Step Over Toe Hold",
    "SurpriseTechntcal Drop Kick": "Surprise Technical Drop Kick",
    "Technical DropKick": "Technical Drop Kick",
    "The Coach Says, \"Today's the Day!\" Fortitude": "The Coach Says, \"Today's the Day!\"",
    "TheRoadto Victory": "The Road to Victory",
    "ThreeFacesofFoley": "Three Faces of Foley",
    "Throw Into theCorner Turnbuckle": "Throw Into the Corner Turnbuckle",
    "Thrust Knee Lift": "Thrust Knee Lift",
    "TonightIUnleash Hell": "Tonight I Unleash Hell",
    "TotallyB": "Totally Bogus!",
    "underminetheCometionW": "Undermine the Competition",
    "Wrestling witha BrokenFreakin": "Wrestling with a Broken Freakin' Neck",
    "X-tremeMeasures": "X-treme Measures",
    "You Can't Cheat an Honest Man ... Fortitude": "You Can't Cheat an Honest Man",
    "You'reas Graceful asCowon Ice": "You're as Graceful as a Cow on Ice",
    "Go for the Cheap F": "Go for the Cheap Pop!",
    "I'm Gonna": "I'm Gonna Put You Through the Ring",
    "Everybody Wants (and Needs) a...Snow Job? Fortitude": "Everybody Wants (and Needs) a... Snow Job?",
    "Everybody Wants (and Needs) a...Snow Job?": "Everybody Wants (and Needs) a... Snow Job?",
    "Big Splash in the": "Big Splash in the Corner",
    "Kane's": "Kane's Chokeslam",
    "Kane's Flying": "Kane's Flying Clothesline",
    "Angle's": "Angle's German Suplex",
}

DECK_BY_STEM = {
    "Kurt": "kurt-angle",
    "Kurt_merged": "kurt-angle",
    "Extras Kurt": "kurt-angle",
    "Mankind": "mankind",
    "RVD": "rvd",
    "elpepe-raw-deal": None,
    "El pepe 2_merged 1": None,
    "El pepe 2_merged 2": None,
}

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
    ("set up", "Set-up"),
    ("foreign object", "Foreign Object"),
    ("run-in", "Run-in"),
    ("special", "Special"),
    ("multi", "Multi"),
    ("volley", "Volley"),
    ("heat", "Heat"),
    ("active", "Active"),
    ("permanent", "Permanent"),
    ("restricted modification", "Restricted Modification"),
    ("throwback", "Throwback"),
    ("wrestling", "Wrestling"),
    ("event", "Event"),
    ("venue", "Venue"),
    ("feud", "Feud"),
    ("stipulation", "Stipulation"),
    ("manager", "Manager"),
    ("object", "Object"),
]


def compact(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def untangle(s):
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)
    s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", s)
    s = re.sub(r"(?<=\d)(?=[A-Za-z])", " ", s)
    s = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# canonical names keyed by COMPACT title (OCR glues/spaces tokens differently)
CANON = {
    "anklelock": "Ankle Lock",
    "armbreaker": "Arm Breaker",
    "atomicbackbodydrop": "Atomic Back Body Drop",
    "backedbystephaniemcmahon": "Backed by Stephanie McMahon",
    "betweentheropes": "Between the Ropes",
    "blatantchokehold": "Blatant Chokehold",
    "chainedagression": "Chained Aggression",
    "clumsyopponent": "Clumsy Opponent",
    "doublearmddt": "Double Arm DDT",
    "doublelegtakedown": "Double Leg Takedown",
    "dynamicfinisher": "Dynamic Finisher",
    "europeanuppercut": "European Uppercut",
    "extrememonkeyflip": "Extreme Monkey Flip",
    "extrememonkey.flip": "Extreme Monkey Flip",
    "fallawaysuplex": "Fall-Away Suplex",
    "fivestarfrogsplash": "Five Star Frog Splash",
    "foleyisgood": "Foley is Good!",
    "fromthetoprope": "From the Top Rope",
    "frontchancery": "Front Chancery",
    "getthefout": "Get the \"F\" Out!",
    "goforthecheappop": "Go for the Cheap Pop!",
    "holdthephonel": "Hold the Phone!",
    "icantbereadingthisright": "I Can't Be Reading This Right",
    "immunetopain": "Immune to Pain",
    "intheinterestoffairness": "In the Interest of Fairness",
    "kanesflyingclothesline": "Kane's Flying Clothesline",
    "kanestombstonepiledriver": "Kane's Tombstone Piledriver",
    "kanestombstonepiledriverrortitude": "Kane's Tombstone Piledriver",
    "kanesreturn": "Kane's Return",
    "mandibleclaw": "Mandible Claw",
    "mrsocko": "Mr. Socko",
    "offerhandshake": "Offer Handshake",
    "oversellmaneuver": "Over Sell Maneuver",
    "panicgrab": "Panic Grab",
    "rolloutoftheway": "Roll Out of the Way",
    "shootaction": "Shoot Action",
    "shootcounter": "Shoot Counter",
    "shootheadlock": "Shoot Headlock",
    "shootpunch": "Shoot Punch",
    "sloppyverysloppy": "Sloppy... Very Sloppy",
    "snapneckbreaker": "Snap Neckbreaker",
    "spinningcresentkick": "Spinning Crescent Kick",
    "stepovertoehold": "Step Over Toe Hold",
    "surprisetechnicaldropkick": "Surprise Technical Drop Kick",
    "technicaldropkick": "Technical Drop Kick",
    "thecoachsays": "The Coach Says, \"Today's the Day!\"",
    "theroadtovictory": "The Road to Victory",
    "threefacesoffoley": "Three Faces of Foley",
    "throwintothecornerturnbuckle": "Throw Into the Corner Turnbuckle",
    "thrustkneelift": "Thrust Knee Lift",
    "tonightiunleashhell": "Tonight I Unleash Hell",
    "totallyb": "Totally Bogus!",
    "underminethecompetition": "Undermine the Competition",
    "wrestlingwithabrokenfreakin": "Wrestling with a Broken Freakin' Neck",
    "xtrememeasures": "X-treme Measures",
    "youcantcheatanhonestman": "You Can't Cheat an Honest Man",
    "youdontwanttogowhereivebeen": "You Don't Want to Go Where I've Been",
    "youreasgracefulascowonice": "You're as Graceful as a Cow on Ice",
    "goeorthecheapf": "Go for the Cheap Pop!",
    "im'gonna": "I'm Gonna Put You Through the Ring",
    "imvincentkennedymcmahondammitfortitude": "I'm Vincent Kennedy McMahon, Dammit!",
    "imvincentkennedymcmahondammittfortitude": "I'm Vincent Kennedy McMahon, Dammit!",
    "everybodywantsandneedsasnowjob": "Everybody Wants (and Needs) a... Snow Job?",
    "everybodywantsandneedsasnowjobfortitude": "Everybody Wants (and Needs) a... Snow Job?",
    "bigsplashinthe": "Big Splash in the Corner",
    "kanes": "Kane's Chokeslam",
    "kanesflying": "Kane's Flying Clothesline",
    "angles": "Angle's German Suplex",
    "anglesomething": "Angle's Something",
}


def slugify(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return re.sub(r"-+", "-", s)


def ocr_lines(path):
    im = Image.open(path)
    if max(im.size) > 1100:
        sc = 1100.0 / max(im.size)
        im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
    tmp = path + ".ocr.png"
    im.save(tmp)
    engine = getattr(ocr_lines, "_engine", None)
    if engine is None:
        engine = RapidOCR()
        ocr_lines._engine = engine
    try:
        res, _ = engine(tmp)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    if not res:
        return []
    lines = [txt for (_, txt, _) in sorted(res, key=lambda r: (r[0][1], r[0][0]))]
    return lines


def parse_stats(lines):
    full = " ".join(lines)
    low = full.lower()
    fort = 0
    dmg = 0
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s.lower() == "fortitude":
            for j in range(i + 1, min(i + 3, len(lines))):
                if re.match(r"^\d+$", lines[j].strip()):
                    fort = int(lines[j].strip())
                    break
        if s.lower() == "damage":
            for j in range(i + 1, min(i + 3, len(lines))):
                if re.match(r"^\d+$", lines[j].strip()):
                    dmg = int(lines[j].strip())
                    break
    # type
    ctype = "Action"
    if "trademark finisher" in low:
        ctype = "Maneuver"
    elif "high risk" in low or "highrisk" in compact(low):
        ctype = "Maneuver"
    elif re.search(r"reversal\s*:", low) or "reversal:special" in compact(low) or re.search(r"\breversal\b", low):
        ctype = "Reversal"
    elif re.search(r"\bmaneuver\b", low) or any(s in low for s in ("strike", "grapple", "submission")):
        ctype = "Maneuver"
    subtypes = [s for pat, s in SUBTYPES if re.search(r"\b%s\b" % re.escape(pat), low)]
    traits = [t for pat, t in TRAITS if re.search(r"\b%s\b" % re.escape(pat), low)]
    # text: drop title + footer + fortitude/damage numbers
    text_parts = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        ls = s.lower()
        if ls in ("fortitude", "damage") or re.match(r"^\d+$", s):
            continue
        if "not for resale" in ls or "fair use" in ls or "fair guidelines" in ls:
            continue
        if re.match(r"^\d+/\d+", s):
            continue
        text_parts.append(s)
    text = re.sub(r"\s+", " ", " ".join(text_parts)).strip()
    return {"fortitude": fort, "damage": dmg, "type": ctype, "subtypes": subtypes, "traits": traits, "text": text}


def main():
    final = {}
    for raw_key, meta in titles.items():
        raw_title = meta["title"]
        sample = meta["sample"]
        ck = compact(raw_key)
        if not ck or ck in existing_compact or ck in SKIP_COMPACT:
            continue
        if ck.startswith("imvincentkennedy"):
            continue
        title = CANON.get(ck, RENAME.get(raw_title, raw_title))
        if title in SKIP_NAMES or sample in SKIP_SAMPLES:
            continue
        if len(title.split()) == 1 and re.search(r"[a-z][A-Z]", title):
            title = untangle(title)
        if title in SKIP_NAMES or compact(title) in SKIP_COMPACT:
            continue
        if re.match(r"^[a-z]+$", title) and len(title) <= 2:
            continue
        # OCR split an apostrophe ("I'm ..." -> "I\") or dropped the title
        if title.startswith("I\\") or title == "I" or "I\\" in title:
            continue
        if re.match(r"^[A-Z][a-z]*[A-Z]", title) and " " not in title and "'" not in title and "&" not in title:
            title = untangle(title)
            if title in SKIP_NAMES or compact(title) in SKIP_COMPACT:
                continue
        tck = compact(title)
        if tck in final or tck in existing_compact:
            continue
        stem = sample.split("/")[0] if "/" in sample else ""
        path = os.path.join(BANK, sample)
        stats = parse_stats(ocr_lines(path)) if os.path.exists(path) else {}
        final[tck] = {
            "title": title,
            "sample": sample,
            "deck": DECK_BY_STEM.get(stem),
            **stats,
        }

    cards = sorted(final.values(), key=lambda c: c["title"].lower())
    out = ['// AUTO-GENERATED from PDF scans via scripts/gen_ocr_cards.py.',
           '// Values come from OCR and may be wrong; each entry is marked',
           '// notes: "OCR automático; verificar" until manually reviewed.',
           'import type { CardDef } from \'./types\'\n']
    out.append('const ocrCard = (c: CardDef): CardDef => c\n')
    out.append('export const OCR_CARDS: CardDef[] = [')
    for c in cards:
        subtypes = ", ".join("'%s'" % s for s in c["subtypes"])
        traits = ", ".join("'%s'" % t for t in c["traits"])
        deck_line = ("    superstar: ['%s'],\n" % c["deck"]) if c["deck"] else ""
        text = c["text"].replace("\\", "\\\\").replace("'", "\\'")
        name = c["title"].replace("\\", "\\\\").replace("'", "\\'")
        out.append("  ocrCard({")
        out.append("    id: '%s'," % slugify(c["title"]))
        out.append("    name: '%s'," % name)
        out.append("    type: '%s'," % c["type"])
        if subtypes:
            out.append("    subtypes: [%s]," % subtypes)
        if traits:
            out.append("    traits: [%s]," % traits)
        if deck_line:
            out.append(deck_line.rstrip(","))
        out.append("    fortitude: %d," % c["fortitude"])
        out.append("    damage: %d," % c["damage"])
        out.append("    text: '%s'," % text)
        out.append("    set: 'PDF',")
        out.append("    notes: 'OCR automático; verificar.',")
        out.append("  }),")
    out.append(']\n')
    out.append('export const OCR_MANIFEST: Record<string, string> = {')
    for c in cards:
        out.append("  '%s': '%s'," % (slugify(c["title"]), c["sample"]))
    out.append('}')

    dest = os.path.join(ROOT, "src", "data", "ocrCards.ts")
    with open(dest, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print("wrote", dest, "-", len(cards), "cards")


if __name__ == "__main__":
    main()
