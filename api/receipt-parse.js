// POST /api/receipt-parse
// Body: { imageBase64: "data:image/jpeg;base64,..." }
// Uses Anthropic Claude (vision) to OCR a receipt and return structured line items.
// Requires ANTHROPIC_API_KEY env var.

const { requireUser } = require('../lib/auth');

// Haiku is ~10× cheaper than Sonnet (~$0.001 vs ~$0.01 per receipt) — plenty
// accurate for receipts, and the user can fix any misreads inline on the review step.
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

═══ CRITICAL RULES ═══

▸ ONLY include lines that are actual ordered items (food, drink, products).
▸ NEVER include these meta-lines as items, even if they have a price:
  • Subtotal lines: "Zwischensumme", "Subtotal", "Sub-Total", "Sub Total", "Netto", "Brutto"
  • Tax/VAT lines: "MwSt", "Mehrwertsteuer", "VAT", "Tax", "GST", "Sales Tax", "IVA", "TVA"
  • Service/tip lines: "Service", "Tip", "Gratuity", "Bedienung"
  • Discounts: "Werberabatt", "Rabatt", "Discount", "-XX%", "Promo", "Aktion"
  • Payment lines: "Total", "Summe", "Cash", "Visa", "MasterCard", "Change", "Wechselgeld"
  • Transaction metadata: "TSE-…", "Bon Nr", "Kasse", "Tisch", "Beleg…"

▸ Restaurant surcharges ("Zuschlag", "Supplement", "Extra"): if printed directly under a dish (e.g., "H10 …" → "-- Zuschlage: 2.00"), ADD the surcharge to the parent item's price. Do NOT make it a separate item. Example: "H10 Knusprige Haehnchen 12.00" + "Zuschlage 2.00" → one item, name "H10 Knusprige Haehnchen", price 14.00.

▸ Multiple VAT brackets (e.g., MwSt.A 19% and MwSt.B 7%): SUM all VAT amounts into a single "tax" field. Don't list each as a separate item.

▸ "tax" is ONLY government tax (VAT, MwSt, Sales Tax, GST, IVA) explicitly labeled. No tax line → null.
▸ "service" is ONLY a service/tip charge explicitly labeled. No service line → null.
▸ Discounts are NEVER tax/service — they reduce item prices. If items are pre-discount, lower the prices so they reflect what was actually paid.

▸ "price" is the unit price. If a line shows "2 × 3.50 = 7.00", return qty: 2, price: 3.50.
▸ "currency": detect from symbols/codes (¥ → JPY, $ → USD, € → EUR, £ → GBP, S$ → SGD, A$ → AUD, C$ → CAD).

▸ Sanity-check at the end: (Σ price × qty) + (tax || 0) + (service || 0) MUST equal "total" within ±0.10. If it doesn't match, you've miscounted — revisit and fix item prices first, then tax. The total field comes from the receipt's "Summe"/"Total" line — that's authoritative.

▸ If you genuinely can't read the receipt: return { "error": "could not parse" }.

OUTPUT JSON ONLY. No \`\`\` fences. No prose.
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
