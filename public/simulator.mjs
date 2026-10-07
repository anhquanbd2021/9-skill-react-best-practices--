// simulator.mjs — a toy render counter. NOT a React runtime: it encodes
// the propagation rules the checklist is about, so the cost of each
// anti-pattern is a number you can watch drop.
//
// Model (documented in guide.html):
//   - Each tick, the root's `tick` state changes → root renders.
//   - Every `reorderEvery`-th tick is a "reorder" event: the list order
//     changes and every prop with ref in `reorderAffects` gets a new
//     reference.
//   - When a component renders, each child renders iff:
//       · the child is not memoized, OR
//       · any prop is an inline-* literal (new reference → memo can't skip), OR
//       · it's a reorder tick and the prop's ref changed, OR
//       · the child consumes a context whose provider rendered with an
//         inline (unmemoized) value this pass.
//   - List rows: same rule per row via rowProps; on a reorder tick an
//     `index`-keyed list re-renders ALL rows while an `id`-keyed list
//     re-renders only the moved row (modeled as 1).
//   - Each `derivedState` entry adds +1 render to its own component
//     whenever it renders (render → effect → setState → render again).
import { INLINE_KINDS, propKind, descendants } from './rules.mjs';

export function simulate(tree) {
  const { components, root, ticks, reorderEvery, reorderAffects = [], listSize } = tree;
  const perComponent = Object.fromEntries(Object.keys(components).map((n) => [n, 0]));
  const timeline = [];

  const propChanged = (spec, reorder) => {
    const kind = propKind(spec);
    if (INLINE_KINDS.has(kind)) return true;
    return reorder && typeof spec === 'object' && spec.ref && reorderAffects.includes(spec.ref);
  };

  const renderNode = (name, ctx, tick) => {
    const def = components[name];
    if (!def) return;
    perComponent[name] += 1;
    tick.renders += 1;
    // Derived state costs a second pass per entry.
    const extra = (def.derivedState || []).length;
    perComponent[name] += extra;
    tick.renders += extra;
    // An inline provider value dirties its context for every consumer below.
    for (const p of def.provides || []) {
      if (p.value !== 'memoized' && p.value !== 'stable') ctx.dirty.add(p.context);
    }
    // Child edges.
    for (const edge of def.children || []) {
      const child = components[edge.component];
      if (!child) continue;
      const forcedByContext = (child.consumes || []).some((c) => ctx.dirty.has(c));
      const propsChanged = Object.values(edge.props || {})
        .some((spec) => propChanged(spec, ctx.reorder));
      if (forcedByContext || !child.memo || propsChanged) {
        renderNode(edge.component, ctx, tick);
      }
    }
    // List rows.
    if (def.list) {
      const row = components[def.list.row];
      if (row) {
        const rowForced = (row.consumes || []).some((c) => ctx.dirty.has(c));
        const rowPropsChanged = Object.values(def.list.rowProps || {})
          .some((spec) => propChanged(spec, ctx.reorder));
        if (ctx.reorder && def.list.key === 'index') {
          // Index keys: every row's props look changed after a reorder.
          for (let i = 0; i < listSize; i += 1) { perComponent[def.list.row] += 1; tick.renders += 1; }
        } else if (ctx.reorder && def.list.key === 'id') {
          // Stable keys: only the moved row re-renders (props shallow-equal
          // for the rest) — unless context forces all of them anyway.
          const count = rowForced ? listSize : 1;
          perComponent[def.list.row] += count;
          tick.renders += count;
        } else if (rowForced) {
          for (let i = 0; i < listSize; i += 1) { perComponent[def.list.row] += 1; tick.renders += 1; }
        } else if (!row.memo || rowPropsChanged) {
          for (let i = 0; i < listSize; i += 1) { perComponent[def.list.row] += 1; tick.renders += 1; }
        }
      }
    }
  };

  for (let t = 1; t <= ticks; t += 1) {
    const tick = { tick: t, reorder: t % reorderEvery === 0, renders: 0 };
    renderNode(root, { reorder: tick.reorder, dirty: new Set() }, tick);
    timeline.push(tick);
  }

  const total = timeline.reduce((sum, t) => sum + t.renders, 0);
  return { total, perComponent, timeline };
}

// delta(vulnerable, fixed) → render reduction summary.
export function delta(a, b) {
  const drop = a.total - b.total;
  const pct = a.total === 0 ? 0 : Math.round((drop / a.total) * 100);
  return { before: a.total, after: b.total, drop, pct };
}
