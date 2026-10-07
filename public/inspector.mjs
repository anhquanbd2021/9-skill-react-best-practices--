// inspector.mjs — the "senior review pass": walk a component tree and run
// the rules the loaded skill actually carries. No skill (or a prose-only
// skill) means no rules — the generic review finds nothing, which is the
// failure the lab exists to show.
import { RULES, parseChecklist } from './rules.mjs';

// activeRules: the skill's checklist, reduced to rule ids present in the
// registry. Unknown ids in a checklist are ignored here and reported
// separately — a checklist line with no detector is a broken contract.
export function activeRules(skill) {
  if (!skill) return { active: [], unknown: [] };
  const ids = [];
  for (const line of String(skill.body || '').split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*`([a-z0-9-]+)`/);
    if (m) ids.push(m[1]);
  }
  const active = ids.filter((id) => RULES[id]);
  const unknown = ids.filter((id) => !RULES[id]);
  return { active, unknown };
}

// scan(tree, skill) → { findings, active, unknown, rulesRun }
export function scan(tree, skill) {
  const { active, unknown } = activeRules(skill);
  const findings = [];
  for (const [name, def] of Object.entries(tree.components)) {
    for (const id of active) {
      findings.push(...RULES[id].check(name, def, tree.components));
    }
  }
  return { findings, active, unknown, rulesRun: active.length };
}

// Convenience: what fraction of the registry the skill covers.
export function coverage(skill) {
  const { active } = activeRules(skill);
  return { covered: active.length, total: Object.keys(RULES).length };
}

// Re-export for the UI/tests so the checklist format lives in one file.
export { parseChecklist };
