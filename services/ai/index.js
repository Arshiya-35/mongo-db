// AI service abstraction. No keys are hard-coded; providers read config from env.
// Results are SUGGESTIONS only: this service never writes to the database, and the
// route marks every response requiresConfirmation so the UI must ask the user first.
//
// To add a real provider: create services/ai/myProvider.js exporting
//   { name, async suggest({ task, text }) -> string }
// read process.env.AI_API_KEY inside it, and register it in PROVIDERS below.
const mock = require('./mockProvider');

const PROVIDERS = { mock };
const TASKS = ['summarize', 'titles', 'moderate'];

function getProvider() {
  const name = (process.env.AI_PROVIDER || 'none').toLowerCase();
  return PROVIDERS[name] || null;
}

async function suggest({ task, text }) {
  const provider = getProvider();
  if (!provider) {
    const err = new Error('AI assistance is not configured (set AI_PROVIDER in .env)');
    err.status = 503;
    throw err;
  }
  if (!TASKS.includes(task)) {
    const err = new Error(`Unknown task. Use one of: ${TASKS.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return { provider: provider.name, task, suggestion: await provider.suggest({ task, text }), requiresConfirmation: true };
}

module.exports = { suggest, TASKS };
