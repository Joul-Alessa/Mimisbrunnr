# Implementation Log

This documents what was actually built for Mimisbrunnr, in what order, and the key
decisions made along the way. See [Initial-Specs.md](Initial-Specs.md) for the original
requirements this implements, and the root [README.md](../README.md) for a quick
reference (stack, how to run, API summary). This log goes deeper into *why* things
ended up the way they did.

## Stack decisions (made before writing code)

- **Backend:** Node.js + Express, plain JavaScript (no TypeScript).
- **Repo layout:** monorepo, `backend/` and `frontend/` as sibling folders.
- **Database:** SQLite, schema designed to be portable to PostgreSQL later.
- **Containers:** Docker (not Podman, despite the original spec mentioning it).
- **LLM:** local runtime (Ollama/LMStudio) via a backend service-layer interface —
  the LLM itself is out of scope for this agent to implement.

## Backend, phase by phase

### Phase 0 — Scaffolding
`backend/src/{config,db,models,routes,services,utils}` folders, `.env.example`,
`.gitignore`, `.dockerignore`. `package.json` was always created/managed by the user
running `npm init`/`npm install` themselves, never hand-written by the agent.

### Phase 1 — SQLite schema & migrations
[001_init_schema.sql](../backend/src/db/migrations/001_init_schema.sql) creates all
8 tables from the spec (`resource`, `resource_detail`, `knowledge_field`, `card`,
`card_field`, `card_resource`, `card_review`, `card_generation`) plus indexes and FKs.
[migrate.js](../backend/src/db/migrate.js) is a small runner that applies `.sql` files
in order and records applied filenames in a `_migrations` table, so re-running is a
no-op.

**SQLite driver churn (the interesting part):**
1. Started with `better-sqlite3`. Its native binary **segfaulted** (hard crash, not a
   JS exception — exit code 139 on Bash / 5 on PowerShell) the instant `new
   Database(...)` ran, on this machine (Windows, Node 22.11 at the time). Reproduced
   even with simple, non-parenthesized file paths, ruling out a path-quoting bug.
2. Switched to Node's built-in `node:sqlite` (`DatabaseSync`) — confirmed working
   end-to-end, but experimental and needs the `--experimental-sqlite` flag.
3. Settled on the mature **`sqlite3`** npm package instead, once the user clarified
   they were fine with Claude running `npm install` directly. `sqlite3` is
   callback-based, so [connection.js](../backend/src/db/connection.js) wraps it in a
   small promise-based `{run, get, all, exec}` helper used everywhere else
   (`getDb().run(...)`, etc.). No experimental flags needed.

### Phase 2 — Data access layer (models)
One file per table under `backend/src/models/`, CRUD only (no business logic):
`resourceModel`, `cardModel`, `resourceDetailModel`, `knowledgeFieldModel`,
`cardFieldModel`, `cardResourceModel`, `cardReviewModel`, `cardGenerationModel`.
[db/utils.js](../backend/src/db/utils.js) has a shared `buildSetClause()` helper for
constructing partial `UPDATE ... SET` statements. `knowledgeFieldModel.findDescendantIds`
uses a recursive CTE (`WITH RECURSIVE`) to get a field plus all its subfields —
this is reused later by both the study queue (field + subfields) and the
knowledge-field service (cycle detection).

Verified with an end-to-end smoke-test script (create/read/update/delete + the
recursive descendants query) run once against the real SQLite file, then deleted —
not kept as a permanent test suite.

### Phase 3 — REST API: Resources & Cards
[app.js](../backend/src/app.js) / [server.js](../backend/src/server.js): Express app
with CORS, JSON body parsing, a centralized error handler keyed off a small `HttpError`
class hierarchy ([utils/errors.js](../backend/src/utils/errors.js)), and
[utils/asyncHandler.js](../backend/src/utils/asyncHandler.js) to route rejected
promises to that error handler.

[routes/resources.js](../backend/src/routes/resources.js): CRUD + `GET /:id/cards`.

[routes/cards.js](../backend/src/routes/cards.js) + [services/cardService.js]
(../backend/src/services/cardService.js): implements the full card-creation flow from
spec 4.1 in one call — create the card, link `resource_ids`, create `resource_details`
(timestamp/page), assign `field_ids`, and initialize `card_review` — plus endpoints to
link/unlink individual resources and fields after the fact.

### Phase 4 — Knowledge Graph API
[services/knowledgeFieldService.js](../backend/src/services/knowledgeFieldService.js):
validates `name` is present, that a given `parent_id` exists, and — the important
part — **rejects cycles**: a field can't become its own ancestor or descendant. This
same cycle check is what later made the frontend's drag-and-drop reparenting and
"insert a field above an existing one" features safe to build without extra
client-side graph logic (see Frontend section).

