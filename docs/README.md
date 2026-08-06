# Portfolio Analytics Frontend - Detailed Guide

This document describes the frontend setup, configuration, architecture, main components, testing approach, and known development constraints.

For the short project overview, see the root [README.md](../README.md).

## Overview

The frontend is a React/Vite application for the Portfolio Analytics backend. It provides authenticated user workflows for managing a portfolio, discovering companies, viewing price charts, and reviewing financial analytics.

The application is intended to run locally against the ASP.NET Core backend. In development, API requests are routed through the Vite proxy by using `VITE_API_BASE=/api`.

## Main Features

- user registration and login
- authenticated portfolio pages
- cash balance display and updates
- company search and discovery
- adding and removing portfolio companies
- buy and sell transaction workflows
- company detail pages
- line and candlestick price charts
- financial analytics panels
- status messages for backend, provider, and rate-limit responses

## Tech Stack

- React 19
- TypeScript 5
- Vite 7
- React Router 7
- Recharts
- Lightweight Charts
- ASP.NET Core Web API backend

## Local Setup

Start the backend first.

Expected backend URL:

```text
http://localhost:5046
```

Swagger UI:

```text
http://localhost:5046/swagger
```

Install frontend dependencies:

```powershell
npm install
```

Create a local environment file:

```powershell
Copy-Item .env.example .env.development
```

Expected local configuration:

```env
VITE_API_BASE=/api
```

Run the frontend:

```powershell
npm run dev
```

On Windows, if PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd install
npm.cmd run dev
```

The Vite dev server usually starts on:

```text
http://localhost:5173
```

If that port is already in use, Vite will choose the next available port.

## Project Structure

```text
src/
  components/
    company/
      analytics/
  constants/
  context/
  hooks/
  pages/
  services/
    api/
  styles/
  types/
  utils/
```

## Important Areas

### API Client

The shared API helper is located in:

```text
src/services/api/client.ts
```

It is responsible for:

- building API URLs from `VITE_API_BASE`
- attaching JSON headers
- attaching authentication headers
- handling timeouts
- handling retry behavior for safe requests
- mapping backend error responses
- refreshing authentication when possible

### Authentication

Authentication state is managed through:

```text
src/context/AuthProvider.tsx
src/context/auth-context.ts
src/hooks/useAuth.ts
src/services/api/auth.ts
src/utils/token.ts
```

The access token is stored in frontend memory. Refresh token handling is delegated to the backend through HTTP-only cookies.

### Portfolio View

The main portfolio page is:

```text
src/pages/Companies.tsx
```

It currently contains company loading, search/filter state, portfolio actions, transaction dialog state, analytics panel selection, and chart rendering.

This file is functional, but it is a good future refactoring candidate because it contains multiple responsibilities.

### Company Detail View

The company detail page is:

```text
src/pages/Company.tsx
```

It combines:

- company header
- KPI summary
- price chart
- candlestick chart
- financial analytics panel

### Status Messages

Status mapping logic is located in:

```text
src/utils/statusMessages.ts
```

The frontend groups backend responses into user-facing categories such as:

- request successful
- no data found
- bad request
- free-tier limit
- rate limit
- server error

The status message smoke test is located in:

```text
src/utils/statusMessages.test.ts
```

Run it with:

```powershell
npm run test:status
```

## API Integration

The frontend primarily communicates with these backend areas:

- `/api/User`
- `/api/UserCompany`
- `/api/UserCompanyTransactions`
- `/api/companies`
- `/api/quotes`
- `/api/analytics`
- `/api/data`
- `/api/ingest`

External financial API keys are not configured in the frontend. They belong to the backend.

## Demo And API Key Behavior

The frontend is designed to work with backend-local demo data.

Live provider functionality depends on backend configuration:

- Financial Modeling Prep keys are used by the backend for live company and fundamentals data.
- Alpha Vantage keys are used by the backend for quote and price data.

Without provider keys, the frontend should still be able to use local authentication, portfolio workflows, stored companies, stored prices, and seeded demo data exposed by the backend.

## Screenshots

The main README includes representative frontend screenshots for:

- companies overview
- company detail with seeded demo data
- trade dialog using cached demo prices
- company detail without cached demo data
- login screen

Screenshot files are stored in:

```text
docs/screenshots/
```

See the root [README.md](../README.md#screenshots) for the rendered screenshot section.

## Scripts

```powershell
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run format
npm run test:status
```

## Checks Before Commit

Run these commands before committing frontend changes:

```powershell
npm run lint
npm run build
npm run test:status
```

If PowerShell blocks `npm.ps1`, use the `npm.cmd` equivalent.

## Known Technical Debt

- Some API calls still use direct `fetch` instead of the shared API client.
- Some files still contain development comments and debug logging.
- `src/pages/Companies.tsx` is large and should be split into smaller components and hooks.
- Status message tests are currently implemented as a small script instead of a full test runner setup.
- Some UI styling is implemented inline and should eventually be consolidated.

## Portfolio Readiness Notes

Before publishing screenshots or a new release, verify:

- fresh clone setup works
- backend starts without external API keys
- frontend can register a new user
- seeded/demo data can be displayed
- portfolio actions work with local backend data
- charts render without live provider calls where local data is available
- `npm run lint`, `npm run build`, and `npm run test:status` pass locally

## Related Projects

Backend repository:

[portfolio-analytics-backend](https://github.com/rluetken-dev/portfolio-analytics-backend)

## Notes

This project is a portfolio and training project focused on React, TypeScript, API integration, authentication flows, financial dashboards, and frontend state handling.
