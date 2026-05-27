// GET/POST/DELETE /api/subs — recurring subscription tracker
const { requireUser } = require('./_lib/auth');
const { getWallet, saveWallet } = require('./_lib/db');

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
    const sub = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: String(body.name || 'Subscription').slice(0, 60),
      emoji: body.emoji || '📺',
      price: Number(body.price) || 0,
      ccy: (body.ccy || wallet.defaultCcy || 'USD').toUpperCase(),
      cycle: body.cycle === 'yearly' ? 'yearly' : 'monthly',
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
