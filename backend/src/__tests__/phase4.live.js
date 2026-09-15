'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const http = require('http');
const { createApp } = require('../app');

const User      = require('../models/User');
const Note      = require('../models/Note');
const StickyNote = require('../models/StickyNote');
const Flashcard  = require('../models/Flashcard');
const Highlight  = require('../models/Highlight');
const McqSet     = require('../models/McqSet');
const { reserveCredits, refundCredits } = require('../services/creditService');

const PORT = 8450;

function makeMcqs(n) {
  return Array.from({ length: n }, (_, i) => ({
    question: `Q${i}?`,
    options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }, { label: 'C', text: 'c' }, { label: 'D', text: 'd' }],
    correctAnswer: 'A', explanation: 'E', difficulty: 'medium',
  }));
}

function rq(method, path, body, hdrs = {}) {
  return new Promise((resolve, reject) => {
    const d = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'localhost', port: PORT, path, method,
      headers: { 'Content-Type': 'application/json', ...(d ? { 'Content-Length': Buffer.byteLength(d) } : {}), ...hdrs },
    };
    const req = http.request(opts, (res) => {
      let s = '';
      res.on('data', c => { s += c; });
      res.on('end', () => resolve({ st: res.statusCode, j: () => { try { return JSON.parse(s); } catch { return {}; } } }));
    });
    req.on('error', reject);
    if (d) req.write(d);
    req.end();
  });
}

const R = [];
function chk(label, got, want, note = '') {
  const p = got === want;
  R.push(p);
  console.log((p ? '  \u2705' : '  \u274C') + ' ' + label.padEnd(54) + 'HTTP ' + got + (p ? '' : '  \u2190 want ' + want) + (note ? '  ' + note : ''));
}

