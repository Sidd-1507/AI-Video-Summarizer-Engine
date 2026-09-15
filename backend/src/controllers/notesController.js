'use strict';

const StickyNote = require('../models/StickyNote');
const Highlight = require('../models/Highlight');
const Flashcard = require('../models/Flashcard');
const McqSet = require('../models/McqSet');
const Job = require('../models/Job');
const Transcript = require('../models/Transcript');

function createNotesController({ NoteModel, TranscriptModel }) {
  const Transcripts = TranscriptModel || Transcript;

  async function list(req, res) {
    try {
      const notes = await NoteModel.find({ ownerId: req.user.id })
        .sort({ createdAt: -1 })
        .select('_id title source status topics examMeta version createdAt updatedAt audioStatus')
        .lean();
      return res.json({ notes });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch notes' });
    }
  }

  async function detail(req, res) {
    try {
      const note = await NoteModel.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
      if (!note) return res.status(404).json({ error: 'Note not found' });
      return res.json({ note });
    } catch (err) {
      if (err.name === 'CastError') return res.status(404).json({ error: 'Note not found' });
      return res.status(500).json({ error: 'Failed to fetch note' });
    }
  }

  async function update(req, res) {
    try {
      const { version, title, topics, examMeta } = req.validatedBody;
      const note = await NoteModel.findOne({ _id: req.params.id, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });
      if (note.version !== version) {
        return res.status(409).json({
          error: 'Note has been modified. Reload and try again.',
          version: note.version,
        });
      }

      if (title !== undefined) note.title = title;
      if (examMeta !== undefined) {
        note.examMeta = { ...note.examMeta?.toObject?.() || note.examMeta || {}, ...examMeta };
      }
      if (topics !== undefined) {
        const byId = new Map(note.topics.map((t) => [t.topicId, t.toObject ? t.toObject() : t]));
        note.topics = topics.map((patch) => {
          const current = byId.get(patch.topicId);
          if (!current) {
            return {
              topicId: patch.topicId,
              title: patch.title || 'Untitled',
              priority: patch.priority || 2,
              content: patch.content || '',
              diagrams: patch.diagrams || [],
              charts: patch.charts || [],
              revisionPoints: patch.revisionPoints || [],
              questions: patch.questions || [],
            };
          }
          return { ...current, ...patch };
        });
      }

      note.version += 1;
      await note.save();
      return res.json({ note });
    } catch (err) {
      if (err.name === 'CastError') return res.status(404).json({ error: 'Note not found' });
      if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
      return res.status(500).json({ error: 'Failed to update note' });
    }
  }

  async function transcript(req, res) {
    try {
      const note = await NoteModel.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
      if (!note) return res.status(404).json({ error: 'Note not found' });
      if (!note.source?.transcriptId) {
        return res.status(404).json({ error: 'No transcript for this note' });
      }
      const doc = await Transcripts.findOne({
        _id: note.source.transcriptId,
        ownerId: req.user.id,
      }).lean();
      if (!doc) return res.status(404).json({ error: 'Transcript not found' });
      return res.json({ transcript: doc });
    } catch (err) {
      if (err.name === 'CastError') return res.status(404).json({ error: 'Note not found' });
      return res.status(500).json({ error: 'Failed to fetch transcript' });
    }
  }

  async function remove(req, res) {
    try {
      const note = await NoteModel.findOne({ _id: req.params.id, ownerId: req.user.id });
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const noteId = note._id;
      const ownerId = req.user.id;
      await Promise.all([
        NoteModel.deleteOne({ _id: noteId, ownerId }),
        StickyNote.deleteMany({ noteId, ownerId }),
        Highlight.deleteMany({ noteId, ownerId }),
        Flashcard.deleteMany({ noteId, ownerId }),
        McqSet.deleteMany({ noteId, ownerId }),
        Job.deleteMany({ noteId, ownerId }),
      ]);

      return res.status(204).end();
    } catch (err) {
      if (err.name === 'CastError') return res.status(404).json({ error: 'Note not found' });
      return res.status(500).json({ error: 'Failed to delete note' });
    }
  }

  return { list, detail, update, transcript, remove };
}

module.exports = { createNotesController };
