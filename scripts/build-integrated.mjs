import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const readmePath = 'README.md';
const readme = readFileSync(readmePath, 'utf8');
writeFileSync(readmePath, readme.replace("capacités d'accueil réseau", 'capacités d’accueil réseau'));

await import('./apply-hyperscale-ui.mjs');

const mainPath = 'src/main.jsx';
const mainSource = readFileSync(mainPath, 'utf8');
writeFileSync(mainPath, mainSource.replace('Dossier candidat', 'Dossier d’implantation'));

const result = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
