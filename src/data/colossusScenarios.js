const DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH = 0.08;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;
const KW_PER_MW = 1000;
const KWH_PER_GWH = 1_000_000;

export const COLOSSUS_SCALE_ASSUMPTIONS = {
  defaultElectricityPriceEurPerKwh: DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH,
  gpuPowerKw: {
    h100: 0.7,
    h200: 0.7,
    gb200Equivalent: 1.2,
  },
  pueRange: {
    efficient: 1.15,
    realistic: 1.35,
    stressed: 1.55,
  },
};

export const COLOSSUS_SCENARIOS = [
  {
    id: 'baseline-30mw',
    label: 'Datacenter actuel',
    electricalLoadMw: 30,
    gpuCount: 40_000,
    description: 'Ordre de grandeur d’un datacenter IA déjà massif mais encore très loin d’un campus type Colossus.',
  },
  {
    id: 'colossus-1-300mw',
    label: 'Colossus 1',
    electricalLoadMw: 300,
    gpuCount: 200_000,
    description: 'Approximation 250–300 MW pour 200 000 H100, incluant serveurs, réseau, stockage, refroidissement et pertes.',
  },
  {
    id: 'colossus-2-1gw',
    label: 'Colossus 2 — objectif 1 GW',
    electricalLoadMw: 1_000,
    gpuCount: 1_000_000,
    description: 'Scénario campus gigawatt: ordre de grandeur d’un gros réacteur nucléaire français.',
  },
  {
    id: 'colossus-2-2gw',
    label: 'Colossus 2 — extension 2 GW',
    electricalLoadMw: 2_000,
    gpuCount: 1_000_000,
    description: 'Scénario haut: Blackwell/GB200, PUE plus lourd, refroidissement et auxiliaires très consommateurs.',
  },
];

export function calculateEnergyUsage(loadMw) {
  const dailyGwh = (loadMw * KW_PER_MW * HOURS_PER_DAY) / KWH_PER_GWH;
  const monthlyGwh = dailyGwh * DAYS_PER_MONTH;
  const yearlyTwh = (dailyGwh * DAYS_PER_YEAR) / 1000;

  return {
    dailyGwh,
    monthlyGwh,
    yearlyTwh,
  };
}

export function calculateEnergyCost(loadMw, electricityPriceEurPerKwh = DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH) {
  const dailyKwh = loadMw * KW_PER_MW * HOURS_PER_DAY;
  const dailyEur = dailyKwh * electricityPriceEurPerKwh;
  const monthlyEur = dailyEur * DAYS_PER_MONTH;
  const yearlyEur = dailyEur * DAYS_PER_YEAR;

  return {
    dailyEur,
    monthlyEur,
    yearlyEur,
  };
}

export function estimateSiteLoadFromGpuCount(gpuCount, gpuPowerKw, pue = COLOSSUS_SCALE_ASSUMPTIONS.pueRange.realistic) {
  return (gpuCount * gpuPowerKw * pue) / KW_PER_MW;
}

export function buildColossusScenarioSummary(
  scenarios = COLOSSUS_SCENARIOS,
  electricityPriceEurPerKwh = DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH,
) {
  return scenarios.map((scenario) => ({
    ...scenario,
    energy: calculateEnergyUsage(scenario.electricalLoadMw),
    cost: calculateEnergyCost(scenario.electricalLoadMw, electricityPriceEurPerKwh),
  }));
}
