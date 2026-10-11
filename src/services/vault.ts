import type { PulseEvent } from '../domain'
import { generateUUID } from './uuid'

export interface LocalSnapshot {
  id: string
  name: string
  createdAt: string
  size: number
  events: PulseEvent[]
}
function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('do-vault', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots', { keyPath: 'id' })
    request.onerror = () =>
      reject(
        new Error(
          'Local file storage is unavailable in this browser. You can still download a JSON backup.',
        ),
      )
    request.onsuccess = () => resolve(request.result)
  })
}
export async function listSnapshots(): Promise<LocalSnapshot[]> {
  const db = await openVault()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('snapshots').objectStore('snapshots').getAll()
      request.onsuccess = () =>
        resolve(
          (request.result as LocalSnapshot[]).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
        )
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}
export async function saveSnapshot(
  events: PulseEvent[],
  name = `DO events · ${new Date().toLocaleDateString()}`,
) {
  const snapshot: LocalSnapshot = {
    id: generateUUID(),
    name,
    createdAt: new Date().toISOString(),
    size: new Blob([JSON.stringify(events)]).size,
    events,
  }
  const db = await openVault()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('snapshots', 'readwrite')
      transaction.objectStore('snapshots').put(snapshot)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
  return snapshot
}
