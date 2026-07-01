# EPN Frontend

Vite + React + TypeScript SPA for the EPN Notas Mallas system.

## Stack

- **Vite + React 18 + TypeScript** (strict).
- **HeroUI** for components + **Aceternity UI** (framer-motion) for subtle effects.
- **Tailwind CSS v3** (with the HeroUI plugin).
- **TanStack Query** for server state, **Zustand** for auth/session state.
- **Axios** client with a single-flight silent token-refresh interceptor.
- **React Hook Form + Zod** for typed, validated forms.
- **React Router v6**.

## Architecture

Feature-based, framework-agnostic core:

```
src/
├── config/env.ts            # typed env access
├── lib/
│   ├── api/
│   │   ├── client.ts        # axios instance + auth/refresh/error interceptors
│   │   ├── token-storage.ts # access token in memory, refresh token persisted
│   │   └── types.ts         # API envelope + ApiError
│   ├── cn.ts                # tailwind-merge helper (for Aceternity components)
│   └── query.ts             # QueryClient config
├── stores/auth.store.ts     # session state (bootstrap, setSession, logout)
├── features/                # each feature: api / hooks / schemas / pages
│   ├── auth/  calculators/  dashboard/
├── components/              # ProtectedRoute, aceternity/
├── layouts/                 # AuthLayout, AppLayout
└── router.tsx  App.tsx  main.tsx
```

**Rules:** UI components never call Axios directly — they go through `features/*/api.ts` and hooks.
The API layer is the only place that knows about HTTP.

## Security notes

- Access token lives in memory only; the refresh token is persisted in `localStorage` so sessions
  survive reloads. The backend rotates refresh tokens and detects reuse. For maximum hardening,
  switch the refresh token to an httpOnly Secure cookie issued by the backend and drop the
  localStorage usage in `lib/api/token-storage.ts`.
- The Vite dev server proxies `/api` to `http://localhost:8000`, so no CORS setup is needed in dev.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run lint
```

Copy `.env.example` to `.env` if you need to point at a non-default API base URL.
