// Exports card + superstar data to JSON for the Python image generator.
// Run: node scripts/export-cards.mjs
import { writeFileSync, mkdirSync } from 'node:fs'

const { ALL_CARDS, SUPERSTARS } = await import('../src/data/cards.ts')

mkdirSync('scripts/generated', { recursive: true })
writeFileSync(
  'scripts/generated/cards.json',
  JSON.stringify(
    {
      superstars: SUPERSTARS.map((s) => ({ id: s.id, name: s.name, alignment: s.alignment, brand: s.brand })),
      cards: ALL_CARDS.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        extraTypes: c.extraTypes ?? [],
        subtypes: c.subtypes ?? [],
        traits: c.traits ?? [],
        brand: c.brand ?? null,
        fortitude: c.fortitude,
        damage: c.damage,
        stun: c.stun ?? 0,
        superstar: c.superstar ?? [],
        backlash: c.backlash ?? null,
        text: c.text,
      })),
    },
    null,
    2,
  ),
)
console.log('exported', ALL_CARDS.length, 'cards to scripts/generated/cards.json')