import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSkills, loadFixtures, EXAMPLES_DIR, parseSkillFile } from '../app/load-fixtures.mjs';
import { scan, activeRules, coverage } from '../public/inspector.mjs';
import { RULES } from '../public/rules.mjs';

const skills = loadSkills(EXAMPLES_DIR);
const fixtures = loadFixtures(EXAMPLES_DIR);
const full = skills.find((s) => s.name === 'react-best-practices');
const prose = skills.find((s) => s.name === 'react-101');
const checkout = fixtures.find((f) => f.app === 'checkout');
const fixed = fixtures.find((f) => f.app === 'checkout-fixed');
const clean = fixtures.find((f) => f.app === 'clean-but-broken');

test('the shelf holds the two skill archetypes', () => {
  assert.deepEqual(skills.map((s) => s.archetype).sort(), ['domain-checklist', 'prose-only']);
});

test('every example SKILL.md parses name + description + archetype', () => {
  for (const skill of skills) {
    assert.ok(skill.name.length > 0, skill.file);
    assert.ok(skill.description.length > 0, skill.file);
    assert.ok(skill.body.length > 0, skill.file);
  }
});

test('parseSkillFile rejects a file with no description', () => {
  assert.throws(() => parseSkillFile('---\nname: x\n---\nbody'), /description/);
});

test('the domain skill activates all five rule ids; the prose skill activates none', () => {
  assert.equal(activeRules(full).active.length, Object.keys(RULES).length);
  assert.equal(activeRules(prose).active.length, 0);
  assert.equal(activeRules(null).active.length, 0);
  assert.deepEqual(coverage(full).covered, 5);
});

test('a checklist line naming an unknown rule id is reported, not run', () => {
  const { active, unknown } = activeRules({ body: '- `unstable-key`\n- `teleportation`' });
  assert.deepEqual(active, ['unstable-key']);
  assert.deepEqual(unknown, ['teleportation']);
});

test('checkout under the domain skill yields 6 findings across all 5 rule classes', () => {
  const { findings } = scan(checkout, full);
  assert.equal(findings.length, 6);
  const classes = new Set(findings.map((f) => f.rule));
  assert.deepEqual([...classes].sort(),
    ['derived-state', 'effect-deps', 'unstable-context', 'unstable-key', 'unstable-prop']);
});

test('checkout under no skill and under the prose skill: identical miss', () => {
  assert.equal(scan(checkout, null).findings.length, 0);
  assert.equal(scan(checkout, prose).findings.length, 0);
});

test('the fixed tree scans clean under the full skill', () => {
  assert.equal(scan(fixed, full).findings.length, 0);
});

test('clean-but-broken scans clean AND still carries the design flaw', () => {
  const { findings } = scan(clean, full);
  assert.equal(findings.length, 0);
  assert.match(clean.designNote, /sources? of truth/i);
});

test('every finding names a rule id that exists in the registry', () => {
  for (const fx of fixtures) {
    for (const f of scan(fx, full).findings) {
      assert.ok(RULES[f.rule], `${fx.app}: unknown rule ${f.rule}`);
      assert.ok(f.at && f.detail);
    }
  }
});
