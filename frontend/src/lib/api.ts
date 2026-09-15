import axios from 'axios';
import { auth } from './firebase';
import { queryClient } from './queryClient';
import { useGuestStore } from '../store/useGuestStore';
import * as guestApi from './guestApi';
import { clearLocalToken, getLocalToken } from './session';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const httpAdapter = axios.getAdapter(['xhr', 'http']);

export const api = axios.create({
  baseURL: BASE_URL,
});

api.defaults.adapter = async (config) => {
  const url = `${config.url || ''}`;
  const isAuth = url.includes('/auth/');
  if (useGuestStore.getState().isGuest && !isAuth) {
    return guestApi.fulfillGuestRequest(config);
  }
  return httpAdapter(config);
};

api.interceptors.request.use(async (config) => {
  const url = `${config.url || ''}`;
  const isAuth = url.includes('/auth/login') || url.includes('/auth/register');
  if (isAuth) return config;
  if (useGuestStore.getState().isGuest && !url.includes('/auth/')) return config;
  const local = getLocalToken();
  if (local) {
    config.headers.Authorization = `Bearer ${local}`;
    return config;
  }
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (useGuestStore.getState().isGuest) return Promise.reject(err);
    const url = String(err.config?.url || '');
    const skipRedirect = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/me');
    if (err.response?.status === 401 && !skipRedirect) {
      clearLocalToken();
      queryClient.clear();
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export const QK = {
  notes:       ()                          => ['notes']                                    as const,
  note:        (id: string)                => ['notes', id]                               as const,
  stickyNotes: (id: string)                => ['notes', id, 'stickyNotes']                as const,
  highlights:  (id: string)                => ['notes', id, 'highlights']                 as const,
  flashcards:  (id: string)                => ['notes', id, 'flashcards']                 as const,
  dueCards:    ()                          => ['flashcards', 'due']                       as const,
  mcqs:        (id: string, t: string)     => ['notes', id, 'topics', t, 'mcqs']          as const,
  imageStatus: (id: string, t: string)     => ['notes', id, 'topics', t, 'imageStatus']   as const,
  audioStatus: (id: string)                => ['notes', id, 'audioStatus']                as const,
  credits:     ()                          => ['credits']                                  as const,
  history:     ()                          => ['credits', 'history']                       as const,
  job:         (id: string)                => ['jobs', id]                                as const,
};
