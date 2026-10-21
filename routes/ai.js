const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const ai = require('../services/ai');

// POST /api/ai/suggest (author+): returns a suggestion only; nothing is saved or published.
router.post(
  '/suggest',
  authenticate,
  requireRole('author'),
  [body('task').isIn(ai.TASKS), body('text').isString().isLength({ min: 1, max: 20000 })],
  validate,
  async (req, res, next) => {
    try {
      res.json(await ai.suggest({ task: req.body.task, text: req.body.text }));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
