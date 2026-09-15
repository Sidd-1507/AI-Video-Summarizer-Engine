import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Highlight, Note, StickyNote } from '../types/api';
import { extractVideoId } from './utils';
import {
  guestCreateHighlight,
  guestCreateNote,
  guestCreateStickyNote,
  guestDeleteHighlight,
  guestDeleteNote,
  guestDeleteStickyNote,
  guestGetNote,
  guestListHighlights,
  guestListNotes,
  guestListStickyNotes,
  guestUpdateStickyNote,
  newId,
} from './indexeddb';
import { useGuestStore } from '../store/useGuestStore';

function ok<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
  };
}

function fail(message: string, status: number, locked = false): never {
  if (locked) useGuestStore.getState().openSignInPrompt();
  const err = Object.assign(new Error(message), {
    response: { status, data: { error: message, locked } },
  });
  throw err;
}

function pathOf(config: InternalAxiosRequestConfig): string {
  const raw = `${config.baseURL || ''}${config.url || ''}`;
  try {
    return new URL(raw, 'http://local').pathname;
  } catch {
    return (config.url || '').split('?')[0];
  }
}

function bodyOf(config: InternalAxiosRequestConfig): Record<string, unknown> {
  const data = config.data;
  if (!data) return {};
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return data as Record<string, unknown>;
}

async function fetchYoutubeTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return null;
    const json = await res.json() as { title?: string };
    return json.title || null;
  } catch {
    return null;
  }
}

