// GET/POST/DELETE /api/friends
// GET    → list ghost friends
// POST   → { name } add one
// DELETE → ?name=NAME remove (only if not referenced in any expense)

const { requireUser } = require('./_lib/auth');
const { getWallet, saveWallet } = require('./_lib/db');

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const userId = String(user.id);
  const wallet = await getWallet(userId);

  if (req.method === 'GET') {
    const friends = Object.values(wallet.members).filter(m => m.ghost);
    return res.status(200).json({ friends });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const rawNames = body.names || (body.name ? [body.name] : []);
    if (!rawNames.length) return res.status(400).json({ error: 'name(s) required' });
    const added = [];
    for (const raw of rawNames) {
      const name = String(raw).trim();
      if (!name) continue;
      const existing = Object.values(wallet.members).find(
        m => m.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) continue;
      const id = 'g:' + Date.now() + ':' + name.toLowerCase().replace(/\s+/g, '_') + Math.random().toString(36).slice(2, 5);
      wallet.members[id] = { id, name, ghost: true };
      added.push(wallet.members[id]);
    }
    await saveWallet(userId, wallet);
    return res.status(200).json({ added, friends: Object.values(wallet.members).filter(m => m.ghost) });
  }

  if (req.method === 'DELETE') {
    const target = (req.query?.id || '').toString();
    const friend = wallet.members[target];
    if (!friend || !friend.ghost) return res.status(404).json({ error: 'not found' });
    const used = wallet.expenses.some(e => e.payer === target || e.splitWith.includes(target));
    if (used) return res.status(409).json({ error: 'friend has expenses — settle up first' });
    delete wallet.members[target];
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
