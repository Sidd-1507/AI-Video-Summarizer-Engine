# Tech Stack

## Frontend
- React 18 + Vite + TypeScript
- TailwindCSS (styling), shadcn/ui (components)
- Recharts (line/pie/bar charts — matches reference app)
- Mermaid.js (block diagrams as text → SVG, easier for an LLM to emit reliably than raw SVG)
- React Query (server state, polling job status)
- Firebase Auth SDK (Google sign-in)
- react-hot-toast / similar for UX feedback

## Backend
- Node.js 20 + Express + TypeScript
- Mongoose (MongoDB ODM)
- BullMQ + Redis (job queue for long-running generation)
- zod (request + LLM-response schema validation)
- firebase-admin (verify ID tokens server-side)
- Stripe SDK (credits checkout + webhooks)
- `youtube-transcript` (or direct `timedtext` API call) for caption fetch
- LLM: provider-agnostic adapter; reference app uses Gemini (`@google/generative-ai`); adapter also supports OpenAI so it's swappable
- Winston/pino for structured logging
- express-rate-limit + rate-limit-redis for distributed rate limiting
- helmet, cors, express-mongo-sanitize for hardening

## Testing
- Jest + ts-jest / supertest for API tests
- Mocked service boundaries for transcript fetch + LLM calls (no live network calls in CI)
- mongodb-memory-server for isolated DB tests

## Infra / DevOps
- GitHub Actions CI: lint → typecheck → unit tests → build
- Docker for local dev parity (API, worker, mongo, redis via docker-compose)
- Deployment: Vercel (frontend), Render/Fly.io (API + worker), MongoDB Atlas, Upstash Redis

## Security tooling
- `npm audit` / Dependabot in CI
- Secrets via platform env vars (never in repo); `.env.example` committed, `.env` gitignored
- Content sanitization: LLM output is treated as untrusted — rendered as Markdown/Mermaid through a sanitizing renderer (e.g., `rehype-sanitize`), never `dangerouslySetInnerHTML` with raw HTML
