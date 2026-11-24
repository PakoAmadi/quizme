# quizme

A learning platform built on quizzes: nested topics, tests with 4 answer options, foreign-language vocabularies, and statistics with charts.

An npm-workspaces monorepo:

```
quizme/
├── apps/
│   ├── api/              @app/api     — backend: Node 24 + TypeScript, no framework, no ORM
│   └── web/              @app/web     — frontend: Angular + Tailwind (not created yet)
├── packages/
│   └── shared/           @app/shared  — Zod schemas, types and constants shared by front and back
├── db/migrations/        SQL migrations
├── docker-compose.yml    Postgres for development
└── tsconfig.base.json    shared TypeScript settings
```

## Requirements

- **Node.js 24+** (runs `.ts` natively and supports `--env-file-if-exists`)
- **Docker** for Postgres, or your own Postgres 15+

## Quick start

Run every command from the `quizme/` root.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start Postgres:

   ```bash
   docker compose up -d
   ```

3. Create the backend env file:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

4. Apply migrations:

   ```bash
   npm run migrate -w @app/api
   ```

5. Start the API in dev mode (restarts on changes):

   ```bash
   npm run dev:api
   ```

   Check: `curl http://localhost:3000/api/health` → `{"status":"ok"}`

### First admin

Register through the API, then promote the user:

```bash
npm run set-role -w @app/api -- you@example.com admin
```

## Commands

| Command (from the root) | What it does |
|---|---|
| `npm run dev:api` | API with auto-restart |
| `npm run typecheck` | Type-check every package |
| `npm test` | Run tests in every package |
| `npm run migrate -w @app/api` | Apply new migrations |
| `npm run set-role -w @app/api -- <email> <admin\|user>` | Change a user's role |

Add a dependency to a specific package from the root too: `npm i <package> -w @app/api`.

## Environment variables (`apps/api/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API port |
| `NODE_ENV` | `development` | In `production`, cookies get the `Secure` flag and `PG_PASSWORD` is required |
| `PG_HOST`, `PG_PORT` | `localhost`, `5432` | Postgres address |
| `PG_USER`, `PG_PASSWORD`, `PG_DB_NAME` | `app`, `app`, `quizme` | Match `docker-compose.yml` |
| `SESSION_TTL_SECONDS` | `2592000` (30 days) | Session lifetime |

Only `apps/api/src/infrastructure/config/config.ts` reads `process.env`; a test enforces this.

## API

| Method | Path | Protection |
|---|---|---|
| GET | `/api/health` | — |
| GET | `/api/auth/csrf` | Issues the CSRF cookie |
| POST | `/api/auth/register` | CSRF, 5 requests/min per IP |
| POST | `/api/auth/login` | CSRF, 10 requests/min per IP |
| POST | `/api/auth/logout` | CSRF |
| GET | `/api/auth/me` | Session |

Errors always have the same shape:

```json
{ "error": "Validation failed", "code": "VALIDATION_ERROR", "details": { "email": "Invalid email format" } }
```

Clients should branch on `code`, not on the `error` text.

## Things to know

### TypeScript without a build step

Node 24 strips types from `.ts` files at startup, so `tsc` is used only for checking (`npm run typecheck`). This brings a few rules (enforced by `erasableSyntaxOnly`):

- no `enum`, `namespace` or constructor parameter properties (`constructor(private x)`); use `as const` objects and union types instead of `enum`;
- relative imports include the extension: `import { x } from './file.ts'`;
- type-only imports use `import type`.

### Backend architecture

```
domain  <-  application  <-  interfaces/http
                 ^
           infrastructure
```

- `domain`: domain errors and rules; depends on nothing.
- `application`: use cases and **ports** (interfaces for repositories and services).
- `infrastructure`: port implementations: Postgres, scrypt, config.
- `interfaces/http`: router, stages, controllers, presenters.
- `container.ts`: the only place where everything is wired together.

`test/architecture.test.ts` enforces the dependency direction.

### Request handling: `pipe` and stages

A route is a chain of stages. Each stage can add data to the context (`ctx`) or send the response itself:

```ts
router.post('/api/auth/login', pipe(csrfStage, loginLimit, loginBody, c.auth.login));
// a protected admin route:
router.post('/api/admin/x', pipe(csrfStage, authStage, requireRole('admin'), handler));
```

`pipe` is typed: a stage won't compile unless an earlier stage provides the data it needs (for example, `requireRole` without `authStage`).

Create generic stages such as `validateBody(schema)` in a separate constant **before** `pipe(...)`; otherwise TypeScript can't infer the types.

### Authentication

- **Sessions** stored in Postgres. The `sid` cookie (httpOnly, SameSite=Lax) holds a random token; the database stores only its SHA-256 hash.
- The role is read from `users` on every request, so role changes and logouts take effect immediately.
- **CSRF** uses the double-submit pattern: the `XSRF-TOKEN` cookie plus the `X-XSRF-TOKEN` header. These are Angular `HttpClient`'s default names, so the frontend needs no configuration; it only has to call `GET /api/auth/csrf` on startup.
- Every state-changing route starts with `csrfStage`.
- JWT support (`HmacTokenService`, `bearerTokenStrategy`) is already written but not wired in. To enable it, add the strategy to `makeAuthStage([...])` in `container.ts`.

### Database

- No ORM: the `pg` driver with plain SQL, **parameters only** (`$1, $2`), never string concatenation.
- `bigint` comes back as `number` (configured in `db.ts`); `numeric` comes back as a string.
- Transactions: `db.transaction(async (tx) => { ... })`.
- Migrations are `db/migrations/NNN_name.sql` files, applied once each, in file-name order. **Never edit** an applied migration; create a new one.

### Validation

Schemas live in `packages/shared` (Zod 4) and are used by both the backend (`validateBody`) and the frontend. Types are inferred from the schemas: `type LoginInput = z.output<typeof LoginInput>`.

## Current limitations

- The rate limiter keeps its state in memory, so it only works with a single server instance.
- Sessions have a fixed lifetime with no sliding renewal, and expired sessions are not yet deleted from the database.
- Behind a reverse proxy (nginx), the rate limiter sees the proxy's IP; `X-Forwarded-For` support is still needed.
- The frontend (`apps/web`) doesn't exist yet, and the database schema only has `users` and `sessions`.
