# VH1 Officials Camp 2026

A single-page web app for running a basketball officials training camp — camper
profiles, clinician-led evaluations across six categories, rankings, schedule,
chat, email announcements, and admin tools. Three roles share the same page
(camper / staff / admin) and are gated by an in-page login.

## Repo contents

The entire repo is two files plus git:

```
/
├── index.html   # 4,171 lines, ~515KB — the whole app (HTML + CSS + JS inline)
├── sw.js        # 24 lines — service worker (offline cache + push handler)
└── .git/
```

There is **no** `portal/` directory, **no** `netlify/functions/` directory, **no**
README, **no** package.json, **no** build tooling. The user prompt mentioned
some of these; they are not in this repo. The word "portal" inside `index.html`
refers to the three in-page views (`#pCamper`, `#pStaff`, `#pAdmin` — CSS class
`.portal`). A separate URL `https://vh1camp.github.io/portal/` is hardcoded into
outgoing email templates (see "External services" below) but is not part of
this repo — its relationship to this codebase is unknown from the code alone.

Deployment target: unknown from the code. A Netlify site (`vh1camp2026.netlify.app`)
hosts the email-sending function; whether this `index.html` is also served from
there or from GitHub Pages is not stated in the repo.

## High-level structure of `index.html`

Everything is inline. Section dividers use `// ═══ SECTION ═══` comments
in the JS. Approximate map:

| Lines | Section |
|---|---|
| 1–19 | `<head>`: meta, manifest link, Google Fonts, apple-touch-icon |
| 20–~420 | Inline `<script>` that builds the PWA manifest from an embedded base64 JPEG logo and registers `sw.js` |
| ~430–1153 | HTML body: login screen + three `.portal` containers (`pCamper`, `pStaff`, `pAdmin`) + modals |
| 1156–1164 | `CFG` object — all runtime config, hardcoded |
| 1168–1186 | Global state (`CU`, `CR`, `campers`, etc.) and the `supa()` fetch helper |
| 1189–1236 | `loadAll()` — fetches campers, evaluations, clinicians, staff, docs, settings, chat |
| 1238–1297 | Login (camper / staff / admin) + `enterApp()` / `logout()` |
| 1299–1414 | Camper + staff view routers |
| 1415–1508 | Shared eval-card builder and eval submission |
| 1509–1518 | Email HTML template builders |
| 1519–1840 | Admin portal: overview, campers, staff, clinicians, schedule, tracker, settings, CRUD |
| 1841–1871 | Rankings (overall / per-category) |
| 1873–1940 | JotForm-via-Google-Sheets sync |
| 1941–2146 | Profiles + PIN reset |
| 2150–2291 | XLSX import (SheetJS loaded from cdnjs at runtime) |
| 2292–2351 | Photo upload (client-side canvas compression → Supabase) |
| 2352–2494 | Chat (polling-based; see "Gotchas") |
| 2495–2657 | Email blast |
| 2904–3006 | Camp docs (upload/display) |
| 3000+ | Utilities, scheduler UI, admin/nuke operations, PWA install prompt |

## External services (all hardcoded in `CFG`, `index.html:1157-1164`)

| Service | Value | Purpose |
|---|---|---|
| Supabase project URL | `https://ekxundkaorvycwljtmqj.supabase.co` | Backend DB + REST (line 1158) |
| Supabase project ref | `ekxundkaorvycwljtmqj` | Derived from URL |
| Email-sending endpoint | `https://vh1camp2026.netlify.app/.netlify/functions/send-email` | A Netlify Function (source not in this repo) that presumably wraps SendGrid (line 1160) |
| From address | `admin@vh1basketball.com` | Sender on outgoing email (line 1161) |
| Google Sheet (JotForm responses) | Sheet ID `1iWz9UiknCSy0WZcEgYO50nmD3IBs-puNxRNoIFXdNYk`, read via `https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:json&sheet=Form+responses` | Admin "Sync JotForm" button; sheet must be publicly readable for Gviz (lines 1874, 1879) |
| External portal URL (emails only) | `https://vh1camp.github.io/portal/` | Linked from outgoing email templates (lines 1831, 2058, 2104, 2111, 2562, 2639). Not otherwise used in the app. |
| Google Fonts | Bebas Neue, Barlow | Typography |
| cdnjs XLSX | `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` | Lazy-loaded for Excel import (index.html:~2158) |

