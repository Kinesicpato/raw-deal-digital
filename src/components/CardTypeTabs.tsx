export type CardClassFilter = 'all' | 'Maneuver' | 'Reversal' | 'Action' | 'Superstar'

export const CARD_CLASS_LABELS: Record<CardClassFilter, string> = {
  all: 'Todas',
  Maneuver: 'Maniobras',
  Reversal: 'Reversal',
  Action: 'Acciones',
  Superstar: 'Superestrella',
}

export function classifyCard(c: { type: string; extraTypes?: string[]; superstar?: string[] }): CardClassFilter {
  const types = [c.type, ...(c.extraTypes ?? [])]
  if (c.type === 'Superstar') return 'Superstar'
  if (types.includes('Reversal')) return 'Reversal'
  if (types.includes('Maneuver')) return 'Maneuver'
  if (types.includes('Action')) return 'Action'
  return 'all'
}

export function CardTypeTabs({
  value,
  onChange,
  counts,
}: {
  value: CardClassFilter
  onChange: (v: CardClassFilter) => void
  counts?: Partial<Record<CardClassFilter, number>>
}) {
  const order: CardClassFilter[] = ['all', 'Maneuver', 'Reversal', 'Action', 'Superstar']
  return (
    <div className="tabs">
      {order.map((k) => (
        <button
          key={k}
          className={`tab ${value === k ? 'active' : ''} cls-${k}`}
          onClick={() => onChange(k)}
        >
          {CARD_CLASS_LABELS[k]}
          {counts && counts[k] !== undefined ? <span className="tab-count">{counts[k]}</span> : null}
        </button>
      ))}
    </div>
  )
}