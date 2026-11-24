// Ember Keys — Isle of Smoke: make.fun hand-in program.
// Node 22 standard library only. Copies the game/ and screenshots/ trees
// that sit beside this file into the output directory, then writes the
// entry dossier with the vendored kit library. The output directory is a
// grader mount: it is never removed, only written into.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });

for (const tree of ['game', 'screenshots']) {
  const from = join(here, tree);
  if (!existsSync(from)) throw new Error(`missing ${tree}/ beside main.ts`);
  cpSync(from, join(outDir, tree), { recursive: true });
}

// Manifest log: count and weigh what was copied so a hand-in run is
// auditable from its console output alone.
function manifest(dir, prefix = '') {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      const sub = manifest(full, prefix + name + '/');
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += st.size;
      console.log(`  ${prefix}${name} — ${st.size} bytes`);
    }
  }
  return { files, bytes };
}
console.log('Ember Keys hand-in manifest:');
const totals = manifest(outDir);
console.log(`manifest total: ${totals.files} files, ${totals.bytes} bytes`);

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Ember Keys hand-in written to', outDir);
