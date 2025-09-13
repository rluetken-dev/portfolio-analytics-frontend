# Portfolio Analytics Frontend — Detailed Docs

> This document is the **developer-facing documentation**.  
> The root `README.md` stays short as a GitHub "business card".

## 1) Overview
- **Purpose:** Frontend for the Portfolio Analytics project.
- **Scope:** UI to browse, filter, and analyze fundamentals and computed metrics.
- **Backend:** .NET 8 + EF Core + SQLite (separate repo/service).

## 2) Goals & Non-Goals
- **Goals:** Fast, clean, type-safe UI; simple state management; clear API layer.
- **Non-Goals:** No heavy SSR or CMS; keep dependencies minimal initially.

## 3) Architecture (High-Level)
- **Frontend:** React + TypeScript + Vite
- **Layers:**
  - `components/` – UI building blocks
  - `features/` – domain-oriented screens/logic
  - `services/api/` – HTTP clients & DTOs
  - `lib/` – utilities, helpers
  - `styles/` – global CSS (or Tailwind if added)
- **State:** Start simple with React state; add Zustand/Redux only if needed.

## 4) Tech Stack
- React 18, TypeScript, Vite
- Testing (TBD): Vitest + React Testing Library
- Lint/Format (TBD): ESLint + Prettier
- UI (TBD): Minimal CSS; can add Tailwind or shadcn/ui later

## 5) Environments
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Preview:** `npm run preview`
- **Env Vars (TBD):** e.g. `VITE_API_BASE_URL`

## 6) Scripts (npm)
- `dev` – start Vite dev server
- `build` – production build
- `preview` – preview built app locally
- (TBD) `lint`, `format`, `test`

## 7) Project Structure (Proposed)
```
src/
  app/                # app-level setup (providers, routes)
  components/         # reusable UI components
  features/           # domain-specific modules/pages
  services/
    api/              # API clients, DTOs, request helpers
  lib/                # utilities
  assets/             # static assets
  styles/             # global styles (if used)
```

## 8) API Integration
- **Base URL:** `VITE_API_BASE_URL` (to be set in `.env`)
- **Clients:** `services/api/*`
- **Error Handling:** Centralized helpers; show user-friendly messages

## 9) Coding Standards
- **TypeScript first:** explicit types where helpful
- **Components:** small, focused; prefer composition
- **Commits:** Conventional Commits
- **PRs:** small, descriptive; include screenshots for UI changes

## 10) Git & CI (TBD)
- **Branches:** `main` (protected), feature branches per task
- **CI:** Node setup, install, lint, test, build
- **Quality Gates:** lint/test must pass before merge

## 11) Roadmap (Initial)
- [ ] Setup ESLint + Prettier + basic rules
- [ ] Add simple routing (React Router)
- [ ] Add API base client + health check view
- [ ] Create first feature page (e.g., Companies list)
- [ ] Connect to backend endpoints
- [ ] Add basic tests (Vitest + RTL)
- [ ] CI workflow (GitHub Actions)

## 12) License
MIT
