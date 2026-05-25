// ═══════════════════════════════════════════════════════════
// STAGE 4 — BUILD
// Take parsed + agents + ASS map, assemble the master template
// into a single sovereign HTML file
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'templates', 'sovereign-tool.html'), 'utf8');
const { KONOMI_PUBKEY_B64 } = require('./licence.js');

// Pool of extension primes for forged tools. Skip already-claimed ones.
// Claimed primes across the mesh as of forge-lab launch:
// 2 fallcall · 3 groundlevel · 5 falllearn · 7 falloffice · 11 fallgrade
// 13 fallconsensus · 17 fallsignal · 19 fallforensics · 23 oracleengine
// 29 fallscout · 31 fallaccount · 41 fallcube-api · 47 forge-lab itself
// 97 falllead · 101 datascope · 103 fallconcierge · 107 fallreach
// 109 konomi-swarm · 127 fall127agents · 709 fallforce
const FORGED_TOOL_PRIMES = [37, 43, 53, 59, 61, 67, 71, 73, 79, 83, 89,
  113, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199];

function pickPrime(forgeId) {
  // Stable: hash forgeId, pick from pool
  const h = parseInt(crypto.createHash('sha256').update(forgeId).digest('hex').slice(0, 8), 16);
  return FORGED_TOOL_PRIMES[h % FORGED_TOOL_PRIMES.length];
}

function defaultBrand() {
  return {
    bg: '#0a0b0e', surface: '#12141a', s2: '#181b22', border: '#252932',
    text: '#a8b0bc', dim: '#5a626e', bright: '#e6e8ee',
    primary: '#5b8def', accent: '#3a9a72'
  };
}

function brandFromInput(input) {
  const b = defaultBrand();
  if (input.brand?.primary_color) b.primary = input.brand.primary_color;
  if (input.brand?.accent_color) b.accent = input.brand.accent_color;
  return b;
}

function buildTabs(views) {
  return views.map((v, i) => {
    const label = v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `<button data-view="${escAttr(v)}"${i === 0 ? ' class="active"' : ''}>${escHtml(label)}</button>`;
  }).join('');
}

function buildViews(parsed, assStages, agentList) {
  const views = parsed.views || ['workspace'];
  const dataModel = parsed.data_model || [];
  const out = [];

  views.forEach((vSlug, idx) => {
    const label = vSlug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let body = '';

    // Heuristic: name the views by intent
    const lower = vSlug.toLowerCase();
    if (lower.includes('intake') || lower.includes('new') || lower.includes('add') || idx === 0) {
      body = buildIntakeView(dataModel, parsed);
    } else if (lower.includes('archive') || lower.includes('history')) {
      body = buildArchiveView(parsed);
    } else if (lower.includes('analytic') || lower.includes('report') || lower.includes('insight')) {
      body = buildAnalyticsView(parsed, agentList);
    } else {
      body = buildWorkspaceView(parsed, assStages, dataModel);
    }

    out.push(`<section class="view${idx === 0 ? ' active' : ''}" data-view="${escAttr(vSlug)}">
      <h2>${escHtml(label)}</h2>
      ${body}
    </section>`);
  });

  return out.join('\n');
}

function buildIntakeView(dataModel, parsed) {
  const fields = dataModel.map(f => fieldToHtml(f)).join('\n');
  return `
    <p class="lead">Create a new record. Fields with * are required. Data stays on this device.</p>
    <form id="intake-form" onsubmit="event.preventDefault();intakeSubmit();">
      <div class="cards">${fields}</div>
      <div class="row" style="margin-top:16px">
        <button class="btn" type="submit">Save record</button>
        <button class="btn ghost small" type="button" onclick="intakeReset()">Reset</button>
      </div>
    </form>
  `;
}

