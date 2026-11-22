const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kd(kHGMLdfhkdl$#kd@$ldnv)&$lmNHSNlstRHnl';

// Middleware that attaches user to req if token is present, but doesn't block guests
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies?.token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

// Middleware that strictly requires authenticated user
const requireAuth = (req, res, next) => {
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required for this feature.' });
    }
    next();
  });
};

// Middleware that strictly requires admin role
const requireAdmin = (req, res, next) => {
  optionalAuth(req, res, () => {
    if (!req.user || (req.user.role !== 'admin' && req.user.username?.toLowerCase() !== 'admin')) {
      return res.status(403).json({ message: 'Administrator privileges required.' });
    }
    next();
  });
};

module.exports = {
  optionalAuth,
  requireAuth,
  requireAdmin,
  JWT_SECRET,
};
