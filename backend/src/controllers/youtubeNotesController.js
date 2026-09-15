'use strict';

const { startYoutubeNotes } = require('../services/jobService');
const { extractOptions } = require('../services/youtubeNotesOrchestrator');
const { InsufficientCreditsError } = require('../services/creditService');
const { InvalidYoutubeUrlError } = require('../utils/youtubeUrl');
const { NoCaptionsError, TranscriptFetchError } = require('../services/youtubeTranscriptService');
const { LLMResponseValidationError } = require('../services/llmNotesService');

function createYoutubeNotesController(deps) {
  async function create(req, res) {
    const { youtubeUrl } = req.validatedBody;
    const options = extractOptions(req.validatedBody);

    try {
      const { note, job, httpStatus } = await startYoutubeNotes(deps, {
        userId: req.user.id,
        youtubeUrl,
        options,
      });

      if (note.ownerId.toString() !== req.user.id) {
        return res.status(500).json({ error: 'Internal error' });
      }

      return res.status(httpStatus).json({
        jobId: job._id,
        note,
      });
    } catch (err) {
      return handleError(err, res);
    }
  }

  return { create };
}

function handleError(err, res) {
  if (err instanceof InvalidYoutubeUrlError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof NoCaptionsError) {
    return res.status(422).json({ error: 'This video has no captions available.' });
  }
  if (err instanceof InsufficientCreditsError) {
    return res.status(402).json({ error: 'Not enough credits. Please top up.' });
  }
  if (err instanceof TranscriptFetchError || err instanceof LLMResponseValidationError) {
    return res.status(502).json({ error: 'Notes could not be generated right now. Please try again.' });
  }
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

module.exports = { createYoutubeNotesController, handleGenerationError: handleError };
