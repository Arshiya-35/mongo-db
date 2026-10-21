const rateLimit = require('express-rate-limit');

const make = (windowMs, max, message) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: message } });

module.exports = {
  apiLimiter: make(15 * 60 * 1000, 300, 'Too many requests, please try again later'),
  authLimiter: make(15 * 60 * 1000, 20, 'Too many login attempts, please try again later'),
  uploadLimiter: make(60 * 60 * 1000, 30, 'Upload limit reached, please try again later'),
};
