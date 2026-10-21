const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { upload, verifySignature } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');

// POST /api/uploads (author+): multipart field "image"; returns { url }
router.post('/', authenticate, requireRole('author'), uploadLimiter, upload, verifySignature, (req, res) => {
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
