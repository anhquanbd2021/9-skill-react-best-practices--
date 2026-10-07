// load-fixtures.mjs — read the skill shelf and component trees from disk.
// The examples/*/SKILL.md files are the single source of truth for what a
// skill carries: the server, CLI, and tests all parse the same files,
// because the checklist on disk IS the review contract.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXAMPLES_DIR = fileURLToPath(new URL('../examples', import.meta.url));

// Minimal frontmatter parser: flat `key: value` pairs between --- fences.
// Descriptions may be wrapped in single or double quotes.
export function parseSkillFile(text, source = 'SKILL.md') {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${source}: missing frontmatter block`);
  const [, frontmatter, body] = match;
  const fields = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const kv = line.match(/^([a-z-]+):\s*(.+)$/);
    if (kv) fields[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  if (!fields.name) throw new Error(`${source}: frontmatter needs a name`);
  if (!fields.description) throw new Error(`${source}: frontmatter needs a description`);
  return {
    name: fields.name,
    description: fields.description,
    archetype: fields.archetype || 'unclassified',
    body: body.trim(),
  };
}

// A skill lives in examples/<name>/SKILL.md; a fixture tree lives in
// examples/<name>/tree.json. Same directory convention, one loader each.
export function loadSkills(dir = EXAMPLES_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name, 'SKILL.md'))
    .filter((file) => {
      try { readFileSync(file); return true; } catch { return false; }
    })
    .map((file) => {
      const dirName = file.split(/[\\/]/).slice(-2, -1)[0];
      return { ...parseSkillFile(readFileSync(file, 'utf8'), file), file: `${dirName}/SKILL.md` };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function loadFixtures(dir = EXAMPLES_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ entry, file: join(dir, entry.name, 'tree.json') }))
    .map(({ entry, file }) => {
      try {
        const tree = JSON.parse(readFileSync(file, 'utf8'));
        return { ...tree, dir: entry.name, file: `${entry.name}/tree.json` };
      } catch {
        return null; // skill dirs have no tree.json
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.app.localeCompare(b.app));
}
