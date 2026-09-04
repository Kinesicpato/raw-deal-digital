import { useState, useRef, useEffect, useCallback } from 'react'

const WWE_MIXES = [
  { id: 'PkzTIL4f8ng', name: 'WWE Themes Mix' },
  { id: 'U1qjOGVz0QA', name: 'WWE Entrance Themes' },
  { id: '4f_nOFjJFkY', name: 'WWE Classic Themes' },
]

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  unMute: () => void
  isMuted: () => boolean
  setVolume: (v: number) => void
  getVolume: () => number
  loadVideoById: (id: string) => void
  destroy: () => void
}

export function MusicPlayer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [mixIdx, setMixIdx] = useState(0)
  const [volume, setVolume] = useState(30)
  const [minimized, setMinimized] = useState(false)
  const [ready, setReady] = useState(false)

  const initPlayer = useCallback(() => {
    if (playerRef.current || !containerRef.current) return
    const player = new window.YT!.Player(containerRef.current, {
      videoId: WWE_MIXES[0]!.id,
      playerVars: {
        autoplay: 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
      },
      events: {
        onReady: () => {
          playerRef.current = player
          player.unMute()
          player.setVolume(30)
          setReady(true)
        },
      },
    })
  }, [])

  useEffect(() => {
    if (window.YT?.Player) {
      initPlayer()
      return
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = initPlayer
    return () => { window.onYouTubeIframeAPIReady = undefined }
  }, [initPlayer])

  useEffect(() => {
    return () => { playerRef.current?.destroy() }
  }, [])

  const togglePlay = () => {
    const p = playerRef.current
    if (!p) return
    if (playing) {
      p.pauseVideo()
      setPlaying(false)
    } else {
      if (p.isMuted()) p.unMute()
      p.setVolume(volume)
      p.playVideo()
      setPlaying(true)
    }
  }

  const changeMix = () => {
    const next = (mixIdx + 1) % WWE_MIXES.length
    setMixIdx(next)
    const p = playerRef.current
    if (p) {
      p.loadVideoById(WWE_MIXES[next]!.id)
      if (p.isMuted()) p.unMute()
      p.setVolume(volume)
      setPlaying(true)
    }
  }

  const changeVolume = (val: number) => {
    setVolume(val)
    const p = playerRef.current
    if (p) {
      if (p.isMuted()) p.unMute()
      p.setVolume(val)
    }
  }

  const mix = WWE_MIXES[mixIdx]!

  if (minimized) {
    return (
      <button className="mp-minimized" onClick={() => setMinimized(false)} title="Abrir reproductor de musica">
        🎵
      </button>
    )
  }

  return (
    <div className="music-player">
      <div ref={containerRef} className="mp-yt-container" />
      <button className="mp-btn" onClick={togglePlay} disabled={!ready} title={playing ? 'Pausar' : 'Reproducir'}>
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
