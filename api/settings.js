// POST /api/settings — update wallet preferences (defaultCcy).
const { requireUser } = require('../lib/auth');
const { getWallet, saveWallet } = require('../lib/db');

const SUPPORTED = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD'];

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).end();
  const userId = String(user.id);
  const wallet = await getWallet(userId);
  const body = await readBody(req);

  if (body.defaultCcy) {
    const c = String(body.defaultCcy).toUpperCase();
    if (!SUPPORTED.includes(c)) return res.status(400).json({ error: 'unsupported currency' });
    wallet.defaultCcy = c;
  }
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim().slice(0, 40);
    if (!trimmed) return res.status(400).json({ error: 'name cannot be empty' });
    if (wallet.members[userId]) wallet.members[userId].name = trimmed;
  }
  if (typeof body.avatarEmoji === 'string') {
    const emoji = body.avatarEmoji.slice(0, 4);
    if (wallet.members[userId]) wallet.members[userId].avatarEmoji = emoji;
  }
  // Reset all data: wipe expenses, friends, groups, subs, settlements.
  // Keep the owner's own member record (name + avatar) and chosen currency.
  if (body.reset === true) {
    const me = wallet.members[userId];
    wallet.members = me ? { [userId]: me } : {};
    wallet.expenses = [];
    wallet.settlements = [];
    wallet.subs = [];
    wallet.groups = [];
  }
  await saveWallet(userId, wallet);
  res.status(200).json({
    ok: true,
    defaultCcy: wallet.defaultCcy,
    name: wallet.members[userId]?.name,
    avatarEmoji: wallet.members[userId]?.avatarEmoji,
  });
};

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}
