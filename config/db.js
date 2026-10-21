const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env first.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
