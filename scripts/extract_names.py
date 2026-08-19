import json, re

names = {}
for f in [r'C:\Users\patri\Downloads\raw-deal\src\data\cards.ts', r'C:\Users\patri\Downloads\raw-deal\src\data\ocrCards.ts', r'C:\Users\patri\Downloads\raw-deal\src\data\defaultDeck.ts']:
    src = open(f, encoding='utf-8').read()
    for m in re.finditer(r"name:\s*['\"]([^'\"]+)['\"]", src):
        names[m.group(1)] = True

out = list(names.keys())
json.dump(out, open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\catalog_names.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('catalog names:', len(out))
for n in sorted(out)[:25]:
    print(repr(n))