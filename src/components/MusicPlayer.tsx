import { useState } from 'react'

export function MusicPlayer() {
  const [playing, setPlaying] = useState(false)
  const [queryIdx, setQueryIdx] = useState(0)
  const [minimized, setMinimized] = useState(false)

  const QUERIES = [
    { q: 'WWE entrance theme', name: 'WWE Themes' },
    { q: 'wrestling entrance music', name: 'Wrestling Music' },
    { q: 'WWE superstar theme song', name: 'Superstar Themes' },
  ]

  const cur = QUERIES[queryIdx]!

  const togglePlay = () => {
    const f = document.getElementById('deezer-frame') as HTMLIFrameElement | null
    if (!f) return
    if (playing) { f.contentWindow?.postMessage('pause', '*'); setPlaying(false) }
    else { f.contentWindow?.postMessage('play', '*'); setPlaying(true) }
  }

  const changeMix = () => {
    setQueryIdx((queryIdx + 1) % QUERIES.length)
    setPlaying(true)
  }

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
        id="deezer-frame"
        key={cur.q}
        className="mp-yt-frame"
        src={`https://www.deezer.com/plugins/player?autoplay=true&playlist=true&width=70&height=70&layout=dark&size=small&page=1&module=deezer&label=playlist&color=ff5e00&type=playlist&q=${encodeURIComponent(cur.q)}`}
        allow="autoplay; encrypted-media"
        title="WWE Music"
      />
      <button className="mp-btn" onClick={togglePlay} title={playing ? 'Pausar' : 'Reproducir'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button className="mp-btn" onClick={changeMix} title="Siguiente lista">
        ⏭
      </button>
      <span className="mp-label">{cur.name}</span>
      <button className="mp-btn mp-minimize-btn" onClick={() => setMinimized(true)} title="Ocultar">
        ✕
      </button>
    </div>
  )
}
