import type { Note } from '../../types/api';
import { NoteCard } from './NoteCard';
import { EmptyState } from '../shared/EmptyState';

export function LibraryGrid({ notes, isLoading }: { notes?: Note[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-ink-100 rounded-md overflow-hidden animate-pulse">
            <div className="h-[104px] bg-ink-100" />
            <div className="p-3.5">
              <div className="h-3 bg-ink-100 rounded mb-2 w-3/4" />
              <div className="h-2 bg-ink-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!notes?.length) {
    return (
      <EmptyState
        title="No notes yet"
        body="Paste your first YouTube link above to get started"
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {notes.map((note) => (
        <NoteCard key={note._id} note={note} />
      ))}
    </div>
  );
}
