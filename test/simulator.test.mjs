import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixtures, EXAMPLES_DIR } from '../app/load-fixtures.mjs';
import { simulate, delta } from '../public/simulator.mjs';

const fixtures = loadFixtures(EXAMPLES_DIR);
const checkout = fixtures.find((f) => f.app === 'checkout');
const fixed = fixtures.find((f) => f.app === 'checkout-fixed');
const clean = fixtures.find((f) => f.app === 'clean-but-broken');

test('checkout renders 68 times over 8 ticks — the seeded cost', () => {
  const sim = simulate(checkout);
  assert.equal(sim.total, 68);
  assert.equal(sim.timeline.length, 8);
  // Normal tick: root + Header + CartList + 5 context-forced rows = 8.
  assert.equal(sim.timeline[0].renders, 8);
  // Reorder tick adds SummaryPanel (cart ref changed) + derived-state pass = 10.
  assert.equal(sim.timeline[3].reorder, true);
  assert.equal(sim.timeline[3].renders, 10);
});

test('the fixed tree renders 14 times — memoization actually skipping', () => {
  const sim = simulate(fixed);
  assert.equal(sim.total, 14);
  assert.equal(sim.timeline[0].renders, 1); // root only; memo children skip
  assert.equal(sim.timeline[3].renders, 4); // root + list + 1 moved row + panel
});

test('the delta is the advertised ~80% — measured, not promised', () => {
  const d = delta(simulate(checkout), simulate(fixed));
  assert.equal(d.before, 68);
  assert.equal(d.after, 14);
  assert.ok(d.pct >= 75 && d.pct <= 85, `expected ~80%, got ${d.pct}%`);
});

test('unstable context is the dominant cost: rows render every tick', () => {
  const sim = simulate(checkout);
  assert.equal(sim.perComponent.CartRow, 40); // 5 rows × 8 ticks, memo defeated
  assert.equal(sim.perComponent.CheckoutPage, 8);
});

test('index keys turn a reorder into a full-list re-render; id keys do not', () => {
  const vuln = simulate(checkout);
  const good = simulate(fixed);
  // Per reorder tick the vulnerable tree spends renders on all 5 rows;
  // the fixed tree spends 1.
  assert.ok(vuln.timeline[3].renders - good.timeline[3].renders >= 4);
});

test('clean-but-broken renders fine — the sim confirms the flaw is not a render issue', () => {
  const sim = simulate(clean);
  assert.ok(sim.total <= 20, `expected a light tree, got ${sim.total}`);
});
