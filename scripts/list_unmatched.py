import json

matched = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_verified_by_name.json', encoding='utf-8'))
cards_json = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\cards.json', encoding='utf-8'))

unmatched = [c for c in cards_json['cards'] if c['name'] not in matched]
print('remaining unmatched:', len(unmatched))
for c in unmatched:
    print(f'  {c["name"]:<44} type={c["type"]:<10} F={c["fortitude"]} D={c["damage"]} superstar={c.get("superstar")} traits={c.get("traits")}')