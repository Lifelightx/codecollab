const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const Upload = require('../models/Upload');
const User = require('../models/User');
const Codespace = require('../models/codeSpace');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── Storage directory ─────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Per-user limits (auth users only)
const MAX_FILE_BYTES  = 200 * 1024 * 1024; // 200 MB per file
const QUOTA_BYTES     = 200 * 1024 * 1024; // 200 MB total per user

// ── Multer storage – uuid-named file, preserve extension ──────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
});

// ── Helper: resolve spaceName → Codespace doc ─────────────────────
async function resolveSpace(spaceName) {
  if (!spaceName) return null;
  return Codespace.findOne({ name: spaceName.toLowerCase().trim() });
}

// ── Helper: accurately calculate and sync user storage ────────────
async function syncUserStorage(userId) {
  if (!userId) return 0;
  try {
    const docs = await Upload.find({ ownerId: userId }).select('size');
    const totalBytes = docs.reduce((acc, doc) => acc + (doc.size || 0), 0);
    await User.findByIdAndUpdate(userId, { storageUsedBytes: totalBytes });
    return totalBytes;
  } catch (err) {
    console.error('Failed to sync user storage:', err);
    return 0;
  }
}

// ── POST /api/uploads  (upload files – auth required, space required) ──
router.post(
  '/',
  requireAuth,
  (req, res, next) => {
    upload.array('files', 20)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            message: `File exceeds maximum allowed size (${MAX_FILE_BYTES / (1024 * 1024)} MB).`,
          });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(500).json({ message: err.message || 'File upload failed.' });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded.' });
    }

    const { spaceName } = req.body;
    if (!spaceName) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(400).json({ message: 'spaceName is required.' });
    }

    const space = await resolveSpace(spaceName);
    if (!space) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(404).json({ message: 'Codespace not found.' });
    }

    // Check individual file size limits
    for (const f of req.files) {
      if (f.size > MAX_FILE_BYTES) {
        req.files.forEach(rf => fs.unlink(rf.path, () => {}));
        return res.status(413).json({
          message: `File "${f.originalname}" exceeds the ${MAX_FILE_BYTES / (1024 * 1024)} MB per-file limit.`,
        });
      }
    }

    try {
      const userId = req.user.id || req.user._id;

      // Check user current quota
      const userDocs = await Upload.find({ ownerId: userId }).select('size');
      const usedBytes = userDocs.reduce((acc, d) => acc + (d.size || 0), 0);
      const incomingBytes = req.files.reduce((s, f) => s + f.size, 0);

      if (usedBytes + incomingBytes > QUOTA_BYTES) {
        req.files.forEach(f => fs.unlink(f.path, () => {}));
        return res.status(413).json({
          message: `Upload would exceed your storage quota (${QUOTA_BYTES / (1024 * 1024)} MB).`,
        });
      }

      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

      const docs = req.files.map(f => ({
        originalName: f.originalname,
        storedName:   f.filename,
        mimeType:     f.mimetype,
        size:         f.size,
        ownerId:      userId,
        spaceId:      space._id,
        expiresAt,
      }));

      const saved = await Upload.insertMany(docs);
      const updatedStorageUsed = await syncUserStorage(userId);

      return res.status(201).json({
        uploads: saved,
        storageUsedBytes: updatedStorageUsed,
      });

    } catch (err) {
      console.error('Upload error:', err);
      req.files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(500).json({ message: 'Server error during upload.' });
    }
  }
);

// ── GET /api/uploads?spaceName=xxx  (list uploads for a space – open to anyone with access) ──
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { spaceName } = req.query;
    if (!spaceName) {
      return res.status(400).json({ message: 'spaceName query param is required.' });
    }

    const space = await resolveSpace(spaceName);
    if (!space) return res.status(404).json({ message: 'Codespace not found.' });

    const uploads = await Upload.find({ spaceId: space._id }).sort({ createdAt: -1 });

    // Sync and return user's real storage if authenticated
    let storageUsedBytes = 0;
    if (req.user) {
      const userId = req.user.id || req.user._id;
      storageUsedBytes = await syncUserStorage(userId);
    }

    return res.json({ uploads, storageUsedBytes, quota: QUOTA_BYTES });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list uploads.' });
  }
});

// ── GET /api/uploads/:id/meta  (single upload metadata for deep-link) ──
router.get('/:id/meta', optionalAuth, async (req, res) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Upload not found.' });
    return res.json({ upload: doc });
  } catch {
    return res.status(404).json({ message: 'Not found.' });
  }
});

// ── DELETE /api/uploads/clear-all  (delete all files the user uploaded to a space) ──
router.delete('/clear-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { spaceName } = req.query;
    const filter = { ownerId: userId };
    if (spaceName) {
      const space = await resolveSpace(spaceName);
      if (space) filter.spaceId = space._id;
    }

    const docs = await Upload.find(filter);
    docs.forEach(doc => {
      const filePath = path.join(UPLOAD_DIR, doc.storedName);
      fs.unlink(filePath, () => {});
    });

    await Upload.deleteMany(filter);
    const updatedStorageUsed = await syncUserStorage(userId);

    return res.json({
      message: 'All files cleared.',
      storageUsedBytes: updatedStorageUsed,
      count: docs.length,
    });
  } catch (err) {
    console.error('Clear-all error:', err);
    return res.status(500).json({ message: 'Failed to clear all files.' });
  }
});

// ── DELETE /api/uploads/:id  (delete a file – only uploader can delete) ──
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Upload not found.' });

    // Only the original uploader may delete
    if (doc.ownerId?.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Forbidden: only the uploader can delete this file.' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    fs.unlink(filePath, () => {});
    await doc.deleteOne();

    const updatedStorageUsed = await syncUserStorage(userId);

    return res.json({ message: 'Deleted.', storageUsedBytes: updatedStorageUsed });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete upload.' });
  }
});

// ── PUT /api/uploads/:id  (update/overwrite an existing file content) ──
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

router.put('/:id', optionalAuth, memoryUpload.single('file'), async (req, res) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Upload not found.' });

    if (!req.file) {
      return res.status(400).json({ message: 'No file content provided.' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    fs.writeFileSync(filePath, req.file.buffer);

    doc.size = req.file.size;
    await doc.save();

    let storageUsed = 0;
    if (doc.ownerId) {
      storageUsed = await syncUserStorage(doc.ownerId);
    }

    return res.json({ message: 'File saved successfully.', upload: doc, storageUsedBytes: storageUsed });
  } catch (err) {
    console.error('Update upload error:', err);
    return res.status(500).json({ message: 'Failed to update file.' });
  }
});

// ── GET /api/uploads/share/:id  (serve / stream a file – open to anyone) ──
router.get('/share/:id', async (req, res) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'File not found.' });
    const filePath = path.join(UPLOAD_DIR, path.basename(doc.storedName));
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing on disk.' });
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    res.sendFile(filePath);
  } catch {
    return res.status(404).json({ message: 'Not found.' });
  }
});

module.exports = router;
