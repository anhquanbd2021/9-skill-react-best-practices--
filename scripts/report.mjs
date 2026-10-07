// report.mjs — scan every fixture with each skill variant and print the
// side-by-side: findings caught, rules active, render counts. Exits 1 if
// any expectation drifts (the checklist contract regressed).
import { loadSkills, loadFixtures, EXAMPLES_DIR } from '../app/load-fixtures.mjs';
import { scan } from '../public/inspector.mjs';
import { simulate, delta } from '../public/simulator.mjs';

const skills = loadSkills(EXAMPLES_DIR);
const fixtures = loadFixtures(EXAMPLES_DIR);
const VARIANTS = [{ name: '∅ no skill', skill: null }, ...skills.map((s) => ({ name: s.name, skill: s }))];

// Expected findings per (fixture, skill). The checklist contract: the
// domain skill catches what a generic pass misses entirely.
const EXPECTED = {
  'checkout': { 'react-best-practices': 6, 'react-101': 0, none: 0 },
  'checkout-fixed': { 'react-best-practices': 0, 'react-101': 0, none: 0 },
  'clean-but-broken': { 'react-best-practices': 0, 'react-101': 0, none: 0 },
};

let failures = 0;

console.log('Render Inspector — findings report');
console.log(`Skills on the shelf: ${VARIANTS.map((v) => v.name).join(', ')}`);
console.log(`Fixtures: ${fixtures.map((f) => f.app).join(', ')}\n`);

for (const fx of fixtures) {
  console.log(`== ${fx.app} (${fx.label}) ==`);
  for (const v of VARIANTS) {
    const { findings, active, unknown } = scan(fx, v.skill);
    const key = v.skill ? v.name : 'none';
    const expected = EXPECTED[fx.app]?.[key];
    const ok = expected === undefined ? true : findings.length === expected;
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'ok ' : 'DRIFT'} ${v.name.padEnd(24)} rules [${active.join(', ') || '—'}]${unknown.length ? ` unknown:${unknown.join(',')}` : ''} → ${findings.length} finding(s)`);
    for (const f of findings) {
      console.log(`        ${f.rule.padEnd(17)} @ ${f.at} — ${f.detail}`);
    }
  }
  if (fx.designNote) console.log(`        ⚠ designNote (unflagged): ${fx.designNote}`);
  const sim = simulate(fx);
  console.log(`  renders: ${sim.total} over ${fx.ticks} ticks`);
  console.log('');
}

const vuln = fixtures.find((f) => f.app === 'checkout');
const fixed = fixtures.find((f) => f.app === 'checkout-fixed');
if (vuln && fixed) {
  const d = delta(simulate(vuln), simulate(fixed));
  console.log(`Render delta ${vuln.app} → ${fixed.app}: ${d.before} → ${d.after} (−${d.pct}%)`);
  if (d.pct < 60) { failures += 1; console.log('  DRIFT: render reduction fell below 60%'); }
}

console.log(`\n${failures === 0 ? 'All expectations hold.' : `${failures} expectation(s) drifted.`}`);
process.exit(failures === 0 ? 0 : 1);
