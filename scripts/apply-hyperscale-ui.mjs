import { readFile, writeFile } from 'node:fs/promises';

async function replaceInFile(path, replacements) {
  let source = await readFile(path, 'utf8');

  for (const [from, to] of replacements) {
    if (!source.includes(from)) {
      throw new Error(`Expected source fragment not found in ${path}: ${from.slice(0, 120)}`);
    }
    source = source.replace(from, to);
  }

  await writeFile(path, source);
}

const profilePresets = `const PROFILE_PRESETS = [
  {
    id: 'colossus1',
    label: 'Colossus 1',
    footprint: '300 MW · 200k GPU',
    powerNeedMw: 300,
    scenarioId: 'colossus-1-300mw',
    description: 'Scénario par défaut: puissance, raccordement HTB, refroidissement et foncier de campus.',
    weights: { access: 0.03, cooling: 0.13, energy: 0.32, grid: 0.3, land: 0.12, risk: 0.1 },
  },
  {
    id: 'gigawatt',
    label: 'Campus 1 GW',
    footprint: '1 GW · jusqu’à 1M GPU',
    powerNeedMw: 1_000,
    scenarioId: 'colossus-2-1gw',
    description: 'Échelle réacteur: priorité absolue au 400 kV, à la production dédiée et au refroidissement.',
    weights: { access: 0.02, cooling: 0.14, energy: 0.34, grid: 0.34, land: 0.1, risk: 0.06 },
  },
  {
    id: 'extreme',
    label: 'Extension 2 GW',
    footprint: '2 GW · Blackwell',
    powerNeedMw: 2_000,
    scenarioId: 'colossus-2-2gw',
    description: 'Stress test extrême: plusieurs sources électriques, 400 kV et stratégie énergétique dédiée.',
    weights: { access: 0.01, cooling: 0.15, energy: 0.35, grid: 0.36, land: 0.09, risk: 0.04 },
  },
  {
    id: 'regional',
    label: 'Datacenter régional',
    footprint: '30 MW · référence',
    powerNeedMw: 30,
    scenarioId: 'baseline-30mw',
    description: 'Point de comparaison avec l’échelle initiale de PrismCenter.',
    weights: { access: 0.19, cooling: 0.1, energy: 0.24, grid: 0.18, land: 0.11, risk: 0.18 },
  },
];`;

const hyperscalePanel = `function HyperscaleScalePanel({ mode, selectedMetric, selectedProfile }) {
  const scenario = getColossusScenario(selectedProfile.scenarioId);
  const summary = buildColossusScenarioSummary([scenario])[0];
  const needMw = profileToPowerNeedMw(selectedProfile);
  const availableMw = selectedMetric?.gridAvailableMw ?? 0;
  const coverage = clamp((availableMw / Math.max(needMw, 1)) * 100, 0, 100);
  const maxVoltageKv = selectedMetric?.rteMaxVoltageKv ?? 0;
  const voltageLabel =
    maxVoltageKv >= 400
      ? '400 kV identifié'
      : maxVoltageKv >= 225
        ? '225 kV — renforcement probable'
        : 'Sous 225 kV — incompatible sans infrastructure majeure';

  return (
    <div className={cx('grid gap-4 border p-4', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Échelle hyperscale</p>
          <p className="mt-2 font-display text-4xl leading-none text-ink">{formatPowerScale(needMw)}</p>
        </div>
        <Zap aria-hidden="true" size={20} strokeWidth={1.25} />
      </div>
      <p className="text-sm leading-6 text-graphite">
        {scenario.description} Les coûts utilisent une hypothèse modifiable de 0,08 €/kWh et restent des ordres de grandeur.
      </p>
      <div className="grid gap-2 text-sm leading-6">
        <FactRow label="GPU" value={\`~\${formatNumber(summary.gpuCount)} · \${summary.architecture}\`} />
        <FactRow label="Puissance GPU seule" value={\`\${formatMw(summary.gpuPowerMw)} MW\`} />
        <FactRow label="Infra, refroidissement & pertes" value={\`\${formatMw(summary.infrastructurePowerMw)} MW\`} />
        <FactRow label="Énergie quotidienne" value={\`\${formatDecimal(summary.energy.dailyGwh)} GWh\`} />
        <FactRow label="Énergie annuelle" value={\`\${formatDecimal(summary.energy.yearlyTwh)} TWh\`} />
        <FactRow label="Électricité / jour" value={formatCompactCurrency(summary.cost.dailyEur)} />
        <FactRow label="Électricité / an" value={formatCompactCurrency(summary.cost.yearlyEur)} />
        <FactRow label="Couverture Caparéseau" value={\`\${Math.round(coverage)}% · \${formatMw(availableMw)} MW\`} />
        <FactRow label="Niveau de tension" value={voltageLabel} />
      </div>
      {needMw >= 300 && (
        <p className="border-t border-current/20 pt-3 text-xs leading-5 text-graphite">
          À cette échelle, un score départemental favorable ne suffit pas: poste 400/225 kV, renforcement RTE, production dédiée,
          stockage, redondance N+1 et stratégie eau/chaleur doivent être instruits comme un projet énergétique industriel.
        </p>
      )}
    </div>
  );
}

`;

