# DO validation

Validated locally on 10 October 2026. DO combines clearly labelled demo events and local community state with a separate collection of actual public listings. No database or cloud account is connected, and nothing was uploaded or published.

## Automated checks

- TypeScript strict compilation and Vite production build: passed.
- ESLint: passed.
- Vitest: **59 tests passed across four files**: 24 planning/data-engine checks, 22 collection/integrity checks, eight community-state checks, and five collector checks.
- Planning checks cover geographic repairs, SHA-256 deduplication and ID collisions, source-specific genres, online segregation, timezone/DST conversion, bracket boundaries, overnight events, Haversine/transit estimates, pace limits and buffers, primary-vibe anchors, swaps, custom connection warnings, calendar serialization, and invalid configurations.
- Collection checks cover real captured payloads, Pulse camel/snake-case fields and `HH:mm:ss` parsing, source date windows/year rollover, private/hidden/test/ended records, unsupported cities, unsafe URLs, malformed optional metadata, price uncertainty, native snapshot records without external ticket URLs, source updates/archive transitions, and runtime-supported IANA timezones.
- Community checks cover guest/trust/status/capacity gates, per-profile RSVPs and following, host auto-RSVP and one-time rewards, attendance/rating validation, beacon rewards, and scoped notifications. Collector checks cover Event JSON-LD parsing and allowlist/content-type/origin guards.

The built production service worker passed JavaScript/precache and installation/activation/offline-response integration checks during the original build review. Exact hashed bundles are injected by Vite. Local cover photos are cached; external map tiles are excluded. End-to-end offline reload in the desktop in-app browser remains unverified: a prior reload after stopping localhost showed a blank page despite the worker-level integration check passing.

## Source audits

| Captured input                | Result                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Public GDG/Devpost collection | 509 raw records: 277 accepted, 230 excluded, two duplicates.                                                 |
| Pulse reference union         | 127 unique records: 115 compatible records retained in the archive; 12 invalid/unsupported records excluded. |

The public collector was exercised from the CLI and from the browser console. GDG returned 500 records and Devpost returned nine. These figures describe captured API pages, not complete worldwide coverage. Source dates remain unchanged, unknown fees display “Check source”, and approximate coordinates are labelled. Optional JSON-LD adapters were checked at the parser/guard level; successful live extraction from all six optional providers is not claimed.

The final browser Pulse import added the 65 remaining compatible records and reported 50 existing duplicates plus 12 exclusions. All 115 compatible reference records remain archived until independently confirmed. Existing browser totals include records retained from earlier local build sessions, so they differ from fresh-store seed and collection counts.

## Browser verification

The final production preview was inspected at 1440 × 1000 and 390 × 844. Checked light/dark switching, persisted appearance, colour photos, maps/clusters, worldwide and district scopes, online source listings, guest previews, profile switching, profile dashboard, RSVP/follow controls, notifications, local discussions, chat rooms, hosting, event archive/restore, source logs, and IndexedDB snapshots. The final mobile discovery view has no horizontal overflow; the header and navigation/filter overlap found during QA was corrected. Loaded event photos had no failed images. No new warning/error console entries were recorded in the final production-preview session.

The hosted test event “DO reading room · local demo” published with a book template, city-local schedule, capacity 20, free entry, and private venue instructions. The owner was automatically joined, the room contained no fabricated messages, and host conclusion made it read-only. Attendance and a five-star rating recorded once and updated the local score. Console archive and restore both succeeded without deleting the record. Local follow/join and a posted demo-room message were also exercised.

A real IndexedDB snapshot containing 1,196 records was saved and listed. Restoring that snapshot reported zero missing records and preserved existing edits. The snapshot is local to this browser/origin; it is not a cloud backup.

Trip generation, day tabs, safe swaps, custom stops, share links, the three-step host form, bookmarks, and simulated ingestion were checked during the original build review. A custom 11:45–12:45 stop retained its exact times and exposed the insufficient-transit/overlap warnings. The existing three-day trip and day switching were rechecked in the expanded mobile build. The mobile list/map toggle and preview/half/full event-sheet states worked.

Proof images are in `artifacts/`: `do-light.png`, `do-dark.png`, `do-mobile.png`, and `do-console.png`.

## Practical boundaries

- Shared accounts/OAuth, authenticated administration, authoritative reputation/attendance, multi-user chat, cross-device persistence, cloud media, background push notifications, and ticket transactions await the database session. Client-only RSVP privacy is a UI control, not an access-security boundary.
- GPS controls are implemented with explicit permission and memory-only coordinates; hardware geolocation was not exercised. Cover MIME/decode/size checks and JSON import validation are implemented; arbitrary user-selected uploads were not exercised. Calendar/JSON serialization is tested, but OS-level download capture was unavailable in the in-app browser.
- Map tiles and remote source images need connectivity. The default is monochrome OpenStreetMap; optional CARTO and colour Esri satellite modes are available. Travel times are estimates, and budget conversion uses documented demo rates.
- Long feeds use virtualization and filters are memoized. Device-level 60 FPS and CLS below 0.05 were not benchmarked and are not claimed.

The source, built output, reference analysis, collection snapshot, and browser proof images remain local at the user's request.
