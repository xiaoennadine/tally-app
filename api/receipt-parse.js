// POST /api/receipt-parse
// Body: { imageBase64: "data:image/jpeg;base64,..." }
// Uses Anthropic Claude (vision) to OCR a receipt and return structured line items.
// Requires ANTHROPIC_API_KEY env var.

const { requireUser } = require('./_lib/auth');

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
- Detect the currency from the symbol or context (¥ → JPY, $ → USD, € → EUR, etc).
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
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: SCHEMA_INSTRUCTIONS },
          ],
        }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error('claude error', r.status, txt);
      return res.status(502).json({ error: `OCR failed (${r.status})` });
    }
    const json = await r.json();
    const text = (json.content?.[0]?.text || '').trim();
    let parsed;
    try {
      // Be lenient: strip any accidental ``` fences
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('parse error', text);
      return res.status(502).json({ error: 'OCR returned non-JSON', raw: text });
    }
    if (parsed.error) return res.status(422).json(parsed);
    return res.status(200).json(parsed);
  } catch (e) {
    console.error('receipt-parse exception', e);
    return res.status(500).json({ error: e.message });
  }
};

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
  });
}
