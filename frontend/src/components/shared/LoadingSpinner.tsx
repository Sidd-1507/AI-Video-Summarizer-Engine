export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-accent" />
    </div>
  );
}
