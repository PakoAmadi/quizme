import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Guards the Dependency Rule: source code dependencies point only inwards.
 *
 *   domain  <-  application  <-  interfaces/http
 *                    ^
 *              infrastructure
 *
 * Only the composition root (container.ts, server.ts) may depend on everything.
 */
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

type Layer = 'domain' | 'application' | 'infrastructure' | 'interfaces' | 'root';

const layerOf = (file: string): Layer => {
  const top = path.relative(SRC, file).split(path.sep)[0];
  return top === 'domain' || top === 'application' || top === 'infrastructure' || top === 'interfaces' ? top : 'root';
};

const ALLOWED_LAYERS: Record<Layer, Layer[]> = {
  domain: ['domain'],
  application: ['domain', 'application'],
  infrastructure: ['domain', 'application', 'infrastructure'],
  interfaces: ['domain', 'application', 'interfaces'],
  root: ['domain', 'application', 'infrastructure', 'interfaces', 'root'],
};

// External modules per layer. @app/shared holds only schemas, types and constants.
const ALLOWED_PACKAGES: Record<Layer, string[]> = {
  domain: [],
  application: ['@app/shared'],
  infrastructure: ['@app/shared', 'pg', 'node:crypto', 'node:fs/promises', 'node:path'],
  interfaces: ['@app/shared', 'zod', 'node:http', 'node:crypto'],
  root: ['node:http'],
};

const listTs = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return listTs(full);
    return d.name.endsWith('.ts') ? [full] : [];
  });

// Covers `import x from '...'`, `import type {...} from '...'`, `export ... from '...'`, `import '...'`
const IMPORT_RE = /^\s*(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm;

const importsOf = (file: string) =>
  [...fs.readFileSync(file, 'utf8').matchAll(IMPORT_RE)].map((m) => (m[1] ?? m[2])!);

test('Architecture: Dependency Rule', async (t) => {
  const files = listTs(SRC);
  assert.ok(files.length > 10, 'source files should be found');

  for (const file of files) {
    const layer = layerOf(file);
    for (const spec of importsOf(file)) {
      const rel = path.relative(SRC, file);
      if (spec.startsWith('.')) {
        const target = layerOf(path.resolve(path.dirname(file), spec));
        await t.test(`${rel} -> ${spec}`, () => {
          assert.ok(ALLOWED_LAYERS[layer].includes(target), `${layer} must not depend on ${target}`);
        });
      } else {
        await t.test(`${rel} -> package ${spec}`, () => {
          assert.ok(ALLOWED_PACKAGES[layer].includes(spec), `${layer} must not import "${spec}"`);
        });
      }
    }
  }
});

test('Architecture: only config.ts reads process.env', () => {
  const offenders = listTs(SRC).filter(
    (f) => /process\.env/.test(fs.readFileSync(f, 'utf8')) && !f.endsWith(path.join('config', 'config.ts')),
  );
  assert.deepEqual(offenders.map((f) => path.relative(SRC, f)), []);
});
