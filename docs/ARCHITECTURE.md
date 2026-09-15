# Architecture — Exam Notes AI

## 1. High-level system

```
┌─────────────┐      HTTPS       ┌────────────────────┐
│  React SPA   │ ───────────────▶│   Express API       │
│ (Vite + TS)  │◀─────────────── │  (Node.js, TS)      │
└─────────────┘      JSON        └─────────┬──────────┘
                                            │
        ┌───────────────────────────────────┼──────────────────────────┐
        │                                    │                          │
        ▼                                    ▼                          ▼
┌───────────────┐                 ┌──────────────────┐        ┌─────────────────┐
│ Firebase Auth │                 │  MongoDB Atlas    │        │  Job Queue       │
│ (Google login)│                 │ (Users, Notes,     │        │ (BullMQ + Redis) │
└───────────────┘                 │  StickyNotes,      │        │ for long-running │
                                   │  Transactions)     │        │ generation jobs  │
                                   └──────────────────┘        └────────┬─────────┘
                                                                          │
                          ┌───────────────────────────────────────────────┼─────────────┐
                          ▼                                               ▼             ▼
                 ┌─────────────────┐                            ┌──────────────┐ ┌─────────────┐
                 │ YouTube Caption  │                            │  LLM Provider │ │ Stripe API   │
                 │ Fetch Service    │                            │ (Gemini/GPT)  │ │ (credits)    │
                 └─────────────────┘                            └──────────────┘ └─────────────┘
```

## 2. Why a job queue for the new feature
Transcript fetch + LLM generation can take 30s–5min (matches the "2-5 minutes" progress bar seen in the reference video). Doing this synchronously in an HTTP request risks timeouts and blocks a server thread. So:
- `POST /api/youtube-notes` validates input, reserves credits, enqueues a `generateYoutubeNotes` job, returns `{ jobId }` immediately.
- Client polls `GET /api/jobs/:jobId` (or subscribes via WebSocket/SSE) for progress (`fetching_transcript → generating_notes → done/failed`).
- Worker process (separate Node process, same codebase) consumes the queue, does the real work, updates job + Note documents.

This mirrors the existing topic-generator's progress bar UX and keeps it consistent between both entry points.

## 3. Request flow — YouTube → Notes (the feature built in this pass)

1. **Client** → `POST /api/youtube-notes` `{ youtubeUrl }`
2. **Controller**: auth middleware (Firebase ID token) → validate URL → rate-limit check → credit pre-check.
3. **Service: TranscriptService.fetchTranscript(videoId)**
   - Calls YouTube's timedtext/caption endpoint (via `youtube-transcript`-style library).
   - Normalizes into `segments[{start, text}]` and a flattened Markdown document.
   - Persists as `Transcript` document (or blob storage reference) — this is the `.md` artifact.
4. **Service: NotesGenerationService.generate(transcriptMarkdown, options)**
   - Chunks text if needed, builds a strict-schema prompt, calls the LLM provider adapter.
   - Validates the LLM's JSON response against a schema (zod); retries once on schema failure.
   - Merges chunks into a single Note payload.
5. **Persistence**: save `Note` (status `ready`), deduct credits (transactional with the reservation from step 2), write an audit `CreditTransaction` row.
6. **Response/polling**: job marked `done`, client fetches the Note by id.
7. **Failure path**: any step throwing → job marked `failed` with a user-safe error message, reserved credits released, nothing charged.

## 4. Module boundaries (backend)

- `services/youtubeTranscriptService.js` — pure I/O: URL parsing + caption fetch + normalization. No LLM/DB knowledge.
- `services/llmNotesService.js` — pure LLM orchestration: prompt building, provider call, response validation/parsing. No YouTube/DB knowledge.
- `controllers/youtubeNotesController.js` — HTTP glue: auth, validation, calls services in order, handles credits, shapes the HTTP response.
- `models/` — Mongoose schemas only.
- `middleware/` — auth, rate limiting, request validation (all reusable across the whole app, not just this feature).

This separation is what makes the unit tests in Section 6 of the SECURITY_REVIEW/tests possible without spinning up real YouTube/LLM calls — each service is mocked at its boundary.

## 5. Editing & Sticky Notes architecture (designed, scaffolded)

- Notes are stored with a `version` integer. `PATCH /api/notes/:id` requires the client to send the `version` it last read; server rejects (409) if it's stale — simple optimistic concurrency, no CRDT needed for a single-editor v1.
- Sticky notes are their **own collection**, referencing `noteId` + an `anchor`. Keeping them separate means:
  - Regenerating/editing note content never destroys sticky notes.
  - They can be fetched independently (lighter payload when just re-rendering the note).
  - Future real-time collab (Yjs/CRDT) can be bolted onto sticky notes first, as a low-risk pilot, before touching core note content.

## 6. Deployment topology
- **Frontend**: Vercel/Netlify (static SPA).
- **API + Worker**: Render/Railway/Fly.io, two processes from one repo (`npm run start:api`, `npm run start:worker`), sharing MongoDB + Redis.
- **Redis**: managed (Upstash/Redis Cloud) — backs BullMQ.
- **MongoDB**: Atlas.
- **Secrets**: environment variables per service; never committed (see TECH_STACK.md → security).
