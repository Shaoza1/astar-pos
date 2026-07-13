# Astar POS

Astar POS is a production-grade, offline-capable point-of-sale system built for food and beverage businesses. It handles the full order lifecycle — from table management and menu browsing to kitchen display, inventory deduction, and end-of-day reporting — while remaining functional even when the internet connection drops.

## Architecture Overview

TypeScript monorepo managed with npm workspaces.

```
astar-pos/
├── frontend/          # React + TypeScript + Vite PWA (POS terminal UI)
├── backend/           # Node.js + NestJS + TypeScript (API server)
├── shared/            # Shared TypeScript types used by both frontend and backend
├── .github/
│   └── workflows/
│       └── ci.yml     # GitHub Actions CI pipeline
├── .husky/            # Pre-commit hooks (lint-staged)
├── docker-compose.yml # Local development with Postgres
├── railway.json       # Railway deployment config
├── .eslintrc.json
├── .prettierrc
├── package.json       # Root workspace manager
└── README.md
```

### Backend Modules

| Module | Responsibility |
|--------|---------------|
| `auth` | PIN + WebAuthn login, JWT issuance, clock-in/out, session tracking |
| `staff` | Staff CRUD, role management, PIN reset |
| `inventory` | Ingredient groups, ingredient CRUD, stock adjustments, stock movements |
| `menu` | Menu groups, menu items, recipes, atomic stock deduction on sale |
| `orders` | Table sessions, orders, order items, kitchen display, void management |
| `payments` | Cash/card/split payments, shift reports, Yoco/Peach integration |
| `reporting` | Variance reports, sales summaries, chart data, delivery reconciliation |
| `common` | Logging middleware, global exception filter, correlation IDs |

## Local Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Git
- Docker + Docker Compose (for the Postgres container)

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd astar-pos

# 2. Install all workspace dependencies from the root
npm install

# 3. Copy the example env file and fill in your values
cp backend/.env.example backend/.env

# 4. Start Postgres via Docker
docker-compose up -d postgres

# 5. Run migrations
for f in backend/src/database/migrations/*.sql; do
  psql $DATABASE_URL -f "$f"
done

# 6. Run seeds (optional — loads Die Blikkasteel menu and sample data)
for f in backend/src/database/seeds/*.sql; do
  psql $DATABASE_URL -f "$f"
done

# 7. Start the backend dev server
npm run start:dev

# 8. Start the frontend dev server (separate terminal)
npm run dev
```

### Docker Local Development

```bash
# Start Postgres + backend together
docker-compose up -d

# Start frontend separately
npm run dev
```

### Environment Variables

All variables live in `backend/.env` (gitignored — never committed).

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Full Postgres connection string | Yes |
| `JWT_SECRET` | Secret used to sign and verify JWT tokens | Yes |
| `PORT` | Port the NestJS server listens on (default 3000) | No |
| `NODE_ENV` | Runtime environment (`development`/`production`) | No |
| `CORS_ORIGIN` | Allowed frontend origin (default `http://localhost:5173`) | No |
| `THROTTLE_TTL` | Rate limit window in ms (default 60000) | No |
| `THROTTLE_LIMIT` | Max requests per window (default 100; auth endpoints: 10) | No |
| `DB_POOL_MAX` | Max DB connections in pool (default 10) | No |
| `DB_POOL_MIN` | Min DB connections in pool (default 2) | No |
| `LOG_LEVEL` | Log verbosity: `debug`/`info`/`warn`/`error` (default `info`) | No |
| `PAYMENT_PROVIDER` | `yoco` or `peach` | No |
| `YOCO_SECRET_KEY` | Yoco API secret key | If using Yoco |
| `PEACH_ACCESS_TOKEN` | Peach Payments access token | If using Peach |
| `PEACH_ENTITY_ID` | Peach Payments entity ID | If using Peach |

## Production Deployment (Railway)

1. Connect your GitHub repository to [Railway](https://railway.app)
2. Add a Postgres plugin to your Railway project
3. Set all required environment variables in the Railway dashboard (see table above)
4. Railway will use `railway.json` to build and deploy automatically on every push to `main`
5. The health check endpoint `GET /api/v1/health` is used by Railway to verify the deployment

### Running Migrations in Production

```bash
# Connect to your production database and run migrations in order
for f in backend/src/database/migrations/*.sql; do
  psql $DATABASE_URL -f "$f"
done
```

## Branch and Commit Conventions

- Never push directly to `main`.
- Always create a feature branch:
  ```bash
  git checkout -b feat/your-feature-name
  ```
- Use [Conventional Commits](https://www.conventionalcommits.org/) format:
  - `feat:` — new feature
  - `fix:` — bug fix
  - `test:` — adding or updating tests
  - `refactor:` — code change that neither fixes a bug nor adds a feature
  - `docs:` — documentation only changes
- Open a PR into `main`, wait for CI to pass, then merge.

## Phase Roadmap

| Phase | Focus |
|-------|-------|
| **Phase 0** | Monorepo foundation — tooling, folder structure, CI pipeline |
| **Phase 1** | Auth, staff management, database schema, shared types |
| **Phase 2** | Menu management, inventory tracking, recipe engine |
| **Phase 3** | Order lifecycle — create, update, close, kitchen display |
| **Phase 4** | PWA offline support — RxDB sync, service worker |
| **Phase 5** | Reporting — sales summaries, inventory usage, staff performance |
| **Phase 6** | Production hardening — rate limiting, logging, monitoring, deployment |
