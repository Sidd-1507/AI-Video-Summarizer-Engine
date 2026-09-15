const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema(
  {
    start: { type: Number, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const transcriptSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    videoId: { type: String, required: true, index: true },
    language: { type: String, default: 'en' },
    segments: { type: [segmentSchema], default: [] },
    markdown: { type: String, required: true },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

transcriptSchema.index({ videoId: 1, ownerId: 1 });

module.exports = mongoose.model('Transcript', transcriptSchema);
