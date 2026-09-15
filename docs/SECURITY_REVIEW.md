# Security Review — YouTube → Notes feature

## Threats considered & mitigations

| # | Threat | Mitigation | Where |
|---|---|---|---|
| 1 | SSRF via a crafted "YouTube URL" pointing at internal infra (e.g. `169.254.169.254`, `file://`) | Strict allow-list of hostnames (`youtube.com`, `youtu.be` variants only) + protocol check, done via `URL` parsing (not regex-on-string) so userinfo/host tricks are caught | `utils/youtubeUrl.js`, tests in `youtubeUrl.test.js` |
| 2 | Unauthenticated/forged access to a paid AI feature | Firebase ID token verified server-side on every request; no client-supplied user id is ever trusted | `middleware/auth.js` |
| 3 | Credit race condition (double-spend via concurrent requests) | Atomic `findOneAndUpdate` with a `credits >= amount` condition — DB-level compare-and-swap, not read-then-write | `services/creditService.js`, race test in `creditService.test.js` |
| 4 | Being charged for a failed generation | Reserve-then-refund pattern: credits are deducted up front and unconditionally refunded if any later step throws | `services/youtubeNotesOrchestrator.js` |
| 5 | Abuse / cost blowup from repeated generation calls | Per-user (not per-IP) rate limiting on the expensive endpoint | `middleware/rateLimiter.js` |
| 6 | NoSQL injection via request body (e.g. `{ "youtubeUrl": { "$gt": "" } }`) | `zod` schema requires `youtubeUrl` to be a `string`, rejecting objects outright; `express-mongo-sanitize` as defense-in-depth | `middleware/validateRequest.js`, `app.js` |
| 7 | Oversized payloads / DoS via huge request bodies | `express.json({ limit: '32kb' })` — generation requests are small JSON, not uploads | `app.js` |
| 8 | Pathological/huge caption dumps blowing up memory or LLM cost | Hard cap on transcript length (`MAX_TRANSCRIPT_CHARS`), control-character stripping | `services/youtubeTranscriptService.js` |
| 9 | Prompt-injection / malformed LLM output silently corrupting stored notes | LLM response is required to be strict JSON validated against a `zod` schema before it's ever persisted; one retry then hard failure (with refund) — never persist unvalidated data | `services/llmNotesService.js` |
| 10 | XSS via AI-generated or transcript content rendered in the frontend | Backend does **not** attempt to sanitize for HTML rendering (that's a frontend concern) but never uses `dangerouslySetInnerHTML`-style rendering of raw model output; TECH_STACK.md mandates a sanitizing Markdown/Mermaid renderer on the client | `TECH_STACK.md` |
| 11 | Leaking internal errors (stack traces, DB connection strings, vendor API errors) to clients | Centralized `handleError` maps every known error type to a safe, generic message; unknown errors fall through to a generic 500; a global Express error handler is a second safety net | `controllers/youtubeNotesController.js`, `app.js` |
| 12 | Cross-user data access (reading/editing someone else's note) | Every write is scoped by `ownerId` derived from the verified token, never from the request body; controller additionally asserts `note.ownerId === req.user.id` before responding | `controllers/youtubeNotesController.js` |
| 13 | Secrets in source control | `.env` gitignored, `.env.example` documents required vars with no real values | `.env.example`, `.gitignore` |

## What was extreme-tested
- Malicious/adversarial URLs: `javascript:`, `file://`, host-spoofing via userinfo (`user@internal-ip`), look-alike domains, path traversal, 100k-character garbage strings.
- Malformed/adversarial LLM responses: non-JSON, wrong shape, out-of-range enum values, top-level array instead of object (a classic prompt-injection outcome).
- Concurrency: two simultaneous credit reservations against a balance that can only cover one; two different users generating notes at the same time (no cross-contamination).
- Failure-at-every-stage refund correctness: failure during transcript fetch, failure during LLM generation — both must fully refund and never leave a paid-for-but-empty state.
- Oversized input: 30k+ character transcripts (forces multi-chunk LLM calls) and a pathological 50,000-segment caption dump that must be rejected rather than processed.
- HTTP-layer abuse: missing/invalid auth tokens, NoSQL-injection-shaped JSON bodies, oversized request bodies, rate-limit enforcement, and verifying error responses never leak internal details.

## Known gaps / follow-ups (flagged, not silently ignored)
- The job-queue (BullMQ) execution path described in `ARCHITECTURE.md` is not wired up in this pass — the orchestrator runs synchronously in the HTTP request. For long videos this should move behind the queue before production use to avoid request timeouts.
- Editing (`PATCH /api/notes/:id`) and sticky notes endpoints are designed (`DATABASE_DESIGN.md`) but not implemented in this milestone — see PRD.md §8 for the explicit scope cut.
- Global transcript caching by `videoId` alone (across users) is deferred pending confirmation that caching third-party caption text platform-wide doesn't run into licensing/ToS issues.
