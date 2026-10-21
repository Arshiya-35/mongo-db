const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
// extension -> magic-byte check; we trust file content, not the client's claimed type.
const SIGNATURES = {
  '.png': (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.jpg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  '.webp': (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP',
};
const MIME_TO_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  // Random server-generated name: ignores the user's filename entirely.
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + MIME_TO_EXT[file.mimetype]),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!MIME_TO_EXT[file.mimetype]) {
      const err = new Error('Only PNG, JPEG and WebP images are allowed');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
}).single('image');

// After multer saves the file, verify its real signature and delete it if it does not match.
function verifySignature(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded (field name: image)' });
  const ext = path.extname(req.file.filename);
  const head = Buffer.alloc(12);
  const fd = fs.openSync(req.file.path, 'r');
  fs.readSync(fd, head, 0, 12, 0);
  fs.closeSync(fd);
  if (!SIGNATURES[ext](head)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'File content does not match an allowed image type' });
  }
  next();
}

module.exports = { upload, verifySignature, UPLOAD_DIR };
