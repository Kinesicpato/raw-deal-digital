#!/usr/bin/env python3
"""
Import card images from .docx files (Midmatch.docx and Extras.docx) into public/cards/.
Also generates card data entries for cards.ts.
"""
import os
import shutil
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
PUBLIC_CARDS = os.path.join(ROOT, "public", "cards")
DECKS = os.path.join(ROOT, "Decks")

os.makedirs(PUBLIC_CARDS, exist_ok=True)

# --- Midmatch cards (Backlash deck) ---
# Order matches the drawing order in Midmatch.docx
MIDMATCH_CARDS = [
    {
        "id": "dirty-low-blow",
        "name": "Dirty Low Blow",
        "type": "Maneuver",
        "subtypes": ["Strike"],
        "traits": ["Heel"],
        "fortitude": 0,
        "damage": 2,
        "text": "Can only be played when your Fortitude Rating is less than your opponent's Fortitude Rating. Cannot be reversed from your opponent's hand.",
        "backlash": "Mid-match",
    },
    {
        "id": "backlash-card",
        "name": "Backlash!",
        "type": "Reversal",
        "traits": ["Special"],
        "fortitude": 0,
        "damage": 3,
        "text": "Can only be played if your Fortitude Rating is less than your opponent's Fortitude Rating. Reverse any Strike, Grapple, or Submission maneuver if it is not the first maneuver played this turn and end your opponent's turn.",
        "backlash": "Mid-match",
    },
    {
        "id": "chain-barrier",
        "name": "Chain Barrier",
        "type": "Action",
        "extraTypes": ["Action"],
        "traits": ["Multi", "Active"],
        "fortitude": 0,
        "damage": 0,
        "text": "When this card is in your Ring area, discard 1 card fewer in order to be able to reverse a Chain card from your hand or Backlash deck.",
        "backlash": "Mid-match",
    },
    {
        "id": "tormented-tomfoolery",
        "name": "Tormented Tomfoolery",
        "type": "Maneuver",
        "subtypes": ["Grapple", "Submission"],
        "traits": ["Fan Favorite!"],
        "fortitude": 4,
        "damage": 6,
        "text": "When played, choose Grapple or Submission. This card is considered to be only the chosen type. When successfully played, your next card played this turn is -15F.",
        "backlash": "Mid-match",
    },
    {
        "id": "precision-personified",
        "name": "Precision Personified",
        "type": "Action",
        "traits": ["Fan Favorite!"],
        "fortitude": 0,
        "damage": 0,
        "text": 'Search your Arsenal for 1 card with the word "precision" in the title, reveal it to your opponent, put it into your hand, and shuffle your Arsenal.',
        "backlash": "Mid-match",
    },
    {
        "id": "backfire",
        "name": "Backfire",
        "type": "Action",
        "traits": ["Heat"],
        "fortitude": 4,
        "damage": 0,
        "text": "Cannot be reversed from your opponent's hand if you have Heat cards in your Ring area. Look at your opponent's hand. He overturns cards equal to the number of Reversal cards in his hand and in his Ring area.",
        "backlash": "Mid-match",
    },
]

