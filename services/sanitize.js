const sanitizeHtml = require('sanitize-html');

// Article bodies are stored as plain text (paragraphs separated by blank lines).
// All HTML is stripped on write, and the frontend renders with textContent.
const plain = (s) => sanitizeHtml(String(s ?? ''), { allowedTags: [], allowedAttributes: {} }).trim();

module.exports = { plain };
