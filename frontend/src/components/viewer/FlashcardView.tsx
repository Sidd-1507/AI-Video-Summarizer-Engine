import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useFlashcards, useGenerateFlashcards, useReviewFlashcard } from '../../hooks/useFlashcards';
import { cn } from '../../lib/utils';
import { isDue } from '../../lib/sm2';
import { useGuestStore } from '../../store/useGuestStore';
import { LoadingSpinner } from '../shared/LoadingSpinner';

const GRADE_BUTTONS = [
  { label: 'Again', quality: 1, color: 'border-bad' },
  { label: 'Hard',  quality: 3, color: 'border-warn' },
  { label: 'Good',  quality: 4, color: 'border-accent' },
  { label: 'Easy',  quality: 5, color: 'border-good' },
];

export function FlashcardView({ noteId, topicName }: { noteId: string; topicName?: string }) {
  const { data: cards = [], isLoading } = useFlashcards(noteId);
  const generateCards = useGenerateFlashcards(noteId);
  const reviewCard    = useReviewFlashcard(noteId);
  const incrementStreak = useGuestStore((s) => s.incrementStreak);
  const streakCount = useGuestStore((s) => s.streakCount);
  const openSignIn = useGuestStore((s) => s.openSignInPrompt);
  const reduceMotion = useReducedMotion();

  const dueCards = cards.filter(isDue);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [showStreak, setShowStreak] = useState(false);

  const current = dueCards[idx];

  async function handleGrade(quality: number) {
    if (!current) return;
    await reviewCard.mutateAsync({ cardId: current._id, quality });
    setFlipped(false);
    if (idx + 1 >= dueCards.length) {
      incrementStreak();
      setDone(true);
      setShowStreak(true);
    } else {
      setIdx((i) => i + 1);
    }
  }

  if (isLoading) return <LoadingSpinner className="flex-1" />;

  if (!cards.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-ink-200" aria-hidden>
          <rect x="10" y="8" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="12" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="2"/>
        </svg>
        <p className="text-meta text-ink-500">No flashcards yet</p>
        <button
          type="button"
          onClick={() => generateCards.mutate(undefined, {
            onError: (err) => {
              if ((err as { response?: { data?: { locked?: boolean } } })?.response?.data?.locked) openSignIn();
            },
          })}
          disabled={generateCards.isPending}
          className="bg-ink-900 text-white px-5 py-2.5 rounded-md text-meta font-semibold hover:bg-black transition-colors disabled:opacity-50"
        >
          {generateCards.isPending ? 'Generating…' : 'Generate Flashcards'}
        </button>
      </div>
    );
  }

  if (!dueCards.length || done) {
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-h2 text-ink-900">All caught up</p>
          <p className="text-meta text-ink-500">
            Come back tomorrow for {cards.length} cards.
          </p>
        </div>
        {showStreak && (
          <StreakDialog count={streakCount} onClose={() => setShowStreak(false)} />
        )}
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center py-14 px-8">
      <div className="w-full max-w-[460px] flex justify-between text-caption text-ink-500 mb-11">
        <span>Card {idx + 1} of {dueCards.length}{topicName ? ` · ${topicName}` : ''}</span>
        <span>{streakCount > 0 ? `${streakCount} day streak` : 'Start a streak'}</span>
      </div>

      <div className="relative w-[460px] h-[250px] mb-9" style={{ perspective: '1000px' }}>
        <div className="absolute inset-0 border border-ink-100 rounded-lg bg-paper" style={{ transform: 'translateY(16px) scale(0.96)', opacity: 0.3 }} />
        <div className="absolute inset-0 border border-ink-100 rounded-lg bg-paper" style={{ transform: 'translateY(8px) scale(0.98)', opacity: 0.6 }} />

        <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          {reduceMotion ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={flipped ? 'back' : 'front'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 bg-paper border border-ink-100 rounded-lg shadow-2 flex flex-col items-center justify-center text-center px-9 cursor-pointer"
                onClick={() => !flipped && setFlipped(true)}
              >
                <p className={flipped ? 'text-body text-ink-700 leading-relaxed max-w-[40ch]' : 'text-[1.15rem] font-semibold text-ink-900 leading-snug max-w-[36ch]'}>
                  {flipped ? current.back : current.front}
                </p>
                {!flipped && <span className="absolute bottom-4 text-caption text-ink-400">Tap to reveal answer</span>}
              </motion.div>
            </AnimatePresence>
          ) : (
            <>
              <motion.button
                type="button"
                className="absolute inset-0 bg-paper border border-ink-100 rounded-lg shadow-2 flex flex-col items-center justify-center text-center px-9"
                style={{ backfaceVisibility: 'hidden' }}
                animate={{ rotateY: flipped ? -180 : 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                onClick={() => setFlipped(true)}
              >
                <p className="text-[1.15rem] font-semibold text-ink-900 leading-snug max-w-[36ch]">{current.front}</p>
                <span className="absolute bottom-4 text-caption text-ink-400">Tap to reveal answer</span>
              </motion.button>
              <motion.div
                className="absolute inset-0 bg-paper border border-ink-100 rounded-lg shadow-2 flex flex-col items-center justify-center text-center px-9"
                style={{ backfaceVisibility: 'hidden' }}
                initial={{ rotateY: 180 }}
                animate={{ rotateY: flipped ? 0 : 180 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              >
                <p className="text-body text-ink-700 leading-relaxed max-w-[40ch]">{current.back}</p>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {flipped && (
        <div className="flex gap-2 w-[460px]">
          {GRADE_BUTTONS.map(({ label, quality, color }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleGrade(quality)}
              className={cn(
                'flex-1 py-2.5 rounded-sm text-caption font-semibold text-ink-700 bg-paper border border-ink-200 border-b-2 hover:bg-ink-100 transition-colors',
                color
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StreakDialog({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40">
      <div className="w-[320px] bg-paper rounded-lg border border-ink-100 shadow-2 p-6 text-center">
        <p className="text-caption text-ink-400 mb-1">Session complete</p>
        <p className="text-h1 font-[650] text-ink-900 mb-2">{count}</p>
        <p className="text-meta text-ink-500 mb-5">day streak</p>
        <button
          type="button"
          onClick={onClose}
          className="bg-ink-900 text-white px-5 py-2 rounded-sm text-meta font-semibold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
