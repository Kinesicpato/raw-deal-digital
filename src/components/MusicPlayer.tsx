import { useState, useRef, useEffect } from 'react'

const STATIONS = [
  { name: 'Metalcore laut.fm', url: 'https://metalcore.stream.laut.fm/metalcore' },
]

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [idx, setIdx] = useState(0)
  const [volume, setVolume] = useState(30)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    const a = new Audio()
    a.crossOrigin = 'anonymous'
    a.volume = 0.3
    audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [volume])

  const load = (i: number) => {
    const a = audioRef.current
    if (!a) return
    const s = STATIONS[i]
    if (!s) return
    a.src = s.url
    a.load()
    setIdx(i)
  }

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else {
      if (!a.src || a.src === location.href) load(idx)
      a.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const next = () => {
    const i = (idx + 1) % STATIONS.length
    load(i)
    const a = audioRef.current
    if (a) a.play().then(() => setPlaying(true)).catch(() => {})
  }

  const s = STATIONS[idx]!

  if (minimized) {
    return (
      <button className="mp-minimized" onClick={() => setMinimized(false)} title="Abrir musica">
        🎵
      </button>
    )
  }

  return (
    <div className="music-player">
      <button className="mp-btn" onClick={togglePlay} title={playing ? 'Pausar' : 'Reproducir'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button className="mp-btn" onClick={next} title="Cambiar estacion">
        ⏭
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="mp-volume"
      />
      <span className="mp-label">{s.name}</span>
      <button className="mp-btn mp-minimize-btn" onClick={() => setMinimized(true)} title="Ocultar">
        ✕
      </button>
    </div>
  )
}
