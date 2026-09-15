import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGuestStore } from '../store/useGuestStore';
import { EmailAuthForm } from '../components/auth/EmailAuthForm';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { WordMark } from '../components/shared/WordMark';
import { isFirebaseConfigured } from '../lib/firebase';

function DemoPanel() {
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduce) return undefined;
    const id = window.setInterval(() => setCycle((c) => c + 1), 3000);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div
      className="bg-ink-900 flex items-center justify-center px-12 relative overflow-hidden"
      style={{
        background: 'radial-gradient(600px 300px at 20% 15%, rgba(59,76,224,0.35), transparent 60%), #0B0C0F',
      }}
    >
      <div className="w-[400px] bg-[#14151B] border border-[#2A2C36] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-[#3A3C48]" />
          ))}
        </div>

        <div className="space-y-2 text-[13px] leading-[1.9] text-[#B8BAC6]">
          <div>
            <span className="text-[#5C5E6C] text-xs tabular-nums mr-2.5">04:12</span>
            the second law states that entropy of an isolated system
          </div>
          <div className="text-[#F2F3F6]">
            <span className="text-[#5C5E6C] text-xs tabular-nums mr-2.5">04:18</span>
            <span className="relative">
              <mark className="bg-mark text-ink-900 rounded-[3px] px-0.5 relative z-10">
                never decreases over time
              </mark>
              {!reduce && (
                <motion.span
                  key={cycle}
                  className="absolute inset-0 bg-white/20 rounded-[3px]"
                  initial={{ x: '-100%', opacity: 0.6 }}
                  animate={{ x: '120%', opacity: 0 }}
                  transition={{ duration: 1.1, ease: 'easeInOut' }}
                />
              )}
            </span>
            {' '}— it's the arrow behind why heat flows one way
          </div>
          <div>
            <span className="text-[#5C5E6C] text-xs tabular-nums mr-2.5">04:26</span>
            this is why you can't unscramble an egg by waiting
          </div>
        </div>

        <motion.div
          key={`tag-${reduce ? 'static' : cycle}`}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 1.2, duration: 0.35 }}
          className="flex items-center gap-1.5 mt-4 px-3 py-2 bg-[#1E2030] border border-[#33354A] rounded-sm text-[12px] text-[#AEB2FF]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Saved to "Entropy & the 2nd law" · 04:18
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const setGuest = useGuestStore((s) => s.setGuest);

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  function handleGuest() {
    setGuest(true);
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="h-screen grid grid-cols-2 bg-paper overflow-hidden">
      <div className="flex flex-col justify-center px-[60px] border-r border-ink-100">
        <div className="mb-16">
          <WordMark />
        </div>

        <h1 className="text-display font-[650] text-ink-900 leading-[1.22] tracking-[-0.025em] mb-4 max-w-[11ch]">
          Study from any video, properly
        </h1>
        <p className="text-body text-ink-500 max-w-[36ch] mb-8 leading-relaxed">
          Paste a link. Get structured notes, flashcards and a quiz — with every
          highlight linked back to the second it came from.
        </p>

        <EmailAuthForm />

        <p className="mt-5 text-caption text-ink-400">
          New accounts start with 100 free credits, stored in your Notewise account.
        </p>

        {isFirebaseConfigured && (
          <div className="mt-6">
            <p className="text-caption text-ink-400 mb-3">or</p>
            <GoogleSignInButton />
          </div>
        )}

        <button
          type="button"
          onClick={handleGuest}
          className="mt-6 text-caption text-ink-400 hover:text-ink-700 text-left transition-colors"
        >
          Try without an account →
        </button>
      </div>

      <DemoPanel />
    </div>
  );
}
