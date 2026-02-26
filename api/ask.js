export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, model } = req.body;
  if (!query) return res.status(400).json({ error: 'No query' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set in Vercel env vars' });

  const SYSTEM = 'You are a science animation generator. Return ONLY a single-line JSON object (no newlines inside strings, no line breaks anywhere in the output). Use the literal text PARA to separate paragraphs in the narration field. Fields required: title (string, max 55 chars), animType (string, one of: particles waves orbit flow split build pulse network pendulum spiral), primaryColor (hex string), secondaryColor (hex string), scenes (array of 4 strings), narration (single string using PARA between paragraphs, 130-170 words total, documentary tone), keyPoints (array of 5 strings), formula (string or empty), funFact (string), particles (object with count number and behavior string). animType guide: particles=atoms/quantum/chemistry, waves=sound/light/wifi/radio, orbit=planets/electrons/gravity, flow=blood/data/electricity/osmosis, split=cell division/fission, build=DNA/growth/evolution, pulse=heartbeat/photosynthesis/signals, network=internet/blockchain/neural, pendulum=oscillation/SHM, spiral=galaxies/DNA/hurricanes.';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: 'Topic: ' + query }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Groq error ' + response.status });
    }

    const data = await response.json();
    let raw = data.choices[0].message.content.trim();

    // Strip markdown fences
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    // Remove all actual newlines and control characters inside the string
    // but preserve escaped ones that are valid JSON
    raw = raw.replace(/[\r\n\t]/g, ' ');

    // Remove any control characters (ASCII 0-31 except space)
    raw = raw.replace(/[\x00-\x1F\x7F]/g, ' ');

    // Clean up multiple spaces
    raw = raw.replace(/\s+/g, ' ').trim();

    const parsed = JSON.parse(raw);

    // Convert PARA back to real newlines in narration
    if (parsed.narration) {
      parsed.narration = parsed.narration.replace(/PARA/g, '\n\n');
    }

    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
