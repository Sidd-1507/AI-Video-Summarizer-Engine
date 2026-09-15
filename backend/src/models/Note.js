'use strict';

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    type:   { type: String, enum: ['short', 'long'], required: true },
    text:   { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false }
);

const chartPointSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const chartSchema = new mongoose.Schema(
  {
    type:  { type: String, enum: ['line', 'pie', 'bar'], required: true },
    title: { type: String, required: true },
    data:  { type: [chartPointSchema], default: [] },
  },
  { _id: false }
);

const topicSchema = new mongoose.Schema(
  {
    topicId:       { type: String, required: true },
    title:         { type: String, required: true },
    priority:      { type: Number, min: 1, max: 3, required: true },
    content:       { type: String, required: true },
    diagrams:      { type: [String], default: [] },
    charts:        { type: [chartSchema], default: [] },
    revisionPoints:{ type: [String], default: [] },
    questions:     { type: [questionSchema], default: [] },
    imageUrl:      { type: String, default: null },
    imageStatus:   { type: String, enum: ['none', 'pending', 'ready', 'failed'], default: 'none' },
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: {
      type:        { type: String, enum: ['topic', 'youtube'], required: true },
      youtubeUrl:  String,
      videoId:     String,
      transcriptId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Transcript' },
    },
    title: { type: String, required: true },
    examMeta: {
      classLevel: String,
      board:      String,
      examType:   String,
    },
    topics: { type: [topicSchema], default: [] },
    status: {
      type:    String,
      enum:    ['pending', 'generating', 'ready', 'failed'],
      default: 'pending',
    },
    version: { type: Number, default: 1 },

    // Phase 3: Audio Overview — one URL per format (podcast-style TTS)
    audioOverview: {
      deepDive:  { type: String, default: null }, // full dual-voice exploration
      brief:     { type: String, default: null }, // 2-min summary
    },
    audioStatus: { type: String, enum: ['none', 'pending', 'ready', 'failed'], default: 'none' },
  },
  { timestamps: true }
);

noteSchema.index({ ownerId: 1, createdAt: -1 });
noteSchema.index({ 'source.videoId': 1 });

module.exports = mongoose.model('Note', noteSchema);