# --- Extras cards (main deck) ---
EXTRAS_CARDS = [
    {
        "id": "bash-punch",
        "name": "BASH Punch",
        "type": "Maneuver",
        "subtypes": ["Strike"],
        "traits": ["Multi"],
        "packRestrictions": {"female": "forbidden"},
        "fortitude": 4,
        "damage": 8,
        "text": "Cannot be packed by Female Superstars.",
    },
    {
        "id": "rolling-neck-breaker",
        "name": "Rolling Neck Breaker",
        "type": "Maneuver",
        "subtypes": ["Grapple"],
        "extraTypes": ["Reversal"],
        "traits": ["Special"],
        "fortitude": 5,
        "damage": 8,
        "text": 'Cannot be reversed by hybrid Reversal cards. As a reversal, reverse any card with the word "Dynamic" in the title and end your opponent\'s turn.',
        "reverses": {
            "cardTitles": ["Dynamic"],
        },
        "reversalFromHandOnly": True,
    },
    {
        "id": "stretch-opponent",
        "name": "Stretch Opponent",
        "type": "Maneuver",
        "subtypes": ["Submission"],
        "traits": ["Chain"],
        "fortitude": 10,
        "damage": 8,
        "text": "When successfully played, put up to 2 Action: Chain cards from your Ringside pile into your hand.",
    },
    {
        "id": "shoot-lock-up",
        "name": "Shoot Lock-up",
        "type": "Maneuver",
        "subtypes": ["Submission"],
        "traits": ["Multi"],
        "packRestrictions": {"female": "forbidden"},
        "fortitude": 9,
        "damage": 8,
        "text": "Cannot be packed by Female Superstars. When your opponent is a GM or Legend Superstar, this card is -9F. When your Fortitude Rating is at least 5 less than his Fortitude Rating, this card can only be reversed from his Arsenal.",
    },
    {
        "id": "fujiwara-arm-bar",
        "name": "Fujiwara Arm Bar",
        "type": "Maneuver",
        "subtypes": ["Submission"],
        "traits": ["Chain", "Cheater"],
        "fortitude": 12,
        "damage": 13,
        "text": "Can only be played after a successfully played card. When successfully played, you may put 1 card from your Ringside pile into your hand.",
    },
    {
        "id": "precision-suplex",
        "name": "Precision Suplex",
        "type": "Maneuver",
        "subtypes": ["Grapple"],
        "fortitude": 20,
        "damage": 20,
        "text": 'When played, name a number 5 or less. Your opponent shuffles that many of his cards that have been removed from the game into his Arsenal. This card is -2F for each number named.',
    },
    {
        "id": "quick-snap-suplex",
        "name": "Quick Snap Suplex",
        "type": "Maneuver",
        "subtypes": ["Grapple"],
        "traits": ["Heat"],
        "fortitude": 7,
        "damage": 8,
        "text": "When successfully played, choose 1: remove any number of Heat cards in your Ringside pile from the game and then search your Arsenal for the same number of Heat cards, put them into your Ringside pile, and shuffle your Arsenal; or discard any number of Heat cards and then search your Arsenal for the same number of Heat cards, remove them from the game, and shuffle your Arsenal.",
    },
    {
        "id": "bash-headlock",
        "name": "BASH Headlock",
        "type": "Maneuver",
        "subtypes": ["Submission"],
        "traits": ["Multi"],
        "packRestrictions": {"female": "forbidden"},
        "fortitude": 2,
        "damage": 6,
        "text": "Cannot be packed by Female Superstars. When successfully played, your opponent discards 1 card.",
    },
    {
        "id": "the-power-is-back",
        "name": "The Power Is Back",
        "type": "Action",
        "fortitude": 0,
        "damage": 0,
        "text": "Draw 1 card. Your cards are -5F for the rest of this turn and during your opponent's next turn.",
    },
    {
        "id": "listen-loud-and-clear",
        "name": "Listen Loud and Clear",
        "type": "Action",
        "fortitude": 3,
        "damage": 0,
        "text": "Draw 1 card and your next card played this turn is -7F.",
    },
    {
        "id": "headlock-takedown",
        "name": "Headlock Takedown",
        "type": "Maneuver",
        "subtypes": ["Grapple"],
        "traits": ["Throwback", "Ace"],
        "fortitude": 0,
        "damage": 1,
        "text": "When this card is in your Ring area, during your turn you may put this card into your Ringside pile and if your next card played this turn is a non-unique card, it is -10F.",
    },
    {
        "id": "no-pain-no-chain",
        "name": "No Pain, No Chain",
        "type": "Action",
        "traits": ["Chain"],
        "fortitude": 3,
        "damage": 0,
        "text": "Draw 3 cards, shuffle 3 cards from your Ringside pile into your Arsenal, and then discard 3 cards. When your next card played this turn is the card titled Chained Aggression, it cannot be reversed.",
    },
    {
        "id": "precision-figure-four",
        "name": "Precision Figure Four",
        "type": "Maneuver",
        "subtypes": ["Submission"],
        "fortitude": 14,
        "damage": 16,
        "notes": "rare",
        "text": "When played, shuffle up to 5 cards from your hand into your Arsenal. This card is -2F for each card shuffled in.",
    },
    {
        "id": "fisticuffs",
        "name": "Fisticuffs",
        "type": "Maneuver",
        "subtypes": ["Strike"],
        "traits": ["Volley"],
        "fortitude": 5,
        "damage": 9,
        "notes": "rare",
        "text": "When this card is reversed from your opponent's hand, remove 4 cards in his Ringside pile from the game.",
    },
    {
        "id": "give-and-take",
        "name": "Give & Take",
        "type": "Action",
        "traits": ["Throwback", "Fan Favorite!"],
        "fortitude": 0,
        "damage": 0,
        "text": "All players may put 2 cards from their Ringside pile on the bottom of their Arsenal. When this card is in your Ring area, whenever your opponent successfully plays a card that allows him to search his Arsenal for any number of cards, you may search your Arsenal for 1 non-unique card, reveal it to him, put it into your hand, and shuffle your Arsenal.",
    },
    {
        "id": "kidney-punch",
        "name": "Kidney Punch",
        "type": "Maneuver",
        "subtypes": ["Strike"],
        "traits": ["Volley"],
        "fortitude": 4,
        "damage": 8,
        "notes": "rare",
        "text": "When this card is in your Ringside pile, during your turn you may remove 4 cards in your Ringside pile from the game and then put this card into your hand.",
    },
    {
        "id": "knee-breaker",
        "name": "Knee Breaker",
        "type": "Maneuver",
        "subtypes": ["Strike"],
        "traits": ["Throwback"],
        "fortitude": 1,
        "damage": 8,
        "text": "Can only be played after a successfully played card or if you reversed a card to end your opponent's last turn and this is the first card played of your turn. When this card is in your Ring area, your cards with the word \"leg\" in the title are +1D.",
    },
    {
        "id": "back-fist",
        "name": "Back Fist",
        "type": "Maneuver",
        "subtypes": ["Strike"],
        "extraTypes": ["Reversal"],
        "traits": ["Volley", "Special"],
        "fortitude": 6,
        "damage": 4,
        "notes": "rare",
        "text": "As a maneuver, this card is -6F and when this is the first card played of your turn, it is also +4D. As a reversal, reverse any maneuver of 3D or less and end your opponent's turn.",
        "reverses": {
            "maxDamage": 3,
        },
        "reversalFromHandOnly": True,
    },
    {
        "id": "wrist-breaker",
        "name": "Wrist Breaker",
        "type": "Maneuver",
        "subtypes": ["Submission"],
        "fortitude": 2,
        "damage": 6,
        "text": "When successfully played, you may look at your opponent's hand or Backlash deck.",
    },
    {
        "id": "standing-drop-kick",
        "name": "Standing Drop Kick",
        "type": "Maneuver",
        "subtypes": ["Strike"],
        "traits": ["Throwback"],
        "fortitude": 8,
        "damage": 8,
        "text": "This card is -3F when your Fortitude Rating is less than your opponent's Fortitude Rating. When successfully played, your opponent discards 3 cards.",
    },
    {
        "id": "stagger",
        "name": "Stagger",
        "type": "Action",
        "traits": ["Throwback"],
        "fortitude": 3,
        "damage": 0,
        "text": "Can only be played after a successfully played maneuver. Draw 1 card. When your next card played this turn is a maneuver of 9D or less, it cannot be reversed.",
    },
    {
        "id": "running-spinebuster",
        "name": "Running Spinebuster",
        "type": "Maneuver",
        "subtypes": ["Grapple"],
        "traits": ["Throwback", "Ace"],
        "fortitude": 4,
        "damage": 7,
        "text": "When this card is in your Ring area, during your turn you may put this card into your Ringside pile and then shuffle up to 2 other cards from your Ringside pile into your Arsenal.",
    },
    {
        "id": "pendulum-back-breaker",
        "name": "Pendulum Back Breaker",
        "type": "Maneuver",
        "subtypes": ["Grapple"],
        "traits": ["Chain"],
        "fortitude": 9,
        "damage": 9,
        "text": "When your Fortitude Rating is less than your opponent's Fortitude Rating, this card is -5F.",
    },
    {
        "id": "not-yet",
        "name": "Not Yet",
        "type": "Action",
        "traits": ["Face", "Throwback"],
        "fortitude": 0,
        "damage": 0,
        "text": "Put 1 card from your hand on the bottom of your Arsenal and then look at the top 10 cards of your Arsenal, put 2 into your hand, and put the rest on the bottom of your Arsenal.",
    },
    {
        "id": "360-degree-clothesline",
        "name": "360-Degree Clothesline",
        "type": "Maneuver",
        "subtypes": ["Strike"],
        "extraTypes": ["Reversal"],
        "traits": ["Special", "Survivor Series"],
        "fortitude": 12,
        "damage": 10,
        "text": 'As a reversal, reverse any maneuver with the word "kick" in the title and end your opponent\'s turn. When successfully played, shuffle up to 3 cards from your Ringside pile into your Arsenal.',
        "reverses": {
            "cardTitles": ["kick"],
        },
        "reversalFromHandOnly": True,
    },
    {
        "id": "great-technical-knowledge",
        "name": "Great Technical Knowledge",
        "type": "Action",
        "traits": ["Throwback", "Survivor Series"],
        "fortitude": 0,
        "damage": 0,
        "text": "Draw 1 card. When this card is in your Ring area, your Submission maneuvers are +1D.",
    },
    {
        "id": "dont-cross-the-boss",
        "name": "Don't Cross the Boss",
        "type": "Action",
        "traits": ["Throwback", "Survivor Series"],
        "fortitude": 6,
        "damage": 0,
        "text": "When this card is in your Ring area, if your opponent successfully plays an Action card, you may draw 1 card.",
    },
]

