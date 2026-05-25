// ═══════════════════════════════════════════════════════════
// ◊·κ KONOMI LICENCE — Ed25519 signing
// Ω(LICENCE): ship DEAD · Ed25519 wakes · bloom = buyer identity
// ═══════════════════════════════════════════════════════════
//
// Payload schema (v1):
//   {
//     v: 1,
//     forge_id: 'fg_xxx',   // unique per forged tool
//     tool_id:  'pathlabpro',
//     tool_prime: 139,
//     tier: 'trial' | 'pro' | 'business' | 'enterprise',
//     features: ['unlimited_records', 'all_agents', 'white_label', ...],
//     issued: ISO timestamp,
//     expires: ISO timestamp,
//     bloom: optional bloom signature of buyer,
//     issuer: 'konomi'
//   }
//
// Envelope (what the user pastes / what the tool reads):
//   base64( JSON({ payload, sig }) )
//   where sig = base64( ed25519_sign(canonical_json(payload), priv) )
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');

function canonicalJSON(obj) {
  // Stable stringify: sort keys recursively
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') + '}';
}

function loadPrivateKey() {
  const raw = process.env.KONOMI_PRIVATE_KEY;
  if (!raw) throw new Error('KONOMI_PRIVATE_KEY not set');
  // Pad raw 32-byte ed25519 private key into a DER/PKCS8 envelope so Node can use it
  const seed = Buffer.from(raw, 'base64');
  if (seed.length !== 32) throw new Error('KONOMI_PRIVATE_KEY must be 32 bytes base64');
  // PKCS8 prefix for Ed25519 (OID 1.3.101.112)
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const der = Buffer.concat([prefix, seed]);
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

function sign(payload) {
  const privKey = loadPrivateKey();
  const message = Buffer.from(canonicalJSON(payload), 'utf8');
  const sig = crypto.sign(null, message, privKey);
  return sig.toString('base64');
}

function envelope(payload) {
  const sig = sign(payload);
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64');
}

// Pubkey embedded into forged tools so they can verify their own licence
const KONOMI_PUBKEY_B64 = 'bQWcb/SgeWVIEa0H+YYGhzohMfo9zcDysqZEvzYtXTw=';

function pubkey() {
  return KONOMI_PUBKEY_B64;
}

// Verify on the server side (for licence-mint admin endpoint, paste-checking)
function verify(env) {
  try {
    const raw = Buffer.from(env, 'base64').toString('utf8');
    const { payload, sig } = JSON.parse(raw);
    const pubRaw = Buffer.from(KONOMI_PUBKEY_B64, 'base64');
    // SPKI prefix for Ed25519
    const prefix = Buffer.from('302a300506032b6570032100', 'hex');
    const der = Buffer.concat([prefix, pubRaw]);
    const pubKey = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    const message = Buffer.from(canonicalJSON(payload), 'utf8');
    const sigBuf = Buffer.from(sig, 'base64');
    const ok = crypto.verify(null, message, pubKey, sigBuf);
    if (!ok) return { ok: false, error: 'signature invalid' };
    if (payload.expires && new Date(payload.expires) < new Date()) {
      return { ok: false, error: 'licence expired', payload };
    }
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Build a trial licence for a freshly forged tool (auto-issued at forge time)
function mintTrial({ forge_id, tool_id, tool_prime, days = 30 }) {
  const issued = new Date();
  const expires = new Date(issued.getTime() + days * 24 * 60 * 60 * 1000);
  const payload = {
    v: 1,
    forge_id,
    tool_id,
    tool_prime,
    tier: 'trial',
    features: ['core', 'mesh_inbound'],
    issued: issued.toISOString(),
    expires: expires.toISOString(),
    issuer: 'konomi'
  };
  return envelope(payload);
}

// Mint a paid licence (admin only, used by /v1/konomi/licence + CLI)
function mint({ forge_id, tool_id, tool_prime, tier, days, features, bloom }) {
  const validTiers = ['trial', 'pro', 'business', 'enterprise'];
  if (!validTiers.includes(tier)) throw new Error('invalid tier');
  const issued = new Date();
  const expires = days
    ? new Date(issued.getTime() + days * 24 * 60 * 60 * 1000)
    : null;
  const defaultFeatures = {
    trial:      ['core', 'mesh_inbound'],
    pro:        ['core', 'mesh_inbound', 'unlimited_records', 'all_agents', 'pdf_export'],
    business:   ['core', 'mesh_inbound', 'unlimited_records', 'all_agents', 'pdf_export', 'multi_user', 'priority_support'],
    enterprise: ['core', 'mesh_inbound', 'unlimited_records', 'all_agents', 'pdf_export', 'multi_user', 'priority_support', 'white_label', 'custom_branding', 'sso']
  };
  const payload = {
    v: 1,
    forge_id,
    tool_id,
    tool_prime,
    tier,
    features: features || defaultFeatures[tier],
    issued: issued.toISOString(),
    expires: expires ? expires.toISOString() : null,
    bloom: bloom || null,
    issuer: 'konomi'
  };
  return envelope(payload);
}

module.exports = {
  pubkey,
  sign,
  envelope,
  verify,
  mintTrial,
  mint,
  canonicalJSON,
  KONOMI_PUBKEY_B64
};
