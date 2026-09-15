const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    displayName: String,
    passwordHash: { type: String, select: false },
    credits: { type: Number, default: 100, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
