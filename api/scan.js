export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mediaType, bookName, pageNumber } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const contextHints = [
    bookName && `The cookbook is: "${bookName}"`,
    pageNumber && `The page number is: ${pageNumber}`
  ].filter(Boolean).join('. ');

  const prompt = `You are extracting recipe metadata from a cookbook photograph to store in a recipe database.

${contextHints ? `Context provided by the user: ${contextHints}` : ''}

Analyse the image and extract the following fields. Return ONLY valid JSON, no other text.

{
  "name": "Recipe name exactly as written",
  "author": "Author name — use the cookbook author if visible, otherwise leave empty",
  "type": "One of: Pasta, Comfort, One Pan, Seafood, Salad, Asian, Mexican, Curry, Beans, Slow Cooker, Chef's Choice, Potato — pick the best fit",
  "ingredients": "Comma-separated list of main ingredients, no quantities, no staples like salt/pepper/olive oil",
  "location": "Cookbook name and page, e.g. 'Ottolenghi Simple p.142' — use the user's context if provided",
  "notes": "Any brief useful notes visible (dietary info, serving suggestions). Leave empty if none.",
  "cook_time": "Active cook time in minutes as a number only. Exclude marinating/resting. Leave empty if unclear.",
  "season": "One of: All, Spring, Summer, Autumn, Winter — based on ingredients and feel of the dish",
  "serves": "Number of servings as a number only. Leave empty if unclear."
}

If you cannot determine a field from the image, leave it as an empty string. Do not guess wildly — it is better to leave a field empty than to invent information.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    let recipe;
    try {
      recipe = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Could not parse recipe from image', raw: text });
    }

    res.json({ recipe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
