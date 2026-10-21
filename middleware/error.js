function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'Duplicate value', details: err.keyValue });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFound, errorHandler };
