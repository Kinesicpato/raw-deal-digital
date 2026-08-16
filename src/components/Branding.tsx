/** Original stylized emblems — no trademarked assets. */
export function GoldenGlobe() {
  return (
    <svg viewBox="0 0 44 44" className="banner-emblem" aria-hidden>
      <path d="M22 4 L27 14 L38 15 L30 22 L33 33 L22 27 L11 33 L14 22 L6 15 L17 14 Z" fill="#d8a92f" stroke="#6b4e0f" strokeWidth="1.4" />
      <circle cx="22" cy="20" r="4.5" fill="#221a05" />
    </svg>
  )
}

/**
 * App banner: fake wrestling-show masthead so the interface feels like a
 * broadcast instead of a form. Replace the emblem with your own asset if you
 * own the rights to it.
 */
export function AppBanner({
  title = 'RAW DEAL',
  subtitle = 'Juego de cartas digital',
  right,
}: {
  title?: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="banner">
      <div className="banner-logo">{title}</div>
      <div className="banner-tag">
        <span className="banner-sub">{subtitle}</span>
      </div>
      <div className="banner-badge">
        {right}
        <GoldenGlobe />
      </div>
    </div>
  )
}