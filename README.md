# Portfolio Analytics Frontend

[![CI/CD](https://github.com/rluetken-dev/portfolio-analytics-frontend/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rluetken-dev/portfolio-analytics-frontend/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19.1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)
![Vite](https://img.shields.io/badge/Vite-7.1.2-purple)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)

React/Vite frontend for the Portfolio Analytics backend.

The application provides a browser-based UI for user authentication, portfolio management, company discovery, stock charts, financial analytics, and local demo workflows.

## Current Status

The frontend is in active development and currently supports:

- user registration and login
- authenticated portfolio views
- cash balance display and updates
- company search and discovery
- adding and removing portfolio companies
- buy and sell transaction workflows
- company detail pages
- price charts and candlestick charts
- financial analytics panels
- status messages for backend and provider responses

## Tech Stack

- React 19
- TypeScript 5
- Vite 7
- React Router 7
- Recharts
- Lightweight Charts
- ASP.NET Core Web API backend

## Backend Dependency

This frontend requires the Portfolio Analytics backend to be running locally.

Backend repository:

[portfolio-analytics-backend](https://github.com/rluetken-dev/portfolio-analytics-backend)

Default backend URL:

```text
http://localhost:5046
```

Swagger UI:

```text
http://localhost:5046/swagger
```

## Environment

The frontend uses the Vite dev proxy for local API calls.

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env.development
```

Default configuration:

```env
VITE_API_BASE=/api
```

External financial API keys are configured in the backend, not in the frontend.

## Run The Application

Start the backend API first.

Then install dependencies and run the frontend:

```powershell
npm install
npm run dev
```

If PowerShell blocks `npm.ps1` on Windows, use:

```powershell
npm.cmd install
npm.cmd run dev
```

The Vite dev server usually starts on:

```text
http://localhost:5173
```

If the port is already in use, Vite will choose the next available port.

## Build

```powershell
npm run build
```

## Tests And Checks

```powershell
npm run lint
npm run test:status
```

## Demo And API Key Behavior

The frontend is designed to work with the backend's local demo data.

External provider keys are only required when the backend performs live data ingestion from external financial data providers. Without keys, the app can still support local authentication, portfolio workflows, and database-backed demo views.

## Project Structure

```text
src/
  components/
  context/
  hooks/
  pages/
  services/api/
  styles/
  types/
  utils/
```

## Documentation

- [Detailed frontend guide](./docs/README.md)
- [Backend repository](https://github.com/rluetken-dev/portfolio-analytics-backend)
- [Commit conventions](./docs/COMMITS.md)

## Notes

This project is a portfolio and training project focused on React, TypeScript, API integration, authentication flows, financial dashboards, and frontend state handling.