JotForm itself is not called directly — the integration is a one-way read of a
public Google Sheet that JotForm writes into. No JotForm form ID appears in the
repo.

SendGrid is not called directly from the browser either; outgoing email goes
through the Netlify function URL above. The SendGrid key, if any, lives in that
function (out of tree). Not present in this repo.

## ⚠️ Secrets committed to the repo

**This is a public GitHub repo. Anything committed here is public — treat each
of these as already exposed.**

1. **Supabase anon/public JWT** — `index.html:1159`, assigned to `CFG.SUPA_KEY`:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreHVuZGthb3J2eWN3bGp0bXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDU1NDIsImV4cCI6MjA5MDkyMTU0Mn0.7Yj_shBBlGXmmViMP4F5vCuFPamUvWWo8IuQXBqF4HA
   ```
   Decoded role claim is `anon` (not `service_role`), so the usual mitigation is
   strong Row Level Security on every table. No RLS policies are visible from
   client code, so RLS posture is **unknown** — worth verifying in the Supabase
   dashboard.

2. **Default admin password `'1234'`** — `index.html:1270`. Used as the fallback
   when no `admin_password` row exists in the `settings` table. Anyone reading
   the source knows this.

3. **Google Sheet ID** `1iWz9UiknCSy0WZcEgYO50nmD3IBs-puNxRNoIFXdNYk` — not a
   secret per se, but the Gviz sync requires the sheet to be link-readable,
   which means everyone with the ID can read camper contact info.

No SendGrid API key (`SG.…`), no Supabase `service_role` key, and no explicit
`Bearer` tokens other than the anon JWT above appear in the file.

## Database (Supabase Postgres)

All queries go through the `supa(table, method, body, query)` helper at
`index.html:1178`, which hits `${SUPA_URL}/rest/v1/${table}${query}` with the
anon key as both `apikey` and `Authorization: Bearer`. No Supabase JS client is
used; no realtime subscriptions (despite the `// ═══ SUPABASE REALTIME CLIENT ═══`
comment at line 1166, which is an empty section).

Tables referenced (every unique first arg to `supa(...)`):

| Table | Used for | Columns inferred from inserts/patches |
|---|---|---|
| `campers` | Camper roster + login | `first_name, last_name, email, phone, city, state, pin, photo, levels, rmac, is_returning, bio, conference, type` |
| `evaluations` | Per-camper scores | `camper_id, clinician_name, eval_date, court, eval_time, scores, comments, overall_score, created_at` |
| `clinicians` | Clinician list | `name` |
| `staff` | Staff accounts + login | `first_name, last_name, username, password, title, role, id` |
| `settings` | Key/value config (incl. `admin_password`, `announcement`) | `key, value` |
| `chat` | Messages (general + staff-only room) | `room, sender, content, created_at, id` |
| `schedule` | Session schedule | `day, time_slot, court, …` |
| `schedule_settings` | Publish flag — row at `id=1` | `published` |
| `camp_docs` | Uploaded docs / announcements | `name, data, uploaded_at, id` |

**No `.rpc(...)` calls.** Everything is REST-style table I/O (GET / POST /
PATCH / DELETE with PostgREST filters like `?id=eq.${id}` and
`?id=not.is.null`).

## Auth and role logic

There is no Supabase Auth — all three login flows do plaintext comparisons
against rows the anon key fetched.

| Role | File:line | Method |
|---|---|---|
| Camper | `index.html:1248-1255` | Lowercased last name + PIN match a row in `campers` |
| Staff | `index.html:1257-1264` | Lowercased `username` + `password` match a row in `staff` |
| Admin | `index.html:1266-1272` | Single password compared to `settings['admin_password']`, falling back to `'1234'` |

Two globals drive the session: `CU` (current user row) and `CR` (one of
`'camper' | 'staff' | 'clinician' | 'admin'` — `'clinician'` is referenced in
some UI checks but there is no clinician-login flow; clinicians appear to exist
only as a lookup table used when submitting evals). See `index.html:1170`,
`1285-1297`.

There is no session persistence: refreshing the page logs you out. There is no
token, no cookie, no `localStorage` session. `logout()` just nulls the globals
(`index.html:1275-1282`).

## Gotchas and non-obvious patterns

