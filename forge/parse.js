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

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: PARSE_SYSTEM,
      messages: [{ role: 'user', content: 'Parse this workflow:\n\n' + userBrief }]
    })
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error('parse llm ' + r.status + ': ' + t.slice(0, 200));
  }
  const j = await r.json();
  const text = j.content?.[0]?.text || '';
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
