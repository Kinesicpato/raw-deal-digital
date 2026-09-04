import { useState, useRef, useEffect } from 'react'

const STATIONS = [
  { name: '80s Metal FM', url: 'http://bigrradio.cdnstream1.com/5186_128' },
  { name: 'Beyond Ringside', url: 'https://streamer.radio.co/s2e4a3222c/listen' },
  { name: 'Rock FM', url: 'http://nashe1.hostingradio.ru/rock-128.mp3' },
]

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [stationIdx, setStationIdx] = useState(0)
  const [volume, setVolume] = useState(0.3)

  useEffect(() => {
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.volume = volume
    audioRef.current = audio
    return () => { audio.pause(); audio.src = '' }
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const loadStation = (idx: number) => {
    const audio = audioRef.current
    if (!audio) return
    const station = STATIONS[idx]
    if (!station) return
    audio.src = station.url
    audio.load()
    setStationIdx(idx)
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      if (!audio.src || audio.src === window.location.href) loadStation(stationIdx)
      audio.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const nextStation = () => {
    const next = (stationIdx + 1) % STATIONS.length
    loadStation(next)
    if (playing) audioRef.current?.play().then(() => setPlaying(true)).catch(() => {})
  }

  return (
    <div className="music-player">
      <button className="mp-btn" onClick={togglePlay} title={playing ? 'Pausar musica' : 'Reproducir musica'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button className="mp-btn" onClick={nextStation} title="Cambiar estacion">
        ⏭
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        className="mp-volume"
        title={`Volumen: ${Math.round(volume * 100)}%`}
      />
      <span className="mp-label">{STATIONS[stationIdx]?.name ?? ''}</span>
    </div>
  )
}
