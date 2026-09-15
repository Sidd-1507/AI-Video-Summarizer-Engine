import { Clock } from 'lucide-react';
import { useCredits } from '../../hooks/useCredits';
import { useGuestStore } from '../../store/useGuestStore';

export function CreditBadge() {
  const { data: credits } = useCredits();
  const isGuest = useGuestStore((s) => s.isGuest);

  if (isGuest) {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-ink-500">
        Guest
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-ink-500">
      <Clock size={13} strokeWidth={1.7} className="text-ink-400" />
      <span className="font-semibold text-ink-900 tabular-nums">{credits ?? '—'}</span>
      credits
    </span>
  );
}
