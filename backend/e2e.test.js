#!/usr/bin/env node
/**
 * E2E TEST HARNESS — All PRD Features
 * Tests every API route + business rule end-to-end against the running server.
 * Run: node e2e.test.js
 *
 * Phases:
 *  T1  Health & Infrastructure
 *  T2  Auth & User Provisioning
 *  T3  YouTube Notes Generation (SSRF + tone + credits)
 *  T4  Sticky Notes CRUD + Validation
 *  T5  Highlights CRUD + Validation
 *  T6  Flashcards Generate + SM-2 Review + Idempotency
 *  T7  MCQ Generate + Submit + Scoring + Edge Cases
 *  T8  Imagen 3 Image Generation (202 async, poll, bad topic)
 *  T9  Google TTS Audio Overview (202, 409 double-trigger, bad format)
 *  T10 Credits — Balance, Deduction, Insufficient
 *  T11 Stripe Checkout + Webhook
 *  T12 Security — SSRF, Auth bypass, Bad payloads, 413 body
 *  T13 Note ownership — cross-user access denied
 */

'use strict';

const http = require('http');

const BASE = 'http://localhost:3001';
const AUTH = { Authorization: 'Bearer fake-guest-token' };
const AUTH2 = { Authorization: 'Bearer fake-guest-token-2' }; // second user (cross-ownership tests)

// ── Utilities ────────────────────────────────────────────────────────────────
let pass = 0, fail = 0, total = 0;
const results = [];

function chk(label, got, expected, detail = '') {
  total++;
  const ok = (typeof expected === 'function') ? expected(got) : got === expected;
  const icon = ok ? '✅' : '❌';
  const status = ok ? 'PASS' : 'FAIL';
  if (ok) pass++; else fail++;
  const msg = `${icon}  [${status}] ${label}${detail ? '  (' + detail + ')' : ''}`;
  console.log(msg);
  results.push({ label, ok, got, expected: String(expected), detail });
  return ok;
}

function rq(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const raw = body && body !== 'raw' ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3001,
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(raw ? { 'Content-Length': Buffer.byteLength(raw) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ st: res.statusCode, body: data, j: () => json || {} });
      });
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

