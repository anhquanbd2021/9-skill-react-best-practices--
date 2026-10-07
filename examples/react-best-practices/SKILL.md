---
name: react-best-practices
description: Use when the user asks to write or review React components — flags the render anti-patterns a senior reviewer checks first.
archetype: domain-checklist
---

# React Best Practices

Review every component diff against the render checklist below. Each item
is a rule id the inspector can execute — a checklist line that cannot be
checked is a paragraph, not a rule.

## Render checklist

- `unstable-key` — list items keyed by `index` (or not keyed at all) force React to re-render or remount every row on any reorder. Key by a stable id.
- `unstable-prop` — an object, array, or function literal passed to a memoized child is a new reference every render, so `memo` never skips. Hoist it or wrap it in `useMemo`/`useCallback`.
- `effect-deps` — an effect that reads a value missing from its dependency array runs on a stale closure. List everything the effect uses.
- `derived-state` — a value stored in `useState` that could be computed during render adds a second render pass and a sync bug. Compute it; store the source.
- `unstable-context` — a provider whose `value` is an inline object re-renders every consumer on every parent render. Memoize the value.
