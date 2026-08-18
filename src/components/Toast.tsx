import { useEffect } from 'react'

/** Error/message toast that auto-dismisses after a few seconds (or on click). */
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [message, onClose])
  return (
    <div className="toast" onClick={onClose}>
      {message}
    </div>
  )
}