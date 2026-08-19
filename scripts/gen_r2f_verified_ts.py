import json

v = json.load(open(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_verified_by_name.json', encoding='utf-8'))

# Only include entries with an actual F or D value (skip superstars / unknown)
out = []
for name, d in sorted(v.items()):
    f = d['fortitude']
    dd = d['damage']
    stun = d['stun']
    out.append({
        'name': name,
        'f': f if f is not None else 0,
        'd': dd if dd is not None else 0,
        'sv': stun if stun is not None else None,
        'src': f"{d['set']} #{d['num']}".strip(),
    })

lines = []
lines.append('// AUTO-GENERATED from readytofight.cl official set lists (scripts/match_names.py).')
lines.append('// Verified Fortitude/Damage/Stun per card name. Overrides provisional OCR values.')
lines.append('import type { CardDef } from "./types"')
lines.append('')
lines.append('/** name -> { f, d, sv } as printed by readytofight.cl. */')
lines.append('export const R2F_VERIFIED: Record<string, { f: number; d: number; sv: number | null; src: string }> = {')
for o in out:
    lines.append(f"  {json.dumps(o['name'], ensure_ascii=False)}: {{ f: {o['f']}, d: {o['d']}, sv: {o['sv'] if o['sv'] is not None else 'null'}, src: {json.dumps(o['src'], ensure_ascii=False)} }},")
lines.append('}')
lines.append('')
lines.append('/** Apply verified readytofight.cl stats onto a card by exact name match. */')
lines.append('export function applyVerifiedStats(card: CardDef): CardDef {')
lines.append('  const v = R2F_VERIFIED[card.name]')
lines.append('  if (!v) return card')
lines.append('  return { ...card, fortitude: v.f, damage: v.d, stun: v.sv ?? card.stun, notes: dimMaybe(card.notes) }')
lines.append('}')
lines.append('')
lines.append('function dimMaybe(notes: string | undefined): string | undefined {')
lines.append('  if (!notes) return undefined')
lines.append('  return notes')
lines.append('}')
lines.append('')

open(r'C:\Users\patri\Downloads\raw-deal\src\data\r2fVerified.ts', 'w', encoding='utf-8').write('\n'.join(lines))
print('wrote src/data/r2fVerified.ts with', len(out), 'entries')
missing_d = [o['name'] for o in out if o['d'] is None]
print('sample:', out[:3])