import type { ManualZone } from '../engine/game'

export interface DragInfo {
  cardId: string
  from: ManualZone
  playerIdx: number
}

let current: DragInfo | null = null

export function setDrag(info: DragInfo | null) {
  current = info
}

export function getDrag(): DragInfo | null {
  return current
}
