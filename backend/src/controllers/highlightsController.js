'use strict';

function createHighlightsController({ HighlightModel, NoteModel }) {

  /** POST /api/notes/:noteId/highlights */
  async function create(req, res) {
    try {
      const { noteId } = req.params;
      const { topicId, text, startOffset, endOffset, color } = req.body;

      if (!topicId || !text || startOffset === undefined || endOffset === undefined) {
        return res.status(400).json({ error: 'topicId, text, startOffset, endOffset are required' });
      }
      if (endOffset <= startOffset) {
        return res.status(400).json({ error: 'endOffset must be greater than startOffset' });
      }
      if (text.length > 5000) {
        return res.status(400).json({ error: 'highlighted text exceeds 5000 characters' });
      }

      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const highlight = await HighlightModel.create({
        ownerId: req.user.id,
        noteId,
        topicId,
        text,
        startOffset,
        endOffset,
        color: color || 'yellow',
      });

      return res.status(201).json({ highlight });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create highlight' });
    }
  }

  /** GET /api/notes/:noteId/highlights */
  async function list(req, res) {
    try {
      const { noteId } = req.params;
      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const highlights = await HighlightModel.find({ noteId, ownerId: req.user.id })
        .sort({ topicId: 1, startOffset: 1 })
        .lean();

      return res.json({ highlights });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch highlights' });
    }
  }

  /** DELETE /api/highlights/:id */
  async function remove(req, res) {
    try {
      const { id } = req.params;
      const deleted = await HighlightModel.findOneAndDelete({ _id: id, ownerId: req.user.id });
      if (!deleted) return res.status(404).json({ error: 'Highlight not found' });
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete highlight' });
    }
  }

  return { create, list, remove };
}

module.exports = { createHighlightsController };
