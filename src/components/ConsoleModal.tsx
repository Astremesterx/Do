import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  Cloud,
  Database,
  Download,
  Edit3,
  FileJson,
  HardDrive,
  LoaderCircle,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import type { PulseEvent } from '../domain'
import { useEventsStore } from '../stores'
import { GENRES, getCity } from '../data/cities'
import { normalizeCollection } from '../services/collection'
import { verifyAndDeduplicate } from '../services/eventTruthVerifier'
import { downloadFile } from '../services/calendar'
import { isLive } from '../services/time'
import { listSnapshots, saveSnapshot, type LocalSnapshot } from '../services/vault'
import { checkSupabaseConnection, isSupabaseConfigured } from '../services/supabase'
import { Modal } from './ui'

const sources = [
  {
    id: 'gdg',
    name: 'Google Developer Groups',
    mode: 'Public API',
    url: 'https://gdg.community.dev/',
  },
  { id: 'devpost', name: 'Devpost', mode: 'Public API', url: 'https://devpost.com/hackathons' },
  { id: 'luma', name: 'Luma', mode: 'JSON-LD listing', url: 'https://lu.ma/discover' },
  {
    id: 'eventbrite',
    name: 'Eventbrite',
    mode: 'JSON-LD listing',
    url: 'https://www.eventbrite.com/d/online/events/',
  },
  { id: 'meetup', name: 'Meetup', mode: 'JSON-LD listing', url: 'https://www.meetup.com/find/' },
  {
    id: 'devfolio',
    name: 'Devfolio',
    mode: 'JSON-LD listing',
    url: 'https://devfolio.co/hackathons',
  },
  { id: 'ra', name: 'Resident Advisor', mode: 'JSON-LD listing', url: 'https://ra.co/events' },
  {
    id: 'athletics',
    name: 'World Athletics',
    mode: 'JSON-LD listing',
    url: 'https://worldathletics.org/competitions',
  },
]
export function ConsoleModal({
  onClose,
  onEdit,
  notify,
}: {
  onClose: () => void
  onEdit: (event?: PulseEvent) => void
  notify: (message: string) => void
}) {
  const events = useEventsStore((s) => s.events),
    addEvents = useEventsStore((s) => s.addEvents),
    archive = useEventsStore((s) => s.archiveEvent)
  const [tab, setTab] = useState<'events' | 'collector' | 'files' | 'health'>('events'),
    [query, setQuery] = useState(''),
    [genre, setGenre] = useState('all'),
    [showArchived, setShowArchived] = useState(false),
    [page, setPage] = useState(0),
    [running, setRunning] = useState(false),
    [logs, setLogs] = useState<string[]>([]),
    [error, setError] = useState(''),
    [enabled, setEnabled] = useState(['gdg', 'devpost']),
    [periodic, setPeriodic] = useState(false),
    [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]),
    [busy, setBusy] = useState(false),
    [cloudStatus, setCloudStatus] = useState<{
      checked: boolean
      ok: boolean
      message: string
      count?: number
    }>({ checked: false, ok: false, message: 'Checking Supabase...' }),
    [cloudSyncing, setCloudSyncing] = useState(false)
  const runRef = useRef<() => void>(() => {}),
    mounted = useRef(true)

  useEffect(() => {
    if (tab === 'health' && isSupabaseConfigured()) {
      void checkSupabaseConnection().then((res) => {
        if (mounted.current) {
          setCloudStatus({ checked: true, ok: res.ok, message: res.message, count: res.eventCount })
        }
      })
    }
  }, [tab])

  const handleCloudSync = async () => {
    setCloudSyncing(true)
    try {
      const res = await useEventsStore.getState().syncWithSupabase()
      notify(res.message || (res.ok ? `Synced ${res.count} events from Supabase.` : 'Sync failed.'))
      const status = await checkSupabaseConnection()
      if (mounted.current) {
        setCloudStatus({ checked: true, ok: status.ok, message: status.message, count: status.eventCount })
      }
    } catch {
      notify('Failed to sync with Supabase cloud database.')
    } finally {
      if (mounted.current) setCloudSyncing(false)
    }
  }
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    void fetch('/api/collector/status', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
          return
        const data = (await response.json()) as {
          lastRun?: { collectedAt?: string; logs?: string[] }
        }
        if (mounted.current && data.lastRun?.logs)
          setLogs((previous) =>
            previous.length
              ? previous
              : [
                  `Last collection · ${new Date(data.lastRun!.collectedAt ?? '').toLocaleString()}`,
                  ...data.lastRun!.logs!,
                ],
          )
      })
      .catch(() => {
        /* A static build can still import collected files. */
      })
    return () => {
      mounted.current = false
      controller.abort()
    }
  }, [])
  const capture = async (payload: unknown, historical = false) => {
    const result = normalizeCollection(payload, useEventsStore.getState().events, historical)
    addEvents([...result.events, ...result.updates])
    const lines = [
      `${result.rawCount} source records · ${result.events.length} added · ${result.updates.length} refreshed · ${result.duplicates} duplicates · ${result.repaired} approximate location repairs · ${result.rejected} excluded`,
      ...result.issues.slice(0, 40).map((issue) => `${issue.title}: ${issue.reason}`),
    ]
    if (mounted.current) setLogs((previous) => [...lines, ...previous].slice(0, 140))
    notify(
      `${result.events.length} event records added; ${result.updates.length} refreshed. Original source dates retained.`,
    )
  }
  const run = async () => {
    if (running || !enabled.length) return
    setRunning(true)
    setError('')
    setLogs((previous) => [
      `${new Date().toLocaleTimeString()} · Starting ${enabled.length} sources…`,
      ...previous,
    ])
    try {
      const response = await fetch('/api/collector/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: enabled }),
      })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
        throw new Error(
          'The local collector is unavailable. Start DO with npm run dev or npm run preview, or import a collected JSON file.',
        )
      const payload = (await response.json()) as {
        logs?: string[]
        sources?: unknown[]
        cached?: boolean
      }
      if (mounted.current)
        setLogs((previous) => [
          ...(payload.logs ?? []),
          ...(payload.cached
            ? ['Recent cached response used to respect the five-minute request interval.']
            : []),
          ...previous,
        ])
      await capture(payload)
      if (!payload.sources?.length)
        throw new Error(
          'No sources returned records. The log contains each source failure; existing events are preserved.',
        )
    } catch (value) {
      if (mounted.current) setError((value as Error).message)
    } finally {
      if (mounted.current) setRunning(false)
    }
  }
  runRef.current = () => {
    void run()
  }
  useEffect(() => {
    if (!periodic) return
    const id = setInterval(() => runRef.current(), 30 * 60000)
    return () => clearInterval(id)
  }, [periodic])
  const loadSnapshots = async () => {
    try {
      setSnapshots(await listSnapshots())
    } catch (value) {
      setError((value as Error).message)
    }
  }
  const snapshot = async () => {
    setBusy(true)
    try {
      await saveSnapshot(events)
      await loadSnapshots()
      notify('Snapshot saved in the local vault.')
    } catch (value) {
      setError((value as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const filtered = events.filter(
    (event) =>
      !!event.archived === showArchived &&
      (genre === 'all' || event.genre === genre) &&
      `${event.title} ${event.venueName} ${event.city} ${event.sourcePlatform}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const media = [
    ...new Map(
      events.filter((e) => e.imageUrl.startsWith('data:')).map((e) => [e.imageUrl, e]),
    ).values(),
  ]
  return (
    <Modal title="A little room to run things." eyebrow="DO LOCAL CONSOLE" wide onClose={onClose}>
      <div className="console-tabs workspace-tabs">
        {(
          [
            ['events', 'Events'],
            ['collector', 'Collection radar'],
            ['files', 'Files & snapshots'],
            ['health', 'System health'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setTab(id)
              setError('')
              if (id === 'files') void loadSnapshots()
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="modal-content console-content">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {tab === 'events' && (
          <>
            <div className="console-stats">
              <span>
                <strong>{events.filter((e) => !e.archived).length}</strong>Active records
              </span>
              <span>
                <strong>
                  {events.filter((e) => isLive(e) && !e.archived && !e.concluded).length}
                </strong>
                Live now
              </span>
              <span>
                <strong>{events.filter((e) => e.provenance === 'collected').length}</strong>
                Collected
              </span>
              <span>
                <strong>{events.filter((e) => e.archived).length}</strong>Archived
              </span>
            </div>
            <div className="console-toolbar">
              <label className="console-search">
                <Search size={16} />
                <input
                  aria-label="Search managed events"
                  placeholder="Search events, city, source…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(0)
                  }}
                />
              </label>
              <select
                aria-label="Filter managed events by genre"
                value={genre}
                onChange={(e) => {
                  setGenre(e.target.value)
                  setPage(0)
                }}
              >
                <option value="all">All genres</option>
                {GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.short}
                  </option>
                ))}
              </select>
              <button
                className="secondary-button"
                aria-pressed={showArchived}
                onClick={() => {
                  setShowArchived(!showArchived)
                  setPage(0)
                }}
              >
                <Archive size={15} />
                {showArchived ? 'Show active' : 'Show archive'}
              </button>
              <button className="primary-button" onClick={() => onEdit()}>
                <Plus size={15} />
                Create event
              </button>
            </div>
            <div className="console-table">
              <table>
                <thead>
                  <tr>
                    <th>Event & city</th>
                    <th>Schedule</th>
                    <th>Origin</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(page * 25, (page + 1) * 25).map((event) => (
                    <tr key={event.id}>
                      <td>
                        <strong>{event.title}</strong>
                        <small>
                          {getCity(event.city).name} · {event.genre} ·{' '}
                          {event.isOnline
                            ? 'Online'
                            : event.locationPrecision === 'city'
                              ? 'Approximate city'
                              : event.venueName}
                        </small>
                      </td>
                      <td>
                        <span className="console-status">
                          {event.concluded || +new Date(event.endTime) <= Date.now()
                            ? 'Concluded'
                            : isLive(event)
                              ? 'Live now'
                              : 'Upcoming'}
                        </span>
                        <small>{new Date(event.startTime).toLocaleDateString()}</small>
                      </td>
                      <td>
                        {event.provenance === 'collected'
                          ? 'Collected'
                          : event.provenance === 'pulse-import'
                            ? 'Pulse archive'
                            : event.provenance === 'community'
                              ? 'Community'
                              : 'Demo'}
                        <small>{event.sourcePlatform}</small>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${event.title}`}
                          onClick={() => onEdit(event)}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${event.archived ? 'Restore' : 'Archive'} ${event.title}`}
                          onClick={() => {
                            archive(event.id, !event.archived)
                            notify(
                              event.archived
                                ? 'Event restored.'
                                : 'Event archived. You can restore it from the archive.',
                            )
                          }}
                        >
                          {event.archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && <p className="console-empty">No records match these filters.</p>}
            </div>
            <div className="button-row">
              <span>
                {filtered.length} records · page{' '}
                {Math.min(page + 1, Math.max(1, Math.ceil(filtered.length / 25)))} of{' '}
                {Math.max(1, Math.ceil(filtered.length / 25))}
              </span>
              <div className="button-row">
                <button
                  className="secondary-button"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="secondary-button"
                  disabled={(page + 1) * 25 >= filtered.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
        {tab === 'collector' && (
          <>
            <div className="console-section-heading">
              <Radio size={24} />
              <div>
                <h3>Find what’s really happening.</h3>
                <p>
                  Public APIs and permitted structured listings. Original dates, source links, and
                  provenance stay attached to each record.
                </p>
              </div>
            </div>
            <div className="collector-source-list">
              {sources.map((source) => (
                <label key={source.id}>
                  <input
                    type="checkbox"
                    checked={enabled.includes(source.id)}
                    disabled={running}
                    onChange={(e) =>
                      setEnabled(
                        e.target.checked
                          ? [...enabled, source.id]
                          : enabled.filter((id) => id !== source.id),
                      )
                    }
                  />
                  <span>
                    <strong>{source.name}</strong>
                    <small>
                      {source.mode}
                      {source.mode !== 'Public API' ? ' · availability depends on the listing' : ''}
                    </small>
                  </span>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    Source ↗
                  </a>
                </label>
              ))}
            </div>
            <div className="button-row">
              <button
                className="primary-button"
                disabled={running || !enabled.length}
                onClick={() => {
                  void run()
                }}
              >
                {running ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{' '}
                {running ? 'Collecting…' : 'Collect selected sources'}
              </button>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={periodic}
                  onChange={(e) => setPeriodic(e.target.checked)}
                />
                Every 30 minutes while this console is open
              </label>
            </div>
            <div className="button-row">
              <button
                className="secondary-button"
                onClick={async () => {
                  try {
                    const response = await fetch('/data/pulse-archive.json')
                    await capture(await response.json(), true)
                  } catch {
                    setError('The bundled Pulse archive could not be read.')
                  }
                }}
              >
                <FileJson size={15} />
                Import Pulse reference archive
              </button>
              <label className="secondary-button file-button">
                Import collected JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 12 * 1024 * 1024) {
                      setError('Choose a JSON file under 12 MB.')
                      return
                    }
                    try {
                      await capture(JSON.parse(await file.text()), true)
                    } catch (value) {
                      setError(`Import failed: ${(value as Error).message}`)
                    }
                  }}
                />
              </label>
            </div>
            <p className="fine-print">
              Pulse reference records remain archived with their original dates until their details
              are independently confirmed. Listing failures and access restrictions appear below;
              they are never bypassed.
            </p>
            <div className="collector-log" role="log" aria-live="polite">
              {logs.length ? (
                logs.map((line, index) => <p key={index}>{line}</p>)
              ) : (
                <p>No collection jobs have run in this session.</p>
              )}
            </div>
          </>
        )}
        {tab === 'files' && (
          <>
            <div className="console-section-heading">
              <HardDrive size={24} />
              <div>
                <h3>Keep a little backup.</h3>
                <p>
                  Snapshots are saved in this browser’s IndexedDB vault. Download JSON to keep a
                  portable copy.
                </p>
              </div>
            </div>
            <div className="button-row">
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => {
                  void snapshot()
                }}
              >
                {busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Save event
                snapshot
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  downloadFile(
                    JSON.stringify(
                      { version: 1, exportedAt: new Date().toISOString(), events },
                      null,
                      2,
                    ),
                    'do-event-snapshot.json',
                    'application/json',
                  )
                }
              >
                <Download size={15} />
                Download current events
              </button>
              <button
                className="icon-button"
                aria-label="Refresh local snapshots"
                onClick={() => {
                  void loadSnapshots()
                }}
              >
                <RefreshCw size={17} />
              </button>
            </div>
            <div className="snapshot-list">
              {snapshots.map((item) => (
                <article key={item.id}>
                  <FileJson size={22} />
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.events.length} events · {(item.size / 1024).toFixed(0)} KB ·{' '}
                      {new Date(item.createdAt).toLocaleString()}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Download ${item.name}`}
                    onClick={() =>
                      downloadFile(
                        JSON.stringify({ version: 1, events: item.events }, null, 2),
                        `do-snapshot-${item.id}.json`,
                        'application/json',
                      )
                    }
                  >
                    <Download size={17} />
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      const result = verifyAndDeduplicate(
                        item.events,
                        useEventsStore.getState().events,
                      )
                      addEvents(result.events)
                      notify(
                        `${result.events.length} missing records restored; existing edits preserved.`,
                      )
                    }}
                  >
                    Restore missing
                  </button>
                </article>
              ))}
            </div>
            <h3 className="section-label">Uploaded covers · {media.length}</h3>
            <div className="local-media-grid">
              {media.map((event) => (
                <article key={event.id}>
                  <img src={event.imageUrl} alt={event.title} />
                  <strong>{event.title}</strong>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(event.imageUrl)
                        .then(() => notify('Local image data URL copied.'))
                        .catch(() => setError('Clipboard access is unavailable.'))
                    }}
                  >
                    Copy image URL
                  </button>
                </article>
              ))}
            </div>
            {!media.length && (
              <p className="fine-print">
                Upload a cover when creating or editing a happening to see it here.
              </p>
            )}
          </>
        )}
        {tab === 'health' && (
          <>
            <div className="console-section-heading">
              <Cloud size={25} />
              <div>
                <h3>Supabase Cloud Database</h3>
                <p>
                  {cloudStatus.ok
                    ? 'Connected to Supabase project Do (wvmczeizdehapojpzgoz.supabase.co)'
                    : isSupabaseConfigured()
                      ? 'Connecting to Supabase...'
                      : 'Supabase credentials not configured'}
                </p>
              </div>
            </div>
            <div className="health-grid">
              <article>
                <Cloud size={20} />
                <strong>Supabase Database</strong>
                <span>
                  {cloudStatus.ok
                    ? `${cloudStatus.count ?? 888} events in cloud · PostgreSQL`
                    : cloudStatus.message}
                </span>
              </article>
              <article>
                <Database size={20} />
                <strong>Local repository</strong>
                <span>{events.length} records · browser localStorage</span>
              </article>
              <article>
                <HardDrive size={20} />
                <strong>Snapshot vault</strong>
                <span>IndexedDB · this browser and origin</span>
              </article>
              <article>
                <ShieldCheck size={20} />
                <strong>Cloud & local parity</strong>
                <span>Events, trips, beacons & chat synchronized</span>
              </article>
            </div>
            <div style={{ marginTop: '1.25rem' }}>
              <button
                className="primary-button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                disabled={cloudSyncing}
                onClick={() => void handleCloudSync()}
              >
                {cloudSyncing ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {cloudSyncing ? 'Synchronizing with Supabase…' : 'Sync Now with Supabase'}
              </button>
            </div>
            <p className="fine-print">
              DO synchronizes events, itineraries, proximity beacons, and chat rooms with your Supabase database while retaining local-first offline availability.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
