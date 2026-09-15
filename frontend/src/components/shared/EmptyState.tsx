export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mb-4 text-ink-200" aria-hidden>
        <rect x="8" y="12" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2"/>
        <polygon points="28,24 28,40 42,32" fill="currentColor" opacity="0.35"/>
        <path d="M46 16l2 4 4 .5-3 3 .8 4-3.8-2.2L42 27.5l.8-4-3-3 4-.5z" fill="currentColor"/>
      </svg>
      <p className="text-meta text-ink-500 mb-1">{title}</p>
      <p className="text-caption text-ink-400">{body}</p>
    </div>
  );
}
