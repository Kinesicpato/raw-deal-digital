import { useAppStore } from '../store/useAppStore'
import { AppBanner } from '../components/Branding'

export function MenuPage() {
  const setView = useAppStore((s) => s.setView)
  const decks = useAppStore((s) => s.decks)
  const game = useAppStore((s) => s.game)
  const setActiveDeck = useAppStore((s) => s.setActiveDeck)
  const deleteDeck = useAppStore((s) => s.deleteDeck)

  const editDeck = (name: string) => {
    setActiveDeck(name)
    setView('deck')
  }

  const newDeck = () => {
    setActiveDeck(null)
    setView('deck')
  }

  return (
    <div className="page">
      <AppBanner subtitle="juego de cartas digital — hasta 5 jugadores" />

      <div className="grid" style={{ width: '100%', maxWidth: 460, margin: '28px auto 0' }}>
        <button className="primary" style={{ padding: '18px', fontSize: 18 }} onClick={() => setView('setup')}>
          Nueva partida
        </button>
        <button style={{ padding: '18px', fontSize: 18 }} onClick={() => setView('lobby')}>
          Jugar en línea
        </button>
        <button style={{ padding: '18px', fontSize: 18 }} onClick={newDeck}>
          Deckbuilder
        </button>
        <button style={{ padding: '18px', fontSize: 18 }} onClick={() => setView('stats')}>
          Estadísticas
        </button>
        {game && game.phase !== 'gameover' && (
          <button style={{ padding: '18px', fontSize: 18 }} onClick={() => setView('game')}>
            Continuar partida
          </button>
        )}
      </div>

      {decks.length > 0 && (
        <div className="card" style={{ marginTop: 20, width: '100%', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
          <h3>Mazos guardados</h3>
          {decks.map((d) => (
            <div className="row" key={d.name} style={{ justifyContent: 'space-between', gap: 8 }}>
              <div className="row" style={{ gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => editDeck(d.name)}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span className="muted">{d.arsenal.length}/60</span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button className="ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => editDeck(d.name)}>
                  Editar
                </button>
                <button
                  className="ghost"
                  style={{ padding: '4px 10px', fontSize: 13, color: 'var(--red-bright)' }}
                  onClick={() => {
                    if (window.confirm(`¿Borrar el mazo "${d.name}"?`)) deleteDeck(d.name)
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="muted" style={{ marginTop: 32, fontSize: 12, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center', lineHeight: 1.6 }}>
        Reglas implementadas en v1: fortitud, daño al Arsenal, reversals de mano y al voltear,
        Stun Value, Multi, cartas Chain, ACE (activación desde el Ring, modo manual), Backlash
        decks (Pre-match y Mid-match), y hasta 5 jugadores todos contra todos.
      </div>
    </div>
  )
}
