'use strict';

const { generateTopicImage } = require('../services/imageService');

/**
 * Image Controller — Gemini Imagen 3 topic image generation.
 * Generates an educational image for one topic and updates the Note document.
 */
function createImageController({ NoteModel, imagenProvider }) {

  /**
   * POST /api/notes/:noteId/topics/:topicId/image
   * Triggers Imagen 3 generation for one topic.
   * Updates note.topics[].imageUrl and imageStatus on success/failure.
   */
  async function generate(req, res) {
    const { noteId, topicId } = req.params;
    try {
      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const topicIndex = note.topics.findIndex(t => t.topicId === topicId);
      if (topicIndex === -1) return res.status(404).json({ error: 'Topic not found in note' });

      const topic = note.topics[topicIndex];

      // Check if already generating (prevent double-trigger)
      if (topic.imageStatus === 'pending') {
        return res.status(409).json({ error: 'Image generation already in progress' });
      }

      // Set pending immediately so UI can show spinner
      note.topics[topicIndex].imageStatus = 'pending';
      await note.save();

      // Acknowledge request (202 Accepted) — generation runs asynchronously
      res.status(202).json({ message: 'Image generation started', topicId, status: 'pending' });

      // Run generation async. Guard against DB disconnect (e.g. during tests).
      const mongoose = require('mongoose');
      setImmediate(async () => {
        if (mongoose.connection.readyState !== 1) return; // DB already closed
        try {
          const imageUrl = await generateTopicImage({ imagenProvider, noteId, topic });
          if (mongoose.connection.readyState !== 1) return;
          await NoteModel.findOneAndUpdate(
            { _id: noteId, 'topics.topicId': topicId },
            { $set: { 'topics.$.imageUrl': imageUrl, 'topics.$.imageStatus': 'ready' } }
          );
        } catch (err) {
          if (mongoose.connection.readyState !== 1) return;
          await NoteModel.findOneAndUpdate(
            { _id: noteId, 'topics.topicId': topicId },
            { $set: { 'topics.$.imageStatus': 'failed' } }
          ).catch(() => {});
        }
      });
    } catch (err) {
      if (err.name === 'CastError') return res.status(404).json({ error: 'Note not found' });
      return res.status(500).json({ error: 'Image generation failed' });
    }
  }

  /**
   * GET /api/notes/:noteId/topics/:topicId/image
   * Polls current image status (pending/ready/failed) + URL if ready.
   */
  async function status(req, res) {
    const { noteId, topicId } = req.params;
    try {
      const note = await NoteModel.findOne(
        { _id: noteId, ownerId: req.user.id },
        { 'topics.$': 1 }
      ).where('topics.topicId').equals(topicId).lean();

      if (!note || !note.topics?.[0]) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const topic = note.topics[0];
      return res.json({
        topicId,
        imageStatus: topic.imageStatus,
        imageUrl:    topic.imageUrl || null,
      });
    } catch (err) {
      if (err.name === 'CastError') return res.status(404).json({ error: 'Note not found' });
      return res.status(500).json({ error: 'Failed to get image status' });
    }
  }

  return { generate, status };
}

module.exports = { createImageController };
