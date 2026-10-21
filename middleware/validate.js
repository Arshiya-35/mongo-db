const { validationResult } = require('express-validator');

// Place after express-validator chains; returns 400 with field-level details.
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  res.status(400).json({
    error: 'Validation failed',
    details: result.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};