await replaceInFile('src/main.jsx', [
  [
    "import { INDICE_PAGE_BY_ID, INDICE_PAGES } from './data/indices.js';\nimport {",
    "import { INDICE_PAGE_BY_ID, INDICE_PAGES } from './data/indices.js';\nimport { buildColossusScenarioSummary, getColossusScenario } from './data/colossusScenarios.js';\nimport {",
  ],
  [
    `const PROFILE_PRESETS = [
  {
    id: 'training',
    label: 'Cluster entraînement',
    footprint: '80-200 MW',
    description: 'Priorité à la puissance bas carbone et à la marge foncière.',
    weights: { access: 0.05, cooling: 0.1, energy: 0.31, grid: 0.22, land: 0.13, risk: 0.19 },
  },
  {
    id: 'sovereign',
    label: 'Campus souverain',
    footprint: '30-80 MW',
    description: 'Équilibre entre énergie, risques naturels et refroidissement.',
    weights: { access: 0.06, cooling: 0.11, energy: 0.28, grid: 0.18, land: 0.14, risk: 0.23 },
  },
  {
    id: 'inference',
    label: 'Inférence régionale',
    footprint: '5-30 MW',
    description: 'L’accès aux équipes et aux bassins urbains devient plus important.',
    weights: { access: 0.24, cooling: 0.09, energy: 0.22, grid: 0.14, land: 0.11, risk: 0.2 },
  },
];`,
    profilePresets,
  ],
  [
    "const [selectedProfileId, setSelectedProfileId] = useState('training');",
    "const [selectedProfileId, setSelectedProfileId] = useState('colossus1');",
  ],
  [
    `            {APP_NAME} croise la puissance électrique bas carbone, les contraintes naturelles
            et les signaux d’accès autour d’un point. Cliquez un département, puis un site
            potentiel pour obtenir un score d’aptitude.`,
    `            {APP_NAME} croise la puissance électrique bas carbone, le raccordement et les contraintes territoriales
            pour des scénarios de 30 MW à 2 GW. Le scénario par défaut simule un campus de 300 MW
            proche de l’ordre de grandeur de Colossus 1.`,
  ],
  [
    `      <ProfileSelector
        mode={mode}
        profiles={profiles}
        selectedProfile={selectedProfile}
        setSelectedProfileId={setSelectedProfileId}
      />

      <ScorePlate`,
    `      <ProfileSelector
        mode={mode}
        profiles={profiles}
        selectedProfile={selectedProfile}
        setSelectedProfileId={setSelectedProfileId}
      />

      <HyperscaleScalePanel mode={mode} selectedMetric={selectedMetric} selectedProfile={selectedProfile} />

      <ScorePlate`,
  ],
  [
    'function LiveGridSignal({ energy, mode }) {',
    `${hyperscalePanel}function LiveGridSignal({ energy, mode }) {`,
  ],
  [
    `  const profilePenalty =
    thresholdMw >= 160
      ? maxVoltageKv >= 400
        ? 0
        : maxVoltageKv >= 225
          ? 13
          : 30
      : thresholdMw >= 70
        ? maxVoltageKv >= 225
          ? 0
          : 14
        : maxVoltageKv >= 90
          ? 0
          : 10;`,
    `  const profilePenalty =
    thresholdMw >= 1_000
      ? maxVoltageKv >= 400
        ? thresholdMw >= 2_000
          ? 18
          : 5
        : 58
      : thresholdMw >= 300
        ? maxVoltageKv >= 400
          ? 0
          : maxVoltageKv >= 225
            ? 22
            : 48
        : thresholdMw >= 160
          ? maxVoltageKv >= 400
            ? 0
            : maxVoltageKv >= 225
              ? 13
              : 30
          : thresholdMw >= 70
            ? maxVoltageKv >= 225
              ? 0
              : 14
            : maxVoltageKv >= 90
              ? 0
              : 10;`,
  ],
  [
    `function profileToPowerNeedMw(profile = PROFILE_PRESETS[0]) {
  if (profile.id === 'training') return 160;
  if (profile.id === 'sovereign') return 70;
  return 25;
}`,
    `function profileToPowerNeedMw(profile = PROFILE_PRESETS[0]) {
  const powerNeedMw = Number(profile?.powerNeedMw ?? PROFILE_PRESETS[0].powerNeedMw);
  return Number.isFinite(powerNeedMw) && powerNeedMw > 0 ? powerNeedMw : PROFILE_PRESETS[0].powerNeedMw;
}`,
  ],
  [
    `function formatMw(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('fr-FR').format(Math.round(Number.isFinite(numericValue) ? numericValue : 0));
}`,
    `function formatPowerScale(valueMw) {
  const numericValue = Number(valueMw ?? 0);
  if (!Number.isFinite(numericValue)) return '0 MW';
  if (numericValue >= 1_000) return \`${'${formatDecimal(numericValue / 1_000)}'} GW\`;
  return \`${'${formatMw(numericValue)}'} MW\`;
}

function formatCompactCurrency(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('fr-FR', {
    currency: 'EUR',
    currencyDisplay: 'symbol',
    maximumFractionDigits: 1,
    notation: 'compact',
    style: 'currency',
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatMw(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('fr-FR').format(Math.round(Number.isFinite(numericValue) ? numericValue : 0));
}`,
  ],
]);

