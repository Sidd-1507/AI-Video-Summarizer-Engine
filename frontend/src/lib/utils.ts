import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind class merging utility */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Stable per-note rotation seeded from MongoDB _id.
 * Always returns a value in -2..2 degrees.
 * Never use Math.random() here — the rotation must be stable across re-renders.
 */
export function seededRotation(id: string): number {
  const hash = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return (Math.abs(hash) % 5) - 2;
}

/** Map backend StickyNote.color enum to Tailwind classes (v2 sticky-token pairs) */
export const STICKY_COLOR_MAP: Record<string, { bg: string; border: string }> = {
  yellow: { bg: 'bg-sticky-a',  border: 'border-sticky-a-b' },
  blue:   { bg: 'bg-sticky-b',  border: 'border-sticky-b-b' },
  purple: { bg: 'bg-sticky-c',  border: 'border-sticky-c-b' },
  green:  { bg: 'bg-sticky-d',  border: 'border-sticky-d-b' },
  red:    { bg: 'bg-sticky-e',  border: 'border-sticky-e-b' },
  orange: { bg: 'bg-sticky-f',  border: 'border-sticky-f-b' },
  pink:   { bg: 'bg-sticky-g',  border: 'border-sticky-g-b' },
};

/** YouTube thumbnail URL from video ID */
export function ytThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/** Extract an 11-char YouTube video id from a URL or bare id */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && id.length === 11 ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && v.length === 11) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]?.length === 11) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Escape untrusted AI text before injecting into TipTap HTML */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Relative date formatting (e.g. "2d ago", "1w ago") */
export function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
