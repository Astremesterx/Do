import type { ImgHTMLAttributes } from 'react'
import type { EventGenre } from '../domain'
import { PHOTOS } from '../data/mockEvents'

export function EventImage({
  genre,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { genre: EventGenre }) {
  return (
    <img
      {...props}
      onError={(event) => {
        if (event.currentTarget.getAttribute('src') !== PHOTOS[genre])
          event.currentTarget.src = PHOTOS[genre]
      }}
    />
  )
}
