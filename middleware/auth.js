const jwt = require('jsonwebtoken');
const User = require('../models/User');

const RANK = { reader: 0, author: 1, editor: 2, admin: 3 };

async function loadUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Re-read the user so role changes and deletions take effect immediately.
    return await User.findById(payload.sub);
  } catch {
    return null;
  }
}

// Requires a valid token.
async function authenticate(req, res, next) {
  try {
    const user = await loadUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Attaches req.user if a valid token is present, otherwise continues anonymously.
async function optionalAuth(req, res, next) {
  try {
    req.user = (await loadUser(req)) || null;
    next();
  } catch (err) {
    next(err);
  }
}

// Requires at least the given role (reader < author < editor < admin).
const requireRole = (minRole) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (RANK[req.user.role] < RANK[minRole]) {
    return res.status(403).json({ error: `Requires ${minRole} role or higher` });
  }
  next();
};

const hasRole = (user, minRole) => !!user && RANK[user.role] >= RANK[minRole];

module.exports = { authenticate, optionalAuth, requireRole, hasRole };
