import type { ArsenalPosition } from '../engine/game'

/**
 * Overlay that asks the user where to place cards going into the Arsenal:
 * beginning, end, or shuffled randomly.
 */
export function ArsenalPositionPicker({
  cardCount,
  onPick,
  onCancel,
}: {
  cardCount: number
  onPick: (position: ArsenalPosition) => void
  onCancel: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340 }}>
        <h3 style={{ margin: '0 0 8px' }}>
          {cardCount === 1 ? 'Enviar carta al Arsenal' : `Enviar ${cardCount} cartas al Arsenal`}
        </h3>
        <p className="muted" style={{ margin: '0 0 12px' }}>
          Elegí dónde colocar:
        </p>
        <div className="row" style={{ flexDirection: 'column', gap: 8 }}>
          <button className="primary" onClick={() => onPick('start')}>
            Inicio de Arsenal
          </button>
          <button className="primary" onClick={() => onPick('end')}>
            Final de Arsenal
          </button>
          <button className="primary" onClick={() => onPick('shuffle')}>
            Revolver
          </button>
          <button className="ghost" onClick={onCancel} style={{ marginTop: 4 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
