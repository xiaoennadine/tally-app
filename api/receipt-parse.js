// POST /api/receipt-parse
// Body: { imageBase64: "data:image/jpeg;base64,..." }
// Uses Anthropic Claude (vision) to OCR a receipt and return structured line items.
// Requires ANTHROPIC_API_KEY env var.

const { requireUser } = require('./lib/auth');

const MODEL = 'claude-haiku-4-5';

const SCHEMA_INSTRUCTIONS = `
You are a receipt parser. Look at this receipt image and return ONLY a JSON object — no markdown, no commentary — with this exact shape:

{
  "vendor": "string (the restaurant/store name, or null)",
  "currency": "USD" | "EUR" | "GBP" | "JPY" | "SGD" | "AUD" | "CAD",
  "items": [
    { "name": "string (item name as printed)", "qty": number (default 1), "price": number (unit price, not line total) }
  ],
  "subtotal": number | null,
  "tax": number | null,
  "service": number | null,
  "total": number
}

Rules:
- Detect the currency from the symbol or context (¥ → JPY, $ → USD, € → EUR, £ → GBP, S$ → SGD, A$ → AUD, C$ → CAD).
- "price" is the unit price (line_total / qty). If a line shows quantity 2 for $20, return qty: 2, price: 10.
- Skip non-item lines (subtotal, tax, change, payment method) — capture those in their own fields.
- If you can't read the receipt at all, return { "error": "could not parse" }.
- Output JSON only. No \`\`\` fences. No prose.
`.trim();

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Receipt OCR is not configured (missing ANTHROPIC_API_KEY).' });
  }

  const body = await readBody(req);
  const imageBase64 = String(body.imageBase64 || '');
  if (!imageBase64.startsWith('data:image/')) {
    return res.status(400).json({ error: 'imageBase64 (data URL) required' });
  }
  const m = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'invalid image format' });
  const [, mimeSub, b64] = m;
  const mediaType = `image/${mimeSub === 'jpg' ? 'jpeg' : mimeSub}`;

  try {
    const { data: json, status } = await callClaudeWithRetry({
      mediaType, b64, apiKey: process.env.ANTHROPIC_API_KEY,
    });

    if (!json) {
      return res.status(502).json({ error: `OCR failed (${status}) — try again in a few seconds.` });
    }

    const text = (json.content?.[0]?.text || '').trim();
    let parsed;
    try {
      // Be lenient: strip any accidental ``` fences
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('parse error', text.slice(0, 500));
      return res.status(502).json({ error: 'OCR returned non-JSON', raw: text });
    }
    if (parsed.error) return res.status(422).json(parsed);
    return res.status(200).json(parsed);
  } catch (e) {
    console.error('receipt-parse exception', e);
    return res.status(500).json({ error: e.message });
  }
};

// Retry on transient overload/rate-limit errors (529 overloaded, 429 rate-limit, other 5xx).
async function callClaudeWithRetry({ mediaType, b64, apiKey }) {
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text: SCHEMA_INSTRUCTIONS },
      ],
    }],
  });

  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
    if (r.ok) return { data: await r.json(), status: 200 };

    lastStatus = r.status;
    const txt = await r.text();
    console.error(`claude attempt ${attempt + 1} failed`, r.status, txt.slice(0, 300));
    // Only retry on overload/rate-limit/transient errors. 4xx (other than 429) won't get better.
    if (r.status !== 529 && r.status !== 429 && r.status < 500) {
      return { data: null, status: r.status };
    }
  }
  return { data: null, status: lastStatus };
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
  });
}
