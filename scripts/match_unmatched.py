import json, re, unicodedata

R2F = r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_cards_raw.json'

def norm(s, strip_punct=False):
    s = unicodedata.normalize('NFKD', s.replace('\ufffd', '')).encode('ascii', 'ignore').decode()
    s = s.lower()
    if strip_punct:
        s = re.sub(r"[^a-z0-9 ]", '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

r2f = json.load(open(R2F, encoding='utf-8'))

cards_json = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\cards.json', encoding='utf-8'))
names = []
for c in cards_json['cards']:
    if c['name'] not in names:
        names.append(c['name'])

unmatched = []
matched_meta = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_verified_by_name.json', encoding='utf-8'))
for n in sorted(names):
    if n in matched_meta:
        continue
    pn = norm(n, strip_punct=True)
    if not pn:
        continue
    hits = []
    for c in r2f:
        k = norm(c['title'], strip_punct=True)
        if not k:
            continue
        if pn == k:
            hits.append(c)
    print('===', repr(n), 'pn=', repr(pn))
    if hits:
        for h in hits[:6]:
            print('   HIT', h['set'], h['num'], repr(h['title']), 'F=', h['fortitude'], 'D=', h['damage'])
    else:
        # token overlap
        words = set(pn.split())
        if len(words) >= 3:
            cands = []
            for c in r2f:
                k = norm(c['title'], strip_punct=True)
                kw = set(k.split())
                inter = words & kw
                if len(inter) >= 2 and len(inter) >= len(words) - 1:
                    cands.append((c, len(inter)))
            cands.sort(key=lambda t: -t[1])
            for h, _ in cands[:4]:
                print('   ?', h['set'], h['num'], repr(h['title']), 'F=', h['fortitude'], 'D=', h['damage'])
    print()