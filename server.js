require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;

(async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be set to a random string of at least 32 characters (see .env.example).');
    process.exit(1);
  }
  try {
    await connectDB(process.env.MONGODB_URI);
    app.listen(PORT, () => console.log(`ContentHub running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
})();
