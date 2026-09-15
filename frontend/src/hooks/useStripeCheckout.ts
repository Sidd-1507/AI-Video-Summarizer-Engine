import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useStripeCheckout() {
  return useMutation({
    mutationFn: (priceId: string) =>
      api.post<{ url: string }>('/api/stripe/checkout', { priceId }).then((r) => r.data.url),
    onSuccess: (url) => {
      window.location.assign(url);
    },
  });
}
