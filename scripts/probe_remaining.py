import json, re, unicodedata

R2F = r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_cards_raw.json'

def norm(s):
    s = unicodedata.normalize('NFKD', s.replace('\ufffd', '')).encode('ascii', 'ignore').decode()
    s = re.sub(r'\s+', ' ', s.lower()).strip()
    s = re.sub(r'\bV\d+(\.\d+)?\b', '', s)
    s = re.sub(r'\([^)]*\)\s*$', '', s)
    s = re.sub(r"[^a-z0-9 ]", '', s)
    return re.sub(r'\s+', ' ', s).strip()

r2f = json.load(open(R2F, encoding='utf-8'))

probes = ['Cactus Clothesline', 'Bang Bang', 'Barbed Wire Baseball', 'Stump-Puller', "Cactus's Double Arm", 'I Hardcore', 'Hardcore Diaries', 'Hardcore Assault', 'Extreme Promo', 'Hardcore Title', 'Screeching Car Crash', 'Face the Music', 'Fall-Away Suplex', 'Kay-Fabe', 'Mr Socko', 'Once is Enough', 'Surprise Technical', 'Technical Drop Kick', 'The Finisher', 'Tonight I Unleash', 'X-treme', 'Armed Dangerous', 'Always Have a Plan', 'Chained Aggression', 'Take Your Own Medicine', 'Armageddon', 'Bang Bang']
for probe in probes:
    pn = norm(probe)
    hits = [c for c in r2f if pn in norm(c['title'])]
    print('===', probe)
    for h in hits[:6]:
        print('   ', h['set'], h['num'], repr(h['title'])[:50], 'F=', h['fortitude'], 'D=', h['damage'])