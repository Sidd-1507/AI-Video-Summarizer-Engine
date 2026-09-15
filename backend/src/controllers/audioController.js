'use strict';

const { generateAudioOverview } = require('../services/audioService');

/**
 * Audio Overview Controller — Google TTS
 * Generates podcast-style audio for a note's topics.
 * Supports formats: 'deepDive', 'brief', 'all'
 */
function createAudioController({ NoteModel, ttsProvider }) {

  /**
   * POST /api/notes/:noteId/audio
   * Body: { format: 'deepDive' | 'brief' | 'all' }
   * Returns 202 Accepted, generates async, updates note.audioOverview.
   */
  async function generate(req, res) {
    const { noteId } = req.params;
    const format = req.body?.format || 'all';

    if (!['deepDive', 'brief', 'all'].includes(format)) {
      return res.status(400).json({ error: 'format must be deepDive, brief, or all' });
    }

    const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (!note.topics || note.topics.length === 0) {
      return res.status(422).json({ error: 'Note has no topics to generate audio from' });
    }

    if (note.audioStatus === 'pending') {
      return res.status(409).json({ error: 'Audio generation already in progress' });
    }

    // Set pending
    note.audioStatus = 'pending';
    await note.save();

    res.status(202).json({ message: 'Audio generation started', format, status: 'pending' });

    // Run async after response. Guard against DB disconnect (e.g. during tests).
    const mongoose = require('mongoose');
    setImmediate(async () => {
      try {
        if (mongoose.connection.readyState !== 1) return;
        const urls = await generateAudioOverview({
          ttsProvider,
          noteId: String(note._id),
          noteTitle: note.title,
          topics: note.topics,
          format,
        });

        if (mongoose.connection.readyState !== 1) return;
        const update = { audioStatus: 'ready' };
        if (urls.deepDive) update['audioOverview.deepDive'] = urls.deepDive;
        if (urls.brief)    update['audioOverview.brief']    = urls.brief;

        await NoteModel.findByIdAndUpdate(noteId, { $set: update });
      } catch (err) {
        // Swallow MongoNotConnectedError (test teardown) and any other async errors
        if (err.name === 'MongoNotConnectedError' || mongoose.connection.readyState !== 1) return;
        await NoteModel.findByIdAndUpdate(noteId, { $set: { audioStatus: 'failed' } }).catch(() => {});
      }
    });
  }

  /**
   * GET /api/notes/:noteId/audio
   * Returns current audio status and URLs if ready.
   */
  async function status(req, res) {
    const { noteId } = req.params;
    const note = await NoteModel.findOne(
      { _id: noteId, ownerId: req.user.id },
      { audioStatus: 1, audioOverview: 1 }
    ).lean();

    if (!note) return res.status(404).json({ error: 'Note not found' });

    return res.json({
      audioStatus:   note.audioStatus,
      audioOverview: note.audioOverview || {},
    });
  }

  return { generate, status };
}

module.exports = { createAudioController };
