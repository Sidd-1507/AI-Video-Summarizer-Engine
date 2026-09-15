import { useNavigate } from 'react-router-dom';
import { ytThumb, relativeDate } from '../../lib/utils';
import type { Note } from '../../types/api';

export function NoteCard({ note }: { note: Note }) {
  const navigate = useNavigate();
  const videoId = note.source?.videoId;

  return (
    <button
      type="button"
      onClick={() => navigate(`/notes/${note._id}`)}
      className="text-left border border-ink-100 rounded-md overflow-hidden cursor-pointer hover:border-ink-200 hover:shadow-1 transition-all bg-paper"
    >
      <div className="relative h-[104px] bg-ink-900 flex items-center justify-center overflow-hidden">
        {videoId && (
          <img
            src={ytThumb(videoId)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="w-8 h-8 rounded-full bg-white/14 flex items-center justify-center relative z-10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" aria-hidden>
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
        {note.status !== 'ready' && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-caption px-1.5 py-0.5 rounded-sm">
            {note.status}
          </span>
        )}
      </div>
      <div className="px-3.5 pt-3 pb-3.5">
        <h4 className="text-card font-semibold text-ink-900 line-clamp-2 leading-snug mb-1.5">
          {note.title}
        </h4>
        <p className="text-caption text-ink-400">
          {note.topics?.length ?? 0} topics, {relativeDate(note.createdAt)}
        </p>
      </div>
    </button>
  );
}
