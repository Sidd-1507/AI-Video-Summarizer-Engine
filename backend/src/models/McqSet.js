'use strict';

const mongoose = require('mongoose');

/**
 * MCQ (Multiple Choice Question) set per topic.
 * One McqSet = all MCQs for one topicId in one note.
 * 4 options (A-D), one correct answer, an explanation for learning.
 */
const mcqOptionSchema = new mongoose.Schema(
  {
    label:   { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    text:    { type: String, required: true, maxlength: 500 },
  },
  { _id: false }
);

const mcqQuestionSchema = new mongoose.Schema(
  {
    question:      { type: String, required: true, maxlength: 1000 },
    options:       { type: [mcqOptionSchema], required: true },
    correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    explanation:   { type: String, required: true, maxlength: 1000 },
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  },
  { _id: false }
);

const mcqSetSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
    noteId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Note',  required: true, index: true },
    topicId: { type: String, required: true, maxlength: 100 },
    questions: { type: [mcqQuestionSchema], default: [] },
    // track user quiz attempts: { score, totalQuestions, attemptedAt }
    attempts: [
      {
        score:          { type: Number, required: true },
        totalQuestions: { type: Number, required: true },
        attemptedAt:    { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// One McqSet per (owner, note, topic)
mcqSetSchema.index({ noteId: 1, topicId: 1, ownerId: 1 }, { unique: true });

module.exports = mongoose.model('McqSet', mcqSetSchema);
