import { useState, useRef } from 'react'

const WWE_PLAYLISTS = [
  { id: '1815194939', name: 'WWE 2K26 Themes' },
  { id: '1865819510', name: 'WWE Theme Songs 2026' },
  { id: '1758714783', name: 'WWE Entrance Songs' },
]

export function MusicPlayer() {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [playing, setPlaying] = useState(false)
  const [idx, setIdx] = useState(0)
  const [minimized, setMinimized] = useState(false)

  const send = (action: string) => {
    const f = frameRef.current
    if (!f) return
    f.contentWindow?.postMessage(JSON.stringify({ method: action }), '*')
  }

  const togglePlay = () => {
    if (playing) { send('pause'); setPlaying(false) }
    else { send('play'); setPlaying(true) }
  }

  const changeMix = () => {
    const next = (idx + 1) % WWE_PLAYLISTS.length
    setIdx(next)
    setPlaying(true)
  }

  const pl = WWE_PLAYLISTS[idx]!

  if (minimized) {
    return (
      <button className="mp-minimized" onClick={() => setMinimized(false)} title="Abrir musica">
        🎵
      </button>
    )
  }

  return (
    <div className="music-player">
      <iframe
        ref={frameRef}
        key={pl.id}
        className="mp-yt-frame"
        src={`https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/${pl.id}&auto_play=true&show_artwork=false&show_comments=false&show_user=false&hide_related=true&sharing=false&download=false&buying=false`}
        allow="autoplay"
        title="WWE Music"
      />
      <button className="mp-btn" onClick={togglePlay} title={playing ? 'Pausar' : 'Reproducir'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button className="mp-btn" onClick={changeMix} title="Siguiente playlist">
        ⏭
      </button>
      <span className="mp-label">{pl.name}</span>
      <button className="mp-btn mp-minimize-btn" onClick={() => setMinimized(true)} title="Ocultar">
        ✕
      </button>
    </div>
  )
}
