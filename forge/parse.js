// ═══════════════════════════════════════════════════════════
// STAGE 1 — PARSE
// Take the expert's plain-English description + structured hints
// Use LLM to extract: data model, agent hints, ASS mapping, compliance
// ═══════════════════════════════════════════════════════════

const PARSE_SYSTEM = `You are the Forge Lab parser. Your job is to take a domain expert's description of their workflow and extract a structured tool specification.

Output STRICT JSON only — no prose, no markdown, no explanations outside the JSON.

The JSON schema is:
{
  "tool_name": "string — short, brandable name based on input",
  "tool_id": "string — lowercase, no spaces, max 16 chars",
  "tool_description": "string — one-sentence description (≤140 chars)",
  "domain": "string — the domain in 1-3 words",
  "data_model": [
    {
      "name": "string — field name (lowercase, snake_case)",
      "type": "string — one of: string, number, dropdown, date, datetime, boolean, range, enum, longtext",
      "required": "boolean",
      "label": "string — human label",
      "unit": "string — optional, e.g. 'mg/dL'",
      "options": ["array — only for dropdown/enum"],
      "low": "number — only for range",
      "high": "number — only for range"
    }
  ],
  "agent_hints": {
    "alpha":   "boolean — needed if workflow has tracking/lookup/history",
    "beta":    "boolean — needed if workflow has data entry",
    "gamma":   "boolean — needed if workflow has sequencing/queues/QC",
    "delta":   "boolean — needed if workflow has analysis/flagging/trends",
    "epsilon": "boolean — needed if workflow has reporting/drafting",
    "zeta":    "boolean — needed if workflow has sending/sharing/notifications",
    "eta":     "boolean — needed if workflow has optimisation focus",
    "theta":   "boolean — needed if workflow has alerts/escalations"
  },
  "ass_mapping": [
    { "state": "string — short slug", "label": "string — human label", "step_index": "number — 0-based index in input workflow_steps" }
  ],
  "views": ["array of view slugs — derived from workflow_steps grouping"],
  "primary_pain_points": ["array of 1-3 strings — what the expert cares most about"],
  "compliance_notes": ["array of strings — any compliance hooks the tool needs"]
}

Rules:
- Map every workflow_step to exactly one ASS state. ASS has 7 stages (● intake, 〜 configure, ┃ work, ♡ verify, △ report, ◐ review, ◯ archive). Multiple workflow_steps can map to the same state.
- Field names: lowercase, snake_case, max 24 chars.
- Tool name: 1-3 words, capitalised, brandable. If brand.name is provided in input, use that exactly.
- Required boolean fields default to false. Mark required only when the workflow clearly needs that field.
- If data_fields.auto_detect is true, infer 4-10 fields from the workflow + description. Otherwise use the provided fields verbatim.
- If the expert mentions a compliance regime (HIPAA, GDPR, GLP, SRA, HACCP, etc.) include each in compliance_notes.

Output ONLY the JSON. No backticks. No prose.`;

// ── ◊·κ=φ⁴ · multi-provider cascade ──
// Tries providers in order. If one returns a credit/auth/quota error,
// falls through to the next. Throws a clean user-facing error if all fail.
async function callLLM({ system, user }) {
  const tried = [];
  const providers = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.OPENAI_API_KEY)    providers.push('openai');
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) providers.push('gemini');
  if (providers.length === 0) {
    const err = new Error('NO_PROVIDER · no LLM API key configured on the server');
    err.userFacing = 'Forge is offline: no AI provider configured. Owner needs to set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.';
    throw err;
  }
  let lastErr = null;
  for (const p of providers) {
    try {
      const text = await callProvider(p, { system, user });
      return { text, provider: p, tried };
    } catch (e) {
      tried.push(p + ':' + (e.classification || 'error'));
      lastErr = e;
      // Only fall through on recoverable errors (credit, quota, rate-limit, server)
      if (!e.recoverable) throw e;
    }
  }
  const err = new Error('ALL_PROVIDERS_FAILED · ' + tried.join(' · '));
  err.userFacing = 'Forge is temporarily unavailable: all AI providers are exhausted or down. Try again in a few minutes, or the owner needs to top up credits.';
  err.cause = lastErr;
  throw err;
}

