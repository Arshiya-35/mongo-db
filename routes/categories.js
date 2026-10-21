const router = require('express').Router();
const slugify = require('slugify');
const { body, param } = require('express-validator');
const Category = require('../models/Category');
const Article = require('../models/Article');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { plain } = require('../services/sanitize');

const rules = [
  body('name').isString().trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2-60 characters'),
  body('description').optional().isString().isLength({ max: 300 }),
];

// GET /api/categories (public)
router.get('/', async (req, res, next) => {
  try {
    res.json({ categories: await Category.find().sort('name') });
  } catch (err) {
    next(err);
  }
});

// POST /api/categories (editor+)
router.post('/', authenticate, requireRole('editor'), rules, validate, async (req, res, next) => {
  try {
    const name = plain(req.body.name);
    const category = await Category.create({
      name,
      slug: slugify(name, { lower: true, strict: true }),
      description: plain(req.body.description),
    });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

// PUT /api/categories/:id (editor+)
router.put('/:id', authenticate, requireRole('editor'), param('id').isMongoId(), rules, validate, async (req, res, next) => {
  try {
    const name = plain(req.body.name);
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, slug: slugify(name, { lower: true, strict: true }), description: plain(req.body.description) },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id (admin only; blocked while articles use it)
router.delete('/:id', authenticate, requireRole('admin'), param('id').isMongoId(), validate, async (req, res, next) => {
  try {
    if (await Article.exists({ category: req.params.id })) {
      return res.status(409).json({ error: 'Category is used by articles' });
    }
    const removed = await Category.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Category not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
