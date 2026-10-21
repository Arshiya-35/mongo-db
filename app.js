const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'img-src': ["'self'", 'data:'] },
    },
  })
);
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api', notFound);

// Uploaded files are served as static images; nosniff comes from helmet.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(errorHandler);

module.exports = app;
