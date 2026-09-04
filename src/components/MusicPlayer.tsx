import { useState, useRef } from 'react'

const WWE_MIXES = [
  { id: 'PkzTIL4f8ng', name: 'WWE Themes Mix' },
  { id: 'U1qjOGVz0QA', name: 'WWE Entrance Themes' },
  { id: '4f_nOFjJFkY', name: 'WWE Classic Themes' },
]

function ytMsg(func: string) {
  return JSON.stringify({ event: 'command', func, args: [] })
}

export function MusicPlayer() {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [playing, setPlaying] = useState(false)
  const [mixIdx, setMixIdx] = useState(0)
  const [volume, setVolume] = useState(30)
  const [minimized, setMinimized] = useState(false)

  const send = (func: string) => {
    const f = frameRef.current
    if (!f) return
    f.contentWindow?.postMessage(ytMsg(func), '*')
  }

  const togglePlay = () => {
    if (playing) { send('pauseVideo'); setPlaying(false) }
    else { send('playVideo'); setPlaying(true) }
  }

  const changeMix = () => {
    const next = (mixIdx + 1) % WWE_MIXES.length
    setMixIdx(next)
    const f = frameRef.current
    if (f) {
      f.src = `https://www.youtube.com/embed/${WWE_MIXES[next]!.id}?enablejsapi=1&origin=${window.location.origin}&autoplay=1&mute=0`
      setPlaying(true)
    }
  }

  const changeVolume = (val: number) => {
    setVolume(val)
    const f = frameRef.current
    if (f) {
      f.contentWindow?.postMessage(JSON.stringify({
        event: 'command',
        func: 'setVolume',
        args: [val],
      }), '*')
    }
  }

  const mix = WWE_MIXES[mixIdx]!

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
        id="wwe-yt-player"
        className="mp-yt-frame"
        src={`https://www.youtube.com/embed/${WWE_MIXES[0]!.id}?enablejsapi=1&origin=${window.location.origin}&mute=0`}
        allow="autoplay; encrypted-media"
        title="WWE Music"
      />
      <button className="mp-btn" onClick={togglePlay} title={playing ? 'Pausar' : 'Reproducir'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button className="mp-btn" onClick={changeMix} title="Siguiente mix">
        ⏭
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => changeVolume(Number(e.target.value))}
        className="mp-volume"
      />
      <span className="mp-label">{mix.name}</span>
      <button className="mp-btn mp-minimize-btn" onClick={() => setMinimized(true)} title="Ocultar">
        ✕
      </button>
    </div>
  )
}
