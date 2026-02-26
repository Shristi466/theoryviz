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

  const SYSTEM = [
    'You are a science animation generator.',
    'Return ONLY valid JSON with these exact fields, no markdown, no explanation:',
    'title: string max 55 chars',
    'animType: one of: particles, waves, orbit, flow, split, build, pulse, network, pendulum, spiral',
    'primaryColor: hex color string like #00ffc8',
    'secondaryColor: hex color string like #a259ff',
    'scenes: array of exactly 4 scene name strings',
    'narration: 3 paragraphs of text separated by [BREAK]. Total 130-170 words. Science documentary tone.',
    'keyPoints: array of exactly 5 key concept strings',
    'formula: most important equation as string, or empty string if none',
    'funFact: one surprising or counterintuitive fact as string',
    'particles: object with count as number and behavior as string',
    '',
    'Choose animType based on topic:',
    'particles = atoms molecules quantum chemistry nuclear',
    'waves = sound light wifi radio electromagnetic signal',
    'orbit = planets electrons gravity solar system moon',
    'flow = blood water electricity data osmosis current',
    'split = cell division mitosis meiosis fission separation',
    'build = DNA evolution growth construction assembly',
    'pulse = heartbeat photosynthesis neural rhythm signals',
    'network = internet blockchain neural network social web',
    'pendulum = oscillation simple harmonic motion clock swing',
    'spiral = galaxy DNA helix hurricane fractal tornado'
  ].join('\n');

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
          { role: 'user', content: 'Explain this topic for an animated science explainer: ' + query }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Groq error ' + response.status });
    }

    const data = await response.json();
    let raw = data.choices[0].message.content.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    const parsed = JSON.parse(raw);

    if (parsed.narration) {
      parsed.narration = parsed.narration.replace(/\[BREAK\]/g, '\n\n');
    }

    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
