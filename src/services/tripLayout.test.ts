import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Trip Workspace Layout & Navigation Integrity', () => {
  const stylesPath = path.resolve(__dirname, '../styles.css')
  const tripWorkspacePath = path.resolve(__dirname, '../components/TripWorkspace.tsx')
  const css = fs.readFileSync(stylesPath, 'utf8')
  const tripWorkspaceCode = fs.readFileSync(tripWorkspacePath, 'utf8')

  it('provides a dedicated Back option and button in TripWorkspace', () => {
    expect(tripWorkspaceCode).toContain('onBack?: () => void')
    expect(tripWorkspaceCode).toContain('className="secondary-button trip-back-btn"')
    expect(tripWorkspaceCode).toContain('onClick={onBack}')
  })

  it('keeps trip-map inside trip-body alongside trip-stops-panel in side-by-side split', () => {
    // Map should not be placed as a hero section between day-tabs and trip-body
    expect(tripWorkspaceCode).not.toContain('trip-map-hero')
    // trip-body must contain both trip-stops-panel and trip-map
    const tripBodyStart = tripWorkspaceCode.indexOf('<div className={`trip-body')
    expect(tripBodyStart).toBeGreaterThan(-1)
    const tripBodyCode = tripWorkspaceCode.slice(tripBodyStart)
    expect(tripBodyCode).toContain('className="trip-stops-panel"')
    expect(tripBodyCode).toContain('className="trip-map"')
  })

  it('enforces side-by-side grid split layout for desktop viewports in styles.css', () => {
    expect(css).toMatch(/\.trip-body\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:/)
    expect(css).toMatch(/\.trip-workspace\s*\{[^}]*overflow:\s*hidden;/)
  })

  it('does not hide action button labels on laptop viewports', () => {
    // Should not contain display: none on secondary-button > span in trip-header-actions
    expect(css).not.toMatch(/\.trip-header-actions\s+\.secondary-button\s*>\s*span\s*\{\s*display:\s*none;/)
  })

  it('provides mobile view switcher tabs without overlaying stops and map', () => {
    expect(tripWorkspaceCode).toContain('trip-mobile-nav')
    expect(tripWorkspaceCode).toContain('trip-mobile-tab')
    expect(css).toMatch(/\.trip-mobile-nav\s*\{/)
  })
})
