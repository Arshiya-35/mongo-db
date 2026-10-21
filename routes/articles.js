const router = require('express').Router();
const crypto = require('crypto');
const slugify = require('slugify');
const { body, param, query } = require('express-validator');
const Article = require('../models/Article');
const Category = require('../models/Category');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { authenticate, optionalAuth, requireRole, hasRole } = require('../middleware/auth');
const { plain } = require('../services/sanitize');

const POPULATE = [
  { path: 'author', select: 'name bio' },
  { path: 'category', select: 'name slug' },
];

const id = param('id').isMongoId().withMessage('Invalid article id');
const isOwner = (article, user) => String(article.author._id || article.author) === String(user._id);
const canManage = (article, user) => hasRole(user, 'editor') || isOwner(article, user);

const articleRules = [
  body('title').isString().trim().isLength({ min: 3, max: 160 }).withMessage('Title must be 3-160 characters'),
  body('body').isString().isLength({ min: 1, max: 50000 }).withMessage('Body is required (max 50,000 characters)'),
  body('excerpt').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
  body('category').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid category'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Up to 10 tags'),
  body('tags.*').isString().trim().isLength({ min: 1, max: 30 }),
  body('coverImage').optional({ values: 'falsy' }).matches(/^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/).withMessage('Cover must be an uploaded image'),
  body('seo.metaTitle').optional().isString().isLength({ max: 70 }),
  body('seo.metaDescription').optional().isString().isLength({ max: 160 }),
];

// Copies only whitelisted fields, so clients cannot set author, status, etc.
async function pickFields(src) {
  const data = {
    title: plain(src.title),
    body: plain(src.body),
    excerpt: plain(src.excerpt),
    tags: [...new Set((src.tags || []).map((t) => plain(t).toLowerCase()).filter(Boolean))],
    coverImage: src.coverImage || '',
    seo: { metaTitle: plain(src.seo?.metaTitle), metaDescription: plain(src.seo?.metaDescription) },
  };
  if (src.category) {
    if (!(await Category.exists({ _id: src.category }))) {
      const err = new Error('Category does not exist');
      err.status = 400;
      throw err;
    }
    data.category = src.category;
  } else {
    data.category = null;
  }
  return data;
}

const load = async (req, res) => {
  const article = await Article.findById(req.params.id).populate(POPULATE);
  if (!article) res.status(404).json({ error: 'Article not found' });
  return article;
};

// GET /api/articles?q=&category=&tag=&author=&page=&limit=&sort=  (public, published only)
router.get(
  '/',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '9', 10);
      const filter = { status: 'published' };
      if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };
      if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase();
      if (req.query.category) {
        const cat = await Category.findOne({ slug: String(req.query.category) });
        filter.category = cat ? cat._id : null;
      }
      if (req.query.author && /^[a-f\d]{24}$/i.test(req.query.author)) filter.author = req.query.author;
      const sort = req.query.sort === 'popular' ? { views: -1 } : { publishedAt: -1 };
      const [articles, total] = await Promise.all([
        Article.find(filter).select('-body').populate(POPULATE).sort(sort).skip((page - 1) * limit).limit(limit),
        Article.countDocuments(filter),
      ]);
      res.json({ articles, page, pages: Math.ceil(total / limit), total });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/articles/mine (author+): own articles in any status
router.get('/mine', authenticate, requireRole('author'), async (req, res, next) => {
  try {
    const articles = await Article.find({ author: req.user._id }).select('-body').populate(POPULATE).sort('-updatedAt');
    res.json({ articles });
  } catch (err) {
    next(err);
  }
});

// GET /api/articles/review-queue (editor+)
router.get('/review-queue', authenticate, requireRole('editor'), async (req, res, next) => {
  try {
    const articles = await Article.find({ status: 'in_review' }).select('-body').populate(POPULATE).sort('updatedAt');
    res.json({ articles });
  } catch (err) {
    next(err);
  }
});

// GET /api/articles/manage/:id: full article for the editor screen (owner or editor+)
router.get('/manage/:id', authenticate, requireRole('author'), id, validate, async (req, res, next) => {
  try {
    const article = await load(req, res);
    if (!article) return;
    if (!canManage(article, req.user)) return res.status(403).json({ error: 'Not allowed' });
    res.json({ article });
  } catch (err) {
    next(err);
  }
});

