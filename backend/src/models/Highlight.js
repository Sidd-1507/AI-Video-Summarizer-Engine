'use strict';

const mongoose = require('mongoose');

/**
 * Highlights are user-selected text spans inside a note's topic content.
 * startOffset / endOffset are character indices into the topic.content string.
 * Used for focus-mode reading and export to Notion / PDF.
 */
const highlightSchema = new mongoose.Schema(
  {
    ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    noteId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    topicId:     { type: String, required: true, maxlength: 100 },
    text:        { type: String, required: true, maxlength: 5000 },
    startOffset: { type: Number, required: true, min: 0 },
    endOffset:   { type: Number, required: true, min: 0 },
    color:       { type: String, enum: ['yellow', 'green', 'blue', 'pink'], default: 'yellow' },
  },
  { timestamps: true }
);

highlightSchema.index({ noteId: 1, topicId: 1, startOffset: 1 });

module.exports = mongoose.model('Highlight', highlightSchema);
