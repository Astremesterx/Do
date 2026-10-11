import type { IncomingMessage, ServerResponse } from 'node:http'
export const sources: { id: string; name: string; url: string; mode: string; enabled: boolean }[]
export function collect(options?: {
  ids?: string[]
  directory?: string
  force?: boolean
}): Promise<unknown>
export function extractJSONLDEvents(html: string): unknown[]
export function collectorMiddleware(
  directory?: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>
export function readCollected(directory?: string): Promise<unknown>
