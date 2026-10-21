// Usage: npm run seed   (WARNING: clears users, categories and articles in the configured database)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Article = require('../models/Article');

const DEMO_PASSWORD = 'Password123!'; // demo accounts only; change or delete in any shared environment

(async () => {
  await connectDB(process.env.MONGODB_URI);
  await Promise.all([User.deleteMany({}), Category.deleteMany({}), Article.deleteMany({})]);

  const [admin, editor, author] = await Promise.all(
    [
      ['Ada Admin', 'admin@contenthub.test', 'admin'],
      ['Eli Editor', 'editor@contenthub.test', 'editor'],
      ['Ana Author', 'author@contenthub.test', 'author'],
      ['Rae Reader', 'reader@contenthub.test', 'reader'],
    ].map(([name, email, role]) => User.create({ name, email, role, password: DEMO_PASSWORD }))
  );

  const cats = await Category.insertMany([
    { name: 'Technology', slug: 'technology', description: 'Software, hardware and the web.' },
    { name: 'Writing', slug: 'writing', description: 'Craft, process and publishing.' },
  ]);

  const mk = (title, slug, cat, tags, status, body) => ({
    title, slug, category: cat._id, tags, status, body, excerpt: body.slice(0, 120),
    author: author._id, reviewedBy: status === 'published' ? editor._id : undefined,
    publishedAt: status === 'published' ? new Date() : undefined,
  });
  await Article.insertMany([
    mk('Getting Started with MongoDB Indexes', 'mongodb-indexes-seed', cats[0], ['mongodb', 'performance'], 'published',
      'Indexes let MongoDB find documents without scanning a whole collection.\n\nStart with the fields you filter and sort on most often, then check queries with explain().'),
    mk('Why Every Draft Needs an Editor', 'draft-editor-seed', cats[1], ['editing', 'process'], 'published',
      'A second pair of eyes catches what the writer no longer sees.\n\nA review step keeps quality steady as a publication grows.'),
    mk('Notes on Express Middleware', 'express-middleware-seed', cats[0], ['express', 'nodejs'], 'in_review',
      'Middleware are functions that run in order for each request.\n\nThis article is waiting in the review queue.'),
  ]);

  console.log('Seeded. Demo logins (password: %s): admin@, editor@, author@, reader@contenthub.test', DEMO_PASSWORD);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
