export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, model } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

  const SYSTEM = `You are a science animation generator. Return ONLY valid JSON, no markdown:
{
  "title": "Title max 55 chars",
  "animType": "particles|waves|orbit|flow|split|build|pulse|network|pendulum|spiral",
  "primaryColor": "#hexcolor",
  "secondaryColor": "#hexcolor",
  "scenes": ["Scene 1", "Scene 2", "Scene 3", "Scene 4"],
  "narration": "3 paragraphs separated by newline newline. 130-170 words. Documentary style.",
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "formula": "Key equation or empty string",
  "funFact": "One surprising fact",
  "particles": {"count": 20, "behavior": "how particles move"}
}
animType: particles=atoms/quantum, waves=sound/light/wifi, orbit=planets/electrons, flow=blood/data/electricity, split=cell division, build=DNA/growth, pulse=heartbeat/photosynthesis, network=internet/blockchain, pendulum=oscillation, spiral=galaxies/hurricanes`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Explain: ${query}` }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `Error ${response.status}` });
    }

    const data = await response.json();
    let raw = data.choices[0].message.content.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    return res.status(200).json({ success: true, data: JSON.parse(raw) });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
