// POST /api/receipt-parse
// Body: { imageBase64: "data:image/jpeg;base64,..." }
// Uses Google Gemini (vision) to OCR a receipt and return structured line items.
// Requires GEMINI_API_KEY env var.
//
// Get a key (free tier is generous): https://aistudio.google.com/apikey

const { requireUser } = require('./_lib/auth');

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SCHEMA_PROMPT = `
You are a receipt parser. Look at this receipt image and extract its line items.

Rules:
- Detect the currency from the symbol or context (¥ → JPY, $ → USD, € → EUR, £ → GBP, S$ → SGD, A$ → AUD, C$ → CAD).
- "price" is the UNIT price (line_total / qty). If a line shows quantity 2 for $20, return qty: 2, price: 10.
- Skip non-item lines (subtotal, tax, change, payment method, tips you can't attribute) — capture totals in their own fields.
- "vendor" is the restaurant/store name printed on the receipt, or null if not visible.
- If the image is not a receipt or you genuinely cannot read anything, set "error" to a short reason and leave other fields empty/zero.
`.trim();

// Gemini structured-output schema (subset of OpenAPI). Enforces shape so we don't get prose back.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    vendor: { type: 'string', nullable: true },
    currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          price: { type: 'number' },
        },
        required: ['name', 'qty', 'price'],
      },
    },
    subtotal: { type: 'number', nullable: true },
    tax: { type: 'number', nullable: true },
    service: { type: 'number', nullable: true },
    total: { type: 'number' },
    error: { type: 'string', nullable: true },
  },
  required: ['currency', 'items', 'total'],
};

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Receipt OCR is not configured (missing GEMINI_API_KEY).' });
  }

  const body = await readBody(req);
  const imageBase64 = String(body.imageBase64 || '');
  if (!imageBase64.startsWith('data:image/')) {
    return res.status(400).json({ error: 'imageBase64 (data URL) required' });
  }
  const m = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'invalid image format' });
  const [, mimeSub, b64] = m;
  const mimeType = `image/${mimeSub === 'jpg' ? 'jpeg' : mimeSub}`;

  try {
    const r = await fetch(`${ENDPOINT}?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mimeType, data: b64 } },
            { text: SCHEMA_PROMPT },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
          // Keep it tight — receipts are short. Bump if you see truncations on huge bills.
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('gemini error', r.status, txt);
      return res.status(502).json({ error: `OCR failed (${r.status})` });
    }

    const json = await r.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      console.error('gemini empty response', JSON.stringify(json).slice(0, 500));
      return res.status(502).json({ error: 'OCR returned empty response' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
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

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
  });
}
