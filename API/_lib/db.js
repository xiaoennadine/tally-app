// Thin KV wrapper. Uses @vercel/kv when deployed; falls back to a local JSON
// file for `vercel dev` / running without KV configured.
const fs = require('fs');
const path = require('path');

let kv;
let useFile = false;
let filePath;

try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    kv = require('@vercel/kv').kv;
  } else {
    useFile = true;
  }
} catch {
  useFile = true;
}

if (useFile) {
  filePath = path.join('/tmp', 'tally-data.json');
  // For local dev, prefer cwd
  if (process.env.NODE_ENV !== 'production') {
    filePath = path.join(process.cwd(), 'data.json');
  }
}

function readFile() {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return {}; }
}
function writeFile(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function get(key) {
  if (useFile) {
    const data = readFile();
    return data[key] ?? null;
  }
  return await kv.get(key);
}
async function set(key, value) {
  if (useFile) {
    const data = readFile();
    data[key] = value;
    writeFile(data);
    return;
  }
  await kv.set(key, value);
}
async function del(key) {
  if (useFile) {
    const data = readFile();
    delete data[key];
    writeFile(data);
    return;
  }
  await kv.del(key);
}

// Per-user wallet record: members (friends), expenses, settlements, subs, groups.
function emptyWallet() {
  return {
    members: {},      // memberId -> { id, name, ghost: bool, tgId?: number, username?: string }
    expenses: [],
    settlements: [],
    subs: [],
    groups: [],       // [{ id, name, emoji }]
    defaultCcy: 'USD',
    createdAt: new Date().toISOString(),
  };
}

async function getWallet(userId) {
  const key = `wallet:${userId}`;
  let w = await get(key);
  if (!w) {
    w = emptyWallet();
    await set(key, w);
  }
  return w;
}
async function saveWallet(userId, wallet) {
  await set(`wallet:${userId}`, wallet);
}

module.exports = { get, set, del, getWallet, saveWallet, emptyWallet };
