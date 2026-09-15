import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import HighlightExt from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { Rnd } from 'react-rnd';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAddHighlight, useHighlights } from '../../hooks/useHighlights';
import { useAddStickyNote, useStickyNotes, useDeleteStickyNote, useUpdateStickyNote } from '../../hooks/useStickyNotes';
import { cn, seededRotation, STICKY_COLOR_MAP, escapeHtml } from '../../lib/utils';
import type { ExamQuestion, Topic } from '../../types/api';

// ── Highlight / sticky colours ────────────────────────────────────────────────
const HIGHLIGHT_COLORS: { key: string; hex: string }[] = [
  { key: 'yellow', hex: '#FFE270' },
  { key: 'blue',   hex: '#C3D4F5' },
  { key: 'green',  hex: '#A8D9B4' },
  { key: 'pink',   hex: '#F4B8BC' },
];

const STICKY_COLORS = [
  { key: 'yellow', tw: 'bg-sticky-a' },
  { key: 'blue',   tw: 'bg-sticky-b' },
  { key: 'purple', tw: 'bg-sticky-c' },
  { key: 'green',  tw: 'bg-sticky-d' },
  { key: 'red',    tw: 'bg-sticky-e' },
  { key: 'orange', tw: 'bg-sticky-f' },
];

// ── Build HTML from topic structured data ─────────────────────────────────────
function questionText(q: string | ExamQuestion): string {
  if (typeof q === 'string') return escapeHtml(q);
  return escapeHtml([q.text, q.answer].filter(Boolean).join(' — '));
}

function topicToHtml(topic: Topic): string {
  const lines: string[] = [];
  lines.push(`<h2>${escapeHtml(topic.title)}</h2>`);
  if (topic.content) {
    lines.push(
      topic.content
        .split('\n')
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('')
    );
  }
  if (topic.revisionPoints?.length) {
    lines.push('<ul>');
    topic.revisionPoints.forEach((pt) => lines.push(`<li>${escapeHtml(pt)}</li>`));
    lines.push('</ul>');
  }
  if (topic.charts?.length) {
    topic.charts.forEach((chart) => {
      lines.push(`<p><strong>${escapeHtml(chart.title)}</strong></p><ul>`);
      chart.data.forEach((point) => {
        lines.push(`<li>${escapeHtml(point.name)}: ${escapeHtml(String(point.value))}</li>`);
      });
      lines.push('</ul>');
    });
  }
  if (topic.questions?.length) {
    lines.push('<blockquote>');
    topic.questions.forEach((q) => lines.push(`<p>${questionText(q)}</p>`));
    lines.push('</blockquote>');
  }
  return lines.join('');
}

// ── Custom Bubble Menu via Portal ─────────────────────────────────────────────
interface BubbleMenuPosition { x: number; y: number }

