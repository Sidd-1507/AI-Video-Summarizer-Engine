'use strict';

const mongoose = require('mongoose');

/**
 * Flashcard stores the SM-2 spaced repetition state per card.
 *
 * SM-2 fields:
 *   ef          — Easiness Factor (≥ 1.3). Starts at 2.5. Controls interval growth.
 *   interval    — Days until next review. Starts at 1, then 6, then ef*prev.
 *   repetitions — How many times reviewed successfully in a row (quality ≥ 3).
 *   nextReviewDate — The actual date the card is due for review.
 *
 * A "lapse" (quality < 3) resets repetitions to 0 and interval to 1.
 */
const flashcardSchema = new mongoose.Schema(
  {
    ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
    noteId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Note',  required: true, index: true },
    topicId:   { type: String, required: true, maxlength: 100 },
    front:     { type: String, required: true, maxlength: 1000 }, // question / term
    back:      { type: String, required: true, maxlength: 2000 }, // answer / definition

    // SM-2 scheduling fields
    ef:             { type: Number, default: 2.5, min: 1.3 },
    interval:       { type: Number, default: 1,   min: 1 },
    repetitions:    { type: Number, default: 0,   min: 0 },
    nextReviewDate: { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

// Fetch cards due for review today (sorted by oldest due first)
flashcardSchema.index({ ownerId: 1, nextReviewDate: 1 });
// Fetch all cards for a note
flashcardSchema.index({ noteId: 1, topicId: 1 });

module.exports = mongoose.model('Flashcard', flashcardSchema);
