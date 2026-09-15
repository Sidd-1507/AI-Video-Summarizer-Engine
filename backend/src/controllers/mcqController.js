'use strict';

const { generateMcqs, McqGenerationError } = require('../services/mcqService');

/**
 * MCQ Controller
 * Generates, stores, retrieves MCQ sets, and records quiz attempts.
 */
function createMcqController({ McqSetModel, NoteModel, llmClient }) {

  const VALID_OPTIONS = new Set(['A', 'B', 'C', 'D']);

  /**
   * POST /api/notes/:noteId/topics/:topicId/mcqs
   * Generates (or regenerates) MCQs for a topic. Idempotent — overwrites existing.
   * Body: { count: 5 }
   */
  async function generate(req, res) {
    try {
      const { noteId, topicId } = req.params;
      const count = Math.min(parseInt(req.body?.count) || 5, 10);

      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id }).lean();
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const topic = note.topics?.find(t => t.topicId === topicId);
      if (!topic) return res.status(404).json({ error: 'Topic not found' });

      // Generate then slice to exactly `count` (stub may return more)
      const allQuestions = await generateMcqs({ llmClient, topic, count });
      const questions = allQuestions.slice(0, count);

      const mcqSet = await McqSetModel.findOneAndUpdate(
        { noteId, topicId, ownerId: req.user.id },
        { $set: { questions } },
        { upsert: true, new: true }
      );

      return res.status(201).json({ mcqSet });
    } catch (err) {
      if (err instanceof McqGenerationError) {
        return res.status(502).json({ error: 'MCQ generation failed. Please try again.' });
      }
      return res.status(500).json({ error: 'Failed to generate MCQs' });
    }
  }

  /**
   * GET /api/notes/:noteId/topics/:topicId/mcqs
   * Returns the stored MCQ set for a topic.
   */
  async function get(req, res) {
    try {
      const { noteId, topicId } = req.params;

      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const mcqSet = await McqSetModel.findOne({ noteId, topicId, ownerId: req.user.id }).lean();
      if (!mcqSet) return res.status(404).json({ error: 'No MCQs generated yet for this topic' });

      return res.json({ mcqSet });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch MCQs' });
    }
  }

  /**
   * POST /api/notes/:noteId/topics/:topicId/mcqs/submit
   * Records a quiz attempt with score.
   * Body: { answers: [{ questionIndex: 0, selected: 'A' }, ...] }
   */
  async function submit(req, res) {
    try {
      const { noteId, topicId } = req.params;
      const { answers } = req.body;

      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ error: 'answers array is required' });
      }

      // Validate each answer's selected value is A-D
      for (const ans of answers) {
        if (!VALID_OPTIONS.has(ans.selected)) {
          return res.status(400).json({
            error: `Invalid option "${ans.selected}" at questionIndex ${ans.questionIndex}. Must be A, B, C, or D.`,
          });
        }
      }

      const note = await NoteModel.findOne({ _id: noteId, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const mcqSet = await McqSetModel.findOne({ noteId, topicId, ownerId: req.user.id });
      if (!mcqSet) return res.status(404).json({ error: 'No MCQs for this topic. Generate them first.' });

      // Grade the quiz
      let correct = 0;
      const graded = answers.map(({ questionIndex, selected }) => {
        const q = mcqSet.questions[questionIndex];
        if (!q) return { questionIndex, selected, correct: false, error: 'invalid questionIndex' };
        const isCorrect = q.correctAnswer === selected;
        if (isCorrect) correct++;
        return {
          questionIndex,
          selected,
          correct: isCorrect,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        };
      });

      // Record attempt
      mcqSet.attempts.push({
        score: correct,
        totalQuestions: mcqSet.questions.length,
        attemptedAt: new Date(),
      });
      await mcqSet.save();

      return res.json({
        score: correct,
        total: mcqSet.questions.length,
        percentage: Math.round((correct / mcqSet.questions.length) * 100),
        graded,       // legacy field — keep for integration test compat
        breakdown: graded,  // alias used by E2E test and frontend
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to submit quiz' });
    }
  }

  return { generate, get, submit };
}

module.exports = { createMcqController };