function SelectionToolbar({
  pos,
  onHighlight,
  onSticky,
}: {
  pos: BubbleMenuPosition | null;
  onHighlight: (color: string) => void;
  onSticky: (color: string) => void;
}) {
  if (!pos) return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[9999] flex items-center gap-1 bg-ink-900 rounded-md px-2.5 py-2 shadow-2"
      style={{ left: pos.x, top: pos.y, transform: 'translateX(-50%) translateY(-100%)' }}
      onMouseDown={(e) => e.preventDefault()} // keep selection alive
    >
      {/* Highlight swatches */}
      {HIGHLIGHT_COLORS.map(({ key, hex }) => (
        <button
          key={key}
          onMouseDown={(e) => { e.preventDefault(); onHighlight(key); }}
          className="w-4 h-4 rounded-full border-2 border-white/30 hover:scale-110 transition-transform flex-shrink-0"
          style={{ background: hex }}
          title={`Highlight ${key}`}
        />
      ))}

      <span className="w-px h-4 bg-white/20 mx-1" />
      <span className="text-[10px] text-white/50">📌</span>

      {/* Sticky note swatches */}
      {STICKY_COLORS.slice(0, 4).map(({ key, tw }) => (
        <button
          key={key}
          onMouseDown={(e) => { e.preventDefault(); onSticky(key); }}
          className={cn('w-4 h-4 rounded-full border-2 border-white/30 hover:scale-110 transition-transform flex-shrink-0', tw)}
          title={`Sticky note (${key})`}
        />
      ))}
    </motion.div>,
    document.body
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface ArticleEditorProps {
  noteId:          string;
  topics:          Topic[];
  activeTopic:     string | null;
  onTopicVisible:  (topicId: string) => void;
}

export function ArticleEditor({ noteId, topics, activeTopic, onTopicVisible }: ArticleEditorProps) {
  const { data: stickyNotes = [] } = useStickyNotes(noteId);
  const { data: highlights  = [] } = useHighlights(noteId);
  const addHighlight  = useAddHighlight(noteId);
  const addSticky     = useAddStickyNote(noteId);
  const deleteSticky  = useDeleteStickyNote(noteId);
  const updateSticky  = useUpdateStickyNote();

  const containerRef = useRef<HTMLDivElement>(null);
  const [bubblePos, setBubblePos] = useState<BubbleMenuPosition | null>(null);

  const fullHtml = topics.map(topicToHtml).join('<hr/>');

  const editor = useEditor({
    extensions: [
      StarterKit,
      HighlightExt.configure({ multicolor: true }),
      Underline,
    ],
    content:  fullHtml,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose-article focus:outline-none',
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setBubblePos(null);
        return;
      }
      // Get mid-point of selection in viewport coords
      const view = editor.view;
      const start = view.coordsAtPos(from);
      const end   = view.coordsAtPos(to);
      const midX  = (start.left + end.right) / 2;
      setBubblePos({ x: midX, y: start.top - 6 });
    },
  });

  // Update content when topics load
  useEffect(() => {
    if (editor && fullHtml && !editor.isDestroyed) {
      editor.commands.setContent(fullHtml);
    }
  }, [fullHtml]); // eslint-disable-line

  // Dismiss bubble on click-outside / scroll
  useEffect(() => {
    const dismiss = () => setBubblePos(null);
    document.addEventListener('scroll', dismiss, true);
    return () => document.removeEventListener('scroll', dismiss, true);
  }, []);

  // Scroll to active topic
  useEffect(() => {
    if (!activeTopic || !containerRef.current) return;
    const topic = topics.find((t) => t.topicId === activeTopic);
    if (!topic) return;
    const headings = containerRef.current.querySelectorAll('h2');
    headings.forEach((el) => {
      if (el.textContent?.trim() === topic.title.trim()) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, [activeTopic, topics]);

  // Report which topic is in view
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const headings = root.querySelectorAll('h2');
    if (!headings.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((e) => e.isIntersecting);
      if (!visible?.target.textContent) return;
      const topic = topics.find((t) => t.title.trim() === visible.target.textContent?.trim());
      if (topic) onTopicVisible(topic.topicId);
    }, { root, threshold: 0.4 });
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [topics, onTopicVisible, editor]);

  // Apply highlight from DB
  const applyHighlights = useCallback(() => {
    if (!editor || !highlights.length || editor.isDestroyed) return;
    highlights.forEach((h) => {
      const hexColor = HIGHLIGHT_COLORS.find((c) => c.key === h.color)?.hex ?? '#FFE270';
      try {
        editor
          .chain()
          .setTextSelection({ from: h.startOffset, to: h.endOffset })
          .setHighlight({ color: hexColor })
          .run();
      } catch (_) { /* offset may shift on HMR */ }
    });
    editor.commands.setTextSelection(0);
  }, [editor, highlights]);

  useEffect(() => { applyHighlights(); }, [applyHighlights]);

  function handleHighlight(color: string) {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to, ' ');
    if (!text.trim()) return;
    const hexColor = HIGHLIGHT_COLORS.find((c) => c.key === color)?.hex ?? '#FFE270';
    editor.chain().focus().setHighlight({ color: hexColor }).run();
    const topicId = topics[0]?.topicId ?? '';
    addHighlight.mutate({ topicId, text, startOffset: from, endOffset: to, color });
    setBubblePos(null);
  }

  function handleAddSticky(color = 'yellow') {
    const topicId = topics[0]?.topicId ?? '';
    addSticky.mutate({ topicId, content: 'New note…', color });
    setBubblePos(null);
  }

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      {/* Sticky notes layer */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        <AnimatePresence>
          {stickyNotes.map((note) => {
            const colors = STICKY_COLOR_MAP[note.color] ?? STICKY_COLOR_MAP.yellow;
            const rot    = seededRotation(note._id);
            return (
              <Rnd
                key={note._id}
                default={{ x: note.x ?? 780, y: note.y ?? 60, width: note.w ?? 220, height: note.h ?? 180 }}
                minWidth={150} minHeight={120}
                bounds="parent"
                style={{ pointerEvents: 'all', zIndex: note._optimistic ? 9 : 21 }}
                onDragStop={(_, d)         => updateSticky.mutate({ id: note._id, x: d.x, y: d.y })}
                onResizeStop={(_, __, ref, ___, pos) =>
                  updateSticky.mutate({ id: note._id, w: parseInt(ref.style.width), h: parseInt(ref.style.height), x: pos.x, y: pos.y })
                }
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: note._optimistic ? 0.65 : 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className={cn('h-full rounded-sm border p-3.5 text-caption leading-relaxed text-ink-900 cursor-move relative', colors.bg, colors.border)}
                  style={{ transform: `rotate(${rot}deg)` }}
                  whileDrag={{ rotate: 0, scale: 1.03, boxShadow: '0 8px 24px rgba(11,12,15,.10)', zIndex: 30 }}
                >
                  <textarea
                    className="w-full h-full bg-transparent resize-none border-none outline-none text-caption text-ink-900 placeholder:text-ink-400 leading-relaxed"
                    defaultValue={note.content}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      if (e.target.value !== note.content)
                        updateSticky.mutate({ id: note._id, content: e.target.value });
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSticky.mutate(note._id); }}
                    className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded-full text-[10px] text-ink-400 hover:text-bad hover:bg-white/60 transition-colors"
                  >
                    ✕
                  </button>
                </motion.div>
              </Rnd>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Selection toolbar (portal) */}
      <AnimatePresence>
        {bubblePos && (
          <SelectionToolbar
            pos={bubblePos}
            onHighlight={handleHighlight}
            onSticky={handleAddSticky}
          />
        )}
      </AnimatePresence>

      {/* Scrollable article content */}
      <div className="h-full overflow-y-auto px-14 py-11 pr-[260px]">
        {topics.filter((t) => t.imageUrl && (!activeTopic || t.topicId === activeTopic)).map((t) => (
          <img
            key={t.topicId}
            src={t.imageUrl}
            alt=""
            className="rounded-md border border-ink-100 mb-6 max-w-xl"
          />
        ))}
        <style>{`
          .prose-article h2 {
            font-size: 1.35rem; font-weight: 650; letter-spacing: -0.015em;
            color: #0B0C0F; margin-bottom: 1rem; margin-top: 2.5rem; scroll-margin-top: 24px;
          }
          .prose-article h2:first-child { margin-top: 0; }
          .prose-article p  { color: #40424C; line-height: 1.85; margin-bottom: 0.75rem; max-width: 62ch; font-size: 0.95rem; }
          .prose-article ul { padding-left: 1.5rem; margin-bottom: 1rem; }
          .prose-article li { color: #40424C; line-height: 1.7; margin-bottom: 0.25rem; font-size: 0.95rem; }
          .prose-article li::marker { color: #9497A6; }
          .prose-article blockquote { border-left: 3px solid #E3E4E9; padding-left: 1rem; margin: 1rem 0; color: #6E7180; font-style: italic; }
          .prose-article hr { border: none; border-top: 1px solid #EEEFF2; margin: 2.5rem 0; }
          .prose-article mark { border-radius: 3px; padding: 0 2px; }
        `}</style>
        <EditorContent editor={editor} />
      </div>

      {/* FAB: Add sticky note */}
      <button
        onClick={() => handleAddSticky('yellow')}
        className="fixed bottom-8 right-8 w-11 h-11 rounded-full bg-ink-900 text-white flex items-center justify-center shadow-2 hover:bg-black transition-colors z-30"
        title="Add sticky note"
      >
        <Plus size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
