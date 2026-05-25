// ═══════════════════════════════════════════════════════════
// STAGE 3 — SELECT AGENTS
// Pick Ω + 3-8 specialists from α-θ based on parsed hints + workflow signal
// ═══════════════════════════════════════════════════════════

const LIBRARY = require('../templates/agents/library.js');

const FEATURE_TO_AGENT = {
  // workflow keyword → agent that handles it
  alpha:   ['track', 'log', 'find', 'search', 'lookup', 'history', 'archive', 'records', 'audit', 'trail'],
  beta:    ['enter', 'add', 'record', 'create', 'capture', 'submit', 'register', 'input'],
  gamma:   ['workflow', 'queue', 'sequence', 'order', 'qc', 'quality', 'check', 'protocol', 'schedule'],
  delta:   ['analyse', 'analyze', 'flag', 'trend', 'pattern', 'unusual', 'anomaly', 'compare', 'metric'],
  epsilon: ['report', 'draft', 'document', 'summarise', 'summarize', 'invoice', 'letter', 'write'],
  zeta:    ['send', 'share', 'export', 'distribute', 'notify', 'email', 'sync', 'broadcast'],
  eta:     ['optimise', 'optimize', 'improve', 'efficient', 'reduce', 'batch', 'speed', 'turnaround'],
  theta:   ['alert', 'critical', 'urgent', 'priority', 'escalate', 'risk', 'emergency', 'flag']
};

function selectAgents(parsed, input) {
  const hints = parsed.agent_hints || {};
  const haystack = ((input.expert_description || '') + ' ' + (input.workflow_steps || []).join(' ')).toLowerCase();

  // Score each specialist
  const scores = {};
  for (const [id, kws] of Object.entries(FEATURE_TO_AGENT)) {
    let s = 0;
    // Parser hint adds weight 3
    if (hints[id] === true) s += 3;
    // Each keyword hit adds 1
    for (const kw of kws) {
      const re = new RegExp('\\b' + kw + '\\b', 'i');
      if (re.test(haystack)) s += 1;
    }
    scores[id] = s;
  }

  // Always include Ω. Pick specialists with score >= 1, min 3, max 8
  const ranked = Object.entries(scores)
    .filter(([, s]) => s >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // Pad to min 3 if we don't have enough — pick the most universally useful
  const FALLBACK_ORDER = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
  while (ranked.length < 3) {
    const next = FALLBACK_ORDER.find(id => !ranked.includes(id));
    if (!next) break;
    ranked.push(next);
  }

  const chosen = ['omega', ...ranked.slice(0, 8)];

  // Build the runtime agent map with domain substitution
  const TOOL_NAME = parsed.tool_name || 'this tool';
  const DOMAIN = parsed.domain || 'general';
  const detected = {};
  const detectedList = [];

  for (const id of chosen) {
    const a = LIBRARY[id];
    if (!a) continue;
    const personalised = {
      id: a.id,
      role: a.role,
      sys: a.sys.replace(/__DOMAIN__/g, DOMAIN).replace(/__TOOL_NAME__/g, TOOL_NAME),
      triggers: a.triggers
    };
    detected[id] = personalised;
    detectedList.push({
      id,
      glyph: a.id,
      role: a.role,
      name: roleToName(id, DOMAIN)
    });
  }

  return { agents: detected, list: detectedList };
}

// Friendly per-domain agent names (rough heuristic, the LLM in STAGE 1 could improve this)
function roleToName(id, domain) {
  const FRIENDLY = {
    omega:   'Orchestrator',
    alpha:   'Tracker',
    beta:    'Recorder',
    gamma:   'Sequencer',
    delta:   'Analyser',
    epsilon: 'Writer',
    zeta:    'Distributor',
    eta:     'Optimiser',
    theta:   'Sentinel'
  };
  return FRIENDLY[id] || id;
}

module.exports = { selectAgents };
