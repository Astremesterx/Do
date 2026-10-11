import { describe, expect, it, vi } from 'vitest'
import { collect, collectorMiddleware, extractJSONLDEvents } from './collector.mjs'

describe('local collector boundaries', () => {
  it('extracts Event types from graphs and lists while ignoring malformed JSON and scripts', () => {
    const html = `<script type="application/ld+json">broken</script><script type="application/ld+json">${JSON.stringify(
      {
        '@graph': [
          { '@type': 'MusicEvent', name: 'Concert' },
          { '@type': 'Organization', name: 'Ignore' },
        ],
      },
    )}</script><script type='application/ld+json'>${JSON.stringify({ itemListElement: [{ item: { '@type': ['Event', 'SocialEvent'], name: 'Social' } }] })}</script><script>throw new Error('Never run this')</script>`
    expect(extractJSONLDEvents(html).map((e) => e.name)).toEqual(['Concert', 'Social'])
  })
  it('refuses arbitrary URL targets and empty source selections', async () => {
    await expect(collect({ ids: ['https://example.com/private'] })).rejects.toThrow(
      'Unknown source',
    )
    await expect(collect({ ids: [] })).rejects.toThrow('at least one')
  })
  it.each([
    ['text/plain', 'http://127.0.0.1:5173', 415],
    ['application/json', 'https://unrelated.example', 403],
    ['application/json', 'http://127.0.0.1:9999', 403],
  ])('rejects unsafe request %s %s', async (contentType, origin, status) => {
    const req = {
      url: '/api/collector/run',
      method: 'POST',
      headers: { 'content-type': contentType, origin, host: '127.0.0.1:5173' },
    }
    const response = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 }
    await collectorMiddleware()(req, response, vi.fn())
    expect(response.statusCode).toBe(status)
  })
})
