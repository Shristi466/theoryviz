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

  // ── SUGGESTIONS ──
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
            content: 'Return ONLY a valid JSON array of exactly 5 short curious science question strings. No markdown, no explanation. Make them feel like things a teenager would genuinely wonder about.'
          }, {
            role: 'user',
            content: `Give 5 related everyday curiosity questions for the topic: "${query}"`
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

  // ── MAIN STORY GENERATION ──
  // Detect topic type to tailor instructions
  const topicLower = query.toLowerCase();
  const isHistory = /history|war|revolution|empire|ancient|civilization|battle|century|kingdom|dynasty/.test(topicLower);
  const isBio = /biology|cell|dna|gene|evolution|animal|plant|body|blood|heart|brain|virus|bacteria|cancer/.test(topicLower);
  const isChem = /chemistry|chemical|reaction|atom|molecule|element|compound|acid|base|bond|periodic/.test(topicLower);
  const isTech = /computer|code|internet|software|ai|algorithm|crypto|blockchain|programming|network|data/.test(topicLower);
  const isMath = /math|calculus|algebra|geometry|equation|theorem|proof|statistics|probability/.test(topicLower);
  const isPhysics = /physics|force|energy|gravity|momentum|wave|light|quantum|relativity|thermodynamics|electric|magnet/.test(topicLower);
  const isEcon = /economics|money|market|trade|inflation|supply|demand|capitalism|stock|finance/.test(topicLower);

  // Dynamic scene4 instruction based on topic type
  let scene4Tip = 'Find the core formula, equation, rule, or principle. Simplify it into plain English.';
  if (isHistory) scene4Tip = 'Instead of a formula, give the KEY CAUSE-EFFECT rule (e.g. "Power + Inequality + Trigger = Revolution"). Make it feel like a pattern they can spot in history.';
  if (isBio) scene4Tip = 'Find the biological rule or mechanism. Express it simply (e.g. "DNA → RNA → Protein = how your cells build everything").';
  if (isChem) scene4Tip = 'Use the core chemical equation or rule. Explain it like a recipe (reactants → products).';
  if (isTech) scene4Tip = 'Find the core technical logic or algorithm concept. Express as a simple rule or flowchart in words.';
  if (isMath) scene4Tip = 'Take the core theorem or formula and explain it with a concrete visual example, not abstract symbols.';
  if (isEcon) scene4Tip = 'State the core economic principle as a simple cause-effect rule (e.g. "More demand + less supply = higher price").';

  const SYSTEM = `You are TheoryViz AI — a genius science communicator who explains ANYTHING to curious teenagers.
Your superpower: you make ANY topic — physics, history, biology, chemistry, tech, math, economics, philosophy, culture — feel like the most fascinating thing ever.

ABSOLUTE RULES:
1. ALWAYS start with a real moment the user has personally experienced or seen
2. Explain like talking to a smart 15-year-old who just went "wait, why does that happen?"
3. ZERO academic tone — conversational, vivid, surprising
4. Every sentence should make them lean in, not tune out
5. Use PARA as paragraph separator — NEVER put actual newlines inside JSON string values
6. Return ONLY valid compact JSON — no markdown fences, no comments, no trailing commas
7. All strings must be single-line — escape any quotes inside strings

TOPIC TYPE DETECTED: ${isHistory?'History/Social':isBio?'Biology':isChem?'Chemistry':isTech?'Technology':isMath?'Mathematics':isEcon?'Economics':isPhysics?'Physics':'General Science'}
SCENE 4 APPROACH: ${scene4Tip}

Return exactly this JSON (compact, no newlines between fields):
{"topic":"Short catchy topic name","scene1":{"emoji":"🎯","question":"A vivid everyday question THEY have actually wondered — make it specific and relatable","situation":"2 sentences describing the exact moment they would experience this — paint a picture","revealText":"The surprising one-line answer that makes them go WOW"},"scene2":{"emoji":"🔬","title":"Slow-Motion Breakdown","steps":["Step 1 — what happens first","Step 2 — what happens next","Step 3 — the key moment","Step 4 — the result"],"insight":"One sentence connecting all steps to the big picture"},"scene3":{"emoji":"🌀","title":"The Hidden [Force/Rule/Pattern/Process] Revealed","concept":"2-4 word name of the core concept","visual":"What the invisible thing looks like if you could see it — be creative and visual","analogy":"A comparison to something they definitely know (not academic)"},"scene4":{"emoji":"📐","rawFormula":"The core formula, rule, or pattern — can be symbolic OR a word equation for non-physics topics","friendlyFormula":"Plain English version — explain what each part means in daily life terms","comparison":["Scenario A — lighter/smaller/simpler case","Scenario B — heavier/bigger/more complex case — same rule, different result"],"quiz":{"question":"Simple multiple choice testing the core idea","options":["Option A","Option B","Option C"],"correct":0}},"scene5":{"emoji":"💡","revelation":"That is exactly why [specific amazing daily phenomenon]. Without this [specific consequence that surprises them].","examples":["Real example 1 from daily life","Real example 2 from a different context","Real example 3 — the most surprising one"],"challenge":"Next time you [specific daily action], notice [specific thing they will now see differently]."}}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 1400,
        temperature: 0.78,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Create a full 5-scene TheoryViz story for: "${query}"` }
        ]
      })
    });

    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: j.error?.message || 'Groq API error' });

    let raw = j.choices?.[0]?.message?.content || '';
    // Strip any markdown
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // Remove control chars and actual newlines inside strings
    raw = raw.replace(/[\r\n\t]/g, ' ').replace(/[\x00-\x1F\x7F]/g, ' ');
    // Find the JSON object
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    
    let data;
    try {
      data = JSON.parse(raw.slice(start, end + 1));
    } catch(parseErr) {
      // Try aggressive cleanup
      let cleaned = raw.slice(start, end + 1)
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      data = JSON.parse(cleaned);
    }

    return res.status(200).json({ data });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to generate story' });
  }
}
