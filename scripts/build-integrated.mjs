import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const readmePath = 'README.md';
const readme = readFileSync(readmePath, 'utf8');
writeFileSync(readmePath, readme.replace("capacités d'accueil réseau", 'capacités d’accueil réseau'));

await import('./apply-hyperscale-ui.mjs');

const compactScript = gunzipSync(readFileSync('scripts/compact-dossier.mjs.gz'));
writeFileSync('scripts/compact-dossier.generated.mjs', compactScript);
await import('./compact-dossier.generated.mjs');

const result = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
