import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SideNav } from './SideNav';
import { AudioPlayerBar } from '../audio/AudioPlayerBar';
import { CreditBadge } from '../shared/CreditBadge';
import { SignInGate } from '../shared/SignInGate';
import { useAudioStore } from '../../store/useAudioStore';
import { useAuth } from '../../contexts/AuthContext';
import { useGuestStore } from '../../store/useGuestStore';

const TITLES: Record<string, string> = {
  '/dashboard': 'Library',
  '/billing': 'Billing',
  '/queue': 'Flashcard queue',
  '/settings': 'Settings',
};

export function AppShell() {
  const audioUrl = useAudioStore((s) => s.url);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuest = useGuestStore((s) => s.isGuest);
  const hideTop = location.pathname.startsWith('/notes/');
  const title = Object.entries(TITLES).find(([path]) => location.pathname === path)?.[1] ?? 'Notewise';
  const initial = (user?.email?.[0] || (isGuest ? 'G' : 'U')).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <SideNav />
      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">
        {!hideTop && (
          <div className="flex justify-between items-center px-8 py-4 border-b border-ink-100 bg-canvas">
            <span className="text-card font-semibold text-ink-900">{title}</span>
            <div className="flex items-center gap-4">
              <CreditBadge />
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="w-7 h-7 rounded-full bg-ink-900 text-white text-caption font-semibold flex items-center justify-center"
                aria-label="Account"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
                ) : initial}
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
        {audioUrl && <AudioPlayerBar />}
      </main>
      <SignInGate />
    </div>
  );
}
