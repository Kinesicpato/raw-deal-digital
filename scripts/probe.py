import json, unicodedata

d = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_cards_raw.json', encoding='utf-8'))

def norm(s):
    s = unicodedata.normalize('NFKD', s.replace('\ufffd', '')).encode('ascii', 'ignore').decode()
    s = s.lower().replace("'", '').replace('"', '').replace('!', '')
    return s

probes = ['Shoot Punch', "Angle's Uppercut", 'Blatant Chokehold', 'Strangle Hold', 'Angle Lock', 'Technical Drop Kick', 'Rolling Takedown', 'Tree of Woe', 'Panic Grab', 'The Finisher', 'The Maneuver of Doom', 'Whoo!', 'Knee to the Gut', 'Defensive Stance', 'Bow&Arrow', 'Cactus Clothesline', 'Double Arm DDT', 'Rolling Thunder']
for probe in probes:
    pn = norm(probe)
    hits = [c for c in d if pn in norm(c['title'])]
    print('===', probe)
    for h in hits[:5]:
        print('   ', h['set'], h['num'], repr(h['title']), 'F=', h['fortitude'], 'D=', h['damage'])