// GET/POST/DELETE /api/subs — recurring subscription tracker
const { requireUser } = require('../lib/auth');
const { getWallet, saveWallet } = require('../lib/db');

const BRAND_PRESETS = [
  { name: 'Netflix', keywords: ['netflix'], color: '#E50914', iconName: 'Tv', emoji: '🍿', domain: 'netflix.com' },
  { name: 'Spotify', keywords: ['spotify'], color: '#1DB954', iconName: 'Music', emoji: '🎵', domain: 'spotify.com' },
  { name: 'Disney+', keywords: ['disney', 'disney+'], color: '#0063E5', iconName: 'Film', emoji: '✨', domain: 'disneyplus.com' },
  { name: 'iCloud', keywords: ['icloud', 'apple cloud'], color: '#007AFF', iconName: 'Cloud', emoji: '☁️', domain: 'icloud.com' },
  { name: 'Dropbox', keywords: ['dropbox'], color: '#0061FE', iconName: 'Cloud', emoji: '📦', domain: 'dropbox.com' },
  { name: 'YouTube', keywords: ['youtube', 'yt premium', 'yt music'], color: '#FF0000', iconName: 'Tv', emoji: '📹', domain: 'youtube.com' },
  { name: 'Amazon Prime', keywords: ['amazon', 'prime'], color: '#FF9900', iconName: 'Film', emoji: '📦', domain: 'amazon.com' },
  { name: 'Hulu', keywords: ['hulu'], color: '#1CE783', iconName: 'Tv', emoji: '📺', domain: 'hulu.com' },
  { name: 'HBO Max', keywords: ['hbo', 'max'], color: '#9933FF', iconName: 'Tv', emoji: '🎬', domain: 'max.com' },
  { name: 'ChatGPT', keywords: ['chatgpt', 'openai', 'gpt'], color: '#10A37F', iconName: 'Cloud', emoji: '🤖', domain: 'openai.com' },
  { name: 'Claude AI', keywords: ['claude', 'anthropic'], color: '#D97753', iconName: 'Cloud', emoji: '✍️', domain: 'anthropic.com' },
  { name: 'Gemini', keywords: ['gemini', 'google gemini', 'google ai', 'bard'], color: '#4A86E8', iconName: 'Cloud', emoji: '✨', domain: 'gemini.google.com' },
  { name: 'Adobe', keywords: ['adobe', 'photoshop', 'creative cloud'], color: '#FA0F00', iconName: 'Cloud', emoji: '🎨', domain: 'adobe.com' },
  { name: 'PlayStation', keywords: ['playstation', 'psn', 'ps5', 'ps plus'], color: '#003087', iconName: 'Tv', emoji: '🎮', domain: 'playstation.com' },
  { name: 'Xbox', keywords: ['xbox', 'gamepass', 'microsoft index'], color: '#107C10', iconName: 'Tv', emoji: '🎮', domain: 'xbox.com' },
  { name: 'Nintendo Switch Online', keywords: ['nintendo', 'switch'], color: '#E60012', iconName: 'Tv', emoji: '🎮', domain: 'nintendo.com' },
  { name: 'Figma', keywords: ['figma'], color: '#F24E1E', iconName: 'Cloud', emoji: '📐', domain: 'figma.com' },
  { name: 'Canva', keywords: ['canva'], color: '#00C4CC', iconName: 'Cloud', emoji: '🎨', domain: 'canva.com' },
  { name: 'Zoom', keywords: ['zoom'], color: '#2D8CFF', iconName: 'Tv', emoji: '📹', domain: 'zoom.us' },
  { name: 'Slack', keywords: ['slack'], color: '#4A154B', iconName: 'Cloud', emoji: '💬', domain: 'slack.com' },
  { name: 'Notion', keywords: ['notion'], color: '#000000', iconName: 'Cloud', emoji: '📓', domain: 'notion.so' },
  { name: 'GitHub', keywords: ['github', 'copilot'], color: '#24292e', iconName: 'Cloud', emoji: '🐙', domain: 'github.com' },
  { name: 'LinkedIn', keywords: ['linkedin'], color: '#0077B5', iconName: 'Cloud', emoji: '💼', domain: 'linkedin.com' },
  { name: 'Apple Music', keywords: ['apple music', 'itunes'], color: '#FC3C44', iconName: 'Music', emoji: '🎶', domain: 'music.apple.com' },
  { name: 'Google One', keywords: ['google one', 'gdrive', 'google drive'], color: '#4285F4', iconName: 'Cloud', emoji: '💾', domain: 'google.com' },
  { name: 'Microsoft 365', keywords: ['microsoft 365', 'office 365', 'outlook'], color: '#EC3B24', iconName: 'Cloud', emoji: '📊', domain: 'microsoft.com' },
  { name: 'Duolingo', keywords: ['duolingo'], color: '#78C800', iconName: 'Music', emoji: '🦉', domain: 'duolingo.com' }
];

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const userId = String(user.id);
  const wallet = await getWallet(userId);

  if (req.method === 'GET') {
    return res.status(200).json({ subs: wallet.subs });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const rawName = String(body.name || 'Subscription').slice(0, 60);
    const titleLower = rawName.trim().toLowerCase();
    
    // Auto-detect brand matching on the backend
    const detectedBrand = BRAND_PRESETS.find(preset => 
      preset.keywords.some(keyword => titleLower.includes(keyword))
    );

    // Default icon logic based on frontend rules
    let defaultIconName = detectedBrand?.iconName || null;
    if (detectedBrand) {
      if (detectedBrand.domain) {
        defaultIconName = `logo:${detectedBrand.domain}`;
      } else {
        defaultIconName = `emoji:${detectedBrand.emoji}`;
      }
    }

    const sub = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: rawName,
      
      // Use provided fields, otherwise fallback to the detected brand preset
      emoji: body.emoji || detectedBrand?.emoji || '📺',
      brand: body.brand || detectedBrand?.name || null,
      domain: body.domain || detectedBrand?.domain || null,
      iconName: body.iconName || defaultIconName,
      color: body.color || detectedBrand?.color || '#7c5cff',
      
      price: Number(body.price) || 0,
      ccy: (body.ccy || wallet.defaultCcy || 'USD').toUpperCase(),
      cycle: body.cycle === 'yearly' ? 'yearly' : 'monthly',
      billDay: (body.billDay === 'last' || (Number.isInteger(body.billDay) && body.billDay >= 1 && body.billDay <= 31)) ? body.billDay : null,
      members: Array.isArray(body.members) ? body.members.map(String) : [userId],
      payer:   String(body.payer || userId),
      nextCharge: body.nextCharge || null,
      addedAt: new Date().toISOString(),
    };

    if (!isFinite(sub.price) || sub.price <= 0) return res.status(400).json({ error: 'invalid price' });
    if (sub.members.length < 1) return res.status(400).json({ error: 'members required' });
    for (const id of [sub.payer, ...sub.members]) {
      if (!wallet.members[id]) return res.status(400).json({ error: `unknown member ${id}` });
    }

    wallet.subs.push(sub);
    await saveWallet(userId, wallet);
    return res.status(200).json({ sub });
  }

  if (req.method === 'DELETE') {
    const id = (req.query?.id || '').toString();
    const idx = wallet.subs.findIndex(s => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    
    wallet.subs.splice(idx, 1);
    await saveWallet(userId, wallet);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
};

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}
