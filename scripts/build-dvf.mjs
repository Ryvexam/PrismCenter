// Pré-agrégation DVF (Demandes de Valeurs Foncières) → prix médian €/m² par département.
// Source : files.data.gouv.fr/geo-dvf (open data, Etalab/Cerema).
// Les prix fonciers évoluent lentement → on les fige dans un JSON bundlé,
// au lieu d'appels live (l'API communautaire est morte, les fichiers bruts sont lourds).
//
// Usage : node scripts/build-dvf.mjs [annee]   (défaut 2024)
// Sortie : src/data/landPrices.json  { "33": { price: 3403, n: 22576 }, ... , _meta }

import { gunzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const YEAR = process.argv[2] ?? '2024';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/landPrices.json');
const BASE = `https://files.data.gouv.fr/geo-dvf/latest/csv/${YEAR}/departements`;

// 96 départements métropolitains (20 → 2A / 2B).
const DEPARTMENTS = [];
for (let i = 1; i <= 95; i += 1) {
  if (i === 20) continue;
  DEPARTMENTS.push(String(i).padStart(2, '0'));
}
DEPARTMENTS.push('2A', '2B');
DEPARTMENTS.sort();

function median(values) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

async function processDepartment(code) {
  const res = await fetch(`${BASE}/${code}.csv.gz`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const idx = {
    vf: header.indexOf('valeur_fonciere'),
    sb: header.indexOf('surface_reelle_bati'),
    tl: header.indexOf('type_local'),
    nm: header.indexOf('nature_mutation'),
  };
  const ratios = [];
  for (let i = 1; i < lines.length; i += 1) {
    const c = lines[i].split(',');
    if (c.length < header.length) continue;
    if (c[idx.nm] !== 'Vente') continue;
    const tl = c[idx.tl];
    if (tl !== 'Maison' && tl !== 'Appartement') continue;
    const vf = Number(c[idx.vf]);
    const sb = Number(c[idx.sb]);
    if (!(sb > 9) || !(vf > 0)) continue;
    const r = vf / sb;
    if (r > 200 && r < 20000) ratios.push(r);
  }
  return { price: Math.round(median(ratios)), n: ratios.length };
}

async function run() {
  const out = {};
  for (const code of DEPARTMENTS) {
    try {
      const { price, n } = await processDepartment(code);
      out[code] = { price, n };
      process.stdout.write(`  ${code}: ${price} €/m² (n=${n})\n`);
    } catch (error) {
      out[code] = { price: null, n: 0, error: String(error.message ?? error) };
      process.stdout.write(`  ${code}: ÉCHEC (${error.message})\n`);
    }
  }
  const known = Object.values(out).filter((d) => d.price);
  out._meta = {
    source: 'DVF geo-dvf (data.gouv.fr / Etalab-Cerema)',
    metric: 'médiane €/m² bâti, ventes Maison+Appartement',
    year: YEAR,
    generatedAt: new Date().toISOString(),
    nationalMedian: median(known.map((d) => d.price)),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  // Module JS jumeau (import direct sans attribut, compatible Node + Vite).
  const JS = resolve(HERE, '../src/data/landPrices.js');
  writeFileSync(
    JS,
    `// Généré par scripts/build-dvf.mjs — prix médian €/m² par département (DVF).\nexport default ${JSON.stringify(out, null, 2)};\n`,
  );
  process.stdout.write(`\n✓ ${known.length}/${DEPARTMENTS.length} départements → ${OUT}\n`);
}

run();
