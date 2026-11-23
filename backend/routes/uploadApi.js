const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const Upload = require('../models/Upload');
const User = require('../models/User');
const Codespace = require('../models/codeSpace');
const logger = require('../utils/logger');
const { uploadCountTotal, uploadBytesTotal } = require('../utils/metrics');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { recordAuditEvent, getClientIp } = require('../utils/auditLogger');

const router = express.Router();

// ── Storage directory ─────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Limits: Admin gets 2GB, regular users get 200MB
const ADMIN_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB for Admin
const USER_MAX_FILE_BYTES  = 200 * 1024 * 1024;      // 200 MB per file for standard users
const USER_QUOTA_BYTES     = 200 * 1024 * 1024;      // 200 MB total quota for standard users
const ADMIN_QUOTA_BYTES    = 2 * 1024 * 1024 * 1024; // 2 GB total quota for Admin

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── Multer storage – uuid-named file, preserve extension ──────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, uuidv4() + ext);
  },
});

// Configure multer with admin limit (2GB) so large admin uploads are accepted
const upload = multer({
  storage,
  limits: { fileSize: ADMIN_MAX_FILE_BYTES },
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
          logger.warn(`Upload rejected: file size exceeds limit`, null, 'UPLOAD');
          return res.status(413).json({
            message: `File exceeds maximum allowed size.`,
          });
        }
        logger.warn(`Multer error during upload: ${err.message}`, null, 'UPLOAD');
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      } else if (err) {
        logger.error(`Upload error: ${err.message}`, err, 'UPLOAD');
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

    const cleanSpaceName = spaceName.trim().toLowerCase();
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');

    // ── Guard: Space 'admin' is strictly private to the administrator ──
    if (cleanSpaceName === 'admin' && !isAdmin) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
      logger.warn(`Unauthorized upload attempt to 'admin' space [IP: ${getClientIp(req)}]`, null, 'UPLOAD');
      return res.status(403).json({ message: "Access denied. Only the administrator can upload to the 'admin' space." });
    }

    const space = await resolveSpace(cleanSpaceName);
    if (!space) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(404).json({ message: 'Codespace not found.' });
    }

    // Dynamic file size limit: 2GB for admin, 200MB for standard users
    const maxFileBytes = isAdmin ? ADMIN_MAX_FILE_BYTES : USER_MAX_FILE_BYTES;
    const maxQuotaBytes = isAdmin ? ADMIN_QUOTA_BYTES : USER_QUOTA_BYTES;

    // Check individual file size limits
    for (const f of req.files) {
      if (f.size > maxFileBytes) {
        req.files.forEach(rf => fs.unlink(rf.path, () => {}));
        return res.status(413).json({
          message: `File "${f.originalname}" exceeds the ${maxFileBytes / (1024 * 1024)} MB limit (${isAdmin ? '2 GB for Admin' : '200 MB for Standard User'}).`,
        });
      }
    }

    try {
      const userId = req.user.id || req.user._id;

      // Check user current quota
      const userDocs = await Upload.find({ ownerId: userId }).select('size');
      const usedBytes = userDocs.reduce((acc, d) => acc + (d.size || 0), 0);
      const incomingBytes = req.files.reduce((s, f) => s + f.size, 0);

      if (usedBytes + incomingBytes > maxQuotaBytes) {
        req.files.forEach(f => fs.unlink(f.path, () => {}));
        logger.warn(`Upload blocked: user ${userId} exceeded quota (${(usedBytes + incomingBytes) / (1024 * 1024)}MB / ${maxQuotaBytes / (1024 * 1024)}MB)`, null, 'UPLOAD');
        return res.status(413).json({
          message: `Upload would exceed your storage quota (${maxQuotaBytes / (1024 * 1024)} MB).`,
        });
      }

      const expiresAt = cleanSpaceName === 'admin' 
        ? new Date('2099-12-31T23:59:59Z') // Admin files never expire
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days for users

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

      uploadCountTotal.inc(saved.length);
      uploadBytesTotal.inc(incomingBytes);

      logger.info(`User ${userId} uploaded ${saved.length} file(s) (${(incomingBytes / (1024 * 1024)).toFixed(2)} MB) to space '${cleanSpaceName}'`, null, 'UPLOAD');

      // ── Audit Log & Email Alert for each uploaded file ──
      const clientIp = getClientIp(req);
      req.files.forEach(f => {
        recordAuditEvent({
          action: 'FILE_UPLOADED',
          actor: req.user,
          ip: clientIp,
          spaceName: cleanSpaceName,
          details: `File: '${f.originalname}' | Size: ${formatSize(f.size)} (${f.size} bytes) | MIME: ${f.mimetype}`,
        });
      });

      return res.status(201).json({
        uploads: saved,
        storageUsedBytes: updatedStorageUsed,
      });

    } catch (err) {
      logger.error(`Upload error: ${err.message}`, err, 'UPLOAD');
      req.files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(500).json({ message: 'Server error during upload.' });
    }
  }
);

