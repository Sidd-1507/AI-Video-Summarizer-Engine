'use strict';

/**
 * Sticky Notes Controller
 * All ops are scoped to req.user.id — users can only see/edit their own notes.
 */
function createStickyNotesController({ StickyNoteModel, NoteModel }) {

  /** POST /api/notes/:noteId/sticky-notes */
  async function create(req, res) {
    try {
      const { noteId } = req.params;
      const { topicId, content, color, youtubeTimestamp } = req.body;

      if (!topicId || !content) {
        return res.status(400).json({ error: 'topicId and content are required' });
      }
      if (content.length > 2000) {
        return res.status(400).json({ error: 'content exceeds 2000 characters' });
      }

      const VALID_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'red', 'orange'];
      const resolvedColor = color || 'yellow';
      if (!VALID_COLORS.includes(resolvedColor)) {
        return res.status(400).json({ error: `color must be one of: ${VALID_COLORS.join(', ')}` });
      }

      // Verify the note exists and belongs to this user
      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const sticky = await StickyNoteModel.create({
        ownerId: req.user.id,
        noteId,
        topicId,
        content,
        color: resolvedColor,
        youtubeTimestamp: youtubeTimestamp ?? null,
        x: req.body.x ?? 40,
        y: req.body.y ?? 40,
        w: req.body.w ?? 220,
        h: req.body.h ?? 180,
      });

      return res.status(201).json({ stickyNote: sticky });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create sticky note' });
    }
  }

  /** GET /api/notes/:noteId/sticky-notes */
  async function list(req, res) {
    try {
      const { noteId } = req.params;

      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const stickies = await StickyNoteModel.find({ noteId, ownerId: req.user.id })
        .sort({ createdAt: -1 })
        .lean();

      return res.json({ stickyNotes: stickies });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch sticky notes' });
    }
  }

  /** PATCH /api/sticky-notes/:id */
  async function update(req, res) {
    try {
      const { id } = req.params;
      const { content, color, youtubeTimestamp, x, y, w, h } = req.body;

      if (content && content.length > 2000) {
        return res.status(400).json({ error: 'content exceeds 2000 characters' });
      }

      const updates = {};
      if (content !== undefined) updates.content = content;
      if (color !== undefined) updates.color = color;
      if (youtubeTimestamp !== undefined) updates.youtubeTimestamp = youtubeTimestamp;
      if (x !== undefined) updates.x = x;
      if (y !== undefined) updates.y = y;
      if (w !== undefined) updates.w = w;
      if (h !== undefined) updates.h = h;

      const sticky = await StickyNoteModel.findOneAndUpdate(
        { _id: id, ownerId: req.user.id },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!sticky) return res.status(404).json({ error: 'Sticky note not found' });
      return res.json({ stickyNote: sticky });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update sticky note' });
    }
  }

  /** DELETE /api/sticky-notes/:id */
  async function remove(req, res) {
    try {
      const { id } = req.params;
      const deleted = await StickyNoteModel.findOneAndDelete({ _id: id, ownerId: req.user.id });
      if (!deleted) return res.status(404).json({ error: 'Sticky note not found' });
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete sticky note' });
    }
  }

  return { create, list, update, remove };
}

module.exports = { createStickyNotesController };
