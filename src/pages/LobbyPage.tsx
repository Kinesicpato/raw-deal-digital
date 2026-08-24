import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SUPERSTARS } from '../data/cards'
import { buildDefaultDeck } from '../data/defaultDeck'
import { AppBanner } from '../components/Branding'
import { CardFace } from '../components/CardView'
import { Toast } from '../components/Toast'

export function LobbyPage() {
  const store = useAppStore.getState()
  const online = useAppStore((s) => s.online)
  const ownDecks = useAppStore((s) => s.decks)
  const lastError = useAppStore((s) => s.lastError)
  const clearError = useAppStore((s) => s.clearError)

  const [name, setName] = useState('')
  const [seats, setSeats] = useState(2)
  const [code, setCode] = useState('')

  if (!online.role) {
    return (
      <div className="page">
        <AppBanner subtitle="Partida en línea" />
        <div className="card" style={{ maxWidth: 460, margin: '24px auto' }}>
          <h3>Crear una sala</h3>
          <label>Tu nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Dwayne" />
          <label style={{ marginTop: 8 }}>Jugadores</label>
          <select value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} jugadores</option>
            ))}
          </select>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {seats} jugadores en total (vos + {seats - 1} más)
          </div>
          <div className="row" style={{ marginTop: 14, gap: 8, justifyContent: 'flex-end' }}>
            <button className="ghost" onClick={() => store.setView('menu')}>Volver</button>
            <button
              className="primary"
              disabled={!name.trim()}
              onClick={() => store.createRoom(name.trim(), seats)}
            >
              Crear sala
            </button>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
          <h3>Unirse a una sala</h3>
          <label>Tu nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Stone Cold" />
          <label style={{ marginTop: 8 }}>Código de la sala</label>
          <input
            value={code}
            maxLength={5}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCDE"
            style={{ textTransform: 'uppercase' }}
          />
          <div className="row" style={{ marginTop: 14, gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="primary"
              disabled={!name.trim() || code.trim().length < 3}
              onClick={() => store.joinRoom(code.trim(), name.trim())}
            >
              Unirse
            </button>
          </div>
        </div>

        {lastError && (
          <Toast message={lastError} onClose={clearError} />
        )}
      </div>
    )
  }

  const myIdx = online.myIdx
  const deckList = online.sharedDecks ?? []
  const ownDeckNames = new Set(ownDecks.map((d) => d.name))
  const hostDecks = deckList.filter((d) => !ownDeckNames.has(d.name))
  const selectedDeck = myIdx !== null ? online.roster[myIdx]?.deck : undefined
  const selectedDeckValue = selectedDeck?.name
    ? ownDeckNames.has(selectedDeck.name)
      ? `own:${selectedDeck.name}`
      : `host:${selectedDeck.name}`
    : 'auto'
  const connectedPlayers = online.roster.filter((r) => r.connected && !r.spectator && r.superstarId && r.deck)
  const connectedNonSpectators = online.roster.filter((r) => r.connected && !r.spectator)
  const allReady = connectedNonSpectators.every((r) => r.superstarId && r.deck)
  const canStart =
    online.role === 'host' &&
    connectedPlayers.length >= 2 &&
    allReady

  return (
    <div className="page">
      <AppBanner
        subtitle={online.role === 'host' ? 'Tu sala · esperá a los rivales' : 'Sala del anfitrión'}
        right={
          <>
            <span className="stat-chip mono">Código: {online.code}</span>
            <button className="ghost" onClick={() => store.leaveOnline()}>Salir</button>
          </>
        }
      />

      <p className="muted" style={{ textAlign: 'center', marginTop: 4 }}>
        {online.role === 'host'
          ? `Compartí el código ${online.code} con tus rivales. Vos sos el jugador ${(myIdx ?? 0) + 1}.`
          : myIdx === null
            ? online.connected
              ? 'Conectado a la sala. Esperando al anfitrión…'
              : 'Conectando con la sala…'
            : `Te estás uniendo como jugador ${myIdx + 1}. El anfitrión comienza la partida.`}
      </p>

      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <h3>Jugadores ({online.roster.filter((r) => r.connected).length}/{online.roster.length})</h3>
        {online.roster.map((r) => {
          const isMe = myIdx === r.idx
          return (
            <div key={r.idx} className="row" style={{ gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <span className="stat-chip">{r.idx + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {r.name || (r.connected ? 'Conectado' : 'Esperando…')}
                  {isMe ? ' (vos)' : ''}
                </div>
              </div>
              {r.superstarId ? (
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <CardFace id={`superstar-${r.superstarId}`} size="xs" />
                  <span className="muted" style={{ fontSize: 12 }}>
                    {SUPERSTARS.find((s) => s.id === r.superstarId)?.name}
                  </span>
                </div>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>Sin Superestrella</span>
              )}
            </div>
          )
        })}

        {myIdx !== null && online.isSpectator === undefined && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div className="big-label">¿Cómo querés entrar?</div>
            <p className="muted" style={{ marginBottom: 12 }}>
              Elegí si querés jugar o simplemente observar la partida.
            </p>
            <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
              <button className="primary" style={{ padding: '10px 24px' }} onClick={() => store.setOnlineRole('player')}>
                Jugador
              </button>
              <button className="ghost" style={{ padding: '10px 24px' }} onClick={() => store.setOnlineRole('spectator')}>
                Espectador
              </button>
            </div>
          </div>
        )}

        {myIdx !== null && online.isSpectator === true && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <p className="muted">Estás observando la partida. Esperá a que el anfitrión comience.</p>
          </div>
        )}

        {myIdx !== null && online.isSpectator === false && (
          <div style={{ marginTop: 12 }}>
            <div className="big-label">Elegí tu Superestrella</div>
            <div className="chiprow" style={{ flexWrap: 'wrap' }}>
              {SUPERSTARS.map((s) => {
                const chosen = online.roster[myIdx]?.superstarId === s.id
                return (
                  <div key={s.id} style={{ cursor: 'pointer' }} onClick={() => store.onlinePickSuperstar(s.id)}>
                    <CardFace id={`superstar-${s.id}`} size="sm" selected={chosen} />
                  </div>
                )
              })}
            </div>

            <div className="row" style={{ alignItems: 'center', gap: 12, marginTop: 16 }}>
              <div style={{ flex: 1 }}>
                <div className="big-label">Elegí tu mazo</div>
                <select
                  style={{ width: '100%' }}
                  value={selectedDeckValue}
                  onChange={(e) => {
                    const v = e.target.value
                    const ss = online.roster[myIdx]?.superstarId
                    if (!ss) return
                    if (v === 'auto') {
                      const d = buildDefaultDeck(ss)
                      store.onlinePickSuperstar(ss, { name: null, arsenal: d.arsenal, backlashPre: d.pre, backlashMid: d.mid })
                      return
                    }
                    if (v.startsWith('own:')) {
                      const deck = ownDecks.find((d) => d.name === v.slice(4))
                      if (deck) {
                        store.onlinePickSuperstar(ss, {
                          name: deck.name,
                          arsenal: [...deck.arsenal],
                          backlashPre: [...deck.backlashPre],
                          backlashMid: [...deck.backlashMid],
                        })
                      }
                      return
                    }
                    const deck = deckList.find((d) => d.name === v.replace(/^host:/, ''))
                    if (deck) {
                      store.onlinePickSuperstar(ss, {
                        name: deck.name,
                        arsenal: [...deck.arsenal],
                        backlashPre: [...deck.backlashPre],
                        backlashMid: [...deck.backlashMid],
                      })
                    }
                  }}
                >
                  <option value="auto">Mazo automático</option>
                  {ownDecks.length > 0 && (
                    <optgroup label={`Tus mazos (${ownDecks.length})`}>
                      {ownDecks.map((d) => (
                        <option key={`own:${d.name}`} value={`own:${d.name}`}>{d.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {hostDecks.length > 0 && (
                    <optgroup label="Mazos del anfitrión">
                      {hostDecks.map((d) => (
                        <option key={`host:${d.name}`} value={`host:${d.name}`}>{d.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {selectedDeck?.name
                    ? `Usarás tu mazo "${selectedDeck.name}".`
                    : 'Usarás el mazo automático de tu Superestrella.'}
                </div>
                <div className="row" style={{ marginTop: 8, gap: 8 }}>
                  <button
                    className="ghost"
                    onClick={() => {
                      store.setActiveDeck(null)
                      store.setView('deck')
                    }}
                  >
                    Diseñar mazo…
                  </button>
                  <button
                    className="ghost"
                    disabled={!selectedDeck?.name || ownDeckNames.has(selectedDeck.name)}
                    onClick={() => {
                      const d = online.roster[myIdx]?.deck
                      const ss = online.roster[myIdx]?.superstarId
                      if (!d?.name || !ss) return
                      const err = store.saveDeck({
                        name: d.name,
                        superstarId: ss,
                        arsenal: [...d.arsenal],
                        backlashPre: [...d.backlashPre],
                        backlashMid: [...d.backlashMid],
                      })
                      if (err) store.setLastError(err)
                    }}
                  >
                    Guardar este mazo
                  </button>
                </div>
              </div>
              <div style={{ width: 110 }}>
                <div className="big-label">Cartas de mano</div>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={online.roster[myIdx]?.handSize ?? 7}
                  onChange={(e) => store.onlineSetHandSize(Number(e.target.value))}
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Cuántas cartas recibís al empezar.
                </div>
              </div>
            </div>
          </div>
        )}

        {online.role === 'host' && (
          <div className="row" style={{ marginTop: 16, gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="primary"
              style={{ fontSize: 16, padding: '10px 22px' }}
              disabled={!canStart}
              onClick={() => store.startOnlineGame()}
            >
              Comenzar partida
            </button>
            {!canStart && (
              <span className="muted">
                {connectedPlayers.length < 2
                  ? `Se necesitan al menos 2 jugadores conectados. Compartí el código ${online.code} para que ingresen.`
                  : 'Todos los conectados deben elegir Superestrella y mazo.'}
              </span>
            )}
          </div>
        )}
      </div>

      {lastError && (
        <Toast message={lastError} onClose={clearError} />
      )}
    </div>
  )
}