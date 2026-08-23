import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ALL_CARDS, getCard, getSuperstar } from '../data/cards'
import type { CardDef } from '../data/types'
import { validateBacklashDeck, validateDeck, getCopiesLimit } from '../engine/rules'
import { CardFace, CardDetailModal, CardRemoveModal } from '../components/CardView'
import { CardZoomPreview } from '../components/CardZoom'
import { CardTypeTabs, classifyCard, type CardClassFilter } from '../components/CardTypeTabs'
import { AppBanner } from '../components/Branding'

type Back = 'none' | 'Pre-match' | 'Mid-match'

type RemoveTarget = { id: string; zone: 'arsenal' | 'pre' | 'mid' }

export function DeckbuilderPage() {
  const decks = useAppStore((s) => s.decks)
  const activeDeckId = useAppStore((s) => s.activeDeckId)
  const setView = useAppStore((s) => s.setView)
  const saveDeck = useAppStore((s) => s.saveDeck)
  const deleteDeck = useAppStore((s) => s.deleteDeck)
  const setActiveDeck = useAppStore((s) => s.setActiveDeck)
  const onlineRole = useAppStore((s) => s.online.role)
  const backTo = onlineRole ? 'lobby' : 'menu'

  const [zoom, setZoom] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<RemoveTarget | null>(null)

  const active = decks.find((d) => d.name === activeDeckId)

  /** Returns a "Mazo N" name that doesn't collide with any saved deck. */
  const nextDefaultName = (): string => {
    let n = 1
    while (decks.some((d) => d.name === `Mazo ${n}`)) n++
    return `Mazo ${n}`
  }

  const [superstarId, setSuperstarId] = useState(active?.superstarId ?? '')
  const [arsenal, setArsenal] = useState<string[]>(active?.arsenal ?? [])
  const [pre, setPre] = useState<string[]>(active?.backlashPre ?? [])
  const [mid, setMid] = useState<string[]>(active?.backlashMid ?? [])
  const [deckName, setDeckName] = useState(active?.name ?? nextDefaultName())

  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<CardClassFilter>('all')
  const [starFilter, setStarFilter] = useState<'all' | 'own' | 'generic'>('all')
  const [onlyChain, setOnlyChain] = useState(false)

  const validation = useMemo(() => {
    if (!superstarId) {
      return { valid: false, issues: [{ code: 'no-superstar', message: 'Elegí tu Superstar: elegí su carta desde la pestaña Superstar de la lista.' }] }
    }
    return validateDeck(arsenal, superstarId, getCard, (id) => {
      const s = getSuperstar(id)
      return { name: s.name, alignment: s.alignment, gender: s.gender, brand: s.brand }
    })
  }, [arsenal, superstarId])
  const backlashValidation = useMemo(
    () => validateBacklashDeck(pre, mid, getCard),
    [pre, mid],
  )

  const filtered = useMemo(() => {
    return ALL_CARDS.filter((c) => {
      if (c.backlash) return false
      if (classFilter !== 'all' && classifyCard(c) !== classFilter) return false
      if (starFilter === 'own' && !(c.superstar && c.superstar.includes(superstarId))) return false
      if (starFilter === 'generic' && c.superstar && c.superstar.length > 0) return false
      if (onlyChain && !c.traits?.includes('Chain')) return false
      if (search && !`${c.name} ${c.text}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [search, classFilter, starFilter, onlyChain, superstarId])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const id of arsenal) m.set(id, (m.get(id) ?? 0) + 1)
    return m
  }, [arsenal])

  const canAddToArsenal = (c: CardDef): boolean => {
    if (c.type === 'Superstar') return false
    if (arsenal.length >= 60) return false
    const limit = getCopiesLimit(c)
    return (counts.get(c.id) ?? 0) < limit
  }

  const addToArsenal = (id: string) => {
    const c = getCard(id)
    if (c.type === 'Superstar') {
      setSuperstarId(c.superstar?.[0] ?? '')
      return
    }
    if (canAddToArsenal(c)) setArsenal((a) => [...a, id])
  }
  const removeFromArsenal = (id: string) => {
    setArsenal((a) => {
      const idx = a.indexOf(id)
      if (idx < 0) return a
      const next = [...a]
      next.splice(idx, 1)
      return next
    })
  }
  const addBacklash = (id: string, where: Back) => {
    const c = getCard(id)
    if (c.backlash !== where) return
    if (where === 'Pre-match') {
      setPre((a) => (a.length < 10 ? [...a, id] : a))
    } else {
      setMid((a) => (a.length < 10 ? [...a, id] : a))
    }
  }

  const confirmRemove = () => {
    if (!pendingRemove) return
    const { id, zone } = pendingRemove
    if (zone === 'arsenal') removeFromArsenal(id)
    else if (zone === 'pre') setPre((a) => a.filter((x) => x !== id))
    else setMid((a) => a.filter((x) => x !== id))
    setPendingRemove(null)
  }

  const save = () => {
    if (!superstarId) {
      setDetail('superstar-kurt-angle')
      return
    }
    const err = saveDeck({ name: deckName, superstarId, arsenal, backlashPre: pre, backlashMid: mid })
    if (err) {
      alert(err)
      return
    }
    if (onlineRole === 'host') useAppStore.getState().reshareDecks()
    setView(backTo)
  }

  const newDeck = () => {
    setSuperstarId('')
    setArsenal([])
    setPre([])
    setMid([])
    setDeckName(nextDefaultName())
    setActiveDeck(null)
  }

  const quickBuild = () => {
    if (!superstarId) {
      setDetail('superstar-kurt-angle')
      return
    }
    const pool = ALL_CARDS.filter(
      (c) =>
        c.type !== 'Superstar' &&
        !c.backlash &&
        (c.superstar === undefined || c.superstar.length === 0 || c.superstar.includes(superstarId)),
    )
    const score = (c: CardDef): number => {
      let n = 0
      if (c.superstar?.includes(superstarId)) n += 100
      if (c.type === 'Maneuver') n += 30
      if (c.type === 'Reversal') n += 20
      n += Math.min(40, c.fortitude * 4)
      n += Math.min(20, (c.damage ?? 0) * 2)
      return n
    }
    const ordered = pool.sort((a, b) => score(b) - score(a))
    const out: string[] = []
    for (const c of ordered) {
      if (out.length >= 60) break
      const limit = getCopiesLimit(c)
      const add = Math.min(limit, 60 - out.length)
      if (limit === Infinity) continue
      for (let k = 0; k < add; k++) out.push(c.id)
    }
    const ownBacklash = ALL_CARDS.filter((c) => c.backlash && (c.superstar?.includes(superstarId) ?? false))
    const genericBacklash = ALL_CARDS.filter((c) => c.backlash && (!c.superstar || c.superstar.length === 0))
    const pickBack = (where: 'Pre-match' | 'Mid-match'): string[] =>
      [...ownBacklash, ...genericBacklash]
        .filter((c) => c.backlash === where)
        .slice(0, 10)
        .map((c) => c.id)
    setArsenal(out)
    setPre(pickBack('Pre-match'))
    setMid(pickBack('Mid-match'))
  }

  const superstar = superstarId ? getSuperstar(superstarId) : null

  return (
    <div className="page">
      <AppBanner subtitle="Deckbuilder" />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="spacer" />
        <button className="ghost" onClick={() => setView(backTo)}>Volver</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
        <div>
          <div className="filters">
            <CardTypeTabs value={classFilter} onChange={setClassFilter} />
            <input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={starFilter} onChange={(e) => setStarFilter(e.target.value as 'all' | 'own' | 'generic')}>
              <option value="all">Todas las firmas</option>
              <option value="own">Mi Superstar</option>
              <option value="generic">Genéricas</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={onlyChain} onChange={(e) => setOnlyChain(e.target.checked)} />
              Chain
            </label>
          </div>

          <div className="cardlist" style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filtered.map((c) => {
              const n = counts.get(c.id) ?? 0
              const limit = getCopiesLimit(c)
              const atLimit = !canAddToArsenal(c)
              const isMySuperstar = c.type === 'Superstar' && c.superstar?.[0] === superstarId
              const limitLabel = limit === Infinity ? '∞' : String(limit)
              return (
                <div key={c.id} style={{ cursor: atLimit ? 'not-allowed' : 'pointer', position: 'relative' }}
                  onMouseEnter={() => setZoom(c.id)}
                  onMouseLeave={() => setZoom(null)}
                >
                  <CardFace
                    id={c.id}
                    size="sm"
                    selected={isMySuperstar}
                    onClick={() => addToArsenal(c.id)}
                  />
                  <div
                    className="stat-chip mono"
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      background: n >= limit ? 'var(--red-bright)' : 'var(--bg-3)',
                    }}
                  >
                    {n}/{limitLabel}
                  </div>
                  <button
                    className="ghost"
                    title="Ver carta ampliada"
                    style={{ position: 'absolute', bottom: 6, right: 6, padding: '2px 6px', fontSize: 12 }}
                    onClick={() => setDetail(c.id)}
                  >
                    🔍
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 14 }}>
          {superstar ? (
            <>
              <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <CardFace id={`superstar-${superstar.id}`} size="sm" onClick={() => setDetail(`superstar-${superstar.id}`)} />
                <div>
                  <h3 style={{ margin: 0 }}>{superstar.name}</h3>
                  <div className="muted">
                    Mano {superstar.handSize} · Valor {superstar.value} · {superstar.alignment === 'Both' ? 'Face/Heel' : superstar.alignment}
                  </div>
                  <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>{superstar.abilityText}</p>
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <label style={{ flex: 1 }}>Nombre del mazo</label>
                <input value={deckName} onChange={(e) => setDeckName(e.target.value)} />
              </div>
            </>
          ) : (
            <p className="muted">
              Elegí tu Superstar: andá a la pestaña <b>Superestrella</b> de la lista y tocá su carta.
            </p>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <span className={`deckcount ${validation.valid ? 'ok' : 'bad'}`}>{arsenal.length}/60</span>
            {backlashValidation.valid ? <span className="deckcount ok">{pre.length + mid.length}/20 Backlash</span> : <span className="deckcount bad">{pre.length + mid.length}/20 Backlash</span>}
          </div>

          {!validation.valid && (
            <div className="card" style={{ background: '#2a1210', borderColor: 'var(--red)', margin: '8px 0' }}>
              {validation.issues.slice(0, 4).map((i) => (
                <div key={i.code} style={{ fontSize: 12, color: '#f0a9a1' }}>• {i.message}</div>
              ))}
              {validation.issues.length > 4 && <div style={{ fontSize: 12, color: '#f0a9a1' }}>…y {validation.issues.length - 4} más</div>}
            </div>
          )}
          {!backlashValidation.valid && backlashValidation.issues.length > 0 && (
            <div className="card" style={{ background: '#2a1210', borderColor: 'var(--red)', margin: '8px 0' }}>
              {backlashValidation.issues.map((i) => (
                <div key={i.code} style={{ fontSize: 12, color: '#f0a9a1' }}>• {i.message}</div>
              ))}
            </div>
          )}

          <div className="big-label">Arsenal ({arsenal.length})</div>
          <div className="chiprow">
            {arsenal.map((id, i) => (
              <div key={`${id}-${i}`}>
                <CardFace
                  id={id}
                  size="xs"
                  onMouseEnter={() => setZoom(id)}
                  onMouseLeave={() => setZoom(null)}
                  onClick={() => setPendingRemove({ id, zone: 'arsenal' })}
                />
              </div>
            ))}
            {arsenal.length === 0 && <span className="muted">Vacío — agrega cartas del catálogo.</span>}
          </div>

          <div className="big-label">Pre-match ({pre.length}/10)</div>
          <div className="chiprow">
            {pre.map((id) => (
              <div key={id}>
                <CardFace
                  id={id}
                  size="xs"
                  onMouseEnter={() => setZoom(id)}
                  onMouseLeave={() => setZoom(null)}
                  onClick={() => setPendingRemove({ id, zone: 'pre' })}
                />
              </div>
            ))}
            {pre.length === 0 && <span className="muted">Vacío.</span>}
          </div>
          <div className="big-label">Mid-match ({mid.length}/10)</div>
          <div className="chiprow">
            {mid.map((id) => (
              <div key={id}>
                <CardFace
                  id={id}
                  size="xs"
                  onMouseEnter={() => setZoom(id)}
                  onMouseLeave={() => setZoom(null)}
                  onClick={() => setPendingRemove({ id, zone: 'mid' })}
                />
              </div>
            ))}
            {mid.length === 0 && <span className="muted">Vacío.</span>}
          </div>
          <div className="big-label">Añadir Backlash</div>
          <div className="chiprow">
            {ALL_CARDS.filter((c) => c.backlash).map((c) => (
              <div key={c.id}>
                <CardFace
                  id={c.id}
                  size="xs"
                  onMouseEnter={() => setZoom(c.id)}
                  onMouseLeave={() => setZoom(null)}
                  onClick={() => addBacklash(c.id, c.backlash as Back)}
                />
              </div>
            ))}
          </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px 14px', background: 'var(--bg-2)' }}>
            <div className="row">
              <button className="primary" style={{ flex: 1 }} onClick={save}>Guardar mazo</button>
              {active && (
                <button className="danger" onClick={() => { deleteDeck(active.name); setActiveDeck(null); setView(backTo) }}>
                  Borrar
                </button>
              )}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="ghost" style={{ flex: 1 }} onClick={newDeck}>Nuevo mazo</button>
              <button className="ghost" style={{ flex: 1 }} onClick={quickBuild}>Mazo de ejemplo</button>
              <button className="ghost" style={{ flex: 1 }} onClick={() => setArsenal([])}>Limpiar</button>
            </div>
            <div className="muted" style={{ marginTop: 6, fontSize: 11, textAlign: 'center' }}>
              Mazos guardados: {decks.length}/10
            </div>
          </div>
        </div>
      </div>

      <CardDetailModal id={detail} onClose={() => setDetail(null)} />
      <CardRemoveModal id={pendingRemove?.id ?? null} onConfirm={confirmRemove} onCancel={() => setPendingRemove(null)} />
      <CardZoomPreview id={zoom} />
    </div>
  )
}
