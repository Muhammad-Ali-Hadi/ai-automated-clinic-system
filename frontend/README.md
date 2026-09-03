# Renovia Hospital OS — Frontend

React + TypeScript + Vite single-page app for the Renovia Hospital OS backend.
It mirrors the clinical workflow: **register → appointment → consultation →
laboratory → prescription → pharmacy → billing → follow-up**, plus the
administration surface (doctors, departments, staff, users, inventory,
suppliers, notifications, reports, audit logs).

## Stack

| Concern | Choice |
|---|---|
| Build | Vite 5 |
| UI | React 18, Tailwind CSS 3, lucide-react icons |
| Server state | TanStack Query 5 (cache, dedupe, retry, background refetch) |
| Routing | React Router 6 (route-level code splitting) |
| HTTP | axios with one shared client |
| Charts | Recharts (loaded only on Dashboard / Reports) |

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api -> http://localhost:4000)
```

The backend must be running on `:4000` (see the repo's `backend.md`). The Vite
dev server proxies `/api` to it, so the browser makes same-origin requests and
there is no CORS preflight on the hot path. Override the target with
`VITE_BACKEND_ORIGIN`.

```bash
npm run build      # tsc + vite build -> dist/
npm run preview    # serve the production build
npm run typecheck
```

## Request-flow design

- **One HTTP client** (`src/lib/apiClient.ts`). It attaches the current access
  token per request, and on a `401` runs a **single-flight token refresh** —
  concurrent 401s share one `/auth/refresh` call and are replayed once. A failed
  refresh clears the session and broadcasts `auth:logout`.
- **Normalized errors** (`src/lib/apiError.ts`): every rejection becomes an
  `ApiError` with `status` and `fieldErrors`, so forms can bind Zod validation
  messages inline and mutations can show a toast.
- **Envelope-aware helpers**: `apiGet/apiPost/...` unwrap `{ success, data }`;
  `apiList` normalizes both `data: []` and `data: { data: [], meta }` into a
  single `Paginated<T>` shape.
- **Query keys** are centralized (`src/api/keys.ts`) so mutations invalidate
  consistently. Writes go through `useApiMutation`, which does toast +
  declarative cache invalidation.
- **List screens** keep page/search/filter state in the URL (`useListParams`),
  debounce search input, and use `placeholderData` to avoid flicker on paging.
- **Code splitting**: every route is `React.lazy`; vendor libs and charts are
  separate chunks. Initial JS is ~100 KB gzipped.

## AI Assistant

The **AI Assistant** screen (`/ai`) wires the `src/ai/` Rizocare modules to HTTP
via `POST /api/v1/ai/*`:

- **Conversational** — clinical assistant, AI receptionist (both keep conversation
  memory), knowledge base (RAG ingest + query), smart search, voice transcription.
- **Doctor tools** — discharge summary, prescription draft, lab interpretation,
  lab report analysis.
- **Patient** — plain-language explainer.
- **Operations** — billing assistant, pharmacy assistant, document extraction,
  operational analytics.

It needs a real `OPENAI_API_KEY` in the backend's root `.env` (restart the API
after adding it). The page shows a banner until the key is detected. Conversation
memory falls back to an in-process store when Redis is not running; the knowledge
base additionally needs Qdrant on `QDRANT_URL`.

## Auth / roles

`src/features/auth/AuthProvider.tsx` holds the session; `RequireAuth` guards
routes. The sidebar (`src/components/layout/nav.ts`) shows only the sections a
role may use. `HOSPITAL_ADMIN` sees everything.
