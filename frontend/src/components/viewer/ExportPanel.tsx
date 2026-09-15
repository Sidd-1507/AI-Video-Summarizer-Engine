import type { Note } from '../../types/api';

/**
 * Convert a note to Markdown.
 * Used for both download and clipboard copy.
 */
export function noteToMarkdown(note: Note): string {
  const lines: string[] = [`# ${note.title}\n`];
  lines.push(`> Source: ${note.source?.youtubeUrl ?? ''}\n`);
  note.topics?.forEach((topic) => {
    lines.push(`\n## ${topic.title}\n`);
    if (topic.content) lines.push(`${topic.content}\n`);
    if (topic.revisionPoints?.length) {
      lines.push('\n**Key Points**\n');
      topic.revisionPoints.forEach((pt) => lines.push(`- ${pt}`));
    }
    if (topic.questions?.length) {
      lines.push('\n**Questions to consider**\n');
      topic.questions.forEach((q) => {
        const text = typeof q === 'string' ? q : q.text;
        lines.push(`- ${text}`);
      });
    }
  });
  return lines.join('\n');
}

function downloadText(content: string, filename: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel({ note }: { note: Note }) {
  const slug = note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

  function handleMarkdown() {
    downloadText(noteToMarkdown(note), `${slug}.md`);
  }

  function handleCsv() {
    const rows = [['Topic', 'Key Point']];
    note.topics?.forEach((topic) => {
      topic.revisionPoints?.forEach((pt) => rows.push([topic.title, pt]));
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadText(csv, `${slug}.csv`, 'text/csv');
  }

  function handleCopy() {
    navigator.clipboard.writeText(noteToMarkdown(note)).then(() => {
      /* Could show a toast here */
    });
  }

  const exportOptions = [
    { label: 'Markdown (.md)',    action: handleMarkdown, icon: '↓' },
    { label: 'CSV (key points)',  action: handleCsv,      icon: '↓' },
    { label: 'Copy to clipboard', action: handleCopy,     icon: '⧉' },
  ];

  return (
    <div className="py-1">
      {exportOptions.map(({ label, action, icon }) => (
        <button
          key={label}
          onClick={action}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-meta text-ink-700 hover:bg-ink-100 transition-colors text-left"
        >
          <span className="text-ink-400 w-4 text-center">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
