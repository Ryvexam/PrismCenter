const DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH = 0.08;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;
const KW_PER_MW = 1_000;
const GWH_PER_TWH = 1_000;

export const COLOSSUS_SCALE_ASSUMPTIONS = {
  defaultElectricityPriceEurPerKwh: DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH,
  gpuPowerKw: {
    h100: 0.7,
    h200: 0.7,
    gb200Equivalent: 1.2,
  },
  serverOverheadFactor: {
    efficient: 1.25,
    realistic: 1.45,
    dense: 1.65,
  },
  pueRange: {
    efficient: 1.15,
    realistic: 1.25,
    stressed: 1.4,
  },
};

export const COLOSSUS_SCENARIOS = [
  {
    id: 'baseline-30mw',
    label: 'Datacenter régional',
    electricalLoadMw: 30,
    gpuCount: 25_000,
    gpuPowerKw: COLOSSUS_SCALE_ASSUMPTIONS.gpuPowerKw.h100,
    architecture: 'H100/H200-equivalent',
    description: 'Point de comparaison: un datacenter IA de 30 MW, déjà conséquent mais dix fois plus petit que le scénario Colossus 1.',
  },
  {
    id: 'colossus-1-300mw',
    label: 'Colossus 1',
    electricalLoadMw: 300,
    gpuCount: 200_000,
    gpuPowerKw: COLOSSUS_SCALE_ASSUMPTIONS.gpuPowerKw.h100,
    architecture: 'H100/H200',
    description: 'Hypothèse de travail de 300 MW pour 200 000 GPU, incluant serveurs, réseau, stockage, refroidissement et pertes.',
  },
  {
    id: 'colossus-2-1gw',
    label: 'Campus 1 GW',
    electricalLoadMw: 1_000,
    gpuCount: 1_000_000,
    gpuPowerKw: COLOSSUS_SCALE_ASSUMPTIONS.gpuPowerKw.h100,
    architecture: 'H100/H200-equivalent',
    description: 'Première étape gigawatt vers un million de GPU; le modèle signale lorsque la charge réaliste dépasse cette enveloppe.',
  },
  {
    id: 'colossus-2-2gw',
    label: 'Extension 2 GW',
    electricalLoadMw: 2_000,
    gpuCount: 1_000_000,
    gpuPowerKw: COLOSSUS_SCALE_ASSUMPTIONS.gpuPowerKw.gb200Equivalent,
    architecture: 'GB200/Blackwell-equivalent',
    description: 'Scénario extrême combinant GPU très denses, auxiliaires, refroidissement, redondance et production électrique dédiée.',
  },
];

function normalizeNonNegative(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

export function calculateEnergyUsage(loadMw) {
  const normalizedLoadMw = normalizeNonNegative(loadMw);
  const dailyGwh = (normalizedLoadMw * HOURS_PER_DAY) / KW_PER_MW;
  const monthlyGwh = dailyGwh * DAYS_PER_MONTH;
  const yearlyTwh = (dailyGwh * DAYS_PER_YEAR) / GWH_PER_TWH;

  return {
    dailyGwh,
    monthlyGwh,
    yearlyTwh,
  };
}

export function calculateEnergyCost(loadMw, electricityPriceEurPerKwh = DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH) {
  const normalizedLoadMw = normalizeNonNegative(loadMw);
  const normalizedPrice = normalizeNonNegative(electricityPriceEurPerKwh);
  const dailyKwh = normalizedLoadMw * KW_PER_MW * HOURS_PER_DAY;
  const dailyEur = dailyKwh * normalizedPrice;

  return {
    dailyEur,
    monthlyEur: dailyEur * DAYS_PER_MONTH,
    yearlyEur: dailyEur * DAYS_PER_YEAR,
  };
}

export function estimateSiteLoadFromGpuCount(
  gpuCount,
  gpuPowerKw,
  {
    pue = COLOSSUS_SCALE_ASSUMPTIONS.pueRange.realistic,
    serverOverheadFactor = COLOSSUS_SCALE_ASSUMPTIONS.serverOverheadFactor.realistic,
  } = {},
) {
  const gpuPowerMw = (normalizeNonNegative(gpuCount) * normalizeNonNegative(gpuPowerKw)) / KW_PER_MW;
  return gpuPowerMw * normalizeNonNegative(serverOverheadFactor) * normalizeNonNegative(pue);
}

export function getColossusScenario(id) {
  return COLOSSUS_SCENARIOS.find((scenario) => scenario.id === id) ?? COLOSSUS_SCENARIOS[1];
}

export function buildColossusScenarioSummary(
  scenarios = COLOSSUS_SCENARIOS,
  electricityPriceEurPerKwh = DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH,
) {
  return scenarios.map((scenario) => {
    const gpuPowerMw = (scenario.gpuCount * scenario.gpuPowerKw) / KW_PER_MW;
    const estimatedSiteLoadMw = estimateSiteLoadFromGpuCount(scenario.gpuCount, scenario.gpuPowerKw);
    const powerHeadroomMw = scenario.electricalLoadMw - estimatedSiteLoadMw;

    return {
      ...scenario,
      gpuPowerMw,
      estimatedSiteLoadMw,
      powerHeadroomMw,
      infrastructurePowerMw: Math.max(scenario.electricalLoadMw - gpuPowerMw, 0),
      energy: calculateEnergyUsage(scenario.electricalLoadMw),
      cost: calculateEnergyCost(scenario.electricalLoadMw, electricityPriceEurPerKwh),
    };
  });
}
