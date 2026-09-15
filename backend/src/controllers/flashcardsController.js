'use strict';

const { calculateNextReview, initialCardState } = require('../services/sm2Service');

/**
 * Flashcards Controller
 * Supports auto-generation from note topics and SM-2 review submission.
 */
function createFlashcardsController({ FlashcardModel, NoteModel }) {

  /**
   * POST /api/notes/:noteId/flashcards/generate
   * Auto-generates flashcards from all topics in a note.
   * For each topic: front = topic title question, back = revisionPoints summary.
   * Skips topics that already have cards (idempotent).
   */
  async function generate(req, res) {
    try {
      const { noteId } = req.params;

      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id }).lean();
      if (!note) return res.status(404).json({ error: 'Note not found' });
      if (!note.topics || note.topics.length === 0) {
        return res.status(422).json({ error: 'Note has no topics to generate flashcards from' });
      }

      // Find which topicIds already have cards for this user+note
      const existing = await FlashcardModel.find({ noteId, ownerId: req.user.id }, 'topicId').lean();
      const existingTopicIds = new Set(existing.map(c => c.topicId));

      const toCreate = note.topics
        .filter(t => !existingTopicIds.has(t.topicId))
        .map(t => {
          const revPoints = t.revisionPoints?.length > 0
            ? t.revisionPoints.join('\n• ')
            : t.content.slice(0, 300);

          return {
            ownerId: req.user.id,
            noteId,
            topicId: t.topicId,
            front: `What are the key points of: "${t.title}"?`,
            back: `• ${revPoints}`,
            ...initialCardState(),
          };
        });

      if (toCreate.length === 0) {
        return res.json({ created: 0, message: 'All topics already have flashcards' });
      }

      const created = await FlashcardModel.insertMany(toCreate);
      return res.status(201).json({ created: created.length, flashcards: created });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to generate flashcards' });
    }
  }

  /**
   * GET /api/notes/:noteId/flashcards
   * Lists all flashcards for a note. Optionally filter &due=true for today's review queue.
   */
  async function list(req, res) {
    try {
      const { noteId } = req.params;
      const { due } = req.query;

      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const filter = { noteId, ownerId: req.user.id };
      if (due === 'true') {
        filter.nextReviewDate = { $lte: new Date() };
      }

      const cards = await FlashcardModel.find(filter).sort({ nextReviewDate: 1 }).lean();
      return res.json({ flashcards: cards, count: cards.length });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch flashcards' });
    }
  }

  /**
   * POST /api/flashcards/:id/review
   * Submit a review quality (0-5) and apply SM-2 algorithm.
   */
  async function review(req, res) {
    try {
      const { id } = req.params;
      const { quality } = req.body;

      if (quality === undefined || !Number.isInteger(quality) || quality < 0 || quality > 5) {
        return res.status(400).json({ error: 'quality must be an integer 0-5' });
      }

      const card = await FlashcardModel.findOne({ _id: id, ownerId: req.user.id });
      if (!card) return res.status(404).json({ error: 'Flashcard not found' });

      const { ef, interval, repetitions, nextReviewDate } = calculateNextReview(card, quality);

      card.ef = ef;
      card.interval = interval;
      card.repetitions = repetitions;
      card.nextReviewDate = nextReviewDate;
      await card.save();

      return res.json({ flashcard: card });
    } catch (err) {
      if (err.message?.startsWith('SM-2')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Failed to submit review' });
    }
  }

  /** DELETE /api/flashcards/:id */
  async function remove(req, res) {
    try {
      const { id } = req.params;
      const deleted = await FlashcardModel.findOneAndDelete({ _id: id, ownerId: req.user.id });
      if (!deleted) return res.status(404).json({ error: 'Flashcard not found' });
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete flashcard' });
    }
  }

  /**
   * GET /api/flashcards/due
   * Cross-note review queue for the signed-in user.
   */
  async function due(req, res) {
    try {
      const cards = await FlashcardModel.find({
        ownerId: req.user.id,
        nextReviewDate: { $lte: new Date() },
      }).sort({ nextReviewDate: 1 }).lean();
      return res.json({ flashcards: cards, count: cards.length });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch due flashcards' });
    }
  }

  return { generate, list, review, remove, due };
}

module.exports = { createFlashcardsController };
