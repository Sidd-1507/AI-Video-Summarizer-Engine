'use strict';

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const mongoSanitize = require('express-mongo-sanitize');

const { createAuthMiddleware }          = require('./middleware/auth');
const { youtubeNotesRateLimiter, generationRateLimiter } = require('./middleware/rateLimiter');
const {
  validateYoutubeNotesRequest,
  validateTopicNotesRequest,
  validatePatchNoteRequest,
} = require('./middleware/validateRequest');

const { createYoutubeNotesController }  = require('./controllers/youtubeNotesController');
const { createTopicNotesController }    = require('./controllers/topicNotesController');
const { createNotesController }         = require('./controllers/notesController');
const { createJobsController }          = require('./controllers/jobsController');
const { createStickyNotesController }   = require('./controllers/stickyNotesController');
const { createFlashcardsController }    = require('./controllers/flashcardsController');
const { createHighlightsController }    = require('./controllers/highlightsController');
const { createCreditsController }       = require('./controllers/creditsController');
const { createStripeController }        = require('./controllers/stripeController');
const { createImageController }         = require('./controllers/imageController');
const { createAudioController }         = require('./controllers/audioController');
const { createMcqController }           = require('./controllers/mcqController');
const { createAuthController }          = require('./controllers/authController');

const { createYoutubeNotesRouter }  = require('./routes/youtubeNotes.routes');
const { createTopicNotesRouter }    = require('./routes/topicNotes.routes');
const { createNotesRouter }         = require('./routes/notes.routes');
const { createJobsRouter }          = require('./routes/jobs.routes');
const { createStickyNotesRouter }   = require('./routes/stickyNotes.routes');
const { createFlashcardsRouter }    = require('./routes/flashcards.routes');
const { createHighlightsRouter }    = require('./routes/highlights.routes');
const { createCreditsRouter }       = require('./routes/credits.routes');
const { createStripeRouter }        = require('./routes/stripe.routes');
const { createImageRouter }         = require('./routes/image.routes');
const { createAudioRouter }         = require('./routes/audio.routes');
const { createMcqRouter }           = require('./routes/mcq.routes');
const { createAuthRouter }          = require('./routes/auth.routes');

const defaultJobModel = () => require('./models/Job');

function createApp(deps) {
  const app = express();
  const JobModel = deps.JobModel || defaultJobModel();

  app.use(helmet());
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
  app.use(cors({ origin: allowedOrigin, credentials: true }));

  const stripeController = createStripeController({
    stripe: deps.stripe,
    UserModel: deps.UserModel,
  });

  // Stripe webhook needs the raw body for HMAC verification — register before json parser.
  app.post('/api/stripe/webhook', express.raw({ type: () => true }), (req, res, next) => {
    if (Buffer.isBuffer(req.body)) req.rawBody = req.body.toString('utf8');
    else if (typeof req.body === 'string') req.rawBody = req.body;
    else req.rawBody = req.body;
    Promise.resolve(stripeController.webhook(req, res)).catch(next);
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(mongoSanitize());

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: 'exam-notes-ai', ts: new Date().toISOString() })
  );

  const authenticate = createAuthMiddleware({
    firebaseAdmin: deps.firebaseAdmin,
    UserModel:     deps.UserModel,
  });

  app.use('/api', createAuthRouter({
    authenticate,
    controller: createAuthController({ UserModel: deps.UserModel }),
  }));

  const generationDeps = {
    ...deps,
    JobModel,
  };

  const rateLimiter = deps.rateLimiter || youtubeNotesRateLimiter;

  app.use('/api', createNotesRouter({
    authenticate,
    validatePatchNoteRequest,
    controller: createNotesController({
      NoteModel: deps.NoteModel,
      TranscriptModel: deps.TranscriptModel,
    }),
  }));

  app.use('/api', createJobsRouter({
    authenticate,
    controller: createJobsController({ JobModel }),
  }));

  app.use('/api', createYoutubeNotesRouter({
    authenticate,
    rateLimiter,
    validateYoutubeNotesRequest,
    controller: createYoutubeNotesController(generationDeps),
  }));

  app.use('/api', createTopicNotesRouter({
    authenticate,
    rateLimiter: deps.rateLimiter || generationRateLimiter,
    validateTopicNotesRequest,
    controller: createTopicNotesController(generationDeps),
  }));

  app.use('/api', createStickyNotesRouter({
    authenticate,
    controller: createStickyNotesController({ StickyNoteModel: deps.StickyNoteModel, NoteModel: deps.NoteModel }),
  }));

  app.use('/api', createFlashcardsRouter({
    authenticate,
    controller: createFlashcardsController({ FlashcardModel: deps.FlashcardModel, NoteModel: deps.NoteModel }),
  }));

  app.use('/api', createHighlightsRouter({
    authenticate,
    controller: createHighlightsController({ HighlightModel: deps.HighlightModel, NoteModel: deps.NoteModel }),
  }));

  app.use('/api', createCreditsRouter({
    authenticate,
    controller: createCreditsController({ UserModel: deps.UserModel }),
  }));

  app.use('/api', createStripeRouter({
    authenticate,
    controller: stripeController,
  }));

  app.use('/api', createImageRouter({
    authenticate,
    controller: createImageController({ NoteModel: deps.NoteModel, imagenProvider: deps.imagenProvider }),
  }));

  app.use('/api', createAudioRouter({
    authenticate,
    controller: createAudioController({ NoteModel: deps.NoteModel, ttsProvider: deps.ttsProvider }),
  }));

  app.use('/api', createMcqRouter({
    authenticate,
    controller: createMcqController({ McqSetModel: deps.McqSetModel, NoteModel: deps.NoteModel, llmClient: deps.llmClient }),
  }));

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Resource not found' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    const status = typeof err.status === 'number' && err.status >= 400
      ? err.status
      : typeof err.statusCode === 'number' && err.statusCode >= 400
        ? err.statusCode
        : 500;
    if (status === 500) console.error('[App] Unhandled error:', err?.message || err);
    res.status(status).json({ error: err.message || 'Unexpected server error' });
  });

  return app;
}

module.exports = { createApp };
