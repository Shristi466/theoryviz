export default async function handler(req, res) {
  // Allow CORS from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, model } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  // API key stored securely in Vercel environment variable — never exposed to browser
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured. Add GROQ_API_KEY to Vercel env vars.' });

  const SYSTEM = `You are a science animation generator. Return ONLY valid JSON, no markdown, no explanation:
{
  "title": "Clear descriptive title (max 55 chars)",
  "animType": "one of: particles|waves|orbit|flow|split|build|pulse|network|pendulum|spiral",
  "primaryColor": "#hexcolor that fits the topic",
  "secondaryColor": "#hexcolor for contrast",
  "scenes": ["Scene 1 name", "Scene 2 name", "Scene 3 name", "Scene 4 name"],
  "narration": "3 engaging paragraphs separated by \\n\\n. Total 130-170 words. Science documentary tone.",
  "keyPoints": ["Key concept 1", "Key concept 2", "Key concept 3", "Key concept 4", "Key concept 5"],
  "formula": "Most important equation or formula. Empty string if none.",
  "funFact": "One surprising or counterintuitive fact about this topic",
  "particles": { "count": 20, "behavior": "brief: orbit / repel / wave / flow-right / spiral-in / explode" }
}

Choose animType by topic:
particles → atoms, molecules, quantum, chemistry, nuclear
waves → sound, light, radio, wifi, electromagnetic, signal
orbit → planets, electrons, gravity, solar system, moon
flow → blood, water, electricity, data, osmosis, current
split → cell division, mitosis, meiosis, fission, separation
build → DNA, evolution, growth, construction, assembly
pulse → heartbeat, photosynthesis, neural, rhythm, pulse
network → internet, blockchain, neural network, social, web
pendulum → oscillation, SHM, clock, swing, vibration
spiral → galaxy, DNA helix, hurricane, fractal, tornado`;

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
          { role: 'user', content: `Explain this topic for an animated science explainer: ${query}` }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `Groq error: HTTP ${response.status}` });
    }

    const data = await response.json();
    let raw = data.choices[0].message.content.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    const parsed = JSON.parse(raw);
    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
