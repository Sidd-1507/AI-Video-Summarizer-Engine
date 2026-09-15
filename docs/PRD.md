# PRD — Exam Notes AI (with YouTube → Notes)

## 1. Analysis of the source project (from transcript)

The reference build is a MERN app called **Exam Notes AI**:
- Google login via Firebase, new users get 100 free credits.
- User enters Topic + Class + Exam board (CBSE etc.) + toggles: revision mode, include diagrams, include charts (line/pie/bar via Recharts).
- Request → backend calls Gemini → generates structured notes with a progress bar (2–5 min).
- Output: sidebar of topics prioritized 1–3 stars, detailed notes per topic, block diagrams, charts, short/long exam-style questions, revision points, PDF export, history of past generations, credit deduction per generation, Stripe checkout to top up credits.

**Gaps / risks in the original build** (worth fixing in our version):
- No visible content sanitization before rendering AI output (XSS risk if notes render raw HTML/markdown).
- Credits appear deducted client-side-adjacent; must be server-authoritative to prevent abuse.
- No mention of idempotency on generation (double-click = double charge) or of rate limiting.
- No test/CI story shown.

## 2. New feature requested (this build's focus)

**YouTube → Transcript → Notes**
1. User pastes a YouTube URL.
2. Backend fetches the video's transcript (captions).
3. Transcript is normalized and stored as a `.md`/`.txt` artifact.
4. That artifact is sent to an LLM with a structured "notes" prompt (same schema as the topic-based generator: summary, key points, priority-starred sections, diagrams-as-mermaid, revision questions).
5. LLM output is parsed into structured JSON, saved as a `Note`, and rendered in the same notes UI as the topic-generator.
6. Notes are **editable**: rich-text edit, plus a **sticky-notes** layer (freeform annotations pinned to a note or a specific block) that persists per user.

## 3. Goals
- Reuse the existing Note data model / UI so YouTube-sourced notes feel identical to topic-generated notes.
- Deterministic, auditable pipeline: raw transcript → cleaned transcript (stored) → LLM structured notes (stored) → editable note.
- Credits/security parity with the existing generator (server-authoritative credit deduction, ownership checks, rate limits).

## 4. Non-goals (v1)
- Live/streaming videos, videos without captions (v1 shows a clear error; auto-transcription via Whisper is a v2 idea).
- Multi-language translation of notes (store transcript language, generate in that language only, for v1).
- Real-time multi-user collaborative editing (single-editor with autosave in v1; collaborative cursors are v2).

## 5. User stories
- As a student, I paste a lecture YouTube link and get exam-style notes without watching the whole video.
- As a student, I can edit any generated note inline and it autosaves.
- As a student, I can drop sticky notes anywhere on a note page (e.g., "ask teacher about this") that only I can see.
- As a student, I'm charged a fixed credit cost only after notes are successfully generated (not on failure).
- As a student, I get a clear error + no credit charge if the video has no captions or is unavailable/private.

## 6. Functional requirements

### 6.1 Transcript ingestion
- Accept a YouTube URL or bare video ID.
- Validate URL, extract `videoId`.
- Fetch caption track (prefer manual captions, fall back to auto-generated).
- Concatenate caption cues into flowing text with timestamps stripped, but keep a `segments[]` array (start time + text) so the UI can later support "jump to timestamp" (v2).
- Persist raw transcript as Markdown in object storage (or DB for MVP) — this is the `.md` artifact requested.

### 6.2 Notes generation
- Chunk transcript if it exceeds the LLM's context budget (~ every 6–8k tokens with overlap).
- Prompt template enforces output schema: `title, summary, topics[{title, priority(1-3), content, diagrams[mermaid], revisionPoints[], questions[{type, text, answer}]}]`.
- Merge per-chunk structured outputs into one Note document (dedupe overlapping topics).
- Persist final Note; deduct credits only on success; log the raw LLM response for audit/debug (redacted of PII).

### 6.3 Editing & sticky notes
- PATCH endpoint for editing any note field (title/topic content), optimistic-lock via `version` field to avoid overwrite races.
- Sticky notes are separate documents: `{ noteId, ownerId, anchor: {topicId?, blockId?, x, y}, color, text, createdAt }` — independent lifecycle from the note content itself so they survive note edits.

### 6.4 Credits & security (parity with existing product)
- Every generation call is server-authoritative: check balance → reserve → generate → commit/deduct or refund on failure.
- Rate limit per user (e.g., 5 generation requests / 10 min) to control cost and abuse.
- Ownership checks: a user can only read/edit/delete their own notes and sticky notes.

## 7. Success metrics
- ≥ 95% of caption-available videos produce a parsed note without manual retry.
- P50 end-to-end generation time < 90s for a 20-minute video.
- 0 cross-user data leaks (verified by authz test suite).

## 8. Out of scope for the "build one feature" milestone
This milestone implements **backend** transcript ingestion + notes generation pipeline (6.1 + 6.2) with tests and security review. Editing UI and sticky notes (6.3) are designed in the architecture/DB docs but scaffolded, not fully built, in this pass — flagged clearly in the code so it's obvious what's next.
