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
    # HHH.pdf — Triple H's scanned cards (the Superstar card + 2 plays).
    "HHH/7.png": "superstar-triple-h",
    "HHH/9.jpg": "leaping-knee-to-the-face",
    "HHH/10.jpg": "facebuster",
    # Booker T.doc — "Don't Hate da Playa, Hate da Game!" was scanned sideways
    # (landscape); the bank file 26.jpg is already rotated upright, keep the
    # mapping pinned so a re-import renders it portrait like the other cards.
    "Booker T.doc/26.jpg": "dont-hate-da-playa-hate-da-game",
    # PDF FINAL RAW DEAL RVD BOOKER T.pdf — Rob Van Dam's cards (5.jpg
    # Spinnerooni through 57.jpg Superkick). The three landscape (horizontal)
    # cards are Backlash cards: 28.jpg Van Daminator (Mid-match), 31.jpg
    # Everything's Cool When You're... (Mid-match), 53.jpg R-V-D (Pre-match).
    # 18.jpg is Booker T's Superstar card (take 2 cards from Ringside to the
    # bottom of your Arsenal). 39/43/54 are duplicate printings and map to the
    # same card ids as their first copies.
    "PDF FINAL RAW DEAL RVD BOOKER T/5.jpg": "spinnerooni",
    "PDF FINAL RAW DEAL RVD BOOKER T/7.jpg": "bookend",
    "PDF FINAL RAW DEAL RVD BOOKER T/8.jpg": "you-didnt-just-try-that",
    "PDF FINAL RAW DEAL RVD BOOKER T/9.jpg": "houston-hangover",
    "PDF FINAL RAW DEAL RVD BOOKER T/12.jpg": "booker-s-spinning-kick",
    "PDF FINAL RAW DEAL RVD BOOKER T/13.jpg": "booker-s-scissor-kick",
    "PDF FINAL RAW DEAL RVD BOOKER T/14.jpg": "can-you-dig-it-sucka",
    "PDF FINAL RAW DEAL RVD BOOKER T/15.jpg": "booker-s-thrust-kick",
    "PDF FINAL RAW DEAL RVD BOOKER T/18.jpg": "superstar-booker-t",
    "PDF FINAL RAW DEAL RVD BOOKER T/19.jpg": "spinning-straight-elbow",
    "PDF FINAL RAW DEAL RVD BOOKER T/20.jpg": "nobody-gets-higher",
    "PDF FINAL RAW DEAL RVD BOOKER T/21.jpg": "flying-higher-than-ever",
    "PDF FINAL RAW DEAL RVD BOOKER T/27.jpg": "split-legged-moonsault",
    "PDF FINAL RAW DEAL RVD BOOKER T/28.jpg": "van-daminator",
    "PDF FINAL RAW DEAL RVD BOOKER T/31.jpg": "everythings-cool-when-youre",
    "PDF FINAL RAW DEAL RVD BOOKER T/32.jpg": "step-over-heel-kick",
    "PDF FINAL RAW DEAL RVD BOOKER T/33.jpg": "rolling-thunder",
    "PDF FINAL RAW DEAL RVD BOOKER T/34.jpg": "the-whole-dam-show",
    "PDF FINAL RAW DEAL RVD BOOKER T/37.jpg": "van-terminator",
    "PDF FINAL RAW DEAL RVD BOOKER T/38.jpg": "dude-whatever",
    "PDF FINAL RAW DEAL RVD BOOKER T/39.jpg": "dude-whatever",
    "PDF FINAL RAW DEAL RVD BOOKER T/40.jpg": "the-fury-of-the-storm",
    "PDF FINAL RAW DEAL RVD BOOKER T/43.jpg": "the-fury-of-the-storm",
    "PDF FINAL RAW DEAL RVD BOOKER T/46.jpg": "five-star-frog-splash",
    "PDF FINAL RAW DEAL RVD BOOKER T/47.jpg": "one-of-a-kind",
    "PDF FINAL RAW DEAL RVD BOOKER T/48.jpg": "chair-shot",
    "PDF FINAL RAW DEAL RVD BOOKER T/49.jpg": "insurrextion",
    "PDF FINAL RAW DEAL RVD BOOKER T/52.jpg": "still-one-of-a-kind",
    "PDF FINAL RAW DEAL RVD BOOKER T/53.jpg": "r-v-d",
    "PDF FINAL RAW DEAL RVD BOOKER T/54.jpg": "step-over-heel-kick",
    "PDF FINAL RAW DEAL RVD BOOKER T/57.jpg": "superkick",
    # Extras Jericho.pdf — one multi-card sheet (10.jpg) with Chris Jericho's
    # extras. The bottom row holds only 2 landscape cards that overflow the 3x3
    # grid, so s_10_r2c0.png and s_10_happy.png were re-cropped directly from
    # the sheet at the cards' true bounds (r2c0: "Superior Acrobatics",
    # y-bbox 1116..1491, x-bbox ~20..517; s_10_happy.png: "Happy You're Here,
    # Happier You're Gone", x-bbox ~536..1032). r2c1/r2c2 are dead grid slices
    # and skipped. y2j and Don't You Never...Eeeever! already have art imported
    # from the Jericho deck scan, so those cells are skipped here.
    "Extras Jericho/s_10_r0c0.png": "jericho-walls-of-jericho",
    "Extras Jericho/s_10_r0c1.png": None,
    "Extras Jericho/s_10_r0c2.png": "jericho-roll-the-footage-monkeys",
    "Extras Jericho/s_10_r1c0.png": "jericho-my-obscenely-expensive-jeri-tron-5000",
    "Extras Jericho/s_10_r1c1.png": None,
    "Extras Jericho/s_10_r1c2.png": "jericho-dont-try-this-at-home",
    "Extras Jericho/s_10_r2c0.png": "jericho-superior-acrobatics",
    "Extras Jericho/s_10_r2c1.png": None,
    "Extras Jericho/s_10_r2c2.png": None,
    "Extras Jericho/s_10_happy.png": "jericho-happy-youre-here",
    # Aj y Extras — AJ Styles + Braun Strowman + serie "Classic". The four
    # "Phenomenal..." cards are AJ; the Strowman/BRAUN cards are Braun. Every
    # entry is pinned (id or None) so OCR never misassigns the sheet's art.
    # Skipped: Backlash/Pre-match/Mid-match cards (10, 11, 13-16, 42, 47, 68,
    # 166, 224, 288, 319, 348) and non-Arsenal Backstage-area cards (45, 46,
    # "The Black Sheep Mask" and "The Four Horsemen of the Apocalypse").
    "Aj y Extras/9.jpg": "superstar-aj-styles",
    "Aj y Extras/10.jpg": None,
    "Aj y Extras/11.jpg": None,
    "Aj y Extras/12.jpg": "aj-phenomenal-forearm",
    "Aj y Extras/13.jpg": None,
    "Aj y Extras/14.jpg": None,
    "Aj y Extras/15.jpg": None,
    "Aj y Extras/16.jpg": None,
    "Aj y Extras/40.jpg": "aj-pele-kick",
    "Aj y Extras/41.jpg": "aj-calf-crusher",
    "Aj y Extras/42.jpg": None,
    "Aj y Extras/43.jpg": "aj-i-am-phenomenal",
    "Aj y Extras/44.jpg": "superstar-braun-strowman",
    "Aj y Extras/45.jpg": None,
    "Aj y Extras/46.jpg": None,
    "Aj y Extras/47.jpg": None,
    "Aj y Extras/67.jpg": "braun-lariat",
    "Aj y Extras/68.jpg": None,
    "Aj y Extras/69.jpg": "braun-strong-strike",
    "Aj y Extras/70.jpg": "braun-strowman-slam",
    "Aj y Extras/71.jpg": "braun-strowmans-squeeze",
    "Aj y Extras/72.jpg": "braun-abominable-strowman",
    "Aj y Extras/73.jpg": "braun-new-face-of-destruction",
    "Aj y Extras/74.jpg": "braun-i-am-stronger",
    "Aj y Extras/102.jpg": None,
    "Aj y Extras/103.jpg": None,
    "Aj y Extras/104.jpg": None,
    "Aj y Extras/105.jpg": None,
    "Aj y Extras/106.jpg": None,
    "Aj y Extras/107.jpg": None,
    "Aj y Extras/108.jpg": None,
    "Aj y Extras/109.jpg": None,
    "Aj y Extras/136.jpg": None,
    "Aj y Extras/137.jpg": None,
    "Aj y Extras/138.jpg": None,
    "Aj y Extras/139.jpg": None,
    "Aj y Extras/140.jpg": None,
    "Aj y Extras/141.jpg": None,
    "Aj y Extras/142.jpg": None,
    "Aj y Extras/143.jpg": None,
    "Aj y Extras/164.jpg": None,
    "Aj y Extras/165.jpg": None,
    "Aj y Extras/166.jpg": None,
    "Aj y Extras/167.jpg": None,
    "Aj y Extras/168.jpg": None,
    "Aj y Extras/169.jpg": None,
    "Aj y Extras/170.jpg": None,
    "Aj y Extras/171.jpg": None,
    "Aj y Extras/192.jpg": None,
    "Aj y Extras/193.jpg": None,
    "Aj y Extras/194.jpg": None,
    "Aj y Extras/195.jpg": None,
    "Aj y Extras/196.jpg": None,
    "Aj y Extras/197.jpg": None,
    "Aj y Extras/198.jpg": None,
    "Aj y Extras/223.jpg": "classic-left-cross-punch",
    "Aj y Extras/224.jpg": None,
    "Aj y Extras/225.jpg": "classic-kick",
    "Aj y Extras/226.jpg": "classic-elbow-smash",
    "Aj y Extras/227.jpg": "classic-drop-kick",
    "Aj y Extras/228.jpg": "classic-double-clothesline",
    "Aj y Extras/229.jpg": "classic-power-punch",
    "Aj y Extras/230.jpg": "classic-turnbuckle-smash",
    "Aj y Extras/257.jpg": "classic-firemans-carry",
    "Aj y Extras/258.jpg": "classic-hip-toss",
    "Aj y Extras/259.jpg": "classic-headlock-takedown",
    "Aj y Extras/260.jpg": "classic-vertical-suplex",
    "Aj y Extras/261.jpg": "classic-bulldog",
    "Aj y Extras/262.jpg": "classic-back-body-drop",
    "Aj y Extras/263.jpg": "classic-bulldog-lariat",
    "Aj y Extras/264.jpg": "classic-wrist-lock",
    "Aj y Extras/285.jpg": "classic-headlock",
    "Aj y Extras/286.jpg": "classic-arm-bar",
    "Aj y Extras/287.jpg": "classic-abdominal-stretch",
    "Aj y Extras/288.jpg": None,
    "Aj y Extras/289.jpg": "classic-knee-to-the-groin",
    "Aj y Extras/290.jpg": None,
    "Aj y Extras/291.jpg": None,
    "Aj y Extras/292.jpg": None,
    "Aj y Extras/313.jpg": None,
    "Aj y Extras/314.jpg": None,
    "Aj y Extras/315.jpg": None,
    "Aj y Extras/316.jpg": None,
    "Aj y Extras/317.jpg": None,
    "Aj y Extras/318.jpg": None,
    "Aj y Extras/319.jpg": None,
    "Aj y Extras/320.jpg": None,
    "Aj y Extras/347.jpg": None,
    "Aj y Extras/348.jpg": None,
    "Aj y Extras/349.jpg": "classic-back-kick",
    "Aj y Extras/350.jpg": "classic-lariat",
    "Aj y Extras/351.jpg": "classic-clothesline",
    "Aj y Extras/352.jpg": "classic-arm-drag",
    "Aj y Extras/353.jpg": "classic-toss-out-of-the-ring",
    "Aj y Extras/354.jpg": "classic-leg-work",
    "Aj y Extras/380.jpg": "classic-body-slam",
    "Aj y Extras/381.jpg": "classic-power-slam",
    "Aj y Extras/382.jpg": "classic-neck-wrench",
    "Aj y Extras/383.jpg": "classic-sleeper-hold",
    "Aj y Extras/384.jpg": "classic-double-axe-handle",
    "Aj y Extras/385.jpg": "classic-elbow-drop",
    "Aj y Extras/386.jpg": None,
    "Aj y Extras/387.jpg": None,
    "Aj y Extras/409.jpg": None,
    "Aj y Extras/410.jpg": "building-classic-momentum",
    "Aj y Extras/411.jpg": None,
    "Aj y Extras/412.jpg": None,
    "Aj y Extras/413.jpg": None,
    "Aj y Extras/414.jpg": None,
    "Aj y Extras/415.jpg": None,
    "Aj y Extras/416.jpg": None,
    # Reversal extras.pdf — one 3x3 sheet (xref 10, 1136x1599 px). Cell r0c2 is
    # the official "The Coach Says, "Today's the Day!"" already in the catalog
    # (No Way Out 19.0); the rest are new generic fan cards (ALE/V1x) and all are
    # upright portraits. The sheet raster itself (10.jpg) is not a card face.
    "Reversal extras/10.jpg": None,
    "Reversal extras/s_10_r0c0.png": "just-bring-it",
    "Reversal extras/s_10_r0c1.png": "there-are-two-things-you-can-do-nothing",
    "Reversal extras/s_10_r0c2.png": "the-coach-says-today-s-the-day",
    "Reversal extras/s_10_r1c0.png": "lift-a-boot",
    "Reversal extras/s_10_r1c1.png": "overshot-your-mark",
    "Reversal extras/s_10_r1c2.png": "spot-adjustment",
    "Reversal extras/s_10_r2c0.png": "blown-spot",
    "Reversal extras/s_10_r2c1.png": "get-crowd-support",
    "Reversal extras/s_10_r2c2.png": "im-desperate",
    # El pepe 2_merged 1.pdf — "El pepe" fan reprints (V14) as three 3x3 sheets
    # (xrefs 6, 17, 28). Most cells are repeat printings of the same generic or
    # Kane card; every cell maps to the matching catalog id so the imported art
    # reinforces the scanned face. s_17_r0c0 is Kane's Superstar card
    # (Ability: "Once during each of your turns, before your Draw Segment, your
    # opponent overturns 1 card."). The r2c0/r0c0 1-card crops of the grid are
    # already the same faces.
    "El pepe 2_merged 1/6.jpg": None,
    "El pepe 2_merged 1/s_6_r0c0.png": "front-chancery",
    "El pepe 2_merged 1/s_6_r0c1.png": "fireman-s-carry",
    "El pepe 2_merged 1/s_6_r0c2.png": "fireman-s-carry",
    "El pepe 2_merged 1/s_6_r1c0.png": "hip-toss",
    "El pepe 2_merged 1/s_6_r1c1.png": "hip-toss",
    "El pepe 2_merged 1/s_6_r1c2.png": "hip-toss",
    "El pepe 2_merged 1/s_6_r2c0.png": "punch",
    "El pepe 2_merged 1/s_6_r2c1.png": "punch",
    "El pepe 2_merged 1/s_6_r2c2.png": "punch",
    "El pepe 2_merged 1/17.jpg": None,
    "El pepe 2_merged 1/s_17_r0c0.png": "superstar-kane",
    "El pepe 2_merged 1/s_17_r0c1.png": "kane-s-chokeslam",
    "El pepe 2_merged 1/s_17_r0c2.png": "kane-s-flying-clothesline",
    "El pepe 2_merged 1/s_17_r1c0.png": "kane-s-return",
    "El pepe 2_merged 1/s_17_r1c1.png": "kurt-bear-hug",
    "El pepe 2_merged 1/s_17_r1c2.png": "step-over-toe-hold",
    "El pepe 2_merged 1/s_17_r2c0.png": "arm-bar",
    "El pepe 2_merged 1/s_17_r2c1.png": "arm-bar",
    "El pepe 2_merged 1/s_17_r2c2.png": "arm-bar",
    "El pepe 2_merged 1/28.jpg": None,
    "El pepe 2_merged 1/s_28_r0c0.png": "gen-elbow-to-the-face",
    "El pepe 2_merged 1/s_28_r0c1.png": "gen-elbow-to-the-face",
    "El pepe 2_merged 1/s_28_r0c2.png": "gen-elbow-to-the-face",
    "El pepe 2_merged 1/s_28_r1c0.png": "chop",
    "El pepe 2_merged 1/s_28_r1c1.png": "chop",
    "El pepe 2_merged 1/s_28_r1c2.png": "chop",
    "El pepe 2_merged 1/s_28_r2c0.png": "superkick",
    "El pepe 2_merged 1/s_28_r2c1.png": "superkick",
    "El pepe 2_merged 1/s_28_r2c2.png": "superkick",
    # El pepe 2_merged 2.pdf — second "El pepe" V14 sheet group. s_28_r2c1/r2c2
    # are the only new card (Vince McMahon's signature) and both map to the same
    # new id im-vincent-kennedy-mcmahon-dammit.
    "El pepe 2_merged 2/6.jpg": None,
    "El pepe 2_merged 2/s_6_r0c0.png": "break-the-hold",
    "El pepe 2_merged 2/s_6_r0c1.png": "break-the-hold",
    "El pepe 2_merged 2/s_6_r0c2.png": "escape-move",
    "El pepe 2_merged 2/s_6_r1c0.png": "escape-move",
    "El pepe 2_merged 2/s_6_r1c1.png": "escape-move",
    "El pepe 2_merged 2/s_6_r1c2.png": "gen-step-aside",
    "El pepe 2_merged 2/s_6_r2c0.png": "gen-step-aside",
    "El pepe 2_merged 2/s_6_r2c1.png": "gen-step-aside",
    "El pepe 2_merged 2/s_6_r2c2.png": "kurt-the-maneuver-of-doom",
    "El pepe 2_merged 2/17.jpg": None,
    "El pepe 2_merged 2/s_17_r0c0.png": "recovery",
    "El pepe 2_merged 2/s_17_r0c1.png": "knee-to-the-gut",
    "El pepe 2_merged 2/s_17_r0c2.png": "knee-to-the-gut",
    "El pepe 2_merged 2/s_17_r1c0.png": "rolling-takedown",
    "El pepe 2_merged 2/s_17_r1c1.png": "rolling-takedown",
    "El pepe 2_merged 2/s_17_r1c2.png": "bow-arrow",
    "El pepe 2_merged 2/s_17_r2c0.png": "atomic-back-body-drop",
    "El pepe 2_merged 2/s_17_r2c1.png": "recovery",
    "El pepe 2_merged 2/s_17_r2c2.png": "headlock-takedown",
    "El pepe 2_merged 2/28.jpg": None,
    "El pepe 2_merged 2/s_28_r0c0.png": "hold-the-phone",
    "El pepe 2_merged 2/s_28_r0c1.png": "hold-the-phone",
    "El pepe 2_merged 2/s_28_r0c2.png": "nerve-hold",
    "El pepe 2_merged 2/s_28_r1c0.png": "gen-spit-at-opponent",
    "El pepe 2_merged 2/s_28_r1c1.png": "gen-spit-at-opponent",
    "El pepe 2_merged 2/s_28_r1c2.png": "between-the-ropes",
    "El pepe 2_merged 2/s_28_r2c0.png": "between-the-ropes",
    "El pepe 2_merged 2/s_28_r2c1.png": "im-vincent-kennedy-mcmahon-dammit",
    "El pepe 2_merged 2/s_28_r2c2.png": "im-vincent-kennedy-mcmahon-dammit",
    # AJ Styles.pdf — extra AJ Styles fan-set cards. Three A4 "sheets" where each
    # card is its own placed image: pages 0-1 hold 6 portraits each (5 are
    # repeats of existing ids and get their scanned art reinforced), page 2 holds
    # the two horizontal (landscape) Backlash cards (37.jpg AJ's Phenomenal
    # Combination, 39.jpg Ain't Nobody Breakin' This Redneck), both Mid-match so
    # the deckbuilder drops them into the Mid-match Backlash zone.
    "AJ Styles/10.jpg": "superstar-aj-styles",
    "AJ Styles/12.jpg": "aj-phenomenal-dropkick",
    "AJ Styles/14.jpg": "aj-phenomenal-forearm",
    "AJ Styles/16.jpg": "aj-pele-kick",
    "AJ Styles/18.jpg": "aj-calf-crusher",
    "AJ Styles/20.jpg": "aj-the-face-that-runs-the-place",
    "AJ Styles/23.jpg": "maintain-hold",
    "AJ Styles/25.jpg": "aj-styles-clash",
    "AJ Styles/27.jpg": "aj-i-am-phenomenal",
    "AJ Styles/29.jpg": "aj-beat-up-by-the-club",
    "AJ Styles/31.jpg": "aj-the-club-stands-together",
    "AJ Styles/33.jpg": "aj-this-club-is-too-sweet",
    "AJ Styles/37.jpg": "aj-phenomenal-combination",
    "AJ Styles/39.jpg": "aj-aint-nobody-breaking-this-redneck",
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
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sorted(set(imported_ids))))
    print("imported %d card images -> %s" % (matched, OUT))
    print("manifest: scripts/generated/pdf_cards.txt")
    if unmatched:
        print("unmatched bank entries (need a manual override):")
        for fn, ocr in unmatched:
            print("   ", fn, "->", ocr)


if __name__ == "__main__":
    main()