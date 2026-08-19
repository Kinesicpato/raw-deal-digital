import json, re, unicodedata
from difflib import SequenceMatcher

R2F = r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_cards_raw.json'

def norm(s, strip=True):
    s = unicodedata.normalize('NFKD', s.replace('\ufffd', '')).encode('ascii', 'ignore').decode()
    s = re.sub(r'\s+', ' ', s.lower()).strip()
    s = re.sub(r'\bV\d+(\.\d+)?\b', '', s)  # version markers like V1.1
    s = re.sub(r'\([^)]*\)\s*$', '', s)
    if strip:
        s = re.sub(r"[^a-z0-9 ]", '', s)
    return re.sub(r'\s+', ' ', s).strip()

r2f = json.load(open(R2F, encoding='utf-8'))
cards_json = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\cards.json', encoding='utf-8'))
names = []
for c in cards_json['cards']:
    if c['name'] not in names:
        names.append(c['name'])

matched_meta = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_verified_by_name.json', encoding='utf-8'))

# Manual aliases: game name -> r2f title (found by inspection)
ALIASES = {
    "Don't You Never...Eeeever!": "Don't You Never ... EVER!",
    "I Can't Be Reading This Right": "I Can't Be Reading This Right...",
    'Sloppy... Very Sloppy': 'Sloppy ... Very Sloppy',
    'Everybody Wants (and Needs) a... Snow Job?': 'Everybody Wants (and Needs) a ... Snow Job?',
    'Let Me Get a Shot In': 'Let Me Get a Shot In',
    'The Maneuver of Doom': 'The Maneuver of Doom',
    'Tornado Takedown of Doom': 'Tornado Takedown of Doom',
    "You Can't Cheat an Honest Man": "You Can't Cheat an Honest",
    'Bow&Arrow': 'a%',  # stub, resolved below if not found
}

# Build title lookup from r2f (best F/D)
by_title = {}
for c in r2f:
    key = c['title']  # raw title for alias matching and normalized for norm matching
    def score(x):
        return (0 if x['fortitude'] is not None else 1, 0 if x['damage'] is not None else 1)
    cur = by_title.get(key)
    if cur is None or score(c) < score(cur):
        by_title[key] = c

def find_best(game_name, allow_fuzzy=True):
    """Return the r2f card matching game_name, or None."""
    gk = norm(game_name)
    # 1. exact normalized match
    for c in r2f:
        if norm(c['title']) == gk and c['fortitude'] is not None:
            return c
    # 2. manual alias
    if game_name in ALIASES:
        t = ALIASES[game_name]
        for c in r2f:
            if norm(c['title']) == norm(t) and c['fortitude'] is not None:
                return c
    # 3. fuzzy (ratio) among candidates with F
    best = None
    best_ratio = 0.82
    for c in r2f:
        if c['fortitude'] is None:
            continue
        ck = norm(c['title'])
        if not ck:
            continue
        r = SequenceMatcher(None, gk, ck).ratio()
        if r > best_ratio:
            best_ratio = r
            best = c
    return best if best_ratio > 0.8 else None

add = {}
print('--- additional fuzzy matches ---')
for n in sorted(names):
    if n in matched_meta:
        continue
    c = find_best(n)
    if c:
        add[n] = {'fortitude': c['fortitude'], 'damage': c['damage'], 'stun': c['stun'], 'set': c['set'], 'title': c['title'], 'num': c['num']}
        print(f'  {n:<42} <- {c["set"]} {c["num"]:<16} {c["title"][:34]:<36} F={c["fortitude"]} D={c["damage"]}')
    else:
        print(f'  (no match) {repr(n)}')

merged = {**matched_meta, **add}
json.dump(merged, open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_verified_by_name.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\nTotal matched now:', len(merged), 'of', len(names))