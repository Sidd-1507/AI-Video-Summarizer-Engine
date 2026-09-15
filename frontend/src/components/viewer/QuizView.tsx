import { useMemo, useState } from 'react';
import { useMcqs, useGenerateMcqs, useSubmitMcqs } from '../../hooks/useMcqs';
import { cn } from '../../lib/utils';
import type { QuizSubmitResult, Topic } from '../../types/api';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useGuestStore } from '../../store/useGuestStore';

export function QuizView({
  noteId,
  topicId,
  topics,
  onTopicChange,
}: {
  noteId: string;
  topicId: string;
  topics: Topic[];
  onTopicChange: (id: string) => void;
}) {
  const { data: mcqSet, isLoading, isError } = useMcqs(noteId, topicId);
  const generateMcqs = useGenerateMcqs(noteId, topicId);
  const submitMcqs   = useSubmitMcqs(noteId, topicId);
  const openSignIn = useGuestStore((s) => s.openSignInPrompt);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');

  const missedIndices = useMemo(() => {
    if (!result) return new Set<number>();
    return new Set(result.breakdown.filter((b) => !b.correct).map((b) => b.questionIndex));
  }, [result]);

  async function handleSubmit() {
    const payload = Object.entries(answers).map(([i, selected]) => ({
      questionIndex: Number(i),
      selected,
    }));
    const res = await submitMcqs.mutateAsync(payload);
    setResult(res);
    setFilter('all');
  }

  if (isLoading) return <LoadingSpinner className="flex-1" />;

  if (isError || !mcqSet) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-ink-200" aria-hidden>
          <circle cx="28" cy="28" r="18" stroke="currentColor" strokeWidth="2"/>
          <path d="M28 18v12M28 36h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <p className="text-meta text-ink-500">No quiz generated yet</p>
        <button
          type="button"
          onClick={() => generateMcqs.mutate(undefined, {
            onError: (err) => {
              if ((err as { response?: { data?: { locked?: boolean } } })?.response?.data?.locked) openSignIn();
            },
          })}
          disabled={generateMcqs.isPending}
          className="bg-ink-900 text-white px-5 py-2.5 rounded-md text-meta font-semibold hover:bg-black transition-colors disabled:opacity-50"
        >
          {generateMcqs.isPending ? 'Generating…' : 'Generate Quiz for this topic'}
        </button>
      </div>
    );
  }

  const questions = filter === 'missed' && result
    ? mcqSet.questions.filter((_, i) => missedIndices.has(i))
    : mcqSet.questions;

  return (
    <div className="flex-1 px-14 py-11 max-w-[720px] overflow-y-auto">
      {topics.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {topics.map((t) => (
            <button
              key={t.topicId}
              type="button"
              onClick={() => {
                onTopicChange(t.topicId);
                setResult(null);
                setAnswers({});
              }}
              className={cn(
                'text-caption px-3 py-1 rounded-pill border',
                t.topicId === topicId
                  ? 'border-ink-900 text-ink-900 font-semibold'
                  : 'border-ink-200 text-ink-500'
              )}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {result ? (
        <>
          <div className="mb-6 p-4 bg-ink-100 rounded-md flex items-center justify-between">
            <div>
              <p className="text-meta font-semibold text-ink-900">
                {result.score} / {result.total} correct — {result.percentage}%
              </p>
              <p className="text-caption text-ink-500 mt-0.5">
                {result.percentage === 100 ? 'Perfect score' : `${result.total - result.score} to review`}
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setFilter('all')} className={cn('text-caption font-medium', filter === 'all' ? 'text-ink-900' : 'text-ink-400')}>
                All Questions
              </button>
              <button type="button" onClick={() => setFilter('missed')} className={cn('text-caption font-medium', filter === 'missed' ? 'text-ink-900' : 'text-ink-400')}>
                Missed Only
              </button>
              <button
                type="button"
                onClick={() => { setResult(null); setAnswers({}); setFilter('all'); }}
                className="text-caption text-ink-500 font-medium"
              >
                Retry
              </button>
            </div>
          </div>

          {questions.map((q) => {
            const qi = mcqSet.questions.indexOf(q);
            const bd = result.breakdown.find((b) => b.questionIndex === qi);
            return (
              <div key={qi} className="mb-8">
                <p className="text-body font-semibold text-ink-900 mb-3">{qi + 1}. {q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <div
                      key={opt.label}
                      className={cn(
                        'px-4 py-2.5 rounded-sm border text-meta',
                        opt.label === bd?.correctAnswer
                          ? 'bg-good/10 border-good text-ink-700'
                          : bd?.selected === opt.label && !bd?.correct
                          ? 'bg-bad/10 border-bad text-ink-700'
                          : 'border-ink-100 text-ink-500'
                      )}
                    >
                      <span className="font-semibold mr-2">{opt.label}.</span> {opt.text}
                    </div>
                  ))}
                </div>
                {!bd?.correct && (
                  <p className="text-caption text-ink-500 mt-2 pl-1">
                    <span className="font-medium text-ink-700">Explanation:</span> {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <>
          {mcqSet.questions.map((q, qi) => (
            <div key={qi} className="mb-8">
              <p className="text-body font-semibold text-ink-900 mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label
                    key={opt.label}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-sm border text-meta cursor-pointer transition-colors',
                      answers[qi] === opt.label
                        ? 'border-accent bg-accent-dim text-accent-ink'
                        : 'border-ink-100 text-ink-700 hover:bg-ink-100'
                    )}
                  >
                    <input
                      type="radio"
                      name={`q-${qi}`}
                      value={opt.label}
                      checked={answers[qi] === opt.label}
                      onChange={() => setAnswers((a) => ({ ...a, [qi]: opt.label }))}
                      className="accent-accent"
                    />
                    <span className="font-semibold">{opt.label}.</span> {opt.text}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < mcqSet.questions.length || submitMcqs.isPending}
            className="bg-ink-900 text-white px-6 py-2.5 rounded-md text-meta font-semibold hover:bg-black transition-colors disabled:opacity-40"
          >
            {submitMcqs.isPending ? 'Checking…' : 'Submit'}
          </button>
        </>
      )}
    </div>
  );
}
