import json, re, unicodedata
from difflib import SequenceMatcher

R2F = r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_cards_raw.json'

def norm(s):
    s = unicodedata.normalize('NFKD', s.replace('\ufffd', '')).encode('ascii', 'ignore').decode()
    s = re.sub(r'\s+', ' ', s.lower()).strip()
    s = re.sub(r'\bV\d+(\.\d+)?\b', '', s)
    s = re.sub(r'\s*\([^)]*\)\s*$', '', s)
    s = re.sub(r'\s*\([^)]*\)\s+', ' ', s)  # internal parens like "(for Kurt Angle)"
    s = re.sub(r"[^a-z0-9 ]", '', s)
    return re.sub(r'\s+', ' ', s).strip()

r2f = json.load(open(R2F, encoding='utf-8'))
cards_json = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\cards.json', encoding='utf-8'))
matched = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_verified_by_name.json', encoding='utf-8'))

names = []
for c in cards_json['cards']:
    if c['name'] not in names:
        names.append(c['name'])
unmatched = [n for n in sorted(names) if n not in matched]

print('still unmatched:', len(unmatched))
for n in unmatched:
    c = next((x for x in cards_json['cards'] if x['name'] == n), None)
    if not c or c['type'] == 'Superstar':
        print('  (superstar) ', repr(n))
        continue
    pn = norm(n)
    if not pn:
        continue
    cands = []
    for x in r2f:
        if x['fortitude'] is None and x['damage'] is None:
            continue
        xn = norm(x['title'])
        if not xn or len(xn) < 3:
            continue
        r = SequenceMatcher(None, pn, xn).ratio()
        if r >= 0.72:
            cands.append((r, x))
    cands.sort(key=lambda t: -t[0])
    if cands:
        best = cands[0][1]
        print(f'  FOUND {n:<42} -> {best["set"]} {best["num"]:<10} {best["title"][:38]:<40} F={best["fortitude"]} D={best["damage"]} (ratio {cands[0][0]:.2f})')
    else:
        print(f'  MISS  {n}')