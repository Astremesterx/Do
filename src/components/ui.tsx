import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  BriefcaseBusiness,
  ChevronDown,
  Code2,
  Coffee,
  Compass,
  Music2,
  Palette,
  PartyPopper,
  Trees,
  Trophy,
  X,
  Camera,
  Gamepad2,
  BookOpen,
  Users,
} from 'lucide-react'
import type { EventGenre } from '../domain'
import { genreInfo } from '../data/cities'

export function GenreIcon({ genre, size = 16 }: { genre: EventGenre; size?: number }) {
  const Icon = {
    tech: Code2,
    music: Music2,
    nightlife: PartyPopper,
    food: Coffee,
    art: Palette,
    sports: Trophy,
    business: BriefcaseBusiness,
    outdoor: Trees,
    social: Users,
    photography: Camera,
    gaming: Gamepad2,
    books: BookOpen,
  }[genre]
  return <Icon size={size} strokeWidth={1.8} />
}
export function GenreTag({ genre }: { genre: EventGenre }) {
  const info = genreInfo(genre)
  return (
    <span className="genre-tag" style={{ color: info.color, background: `${info.color}15` }}>
      <GenreIcon genre={genre} size={12} />
      {info.short}
    </span>
  )
}
export function Avatar({
  name,
  size = 'small',
  color = 0,
}: {
  name: string
  size?: 'small' | 'large'
  color?: number
}) {
  return (
    <span className={`avatar avatar-${size} avatar-${color % 4}`} aria-label={name}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  drawer = false,
  className = '',
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  drawer?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose),
    id = useId()
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow,
      root = document.getElementById('root')
    document.body.style.overflow = 'hidden'
    if (root) root.inert = true
    const frame = requestAnimationFrame(() =>
      ref.current?.querySelector<HTMLElement>('input,button,[tabindex="0"]')?.focus(),
    )
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key === 'Tab') {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button,a[href],input,textarea,select,[tabindex="0"]',
          ) ?? [],
        ).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0)
        const first = nodes[0],
          last = nodes.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = overflow
      if (root) root.inert = false
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [])
  return createPortal(
    <div
      className={`modal-backdrop ${drawer ? 'drawer-backdrop' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''} ${drawer ? 'drawer' : ''} ${className}`}
      >
        <header className="modal-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id={id}>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}
export function Dropdown({
  label,
  children,
  align = 'left',
  className = '',
  width = 240,
  ariaLabel,
}: {
  label: ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  className?: string
  width?: number
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ top: 0, left: 0 }),
    button = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = button.current!.getBoundingClientRect()
      const top = Math.min(
        rect.bottom + 8,
        window.innerHeight - (menu.current?.offsetHeight ?? 240) - 12,
      )
      setPosition({
        top: Math.max(12, top),
        left: Math.max(
          12,
          Math.min(
            align === 'right' ? rect.right - width : rect.left,
            window.innerWidth - width - 12,
          ),
        ),
      })
    }
    update()
    window.addEventListener('resize', update)
    const click = (e: MouseEvent) => {
      if (!button.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node))
        setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('resize', update)
      document.removeEventListener('mousedown', click)
      document.removeEventListener('keydown', escape)
    }
  }, [open, align, width])
  return (
    <>
      <button
        ref={button}
        className={className || 'dropdown-trigger'}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
        <ChevronDown size={14} />
      </button>
      {open &&
        createPortal(
          <div
            className="portal-menu"
            ref={menu}
            style={{ top: position.top, left: position.left, width: maxWidth(width) }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  )
}
const maxWidth = (width: number) => `min(${width}px, calc(100vw - 24px))`
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Compass size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4500)
    return () => clearTimeout(timer)
  }, [message, onClose])
  return createPortal(
    <div role="status" className="toast">
      <span className="status-dot" />
      {message}
      <button className="icon-button" onClick={onClose} aria-label="Dismiss notification">
        <X size={15} />
      </button>
    </div>,
    document.body,
  )
}
