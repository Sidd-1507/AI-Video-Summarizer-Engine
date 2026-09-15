import { useNavigate } from 'react-router-dom';
import { useDueFlashcards } from '../hooks/useDueFlashcards';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { relativeDate } from '../lib/utils';
import { useGuestStore } from '../store/useGuestStore';

export default function QueuePage() {
  const navigate = useNavigate();
  const isGuest = useGuestStore((s) => s.isGuest);
  const openSignIn = useGuestStore((s) => s.openSignInPrompt);
  const { data: cards, isLoading } = useDueFlashcards();

  if (isGuest) {
    return (
      <div className="px-10 py-16">
        <EmptyState title="Flashcard queue is locked" body="Sign in to review due cards across all of your notes." />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openSignIn}
            className="bg-ink-900 text-white px-5 py-2.5 rounded-md text-meta font-semibold"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-10 py-11">
      <p className="text-meta text-ink-500 mb-6">
        Cards due today, across every note.
      </p>
      {isLoading ? (
        <LoadingSpinner className="py-20" />
      ) : !cards?.length ? (
        <EmptyState title="All caught up" body="No flashcards are due right now. Generate a deck from a note to start a queue." />
      ) : (
        <div className="space-y-2 max-w-2xl">
          {cards.map((card) => (
            <button
              key={card._id}
              type="button"
              onClick={() => navigate(`/notes/${card.noteId}?tab=flashcards`)}
              className="w-full text-left border border-ink-100 rounded-md px-4 py-3 hover:border-ink-200 bg-paper"
            >
              <p className="text-meta font-semibold text-ink-900 mb-1">{card.front}</p>
              <p className="text-caption text-ink-400">Due {relativeDate(card.nextReviewDate)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