// GET /api/articles/:slug: public if published; otherwise owner or editor+
router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const article = await Article.findOne({ slug: String(req.params.slug) }).populate(POPULATE);
    const visible = article && (article.status === 'published' || (req.user && canManage(article, req.user)));
    if (!visible) return res.status(404).json({ error: 'Article not found' });
    if (article.status === 'published') {
      Article.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});
    }
    res.json({ article });
  } catch (err) {
    next(err);
  }
});

// POST /api/articles (author+): always starts as draft
router.post('/', authenticate, requireRole('author'), articleRules, validate, async (req, res, next) => {
  try {
    const data = await pickFields(req.body);
    const slug = `${slugify(data.title, { lower: true, strict: true }) || 'article'}-${crypto.randomBytes(3).toString('hex')}`;
    const article = await Article.create({ ...data, slug, author: req.user._id, status: 'draft' });
    res.status(201).json({ article });
  } catch (err) {
    next(err);
  }
});

// PUT /api/articles/:id: owners edit drafts only; editors/admins edit any article
router.put('/:id', authenticate, requireRole('author'), id, articleRules, validate, async (req, res, next) => {
  try {
    const article = await load(req, res);
    if (!article) return;
    if (!canManage(article, req.user)) return res.status(403).json({ error: 'Not allowed' });
    if (!hasRole(req.user, 'editor') && article.status !== 'draft') {
      return res.status(409).json({ error: 'Only drafts can be edited by their author' });
    }
    article.set(await pickFields(req.body));
    await article.save();
    res.json({ article });
  } catch (err) {
    next(err);
  }
});

// POST /api/articles/:id/submit: owner sends a draft to review
router.post('/:id/submit', authenticate, requireRole('author'), id, validate, async (req, res, next) => {
  try {
    const article = await load(req, res);
    if (!article) return;
    if (!isOwner(article, req.user)) return res.status(403).json({ error: 'Only the author can submit' });
    if (article.status !== 'draft') return res.status(409).json({ error: 'Only drafts can be submitted' });
    article.status = 'in_review';
    article.reviewNote = '';
    await article.save();
    res.json({ article });
  } catch (err) {
    next(err);
  }
});

// POST /api/articles/:id/publish (editor+): from draft or in_review
router.post('/:id/publish', authenticate, requireRole('editor'), id, validate, async (req, res, next) => {
  try {
    const article = await load(req, res);
    if (!article) return;
    if (!['draft', 'in_review', 'archived'].includes(article.status)) {
      return res.status(409).json({ error: `Cannot publish an article that is ${article.status}` });
    }
    article.status = 'published';
    article.publishedAt = article.publishedAt || new Date();
    article.reviewedBy = req.user._id;
    article.reviewNote = '';
    await article.save();
    res.json({ article });
  } catch (err) {
    next(err);
  }
});

// POST /api/articles/:id/reject (editor+): back to draft with feedback
router.post(
  '/:id/reject',
  authenticate,
  requireRole('editor'),
  id,
  body('note').isString().trim().isLength({ min: 1, max: 500 }).withMessage('A review note is required'),
  validate,
  async (req, res, next) => {
    try {
      const article = await load(req, res);
      if (!article) return;
      if (article.status !== 'in_review') return res.status(409).json({ error: 'Article is not in review' });
      article.status = 'draft';
      article.reviewNote = plain(req.body.note);
      article.reviewedBy = req.user._id;
      await article.save();
      res.json({ article });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/articles/:id/archive (editor+): unpublish
router.post('/:id/archive', authenticate, requireRole('editor'), id, validate, async (req, res, next) => {
  try {
    const article = await load(req, res);
    if (!article) return;
    article.status = 'archived';
    await article.save();
    res.json({ article });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/articles/:id: owner may delete own drafts; admin may delete any
router.delete('/:id', authenticate, requireRole('author'), id, validate, async (req, res, next) => {
  try {
    const article = await load(req, res);
    if (!article) return;
    const allowed = hasRole(req.user, 'admin') || (isOwner(article, req.user) && article.status === 'draft');
    if (!allowed) return res.status(403).json({ error: 'Not allowed' });
    await article.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
