# 🚀 Portfolio Analytics Frontend

![CI/CD](https://img.shields.io/github/actions/workflow/status/rluetken-dev/portfolio-analytics-frontend/ci.yml?branch=main&label=CI%2FCD)
![React](https://img.shields.io/badge/React-19.1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)
![Vite](https://img.shields.io/badge/Vite-7.1.2-purple)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![License](https://img.shields.io/badge/license-MIT-green)

Modern, responsive React/Vite frontend for Portfolio Analytics with clear status messages and API‑conscious UX. 

## ✨ Highlights
- **Smart company search** (local-first → offline bundle → external fallback)
- **Inline analytics** with compact KPIs & charts
- **Company management** (add/remove/discover)
- **User feedback** with concise **status pills**
- **Fast & portable build** (Vite + TS)

## 🚀 Quick Start
```bash
git clone https://github.com/rluetken-dev/portfolio-analytics-frontend.git
cd portfolio-analytics-frontend
npm install

# environment (dev)
cp .env.example .env.development
# Edit .env.development (default API: http://localhost:5179)

npm run dev
# open http://localhost:5173
```

## 🔧 Scripts
```bash
npm run dev          # start Vite dev server
npm run build        # production build
npm run preview      # preview production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run test:status  # status message smoke tests
```

## 🔐 Environment
```env
VITE_API_URL=http://localhost:5179
VITE_APP_TITLE="Portfolio Analytics"
```

## 📁 Structure (short)
```
src/
├─ pages/ (Companies, Company, Home, Health, About)
├─ components/ (NavBar, Notification, ConfirmDialog, CompanyDiscovery, AnalyticsMiniPanel, company/*)
├─ services/api/ (client, analytics, fundamentals, quotes)
├─ utils/ (statusMessages.ts, statusMessages.test.ts, dateUtils.ts …)
└─ types/, context/
```

## ✅ Status Messages (frontend)
Simple, category‑first mapping:
- `200` → ✔️ **Request successful**
- `404` → ❌ **No data found**
- `400` → ⚠️ **Bad request**
- `402` or text hint → ⛔ **Free‑tier limit**
- `429` or text hint → ⏳ **Rate limit** (optional `Daily limit` / `Rate limit (10s)`)
- `5xx` → ⚠️ **Server error**

Tests:
```bash
npm run test:status
# File: src/utils/statusMessages.test.ts
```

## 📖 Documentation
- **Detailed guide**: [README.md](./docs/README.md)
- **Backend Swagger**: http://localhost:5179/swagger
- **Analytics endpoints**: ../backend/docs/analytics-endpoints.md
- **Commit conventions**: https://www.conventionalcommits.org/

---

**Built with ❤️ for the investment community**