const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    language: { type: String, required: true },
    content: { type: String, default: '' },
    isFolder: { type: Boolean, default: false },
    path: { type: String, default: '' }, // e.g. "src/components"
    parentId: { type: String, default: null },
    size: { type: Number, default: 0 }, // in bytes
}, { _id: false });

const codespaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null, // null means created by guest (unauthenticated)
    },
    isPublic: {
        type: Boolean,
        default: true,
    },
    passcode: {
        type: String,
        default: null,
    },
    customSlug: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
    },
    files: [fileSchema],
    // TTL index field: MongoDB deletes document when expiresAt <= current date
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }, // automatically deleted at this exact timestamp
    },
}, { timestamps: true });

// Helper to calculate total size of codespace
codespaceSchema.methods.calculateTotalSize = function () {
    return this.files.reduce((acc, f) => {
        const contentSize = f.content ? Buffer.byteLength(f.content, 'utf8') : 0;
        return acc + (f.size || contentSize);
    }, 0);
};

module.exports = mongoose.model('Codespace', codespaceSchema);