[routes/knowledgeFields.js](../backend/src/routes/knowledgeFields.js): CRUD, `?tree=1`
for a nested tree, and `GET /:id/cards?includeSubfields=1` (uses the recursive
descendants query).

### Phase 5 — Spaced repetition engine & study flow
[services/spacedRepetition.js](../backend/src/services/spacedRepetition.js): an
Anki-like algorithm with all tunable numbers centralized in `SR_CONFIG` (ease factor
bounds, per-status ease deltas, first-review intervals, interval multipliers).

Bug caught during manual verification (fixed same session): "hard" was multiplying the
previous interval by `ease_factor * 0.5`, but since `ease_factor > 1`, that partially
*canceled* the intended shrink — a card could go from a 15-day interval to 19 days on
a "hard" answer, growing instead of shrinking. Fixed by making "hard" shrink the
previous interval directly (`interval * hardIntervalFactor`), independent of
`ease_factor`.

[services/studyService.js](../backend/src/services/studyService.js): resolves the
study scope (a specific field, that field + subfields recursively, or everything),
pulls due cards, and does a **weighted random sample** (more weight to more-overdue
cards and cards with a lower ease_factor) rather than a strict sort — per spec 4.2.3
("weighted by need").

[routes/study.js](../backend/src/routes/study.js): `GET /queue`, `POST /review`.

### Phase 6 — LLM integration interface (stubbed)
[services/llmService.js](../backend/src/services/llmService.js) builds real prompts
per mode (`question`/`cloze`/`example`/`reasoning`, plus `random` to pick one of
those). `callLLM(prompt)` is an explicit **stub** — at the user's request, it just
returns the prompt itself instead of a model response, until a local LLM runtime
(Ollama/LMStudio, via `config.llm.baseUrl`/`config.llm.model` in
[config/env.js](../backend/src/config/env.js)) is wired up. That's the only function
that needs to change later.

[cardService.js](../backend/src/services/cardService.js) adds `generateFromCard`
(validates the card is `type: "plain"`, calls the LLM interface, optionally persists
to `card_generation`) and `listGenerations`. Routes: `POST /:id/generate`,
`GET /:id/generations` in [routes/cards.js](../backend/src/routes/cards.js).

## Frontend

Scaffolded with `npm create vite@latest frontend -- --template react`, plus
`react-router-dom` for client-side routing.

**Build tooling hiccup:** the current `create-vite` template defaults to
"rolldown-vite" (Rolldown bundler instead of classic Rollup). `npm run build` failed
immediately with `Cannot find native binding` for `@rolldown/binding-win32-x64-msvc`.
Root cause: that package requires Node `>=22.12.0`; the dev machine was on `22.11.0`,
and the platform-specific optional dependency silently failed to install. **Fixed by
upgrading Node to 22.12** — no change to the scaffold or bundler was needed. This is
the same *class* of problem as the SQLite driver issue (a native/optional-dependency
binding missing on this Windows setup), but this time the fix was upgrading the
runtime rather than swapping the package.

### API client
[api/client.js](../frontend/src/api/client.js): a small `fetch` wrapper (`get`, `post`,
`put`, `del`) reading `VITE_API_URL` (default `http://localhost:3000/api`), with
per-resource wrapper modules (`api/resources.js`, `api/cards.js`,
`api/knowledgeFields.js`, `api/study.js`) mirroring the backend routes.

### Pages
- **StudyPage** — fetches the weighted due-card queue (optionally filtered by field,
  with an "include subfields" toggle), shows one card at a time, reveals the answer
  for `front_back` cards, and submits easy/medium/hard feedback.
- **CardsPage** — create `plain`/`front_back`/`cloze` cards, pick which resources and
  knowledge fields to attach via checkboxes, and a "Generate (LLM)" button per plain
  card that calls the stub and displays what it returned.
- **ResourcesPage** — create/list resources, plus (added after initial build, per
  user feedback) **inline editing** (the same form doubles as create/edit depending on
  whether a resource is being edited) and **client-side search + type filtering**
  (substring match against title/author/notes/URL, combined with an exact type filter).
- **KnowledgeFieldsPage** — see below; this one went through several iterations.

### Knowledge Fields: from a flat list to an interactive nested-sets diagram
This page had the most back-and-forth, driven directly by user feedback:

1. **First cut:** a flat `<select>`-based form (pick a parent from a dropdown) plus a
   plain nested `<ul>` tree for display. Functional but hard to read, and one-directional
   only — you could make a new field a *child* of an existing one, but not insert a new
   field *above* an existing one (making an existing root field become the new field's
   child).
