'use strict';

require('dotenv').config();

const { connectDB }         = require('./config/db');
const { getStripe }         = require('./config/stripe');
const { getFirebaseAdmin }  = require('./config/firebase');
const { createLlmClient }   = require('./utils/llmProvider');
const { createGeminiImagenProvider } = require('./services/imageService');
const { createGoogleTtsProvider }    = require('./services/audioService');
const { createYoutubeTranscriptService } = require('./services/youtubeTranscriptService');
const { createLlmNotesService }          = require('./services/llmNotesService');
const { reserveCredits, refundCredits }  = require('./services/creditService');
const { youtubeNotesRateLimiter }        = require('./middleware/rateLimiter');

const UserModel       = require('./models/User');
const NoteModel       = require('./models/Note');
const TranscriptModel = require('./models/Transcript');
const StickyNoteModel = require('./models/StickyNote');
const FlashcardModel  = require('./models/Flashcard');
const HighlightModel  = require('./models/Highlight');
const McqSetModel     = require('./models/McqSet');
const JobModel        = require('./models/Job');

function createCaptionProvider() {
  try {
    const { YoutubeTranscript } = require('youtube-transcript');
    return {
      fetch: async (videoId) => {
        const result = await YoutubeTranscript.fetchTranscript(videoId);
        return result.map((seg) => ({
          start: typeof seg.offset === 'number' ? seg.offset / 1000 : (seg.start ?? 0),
          text:  seg.text,
        }));
      },
    };
  } catch {
    return {
      fetch: async () => {
        throw new Error('youtube-transcript package not installed. Run: npm install youtube-transcript');
      },
    };
  }
}

async function createRuntime() {
  await connectDB();

  let firebaseAdmin = null;
  try {
    firebaseAdmin = getFirebaseAdmin();
  } catch (err) {
    console.warn(`[Runtime] Firebase not configured (${err.message}). Email/password accounts still work.`);
  }
  let llmClient;
  try {
    llmClient = createLlmClient();
  } catch (err) {
    console.warn(`[Runtime] LLM not configured (${err.message}). Notes generation unavailable until you add a key.`);
    llmClient = {
      complete: async () => {
        throw new Error(err.message);
      },
    };
  }
  const captionProvider = createCaptionProvider();
  const transcriptService = createYoutubeTranscriptService({ captionProvider });
  const llmNotesService   = createLlmNotesService({ llmClient });

  const geminiApiKey    = process.env.GEMINI_API_KEY;
  const imagenProvider  = geminiApiKey
    ? createGeminiImagenProvider(geminiApiKey)
    : { generate: async () => { throw new Error('GEMINI_API_KEY not set — image generation unavailable'); } };

  const googleApiKey  = process.env.GOOGLE_TTS_API_KEY || geminiApiKey;
  const ttsProvider   = googleApiKey
    ? createGoogleTtsProvider(googleApiKey)
    : { synthesize: async () => { throw new Error('GOOGLE_TTS_API_KEY not set — audio generation unavailable'); } };

  let stripe = null;
  try {
    stripe = getStripe();
  } catch (err) {
    stripe = {
      checkout: { sessions: { create: async () => { throw new Error(err.message); } } },
      webhooks: { constructEvent: () => { throw new Error(err.message); } },
    };
  }

  return {
    firebaseAdmin,
    UserModel,
    NoteModel,
    TranscriptModel,
    StickyNoteModel,
    FlashcardModel,
    HighlightModel,
    McqSetModel,
    JobModel,
    transcriptService,
    llmNotesService,
    reserveCredits,
    refundCredits,
    rateLimiter: youtubeNotesRateLimiter,
    imagenProvider,
    ttsProvider,
    llmClient,
    stripe,
    runJobsSync: false,
  };
}

module.exports = { createRuntime };
