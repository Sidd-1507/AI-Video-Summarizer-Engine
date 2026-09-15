import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes, useGenerateNote, useGenerateTopicNote } from '../hooks/useNotes';
import { MagicBar, type MagicBarValues } from '../components/notes/MagicBar';
import { GenerationStepper } from '../components/notes/GenerationStepper';
import { LibraryGrid } from '../components/notes/LibraryGrid';
import { useGuestStore } from '../store/useGuestStore';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: notes, isLoading } = useNotes();
  const generateYoutube = useGenerateNote();
  const generateTopic = useGenerateTopicNote();
  const openSignIn = useGuestStore((s) => s.openSignInPrompt);

  const [values, setValues] = useState<MagicBarValues>({
    mode: 'youtube',
    youtubeUrl: '',
    topic: '',
    classLevel: '',
    board: '',
    examType: '',
    tone: 'exam-cram',
  });
  const [generatingAt, setGeneratingAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setGeneratingAt(Date.now());
    try {
      const note = values.mode === 'youtube'
        ? await generateYoutube.mutateAsync({
            youtubeUrl: values.youtubeUrl.trim(),
            tone: values.tone,
          })
        : await generateTopic.mutateAsync({
            topic: values.topic.trim(),
            tone: values.tone,
            classLevel: values.classLevel || undefined,
            board: values.board || undefined,
            examType: values.examType || undefined,
          });
      navigate(`/notes/${note._id}`);
    } catch (err) {
      setGeneratingAt(null);
      const data = (err as { response?: { data?: { error?: string; locked?: boolean; details?: { youtubeUrl?: string[] } } } })?.response?.data;
      if (data?.locked) {
        openSignIn();
        return;
      }
      const detail = data?.details?.youtubeUrl?.[0];
      setError(data?.error || detail || (err as Error).message || 'Could not generate notes');
    }
  }

  return (
    <div className="px-10 py-11">
      <div className="max-w-[620px] mx-auto text-center mb-10">
        <h2 className="text-h2 text-ink-900 mb-2">What are we studying today?</h2>
        <p className="text-meta text-ink-500 mb-6">
          Paste a YouTube link or a syllabus topic to generate notes, flashcards, and a quiz.
        </p>

        {generatingAt ? (
          <GenerationStepper startedAt={generatingAt} />
        ) : (
          <MagicBar
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            onGenerate={handleGenerate}
          />
        )}
        {error && (
          <p className="text-caption text-bad mt-4">{error}</p>
        )}
      </div>

      <div>
        <div className="flex justify-between items-baseline mb-4">
          <h3 className="text-meta font-[650] text-ink-900">Recent notes</h3>
          {notes && <span className="text-caption text-ink-400">{notes.length} total</span>}
        </div>
        <LibraryGrid notes={notes} isLoading={isLoading} />
      </div>
    </div>
  );
}
