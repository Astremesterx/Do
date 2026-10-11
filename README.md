# DO

DO is a local event discovery, community, and itinerary app built with React, TypeScript, Vite, Leaflet, and Zustand. It supports light/dark/device themes with a neutral UI and full-colour photos. No database, account credentials, or deployment is required.

## Run locally

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. In the managed desktop environment, Vite's worker process may need approval to run outside the filesystem sandbox. The app scripts use Vite's native configuration loader.

```sh
npm run build
npm run preview
npm run lint
npm test
npm run collect
npm run collect:watch
```

`collect:watch` is an explicit 30-minute CLI loop and stops when that process stops. The console can also run collection, or repeat it while the console remains open. There is no unattended cloud service.

## What is included

- 756 generated demo events across seven seeded cities and twelve genres, plus a separate real public collection. A broader searchable city dictionary supports collection and hosting.
- Physical maps with clusters, category pins, live pulses, collision spreading, location scopes, GPS, radius/district filters, map styles, satellite imagery, and dropped-pin hosting. Online events stay in their own timezone-aware feed.
- Guest previews; local explorer/organization profiles; interests, following, trust/capacity RSVP rules, notifications, attendance feedback, and active/archived local chat rooms.
- Expiring 2/4/6-hour social beacons and an expanded three-step physical/online hosting form with templates, covers, guest limits, pricing, private instructions, meeting links, and status controls.
- A local console for event editing/archive/restore, collection sources/logs/imports, uploaded covers, real IndexedDB event snapshots, and portable JSON backups.
- Event-driven trips for 1–14 days: primary-vibe anchors, morning/afternoon/evening/night brackets, nearest feasible neighbors, Haversine transit estimates, 45-minute connection buffers, three-hour chill gaps, safe swaps within 5 km, custom stops, route maps, day tabs, and conflict flags.
- RFC 5545 calendar export, full JSON trip import/export, configuration share links, memoized filters, virtualized long feeds, focus-managed portals, responsive mobile sheets, an error boundary, and a production application cache.

See [Pulse analysis and feature mapping](FEATURE_PARITY.md) for the detailed ZIP review, implementation coverage, source findings, and deferred database-dependent services. See [validation](VALIDATION.md) for checks and practical limits.

## Collection and data boundaries

The public GDG and Devpost adapters fetch actual listings into `public/data/collected-events.json`. The final audit of its 509 raw records accepted 277, excluded 230, and removed two duplicates. Counts change when the source or time changes; this is one API page, not an exhaustive catalog. Collected records preserve their original times, source links, and provenance. Missing fees show “Check source”. Locations without venue coordinates use clearly approximate anchors; unsupported physical cities are excluded.

The optional Luma, Eventbrite, Meetup, Devfolio, Resident Advisor, and World Athletics adapters parse permitted Event JSON-LD. Availability depends on the provider. Empty, blocked, or unsupported listings produce visible logs, never fabricated replacements. The original five-provider simulator remains available separately in local-data settings and is labelled as simulated.

The bundled Pulse reference has 127 unique source records. Validation imports 115 into the archive, preserving supplied dates; 12 invalid or unsupported records are excluded. A reference file is not independent proof of current availability or organizer authenticity.

All profiles, RSVPs, trust scores, comments, and hosted events are local prototypes. Real shared accounts, authoritative reputation, multi-user chat, authenticated administration, cloud media storage, and background notifications await the later database session. Local RSVP privacy controls hide details in the UI; they are not a security boundary.

Event state, trips, community profiles, and comments persist per browser/origin in localStorage, with an in-memory fallback and warning if storage is unavailable/full. Event snapshots use IndexedDB; JSON downloads provide portable backups. Switching origin or browser creates a different local session.

## Maps, offline use, and estimates

The default map uses OpenStreetMap tiles with a monochrome display treatment. Set `VITE_CARTO_API_KEY` in `.env.local` to use CARTO light/dark basemaps. Satellite mode uses Esri World Imagery. Attribution is displayed and external tiles need connectivity. [CARTO key guidance](https://www.carto.com/basemaps/apikey/index.html), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

The production worker caches the application shell, hashed bundles, and bundled cover photographs. Local event/trip data persists separately. The built-worker offline integration check passes, but end-to-end offline reload in the desktop in-app browser remains unverified.

Routes are straight-line connections and travel times are estimates, not live directions. Budget conversion uses demo rates (INR 80 and JPY 150 per USD, other currencies at parity). Confirm actual prices, schedules, deadlines, and venue details with the linked source. Structural verification checks data shape and consistency; it does not certify organizers or ticket inventory.

## Source layout

```text
src/domain.ts                Event, trip, profile, notification and city contracts
src/data/                    City dictionary, district anchors, twelve genres, seeds
src/services/                Collection, validation, community rules, planning, exports
src/stores.ts                Events, trips and local social repositories
src/communityStore.ts        Profiles, RSVPs, following, trust, notifications, appearance
src/components/              Maps, feeds, forms, profiles, chat, console and trip views
server/collector.mjs         Fixed-source local API/JSON-LD collector and middleware
scripts/collect.mjs           Explicit one-off/periodic collection CLI
public/data/                 Actual collected snapshot and quarantined Pulse reference
public/sw.js                 Production application cache
```

## Assets and local-only status

Bundled cover photos are from Unsplash: [music](https://images.unsplash.com/photo-1492684223066-81342ee5ff30), [technology](https://images.unsplash.com/photo-1519389950473-47ba0277781c), [food](https://images.unsplash.com/photo-1414235077428-338989a2e8c0), [art](https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5), [nightlife](https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3), and [outdoors](https://images.unsplash.com/photo-1441974231531-c6227db76b6e). Icons are from Lucide. DM Sans and Space Grotesk load from Google Fonts with local fallbacks.

The build is kept local at the user's request. Nothing has been uploaded or published. The unused optional Sites manifest does not imply deployment.
