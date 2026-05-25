// One-time: generate Konomi master Ed25519 keypair.
// Run: node scripts/generate-keys.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', '.konomi');
fs.mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

const pubPem = publicKey.export({ format: 'pem', type: 'spki' });
const privPem = privateKey.export({ format: 'pem', type: 'pkcs8' });

// Extract the raw 32-byte key material for compact base64 distribution
const pubRaw = publicKey.export({ format: 'der', type: 'spki' }).slice(-32).toString('base64');
const privRaw = privateKey.export({ format: 'der', type: 'pkcs8' }).slice(-32).toString('base64');

fs.writeFileSync(path.join(outDir, 'konomi-priv.pem'), privPem);
fs.writeFileSync(path.join(outDir, 'konomi-pub.pem'), pubPem);
fs.writeFileSync(path.join(outDir, 'konomi-pub.b64'), pubRaw);

console.log('◊·κ KONOMI MASTER KEYPAIR GENERATED');
console.log('═'.repeat(60));
console.log('PUBLIC  (32-byte raw, base64):');
console.log('  ' + pubRaw);
console.log('PRIVATE (32-byte raw, base64) — SET AS ENV VAR ON RENDER:');
console.log('  KONOMI_PRIVATE_KEY=' + privRaw);
console.log('═'.repeat(60));
console.log('PEM files saved to .konomi/ (NOT committed — see .gitignore)');
console.log('');
console.log('Next steps:');
console.log('  1. Copy the PUBLIC key into templates/konomi-pubkey.txt');
console.log('  2. Set KONOMI_PRIVATE_KEY env var on Render');
console.log('  3. Keep .konomi/ folder backed up offline');
