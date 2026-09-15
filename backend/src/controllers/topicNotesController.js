'use strict';

const { startTopicNotes } = require('../services/jobService');
const { extractOptions } = require('../services/youtubeNotesOrchestrator');
const { handleGenerationError } = require('./youtubeNotesController');

function createTopicNotesController(deps) {
  async function create(req, res) {
    const { topic } = req.validatedBody;
    const options = extractOptions(req.validatedBody);

    try {
      const { note, job, httpStatus } = await startTopicNotes(deps, {
        userId: req.user.id,
        topic,
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
      return handleGenerationError(err, res);
    }
  }

  return { create };
}

module.exports = { createTopicNotesController };
