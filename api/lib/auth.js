// Validate Telegram WebApp initData using the bot token.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const crypto = require('crypto');

function verifyInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  // Build the data_check_string: alphabetically sorted "key=value" lines.
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calc !== hash) return null;

  // Reject ancient initData (replay protection)
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (Date.now() / 1000 - authDate > 86400) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson); // { id, first_name, last_name, username, ... }
  } catch { return null; }
}

// Bridge helper used by every API route.
// Returns the user object on success, or sends 401 and returns null.
function requireUser(req, res) {
  const initData = (req.headers['x-tg-init-data'] || '').toString();
  const user = verifyInitData(initData, process.env.BOT_TOKEN);
  if (!user) {
    // Dev escape hatch: if NODE_ENV !== 'production' and ?devUser=NAME is set,
    // fake a user. Lets you preview the UI in a plain browser.
    if (process.env.ALLOW_DEV_USER === '1' && req.query?.devUser) {
      return { id: 'dev:' + req.query.devUser, first_name: req.query.devUser, dev: true };
    }
    res.status(401).json({ error: 'invalid initData' });
    return null;
  }
  return user;
}

module.exports = { verifyInitData, requireUser };
