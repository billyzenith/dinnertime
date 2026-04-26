import { createSign } from 'crypto';

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${payload}.${sig}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

const EGG_TERMS = ['egg', 'eggs'];
const MUSHROOM_TERMS = ['mushroom', 'mushrooms'];

function containsAny(ingredients, terms) {
  const lower = ingredients.toLowerCase();
  return terms.some(t => {
    const idx = lower.indexOf(t);
    if (idx === -1) return false;
    const before = idx === 0 || /\W/.test(lower[idx - 1]);
    const after = idx + t.length >= lower.length || /\W/.test(lower[idx + t.length]);
    return before && after;
  });
}

export default async function handler(req, res) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return res.status(500).json({ error: 'Missing env var: GOOGLE_SERVICE_ACCOUNT_JSON' });
  }
  if (!process.env.GOOGLE_SPREADSHEET_ID) {
    return res.status(500).json({ error: 'Missing env var: GOOGLE_SPREADSHEET_ID' });
  }

  let sa;
  try {
    sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON', detail: e.message });
  }

  if (!sa.client_email || !sa.private_key) {
    return res.status(500).json({ error: 'Service account JSON is missing client_email or private_key' });
  }

  let token;
  try {
    token = await getAccessToken(sa);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to authenticate with Google', detail: e.message });
  }

  try {
    const id = process.env.GOOGLE_SPREADSHEET_ID;
    const sheetsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Database!A2:I`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const body = await sheetsRes.json();
    if (body.error) {
      return res.status(500).json({ error: 'Google Sheets API error', detail: body.error.message });
    }

    const { values } = body;
    if (!values) return res.json({ recipes: [] });

    const recipes = values
      .filter(r => r[0])
      .map(r => {
        const cook_time = r[6] ? parseInt(r[6]) : null;
        const ingredients = r[3] || '';
        return {
          name: r[0] || '',
          author: r[1] || '',
          type: r[2] || '',
          ingredients,
          location: r[4] || '',
          notes: r[5] || '',
          cook_time,
          weekday_safe: cook_time !== null ? cook_time <= 60 : false,
          season: r[7] || 'All',
          serves: r[8] ? parseInt(r[8]) : null,
          contains_eggs: containsAny(ingredients, EGG_TERMS),
          contains_mushrooms: containsAny(ingredients, MUSHROOM_TERMS)
        };
      });

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ recipes, updated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', detail: err.message });
  }
}
