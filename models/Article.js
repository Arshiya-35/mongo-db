const mongoose = require('mongoose');

const STATUSES = ['draft', 'in_review', 'published', 'archived'];

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, trim: true, maxlength: 300, default: '' },
    body: { type: String, required: true },
    coverImage: { type: String, default: '' }, // path like /uploads/abc.png
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    tags: { type: [String], default: [] },
    status: { type: String, enum: STATUSES, default: 'draft' },
    reviewNote: { type: String, maxlength: 500, default: '' }, // editor feedback on rejection
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: Date,
    seo: {
      metaTitle: { type: String, maxlength: 70, default: '' },
      metaDescription: { type: String, maxlength: 160, default: '' },
    },
    views: { type: Number, default: 0 },
    // Future: scheduledFor (Date), versions (ref ArticleVersion), reactionCounts
  },
  { timestamps: true }
);

articleSchema.index({ title: 'text', excerpt: 'text', body: 'text', tags: 'text' });
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ author: 1, status: 1 });
articleSchema.index({ category: 1, status: 1 });
articleSchema.index({ tags: 1 });

module.exports = mongoose.model('Article', articleSchema);
module.exports.STATUSES = STATUSES;
