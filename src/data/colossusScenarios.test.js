import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COLOSSUS_SCALE_ASSUMPTIONS,
  buildColossusScenarioSummary,
  calculateEnergyCost,
  calculateEnergyUsage,
  estimateSiteLoadFromGpuCount,
  getColossusScenario,
} from './colossusScenarios.js';

test('300 MW consumes 7.2 GWh per day and about 2.63 TWh per year', () => {
  const usage = calculateEnergyUsage(300);

  assert.equal(usage.dailyGwh, 7.2);
  assert.equal(usage.monthlyGwh, 216);
  assert.equal(usage.yearlyTwh, 2.628);
});

test('300 MW costs 576k EUR per day at 0.08 EUR/kWh', () => {
  const cost = calculateEnergyCost(300, 0.08);

  assert.equal(cost.dailyEur, 576_000);
  assert.equal(cost.monthlyEur, 17_280_000);
  assert.equal(cost.yearlyEur, 210_240_000);
});

test('1 GW consumes 24 GWh and costs 1.92M EUR per day', () => {
  const usage = calculateEnergyUsage(1_000);
  const cost = calculateEnergyCost(1_000, 0.08);

  assert.equal(usage.dailyGwh, 24);
  assert.equal(usage.yearlyTwh, 8.76);
  assert.equal(cost.dailyEur, 1_920_000);
});

test('200k H100-equivalent GPUs produce a realistic Colossus 1 site-load range', () => {
  const siteLoadMw = estimateSiteLoadFromGpuCount(
    200_000,
    COLOSSUS_SCALE_ASSUMPTIONS.gpuPowerKw.h100,
  );

  assert.ok(siteLoadMw >= 250 && siteLoadMw <= 300, `Expected 250-300 MW, received ${siteLoadMw}`);
});

test('scenario summaries separate GPU draw from infrastructure overhead', () => {
  const scenario = getColossusScenario('colossus-1-300mw');
  const [summary] = buildColossusScenarioSummary([scenario]);

  assert.equal(summary.gpuPowerMw, 140);
  assert.equal(summary.infrastructurePowerMw, 160);
  assert.equal(summary.energy.dailyGwh, 7.2);
});