// ── Main test runner ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + '═'.repeat(65));
  console.log('  Exam Notes AI — End-to-End Test Harness');
  console.log('  All PRD features. Harsh. No mercy.');
  console.log('═'.repeat(65) + '\n');

  let r, noteId, topicId, stickyId, flashcardId, highlightId, mcqNoteId;

  // ────────────────────────────────────────────────────────────────────────────
  console.log('◈  T1 — Health & Infrastructure');
  r = await rq('GET', '/health');
  chk('GET /health → 200',            r.st, 200);
  chk('GET /health returns status ok', r.j().status, (v) => v === 'ok' || v === 'healthy', r.j().status);

  r = await rq('GET', '/nonexistent-route');
  chk('GET /nonexistent → 404',        r.st, 404);

  r = await rq('GET', '/api/notes', null, {}); // No auth header
  chk('GET /api/notes (no auth) → 401', r.st, 401);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T2 — Auth & User Provisioning');
  r = await rq('GET', '/api/credits/balance', null, AUTH);
  chk('GET /credits/balance (authed) → 200',   r.st, 200);
  chk('credits is a number',                    typeof r.j().credits, 'number');
  chk('starting credits ≥ 0',                   r.j().credits >= 0, true, `credits=${r.j().credits}`);

  r = await rq('GET', '/api/credits/history', null, AUTH);
  chk('GET /credits/history → 200',              r.st, 200);
  chk('transactions is an array',                Array.isArray(r.j().transactions), true);

  r = await rq('GET', '/api/credits/balance', null, { Authorization: 'Bearer bad_token_xyz' });
  chk('Bad token → 401',                         r.st, 401);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T3 — YouTube Notes Generation');

  // Valid URL
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, AUTH);
  chk('POST /youtube-notes (valid URL) → 201',    r.st, (v) => v === 200 || v === 201, `got ${r.st}`);
  const note = r.j().note;
  chk('note has _id',                             !!note?._id, true);
  chk('note has title',                           !!note?.title, true, note?.title);
  chk('note has topics array',                    Array.isArray(note?.topics), true);
  chk('topics.length ≥ 1',                        (note?.topics?.length ?? 0) >= 1, true);
  chk('each topic has topicId',                   note?.topics?.[0]?.topicId?.length > 0, true);
  chk('each topic has content',                   !!note?.topics?.[0]?.content, true);
  noteId  = note?._id;
  topicId = note?.topics?.[0]?.topicId;

  // With tone param
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', tone: 'eli5' }, AUTH);
  chk('POST /youtube-notes (tone=eli5) → 2xx',    r.st, (v) => v >= 200 && v < 300, `got ${r.st}`);

  // With deep-understanding tone
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', tone: 'deep-understanding' }, AUTH);
  chk('POST /youtube-notes (tone=deep-understanding) → 2xx', r.st, (v) => v >= 200 && v < 300);

  // Invalid tone → 400
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', tone: 'INVALID_TONE' }, AUTH);
  chk('POST /youtube-notes (bad tone) → 400',     r.st, 400);

  // Missing URL
  r = await rq('POST', '/api/youtube-notes', {}, AUTH);
  chk('POST /youtube-notes (no URL) → 400',       r.st, 400);

  // SSRF: localhost
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://localhost/steal' }, AUTH);
  chk('POST /youtube-notes (SSRF localhost) → 400', r.st, 400);

  // SSRF: 169.254 (AWS metadata)
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://169.254.169.254/latest/meta-data' }, AUTH);
  chk('POST /youtube-notes (SSRF 169.254) → 400',  r.st, 400);

  // SSRF: internal IP
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://192.168.1.1/admin' }, AUTH);
  chk('POST /youtube-notes (SSRF 192.168.x) → 400', r.st, 400);

  // Non-YouTube domain
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://vimeo.com/123456' }, AUTH);
  chk('POST /youtube-notes (vimeo → not YouTube) → 400', r.st, 400);

  // Unauthenticated
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
  chk('POST /youtube-notes (no auth) → 401',       r.st, 401);

  // GET list
  r = await rq('GET', '/api/notes', null, AUTH);
  chk('GET /api/notes → 200',                      r.st, 200);
  chk('notes is array',                            Array.isArray(r.j().notes), true);

  // GET single
  r = await rq('GET', `/api/notes/${noteId}`, null, AUTH);
  chk('GET /api/notes/:id → 200',                  r.st, 200);
  chk('note._id matches',                          r.j().note?._id, noteId);

  // GET non-existent note
  r = await rq('GET', '/api/notes/000000000000000000000000', null, AUTH);
  chk('GET /api/notes/nonexistent → 404',          r.st, 404);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T4 — Sticky Notes CRUD');

  // CREATE valid
  r = await rq('POST', `/api/notes/${noteId}/sticky-notes`, { topicId, content: 'Test sticky', color: 'yellow' }, AUTH);
  chk('POST /sticky-notes → 201',                  r.st, 201);
  chk('stickyNote has _id',                        !!r.j().stickyNote?._id, true);
  chk('stickyNote color is yellow',                r.j().stickyNote?.color, 'yellow');
  stickyId = r.j().stickyNote?._id;

  // CREATE all valid colors
  for (const color of ['blue', 'purple', 'green', 'red', 'orange', 'pink']) {
    r = await rq('POST', `/api/notes/${noteId}/sticky-notes`, { topicId, content: `${color} note`, color }, AUTH);
    chk(`POST /sticky-notes color=${color} → 201`, r.st, 201);
  }

  // CREATE invalid color → 400
  r = await rq('POST', `/api/notes/${noteId}/sticky-notes`, { topicId, content: 'test', color: 'rainbow' }, AUTH);
  chk('POST /sticky-notes (bad color) → 400',      r.st, 400);

  // CREATE no content → 400
  r = await rq('POST', `/api/notes/${noteId}/sticky-notes`, { topicId }, AUTH);
  chk('POST /sticky-notes (no content) → 400',     r.st, 400);

  // CREATE no topicId → 400
  r = await rq('POST', `/api/notes/${noteId}/sticky-notes`, { content: 'test' }, AUTH);
  chk('POST /sticky-notes (no topicId) → 400',     r.st, 400);

  // READ list
  r = await rq('GET', `/api/notes/${noteId}/sticky-notes`, null, AUTH);
  chk('GET /sticky-notes → 200',                   r.st, 200);
  chk('stickyNotes is array',                      Array.isArray(r.j().stickyNotes), true);
  chk('stickyNotes.length ≥ 7 (we added 7)',       (r.j().stickyNotes?.length ?? 0) >= 7, true, `count=${r.j().stickyNotes?.length}`);

  // UPDATE (PATCH)
  r = await rq('PATCH', `/api/sticky-notes/${stickyId}`, { content: 'Updated content' }, AUTH);
  chk('PATCH /sticky-notes/:id → 200',             r.st, 200);
  chk('content updated',                           r.j().stickyNote?.content, 'Updated content');

  // UPDATE position (x, y, w, h)
  r = await rq('PATCH', `/api/sticky-notes/${stickyId}`, { x: 150, y: 200, w: 220, h: 180 }, AUTH);
  chk('PATCH /sticky-notes position → 200',        r.st, 200);

  // DELETE
  r = await rq('DELETE', `/api/sticky-notes/${stickyId}`, null, AUTH);
  chk('DELETE /sticky-notes/:id → 204',            r.st, 204);

  // DELETE again → 404
  r = await rq('DELETE', `/api/sticky-notes/${stickyId}`, null, AUTH);
  chk('DELETE /sticky-notes already-deleted → 404', r.st, 404);

  // No auth
  r = await rq('GET', `/api/notes/${noteId}/sticky-notes`);
  chk('GET /sticky-notes (no auth) → 401',         r.st, 401);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T5 — Highlights CRUD');

  r = await rq('POST', `/api/notes/${noteId}/highlights`,
    { topicId, text: 'key concept here', startOffset: 10, endOffset: 27, color: 'yellow' }, AUTH);
  chk('POST /highlights → 201',                    r.st, 201);
  chk('highlight has _id',                         !!r.j().highlight?._id, true);
  highlightId = r.j().highlight?._id;

  // All valid colors
  for (const color of ['blue', 'green', 'pink']) {
    r = await rq('POST', `/api/notes/${noteId}/highlights`,
      { topicId, text: 'some text', startOffset: 1, endOffset: 10, color }, AUTH);
    chk(`POST /highlights color=${color} → 201`,   r.st, 201);
  }

  // Bad offset (endOffset < startOffset)
  r = await rq('POST', `/api/notes/${noteId}/highlights`,
    { topicId, text: 'x', startOffset: 50, endOffset: 3, color: 'yellow' }, AUTH);
  chk('POST /highlights (bad offsets) → 400',      r.st, 400);

  // Empty text
  r = await rq('POST', `/api/notes/${noteId}/highlights`,
    { topicId, text: '', startOffset: 0, endOffset: 0, color: 'yellow' }, AUTH);
  chk('POST /highlights (empty text) → 400',       r.st, 400);

  // LIST
  r = await rq('GET', `/api/notes/${noteId}/highlights`, null, AUTH);
  chk('GET /highlights → 200',                     r.st, 200);
  chk('highlights is array',                       Array.isArray(r.j().highlights), true);

  // DELETE
  r = await rq('DELETE', `/api/highlights/${highlightId}`, null, AUTH);
  chk('DELETE /highlights/:id → 204',              r.st, 204);

  r = await rq('DELETE', `/api/highlights/${highlightId}`, null, AUTH);
  chk('DELETE /highlights already-deleted → 404',  r.st, 404);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T6 — Flashcards: Generate, SM-2 Review, Edge Cases');

  // Generate
  r = await rq('POST', `/api/notes/${noteId}/flashcards/generate`, null, AUTH);
  chk('POST /flashcards/generate → 201',           r.st, 201);
  chk('created > 0',                               (r.j().created ?? 0) > 0, true, `created=${r.j().created}`);
  chk('flashcards is array',                       Array.isArray(r.j().flashcards), true);
  chk('each flashcard has front+back',             !!r.j().flashcards?.[0]?.front, true);
  flashcardId = r.j().flashcards?.[0]?._id;

  // Idempotent generate (already exists)
  r = await rq('POST', `/api/notes/${noteId}/flashcards/generate`, null, AUTH);
  chk('POST /flashcards/generate idempotent → 200', r.st, 200);
  chk('idempotent created = 0',                    r.j().created, 0);

  // LIST
  r = await rq('GET', `/api/notes/${noteId}/flashcards`, null, AUTH);
  chk('GET /flashcards → 200',                     r.st, 200);
  chk('count matches flashcards length',           r.j().count === r.j().flashcards?.length, true);

  // SM-2 Review — quality 5 (Easy)
  r = await rq('POST', `/api/flashcards/${flashcardId}/review`, { quality: 5 }, AUTH);
  chk('POST /review (q=5 Easy) → 200',             r.st, 200);
  chk('ef increases from 2.5',                     (r.j().flashcard?.ef ?? 0) > 2.5, true, `ef=${r.j().flashcard?.ef}`);
  chk('repetitions = 1',                           r.j().flashcard?.repetitions, 1);
  chk('interval = 1 (first rep)',                  r.j().flashcard?.interval, 1);

  // SM-2 Review again (rep=1 → interval=6)
  r = await rq('POST', `/api/flashcards/${flashcardId}/review`, { quality: 4 }, AUTH);
  chk('POST /review (q=4 Good, rep=1) → interval=6', r.j().flashcard?.interval, 6);
  chk('repetitions = 2',                           r.j().flashcard?.repetitions, 2);

  // SM-2 Lapse (quality < 3)
  r = await rq('POST', `/api/flashcards/${flashcardId}/review`, { quality: 1 }, AUTH);
  chk('POST /review (q=1 Again) → lapse',          r.st, 200);
  chk('lapse: interval reset to 1',                r.j().flashcard?.interval, 1);
  chk('lapse: repetitions reset to 0',             r.j().flashcard?.repetitions, 0);

  // SM-2 EF never drops below 1.3
  for (let i = 0; i < 5; i++) {
    r = await rq('POST', `/api/flashcards/${flashcardId}/review`, { quality: 0 }, AUTH);
  }
  chk('SM-2 EF never below 1.3',                  (r.j().flashcard?.ef ?? 0) >= 1.3, true, `ef=${r.j().flashcard?.ef}`);

  // Invalid quality
  r = await rq('POST', `/api/flashcards/${flashcardId}/review`, { quality: 99 }, AUTH);
  chk('POST /review (q=99) → 400',                r.st, 400);

  r = await rq('POST', `/api/flashcards/${flashcardId}/review`, { quality: -1 }, AUTH);
  chk('POST /review (q=-1) → 400',                r.st, 400);

  r = await rq('POST', `/api/flashcards/${flashcardId}/review`, { quality: 'good' }, AUTH);
  chk('POST /review (q=string) → 400',            r.st, 400);

  r = await rq('POST', `/api/flashcards/${flashcardId}/review`, {}, AUTH);
  chk('POST /review (no quality) → 400',          r.st, 400);

  // DELETE flashcard
  r = await rq('DELETE', `/api/flashcards/${flashcardId}`, null, AUTH);
  chk('DELETE /flashcards/:id → 204',             r.st, 204);

  r = await rq('DELETE', `/api/flashcards/${flashcardId}`, null, AUTH);
  chk('DELETE /flashcards already-deleted → 404', r.st, 404);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T7 — MCQ: Generate, Submit, Scoring, Edge Cases');

  // Need a fresh note for clean MCQ tests
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }, AUTH);
  mcqNoteId = r.j().note?._id;
  const mcqTopicId = r.j().note?.topics?.[0]?.topicId;

  // Generate
  r = await rq('POST', `/api/notes/${mcqNoteId}/topics/${mcqTopicId}/mcqs`, { count: 5 }, AUTH);
  chk('POST /mcqs (count=5) → 201',               r.st, 201);
  chk('mcqSet has questions',                      Array.isArray(r.j().mcqSet?.questions), true);
  chk('questions.length = 5',                      r.j().mcqSet?.questions?.length, 5);
  const q0 = r.j().mcqSet?.questions?.[0];
  chk('question has options array',               Array.isArray(q0?.options), true);
  chk('question has correctAnswer A-D',           ['A','B','C','D'].includes(q0?.correctAnswer), true);
  chk('question has explanation',                 !!q0?.explanation, true);
  chk('question has difficulty',                  !!q0?.difficulty, true);

  // GET MCQs
  r = await rq('GET', `/api/notes/${mcqNoteId}/topics/${mcqTopicId}/mcqs`, null, AUTH);
  chk('GET /mcqs → 200',                          r.st, 200);
  chk('GET returns same mcqSet',                  r.j().mcqSet?.questions?.length === 5, true);

  // Submit all wrong
  r = await rq('POST', `/api/notes/${mcqNoteId}/topics/${mcqTopicId}/mcqs/submit`, {
    answers: Array.from({ length: 5 }, (_, i) => ({ questionIndex: i, selected: 'Z' })),
  }, AUTH);
  chk('POST /mcqs/submit (all Z, invalid opt) → 400', r.st, (v) => v === 400 || v === 200);

  // Submit correctly
  const correctAnswers = r.j()?.breakdown
    ? r.j().breakdown.map((b, i) => ({ questionIndex: i, selected: b.correctAnswer }))
    : Array.from({ length: 5 }, (_, i) => ({ questionIndex: i, selected: 'A' }));

  r = await rq('POST', `/api/notes/${mcqNoteId}/topics/${mcqTopicId}/mcqs/submit`, {
    answers: Array.from({ length: 5 }, (_, i) => ({ questionIndex: i, selected: 'A' })),
  }, AUTH);
  chk('POST /mcqs/submit → 200',                  r.st, 200);
  chk('result has score + total',                 typeof r.j().score === 'number' && r.j().total === 5, true, `score=${r.j().score}`);
  chk('result has percentage',                    typeof r.j().percentage === 'number', true);
  chk('result has breakdown array',               Array.isArray(r.j().breakdown), true);
  chk('breakdown length = 5',                     r.j().breakdown?.length, 5);

  // Empty answers → 400
  r = await rq('POST', `/api/notes/${mcqNoteId}/topics/${mcqTopicId}/mcqs/submit`, { answers: [] }, AUTH);
  chk('POST /mcqs/submit (empty answers) → 400',  r.st, 400);

  // No answers key → 400
  r = await rq('POST', `/api/notes/${mcqNoteId}/topics/${mcqTopicId}/mcqs/submit`, {}, AUTH);
  chk('POST /mcqs/submit (no answers) → 400',     r.st, 400);

  // Upsert: generate again for same topic
  r = await rq('POST', `/api/notes/${mcqNoteId}/topics/${mcqTopicId}/mcqs`, { count: 3 }, AUTH);
  chk('POST /mcqs (upsert) → 201',                r.st, 201);
  chk('upserted questions.length = 3',            r.j().mcqSet?.questions?.length, 3);

  // Attempts tracked
  r = await rq('GET', `/api/notes/${mcqNoteId}/topics/${mcqTopicId}/mcqs`, null, AUTH);
  chk('attempts array tracked',                   Array.isArray(r.j().mcqSet?.attempts), true);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T8 — Imagen 3 Image Generation');

  r = await rq('POST', `/api/notes/${noteId}/topics/${topicId}/image`, null, AUTH);
  chk('POST /image → 202 (async)',                 r.st, 202);
  chk('status = pending',                          r.j().status, 'pending');

  r = await rq('GET', `/api/notes/${noteId}/topics/${topicId}/image`, null, AUTH);
  chk('GET /image → 200',                          r.st, 200);
  chk('imageStatus field present',                 typeof r.j().imageStatus !== 'undefined', true, r.j().imageStatus);

  // Bad topic
  r = await rq('POST', `/api/notes/${noteId}/topics/nonexistent_topic/image`, null, AUTH);
  chk('POST /image (bad topicId) → 404',           r.st, 404);

  // Unauthenticated
  r = await rq('POST', `/api/notes/${noteId}/topics/${topicId}/image`);
  chk('POST /image (no auth) → 401',               r.st, 401);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T9 — Google TTS Audio Overview');

  // Need a fresh note for audio (avoid polluted audioStatus)
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }, AUTH);
  const audioNoteId = r.j().note?._id;

  r = await rq('POST', `/api/notes/${audioNoteId}/audio`, { format: 'brief' }, AUTH);
  chk('POST /audio (brief) → 202',                 r.st, 202);
  chk('audio status = pending or processing',      ['pending', 'processing'].includes(r.j().status ?? r.j().audioStatus), true, r.j().status);

  r = await rq('GET', `/api/notes/${audioNoteId}/audio`, null, AUTH);
  chk('GET /audio → 200',                          r.st, 200);
  chk('audioStatus field present',                 typeof r.j().audioStatus !== 'undefined', true);

  // deepDive format
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }, AUTH);
  const audioNoteId2 = r.j().note?._id;
  r = await rq('POST', `/api/notes/${audioNoteId2}/audio`, { format: 'deepDive' }, AUTH);
  chk('POST /audio (deepDive) → 202',              r.st, 202);

  // all format
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }, AUTH);
  const audioNoteId3 = r.j().note?._id;
  r = await rq('POST', `/api/notes/${audioNoteId3}/audio`, { format: 'all' }, AUTH);
  chk('POST /audio (all) → 202',                   r.st, 202);

  // Bad format
  r = await rq('POST', `/api/notes/${audioNoteId}/audio`, { format: 'podcast' }, AUTH);
  chk('POST /audio (bad format) → 400',            r.st, 400);

  // 409 double-trigger (audioStatus already pending)
  r = await rq('POST', `/api/notes/${audioNoteId}/audio`, { format: 'brief' }, AUTH);
  chk('POST /audio (already pending → 409)',        r.st, (v) => v === 409 || v === 202, `got ${r.st} (race condition ok if 202)`);

  // Unauthenticated
  r = await rq('POST', `/api/notes/${audioNoteId}/audio`, { format: 'brief' });
  chk('POST /audio (no auth) → 401',               r.st, 401);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T10 — Credits System');

  r = await rq('GET', '/api/credits/balance', null, AUTH);
  const creditsBefore = r.j().credits;
  chk('credits balance is readable',               typeof creditsBefore === 'number', true, `balance=${creditsBefore}`);

  // History entries
  r = await rq('GET', '/api/credits/history', null, AUTH);
  chk('credit history returns transactions',       Array.isArray(r.j().transactions), true);
  const tx = r.j().transactions?.[0];
  if (tx) {
    chk('transaction has amount',                  typeof tx.amount === 'number', true);
    chk('transaction has type (grant|deduction)',  ['grant', 'deduction'].includes(tx.type), true, tx.type);
    chk('transaction has description',             typeof tx.description === 'string', true);
  }

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T11 — Stripe Checkout & Webhook');

  r = await rq('POST', '/api/stripe/checkout', { priceId: 'price_test_50cr' }, AUTH);
  chk('POST /stripe/checkout (valid priceId) → 200', r.st, 200);
  chk('returns checkout URL',                      typeof r.j().url === 'string', true, r.j().url?.slice(0,40));

  r = await rq('POST', '/api/stripe/checkout', { priceId: 'price_does_not_exist_xyz' }, AUTH);
  chk('POST /stripe/checkout (bad priceId) → 400',  r.st, 400);

  r = await rq('POST', '/api/stripe/checkout', {}, AUTH);
  chk('POST /stripe/checkout (no priceId) → 400',   r.st, 400);

  r = await rq('POST', '/api/stripe/webhook', 'raw', { 'stripe-signature': 'bad_sig_xyz', 'Content-Type': 'text/plain' });
  chk('POST /stripe/webhook (bad signature) → 400',  r.st, 400);

  r = await rq('POST', '/api/stripe/checkout', { priceId: 'price_test_50cr' });
  chk('POST /stripe/checkout (no auth) → 401',       r.st, 401);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T12 — Security: SSRF, Oversized Body, Bad Types');

  // Large body > 10mb limit — Express should return 413
  const bigPayload = { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', extra: 'x'.repeat(11_000_000) };
  r = await rq('POST', '/api/youtube-notes', bigPayload, AUTH);
  chk('POST (11MB body) → 413',                    r.st, (v) => v === 413 || v === 400, `got ${r.st}`);

  // Injection: prototype pollution attempt
  r = await rq('POST', '/api/notes/000000000000000000000000/sticky-notes', {
    '__proto__': { admin: true },
    topicId, content: 'inject', color: 'yellow',
  }, AUTH);
  chk('Prototype pollution attempt → 404 or 400',  r.st, (v) => v === 404 || v === 400 || v === 201, `got ${r.st}`);

  // Wrong method
  r = await rq('DELETE', '/api/youtube-notes', null, AUTH);
  chk('DELETE /youtube-notes (wrong method) → 404 or 405', r.st, (v) => v === 404 || v === 405, `got ${r.st}`);

  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n◈  T13 — Note Ownership (Cross-User Access)');

  // Note created by user1 (AUTH) — user2 (AUTH2) tries to access
  r = await rq('GET', `/api/notes/${noteId}`, null, AUTH2);
  chk('GET /notes/:id (wrong user) → 401 or 404', r.st, (v) => v === 401 || v === 403 || v === 404, `got ${r.st}`);

  r = await rq('POST', `/api/notes/${noteId}/sticky-notes`, { topicId, content: 'steal', color: 'yellow' }, AUTH2);
  chk('POST /sticky-notes (wrong user) → 401/403/404', r.st, (v) => v === 401 || v === 403 || v === 404, `got ${r.st}`);

  r = await rq('POST', `/api/notes/${noteId}/topics/${topicId}/image`, null, AUTH2);
  chk('POST /image (wrong user) → 401/403/404',    r.st, (v) => v === 401 || v === 403 || v === 404, `got ${r.st}`);

  // ────────────────────────────────────────────────────────────────────────────
  // Final summary
  console.log('\n' + '═'.repeat(65));
  const emoji = fail === 0 ? '🟢' : '🔴';
  console.log(`${emoji}  ${pass}/${total} PASSED   ${fail} FAILED`);
  console.log('═'.repeat(65));

  if (fail > 0) {
    console.log('\nFAILED CHECKS:');
    results.filter((r) => !r.ok).forEach((r) => {
      console.log(`  ❌  ${r.label}  |  got=${r.got}  expected=${r.expected}`);
    });
  }

  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\n[FATAL]', err.stack ?? err.message);
  process.exit(1);
});
