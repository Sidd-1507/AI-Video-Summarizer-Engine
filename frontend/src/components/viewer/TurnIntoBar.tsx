import { Image, FileQuestion, Headphones } from 'lucide-react';
import { useGenerateImage, useImageStatus } from '../../hooks/useImage';
import { useGenerateAudio, useAudioStatus } from '../../hooks/useAudio';
import { useGuestStore } from '../../store/useGuestStore';

export function TurnIntoBar({
  noteId,
  topicId,
  onOpenQuiz,
}: {
  noteId: string;
  topicId: string;
  onOpenQuiz: () => void;
}) {
  const generateImage = useGenerateImage(noteId, topicId);
  const generateAudio = useGenerateAudio(noteId);
  const { data: imageData } = useImageStatus(noteId, topicId);
  const { data: audioData } = useAudioStatus(noteId);
  const openSignIn = useGuestStore((s) => s.openSignInPrompt);

  function locked(err: unknown) {
    return Boolean((err as { response?: { data?: { locked?: boolean } } })?.response?.data?.locked);
  }

  const imageLabel =
    generateImage.isPending || imageData?.imageStatus === 'pending' ? 'Generating…'
    : imageData?.imageStatus === 'ready' ? 'Ready'
    : 'Diagram';

  const audioLabel =
    generateAudio.isPending || audioData?.audioStatus === 'pending' ? 'Generating…'
    : audioData?.audioStatus === 'ready' ? 'Ready'
    : 'Audio overview';

  return (
    <div className="mt-6">
      <p className="text-caption text-ink-400 uppercase tracking-wider px-2 mb-2.5">Generate</p>
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => generateImage.mutate(undefined, { onError: (e) => locked(e) && openSignIn() })}
          disabled={generateImage.isPending || imageData?.imageStatus === 'pending'}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-meta text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors disabled:opacity-40"
        >
          <Image size={14} strokeWidth={1.7} />
          {imageLabel}
        </button>
        <button
          type="button"
          onClick={onOpenQuiz}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-meta text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors"
        >
          <FileQuestion size={14} strokeWidth={1.7} />
          Quiz
        </button>
        <button
          type="button"
          onClick={() => generateAudio.mutate('brief', { onError: (e) => locked(e) && openSignIn() })}
          disabled={generateAudio.isPending || audioData?.audioStatus === 'pending'}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-meta text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors disabled:opacity-40"
        >
          <Headphones size={14} strokeWidth={1.7} />
          {audioLabel}
        </button>
      </div>
    </div>
  );
}
