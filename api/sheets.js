import { createSign } from 'crypto';

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

  const { access_token } = await tokenRes.json();
  return access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recipe } = req.body;
  if (!recipe) return res.status(400).json({ error: 'No recipe provided' });

  let sa;
  try {
    sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON' });
  }

  try {
    const token = await getAccessToken(sa);
    const id = process.env.GOOGLE_SPREADSHEET_ID;

    // Columns: A=Name, B=Author, C=Type, D=Ingredients, E=Location, F=Notes, G=CookTime, H=Season, I=Serves
    const row = [
      recipe.name || '',
      recipe.author || '',
      recipe.type || '',
      recipe.ingredients || '',
      recipe.location || '',
      recipe.notes || '',
      recipe.cook_time || '',
      recipe.season || 'All',
      recipe.serves || ''
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Database!A:I:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [row] })
      }
    );

    const result = await appendRes.json();
    res.json({ success: true, updatedRange: result.updates?.updatedRange });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