function previewNote(partial: Partial<Note> & Pick<Note, 'title' | 'source'>): Note {
  const now = new Date().toISOString();
  return {
    _id: newId(),
    ownerId: 'guest',
    status: 'ready',
    version: 1,
    topics: partial.topics ?? [{
      topicId: newId(),
      title: 'Guest preview',
      priority: 3,
      content: 'This note is saved on this device only. Sign in to generate full exam notes, flashcards, a quiz, diagrams, and audio.',
      diagrams: [],
      revisionPoints: ['Sign in to run the AI pipeline'],
      questions: [],
    }],
    audioStatus: 'none',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export async function fulfillGuestRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const method = (config.method || 'get').toUpperCase();
  const path = pathOf(config);
  const body = bodyOf(config);
  const segs = path.split('/').filter(Boolean);

  // /api/notes
  if (method === 'GET' && segs[0] === 'api' && segs[1] === 'notes' && segs.length === 2) {
    return ok(config, { notes: await guestListNotes() });
  }

  // /api/notes/:id/transcript
  if (method === 'GET' && segs[1] === 'notes' && segs[3] === 'transcript') {
    fail('No transcript for guest notes', 404);
  }

  // /api/notes/:id/sticky-notes
  if (segs[1] === 'notes' && segs[3] === 'sticky-notes') {
    const noteId = segs[2];
    if (method === 'GET') return ok(config, { stickyNotes: await guestListStickyNotes(noteId) });
    if (method === 'POST') {
      const sticky: StickyNote = {
        _id: newId(),
        noteId,
        topicId: String(body.topicId || ''),
        content: String(body.content || 'New note…'),
        color: (body.color as StickyNote['color']) || 'yellow',
        youtubeTimestamp: (body.youtubeTimestamp as number | null) ?? null,
        x: Number(body.x ?? 40),
        y: Number(body.y ?? 40),
        w: Number(body.w ?? 220),
        h: Number(body.h ?? 180),
      };
      return ok(config, { stickyNote: await guestCreateStickyNote(sticky) }, 201);
    }
  }

  // /api/sticky-notes/:id
  if (segs[1] === 'sticky-notes' && segs[2]) {
    if (method === 'PATCH') {
      const updated = await guestUpdateStickyNote(segs[2], body as Partial<StickyNote>);
      if (!updated) fail('Sticky note not found', 404);
      return ok(config, { stickyNote: updated });
    }
    if (method === 'DELETE') {
      await guestDeleteStickyNote(segs[2]);
      return ok(config, {}, 204);
    }
  }

  // /api/notes/:id/highlights
  if (segs[1] === 'notes' && segs[3] === 'highlights') {
    const noteId = segs[2];
    if (method === 'GET') return ok(config, { highlights: await guestListHighlights(noteId) });
    if (method === 'POST') {
      const highlight: Highlight = {
        _id: newId(),
        noteId,
        topicId: String(body.topicId || ''),
        text: String(body.text || ''),
        startOffset: Number(body.startOffset || 0),
        endOffset: Number(body.endOffset || 0),
        color: (body.color as Highlight['color']) || 'yellow',
      };
      return ok(config, { highlight: await guestCreateHighlight(highlight) }, 201);
    }
  }

  if (method === 'DELETE' && segs[1] === 'highlights' && segs[2]) {
    await guestDeleteHighlight(segs[2]);
    return ok(config, {}, 204);
  }

  // /api/notes/:id
  if (segs[1] === 'notes' && segs.length === 3) {
    const id = segs[2];
    if (method === 'GET') {
      const note = await guestGetNote(id);
      if (!note) fail('Note not found', 404);
      return ok(config, { note });
    }
    if (method === 'DELETE') {
      await guestDeleteNote(id);
      return ok(config, {}, 204);
    }
  }

  if (method === 'POST' && path.endsWith('/api/youtube-notes')) {
    const existing = await guestListNotes();
    if (existing.length >= 1) fail('Sign in to generate more notes', 403, true);
    const youtubeUrl = String(body.youtubeUrl || '');
    const videoId = extractVideoId(youtubeUrl) || 'guestvideo1';
    const title = (await fetchYoutubeTitle(youtubeUrl)) || 'Saved video';
    const note = previewNote({
      title,
      source: { type: 'youtube', youtubeUrl, videoId },
      topics: [{
        topicId: newId(),
        title,
        priority: 3,
        content: `Guest preview of “${title}”. Sign in to generate full exam-style notes from the transcript.`,
        diagrams: [],
        revisionPoints: ['Sign in for AI notes, flashcards, and a quiz'],
        questions: [],
      }],
    });
    await guestCreateNote(note);
    return ok(config, { note, jobId: 'guest' }, 201);
  }

  if (method === 'POST' && path.endsWith('/api/topic-notes')) {
    const existing = await guestListNotes();
    if (existing.length >= 1) fail('Sign in to generate more notes', 403, true);
    const topic = String(body.topic || 'Untitled');
    const note = previewNote({
      title: topic,
      source: { type: 'topic' },
      examMeta: {
        classLevel: body.classLevel as string | undefined,
        board: body.board as string | undefined,
        examType: body.examType as string | undefined,
      },
      topics: [{
        topicId: newId(),
        title: topic,
        priority: 3,
        content: `Guest preview for “${topic}”. Sign in to generate full exam notes.`,
        diagrams: [],
        revisionPoints: ['Sign in for AI notes'],
        questions: [],
      }],
    });
    await guestCreateNote(note);
    return ok(config, { note, jobId: 'guest' }, 201);
  }

  if (method === 'GET' && segs[1] === 'jobs') {
    return ok(config, { job: { _id: segs[2], status: 'done', type: 'youtube-notes' } });
  }

  if (method === 'GET' && segs[1] === 'notes' && segs[3] === 'audio') {
    return ok(config, { audioStatus: 'none' });
  }
  if (method === 'GET' && segs[1] === 'notes' && segs[3] === 'flashcards') {
    return ok(config, { flashcards: [], count: 0 });
  }
  if (method === 'GET' && segs[1] === 'notes' && segs[5] === 'image') {
    return ok(config, { imageStatus: 'none' });
  }
  if (method === 'GET' && segs[1] === 'notes' && segs[5] === 'mcqs') {
    fail('No MCQs generated yet for this topic', 404);
  }

  if (method === 'GET' && path.endsWith('/api/credits/balance')) {
    return ok(config, { credits: 0 });
  }
  if (method === 'GET' && path.endsWith('/api/credits/history')) {
    return ok(config, { transactions: [], total: 0 });
  }
  if (method === 'GET' && path.endsWith('/api/credits/packages')) {
    return ok(config, { packages: [
      { id: 'price_50', credits: 50, priceUsd: 5 },
      { id: 'price_120', credits: 120, priceUsd: 10 },
      { id: 'price_300', credits: 300, priceUsd: 20 },
    ] });
  }
  if (method === 'GET' && path.endsWith('/api/flashcards/due')) {
    return ok(config, { flashcards: [], count: 0 });
  }

  if (method === 'GET') {
    fail('Not found', 404);
  }

  fail('Sign in to use this study tool', 403, true);
}