// ── GET /api/uploads?spaceName=xxx  (list uploads for a space) ──
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { spaceName } = req.query;
    if (!spaceName) {
      return res.status(400).json({ message: 'spaceName query param is required.' });
    }

    const cleanSpaceName = spaceName.trim().toLowerCase();
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');

    // Protect 'admin' space
    if (cleanSpaceName === 'admin' && !isAdmin) {
      return res.status(403).json({ message: "Access denied. The 'admin' space is private to the administrator." });
    }

    const space = await resolveSpace(cleanSpaceName);
    if (!space) return res.status(404).json({ message: 'Codespace not found.' });

    const uploads = await Upload.find({ spaceId: space._id }).sort({ createdAt: -1 });

    let storageUsedBytes = 0;
    if (req.user) {
      const userId = req.user.id || req.user._id;
      storageUsedBytes = await syncUserStorage(userId);
    }

    const quota = isAdmin ? ADMIN_QUOTA_BYTES : USER_QUOTA_BYTES;
    return res.json({ uploads, storageUsedBytes, quota });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list uploads.' });
  }
});

// ── GET /api/uploads/:id/meta  (single upload metadata for deep-link) ──
router.get('/:id/meta', optionalAuth, async (req, res) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Upload not found.' });

    // Protect admin space uploads
    if (doc.spaceId) {
      const space = await Codespace.findById(doc.spaceId);
      if (space && space.name.toLowerCase() === 'admin') {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');
        if (!isAdmin) {
          return res.status(403).json({ message: "Access denied. Private admin file." });
        }
      }
    }

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

    logger.info(`User ${userId} cleared all ${docs.length} upload(s) from space '${spaceName || 'all'}'`, null, 'UPLOAD');

    const clientIp = getClientIp(req);
    recordAuditEvent({
      action: 'FILE_DELETED',
      actor: req.user,
      ip: clientIp,
      spaceName: spaceName || 'multiple',
      details: `Cleared all ${docs.length} files: ${docs.map(d => d.originalName).join(', ')}`,
    });

    return res.json({
      message: 'All files cleared.',
      storageUsedBytes: updatedStorageUsed,
      count: docs.length,
    });
  } catch (err) {
    logger.error(`Clear-all error: ${err.message}`, err, 'UPLOAD');
    return res.status(500).json({ message: 'Failed to clear all files.' });
  }
});

// ── DELETE /api/uploads/:id  (delete a file – only uploader can delete, or admin) ──
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Upload not found.' });

    const isAdmin = req.user && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');

    // Only the original uploader or admin may delete
    if (doc.ownerId?.toString() !== userId.toString() && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: only the uploader or admin can delete this file.' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    fs.unlink(filePath, () => {});
    await doc.deleteOne();

    const updatedStorageUsed = await syncUserStorage(doc.ownerId || userId);
    logger.info(`User ${userId} deleted file '${doc.originalName}' (${doc._id})`, null, 'UPLOAD');

    let spaceName = 'unknown';
    if (doc.spaceId) {
      const sp = await Codespace.findById(doc.spaceId);
      if (sp) spaceName = sp.name;
    }

    const clientIp = getClientIp(req);
    recordAuditEvent({
      action: 'FILE_DELETED',
      actor: req.user,
      ip: clientIp,
      spaceName,
      details: `File deleted: '${doc.originalName}' | Size: ${formatSize(doc.size)} | ID: ${doc._id}`,
    });

    return res.json({ message: 'Deleted.', storageUsedBytes: updatedStorageUsed });
  } catch (err) {
    logger.error(`Delete upload error for ${req.params.id}: ${err.message}`, err, 'UPLOAD');
    return res.status(500).json({ message: 'Failed to delete upload.' });
  }
});

// ── PUT /api/uploads/:id  (update/overwrite an existing file content) ──
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ADMIN_MAX_FILE_BYTES },
});

router.put('/:id', optionalAuth, memoryUpload.single('file'), async (req, res) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Upload not found.' });

    if (doc.spaceId) {
      const space = await Codespace.findById(doc.spaceId);
      if (space && space.name.toLowerCase() === 'admin') {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');
        if (!isAdmin) {
          return res.status(403).json({ message: "Access denied. Private admin file." });
        }
      }
    }

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

// ── GET /api/uploads/share/:id  (serve / stream a file) ──
router.get('/share/:id', optionalAuth, async (req, res) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'File not found.' });

    // Protect admin space files from anonymous/unauthorized access
    if (doc.spaceId) {
      const space = await Codespace.findById(doc.spaceId);
      if (space && space.name.toLowerCase() === 'admin') {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');
        if (!isAdmin) {
          return res.status(403).json({ message: "Access denied. Private admin file." });
        }
      }
    }

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