async function callProvider(provider, { system, user }) {
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4096, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) throw await classifyError(r, 'anthropic');
    const j = await r.json();
    return j.content?.[0]?.text || '';
  }
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 4096, messages: [{ role:'system', content: system }, { role:'user', content: user }] }),
    });
    if (!r.ok) throw await classifyError(r, 'openai');
    const j = await r.json();
    return j.choices?.[0]?.message?.content || '';
  }
  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role:'user', parts: [{ text: user }] }] }),
    });
    if (!r.ok) throw await classifyError(r, 'gemini');
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  throw new Error('unknown provider ' + provider);
}

async function classifyError(r, provider) {
  const body = await r.text();
  const lower = (body || '').toLowerCase();
  let cls = 'unknown';
  let recoverable = false;
  if (r.status === 401 || r.status === 403)             { cls = 'auth';        recoverable = true; }
  else if (r.status === 429)                             { cls = 'rate_limit';  recoverable = true; }
  else if (r.status >= 500)                              { cls = 'server';      recoverable = true; }
  else if (lower.includes('credit') || lower.includes('quota') || lower.includes('billing')) { cls = 'credit'; recoverable = true; }
  else if (r.status === 400)                             { cls = 'bad_request'; recoverable = false; }
  const e = new Error(provider + ' ' + r.status + ' (' + cls + ')');
  e.classification = cls;
  e.recoverable = recoverable;
  e.providerStatus = r.status;
  return e;
}

async function parseInput(input, apiKey) {
  const userBrief = JSON.stringify({
    domain: input.domain || 'general',
    expert_description: input.expert_description || '',
    workflow_steps: input.workflow_steps || [],
    data_fields: input.data_fields || { auto_detect: true },
    compliance: input.compliance || [],
    users: input.users || [],
    brand: input.brand || {},
    integrations: input.integrations || {},
    ai_features: input.ai_features || {}
  }, null, 2);

  // Preserve legacy signature: if apiKey was passed explicitly, make sure ANTHROPIC_API_KEY env is set for the cascade
  if (apiKey && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = apiKey;

  const { text, provider } = await callLLM({
    system: PARSE_SYSTEM,
    user: 'Parse this workflow:\n\n' + userBrief,
  });
  // Strip backticks/markdown if model slips
  let raw = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Last-ditch: extract first { ... } block
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('parse output not JSON: ' + raw.slice(0, 200));
    parsed = JSON.parse(m[0]);
  }

  // Sanity-defaults if model forgot fields
  parsed.tool_name = parsed.tool_name || input.brand?.name || 'Forged Tool';
  parsed.tool_id = (parsed.tool_id || parsed.tool_name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  parsed.tool_description = parsed.tool_description || ('Sovereign tool for ' + (parsed.domain || input.domain || 'your workflow'));
  parsed.domain = parsed.domain || input.domain || 'general';
  parsed.data_model = Array.isArray(parsed.data_model) ? parsed.data_model : [];
  parsed.agent_hints = parsed.agent_hints || {};
  parsed.ass_mapping = Array.isArray(parsed.ass_mapping) ? parsed.ass_mapping : [];
  parsed.views = Array.isArray(parsed.views) ? parsed.views : ['workspace'];
  parsed.primary_pain_points = Array.isArray(parsed.primary_pain_points) ? parsed.primary_pain_points : [];
  parsed.compliance_notes = Array.isArray(parsed.compliance_notes) ? parsed.compliance_notes : (input.compliance || []);

  // Preserve user brand if provided
  if (input.brand) parsed.brand = input.brand;

  return parsed;
}

module.exports = { parseInput };
