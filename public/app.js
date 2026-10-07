import { scan, coverage } from './inspector.mjs';
import { simulate, delta } from './simulator.mjs';
import { RULES } from './rules.mjs';

const $ = (sel) => document.querySelector(sel);

const [skills, fixtures] = await Promise.all([
  fetch('/api/skills').then((r) => r.json()),
  fetch('/api/fixtures').then((r) => r.json()),
]);

// "no skill" is a first-class choice — the generic reviewer.
const SKILL_CHOICES = [null, ...skills];
let selectedSkill = skills.find((s) => s.name === 'react-best-practices') || null;
let selectedFixture = fixtures.find((f) => f.app === 'checkout') || fixtures[0];

function skillLabel(skill) {
  if (!skill) return 'no skill — generic reviewer';
  return `${skill.name}`;
}

function renderSkills() {
  const host = $('#skill-list');
  host.replaceChildren();
  for (const skill of SKILL_CHOICES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', skill === selectedSkill);
    if (!skill) {
      card.innerHTML = `<strong>∅ no skill <span class="archetype over-broad">baseline</span></strong><span class="desc">the agent reviews from scratch — no checklist loaded</span>`;
    } else {
      const cov = coverage(skill);
      card.innerHTML = `<strong>${skill.name} <span class="archetype ${skill.archetype === 'domain-checklist' ? 'one-job' : 'over-specific'}">${skill.archetype}</span></strong><span class="desc">"${skill.description}"</span><br><span>${cov.covered}/${cov.total} rules active · ${skill.file}</span>`;
    }
    card.addEventListener('click', () => {
      selectedSkill = skill;
      host.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-checked', 'false'));
      card.setAttribute('aria-checked', 'true');
      renderScan();
    });
    host.append(card);
  }
}

function renderFixtures() {
  const host = $('#fixture-list');
  host.replaceChildren();
  for (const fx of fixtures) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', fx === selectedFixture);
    card.innerHTML = `<strong>${fx.app} <span class="archetype">${fx.label}</span></strong><span class="desc">${Object.keys(fx.components).length} components · ${fx.ticks} ticks · list ×${fx.listSize}</span>`;
    card.addEventListener('click', () => {
      selectedFixture = fx;
      host.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-checked', 'false'));
      card.setAttribute('aria-checked', 'true');
      renderScan();
      renderSim();
    });
    host.append(card);
  }
}

function renderScan() {
  const result = scan(selectedFixture, selectedSkill);
  const badge = $('#verdict');
  if (!selectedSkill || result.active.length === 0) {
    badge.className = 'badge warn';
    badge.textContent = 'NO CHECKLIST — 0 findings';
  } else if (result.findings.length === 0) {
    badge.className = 'badge pass';
    badge.textContent = `CLEAN — ${result.active.length} rules ran`;
  } else {
    badge.className = 'badge fail';
    badge.textContent = `${result.findings.length} findings · ${result.active.length} rules ran`;
  }

  $('#stats').textContent = selectedSkill
    ? `${skillLabel(selectedSkill)}: checklist activates [${result.active.join(', ') || 'nothing'}]${result.unknown.length ? ` · unknown ids: ${result.unknown.join(', ')}` : ''}`
    : 'No skill loaded — the reviewer has no checklist, so nothing is checked.';

  const host = $('#findings');
  host.replaceChildren();
  if (result.findings.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = selectedSkill && result.active.length === 0
      ? 'This skill is prose — no `- `rule-id`` checklist lines — so zero detectors ran. Same result as no skill.'
      : 'Nothing flagged.';
    host.append(p);
  }
  for (const f of result.findings) {
    const row = document.createElement('div');
    row.className = 'score-row finding-row';
    row.innerHTML = `<span class="chip hit">${f.rule}</span><span class="name" title="${f.at}">${f.at}</span>`;
    host.append(row);
    const detail = document.createElement('p');
    detail.className = 'muted finding-detail';
    detail.textContent = f.detail;
    host.append(detail);
  }

  const note = $('#design-note');
  if (selectedFixture.designNote) {
    note.textContent = `⚠ design flaw the checklist can't own: ${selectedFixture.designNote}`;
    note.hidden = false;
  } else {
    note.hidden = true;
  }
}

function renderSim() {
  const fx = selectedFixture;
  const fixed = fixtures.find((f) => f.app === `${fx.app}-fixed`);
  const sim = simulate(fx);
  $('#sim-ticks').textContent = fx.ticks;
  $('#sim-reorder').textContent = fx.reorderEvery;

  const bars = $('#sim-bars');
  bars.replaceChildren();
  const entries = [[fx.app, sim]];
  if (fixed) entries.push([fixed.app, simulate(fixed)]);
  const max = Math.max(...entries.map(([, s]) => s.total), 1);
  for (const [name, s] of entries) {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `<span class="name">${name}</span>
      <span class="score-track"><span class="score-fill hit top" style="width:${Math.round((s.total / max) * 100)}%"></span></span>
      <span class="score-num">${s.total}</span>`;
    bars.append(row);
  }
  if (fixed) {
    const d = delta(sim, simulate(fixed));
    const p = document.createElement('p');
    p.className = 'stats';
    p.innerHTML = `<strong>${d.before} → ${d.after} renders (−${d.pct}%)</strong> — the checklist didn't promise a number; it found the patterns that produced one.`;
    bars.append(p);
  }

  const table = $('#timeline');
  table.replaceChildren();
  const head = document.createElement('thead');
  head.innerHTML = '<tr><th>tick</th><th>event</th><th>renders</th><th>per component</th></tr>';
  const body = document.createElement('tbody');
  // Re-run per tick to attribute component counts per row.
  for (const t of sim.timeline) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.tick}</td><td>${t.reorder ? 'reorder' : 'state tick'}</td><td>${t.renders}</td><td class="muted">${Object.entries(sim.perComponent).map(([n, c]) => `${n} ${c}`).join(' · ') || '—'}</td>`;
    body.append(tr);
  }
  table.append(head, body);
}

renderSkills();
renderFixtures();
renderScan();
renderSim();
