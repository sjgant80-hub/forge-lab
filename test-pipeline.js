// Acceptance test — biochemistry lab from the spec
// Bypasses Anthropic by stubbing the parser with the expected schema.
// Verifies STAGES 2-5 work end-to-end on the master template.

const { mapWorkflow } = require('./forge/map-workflow.js');
const { selectAgents } = require('./forge/select-agents.js');
const { build } = require('./forge/build.js');
const { verify } = require('./forge/verify.js');
const licence = require('./forge/licence.js');

const INPUT = {
  domain: 'biochemistry lab',
  expert_description: 'Clinical chemistry laboratory. Receive samples from referring clinics with patient IDs and test requests. Run assays on automated analysers. Apply quality control. Generate reports for clinicians. Archive everything for 7 years per HIPAA / ISO 15189. Pain points: results getting lost between intake and reporting. QC failures sometimes missed. Reports take too long to draft.',
  workflow_steps: [
    'receive sample from clinic with patient ID and test request',
    'log sample into tracking system with timestamp',
    'run assay protocol matching the test type',
    'record raw results from instrument',
    'apply quality control checks against reference ranges',
    'flag abnormal results for director review',
    'draft report for referring clinician',
    'archive results with 7-year retention'
  ],
  data_fields: { auto_detect: true },
  compliance: ['HIPAA', 'ISO 15189'],
  brand: { name: 'PathLab Pro', primary_color: '#1a3a5c' },
  ai_features: { auto_flag: true, report_draft: true, query: true }
};

// Stubbed parser output — what an LLM would return
const PARSED_STUB = {
  tool_name: 'PathLab Pro',
  tool_id: 'pathlabpro',
  tool_description: 'Sovereign biochemistry lab tool with QC, reporting, and 7-year archive.',
  domain: 'biochemistry lab',
  data_model: [
    { name: 'sample_id', label: 'Sample ID', type: 'string', required: true },
    { name: 'patient_id', label: 'Patient ID', type: 'string', required: true },
    { name: 'test_type', label: 'Test Type', type: 'dropdown', required: true, options: ['CBC', 'BMP', 'Lipid Panel', 'Liver Function', 'Thyroid'] },
    { name: 'result_value', label: 'Result Value', type: 'number', unit: 'mg/dL' },
    { name: 'ref_low', label: 'Reference Low', type: 'number' },
    { name: 'ref_high', label: 'Reference High', type: 'number' },
    { name: 'flag', label: 'Flag', type: 'enum', options: ['normal', 'low', 'high', 'critical'] },
    { name: 'notes', label: 'Notes', type: 'longtext' }
  ],
  agent_hints: {
    alpha: true,   // tracking
    beta: true,    // result entry
    gamma: true,   // QC
    delta: true,   // anomaly flagging
    epsilon: true, // reports
    theta: true    // critical alerts
  },
  ass_mapping: [
    { state: 'intake',    label: 'intake',          step_index: 0 },
    { state: 'configure', label: 'protocol',        step_index: 1 },
    { state: 'work',      label: 'assay',           step_index: 2 },
    { state: 'work',      label: 'record results',  step_index: 3 },
    { state: 'verify',    label: 'QC',              step_index: 4 },
    { state: 'review',    label: 'director review', step_index: 5 },
    { state: 'report',    label: 'report',          step_index: 6 },
    { state: 'archive',   label: 'archive',         step_index: 7 }
  ],
  views: ['sample_intake', 'active_work', 'review_queue', 'reporting', 'archive', 'analytics'],
  primary_pain_points: ['results getting lost', 'QC failures missed', 'reports too slow'],
  compliance_notes: ['HIPAA', 'ISO 15189'],
  brand: INPUT.brand
};

console.log('═'.repeat(60));
console.log('FORGE LAB · acceptance test · biochemistry lab');
console.log('═'.repeat(60));

console.log('\nSTAGE 2 · MAP WORKFLOW → ASS');
const assStages = mapWorkflow(PARSED_STUB, INPUT);
assStages.forEach(s => console.log('  ' + s.glyph + ' ' + s.state.padEnd(10) + ' · ' + s.label.padEnd(18) + ' · ' + s.steps.length + ' step(s)'));

console.log('\nSTAGE 3 · SELECT AGENTS');
const agents = selectAgents(PARSED_STUB, INPUT);
agents.list.forEach(a => console.log('  ' + a.glyph + ' ' + a.role.padEnd(13) + ' · ' + a.name));

console.log('\nSTAGE 4 · BUILD');
const built = build(PARSED_STUB, assStages, agents, INPUT);
// Mimic server's post-build trial-licence injection
let trialEnv = '';
if (process.env.KONOMI_PRIVATE_KEY) {
  trialEnv = licence.mintTrial({
    forge_id: built.meta.forge_id,
    tool_id: PARSED_STUB.tool_id,
    tool_prime: built.meta.prime,
    days: 30
  });
}
built.html = built.html.replace('__INJECT_TRIAL_LICENCE__', trialEnv);
built.meta.size_kb = Math.round(built.html.length / 1024);
console.log('  size:    ' + built.meta.size_kb + ' KB');
console.log('  prime:   ' + built.meta.prime);
console.log('  forge_id:' + built.meta.forge_id);
console.log('  domain:  ' + built.meta.domain);
console.log('  trial:   ' + (trialEnv ? 'signed (' + trialEnv.length + ' chars)' : 'unsigned (no key set)'));

console.log('\nSTAGE 5 · VERIFY');
const v = verify(built.html);
v.checks.forEach(c => console.log('  ' + (c.pass ? '✓' : '✗') + ' ' + c.label));
console.log('\n  ' + (v.ok ? '✓ ALL ' + v.total + ' CHECKS PASSED' : '✗ ' + (v.total - v.passed) + ' CHECKS FAILED'));

// Save the forged HTML for manual inspection
const fs = require('fs');
fs.writeFileSync('/tmp/pathlabpro.html', built.html);
console.log('\n  → forged HTML written to /tmp/pathlabpro.html (' + built.meta.size_kb + ' KB)');

process.exit(v.ok ? 0 : 1);
