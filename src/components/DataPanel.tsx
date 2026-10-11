import { useState } from 'react'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  LoaderCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import type { ItineraryStop, TravelPlan } from '../domain'
import { useEventsStore, useSocialStore, useTripStore } from '../stores'
import { adapters, simulateIngestion } from '../services/scraper'
import { downloadFile, importPlanJSON } from '../services/calendar'
import { eventSlot } from '../services/time'
import { verifyEvent } from '../services/eventTruthVerifier'
import { recalculateStops } from '../services/itineraryEngine'
import { generateUUID } from '../services/uuid'
import { Modal } from './ui'

export function DataPanel({
  onClose,
  notify,
  onImport,
}: {
  onClose: () => void
  notify: (s: string) => void
  onImport: () => void
}) {
  const events = useEventsStore((s) => s.events),
    addEvents = useEventsStore((s) => s.addEvents),
    name = useSocialStore((s) => s.userName),
    setName = useSocialStore((s) => s.setUserName),
    addPlan = useTripStore((s) => s.addPlan)
  const [progress, setProgress] = useState(''),
    [result, setResult] = useState<{
      count: number
      repaired: number
      duplicates: number
      rejected: number
    } | null>(null),
    [error, setError] = useState(''),
    [cloudSyncing, setCloudSyncing] = useState(false)
  const sync = async () => {
    setResult(null)
    try {
      const data = await simulateIngestion(events, setProgress)
      addEvents(data.events)
      setResult({
        count: data.events.length,
        repaired: data.repaired,
        duplicates: data.duplicates,
        rejected: data.rejected,
      })
      notify(`${data.events.length} verified demo events added.`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setProgress('')
    }
  }
  const importTrip = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose a trip file under 5 MB.')
      return
    }
    try {
      const plan = importPlanJSON(await file.text()),
        stops: ItineraryStop[] = plan.stops.map((stop, index) => {
          if (
            !stop.event ||
            stop.event.city !== plan.destinationCity ||
            stop.event.isOnline ||
            !Number.isInteger(stop.dayNumber) ||
            stop.dayNumber < 1 ||
            stop.dayNumber > 14
          )
            throw new Error('The trip contains an invalid stop.')
          const event = verifyEvent(stop.event).event,
            slot = eventSlot(event)
          if (!slot) throw new Error('A stop has an unsupported time.')
          return { ...stop, id: generateUUID(), event, slot, sortOrder: index }
        })
      const validated: TravelPlan = {
        ...plan,
        id: generateUUID(),
        stops: recalculateStops(stops),
        createdAt: new Date().toISOString(),
      }
      addPlan(validated)
      onImport()
      notify('Your adventure has arrived. Trip imported.')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Modal title="Your little control room." eyebrow="LOCAL, BY DESIGN" onClose={onClose}>
      <div className="modal-content data-panel">
        <label className="field-label">
          Your display name
          <input value={name} maxLength={30} onChange={(e) => setName(e.target.value || 'Alex')} />
        </label>
        <div className="local-status">
          <span className="local-status-icon">
            <ShieldCheck size={23} />
          </span>
          <div>
            <strong>Your plans stay with you.</strong>
            <p>
              Events, trips, and comments are saved in this browser. No account or database needed.
            </p>
          </div>
        </div>
        <div className="data-heading">
          <h3>The discovery pipeline</h3>
          <span className="demo-badge">SIMULATED</span>
        </div>
        <p className="fine-print">
          Try the multi-source ingestion flow using offline demo records. Coordinates are checked
          and duplicate events are removed before saving.
        </p>
        <div className="source-list">
          {adapters.map((adapter) => (
            <div key={adapter.name}>
              <span>
                <Radio size={14} />
                {adapter.name}
              </span>
              {progress === adapter.name ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Check size={14} />
              )}
            </div>
          ))}
        </div>
        <button
          className="secondary-button full-width"
          disabled={!!progress}
          onClick={() => void sync()}
        >
          {progress ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}{' '}
          {progress ? `Reading ${progress}…` : 'Run demo ingestion'}
        </button>
        <button
          className="secondary-button full-width"
          disabled={cloudSyncing}
          style={{ marginTop: '0.5rem' }}
          onClick={async () => {
            setCloudSyncing(true)
            try {
              const res = await useEventsStore.getState().syncWithSupabase()
              notify(res.message || 'Supabase sync finished.')
            } catch {
              notify('Failed to sync with Supabase.')
            } finally {
              setCloudSyncing(false)
            }
          }}
        >
          {cloudSyncing ? <LoaderCircle size={15} className="spin" /> : <Cloud size={15} />}{' '}
          {cloudSyncing ? 'Synchronizing with Supabase…' : 'Sync Supabase Cloud Events'}
        </button>
        {result && (
          <div className="ingestion-result">
            <CheckCircle2 size={18} />
            <div>
              <strong>{result.count} verified events added</strong>
              <span>
                {result.repaired} locations repaired · {result.duplicates} duplicates removed ·{' '}
                {result.rejected} invalid records rejected
              </span>
            </div>
          </div>
        )}
        <div className="menu-divider" />
        <h3>Bring your plans along.</h3>
        <div className="data-actions">
          <label className="secondary-button">
            <Upload size={15} />
            Import a trip
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importTrip(file)
              }}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              downloadFile(JSON.stringify(events, null, 2), 'do-events.json', 'application/json')
              notify('Event collection exported.')
            }}
          >
            <Download size={15} />
            Export events
          </button>
        </div>
        <p className="fine-print">
          <Database size={13} />
          {events.filter((e) => !e.isOnline).length} physical events ·{' '}
          {events.filter((e) => e.isOnline).length} online events
        </p>
        <p className="fine-print">
          Cover photography from{' '}
          <a href="https://unsplash.com" target="_blank" rel="noreferrer">
            Unsplash <ArrowUpRight size={11} />
          </a>
          . Map data by OpenStreetMap and CARTO.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