def copy_docx_images(docx_path, card_list, prefix):
    """Extract images from a docx in drawing order and copy to public/cards/."""
    with zipfile.ZipFile(docx_path, 'r') as z:
        media_files = [n for n in z.namelist() if n.startswith('word/media/')]
    
    from docx import Document
    doc = Document(docx_path)
    rels = doc.part.rels
    
    # Get drawing order
    drawings_order = []
    for p in doc.paragraphs:
        for run in p.runs:
            for dr in run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing'):
                for blip in dr.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip'):
                    rid = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                    if rid:
                        drawings_order.append(rid)
    
    print(f"\n{os.path.basename(docx_path)}: {len(drawings_order)} drawings, {len(card_list)} cards")
    
    for i, card in enumerate(card_list):
        if i >= len(drawings_order):
            print(f"  WARNING: No drawing for card {i}: {card['name']}")
            continue
        rid = drawings_order[i]
        if rid not in rels:
            print(f"  WARNING: No rel for {rid}")
            continue
        
        target = rels[rid].target_ref
        if not target.startswith('word/'):
            target = 'word/' + target
        # Extract from zip
        with zipfile.ZipFile(docx_path, 'r') as z:
            with z.open(target) as src:
                data = src.read()
        
        out_path = os.path.join(PUBLIC_CARDS, f"{card['id']}.png")
        with open(out_path, 'wb') as f:
            f.write(data)
        print(f"  {card['id']}.png <- {target} ({len(data)} bytes)")

