export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, model = 'llama-3.3-70b-versatile', mode } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  // ── SUGGESTIONS MODE (lightweight, fast) ──
  if (mode === 'suggestions') {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          max_tokens: 150,
          temperature: 0.7,
          messages: [{
            role: 'system',
            content: 'You are a topic suggestion engine. Return ONLY a valid JSON array of exactly 5 short science topic strings. No explanation, no markdown, just the array.'
          }, {
            role: 'user',
            content: `Give 5 related science topics for: "${query}"`
          }]
        })
      });
      const j = await r.json();
      const raw = j.choices?.[0]?.message?.content || '[]';
      const clean = raw.replace(/```json|```/g, '').trim();
      const match = clean.match(/\[.*\]/s);
      const items = match ? JSON.parse(match[0]) : [];
      return res.status(200).json({ suggestions: items });
    } catch (e) {
      return res.status(200).json({ suggestions: [] });
    }
  }

  // ── MAIN VIDEO GENERATION MODE ──
  const SYSTEM = [
    'You are TheoryViz AI. Generate a 30-second science video script as a single JSON object.',
    'Rules:',
    '- Use PARA as paragraph separator in narration (never use actual newlines inside strings)',
    '- Keep all string values on one line, no literal newlines inside JSON strings',
    '- animType must be one of: particles, waves, orbit, flow, split, build, pulse, network, pendulum, spiral',
    '- keyPoints: exactly 6 short items (max 5 words each)',
    '- narration: exactly 5 paragraphs separated by PARA, each 1-2 sentences, total ~120 words',
    '',
    'Return ONLY this JSON (no markdown fences, no explanation):',
    '{',
    '  "title": "Short title",',
    '  "animType": "orbit",',
    '  "primaryColor": "#00ffc8",',
    '  "secondaryColor": "#a259ff",',
    '  "narration": "Scene 1 intro text.PARA Scene 2.PARA Scene 3.PARA Scene 4.PARA Scene 5 conclusion.",',
    '  "keyPoints": ["Point 1","Point 2","Point 3","Point 4","Point 5","Point 6"],',
    '  "formula": "E = mc²",',
    '  "funFact": "Interesting fact here"',
    '}'
  ].join('\n');

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0.72,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Create a 30-second science video about: ${query}` }
        ]
      })
    });

    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: j.error?.message || 'Groq API error' });

    let raw = j.choices?.[0]?.message?.content || '';
    // Strip fences
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // Remove control characters
    raw = raw.replace(/[\r\n\t]/g, ' ').replace(/[\x00-\x1F\x7F]/g, ' ');
    // Find JSON object
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const jsonStr = raw.slice(start, end + 1);

    let data;
    try { data = JSON.parse(jsonStr); }
    catch (e) {
      // aggressive clean
      const cleaned = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\t/g, ' ');
      data = JSON.parse(cleaned);
    }

    return res.status(200).json({ data });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to generate content' });
  }
}
