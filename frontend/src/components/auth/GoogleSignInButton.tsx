import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, isFirebaseConfigured, firebaseConfigMessage } from '../../lib/firebase';
import { useGuestStore } from '../../store/useGuestStore';
import { queryClient } from '../../lib/queryClient';

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92C16.66 14.09 17.64 11.78 17.64 9.2z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

function humanizeAuthError(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  if (code === 'auth/popup-blocked') return 'The sign-in popup was blocked. Allow popups for this site, then try again.';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in was closed before it finished.';
  if (code === 'auth/unauthorized-domain') return 'This site is not in Firebase authorized domains. Add localhost in the Firebase Auth settings.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is disabled in this Firebase project. Enable the Google provider in Authentication → Sign-in method.';
  if (code === 'auth/invalid-api-key') return 'The Firebase API key in frontend/.env is invalid.';
  const message = err instanceof Error ? err.message : 'Sign-in failed.';
  return message;
}

export function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
  const navigate = useNavigate();
  const setGuest = useGuestStore((s) => s.setGuest);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleGoogle() {
    setError(null);
    if (!isFirebaseConfigured) {
      setError(firebaseConfigMessage());
      return;
    }

    setPending(true);
    try {
      await signInWithPopup(auth, googleProvider());
      setGuest(false);
      queryClient.clear();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(humanizeAuthError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGoogle}
        disabled={pending}
        className="flex items-center gap-2.5 bg-ink-900 text-white px-5 py-3 rounded-md text-meta font-semibold w-fit hover:bg-black transition-colors disabled:opacity-50"
      >
        <GoogleIcon />
        {pending ? 'Opening Google…' : label}
      </button>
      {error && (
        <p className="mt-3 text-caption text-bad max-w-[36ch]">{error}</p>
      )}
    </div>
  );
}