await replaceInFile('src/data/indices.js', [
  [
    'Appliquer les pondérations du scénario choisi: cluster entraînement, campus souverain ou inférence régionale.',
    'Appliquer les pondérations du scénario choisi: Colossus 1 à 300 MW, campus 1 GW, extension 2 GW ou référence régionale 30 MW.',
  ],
  [
    'Où l’accès réseau est-il crédible pour 30, 80 ou 200 MW ?',
    'Où l’accès réseau est-il crédible pour 30 MW, 300 MW, 1 GW ou 2 GW ?',
  ],
  [
    'Comparer la capacité disponible avec le besoin indicatif du scénario: 160 MW pour entraînement, 70 MW pour campus souverain, 25 MW pour inférence.',
    'Comparer la capacité disponible avec le besoin du scénario: 30 MW pour la référence régionale, 300 MW pour Colossus 1, 1 000 MW pour le campus gigawatt et 2 000 MW pour le stress test.',
  ],
]);

await replaceInFile('README.md', [
  [
    '2. mesurer si le raccordement électrique paraît crédible pour 30, 80 ou 200 MW;',
    '2. mesurer si le raccordement électrique paraît crédible pour 30 MW, 300 MW, 1 GW ou 2 GW;',
  ],
  [
    '| Livré | Raccordement électrique | Où approcher 30, 80 ou 200 MW de manière crédible ? | Caparéseau, capacités d’accueil réseau, postes RTE | Très fort |',
    '| Livré | Raccordement électrique | Où approcher 30 MW, 300 MW, 1 GW ou 2 GW de manière crédible ? | Caparéseau, capacités d’accueil réseau, postes RTE | Très fort |',
  ],
  [
    '## Modèle De Score',
    `## Simulation Hyperscale

Le scénario par défaut représente désormais un campus de **300 MW et environ 200 000 GPU**, proche de l’ordre de grandeur public attribué à Colossus 1. Trois comparaisons complètent le modèle: 30 MW, 1 GW et 2 GW.

Le panneau hyperscale calcule la consommation quotidienne et annuelle, le coût électrique à 0,08 EUR/kWh, la puissance GPU seule, les auxiliaires estimés et la couverture de capacité Caparéseau. Les hypothèses sont documentées dans [docs/COLOSSUS_SCALE.md](docs/COLOSSUS_SCALE.md).

Ces scénarios sont des ordres de grandeur. Au-dessus de 300 MW, un score territorial ne vaut jamais faisabilité: une instruction RTE, des postes 400/225 kV, une production ou contractualisation dédiée, le stockage, la redondance et le refroidissement deviennent des prérequis.

## Modèle De Score`,
  ],
  [
    '- [Politique de confidentialité](docs/PRIVACY.md)',
    '- [Politique de confidentialité](docs/PRIVACY.md)\n- [Hypothèses de simulation hyperscale](docs/COLOSSUS_SCALE.md)',
  ],
]);

await replaceInFile('package.json', [
  [
    '"preview": "vite preview --host 127.0.0.1"',
    '"preview": "vite preview --host 127.0.0.1",\n    "test": "node --test"',
  ],
]);
