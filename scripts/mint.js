#!/usr/bin/env node
// ◊·κ MINT — sign a Konomi licence offline
// Usage:
//   KONOMI_PRIVATE_KEY=... node scripts/mint.js \
//     --tool-id pathlabpro \
//     --tier pro \
//     --days 365 \
//     [--forge-id fg_xxx] \
//     [--tool-prime 139] \
//     [--bloom "buyer bloom hash"]
//
// Output: signed licence envelope, ready to paste into the tool's licence dialog.

const licence = require('../forge/licence.js');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
if (!args['tool-id']) {
  console.error('Usage: KONOMI_PRIVATE_KEY=... node scripts/mint.js --tool-id <id> --tier <trial|pro|business|enterprise> [--days N] [--forge-id X] [--tool-prime N] [--bloom B]');
  process.exit(1);
}

const tier = args.tier || 'pro';
const days = args.days ? parseInt(args.days, 10) : (tier === 'trial' ? 30 : 365);

try {
  const env = licence.mint({
    forge_id: args['forge-id'] || ('fg_' + Date.now().toString(36)),
    tool_id: args['tool-id'],
    tool_prime: args['tool-prime'] ? parseInt(args['tool-prime'], 10) : null,
    tier,
    days,
    bloom: args.bloom || null
  });
  const v = licence.verify(env);
  console.log('◊·κ LICENCE MINTED');
  console.log('═'.repeat(60));
  console.log('tier:    ' + v.payload.tier);
  console.log('tool_id: ' + v.payload.tool_id);
  console.log('issued:  ' + v.payload.issued);
  console.log('expires: ' + (v.payload.expires || 'never'));
  console.log('features:', v.payload.features.join(', '));
  console.log('═'.repeat(60));
  console.log('ENVELOPE (paste into tool licence dialog):');
  console.log('');
  console.log(env);
  console.log('');
} catch (e) {
  console.error('mint failed:', e.message);
  process.exit(1);
}
