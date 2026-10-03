import { describe, it, expect } from 'vitest'
import { newGame, type NewGameConfig } from '../src/engine/game'
import { encodeBeltName, decodeBeltName } from '../src/online/stats'

function makeGame(cfg: Partial<NewGameConfig> = {}) {
  return newGame({
    players: [
      { name: 'A', superstarId: 'kurt-angle', arsenal: [], backlashPre: [], backlashMid: [] },
      { name: 'B', superstarId: 'mankind', arsenal: [], backlashPre: [], backlashMid: [] },
    ],
    ...cfg,
  })
}

describe('belt metadata', () => {
  it('leaves the belt vacant by default', () => {
    const g = makeGame()
    expect(g.beltId).toBeNull()
    expect(g.beltChampionId).toBeNull()
    expect(g.beltDefending).toBeNull()
  })

  it('carries the belt, its champion and the defense answer into the game', () => {
    const g = makeGame({ beltId: 'wwe-world', beltChampionId: 'kurt-angle', beltDefending: true })
    expect(g.beltId).toBe('wwe-world')
    expect(g.beltChampionId).toBe('kurt-angle')
    expect(g.beltDefending).toBe(true)
  })

  it('keeps a belt without a champion as an open title', () => {
    const g = makeGame({ beltId: 'wwe-world', beltDefending: false })
    expect(g.beltChampionId).toBeNull()
    expect(g.beltDefending).toBe(false)
  })
})

describe('belt name encoding (belt_name doubles as the defense flag)', () => {
  it('round-trips a defended belt', () => {
    const raw = encodeBeltName('Campeonato Mundial', true)
    expect(decodeBeltName(raw)).toEqual({ name: 'Campeonato Mundial', defending: true })
  })

  it('round-trips a belt that was not defended', () => {
    const raw = encodeBeltName('Campeonato Mundial', false)
    expect(raw).toBe('Campeonato Mundial')
    expect(decodeBeltName(raw)).toEqual({ name: 'Campeonato Mundial', defending: false })
  })

  it('keeps legacy rows (no flag stored) working', () => {
    expect(decodeBeltName('Campeonato Intercontinental')).toEqual({
      name: 'Campeonato Intercontinental',
      defending: false,
    })
    expect(decodeBeltName(null)).toEqual({ name: null, defending: false })
  })
})
