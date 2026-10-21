const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { plain } = require('../services/sanitize');

const sign = (user) =>
  jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register  (always creates a "reader"; admins promote users later)
router.post(
  '/register',
  authLimiter,
  [
    body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters'),
  ],
  validate,
  async (req, res, next) => {
    try {
      if (await User.findOne({ email: req.body.email })) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const user = await User.create({ name: plain(req.body.name), email: req.body.email, password: req.body.password });
      res.status(201).json({ token: sign(user), user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findOne({ email: req.body.email }).select('+password');
      // Same message for unknown email and wrong password to avoid user enumeration.
      if (!user || !(await user.comparePassword(req.body.password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      res.json({ token: sign(user), user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => res.json({ user: req.user.toSafeJSON() }));

module.exports = router;
