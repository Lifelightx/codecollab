const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName:   { type: String, required: true, unique: true }, // uuid-based filename on disk
  mimeType:     { type: String, required: true },
  size:         { type: Number, required: true }, // bytes
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null = guest upload
  },
  spaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Codespace',
    default: null,
  },
  // TTL: guests 3 days, auth users 60 days
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Upload', uploadSchema);
