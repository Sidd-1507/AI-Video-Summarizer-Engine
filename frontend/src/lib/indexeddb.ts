/**
 * Guest-mode IndexedDB store. Mirrors enough of the backend schema
 * that the same React Query hooks can run without a network.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Highlight, Note, StickyNote } from '../types/api';

interface NoteWiseDB extends DBSchema {
  notes: {
    key:   string;
    value: Note;
    indexes: { byCreatedAt: string };
  };
  stickyNotes: {
    key:   string;
    value: StickyNote;
    indexes: { byNoteId: string };
  };
  highlights: {
    key:   string;
    value: Highlight;
    indexes: { byNoteId: string };
  };
}

let _db: IDBPDatabase<NoteWiseDB> | null = null;

async function getDB(): Promise<IDBPDatabase<NoteWiseDB>> {
  if (_db) return _db;
  _db = await openDB<NoteWiseDB>('notewise-guest', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const noteStore = db.createObjectStore('notes', { keyPath: '_id' });
        noteStore.createIndex('byCreatedAt', 'createdAt');
        const stickyStore = db.createObjectStore('stickyNotes', { keyPath: '_id' });
        stickyStore.createIndex('byNoteId', 'noteId');
      }
      if (oldVersion < 2 && !db.objectStoreNames.contains('highlights')) {
        const highlightStore = db.createObjectStore('highlights', { keyPath: '_id' });
        highlightStore.createIndex('byNoteId', 'noteId');
      }
    },
  });
  return _db;
}

export async function guestListNotes(): Promise<Note[]> {
  const db    = await getDB();
  const notes = await db.getAllFromIndex('notes', 'byCreatedAt');
  return notes.reverse();
}

export async function guestGetNote(id: string): Promise<Note | undefined> {
  const db = await getDB();
  return db.get('notes', id);
}

export async function guestCreateNote(note: Note): Promise<Note> {
  const db = await getDB();
  await db.put('notes', note);
  return note;
}

export async function guestDeleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}

export async function guestListStickyNotes(noteId: string): Promise<StickyNote[]> {
  const db = await getDB();
  return db.getAllFromIndex('stickyNotes', 'byNoteId', noteId);
}

export async function guestCreateStickyNote(s: StickyNote): Promise<StickyNote> {
  const db = await getDB();
  await db.put('stickyNotes', s);
  return s;
}

export async function guestUpdateStickyNote(id: string, patch: Partial<StickyNote>): Promise<StickyNote | undefined> {
  const db = await getDB();
  const current = await db.get('stickyNotes', id);
  if (!current) return undefined;
  const next = { ...current, ...patch, _id: id };
  await db.put('stickyNotes', next);
  return next;
}

export async function guestDeleteStickyNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('stickyNotes', id);
}

export async function guestListHighlights(noteId: string): Promise<Highlight[]> {
  const db = await getDB();
  return db.getAllFromIndex('highlights', 'byNoteId', noteId);
}

export async function guestCreateHighlight(h: Highlight): Promise<Highlight> {
  const db = await getDB();
  await db.put('highlights', h);
  return h;
}

export async function guestDeleteHighlight(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('highlights', id);
}

export async function guestClearAll(): Promise<void> {
  const db = await getDB();
  await db.clear('notes');
  await db.clear('stickyNotes');
  if (db.objectStoreNames.contains('highlights')) await db.clear('highlights');
}

export function newId(): string {
  return `guest-${crypto.randomUUID()}`;
}
