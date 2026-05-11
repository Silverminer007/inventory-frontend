# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm preview          # Preview production build

pnpm typecheck        # vue-tsc type check
pnpm lint             # ESLint (zero warnings allowed)
pnpm lint:fix         # ESLint with auto-fix
pnpm format           # Prettier write
pnpm format:check     # Prettier check
pnpm quality          # typecheck + lint + format:check (run before committing)

pnpm test:e2e         # Playwright e2e tests (starts dev server automatically)
pnpm test:e2e:ui      # Playwright with interactive UI
pnpm test:e2e:mobile  # Run only the mobile (Pixel 7) project
```

**Package manager: pnpm only.** Never use npm or yarn.

Commits must follow conventional commits: `feat|fix|refactor|style|test|chore|docs|perf`.

## Environment

`.env` sets `NUXT_API_BASE=http://localhost:8080` — the backend URL. In production, set `NUXT_API_BASE` as an environment variable (see `Dockerfile`).

## Architecture

**Nuxt 4 SPA** — SSR is disabled (`ssr: false`). The app is a PWA running entirely in the browser.

### Directory layout

- `app/` — all frontend source (Nuxt 4 convention)
  - `composables/` — business logic
  - `components/ui/` — generic UI primitives (auto-imported, no prefix)
  - `components/forms/` — form components (auto-imported, no prefix)
  - `components/` — feature components
  - `pages/` — routes: `/`, `/containers/[id]`, `/items/[id]`, `/search`, `/scan`, `/settings`, `/print`
  - `types/inventory.ts` — all shared TypeScript types
  - `utils/uuid.ts` — `generateId()` wraps `crypto.randomUUID()`
  - `utils/containerUtils.ts` — container hierarchy helpers
- `server/api/[...path].ts` — Nitro catch-all that proxies every `/api/*` request to `NUXT_API_BASE`
- `tests/` — Playwright e2e tests
  - `fixtures/db.ts` — `seedDatabase()` / `clearDatabase()` helpers using `window.__db`
  - `fixtures/api.ts` — `mockBackend()` intercepts all API routes

### Offline-first with Dexie (IndexedDB)

`useDatabase` (`app/composables/useDatabase.ts`) is a singleton wrapping a Dexie database named `lager-db`. Tables:

| Table           | Key                | Purpose                                                       |
| --------------- | ------------------ | ------------------------------------------------------------- |
| `containers`    | `id` (UUID)        | Cached containers                                             |
| `items`         | `id` (UUID)        | Cached items (`LocalItem` extends `Item` with `enrichedTags`) |
| `images`        | `id` (UUID)        | Cached image metadata                                         |
| `commandQueue`  | `commandId` (UUID) | Outbound command queue                                        |
| `syncMeta`      | `key`              | `lastSyncAt`, `lastServerSequence`                            |
| `pendingImages` | auto-increment     | Blobs awaiting upload                                         |

In DEV mode, `window.__db` exposes the Dexie instance (used by e2e tests).

### Event-sourcing / command flow

All mutations go through `useCommands.executeCommand()`:

1. **Generate UUID** client-side via `generateId()` for new entities
2. **Optimistic update** — write directly to Dexie immediately
3. **Enqueue** as `PENDING` in `commandQueue`
4. **Flush** — if online, `useSync.flushQueue()` POSTs batches of 50 to `POST /api/v1/commands`

Server returns `CommandResultDTO[]` with status `APPLIED | FAILED | CONFLICT`. On `APPLIED`, the server snapshot replaces the optimistic local state. If the server assigned a different ID than the client UUID, the stale optimistic entity is deleted.

Command types: `ITEM_CREATE/UPDATE/DELETE/MOVE`, `CONTAINER_CREATE/UPDATE/DELETE/MOVE`, `IMAGE_UPLOAD/SET_PRIMARY/DELETE`.

### Sync lifecycle

`useSync.bootstrap()` is called once on app mount (in `app/layouts/default.vue`):

- If DB is empty → `initialSync()`: fetches all containers + items, then determines `lastServerSequence`
- If DB has data → `deltaSync()`: fetches `GET /api/v1/commands?since=<lastSyncAt>` and applies them

The service worker plugin (`app/plugins/sw.client.ts`) triggers `flushQueue()` on `window.online` and `deltaSync()` on SW `TRIGGER_DELTA_SYNC` messages.

### Search

`useSearch` builds two Fuse.js indexes (items + containers) from Dexie. The index is module-level (shared singleton). `buildIndex()` is called on layout mount and after mutations via `refreshIndex()`. `highlight()` in the same file generates safe HTML for match highlighting.

### Container hierarchy

Three levels: `ROOM` → `SHELF` → `BOX`. `containerUtils.ts` provides `containerConfig` (labels/icons), `getContainerPath()`, `getBreadcrumb()`, and `getChildType()`.

### API proxy

`server/api/[...path].ts` strips `origin`/`referer` headers and forwards all requests to `${NUXT_API_BASE}/api/${path}`. The frontend always calls relative `/api/v1/...` URLs.

## E2E Testing

Tests use Playwright (Chromium + mobile Pixel 7). The dev server must be running or Playwright starts it automatically.

Pattern for every test:

```ts
test.beforeEach(async ({ page }) => {
  await mockBackend(page) // intercept all API routes
  await page.goto('/')
  await seedDatabase(page) // inject data via window.__db
  await page.reload() // trigger bootstrap with seeded data
})
test.afterEach(async ({ page }) => {
  await clearDatabase(page)
})
```

`mockBackend` returns test fixtures for GET endpoints and echoes commands back as `APPLIED` for POST `/api/v1/commands`.

## Code Quality

- `pnpm quality` must pass clean before merging (typecheck + lint + format:check)
- `eslint-config-prettier` must remain last in `eslint.config.mjs`
- All IDs are `string` (UUID), never `number`
- `vue/no-multiple-template-root` is off (Vue 3 / Teleport)
- Composables have `max-lines-per-function`, `complexity`, and `max-depth` disabled
