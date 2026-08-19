import json, re, unicodedata

R2F = r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_cards_raw.json'

def norm(s):
    s = unicodedata.normalize('NFKD', s.replace('\ufffd', '')).encode('ascii', 'ignore').decode()
    s = s.lower().replace("'", '').replace('"', '').replace('!', '').replace('?', '')
    s = re.sub(r'\s*\([^)]*\)\s*$', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

r2f = json.load(open(R2F, encoding='utf-8'))

# Build map normalized title -> best entry
by_title = {}
for c in r2f:
    key = norm(c['title'])
    if not key:
        continue
    def score(x):
        return (0 if x['fortitude'] is not None else 1,
                0 if x['damage'] is not None else 1)
    cur = by_title.get(key)
    if cur is None or score(c) < score(cur):
        by_title[key] = c

# Load game catalog names from cards.json (the real runtime list)
cards_json = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\cards.json', encoding='utf-8'))
names = []
for c in cards_json['cards']:
    if c['name'] not in names:
        names.append(c['name'])

matched = {}
unmatched = []
matches_log = []
for n in sorted(names):
    key = norm(n)
    if key in by_title:
        c = by_title[key]
        matched[n] = {'fortitude': c['fortitude'], 'damage': c['damage'], 'stun': c['stun'], 'set': c['set'], 'title': c['title'], 'num': c['num']}
        matches_log.append((n, key, c['set'], c['num'], c['fortitude'], c['damage']))
    else:
        unmatched.append(n)

print('names total:', len(names))
print('matched:', len(matched), '| unmatched:', len(unmatched))
for n, k, s, num, f, d in matches_log:
    print(f'  {n:<40} <- {s} {num:<8} F={f} D={d}')
print('--- unmatched ---')
for u in unmatched:
    print('  -', repr(u))

json.dump(matched, open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_verified_by_name.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote r2f_verified_by_name.json')