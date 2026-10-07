# Render Inspector — companion demo

Interactive lab for the article *A React Skill Isn't a Prompt — It's a
Senior Reviewer You Can Run*. A React "best practices" skill is a
checklist you can run: scan seeded component trees with the skill loaded,
with a prose-only skill, and with no skill at all — then watch the render
simulator put a number on what the checklist caught.

Zero dependencies — Node 20+ only. The inspector, simulator, and rule
registry are plain ES modules shared by the browser UI, the CLI report,
and the test suite. Skills and trees are read from real
`examples/*/SKILL.md` + `examples/*/tree.json` files — the checklist on
disk IS the review contract.

## What it proves

| Claim | In the lab |
|---|---|
| **A domain skill is a runnable checklist** | `react-best-practices/SKILL.md` carries five `- \`rule-id\`` lines; each activates the same-named detector. `checkout` scans to **6 findings across all 5 rule classes**. |
| **Prose activates nothing** | `react-101` ("Helps with React.") parses fine, activates **zero** rules → identical scan to no skill: 0 findings. The miss is the demo. |
| **"80% fewer renders" is a diagnostic** | The simulator runs both trees 8 ticks: `checkout` = **68 renders**, `checkout-fixed` = **14** (−79%). The number is produced by what the checklist found, not promised by it. |
| **Reviewer-bot, not architect** | `clean-but-broken` scans **0 findings** under the full skill while carrying a duplicated-source-of-truth flaw (`designNote`). Clean scan, real bug. |

## Run it

```text
npm start        # serve the lab on :3000
npm test         # inspector + simulator + server
npm run report   # side-by-side findings/render table on examples/
npm run check    # both
```

## Layout

- `examples/*/SKILL.md` — the skill shelf: `react-best-practices`
  (domain-checklist, five rule ids) and `react-101` (prose-only).
  `examples/*/tree.json` — three component trees: `checkout` (seeded
  anti-patterns), `checkout-fixed` (checklist applied), `clean-but-broken`
  (clean scan, design flaw documented in `designNote`).
- `app/load-fixtures.mjs` — frontmatter/JSON loaders;
  `app/server.js` — static allowlist + `/health` + `/version` +
  `/api/skills` + `/api/fixtures`.
- `public/rules.mjs` — the rule registry (`unstable-key`,
  `unstable-prop`, `effect-deps`, `derived-state`, `unstable-context`) and
  the checklist parser; `public/inspector.mjs` — tree walker + scan;
  `public/simulator.mjs` — the render counter.
- `public/index.html` + `app.js` — skill picker, fixture picker, findings,
  per-tick render table, before/after bars. `public/guide.html` —
  mechanics + limits.
- `scripts/report.mjs` — CLI; exits 1 if any expectation drifts.

## Honest limits

- Component trees are **JSON descriptors**, not JSX — detection is by
  declared attributes (`"key": "index"`, `"options": "inline-object"`),
  not AST analysis. A real review skill reads code text with all its
  ambiguity; this lab models the *shape* of what it catches.
- The simulator encodes simplified propagation rules — no batching, no
  transitions, no concurrent React features. Counts are illustrative.
- The ~80% figure is **fixture-specific by design**: it shows the claim is
  measurable, not that every codebase contains it.
- `effect-deps` produces a finding but no render cost — stale closures
  cost correctness, which the counter deliberately doesn't conflate with
  renders.

This is an educational demo, not a React linter.
