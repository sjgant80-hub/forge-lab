// ═══════════════════════════════════════════════════════════
// STAGE 2 — MAP WORKFLOW → ASS LIFECYCLE
// ●→〜→┃→♡→△→◐→◯
// intake → configure → work → verify → report → review → archive
// ═══════════════════════════════════════════════════════════

const ASS_DEFAULTS = [
  { state: 'intake',    label: 'intake',    glyph: '●' },
  { state: 'configure', label: 'configure', glyph: '〜' },
  { state: 'work',      label: 'in progress', glyph: '┃' },
  { state: 'verify',    label: 'verify',    glyph: '♡' },
  { state: 'report',    label: 'report',    glyph: '△' },
  { state: 'review',    label: 'review',    glyph: '◐' },
  { state: 'archive',   label: 'archived',  glyph: '◯' }
];

// Use parsed.ass_mapping when present; otherwise fall back to heuristic by keyword.
const KEYWORD_TO_STATE = {
  intake:    ['receive', 'intake', 'incoming', 'log sample', 'register', 'submit', 'request', 'order'],
  configure: ['configure', 'set up', 'protocol', 'select', 'plan', 'prep', 'design'],
  work:      ['run', 'process', 'execute', 'perform', 'collect', 'capture', 'analyse data', 'measure'],
  verify:    ['qc', 'quality', 'check', 'validate', 'verify', 'qa'],
  report:    ['report', 'draft', 'write up', 'document', 'invoice', 'bill', 'summarise'],
  review:    ['review', 'approve', 'sign off', 'audit', 'oversight', 'director'],
  archive:   ['archive', 'store', 'retain', 'close', 'complete', 'file']
};

function mapWorkflow(parsed, input) {
  const workflowSteps = input.workflow_steps || [];

  // If parser supplied a mapping, use it but tighten labels
  const mapping = (Array.isArray(parsed.ass_mapping) && parsed.ass_mapping.length > 0)
    ? parsed.ass_mapping
    : null;

  const enriched = ASS_DEFAULTS.map(s => ({ ...s, steps: [] }));

  if (mapping) {
    for (const m of mapping) {
      const slot = enriched.find(x => x.state === m.state);
      if (!slot) continue;
      const stepText = workflowSteps[m.step_index];
      if (stepText) slot.steps.push(stepText);
      if (m.label) slot.label = m.label;
    }
  }

  // Fill any gaps via keyword heuristic
  workflowSteps.forEach((step, idx) => {
    const used = enriched.some(s => s.steps.includes(step));
    if (used) return;
    const lower = step.toLowerCase();
    let matched = null;
    for (const [state, kws] of Object.entries(KEYWORD_TO_STATE)) {
      if (kws.some(k => lower.includes(k))) { matched = state; break; }
    }
    if (!matched) matched = idx === 0 ? 'intake' : (idx >= workflowSteps.length - 1 ? 'archive' : 'work');
    const slot = enriched.find(s => s.state === matched);
    if (slot) slot.steps.push(step);
  });

  // Drop empty trailing states if the workflow doesn't reach them
  // (Keep intake → work minimum)
  const populated = enriched.filter(s => s.steps.length > 0);
  if (populated.length < 3) {
    // Pad with empty defaults so the lifecycle bar isn't sad
    return enriched.slice(0, Math.max(3, populated.length + 1));
  }

  return enriched;
}

module.exports = { mapWorkflow, ASS_DEFAULTS };
