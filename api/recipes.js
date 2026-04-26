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
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Database!A2:L`,
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
      .map(r => ({
        name: r[0] || '',
        author: r[1] || '',
        type: r[2] || '',
        ingredients: r[3] || '',
        location: r[4] || '',
        notes: r[5] || '',
        cook_time: r[6] ? parseInt(r[6]) : null,
        weekday_safe: (r[7] || '').toLowerCase() === 'yes',
        season: r[8] || 'All',
        contains_eggs: (r[9] || '').toLowerCase() === 'yes',
        contains_mushrooms: (r[10] || '').toLowerCase() === 'yes',
        serves: r[11] ? parseInt(r[11]) : null
      }));

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ recipes, updated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', detail: err.message });
  }
}
