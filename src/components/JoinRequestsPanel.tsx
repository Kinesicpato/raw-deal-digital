import { useAppStore } from '../store/useAppStore'

/**
 * Host-side list of clients asking to enter the room (full lobby or a match
 * already in progress). Used both in the lobby card and as a floating panel
 * over the game board.
 */
export function JoinRequestsPanel({ floating = false }: { floating?: boolean }) {
  const joinRequests = useAppStore((s) => s.online.joinRequests)
  const approveJoin = useAppStore((s) => s.approveJoin)
  const rejectJoin = useAppStore((s) => s.rejectJoin)

  if (joinRequests.length === 0) return null

  return (
    <div
      className="card"
      style={
        floating
          ? { position: 'fixed', right: 16, bottom: 16, zIndex: 60, width: 300, boxShadow: '0 6px 24px rgba(0,0,0,0.45)' }
          : { marginTop: 16 }
      }
    >
      <div className="big-label">🔔 Quieren unirse ({joinRequests.length})</div>
      {joinRequests.map((r) => (
        <div key={r.senderId} className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.name || 'Sin nombre'}
          </span>
          <button className="primary" onClick={() => approveJoin(r.senderId)}>
            Aprobar
          </button>
          <button className="ghost" onClick={() => rejectJoin(r.senderId)}>
            Rechazar
          </button>
        </div>
      ))}
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Si la partida ya empezó, quien ingresa lo hace como espectador.
      </div>
    </div>
  )
}
