// rules.mjs — the rule registry: every detector a domain skill can carry.
// A rule id is only "in the skill" if the SKILL.md checklist names it —
// parseChecklist() pulls `- `rule-id`` items out of a skill body, and the
// inspector only runs the ids the skill actually lists. A skill with prose
// but no checklist activates zero rules — which is the point of the lab.

export const INLINE_KINDS = new Set(['inline-object', 'inline-array', 'inline-fn']);

// propSpec may be a string shorthand ("inline-fn", "stable") or an object
// { kind, ref? } — normalize to a kind string.
export function propKind(spec) {
  return typeof spec === 'string' ? spec : spec.kind;
}

// All descendant component names under a component (children edges +
// list rows), for context-consumer lookups.
export function descendants(components, name) {
  const found = new Set();
  const walk = (nodeName) => {
    const def = components[nodeName];
    if (!def) return;
    for (const edge of def.children || []) {
      if (!found.has(edge.component)) {
        found.add(edge.component);
        walk(edge.component);
      }
    }
    if (def.list?.row && !found.has(def.list.row)) {
      found.add(def.list.row);
      walk(def.list.row);
    }
  };
  walk(name);
  return found;
}

export const RULES = {
  'unstable-key': {
    name: 'Stable keys',
    blurb: 'list keyed by index (or missing key) re-renders/remounts every row on reorder',
    check(name, def) {
      if (!def.list) return [];
      if (def.list.key === 'id') return [];
      const key = def.list.key ?? 'missing';
      return [{
        rule: 'unstable-key',
        at: name,
        detail: `list "${def.list.items}" keyed by ${key} — reorder re-renders all rows; use a stable id`,
      }];
    },
  },

  'unstable-prop': {
    name: 'Stable props over memo',
    blurb: 'inline object/array/fn prop is a new reference every render — memo never skips',
    // Needs the child definition (memo flag), so it inspects edges.
    check(name, def, components) {
      const findings = [];
      const visit = (parentName, edge) => {
        const child = components[edge.component];
        if (!child) return;
        const inline = Object.entries(edge.props || {})
          .filter(([, spec]) => INLINE_KINDS.has(propKind(spec)))
          .map(([prop]) => prop);
        if (child.memo && inline.length) {
          findings.push({
            rule: 'unstable-prop',
            at: edge.component,
            detail: `${parentName} passes ${inline.join(', ')} inline — new reference every render; memo on ${edge.component} never skips`,
          });
        }
      };
      for (const edge of def.children || []) visit(name, edge);
      if (def.list?.row) {
        visit(name, { component: def.list.row, props: def.list.rowProps || {} });
      }
      return findings;
    },
  },

  'effect-deps': {
    name: 'Honest effect deps',
    blurb: 'effect reads a value missing from its dep array — stale closure',
    check(name, def) {
      const findings = [];
      for (const fx of def.effects || []) {
        const missing = (fx.uses || []).filter((u) => !fx.deps.includes(u));
        if (missing.length) {
          findings.push({
            rule: 'effect-deps',
            at: name,
            detail: `effect "${fx.id}" uses ${missing.join(', ')} but deps are [${fx.deps.join(', ')}] — stale closure`,
          });
        }
      }
      return findings;
    },
  },

  'derived-state': {
    name: 'Derive, don\'t store',
    blurb: 'state that could be computed in render adds a second pass and a sync bug',
    check(name, def) {
      return (def.derivedState || []).map((d) => ({
        rule: 'derived-state',
        at: name,
        detail: `state "${d.name}" is computed from "${d.from}" — derive it in render, store the source`,
      }));
    },
  },

  'unstable-context': {
    name: 'Stable context value',
    blurb: 'provider value as an inline object re-renders every consumer every render',
    check(name, def, components) {
      const findings = [];
      for (const p of def.provides || []) {
        if (p.value === 'memoized' || p.value === 'stable') continue;
        const consumers = [...descendants(components, name)]
          .filter((d) => (components[d].consumes || []).includes(p.context));
        findings.push({
          rule: 'unstable-context',
          at: name,
          detail: `${p.context} value is an ${p.value} recreated each render — ${consumers.length} consumer(s) re-render every time: ${consumers.join(', ') || 'none'}`,
        });
      }
      return findings;
    },
  },
};

// Extract the rule ids a skill actually carries: checklist lines of the
// form `- `rule-id`` inside its body. Prose without backticked ids
// activates nothing — on purpose.
export function parseChecklist(body) {
  const ids = [];
  for (const line of String(body).split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*`([a-z0-9-]+)`/);
    if (m && RULES[m[1]]) ids.push(m[1]);
  }
  return ids;
}