2. **"Insert above" support:** added a multi-select of existing fields to the creation
   form — whichever ones you check become children of the field you're creating. No
   backend changes needed; it composes the existing `POST /knowledge-fields` +
   `PUT /knowledge-fields/:id` calls, and the backend's existing cycle check keeps it
   safe.
3. **Full redesign as a "nested sets" diagram:** the user asked for something more
   visual — a set/subset diagram or tree, discoverable via right-click (add), drag
   (reparent), and double-click (rename), rather than always-visible dropdown forms.
   Rebuilt using plain HTML5 drag-and-drop (no extra dependency, to avoid another
   native-binding risk):
   - Each field renders as a colored, rounded "bubble" containing its subfields'
     bubbles nested inside — color varies by depth.
   - **Right-click** a bubble: context menu with Add subfield / Rename / Delete.
     Right-click empty canvas: Add (root) field.
   - **Double-click** a bubble's label: inline rename (small input in place, saved on
     Enter/blur).
   - **Drag a bubble into another:** reparents it (`PUT` with the new `parent_id`).
     Dropping on the empty canvas clears its parent (top-level). A client-side check
     (`descendantIdSet`) blocks dropping a field onto one of its own descendants before
     even calling the API, for instant feedback — the backend's cycle check is still
     the real guard.
   - Delete asks for confirmation and explains that subfields become top-level (matches
     the backend's `ON DELETE SET NULL` on `parent_id` — no cascading delete).

### Theming (Light/Dark)
Discovered while testing the context menu: the original CSS declared
`color-scheme: light dark` (Vite's default) but only some elements had explicit colors
set (backgrounds, mostly). Native form controls (buttons, in particular) then followed
the *browser's* dark-mode UA styling for text color while the app's own CSS forced a
white background — producing invisible white-on-white text in the right-click menu,
and low-contrast nav links.

Fixed properly rather than patching individual colors:
- [index.css](../frontend/src/index.css) now defines a full set of CSS custom
  properties (`--bg`, `--text`, `--surface`, `--nav-bg`, `--nav-active-bg`,
  `--field-depth-0..5`, etc.) for light (default on `:root`) and dark (both
  `@media (prefers-color-scheme: dark)` for "follow the OS" and an explicit
  `:root[data-theme="dark"]` override for a manual toggle), and sets `color-scheme`
  to match whichever is active — so native controls never desync from the custom
  palette again.
- Every component (nav, buttons, inputs, selects, the context menu/add-popup, the
  knowledge-field bubbles) was updated to use these tokens instead of hardcoded colors.
- [hooks/useTheme.js](../frontend/src/hooks/useTheme.js) +
  [components/ThemeToggle.jsx](../frontend/src/components/ThemeToggle.jsx): a nav
  button that cycles **System → Light → Dark**, persisted to `localStorage`, applied
  via a `data-theme` attribute on `<html>`.
- **Follow-up bug:** after the token system landed, dark mode still showed
  low-contrast text specifically inside the knowledge-field bubbles. Cause: the bubble
  component set its background via an inline React `style` prop computed from a
  hardcoded JS color array (`DEPTH_COLORS`), left over from before the token system
  existed — inline styles win over CSS classes, so it silently overrode the
  theme-aware `.depth-0..5` CSS rules that were supposed to control that color. Fixed
  by deleting the inline style and hardcoded array, letting the CSS classes (which do
  reference `var(--field-depth-N)`) take over.

## Containers

`docker-compose.yml` (repo root) defines two services. Prepared but **intentionally
not build/run-tested** by the agent — the user tests these themselves.

- **backend:** `backend/Dockerfile`, `node:20-alpine`, installs prod deps, runs
  `node src/server.js` (which runs migrations on startup), SQLite file persisted to a
  named volume.
- **frontend:** `frontend/Dockerfile`, a two-stage build — `node:22-alpine` (the
  Node version floor matters here too, same reason as the local build issue above)
  runs `npm run build`, then `nginx:alpine` serves the static output with a
  `try_files ... /index.html` fallback ([nginx.conf](../frontend/nginx.conf)) so
  client-side routing (react-router) works on a hard refresh. `VITE_API_URL` is a
  **build arg**, not a runtime env var, because Vite bakes `VITE_*` variables in at
  build time — and it points at `http://localhost:3000` (the backend's published host
  port), not the Docker-internal service name, since it's consumed by the user's
  browser, not by another container.

## Status snapshot

All of spec sections 3 (data model), 4 (core flows), and 5 (LLM integration
interface) are implemented on the backend. The frontend covers all four pages
end-to-end against the live API. Not done: an actual LLM behind `callLLM()`, and
container build/run verification (by design — left to the user).
