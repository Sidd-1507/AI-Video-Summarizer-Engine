'use strict';

const mongoose = require('mongoose');

/**
 * Sticky notes are attached to a specific topic inside a note.
 * They optionally carry a YouTube timestamp for jump-back feature.
 * Color is one of 5 pastel values — rendered on the frontend.
 */
const stickyNoteSchema = new mongoose.Schema(
  {
    ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
    noteId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Note',  required: true, index: true },
    topicId:   { type: String, required: true, maxlength: 100 },
    content:   { type: String, required: true, maxlength: 2000 },
    color:     { type: String, enum: ['yellow', 'green', 'blue', 'pink', 'purple', 'red', 'orange'], default: 'yellow' },
    youtubeTimestamp: { type: Number, min: 0, default: null },
    x: { type: Number, default: 40 },
    y: { type: Number, default: 40 },
    w: { type: Number, default: 220 },
    h: { type: Number, default: 180 },
  },
  { timestamps: true }
);

// Fetch all sticky notes for a given note (sorted newest first)
stickyNoteSchema.index({ noteId: 1, createdAt: -1 });

module.exports = mongoose.model('StickyNote', stickyNoteSchema);
