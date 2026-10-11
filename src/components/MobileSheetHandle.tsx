import { useRef } from 'react'
export type SheetPosition = 'peek' | 'half' | 'full'
export function MobileSheetHandle({
  position,
  onChange,
}: {
  position: SheetPosition
  onChange: (position: SheetPosition) => void
}) {
  const startY = useRef(0),
    dragged = useRef(false)
  const positions: SheetPosition[] = ['peek', 'half', 'full']
  return (
    <button
      className="mobile-sheet-handle"
      aria-label={position === 'full' ? 'Collapse event sheet' : 'Expand event sheet'}
      onPointerDown={(e) => {
        startY.current = e.clientY
        dragged.current = false
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerUp={(e) => {
        const delta = startY.current - e.clientY
        if (Math.abs(delta) > 25) {
          dragged.current = true
          const index = positions.indexOf(position)
          onChange(positions[Math.max(0, Math.min(2, index + (delta > 0 ? 1 : -1)))])
        }
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onClick={() => {
        if (!dragged.current) onChange(positions[(positions.indexOf(position) + 1) % 3])
        dragged.current = false
      }}
    >
      <span />
    </button>
  )
}
