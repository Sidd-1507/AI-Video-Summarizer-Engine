import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

function env(name: string): string {
  return String(import.meta.env[name] ?? '').trim();
}

export const firebaseWebConfig = {
  apiKey:        env('VITE_FIREBASE_API_KEY'),
  authDomain:    env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId:     env('VITE_FIREBASE_PROJECT_ID'),
  appId:         env('VITE_FIREBASE_APP_ID'),
  measurementId: env('VITE_FIREBASE_MEASUREMENT_ID') || undefined,
};

export const isFirebaseConfigured = Boolean(
  firebaseWebConfig.apiKey &&
  firebaseWebConfig.authDomain &&
  firebaseWebConfig.projectId &&
  firebaseWebConfig.appId
);

const app = getApps().length
  ? getApp()
  : initializeApp(
      isFirebaseConfigured
        ? firebaseWebConfig
        : {
            apiKey:     'unconfigured',
            authDomain: 'localhost',
            projectId:  'unconfigured',
            appId:      '1:0:web:0',
          }
    );

export const auth = getAuth(app);

export function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function firebaseConfigMessage() {
  return 'Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID to frontend/.env, then restart npm run dev.';
}
