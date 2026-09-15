import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

function messageFromError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return err instanceof Error ? err.message : 'Could not sign in';
}

export function EmailAuthForm({ compact = false }: { compact?: boolean }) {
  const { loginWithPassword, registerWithPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === 'register') {
        await registerWithPassword(email, password, displayName || undefined);
      } else {
        await loginWithPassword(email, password);
      }
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    'w-full border border-ink-200 rounded-md px-3 py-2.5 bg-paper text-meta text-ink-900 placeholder:text-ink-400 focus:border-accent outline-none';

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-2.5' : 'space-y-3 max-w-[320px]'}>
      <div className="flex gap-4 mb-1">
        <button
          type="button"
          onClick={() => { setMode('register'); setError(null); }}
          className={`text-meta pb-1 border-b-2 ${mode === 'register' ? 'text-ink-900 font-semibold border-accent' : 'text-ink-400 border-transparent'}`}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(null); }}
          className={`text-meta pb-1 border-b-2 ${mode === 'signin' ? 'text-ink-900 font-semibold border-accent' : 'text-ink-400 border-transparent'}`}
        >
          Sign in
        </button>
      </div>

      {mode === 'register' && (
        <input
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Name (optional)"
          className={inputClass}
        />
      )}
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className={inputClass}
      />
      <input
        type="password"
        required
        minLength={8}
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
        className={inputClass}
      />
      {error && <p className="text-caption text-bad">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-ink-900 text-white px-5 py-2.5 rounded-md text-meta font-semibold hover:bg-black transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving…' : mode === 'register' ? 'Create account' : 'Sign in'}
      </button>
    </form>
  );
}
