import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SUPERSTARS } from '../data/cards'
import { buildDefaultDeck } from '../data/defaultDeck'
import { AppBanner } from '../components/Branding'
import { CardFace } from '../components/CardView'
import type { NewGameConfig } from '../engine/game'

interface PlayerSlot {
  name: string
  superstarId: string
  handSize: number
  deckName: string | null
}

const defaultNames = ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4', 'Jugador 5']

export function SetupPage() {
  const decks = useAppStore((s) => s.decks)
  const setView = useAppStore((s) => s.setView)
  const startGame = useAppStore((s) => s.startGame)

  const [count, setCount] = useState(2)
  const [slots, setSlots] = useState<PlayerSlot[]>(
    defaultNames.map((name) => ({
      name,
      superstarId: '',
      handSize: 7,
      deckName: null,
    })),
  )

  const updateSlot = (i: number, patch: Partial<PlayerSlot>) => {
    setSlots((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  }

  const pickSuperstar = (i: number, id: string) => {
    const ss = SUPERSTARS.find((s) => s.id === id)
    updateSlot(i, { superstarId: id, handSize: ss?.handSize ?? 7, deckName: null })
  }

  const pickDeck = (i: number, name: string) => {
    if (!name) {
      updateSlot(i, { deckName: null })
      return
    }
    const deck = decks.find((d) => d.name === name)
    updateSlot(i, { deckName: name, superstarId: deck?.superstarId ?? '' })
  }

  const activeSlots = slots.slice(0, count)
  const allSuperstarsChosen = activeSlots.every((s) => s.superstarId !== '')
  const canStart = allSuperstarsChosen

  const start = () => {
    if (!canStart) return
    const cfg: NewGameConfig = {
      players: activeSlots.map((slot) => {
        const deck = slot.deckName ? decks.find((d) => d.name === slot.deckName) : undefined
        if (deck) {
          return {
            name: slot.name,
            superstarId: deck.superstarId,
            handSize: slot.handSize,
            arsenal: [...deck.arsenal],
            backlashPre: [...deck.backlashPre],
            backlashMid: [...deck.backlashMid],
          }
        }
        const d = buildDefaultDeck(slot.superstarId)
        return {
          name: slot.name,
          superstarId: slot.superstarId,
          handSize: slot.handSize,
          arsenal: d.arsenal,
          backlashPre: d.pre,
          backlashMid: d.mid,
        }
      }),
    }
    startGame(cfg)
    setView('game')
  }

  return (
    <div className="page">
      <AppBanner subtitle="Configurar partida" />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="spacer" />
        <button className="ghost" onClick={() => setView('menu')}>Volver</button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <label>Jugadores</label>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} jugadores</option>
            ))}
          </select>
          <span className="muted">Todos contra todos, de 2 a 5. Por cada jugador elegí su Superestrella para que aparezca en su panel.</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {activeSlots.map((slot, i) => (
          <div key={i} className="card" style={{ borderColor: slot.superstarId ? 'var(--gold)' : 'var(--line)' }}>
            <h3>Slot {i + 1}</h3>
            <div className="grid" style={{ gap: 8 }}>
              <label>Nombre</label>
              <input value={slot.name} onChange={(e) => updateSlot(i, { name: e.target.value })} />

              <label style={{ marginTop: 4 }}>
                Superestrella <span className="muted">(obligatoria)</span>
              </label>
              <div className="chiprow" style={{ flexWrap: 'wrap' }}>
                {SUPERSTARS.map((s) => (
                  <div key={s.id} style={{ cursor: 'pointer' }} onClick={() => pickSuperstar(i, s.id)}>
                    <CardFace id={`superstar-${s.id}`} size="sm" selected={slot.superstarId === s.id} />
                  </div>
                ))}
              </div>
              {!slot.superstarId && (
                <div className="muted" style={{ fontSize: 12 }}>Elegí la carta de Superestrella de este jugador.</div>
              )}

              <label style={{ marginTop: 4 }} htmlFor={`hand-${i}`}>Mano inicial (hand size)</label>
              <input
                id={`hand-${i}`}
                type="number"
                min={1}
                max={12}
                value={slot.handSize}
                onChange={(e) => updateSlot(i, { handSize: Math.max(1, Math.min(12, Number(e.target.value))) })}
              />
              <div className="muted" style={{ fontSize: 12 }}>
                Cartas que recibe al iniciar la partida (usa el hand size de la Superestrella por defecto).
              </div>

              <label style={{ marginTop: 4 }}>Mazo</label>
              <select
                value={slot.deckName ?? ''}
                onChange={(e) => pickDeck(i, e.target.value)}
              >
                <option value="">Mazo automático</option>
                {decks.map((d) => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
              <div className="muted" style={{ fontSize: 12 }}>
                {slot.deckName
                  ? `Usará: ${slot.deckName}`
                  : slot.superstarId
                    ? `Mazo automático de ${getSuperstarName(slot.superstarId)} (60 cartas).`
                    : 'Elegí primero la Superestrella.'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 16, gap: 12 }}>
        <button
          className="primary"
          style={{ fontSize: 17, padding: '12px 26px' }}
          onClick={start}
          disabled={!canStart}
        >
          Comenzar partida
        </button>
        {!allSuperstarsChosen && <span className="muted">Todos los jugadores deben elegir su Superestrella.</span>}
      </div>
    </div>
  )
}

function getSuperstarName(id: string): string {
  return SUPERSTARS.find((s) => s.id === id)?.name ?? id
}