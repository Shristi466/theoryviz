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

  // ── SUGGESTIONS MODE ──
  if (mode === 'suggestions') {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          max_tokens: 200,
          temperature: 0.8,
          messages: [{
            role: 'system',
            content: 'Return ONLY a valid JSON array of exactly 5 short curious question strings. No markdown, no explanation.'
          }, {
            role: 'user',
            content: `Give 5 related everyday curiosity questions for: "${query}"`
          }]
        })
      });
      const j = await r.json();
      const raw = (j.choices?.[0]?.message?.content || '[]').replace(/```json|```/g, '').trim();
      const match = raw.match(/\[.*\]/s);
      return res.status(200).json({ suggestions: match ? JSON.parse(match[0]) : [] });
    } catch (e) {
      return res.status(200).json({ suggestions: [] });
    }
  }

  // ── MAIN VIDEO SCRIPT GENERATION ──
  const SYSTEM = `You are TheoryViz AI — a master science communicator who writes scripts for short animated educational videos.

Your job: Given any topic, write a 5-scene animated video script that teaches it visually and engagingly.

RULES:
1. Each scene has a CANVAS ANIMATION — describe it precisely so code can render it
2. Write for a smart 15-year-old — conversational, vivid, zero jargon
3. Every scene needs narration text (spoken aloud) + visual description (drawn on canvas)
4. Keep each narration short: 1-2 sentences max per scene
5. Return ONLY compact JSON — no markdown, no newlines inside strings, no trailing commas

ANIMATION TYPES available (use these exactly):
- "particles" — floating colored dots/particles
- "orbit" — object orbiting a center (e.g. electron, planet)  
- "wave" — sine wave animation
- "bounce" — object bouncing with gravity
- "grow" — shape growing from small to large
- "flow" — arrows or lines flowing in a direction
- "split" — one thing splitting into many
- "merge" — many things merging into one
- "pulse" — object pulsing/glowing
- "draw" — shape being drawn stroke by stroke
- "collide" — two objects colliding and reacting
- "compare" — two sides shown side by side
- "zoom" — zooming into/out of something
- "rotate" — object rotating

Return exactly this JSON structure:
{"topic":"Short catchy name","color":"#hex main color for this topic","scenes":[{"id":1,"emoji":"🎯","title":"Hook title","narration":"1-2 sentence narration spoken aloud","animation":"one of the animation types above","animConfig":{"label":"what the animation shows","primaryColor":"#hex","secondaryColor":"#hex","text":"short label shown on canvas"}},{"id":2,"emoji":"🔬","title":"...","narration":"...","animation":"...","animConfig":{...}},{"id":3,"emoji":"🌀","title":"...","narration":"...","animation":"...","animConfig":{...}},{"id":4,"emoji":"📐","title":"...","narration":"...","animation":"...","animConfig":{...}},{"id":5,"emoji":"💡","title":"...","narration":"...","animation":"...","animConfig":{...}}]}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        temperature: 0.72,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Create a 5-scene animated video script for: "${query}"` }
        ]
      })
    });

    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: j.error?.message || 'Groq API error' });

    let raw = j.choices?.[0]?.message?.content || '';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    raw = raw.replace(/[\r\n\t]/g, ' ').replace(/[\x00-\x1F\x7F]/g, ' ');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');

    let data;
    const rawJson = raw.slice(start, end + 1);
    try {
      data = JSON.parse(rawJson);
    } catch (parseErr) {
      let cleaned = rawJson.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      try { data = JSON.parse(cleaned); }
      catch (e2) { throw new Error('AI response was malformed — please try again'); }
    }

    if (!data.scenes || !Array.isArray(data.scenes) || data.scenes.length === 0) {
      throw new Error('Incomplete video script — please try again');
    }

    return res.status(200).json({ data });
  } catch (e) {
    console.error('Video gen error:', e.message);
    return res.status(500).json({ error: e.message || 'Failed to generate video' });
  }
}