def generate_cards_ts_entries():
    """Generate TypeScript entries for both card sets."""
    
    midmatch_entries = []
    for c in MIDMATCH_CARDS:
        entry = f"""  card({{
    id: '{c["id"]}',
    name: '{c["name"]}',
    type: '{c["type"]}',"""
        if "subtypes" in c:
            entry += f"\n    subtypes: {c['subtypes']},"
        if "extraTypes" in c:
            entry += f"\n    extraTypes: {c['extraTypes']},"
        entry += f"\n    traits: {c['traits']},"
        entry += f"\n    fortitude: {c['fortitude']},"
        entry += f"\n    damage: {c['damage']},"
        entry += f"\n    text: '{c['text']}'" if "'" not in c['text'] else f'\n    text: "{c["text"]}",'
        entry += f",\n    backlash: 'Mid-match',"
        entry += "\n    set: 'Midmatch',"
        entry += "\n  }),"
        midmatch_entries.append(entry)
    
    extras_entries = []
    for c in EXTRAS_CARDS:
        entry = f"""  card({{
    id: '{c["id"]}',
    name: '{c["name"]}',
    type: '{c["type"]}',"""
        if "subtypes" in c:
            entry += f"\n    subtypes: {c['subtypes']},"
        if "extraTypes" in c:
            entry += f"\n    extraTypes: {c['extraTypes']},"
        if "traits" in c:
            entry += f"\n    traits: {c['traits']},"
        if "packRestrictions" in c:
            entry += f"\n    packRestrictions: {c['packRestrictions']},"
        entry += f"\n    fortitude: {c['fortitude']},"
        entry += f"\n    damage: {c['damage']},"
        if "notes" in c:
            entry += f"\n    notes: '{c['notes']}',"
        text = c['text']
        if "'" in text:
            entry += f'\n    text: "{text}",'
        else:
            entry += f"\n    text: '{text}',"
        if "reverses" in c:
            import json
            entry += f"\n    reverses: {json.dumps(c['reverses'])},"
        if "reversalFromHandOnly" in c:
            entry += "\n    reversalFromHandOnly: true,"
        entry += "\n    set: 'Extras',"
        entry += "\n  }),"
        extras_entries.append(entry)
    
    return "\n".join(midmatch_entries), "\n".join(extras_entries)


if __name__ == "__main__":
    midmatch_docx = os.path.join(DECKS, "Midmatch.docx")
    extras_docx = os.path.join(DECKS, "Extras.docx")
    
    if os.path.exists(midmatch_docx):
        copy_docx_images(midmatch_docx, MIDMATCH_CARDS, "midmatch")
    else:
        print(f"WARNING: {midmatch_docx} not found")
    
    if os.path.exists(extras_docx):
        copy_docx_images(extras_docx, EXTRAS_CARDS, "extras")
    else:
        print(f"WARNING: {extras_docx} not found")
    
    midmatch_ts, extras_ts = generate_cards_ts_entries()
    
    print("\n\n=== MIDMATCH CARDS (add to cards.ts) ===")
    print(midmatch_ts)
    print("\n=== EXTRAS CARDS (add to cards.ts) ===")
    print(extras_ts)
    
    # Write to temp files for easy insertion
    with open(os.path.join(HERE, "midmatch_cards.ts"), "w") as f:
        f.write(midmatch_ts)
    with open(os.path.join(HERE, "extras_cards.ts"), "w") as f:
        f.write(extras_ts)
    
    print(f"\nWrote temp files to {HERE}")
