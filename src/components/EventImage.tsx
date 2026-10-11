import type { ImgHTMLAttributes } from 'react'
import type { EventGenre } from '../domain'
import { PHOTOS } from '../data/mockEvents'

export function EventImage({
  genre,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { genre: EventGenre }) {
  const fallback = PHOTOS[genre] || '/images/tech.jpg'
  return (
    <img
      {...props}
      onError={(event) => {
        if (event.currentTarget.getAttribute('src') !== fallback) {
          event.currentTarget.src = fallback
        }
      }}
    />
  )
}
