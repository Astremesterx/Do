import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Mobile Map Layout & Toggle Positioning', () => {
  const stylesPath = path.resolve(__dirname, '../styles.css')
  const css = fs.readFileSync(stylesPath, 'utf8')

  it('positions .mobile-show-map .mobile-view-toggle at top-right instead of center', () => {
    // Must contain top-right positioning for map view
    expect(css).toMatch(/\.mobile-show-map\s+\.mobile-view-toggle\s*\{[^}]*top:\s*16px;[^}]*right:\s*15px;/)
    expect(css).toMatch(/\.mobile-show-map\s+\.mobile-view-toggle\s*\{[^}]*left:\s*auto;/)
    expect(css).toMatch(/\.mobile-show-map\s+\.mobile-view-toggle\s*\{[^}]*transform:\s*none;/)
  })

  it('does not place mobile-view-toggle at map center coordinates top: 83px or top: 105px', () => {
    expect(css).not.toMatch(/\.mobile-show-map\s+\.mobile-view-toggle\s*\{[^}]*top:\s*83px/)
    expect(css).not.toMatch(/\.mobile-show-map\s+\.mobile-view-toggle\s*\{[^}]*top:\s*105px/)
  })

  it('prevents city card and toggle collision on mobile screens', () => {
    expect(css).toMatch(/\.mobile-show-map\s+\.map-city-card\s*\{[^}]*max-width:\s*calc\(100%\s*-\s*155px\)/)
  })

  it('keeps active state transform scaled in place on tap rather than jumping to center', () => {
    expect(css).toMatch(/\.mobile-show-map\s+\.mobile-view-toggle:not\(:disabled\):active\s*\{[^}]*transform:\s*scale\(0\.96\)/)
  })
})