function buildWorkspaceView(parsed, assStages, dataModel) {
  const cols = dataModel.slice(0, 5).map(f => `<th>${escHtml(f.label || f.name)}</th>`).join('');
  return `
    <p class="lead">${escHtml((parsed.primary_pain_points || []).slice(0, 1).join(' ') || 'Active work queue. Click any record to drill in.')}</p>
    <div class="lifecycle" id="lifecycle"></div>
    <div class="card">
      <div class="row" style="margin-bottom:10px">
        <input class="mono" id="ws-search" placeholder="search records…" style="flex:1;background:var(--s2);border:1px solid var(--border);color:var(--bright);padding:9px 12px;border-radius:8px">
        <button class="btn small" onclick="setView('${parsed.views?.[0] || 'workspace'}')">+ new</button>
      </div>
      <table id="ws-table">
        <thead><tr>${cols}<th>status</th></tr></thead>
        <tbody id="ws-body"><tr><td colspan="${dataModel.slice(0,5).length+1}"><div class="empty"><div class="glyph">●</div><h3>No records yet</h3><p>Add your first record from the intake tab.</p></div></td></tr></tbody>
      </table>
    </div>
  `;
}

function buildAnalyticsView(parsed, agentList) {
  const agentCards = agentList.map(a => `
    <div class="card">
      <h3>${escHtml(a.glyph)} · ${escHtml(a.name)}</h3>
      <div class="meta">${escHtml(a.role)}</div>
      <div class="body">Ask this agent a question about your data.</div>
      <div class="row" style="margin-top:10px">
        <button class="btn small" onclick="askAgent('${escAttr(a.id)}')">ask ${escHtml(a.glyph)}</button>
      </div>
    </div>
  `).join('');

  return `
    <p class="lead">Your swarm. Each agent specialises. ${escHtml(agentList.length)} active.</p>
    <div class="cards">${agentCards}</div>
    <div class="card">
      <h3>natural-language query</h3>
      <div class="meta">L4 BLOOM routes to the best agent automatically</div>
      <div class="row" style="margin-top:8px">
        <textarea id="nlq" placeholder="ask anything about your data" style="flex:1"></textarea>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn" onclick="runNLQ()">ask</button>
        <span class="pill" id="nlq-route"></span>
      </div>
      <pre id="nlq-out" class="mono" style="margin-top:14px;color:var(--text);font-size:13px;white-space:pre-wrap"></pre>
    </div>
  `;
}

function buildArchiveView(parsed) {
  return `
    <p class="lead">Archived records. Read-only.</p>
    <div class="card">
      <table>
        <thead><tr><th>id</th><th>archived</th><th>summary</th></tr></thead>
        <tbody id="archive-body"><tr><td colspan="3"><div class="empty"><div class="glyph">◯</div><h3>Empty archive</h3><p>Archived records will appear here.</p></div></td></tr></tbody>
      </table>
    </div>
  `;
}

function fieldToHtml(f) {
  const id = 'fld_' + f.name;
  const lbl = (f.label || f.name) + (f.required ? ' *' : '');
  let ctrl = '';
  switch (f.type) {
    case 'dropdown':
    case 'enum':
      ctrl = `<select id="${id}" name="${escAttr(f.name)}"${f.required ? ' required' : ''}>${(f.options||[]).map(o => `<option>${escHtml(o)}</option>`).join('')}</select>`;
      break;
    case 'number':
      ctrl = `<input id="${id}" name="${escAttr(f.name)}" type="number" step="any"${f.required ? ' required' : ''}${f.unit ? ' placeholder="'+escAttr(f.unit)+'"' : ''}>`;
      break;
    case 'date':
      ctrl = `<input id="${id}" name="${escAttr(f.name)}" type="date"${f.required ? ' required' : ''}>`;
      break;
    case 'datetime':
      ctrl = `<input id="${id}" name="${escAttr(f.name)}" type="datetime-local"${f.required ? ' required' : ''}>`;
      break;
    case 'boolean':
      ctrl = `<input id="${id}" name="${escAttr(f.name)}" type="checkbox">`;
      break;
    case 'range':
      ctrl = `<input id="${id}" name="${escAttr(f.name)}" type="range" min="${f.low ?? 0}" max="${f.high ?? 100}">`;
      break;
    case 'longtext':
      ctrl = `<textarea id="${id}" name="${escAttr(f.name)}"${f.required ? ' required' : ''}></textarea>`;
      break;
    default:
      ctrl = `<input id="${id}" name="${escAttr(f.name)}" type="text"${f.required ? ' required' : ''}>`;
  }
  return `<div class="card field"><label for="${id}">${escHtml(lbl)}</label>${ctrl}${f.unit && f.type === 'number' ? `<div class="meta">unit: ${escHtml(f.unit)}</div>` : ''}</div>`;
}

