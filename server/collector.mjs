import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Fixed public sources, adapted from Pulse. The API is deliberately not an
// arbitrary URL proxy, and never reads Supabase or Google credentials.
export const sources = [
  {
    id: 'gdg',
    name: 'Google Developer Groups',
    url: 'https://gdg.community.dev/api/event/?status=Published&order=start_date',
    homepage: 'https://gdg.community.dev/',
    mode: 'api',
    enabled: true,
  },
  {
    id: 'devpost',
    name: 'Devpost hackathons',
    url: 'https://devpost.com/api/hackathons',
    homepage: 'https://devpost.com/hackathons',
    mode: 'api',
    enabled: true,
  },
  { id: 'luma', name: 'Luma', url: 'https://lu.ma/discover', mode: 'jsonld', enabled: false },
  {
    id: 'eventbrite',
    name: 'Eventbrite',
    url: 'https://www.eventbrite.com/d/online/events/',
    mode: 'jsonld',
    enabled: false,
  },
  {
    id: 'meetup',
    name: 'Meetup',
    url: 'https://www.meetup.com/find/',
    mode: 'jsonld',
    enabled: false,
  },
  {
    id: 'devfolio',
    name: 'Devfolio',
    url: 'https://devfolio.co/hackathons',
    mode: 'jsonld',
    enabled: false,
  },
  {
    id: 'ra',
    name: 'Resident Advisor',
    url: 'https://ra.co/events',
    mode: 'jsonld',
    enabled: false,
  },
  {
    id: 'athletics',
    name: 'World Athletics',
    url: 'https://worldathletics.org/competitions',
    mode: 'jsonld',
    enabled: false,
  },
]
let current = null,
  lastRun = null,
  lastStarted = 0,
  lastSelection = ''
async function fetchText(url, limit = 4 * 1024 * 1024) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(18000),
    headers: {
      'User-Agent': 'DO-LocalEventCollector/1.0',
      Accept: 'application/json,text/html;q=0.9',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}; source access was not bypassed`)
  let size = 0,
    body = ''
  const decoder = new TextDecoder()
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > limit) throw new Error('Source response exceeds 4 MB')
    body += decoder.decode(chunk, { stream: true })
  }
  return body + decoder.decode()
}
export function extractJSONLDEvents(html) {
  const events = []
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const types = [].concat(node['@type'] ?? [])
    if (types.some((type) => /Event$/.test(type))) events.push(node)
    if (node['@graph']) visit(node['@graph'])
    if (node.itemListElement) visit(node.itemListElement)
    if (node.item) visit(node.item)
  }
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(match[1]))
    } catch {
      /* A malformed block does not poison other valid records. */
    }
  }
  return events
}
async function permitsHTML(source) {
  const robots = await fetchText(new URL('/robots.txt', source.url).href, 256 * 1024)
  let relevant = false
  for (const raw of robots.split('\n')) {
    const line = raw.split('#')[0].trim()
    const userAgent = line.match(/^User-agent:\s*(.+)/i)
    if (userAgent) relevant = userAgent[1] === '*' || /DO-LocalEventCollector/i.test(userAgent[1])
    const disallow = line.match(/^Disallow:\s*(\S+)/i)
    if (
      relevant &&
      disallow &&
      new URL(source.url).pathname.startsWith(disallow[1].replace(/\*.*$/, ''))
    )
      return false
  }
  return true
}
export async function collect({
  ids = ['gdg', 'devpost'],
  directory = resolve('public/data'),
  force = false,
} = {}) {
  if (current) return current
  if (!Array.isArray(ids) || ids.some((id) => !sources.some((s) => s.id === id)))
    throw new Error('Unknown source selection')
  if (!ids.length) throw new Error('Choose at least one source')
  const selection = [...new Set(ids)].sort().join(',')
  if (!force && Date.now() - lastStarted < 5 * 60000 && lastRun && selection === lastSelection)
    return { ...lastRun, cached: true }
  lastStarted = Date.now()
  lastSelection = selection
  current = (async () => {
    const result = {
      version: 1,
      collectedAt: new Date().toISOString(),
      sources: [],
      logs: [],
      failures: [],
    }
    const selected = sources.filter((s) => ids.includes(s.id))
    for (let i = 0; i < selected.length; i += 2) {
      const records = await Promise.all(
        selected.slice(i, i + 2).map(async (source) => {
          try {
            if (source.mode === 'jsonld' && !(await permitsHTML(source)))
              throw new Error('robots.txt disallows this listing')
            const body = await fetchText(source.url)
            const payload =
              source.mode === 'api' ? JSON.parse(body) : { events: extractJSONLDEvents(body) }
            const count = (payload.results ?? payload.hackathons ?? payload.events ?? []).length
            if (!count) throw new Error('No structured event records were returned')
            return { id: source.id, name: source.name, url: source.url, payload, count }
          } catch (error) {
            return { id: source.id, error: String(error.message ?? error) }
          }
        }),
      )
      for (const record of records) {
        if (record.error) {
          result.failures.push(record)
          result.logs.push(`${record.id}: ${record.error}`)
        } else {
          result.sources.push(record)
          result.logs.push(`${record.id}: collected ${record.count} records`)
        }
      }
    }
    if (result.sources.length) {
      await mkdir(directory, { recursive: true })
      await writeFile(resolve(directory, 'collected-events.json'), JSON.stringify(result))
    }
    lastRun = result
    return result
  })().finally(() => {
    current = null
  })
  return current
}
export function collectorMiddleware(directory = resolve('public/data')) {
  return async (req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (!path.startsWith('/api/collector')) return next()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const send = (status, body) => {
      res.statusCode = status
      res.end(JSON.stringify(body))
    }
    try {
      if (req.method === 'GET' && path === '/api/collector/status') {
        const previous = lastRun ?? (await readCollected(directory))
        return send(200, {
          status: current ? 'running' : 'idle',
          lastRun: previous
            ? {
                collectedAt: previous.collectedAt,
                logs: previous.logs,
                failures: previous.failures,
                sources: previous.sources?.map((source) => ({
                  id: source.id,
                  name: source.name,
                  count: source.count,
                })),
              }
            : null,
          sources,
        })
      }
      if (req.method !== 'POST' || path !== '/api/collector/run')
        return send(404, { error: 'Not found' })
      if (!req.headers['content-type']?.startsWith('application/json'))
        return send(415, { error: 'JSON required' })
      const origin = req.headers.origin
      if (
        origin &&
        (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname) ||
          new URL(origin).host !== req.headers.host)
      )
        return send(403, { error: 'Same-origin local requests only' })
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 2048) return send(413, { error: 'Request too large' })
      }
      const result = await collect({ ids: JSON.parse(body || '{}').ids, directory })
      return send(200, result)
    } catch (error) {
      return send(400, { error: String(error.message ?? error) })
    }
  }
}
export async function readCollected(directory = resolve('public/data')) {
  try {
    return JSON.parse(await readFile(resolve(directory, 'collected-events.json'), 'utf8'))
  } catch {
    return null
  }
}
