# 🚀 Portfolio Analytics Frontend — Detailed Guide

This document describes setup, configuration, architecture, components, testing and operations for the **frontend**.  
For a quick overview and badges, see the root [README.md](./README.md).

---

## Overview

- **Purpose:** Modern React/Vite app for exploring companies, fetching & visualizing analytics, and managing watchlists.
- **UX:** Clear, compact **status messages**; graceful handling of free‑tier and rate‑limit constraints.
- **Integration:** Uses `VITE_API_BASE=/api` and the Vite dev proxy to connect to the .NET backend.

## Key Features

- **🔍 Smart Company Search** — local‑first search, offline popular bundle, external fallback.
- **📊 Real‑time Analytics** — inline KPIs, simple sparkline, charts.
- **🏢 Company Management** — add/remove/track companies with quick actions (Mega‑Cap, Tech Giants, Dow 30, …).
- **🔔 User Feedback** — transient error pills + persistent status lines.
- **📱 Responsive** — desktop & mobile friendly.
- **🧭 Routing** — multi‑page app with React Router.

## Tech Stack

- **React 19.1.1**
- **TypeScript 5.8.3**
- **Vite 7.1.2**
- **React Router 7.9.1**
- **Recharts 3.2.0** (KPI charts)
- **Lightweight Charts 5.0.8** (candles)
- Node ≥ 20

## Project Structure

```
src/
├── pages/
│   ├── Companies.tsx        # company list with search & filters
│   ├── Company.tsx          # detailed company view
│   ├── Home.tsx             # landing
│   ├── Health.tsx           # backend status/health
│   └── About.tsx            # about
│
├── components/
│   ├── NavBar.tsx
│   ├── Notification.tsx
│   ├── ConfirmDialog.tsx
│   ├── CompanyDiscovery.tsx
│   ├── AnalyticsMiniPanel.tsx
│   └── company/
│       ├── CompanyHeader.tsx
│       ├── CompanyKpis.tsx
│       ├── CompanyPriceChart.tsx
│       ├── CompanyCandleChart.tsx
│       └── analytics/
│
├── services/api/
│   ├── client.ts            # HTTP client
│   ├── analytics.ts         # analytics endpoints
│   ├── fundamentals.ts      # fundamentals endpoints
│   └── quotes.ts            # price endpoints
│
├── utils/
│   ├── statusMessages.ts
│   ├── statusMessages.test.ts
│   ├── dateUtils.ts
│   └── …
├── types/
└── context/
```

## Components (highlights)

### CompanyDiscovery

- Three discovery paths: **quick‑add buttons**, **search over offline bundle**, **external fallback**.

### Notification System

- Auto‑dismiss success/error, consistent styling, click to dismiss.

### ConfirmDialog

- Replaces `confirm()` with themed modal; variants: danger/warning/info; backdrop‑to‑cancel.

### AnalyticsMiniPanel

- Inline analytics: KPIs, sparkline, **Get/Save fundamentals**, **Get live price**.

## Environment & Config

Create `.env.development`:

```env
VITE_API_BASE=/api
VITE_APP_TITLE="Portfolio Analytics"
```

Ports:

- **Frontend dev**: `http://localhost:5173`
- **Backend**: `http://localhost:5046` (Swagger at `/swagger`)

## Scripts

```bash
npm run dev          # start Vite dev server
npm run build        # production build
npm run preview      # preview production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run test:status  # status message smoke tests
```

## Status Messages (semantics)

The UI maps responses to **clear categories**:

- `200` → ✔️ Request successful
- `404` → ❌ No data found
- `400` → ⚠️ Bad request
- `402` (or text markers) → ⛔ Free‑tier limit
- `429` (or text markers) → ⏳ Rate limit (e.g., `Daily limit`, `Rate limit (10s)`)
- `5xx` → ⚠️ Server error
  > Embedded `402/429` inside `5xx` are still recognized by text hints.

**Tests**

```bash
npm run test:status
# File: src/utils/statusMessages.test.ts
```

The test simulates cases (200/400/404/402/429/5xx incl. embedded hints) and checks the pill + status line.

## API Integration

- HTTP layer in `src/services/api/*` with minimal client helpers.
- Endpoints:
  - **Analytics**: `/api/analytics/<metric>?symbol=XYZ`
  - **Fundamentals**: `/api/data/*` and `/api/ingest/*` via backend actions
  - **Quotes**: `/api/quotes/latest?symbol=XYZ&take=1`, `/api/quotes/timeseries?...`
- Strategy: **local‑first** in backend + client‑side debouncing to reduce calls (free tier).

## State Management

- Local component state (hooks), route state via React Router.
- Persistence via `localStorage` for small preferences (e.g., pinned symbols).

## Performance

- Route‑level code splitting, memoization, debounced search.
- Lightweight sparkline (pure SVG), minimal re‑renders.

## Browser Support

- Chrome/Edge/Firefox/Safari (latest), and modern mobile browsers.

## Contributing

- Conventional Commits (`feat:`, `fix:`, `docs:`, …)
- Feature branches → PRs

## Known Issues

- Search & ingestion depend on provider free tiers (may hit **rate/free‑tier limits**).
- Some ETFs/firms may have incomplete fundamentals.
- Candles require sufficient history.

## Roadmap

- Dark mode
- Export (CSV/Excel)
- Portfolio tracking & watchlists
- Technical indicators
- Real‑time price updates (WebSocket)
- Mobile app (React Native)

## Docs & Links

- **Backend Swagger:** http://localhost:5046/swagger
- **Backend repository:** https://github.com/rluetken-dev/portfolio-analytics-backend
- **Commit conventions:** https://www.conventionalcommits.org/

## License & Author

- MIT — see `LICENSE`
- Author: rluetken (GitHub: @rluetken-dev)