function buildAgentsJs(agentsMap) {
  const entries = Object.entries(agentsMap).map(([id, a]) => {
    return `  ${id}: { id: ${JSON.stringify(a.id)}, role: ${JSON.stringify(a.role)}, triggers: ${JSON.stringify(a.triggers)}, sys: ${JSON.stringify(a.sys)} }`;
  }).join(',\n');
  return `const AGENTS = {\n${entries}\n};`;
}

function buildAssLabels(assStages) {
  return JSON.stringify(assStages.map(s => ({ state: s.state, label: s.label })));
}

function buildT0Handlers(dataModel) {
  return `
  'records:list': () => ({ items: DB.records }),
  'records:add': (p) => { const r = Object.assign({ _id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), _state: '${dataModel.length ? 'intake' : 'work'}', _created: Date.now() }, p); DB.records.unshift(r); save(); return r; },
  'records:update': (p) => { const r = DB.records.find(x => x._id === p._id); if (r) { Object.assign(r, p); save(); } return r; },
  'records:remove': (p) => { DB.records = DB.records.filter(x => x._id !== p._id); save(); return { removed: p._id }; }
`;
}

function buildMeshInbound(parsed) {
  return `
    if (m.type === 'records:share' && m.payload) {
      DB.records.unshift(Object.assign({}, m.payload, { _id: 'mesh_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), _state: 'intake', _created: Date.now(), _source: 'mesh:' + m.from }));
      save();
      toast('◊ mesh inbound from ' + m.from, 'ok');
      if (typeof renderWorkspace === 'function') renderWorkspace();
    }
  `;
}

function buildDomainLogic(parsed, assStages) {
  return `
function fieldsArray() { return ${JSON.stringify((parsed.data_model || []).map(f => f.name))}; }
function intakeSubmit() {
  const form = document.getElementById('intake-form');
  if (!form) return;
  const fd = new FormData(form);
  const rec = {};
  for (const n of fieldsArray()) rec[n] = fd.get(n) ?? '';
  cascade('records:add', rec).then(r => {
    toast('record saved · ' + (r.result?._id || 'ok'), 'ok');
    form.reset();
    if (typeof renderWorkspace === 'function') renderWorkspace();
  });
}
function intakeReset() {
  const f = document.getElementById('intake-form');
  if (f) f.reset();
}
function renderWorkspace() {
  const body = document.getElementById('ws-body');
  if (!body) return;
  const fields = ${JSON.stringify((parsed.data_model || []).slice(0, 5).map(f => f.name))};
  if (!DB.records.length) {
    body.innerHTML = '<tr><td colspan="' + (fields.length+1) + '"><div class="empty"><div class="glyph">●</div><h3>No records yet</h3><p>Add your first record from the intake tab.</p></div></td></tr>';
    return;
  }
  body.innerHTML = DB.records.map(r => '<tr>' + fields.map(f => '<td>' + esc(r[f] ?? '') + '</td>').join('') + '<td><span class="pill">' + esc(r._state || 'work') + '</span></td></tr>').join('');
}
async function runNLQ() {
  const text = document.getElementById('nlq').value.trim();
  if (!text) return;
  const route = bloomRoute(text);
  const routeEl = document.getElementById('nlq-route');
  if (routeEl) routeEl.textContent = '→ ' + (AGENTS[route]?.id || route);
  const out = document.getElementById('nlq-out');
  if (out) out.textContent = '◊ routing…';
  try {
    if (!DB.settings.api_key) {
      const key = prompt('Anthropic API key (stored only on this device):');
      if (key) { DB.settings.api_key = key; save(); }
      else { if(out) out.textContent = 'no key set'; return; }
    }
    const r = await cascade(text, { text, records: DB.records.slice(0, 50) });
    if (out) out.textContent = r.result?.text || JSON.stringify(r, null, 2);
  } catch (e) {
    if (out) out.textContent = 'error: ' + e.message;
  }
}
function askAgent(id) {
  document.getElementById('nlq')?.focus();
  toast('agent ' + (AGENTS[id]?.id || id) + ' selected · type your query', 'ok');
}
function onBoot() {
  if (typeof renderWorkspace === 'function') renderWorkspace();
  lifecycle('${assStages[0]?.state || 'intake'}');
}
const initialLifecycle = '${assStages[0]?.state || 'intake'}';
`;
}