- **Everything is one file.** No modules. Every function is a global. Editing
  anywhere requires scrolling; `grep -n` on `index.html` is the best way to
  navigate. Expect many short single-letter locals (`c`, `s`, `r`, `CU`, `CR`,
  `supa`, `cf`) and ternary-chain one-liners.
- **Service worker caches aggressively.** `sw.js` caches under
  `vh1-camp-v1`; strategy is network-first with cache fallback
  (`sw.js:13-16`). Bumping the cache name is the only mechanism to force-evict
  a stuck client.
- **PWA manifest is generated at runtime from a base64 JPEG** embedded in the
  `<script>` block around line 23. Don't be alarmed by the large opaque string
  there — it's the app icon, not an API key.
- **Passwords and PINs are stored plaintext** in Supabase (see
  `index.html:1253`, `1262`, `1703`). A successful login is a plaintext string
  comparison done on the client after downloading the whole table.
- **Client downloads full tables on every login.** `loadAll()`
  (`index.html:1189-1236`) pulls campers, evaluations, clinicians, staff, docs,
  settings, and chat with no pagination — then `loginCamper` scans the array.
- **Chat is poll-based, not realtime.** `startChatBackgroundPoll()` is kicked
  off in `enterApp()` at `index.html:1296`. The `// ═══ SUPABASE REALTIME
  CLIENT ═══` section at line 1166 is empty.
- **"General" chat vs. legacy rows.** Chat room filter treats
  `room === 'general'` and `room is null/undefined` as the same bucket (see
  comments at `index.html:2366-2367`).
- **JotForm sync is actually a Google Sheets Gviz scrape.** It parses
  `google.visualization.Query.setResponse(...)` by regex
  (`index.html:1883`). Column lookup is by lowercase label substring match
  (`ci()` at `1893`) — renaming JotForm questions will silently break the
  mapping.
- **Bulk insert with one-by-one fallback.** CSV / JotForm / XLSX imports first
  try a batch `POST`, and if that fails, silently retry row-by-row, swallowing
  individual errors (`index.html:1872`, `1931-1934`, `2258-2263`). Partial
  successes are possible and not reported.
- **Destructive admin operations are reachable from the UI.** "Clear ALL
  evaluations" (`index.html:1868`), full-table deletes keyed on
  `?id=not.is.null` at 3013/3014/3025/3041/3532/4022. These are guarded only by
  a client-side confirmation modal (`cf(...)`).
- **Photos are compressed on the client** via a `<canvas>` before upload
  (`index.html:2317`) and stored inline (`campers.photo`) — not in Supabase
  Storage.
- **The `clinicians` table is kept in sync with the `staff` table manually** in
  admin flows — adding/renaming a staff member also inserts/updates a matching
  clinicians row (`index.html:1767`, `1781`, `1789-1790`). Clinician rows can
  drift if any of those paths fail mid-flight.
- **No README, no license, no install/run steps.** Opening `index.html` in a
  browser is the run command.

## TODOs and commented-out code

- **No explicit `TODO` / `FIXME` / `HACK` / `XXX` markers** in the code
  (`grep -nE "//\\s*(TODO|FIXME|HACK|XXX)"` returns nothing).
- The empty section header `// ═══ SUPABASE REALTIME CLIENT ═══`
  (`index.html:1166`) is the only obvious "intended, not yet built" hint — it
  implies realtime was planned but never wired up. Chat polls instead.
- `loadCampDocs()` appears to be called twice inside `loadAll()` (reported at
  `index.html:1200-1201` in the subagent audit) — verify and drop one if
  redundant.
- Comment trail at `index.html:2082` `// ── RESET CAMPER PIN ──` and the
  patterns at `2094` confirm the PIN-reset email flow depends on `camper.email`
  being present; campers without an email silently don't get notified.

## Quick index of things you'll probably want to grep for

- `CFG.SUPA_URL`, `CFG.SUPA_KEY`, `CFG.SENDGRID_URL` — all config
- `supa(` — every DB call
- `fetch(CFG.SENDGRID_URL` / `SENDGRID_URL` — every outgoing email
- `CU=`, `CR=` — every session-state mutation
- `.portal` / `#pCamper` / `#pStaff` / `#pAdmin` — role-gated UI regions
- `aTab(`, `cView(`, `sView(` — admin / camper / staff view routers
- `gviz` / `SHEET_ID` — JotForm sync
