// ═══════════════════════════════════════════════════════════
// STAGE 5 — VERIFY
// ƒ(build) self-check on the forged HTML
// All 7 v18 layers present + mesh shim wired + sovereign constraints met
// ═══════════════════════════════════════════════════════════

const CHECKS = [
  { id: 'L1_FACE',     label: 'L1 FACE · views present',         test: h => /class="view( active)?"/.test(h) && /id="tabs"/.test(h) },
  { id: 'L2_SWARM',    label: 'L2 SWARM · Ω + α-θ agents',       test: h => /const AGENTS = \{/.test(h) && /omega:/.test(h) },
  { id: 'L3_CASCADE',  label: 'L3 CASCADE · T0-T3 path',         test: h => /async function cascade/.test(h) && /T0_HANDLERS/.test(h) },
  { id: 'L4_BLOOM',    label: 'L4 BLOOM · intent routing',       test: h => /function bloomRoute/.test(h) },
  { id: 'L5_PERSIST',  label: 'L5 PERSIST · localStorage',       test: h => /localStorage\.setItem/.test(h) && /function save/.test(h) },
  { id: 'L6_SKIN',     label: 'L6 SKIN · CSS tokens + fonts',    test: h => /--primary:/.test(h) && /Syne/.test(h) },
  { id: 'L7_ASS',      label: 'L7 ASS · lifecycle ●→◯',          test: h => /const ASS = \['●'/.test(h) && /function lifecycle/.test(h) },
  { id: 'MESH',        label: 'mesh · BroadcastChannel fallmesh', test: h => /BroadcastChannel\('fallmesh'\)/.test(h) },
  { id: 'IDENTITY',    label: 'identity · NODE + prime stamp',   test: h => /const NODE = \{/.test(h) && /prime:/.test(h) },
  { id: 'ED25519',     label: 'Konomi licence · Ed25519 verifier baked',
    test: h => /KONOMI = \{/.test(h) && /pubkey_b64: '[A-Za-z0-9+/=]{40,}'/.test(h) && /async function verifyLicence/.test(h) },
  { id: 'DEAD_MODE',   label: 'DEAD-mode tier check + record cap',
    test: h => /KONOMI.tier/.test(h) && /DEAD_RECORD_CAP/.test(h) },
  { id: 'NO_PLACEHOLDERS', label: 'no leftover __INJECT__ markers', test: h => !/__INJECT_[A-Z_]+__/.test(h) },
  { id: 'NO_CDN_BREAK', label: 'no CDN-only deps in core logic',  test: h => !/\bunpkg\.com\b/.test(h) && !/\bcdnjs\.cloudflare\b/.test(h) },
  { id: 'SIZE',        label: 'size · under 500KB',              test: h => h.length < 500 * 1024 }
];

function verify(html) {
  const results = CHECKS.map(c => ({
    id: c.id,
    label: c.label,
    pass: !!c.test(html)
  }));
  const passed = results.filter(r => r.pass).length;
  return {
    passed,
    total: results.length,
    ok: passed === results.length,
    size_kb: Math.round(html.length / 1024),
    checks: results
  };
}

module.exports = { verify };