// HTML escapers
function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escAttr(s) { return escHtml(s); }

function build(parsed, assStages, agentSelection, input) {
  const brand = brandFromInput(input);
  const forgeId = 'fg_' + crypto.randomBytes(6).toString('hex');
  const prime = pickPrime(forgeId);
  const builtAt = new Date().toISOString();

  let html = TEMPLATE;

  // identity markers
  html = html.replace(/__TOOL_NAME__/g, escHtml(parsed.tool_name));
  html = html.replace(/__TOOL_DESCRIPTION__/g, escAttr(parsed.tool_description));
  html = html.replace(/__TOOL_ID__/g, parsed.tool_id);
  html = html.replace(/__TOOL_DOMAIN__/g, escHtml(parsed.domain));
  html = html.replace(/__TOOL_PRIME__/g, String(prime));
  html = html.replace(/__TOOL_BUILT__/g, builtAt);
  html = html.replace(/__TOOL_FORGE_ID__/g, forgeId);

  // brand
  html = html.replace('__BRAND_BG__', brand.bg);
  html = html.replace('__BRAND_SURFACE__', brand.surface);
  html = html.replace('__BRAND_S2__', brand.s2);
  html = html.replace('__BRAND_BORDER__', brand.border);
  html = html.replace('__BRAND_TEXT__', brand.text);
  html = html.replace('__BRAND_DIM__', brand.dim);
  html = html.replace('__BRAND_BRIGHT__', brand.bright);
  html = html.replace('__BRAND_PRIMARY__', brand.primary);
  html = html.replace('__BRAND_ACCENT__', brand.accent);

  // konomi licence (pubkey hard-baked, trial envelope filled by server.js after build)
  html = html.replace('__INJECT_KONOMI_PUBKEY__', KONOMI_PUBKEY_B64);

  // dynamic injections
  html = html.replace('__INJECT_CSS__', '');
  html = html.replace('__INJECT_TABS__', buildTabs(parsed.views));
  html = html.replace('__INJECT_VIEWS__', buildViews(parsed, assStages, agentSelection.list));
  html = html.replace('__INJECT_AGENTS__', buildAgentsJs(agentSelection.agents));
  html = html.replace('__INJECT_T0_HANDLERS__', buildT0Handlers(parsed.data_model || []));
  html = html.replace('__INJECT_ASS_LABELS__', buildAssLabels(assStages));
  html = html.replace('__INJECT_MESH_INBOUND__', buildMeshInbound(parsed));
  html = html.replace('__INJECT_DOMAIN_LOGIC__', buildDomainLogic(parsed, assStages));

  return {
    html,
    meta: {
      tool_name: parsed.tool_name,
      tool_id: parsed.tool_id,
      forge_id: forgeId,
      prime,
      built: builtAt,
      domain: parsed.domain,
      size_kb: Math.round(html.length / 1024),
      detected_agents: agentSelection.list,
      detected_views: parsed.views,
      ass_stages: assStages.map(s => ({ state: s.state, label: s.label, glyph: s.glyph })),
      compliance_applied: parsed.compliance_notes || []
    }
  };
}

module.exports = { build, pickPrime };
