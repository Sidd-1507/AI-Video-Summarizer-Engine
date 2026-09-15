import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGuestStore } from '../../store/useGuestStore';
import { LoadingSpinner } from '../shared/LoadingSpinner';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const isGuest = useGuestStore((s) => s.isGuest);
  const [hydrated, setHydrated] = useState(() => useGuestStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useGuestStore.persist.onFinishHydration(() => setHydrated(true));
    if (useGuestStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  if (loading || !hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user && !isGuest) return <Navigate to="/login" replace />;
  return <Outlet />;
}
