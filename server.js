// ═══════════════════════════════════════════════════════════
// ◊·κ=1 · FORGE LAB · DOMAIN EXPERT TOOL BUILDER
// You bring the architecture. They bring the knowledge.
// prime 47 · Ω(FACE) · 47 faces · face engine builds faces
// ═══════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { parseInput } = require('./forge/parse.js');
const { mapWorkflow } = require('./forge/map-workflow.js');
const { selectAgents } = require('./forge/select-agents.js');
const { build } = require('./forge/build.js');
const { verify } = require('./forge/verify.js');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'forge_admin_' + crypto.randomBytes(16).toString('hex');

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static('public'));

// ── auth · RapidAPI proxy or direct key ─────────────
function auth(req, res, next) {
  const proxySecret = process.env.RAPIDAPI_PROXY_SECRET;
  const incomingSecret = req.headers['x-rapidapi-proxy-secret'] || req.headers['x-proxy-secret'];
  if (proxySecret && incomingSecret === proxySecret) {
    req.tier = 'rapidapi';
    req.rapidUser = req.headers['x-rapidapi-user'] || null;
    req.rapidSubscription = req.headers['x-rapidapi-subscription'] || null;
    return next();
  }
  const key = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key required' });
  if (key === ADMIN_KEY) { req.tier = 'admin'; return next(); }
  return res.status(403).json({ error: 'Invalid API key' });
}

// ── /health ────────────────────────────────────────
app.get('/health', (req, res) => {
  const providers = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  res.json({
    status: 'ok',
    service: 'forge-lab',
    version: '1.0.0',
    prime: 47,
    providers,
    forge_stages: ['parse', 'map', 'select', 'build', 'verify']
  });
});

// ── /v1/types ──────────────────────────────────────
app.get('/v1/types', (req, res) => {
  res.json({
    generators: [
      {
        type: 'expert',
        endpoint: '/v1/forge/expert',
        description: 'Forge a sovereign HTML tool from a domain expert\'s workflow description. Returns base64 HTML + metadata.'
      }
    ]
  });
});

// ── /v1/forge/expert · the main endpoint ───────────
app.post('/v1/forge/expert', auth, async (req, res) => {
  const t0 = Date.now();
  try {
    const input = req.body || {};
    if (!input.expert_description || typeof input.expert_description !== 'string' || input.expert_description.length < 20) {
      return res.status(400).json({ error: 'expert_description is required (min 20 chars)' });
    }
    if (!Array.isArray(input.workflow_steps) || input.workflow_steps.length < 2) {
      return res.status(400).json({ error: 'workflow_steps is required (min 2 steps)' });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'no LLM provider configured' });

    // STAGE 1 · PARSE
    const parsed = await parseInput(input, apiKey);

    // STAGE 2 · MAP
    const assStages = mapWorkflow(parsed, input);

    // STAGE 3 · SELECT
    const agents = selectAgents(parsed, input);

    // STAGE 4 · BUILD
    const built = build(parsed, assStages, agents, input);

    // STAGE 5 · VERIFY
    const v = verify(built.html);

    const filenameSafe = parsed.tool_id.replace(/[^a-z0-9-]/g, '') || 'forged-tool';
    const filename = filenameSafe + '.html';

    res.json({
      tool_file: Buffer.from(built.html, 'utf8').toString('base64'),
      filename,
      size_kb: built.meta.size_kb,
      detected_agents: built.meta.detected_agents,
      detected_views: built.meta.detected_views,
      ass_stages: built.meta.ass_stages,
      compliance_applied: built.meta.compliance_applied,
      verification: {
        passed: v.passed,
        total: v.total,
        ok: v.ok,
        failed: v.checks.filter(c => !c.pass).map(c => c.label)
      },
      licence: {
        trial_days: 30,
        forge_id: built.meta.forge_id,
        prime: built.meta.prime
      },
      forge_meta: {
        tool_name: parsed.tool_name,
        domain: parsed.domain,
        built: built.meta.built,
        forge_ms: Date.now() - t0
      }
    });
  } catch (e) {
    console.error('forge error:', e);
    res.status(500).json({ error: 'forge failed', detail: String(e.message || e).slice(0, 500) });
  }
});

// ── /v1/forge/expert · sync HTML response (browser-friendly) ──
app.post('/v1/forge/expert.html', auth, async (req, res) => {
  // Same as above but returns the HTML directly with download headers
  // (Useful for the Pages landing form)
  const input = req.body || {};
  if (!input.expert_description || typeof input.expert_description !== 'string') {
    return res.status(400).json({ error: 'expert_description required' });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'no LLM provider configured' });
  try {
    const parsed = await parseInput(input, apiKey);
    const assStages = mapWorkflow(parsed, input);
    const agents = selectAgents(parsed, input);
    const built = build(parsed, assStages, agents, input);
    const filename = (parsed.tool_id.replace(/[^a-z0-9-]/g, '') || 'forged-tool') + '.html';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(built.html);
  } catch (e) {
    res.status(500).json({ error: 'forge failed', detail: String(e.message || e).slice(0, 500) });
  }
});

// ── root ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('◊·κ=1 · forge-lab listening on port ' + PORT);
  console.log('  /v1/forge/expert   · POST  · forge a sovereign tool');
  console.log('  /v1/types          · GET   · list generators');
  console.log('  /health            · GET   · service status');
  if (!process.env.ANTHROPIC_API_KEY) console.log('  ⚠ ANTHROPIC_API_KEY not set');
});
