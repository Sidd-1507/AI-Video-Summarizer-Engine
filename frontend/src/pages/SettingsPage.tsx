import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGuestStore } from '../store/useGuestStore';
import { EmailAuthForm } from '../components/auth/EmailAuthForm';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { isFirebaseConfigured } from '../lib/firebase';

export default function SettingsPage() {
  const { user, signOutAll } = useAuth();
  const isGuest = useGuestStore((s) => s.isGuest);
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOutAll();
    navigate('/login', { replace: true });
  }

  return (
    <div className="px-10 py-11 max-w-xl">
      <p className="text-meta text-ink-500 mb-6">
        {user
          ? 'Your notes, credits, and flashcards are stored in your Notewise account.'
          : 'Create an account to keep notes, credits, and flashcards across devices.'}
      </p>

      <div className="border border-ink-100 rounded-md p-5 bg-paper mb-6">
        <p className="text-caption text-ink-400 mb-1">Signed in as</p>
        <p className="text-meta font-semibold text-ink-900">
          {user?.email || (isGuest ? 'Guest (this device only)' : 'Not signed in')}
        </p>
      </div>

      {isGuest && !user && (
        <div className="mb-6">
          <EmailAuthForm compact />
          {isFirebaseConfigured && (
            <div className="mt-5">
              <p className="text-caption text-ink-400 mb-3">or</p>
              <GoogleSignInButton />
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleSignOut}
        className="text-meta text-ink-500 hover:text-ink-900"
      >
        Sign out
      </button>
    </div>
  );
}
