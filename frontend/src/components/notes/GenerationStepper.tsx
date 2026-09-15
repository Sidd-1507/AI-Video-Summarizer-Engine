import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

const GENERATION_STEPS = [
  { label: 'Fetching transcript', duration: 2 },
  { label: 'Reading transcript',  duration: 4 },
  { label: 'Structuring topics',  duration: 12 },
  { label: 'Ready',               duration: 0 },
];

export function GenerationStepper({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  let cumulative = 0;
  const currentStep = GENERATION_STEPS.findIndex((s) => {
    cumulative += s.duration;
    return elapsed < cumulative;
  });
  const activeStep = currentStep === -1 ? GENERATION_STEPS.length - 1 : currentStep;
  const progress = Math.min(100, (elapsed / 18) * 100);

  return (
    <div className="max-w-[480px] mx-auto text-center">
      <div className="h-1 bg-ink-100 rounded-pill overflow-hidden mb-5">
        <div
          className="h-full bg-accent transition-all duration-500 rounded-pill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between">
        {GENERATION_STEPS.map((step, i) => (
          <div key={step.label} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'w-2 h-2 rounded-full border-2 transition-colors',
                i < activeStep ? 'bg-accent border-accent'
                : i === activeStep ? 'bg-paper border-accent'
                : 'bg-paper border-ink-200'
              )}
            />
            <span className={cn('text-caption', i <= activeStep ? 'text-ink-700' : 'text-ink-400')}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-caption text-ink-400 mt-3">{elapsed}s elapsed</p>
    </div>
  );
}
