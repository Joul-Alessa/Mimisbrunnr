# Mimisbrunnr

A personal knowledge & flashcard system inspired by Anki, extended with structured
Resources, a multidisciplinary Knowledge Graph, and LLM-assisted card generation.
See [Docs/Initial-Specs.md](Docs/Initial-Specs.md) for the full requirements.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Project scaffolding | Done |
| 1 | SQLite schema & migrations | Done |
| 2 | Data access layer (models) | Done |
| 3 | REST API — Resources & Cards | Done |
| 4 | Knowledge Graph API | Done |
| 5 | Spaced repetition engine & study flow | Done |
| 6 | LLM integration interface (stubbed) | Done |
| 7 | Containers (backend + frontend) | Files prepared, untested |
| 8 | Frontend (React) | In progress — Study/Cards/Resources/Knowledge Fields pages working against the live API |

## Stack

- **Backend:** Node.js + Express, plain JavaScript.
- **Database:** SQLite via the `sqlite3` npm package (a promise-wrapper lives in
  `backend/src/db/connection.js`). Schema designed to be portable to PostgreSQL later.
  (Note: `better-sqlite3` and Node's built-in `node:sqlite` were tried first; both were
  dropped — see below.)
- **Frontend:** React (Vite), in `frontend/`. Requires **Node >= 22.12** — Vite's
  current toolchain (rolldown) fails to find its native binding below that (see
  below).
- **Containers:** Docker (`docker-compose.yml` at the repo root, one `Dockerfile` per app).
- **LLM:** local runtime (Ollama/LMStudio) via a service-layer interface — not yet
  wired to a real model; see `backend/src/services/llmService.js`.

## Repository layout

```
backend/
  src/
    config/env.js        # env vars (.env via dotenv)
    db/                   # connection, migrations, migration runner
    models/                # one file per table, CRUD only
    services/              # business logic: card creation flow, knowledge
                            # field validation, spaced repetition, study
                            # session selection, LLM interface
    routes/                # Express routers, mounted under /api/*
    app.js                 # Express app (middleware, routes, error handler)
    server.js               # runs migrations, then starts listening
  Dockerfile
  .env.example
frontend/
  src/
    api/            # thin fetch wrappers per resource, base URL from VITE_API_URL
    components/       # shared UI (nav layout)
    pages/              # StudyPage, CardsPage, ResourcesPage, KnowledgeFieldsPage
  Dockerfile
  nginx.conf
  .env.example
docker-compose.yml
Docs/Initial-Specs.md
```

## Running the backend locally

```bash
cd backend
npm install
cp .env.example .env
npm run dev      # nodemon, auto-restarts on changes
# or: npm start
```

Migrations run automatically on server start (`src/server.js`), or manually via:

```bash
node src/db/migrate.js
```

## Running the frontend locally

Requires Node >= 22.12 (see Stack above).

```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL, defaults to http://localhost:3000/api
npm run dev
```

Pages: **Study** (weighted due-card queue with easy/medium/hard feedback), **Cards**
(create plain/front_back/cloze cards, link resources & fields, trigger the LLM stub),
**Resources**, **Knowledge Fields** (nested tree + add form).

## API overview

All endpoints are JSON, mounted under `/api`. Full request/response shapes are best
explored by reading the route files directly (`backend/src/routes/`), but in short:

- `GET/POST/PUT/DELETE /api/resources[/:id]`, `GET /api/resources/:id/cards`
- `GET/POST/PUT/DELETE /api/cards[/:id]` — `POST`/`PUT` accept `resource_ids`,
  `resource_details`, and `field_ids` to run the full card-creation flow in one call
  - `POST/DELETE /api/cards/:id/resources[/:resourceId]`
  - `GET/PUT/POST/DELETE /api/cards/:id/fields[/:fieldId]`
  - `POST /api/cards/:id/generate` `{ mode, save }` — LLM transform (stubbed)
  - `GET /api/cards/:id/generations`
- `GET/POST/PUT/DELETE /api/knowledge-fields[/:id]` — `?tree=1` for a nested tree
  - `GET /api/knowledge-fields/:id/children`
  - `GET /api/knowledge-fields/:id/cards` — `?includeSubfields=1` to recurse
- `GET /api/study/queue` — `?fieldId=&includeSubfields=1&limit=` weighted study queue
- `POST /api/study/review` `{ card_id, status }` — `status` is `easy`/`medium`/`hard`

## Known decisions worth knowing about

- **SQLite driver:** `better-sqlite3`'s native binary segfaults on this project's
  development machine (Windows/Node 22). Node's built-in `node:sqlite` was confirmed
  working but needs the `--experimental-sqlite` flag; the project ended up on the
  mature `sqlite3` package instead (callback-based, wrapped in promises in
  `backend/src/db/connection.js`).
- **Spaced repetition:** tunable parameters live in
  `backend/src/services/spacedRepetition.js` (`SR_CONFIG`) — ease factor bounds,
  interval multipliers, etc. `"hard"` resets the repetition streak (like Anki's
  "again") and shrinks the interval directly rather than scaling by ease_factor.
- **LLM integration:** `backend/src/services/llmService.js` builds real prompts per
  mode (`question`/`cloze`/`example`/`reasoning`/`random`) but `callLLM()` is a stub
  that returns the prompt itself instead of a model response, until a local LLM
  runtime is wired up.
- **Frontend build tooling:** the frontend needs Node >= 22.12. Below that, `npm run
  build` fails with `Cannot find native binding` for `@rolldown/binding-*` — Vite's
  current toolchain (rolldown) silently skips installing its platform-specific
  optional dependency when the Node engine requirement isn't met. Fixed by upgrading
  Node; no change to the scaffold was needed.

## Containers

`docker-compose.yml` (repo root) builds and runs both the backend and the frontend
(served as a static build behind nginx, on port 8080). These files are prepared but
intentionally **not yet build/run-tested** — do that yourself:

```bash
docker compose build
docker compose up
```
