import { EmailAuthForm } from '../auth/EmailAuthForm';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { useGuestStore } from '../../store/useGuestStore';
import { isFirebaseConfigured } from '../../lib/firebase';

export function SignInGate() {
  const open = useGuestStore((s) => s.signInPrompt);
  const close = useGuestStore((s) => s.closeSignInPrompt);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40">
      <div className="w-[400px] bg-paper rounded-lg border border-ink-100 shadow-2 p-6">
        <p className="text-h2 text-ink-900 mb-2">Sign in to continue</p>
        <p className="text-meta text-ink-500 mb-5">
          Guest mode saves one preview note on this device. Create an account to unlock:
        </p>
        <ul className="text-meta text-ink-700 space-y-1.5 mb-6">
          <li>Full AI notes from YouTube or a syllabus topic</li>
          <li>Flashcards with spaced repetition</li>
          <li>Quizzes, diagrams, and audio overviews</li>
          <li>Credits and billing across devices</li>
        </ul>
        <EmailAuthForm compact />
        {isFirebaseConfigured && (
          <div className="mt-5">
            <p className="text-caption text-ink-400 mb-3">or</p>
            <GoogleSignInButton />
          </div>
        )}
        <button
          type="button"
          onClick={close}
          className="mt-4 text-caption text-ink-400 hover:text-ink-700"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
