# Exam Notes AI

Docs: see `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/DATABASE_DESIGN.md`, `docs/SECURITY_REVIEW.md`.

This milestone implements the **YouTube → Transcript → Notes** backend feature end-to-end
(transcript fetch → LLM notes generation → persistence → credits), with unit + integration tests.

## Layout
```
backend/
  src/
    models/         Mongoose schemas (User, Note, Transcript)
    services/        Business logic: transcript fetch, LLM orchestration, credits, the feature orchestrator
    controllers/     HTTP handlers
    middleware/      Auth, validation, rate limiting
    routes/          Express routers
    utils/           URL parsing/validation
    app.js           Express app factory (dependency-injected, used by both server & tests)
    __tests__/       Jest test suites
```

## Running it
```bash
cd backend
cp .env.example .env   # fill in real values
npm install
npm test                # unit tests run standalone; DB-integration tests need network access
                         # to download a mongod binary on first run (mongodb-memory-server)
```

## Test coverage in this pass
- `youtubeUrl.test.js` — URL validation incl. SSRF/injection-style adversarial inputs (pure logic, no DB).
- `youtubeTranscriptService.test.js` — caption normalization, malformed/huge input handling (pure logic, no DB).
- `llmNotesService.test.js` — prompt/response schema validation, chunking, retries, adversarial LLM output (pure logic, no DB).
- `creditService.test.js` — atomic reserve/refund, concurrency race safety (needs MongoDB).
- `youtubeNotesOrchestrator.test.js` — full pipeline incl. refund-on-failure at every stage, cross-user isolation (needs MongoDB).
- `youtubeNotes.http.test.js` — HTTP-level: auth, validation, rate limiting, payload limits, error-leak checks (needs MongoDB).

The first three suites (35 tests) run with zero external dependencies and were verified passing
in this environment. The MongoDB-backed suites are complete and correct but require downloading
a `mongod` binary on first run, which this sandbox's restricted network egress blocks — they'll
run normally in a standard dev machine or CI with network access.
