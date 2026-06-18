export const DATACENTER_SIZE_LIMITS = {
  minMw: 5,
  maxMw: 2000,
  defaultMw: 300,
  sliderStepMw: 5,
};

export const DATACENTER_SIZE_PRESETS = [
  {
    id: 'edge-30mw',
    label: '30 MW',
    sizeMw: 30,
    description: 'Datacenter IA regional / premiere phase.',
  },
  {
    id: 'colossus-300mw',
    label: '300 MW',
    sizeMw: 300,
    description: 'Ordre de grandeur Colossus 1.',
  },
  {
    id: 'gigawatt-1gw',
    label: '1 GW',
    sizeMw: 1000,
    description: 'Campus gigawatt ultra contraint par le reseau.',
  },
  {
    id: 'gigawatt-2gw',
    label: '2 GW',
    sizeMw: 2000,
    description: 'Extension extreme type hyperscale IA.',
  },
];

export function normalizeDatacenterSizeMw(sizeMw) {
  const numericSize = Number(sizeMw);
  if (!Number.isFinite(numericSize)) return DATACENTER_SIZE_LIMITS.defaultMw;
  return Math.min(Math.max(Math.round(numericSize), DATACENTER_SIZE_LIMITS.minMw), DATACENTER_SIZE_LIMITS.maxMw);
}

export function getDatacenterSizeTier(sizeMw) {
  const normalizedSizeMw = normalizeDatacenterSizeMw(sizeMw);

  if (normalizedSizeMw >= 1000) return 'gigawatt';
  if (normalizedSizeMw >= 300) return 'colossus';
  if (normalizedSizeMw >= 80) return 'large-training';
  if (normalizedSizeMw >= 30) return 'regional-campus';
  return 'edge-inference';
}

export function buildDatacenterWeights(sizeMw) {
  const normalizedSizeMw = normalizeDatacenterSizeMw(sizeMw);
  const scale = Math.min(
    Math.log10(normalizedSizeMw / DATACENTER_SIZE_LIMITS.minMw) /
      Math.log10(DATACENTER_SIZE_LIMITS.maxMw / DATACENTER_SIZE_LIMITS.minMw),
    1,
  );
  const gigawattPressure = Math.max(0, normalizedSizeMw - 300) / (DATACENTER_SIZE_LIMITS.maxMw - 300);

  const rawWeights = {
    access: 0.2 - scale * 0.15,
    cooling: 0.08 + scale * 0.08,
    energy: 0.22 + scale * 0.12 + gigawattPressure * 0.04,
    grid: 0.14 + scale * 0.18 + gigawattPressure * 0.06,
    land: 0.14 - scale * 0.04,
    risk: 0.22 - scale * 0.07 - gigawattPressure * 0.03,
  };
  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0);

  return Object.fromEntries(Object.entries(rawWeights).map(([key, value]) => [key, Number((value / total).toFixed(4))]));
}

export function buildDatacenterProfile(sizeMw) {
  const normalizedSizeMw = normalizeDatacenterSizeMw(sizeMw);
  const tier = getDatacenterSizeTier(normalizedSizeMw);
  const matchingPreset = DATACENTER_SIZE_PRESETS.find((preset) => preset.sizeMw === normalizedSizeMw);
  const label = matchingPreset?.label ?? (normalizedSizeMw >= 1000 ? `${normalizedSizeMw / 1000} GW` : `${normalizedSizeMw} MW`);

  return {
    id: `size-${normalizedSizeMw}mw`,
    label,
    footprint: normalizedSizeMw >= 1000 ? `${normalizedSizeMw / 1000} GW` : `${normalizedSizeMw} MW`,
    description: buildDatacenterSizeDescription(tier),
    electricalLoadMw: normalizedSizeMw,
    tier,
    weights: buildDatacenterWeights(normalizedSizeMw),
  };
}

function buildDatacenterSizeDescription(tier) {
  if (tier === 'gigawatt') return 'Echelle gigawatt: reseau 400 kV, energie contractualisee et refroidissement deviennent bloquants.';
  if (tier === 'colossus') return 'Echelle Colossus: raccordement, energie et refroidissement dominent le score.';
  if (tier === 'large-training') return 'Grand cluster IA: puissance disponible prioritaire, foncier encore significatif.';
  if (tier === 'regional-campus') return 'Campus regional: compromis energie, risques, foncier et exploitation.';
  return 'Petit site / inference: acces operationnel et proximite des equipes restent importants.';
}
