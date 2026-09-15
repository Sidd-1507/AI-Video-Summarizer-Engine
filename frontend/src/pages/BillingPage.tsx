import { Check } from 'lucide-react';
import { useCredits, useCreditHistory } from '../hooks/useCredits';
import { useStripeCheckout } from '../hooks/useStripeCheckout';
import { relativeDate, cn } from '../lib/utils';
import { useGuestStore } from '../store/useGuestStore';

const PLANS = [
  { priceId: 'price_50',  credits: 50,  price: '$5',  features: ['50 note generations', 'All study formats', 'Basic support'] },
  { priceId: 'price_120', credits: 120, price: '$10', features: ['120 note generations', 'Priority processing', 'Audio overviews'], popular: true },
  { priceId: 'price_300', credits: 300, price: '$20', features: ['300 note generations', 'Fastest processing', 'Priority support', 'Bulk export'] },
] as const;

export default function BillingPage() {
  const { data: credits }   = useCredits();
  const { data: history }   = useCreditHistory();
  const checkout            = useStripeCheckout();
  const isGuest             = useGuestStore((s) => s.isGuest);
  const openSignIn          = useGuestStore((s) => s.openSignInPrompt);

  function buy(priceId: string) {
    if (isGuest) {
      openSignIn();
      return;
    }
    checkout.mutate(priceId);
  }

  return (
    <div className="px-10 py-11 max-w-3xl">
      <div className="mb-10">
        <p className="text-caption text-ink-500 mb-1">Current balance</p>
        <div className="flex items-baseline gap-3">
          <span className="text-h1 font-[650] text-ink-900">{isGuest ? 0 : credits ?? '—'}</span>
          <span className="inline-flex items-center px-3 py-1 bg-accent-dim text-accent-ink text-caption font-medium rounded-pill">
            {isGuest ? 0 : credits ?? 0} credits remaining
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-12">
        {PLANS.map((plan) => {
          const popular = 'popular' in plan && Boolean(plan.popular);
          const { priceId, credits: c, price, features } = plan;
          return (
            <div
              key={priceId}
              className={cn(
                'border rounded-md p-6 flex flex-col',
                popular ? 'border-accent shadow-1' : 'border-ink-100'
              )}
            >
              {popular && (
                <span className="self-start text-[11px] font-semibold text-accent-ink bg-accent-dim px-2.5 py-0.5 rounded-pill mb-3">
                  Most popular
                </span>
              )}
              <p className="text-h2 font-[650] text-ink-900 mb-0.5">{price}</p>
              <p className="text-meta text-ink-500 mb-5">{c} credits</p>
              <ul className="space-y-2 mb-6 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-meta text-ink-700">
                    <Check size={13} strokeWidth={2} className="text-good flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => buy(priceId)}
                disabled={checkout.isPending}
                className="w-full bg-ink-900 text-white py-2.5 rounded-sm text-meta font-semibold hover:bg-black transition-colors disabled:opacity-50"
              >
                Buy {c} credits
              </button>
            </div>
          );
        })}
      </div>

      {history?.transactions?.length ? (
        <div>
          <h3 className="text-meta font-[650] text-ink-900 mb-4">Transaction history</h3>
          <div className="border border-ink-100 rounded-md overflow-hidden">
            <table className="w-full text-meta">
              <thead>
                <tr className="border-b border-ink-100 bg-canvas">
                  <th className="text-left px-4 py-3 text-caption font-semibold text-ink-500">Date</th>
                  <th className="text-left px-4 py-3 text-caption font-semibold text-ink-500">Description</th>
                  <th className="text-right px-4 py-3 text-caption font-semibold text-ink-500">Credits</th>
                </tr>
              </thead>
              <tbody>
                {history.transactions.map((tx) => (
                  <tr key={tx._id} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-3 text-caption text-ink-400">{relativeDate(tx.createdAt)}</td>
                    <td className="px-4 py-3 text-ink-700">{tx.description}</td>
                    <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', tx.type === 'grant' ? 'text-good' : 'text-bad')}>
                      {tx.type === 'grant' ? '+' : '−'}{Math.abs(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
