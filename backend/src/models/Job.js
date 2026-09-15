'use strict';

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    noteId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null, index: true },
    type: {
      type: String,
      enum: ['youtube-notes', 'topic-notes', 'image-generation', 'audio-overview', 'mcq-generation'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'fetching_transcript', 'generating_notes', 'done', 'failed'],
      default: 'queued',
      index: true,
    },
    error:   { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

jobSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
