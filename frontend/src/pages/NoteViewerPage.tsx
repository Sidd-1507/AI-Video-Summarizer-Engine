import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Download, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNote } from '../hooks/useNotes';
import { cn } from '../lib/utils';
import { ArticleEditor } from '../components/viewer/ArticleEditor';
import { MindMap } from '../components/viewer/MindMap';
import { ExportPanel } from '../components/viewer/ExportPanel';
import { FlashcardView } from '../components/viewer/FlashcardView';
import { QuizView } from '../components/viewer/QuizView';
import { TurnIntoBar } from '../components/viewer/TurnIntoBar';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

type Tab = 'article' | 'mindmap' | 'flashcards' | 'quiz';

const TABS: { id: Tab; label: string }[] = [
  { id: 'article',    label: 'Article' },
  { id: 'mindmap',    label: 'Mind Map' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz',       label: 'Quiz' },
];

export default function NoteViewerPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { data: note } = useNote(id);
  const initialTab = (params.get('tab') as Tab) || 'article';
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initialTab) ? initialTab : 'article');
  const [activeTopicId, setActiveTopic] = useState('');
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const currentTopicId = activeTopicId || note?.topics?.[0]?.topicId || '';
  const currentTopic = note?.topics.find((t) => t.topicId === currentTopicId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!note) {
    return <LoadingSpinner className="h-full" />;
  }

  if (note.status === 'failed') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-meta text-bad">This note failed to generate. Try again from the library.</p>
      </div>
    );
  }

  if (note.status === 'pending' || note.status === 'generating') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <LoadingSpinner />
        <p className="text-meta text-ink-500">Structuring topics…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-[222px] flex-shrink-0 border-r border-ink-100 px-3.5 py-5 overflow-y-auto">
        <p className="text-caption text-ink-400 uppercase tracking-wider px-2 mb-2.5">Topics</p>
        <div className="space-y-0.5">
          {note.topics.map((topic) => (
            <button
              key={topic.topicId}
              type="button"
              onClick={() => {
                setActiveTopic(topic.topicId);
                if (tab !== 'article' && tab !== 'mindmap') setTab('article');
              }}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-2 rounded-sm text-meta text-left transition-colors',
                currentTopicId === topic.topicId
                  ? 'bg-accent-dim text-accent-ink font-semibold'
                  : 'text-ink-700 hover:bg-ink-100'
              )}
            >
              <span className="truncate">{topic.title}</span>
              <span className="text-caption text-ink-400 ml-2 flex-shrink-0">
                {topic.revisionPoints?.length ?? 0}
              </span>
            </button>
          ))}
        </div>

        <TurnIntoBar
          noteId={id}
          topicId={currentTopicId}
          onOpenQuiz={() => setTab('quiz')}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8 border-b border-ink-100 flex-shrink-0">
          <div className="flex gap-7">
            {TABS.map(({ id: tid, label }) => (
              <button
                key={tid}
                type="button"
                onClick={() => setTab(tid)}
                className={cn(
                  'py-3.5 text-meta border-b-2 transition-colors',
                  tab === tid
                    ? 'text-ink-900 font-semibold border-ink-900'
                    : 'text-ink-400 border-transparent hover:text-ink-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setShowExport((s) => !s)}
              className="flex items-center gap-1.5 text-caption text-ink-500 hover:text-ink-900 transition-colors py-1.5 px-2 rounded-sm hover:bg-ink-100"
            >
              <Download size={13} strokeWidth={1.7} />
              Export
              <ChevronDown size={12} strokeWidth={1.7} className={cn('transition-transform', showExport && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showExport && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 w-52 bg-paper border border-ink-100 rounded-md shadow-2 overflow-hidden z-50"
                >
                  <ExportPanel note={note} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {tab === 'article' && (
            <ArticleEditor
              noteId={id}
              topics={note.topics}
              activeTopic={activeTopicId || null}
              onTopicVisible={setActiveTopic}
            />
          )}
          {tab === 'mindmap' && (
            note.topics.length
              ? <MindMap title={note.title} topics={note.topics} />
              : <div className="flex-1 flex items-center justify-center text-meta text-ink-500">Topics will appear here once your notes are ready</div>
          )}
          {tab === 'flashcards' && <FlashcardView noteId={id} topicName={currentTopic?.title} />}
          {tab === 'quiz' && (
            <QuizView
              noteId={id}
              topicId={currentTopicId}
              topics={note.topics}
              onTopicChange={setActiveTopic}
            />
          )}
        </div>
      </div>
    </div>
  );
}
