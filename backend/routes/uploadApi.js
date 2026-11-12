const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const Upload = require('../models/Upload');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ── Storage directory ─────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Per-user limits
const GUEST_MAX_FILE_BYTES  = 5  * 1024 * 1024;  // 5 MB per file  (guests)
const AUTH_MAX_FILE_BYTES   = 200 * 1024 * 1024;  // 200 MB per file (auth users)
const GUEST_QUOTA_BYTES     = 20 * 1024 * 1024;  // 20 MB total quota (guests)
const AUTH_QUOTA_BYTES      = 200 * 1024 * 1024; // 200 MB total quota (auth users)

// ── Multer storage – uuid-named file, preserve extension ──────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, uuidv4() + ext);
  },
});

// Generous limit – we enforce exact limits per-user in route
const upload = multer({
  storage,
  limits: { fileSize: AUTH_MAX_FILE_BYTES },
});

// ── Helper ────────────────────────────────────────────────────────
const getExpirationDate = (isAuthenticated) => {
  const days = isAuthenticated ? 60 : 3;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

// ── POST /api/uploads  (upload one or more files) ─────────────────
router.post(
  '/',
  optionalAuth,
  (req, res, next) => {
    upload.array('files', 20)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            message: `File exceeds maximum allowed size (${AUTH_MAX_FILE_BYTES / (1024 * 1024)} MB).`,
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

  const isAuth = !!req.user;
  const maxPerFile = isAuth ? AUTH_MAX_FILE_BYTES : GUEST_MAX_FILE_BYTES;
  const quota      = isAuth ? AUTH_QUOTA_BYTES    : GUEST_QUOTA_BYTES;

  // Check individual file size limits
  for (const f of req.files) {
    if (f.size > maxPerFile) {
      // remove already-saved files
      req.files.forEach(rf => fs.unlink(rf.path, () => {}));
      return res.status(413).json({
        message: `File "${f.originalname}" exceeds the ${isAuth ? '50 MB' : '5 MB'} per-file limit.`,
      });
    }
  }

  // Check quota – sum existing + incoming
  try {
    const filter = isAuth
      ? { ownerId: req.user.id }
      : { ownerId: null, createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } };

    const existing = await Upload.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$size' } } },
    ]);

    const usedBytes  = existing[0]?.total ?? 0;
    const incomingBytes = req.files.reduce((s, f) => s + f.size, 0);

    if (usedBytes + incomingBytes > quota) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(413).json({
        message: `Upload would exceed your storage quota (${isAuth ? '200 MB' : '20 MB'}).`,
      });
    }

    // Save records to DB
    const docs = req.files.map(f => ({
      originalName: f.originalname,
      storedName:   f.filename,
      mimeType:     f.mimetype,
      size:         f.size,
      ownerId:      isAuth ? req.user.id : null,
      expiresAt:    getExpirationDate(isAuth),
    }));

    const saved = await Upload.insertMany(docs);

    let updatedStorageUsed = usedBytes + incomingBytes;
    if (isAuth) {
      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { $inc: { storageUsedBytes: incomingBytes } },
        { new: true }
      );
      if (updatedUser) {
        updatedStorageUsed = updatedUser.storageUsedBytes;
      }
    }

    return res.status(201).json({
      uploads: saved,
      storageUsedBytes: updatedStorageUsed,
    });

  } catch (err) {
    console.error('Upload error:', err);
    req.files.forEach(f => fs.unlink(f.path, () => {}));
    return res.status(500).json({ message: 'Server error during upload.' });
  }
});

// ── GET /api/uploads  (list uploads for current user/session) ─────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const isAuth = !!req.user;
    const filter = isAuth
      ? { ownerId: req.user.id }
      : { ownerId: null, createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } };

    const uploads = await Upload.find(filter).sort({ createdAt: -1 });

    // Also return used quota
    const usedBytes = uploads.reduce((s, u) => s + u.size, 0);
    const quota     = isAuth ? AUTH_QUOTA_BYTES : GUEST_QUOTA_BYTES;

    // Self-heal / sync User.storageUsedBytes if authenticated user has existing uploads
    if (isAuth) {
      await User.findByIdAndUpdate(req.user.id, { storageUsedBytes: usedBytes });
    }

    return res.json({ uploads, usedBytes, quota, storageUsedBytes: usedBytes });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list uploads.' });
  }
});

// ── DELETE /api/uploads/clear-all  (delete all files for current user) ───────────
router.delete('/clear-all', optionalAuth, async (req, res) => {
  try {
    const isAuth = !!req.user;
    const filter = isAuth
      ? { ownerId: req.user.id }
      : { ownerId: null, createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } };

    const docs = await Upload.find(filter);

    // Delete all files from disk
    docs.forEach(doc => {
      const filePath = path.join(UPLOAD_DIR, doc.storedName);
      fs.unlink(filePath, () => {});
    });

    await Upload.deleteMany(filter);

    if (isAuth) {
      await User.findByIdAndUpdate(req.user.id, { storageUsedBytes: 0 });
    }

    return res.json({ message: 'All files cleared.', storageUsedBytes: 0, count: docs.length });
  } catch (err) {
    console.error('Clear-all error:', err);
    return res.status(500).json({ message: 'Failed to clear all files.' });
  }
});

// ── DELETE /api/uploads/:id  (delete a file) ──────────────────────
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Upload not found.' });

    // Only the owner (or guest with no owner) may delete
    const isOwner = req.user
      ? doc.ownerId?.toString() === req.user.id
      : !doc.ownerId; // guest: allow deletion if not owned by anyone

    if (!isOwner) return res.status(403).json({ message: 'Forbidden.' });

    // Delete from disk
    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    fs.unlink(filePath, () => {}); // ignore error if already gone

    await doc.deleteOne();

    let updatedStorageUsed = 0;
    if (doc.ownerId) {
      const updatedUser = await User.findByIdAndUpdate(
        doc.ownerId,
        { $inc: { storageUsedBytes: -doc.size } },
        { new: true }
      );
      if (updatedUser) {
        // Prevent negative storageUsedBytes in edge cases
        if (updatedUser.storageUsedBytes < 0) {
          updatedUser.storageUsedBytes = 0;
          await updatedUser.save();
        }
        updatedStorageUsed = updatedUser.storageUsedBytes;
      }
    }

    return res.json({ message: 'Deleted.', storageUsedBytes: updatedStorageUsed });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete upload.' });
  }
});

// ── GET /api/uploads/share/:id  (serve / share a file by its MongoDB _id) ─────────
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
