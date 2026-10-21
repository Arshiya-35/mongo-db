const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['reader', 'author', 'editor', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'reader' },
    bio: { type: String, maxlength: 300, default: '' },
    // Future: followers/following, bookmarks, notification preferences
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function () {
  return { id: this._id, name: this.name, email: this.email, role: this.role, bio: this.bio };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
