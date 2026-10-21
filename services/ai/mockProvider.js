// Offline demo provider so the confirmation flow can be tried without any API key.
module.exports = {
  name: 'mock',
  async suggest({ task, text }) {
    const words = text.split(/\s+/).filter(Boolean);
    if (task === 'summarize') return words.slice(0, 30).join(' ') + (words.length > 30 ? '…' : '');
    if (task === 'titles') return `${words.slice(0, 6).join(' ')}: A Closer Look`;
    return /\b(hate|kill|spam)\b/i.test(text) ? 'Possible policy issue: review manually.' : 'No obvious issues found (demo check).';
  },
};
