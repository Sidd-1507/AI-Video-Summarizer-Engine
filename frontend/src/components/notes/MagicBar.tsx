import { Clipboard, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Tone } from '../../types/api';

export const TONES: { key: Tone; label: string }[] = [
  { key: 'exam-cram',          label: 'Exam-cram' },
  { key: 'deep-understanding', label: 'Deep understanding' },
  { key: 'eli5',               label: 'ELI5' },
];

export type MagicMode = 'youtube' | 'topic';

export interface MagicBarValues {
  mode: MagicMode;
  youtubeUrl: string;
  topic: string;
  classLevel: string;
  board: string;
  examType: string;
  tone: Tone;
}

interface MagicBarProps {
  values: MagicBarValues;
  onChange: (patch: Partial<MagicBarValues>) => void;
  onGenerate: () => void;
  disabled?: boolean;
}

export function MagicBar({ values, onChange, onGenerate, disabled }: MagicBarProps) {
  const canSubmit = values.mode === 'youtube' ? Boolean(values.youtubeUrl.trim()) : Boolean(values.topic.trim());

  return (
    <div>
      <div className="flex justify-center gap-4 mb-4">
        {([
          { key: 'youtube' as const, label: 'YouTube', icon: Clipboard },
          { key: 'topic' as const,   label: 'Topic',   icon: BookOpen },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ mode: key })}
            className={cn(
              'flex items-center gap-1.5 text-meta pb-1.5 border-b-2 transition-colors',
              values.mode === key
                ? 'text-ink-900 font-semibold border-accent'
                : 'text-ink-400 border-transparent hover:text-ink-700'
            )}
          >
            <Icon size={14} strokeWidth={1.7} />
            {label}
          </button>
        ))}
      </div>

      {values.mode === 'youtube' ? (
        <div className="flex items-center gap-2.5 border border-ink-200 rounded-md px-4 py-3 bg-paper focus-within:border-accent focus-within:shadow-glow transition-all">
          <Clipboard size={16} strokeWidth={1.7} className="text-ink-400 flex-shrink-0" />
          <input
            type="url"
            value={values.youtubeUrl}
            onChange={(e) => onChange({ youtubeUrl: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && onGenerate()}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 bg-transparent border-none outline-none text-meta text-ink-900 placeholder:text-ink-400"
          />
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canSubmit || disabled}
            className="bg-ink-900 text-white px-4 py-1.5 rounded-sm text-caption font-semibold hover:bg-black transition-colors disabled:opacity-40"
          >
            Generate
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 border border-ink-200 rounded-md px-4 py-3 bg-paper focus-within:border-accent focus-within:shadow-glow transition-all">
            <BookOpen size={16} strokeWidth={1.7} className="text-ink-400 flex-shrink-0" />
            <input
              value={values.topic}
              onChange={(e) => onChange({ topic: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && onGenerate()}
              placeholder="Photosynthesis, quadratic equations…"
              className="flex-1 bg-transparent border-none outline-none text-meta text-ink-900 placeholder:text-ink-400"
            />
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canSubmit || disabled}
              className="bg-ink-900 text-white px-4 py-1.5 rounded-sm text-caption font-semibold hover:bg-black transition-colors disabled:opacity-40"
            >
              Generate
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={values.classLevel}
              onChange={(e) => onChange({ classLevel: e.target.value })}
              className="border border-ink-200 rounded-sm px-3 py-2 text-caption text-ink-700 bg-paper"
            >
              <option value="">Class</option>
              {['8', '9', '10', '11', '12'].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
            <select
              value={values.board}
              onChange={(e) => onChange({ board: e.target.value })}
              className="border border-ink-200 rounded-sm px-3 py-2 text-caption text-ink-700 bg-paper"
            >
              <option value="">Board</option>
              {['CBSE', 'ICSE', 'State', 'IB'].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              value={values.examType}
              onChange={(e) => onChange({ examType: e.target.value })}
              className="border border-ink-200 rounded-sm px-3 py-2 text-caption text-ink-700 bg-paper"
            >
              <option value="">Exam</option>
              {['Board', 'JEE', 'NEET', 'CUET'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-6 mt-5">
        {TONES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ tone: key })}
            className={cn(
              'text-meta pb-1.5 border-b-2 transition-colors',
              values.tone === key
                ? 'text-ink-900 font-semibold border-accent'
                : 'text-ink-400 border-transparent hover:text-ink-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
