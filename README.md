# Astar POS

Astar POS is a production-grade, offline-capable point-of-sale system built for food and beverage businesses. It is designed to handle the full order lifecycle — from table management and menu browsing to kitchen display, inventory deduction, and end-of-day reporting — while remaining functional even when the internet connection drops.

## Architecture Overview

The project is a TypeScript monorepo managed with npm workspaces. The `frontend` is a React + Vite PWA that runs on the POS terminal. The `backend` is a NestJS REST API that persists data and enforces business rules. The `shared` package contains TypeScript types consumed by both, ensuring the contract between client and server is always in sync.

```
astar-pos/
├── frontend/          # React + TypeScript + Vite PWA (POS terminal UI)
├── backend/           # Node.js + NestJS + TypeScript (API server)
├── shared/            # Shared TypeScript types used by both frontend and backend
├── .github/
│   └── workflows/
│       └── ci.yml     # GitHub Actions CI pipeline
├── .husky/            # Pre-commit hooks (lint-staged)
├── .eslintrc.json
├── .prettierrc
├── package.json       # Root workspace manager
└── README.md
```

## Local Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Git

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd astar-pos

# 2. Install all workspace dependencies from the root
npm install

# 3. Copy the example env file and fill in your values (see table below)
cp backend/.env.example backend/.env

# 4. Start the frontend dev server
npm run dev

# 5. Start the backend dev server (separate terminal)
npm run start:dev
```

### Environment Variables

All variables live in `backend/.env` (gitignored — never committed).

| Variable       | Description                                      | Required |
|----------------|--------------------------------------------------|----------|
| `DATABASE_URL` | Full connection string for the Postgres database | Yes      |
| `JWT_SECRET`   | Secret used to sign and verify JWT tokens        | Yes      |
| `PORT`         | Port the NestJS server listens on (default 3000) | No       |
| `NODE_ENV`     | Runtime environment (`development`/`production`) | No       |

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
