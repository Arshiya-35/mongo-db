const router = require('express').Router();
const { body, param } = require('express-validator');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    res.json({ users: await User.find().sort('-createdAt').select('name email role createdAt') });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role
router.patch(
  '/users/:id/role',
  param('id').isMongoId(),
  body('role').isIn(User.ROLES).withMessage(`Role must be one of: ${User.ROLES.join(', ')}`),
  validate,
  async (req, res, next) => {
    try {
      if (String(req.params.id) === String(req.user._id)) {
        return res.status(400).json({ error: 'You cannot change your own role' });
      }
      const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