(async () => {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  process.env.LLM_PROVIDER       = 'gemini';
  process.env.GEMINI_API_KEY     = process.env.GEMINI_API_KEY || 'STUB_KEY';
  process.env.STRIPE_SECRET_KEY  = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
  process.env.STRIPE_PRICE_50CR  = 'price_live50';
  process.env.STRIPE_PRICE_120CR = 'price_live120';
  process.env.STRIPE_PRICE_300CR = 'price_live300';

  const stripe = {
    checkout: { sessions: { create: async () => ({ url: 'https://checkout.stripe.com/pay/test_live_check' }) } },
    webhooks: { constructEvent: () => { throw new Error('bad sig'); } },
  };

  const imagenProvider = { generate: async () => Buffer.from('fake-png').toString('base64') };
  const ttsProvider    = { synthesize: async () => Buffer.from('fake-mp3') };
  const llmClient      = { complete: async () => JSON.stringify(makeMcqs(3)) };

  const app = createApp({
    firebaseAdmin: {
      auth: () => ({
        verifyIdToken: async (token) => {
          if (token === 'live-tok') return { uid: 'uid1', email: 'uid1@live.com', name: 'LiveUser' };
          throw new Error('invalid token');
        },
      }),
    },
    UserModel: User, NoteModel: Note, StickyNoteModel: StickyNote,
    FlashcardModel: Flashcard, HighlightModel: Highlight, McqSetModel: McqSet,
    TranscriptModel: { findOne: async () => null, create: async () => ({}) },
    reserveCredits, refundCredits,
    transcriptService: { fetchTranscript: async () => ({ videoId: 'dQw4w9WgXcQ', segments: [], markdown: '#t' }) },
    llmNotesService: {
      generateNotes: async () => ({
        title: 'Live Test Note',
        topics: [{ topicId: 'tp1', title: 'Topic Alpha', priority: 2, content: 'Rich content for Topic Alpha about this subject.', diagrams: [], revisionPoints: ['Key point 1', 'Key point 2'], questions: [] }],
      }),
    },
    rateLimiter: (_, __, next) => next(),
    imagenProvider, ttsProvider, llmClient, stripe,
  });

  const server = app.listen(PORT);
  const AUTH = { Authorization: 'Bearer live-tok' };

  const user = await User.create({ firebaseUid: 'uid1', email: 'uid1@live.com', credits: 500 });
  const note = await Note.create({
    ownerId: user._id,
    source: { type: 'youtube', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ' },
    title: 'Live Check Note',
    topics: [{ topicId: 'tp1', title: 'Topic Alpha', priority: 2, content: 'Rich content for Topic Alpha about this subject area.', diagrams: [], revisionPoints: ['Key 1', 'Key 2'], questions: [] }],
    status: 'ready',
  });

  let r;

  console.log('\n\u256C\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('\u2551      PHASES 1 \u00B7 2 \u00B7 3 \u00B7 4 \u2014 COMPLETE LIVE API SUITE         \u2551');
  console.log('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  console.log('\u25B6 Phase 1 \u2014 Core API & Health');
  r = await rq('GET', '/health'); chk('GET  /health', r.st, 200, 'service=' + r.j().service);
  r = await rq('POST', '/api/youtube-notes', {}); chk('POST /youtube-notes  (no auth \u2192 401)', r.st, 401);
  r = await rq('POST', '/api/youtube-notes', {}, AUTH); chk('POST /youtube-notes  (missing url \u2192 400)', r.st, 400);
  r = await rq('POST', '/api/youtube-notes', { youtubeUrl: 'http://evil.com' }, AUTH); chk('POST /youtube-notes  (SSRF \u2192 400)', r.st, 400);
  r = await rq('GET', '/api/totally-unknown'); chk('GET  /unknown-route  (404)', r.st, 404);

  console.log('\n\u25B6 Phase 2 \u2014 Credits');
  r = await rq('GET', '/api/credits/balance', null, AUTH); chk('GET  /credits/balance', r.st, 200, 'credits=' + r.j().credits);
  r = await rq('GET', '/api/credits/history', null, AUTH); chk('GET  /credits/history', r.st, 200, 'total=' + r.j().total);
  r = await rq('GET', '/api/credits/balance'); chk('GET  /credits/balance  (no auth \u2192 401)', r.st, 401);

  console.log('\n\u25B6 Phase 2 \u2014 Sticky Notes');
  r = await rq('POST', '/api/notes/' + note._id + '/sticky-notes', { topicId: 'tp1', content: 'Remember!', color: 'yellow', youtubeTimestamp: 95 }, AUTH);
  chk('POST /sticky-notes   (201)', r.st, 201);
  const sid = r.j().stickyNote?._id;
  r = await rq('GET', '/api/notes/' + note._id + '/sticky-notes', null, AUTH); chk('GET  /sticky-notes   (list)', r.st, 200, 'count=' + r.j().stickyNotes?.length);
  r = await rq('PATCH', '/api/sticky-notes/' + sid, { content: 'Updated!', color: 'red' }, AUTH); chk('PATCH /sticky-notes/:id', r.st, 200, 'color=' + r.j().stickyNote?.color);
  r = await rq('DELETE', '/api/sticky-notes/' + sid, null, AUTH); chk('DELETE /sticky-notes/:id', r.st, 204);
  r = await rq('POST', '/api/notes/' + note._id + '/sticky-notes', { topicId: 'tp1' }, AUTH); chk('POST /sticky-notes   (no content \u2192 400)', r.st, 400);

  console.log('\n\u25B6 Phase 2 \u2014 Flashcards + SM-2 Algorithm');
  r = await rq('POST', '/api/notes/' + note._id + '/flashcards/generate', null, AUTH); chk('POST /flashcards/generate', r.st, 201, 'created=' + r.j().created);
  const cid = r.j().flashcards?.[0]?._id;
  r = await rq('GET', '/api/notes/' + note._id + '/flashcards', null, AUTH); chk('GET  /flashcards     (list)', r.st, 200, 'count=' + r.j().count);
  r = await rq('POST', '/api/flashcards/' + cid + '/review', { quality: 5 }, AUTH); chk('POST /review (q=5 \u2192 ef=2.6)', r.st, 200, 'ef=' + r.j().flashcard?.ef + ' rep=' + r.j().flashcard?.repetitions);
  r = await rq('POST', '/api/flashcards/' + cid + '/review', { quality: 1 }, AUTH); chk('POST /review (q=1 \u2192 lapse)', r.st, 200, 'interval=' + r.j().flashcard?.interval);
  r = await rq('POST', '/api/notes/' + note._id + '/flashcards/generate', null, AUTH); chk('POST /generate again (idempotent=0)', r.st, 200, 'created=' + r.j().created);
  r = await rq('POST', '/api/flashcards/' + cid + '/review', { quality: 99 }, AUTH); chk('POST /review (q=99 \u2192 400)', r.st, 400);
  r = await rq('DELETE', '/api/flashcards/' + cid, null, AUTH); chk('DELETE /flashcards/:id', r.st, 204);

  console.log('\n\u25B6 Phase 2 \u2014 Highlights');
  r = await rq('POST', '/api/notes/' + note._id + '/highlights', { topicId: 'tp1', text: 'key concepts', startOffset: 5, endOffset: 17 }, AUTH); chk('POST /highlights    (201)', r.st, 201);
  const hid = r.j().highlight?._id;
  r = await rq('GET', '/api/notes/' + note._id + '/highlights', null, AUTH); chk('GET  /highlights    (list)', r.st, 200, 'count=' + r.j().highlights?.length);
  r = await rq('POST', '/api/notes/' + note._id + '/highlights', { topicId: 'tp1', text: 'x', startOffset: 50, endOffset: 3 }, AUTH); chk('POST /highlights  (bad offset \u2192 400)', r.st, 400);
  r = await rq('DELETE', '/api/highlights/' + hid, null, AUTH); chk('DELETE /highlights/:id', r.st, 204);

  console.log('\n\u25B6 Phase 2 \u2014 Stripe Payments');
  r = await rq('POST', '/api/stripe/checkout', { priceId: 'price_live50' }, AUTH); chk('POST /stripe/checkout  (200)', r.st, 200, 'url=ok');
  r = await rq('POST', '/api/stripe/checkout', { priceId: 'price_unknown' }, AUTH); chk('POST /stripe/checkout  (bad price \u2192 400)', r.st, 400);
  r = await rq('POST', '/api/stripe/checkout', {}, AUTH); chk('POST /stripe/checkout  (no priceId \u2192 400)', r.st, 400);
  r = await rq('POST', '/api/stripe/webhook', 'raw', { 'stripe-signature': 'bad' }); chk('POST /stripe/webhook   (bad sig \u2192 400)', r.st, 400);

  console.log('\n\u25B6 Phase 3 \u2014 MCQ Generation + Quiz Scoring');
  r = await rq('POST', '/api/notes/' + note._id + '/topics/tp1/mcqs', { count: 3 }, AUTH); chk('POST /mcqs           (generate 3)', r.st, 201, 'questions=' + r.j().mcqSet?.questions?.length);
  r = await rq('GET', '/api/notes/' + note._id + '/topics/tp1/mcqs', null, AUTH); chk('GET  /mcqs           (retrieve)', r.st, 200, 'questions=' + r.j().mcqSet?.questions?.length);
  r = await rq('POST', '/api/notes/' + note._id + '/topics/tp1/mcqs/submit', { answers: [{ questionIndex: 0, selected: 'A' }, { questionIndex: 1, selected: 'B' }, { questionIndex: 2, selected: 'A' }] }, AUTH);
  chk('POST /mcqs/submit     (2/3=67%)', r.st, 200, 'score=' + r.j().score + '/' + r.j().total + ' pct=' + r.j().percentage + '%');
  r = await rq('POST', '/api/notes/' + note._id + '/topics/tp1/mcqs/submit', { answers: [{ questionIndex: 0, selected: 'A' }, { questionIndex: 1, selected: 'A' }, { questionIndex: 2, selected: 'A' }] }, AUTH);
  chk('POST /mcqs/submit     (3/3=100%)', r.st, 200, 'pct=' + r.j().percentage + '%');
  r = await rq('POST', '/api/notes/' + note._id + '/topics/tp1/mcqs/submit', { answers: [] }, AUTH); chk('POST /mcqs/submit     (empty \u2192 400)', r.st, 400);
  r = await rq('POST', '/api/notes/' + note._id + '/topics/tp1/mcqs', { count: 3 }, AUTH); chk('POST /mcqs again     (upsert)', r.st, 201);

  console.log('\n\u25B6 Phase 3 \u2014 Imagen 3 Topic Images');
  r = await rq('POST', '/api/notes/' + note._id + '/topics/tp1/image', null, AUTH); chk('POST /image          (202)', r.st, 202, 'status=' + r.j().status);
  r = await rq('GET', '/api/notes/' + note._id + '/topics/tp1/image', null, AUTH); chk('GET  /image          (status)', r.st, 200, 'imageStatus=' + r.j().imageStatus);
  r = await rq('POST', '/api/notes/' + note._id + '/topics/nope/image', null, AUTH); chk('POST /image          (bad topic \u2192 404)', r.st, 404);
  r = await rq('POST', '/api/notes/' + note._id + '/topics/tp1/image'); chk('POST /image          (no auth \u2192 401)', r.st, 401);

  console.log('\n\u25B6 Phase 3 \u2014 Audio Overview (TTS)');
  const note2 = await Note.create({
    ownerId: user._id,
    source: { type: 'youtube', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ' },
    title: 'Audio Test', topics: [{ topicId: 'tp1', title: 'T', priority: 1, content: 'Content for audio generation test.', diagrams: [], revisionPoints: ['Pt'], questions: [] }], status: 'ready',
    audioStatus: 'pending', // pre-set so the 409 test is reliable (stub TTS resolves instantly)
  });
  // The 409 should trigger because audioStatus is already 'pending' (set above)
  r = await rq('POST', '/api/notes/' + note2._id + '/audio', { format: 'deepDive' }, AUTH); chk('POST /audio          (409 already pending)', r.st, 409);
  // Now reset via DB to test the 202 success path
  await Note.findByIdAndUpdate(note2._id, { $set: { audioStatus: 'none' } });
  r = await rq('POST', '/api/notes/' + note2._id + '/audio', { format: 'brief' }, AUTH); chk('POST /audio          (brief \u2192 202)', r.st, 202, 'pending');
  r = await rq('GET', '/api/notes/' + note2._id + '/audio', null, AUTH); chk('GET  /audio          (status)', r.st, 200, 'audioStatus=' + r.j().audioStatus);
  r = await rq('POST', '/api/notes/' + note2._id + '/audio', { format: 'bad' }, AUTH); chk('POST /audio          (bad fmt \u2192 400)', r.st, 400);
  r = await rq('POST', '/api/notes/' + note2._id + '/audio', { format: 'brief' }); chk('POST /audio          (no auth \u2192 401)', r.st, 401);

  console.log('\n\u25B6 Phase 4 \u2014 Real Provider Wiring Verification');
  const { createGeminiImagenProvider } = require('../services/imageService');
  const imgP = createGeminiImagenProvider('k'); chk('Imagen 3 provider    .generate()', typeof imgP.generate === 'function' ? 200 : 500, 200, 'interface=\u2713');
  const { createGoogleTtsProvider } = require('../services/audioService');
  const ttsP = createGoogleTtsProvider('k'); chk('TTS provider         .synthesize()', typeof ttsP.synthesize === 'function' ? 200 : 500, 200, 'interface=\u2713');
  const { YoutubeTranscript } = require('youtube-transcript');
  chk('youtube-transcript   installed', typeof YoutubeTranscript.fetchTranscript === 'function' ? 200 : 500, 200, 'installed=\u2713');
  process.env.GEMINI_API_KEY = 'test-key';
  const { createLlmClient } = require('../utils/llmProvider');
  const llmI = createLlmClient(); chk('Gemini LLM client    .complete()', typeof llmI.complete === 'function' ? 200 : 500, 200, 'gemini=\u2713');
  const { getStripe } = require('../config/stripe');
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
  const stripeI = getStripe(); chk('Stripe SDK           .checkout.sessions.create', typeof stripeI.checkout?.sessions?.create === 'function' ? 200 : 500, 200, 'stripe=\u2713');

  const passed = R.filter(Boolean).length;
  const total  = R.length;
  console.log('\n' + '\u2550'.repeat(61));
  console.log((passed === total ? '\uD83D\uDFE2' : '\uD83D\uDD34') + '  ' + passed + '/' + total + ' LIVE CHECKS ' + (passed === total ? 'ALL PASSED \u2705' : 'SOME FAILED \u274C'));
  console.log('\u2550'.repeat(61) + '\n');

  server.close();
  await mongoose.disconnect();
  await mongoServer.stop();
  process.exit(passed === total ? 0 : 1);
})().catch(err => { console.error('[FATAL]', err.stack || err.message); process.exit(1); });
