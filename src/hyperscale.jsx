import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowRight,
  Building2,
  Cpu,
  Euro,
  Gauge,
  Server,
  X,
  Zap,
} from 'lucide-react';
import './styles.css';
import gridCapacity from './data/gridCapacity.json';
import {
  COLOSSUS_SCALE_ASSUMPTIONS,
  COLOSSUS_SCENARIOS,
  buildColossusScenarioSummary,
  getColossusScenario,
} from './data/colossusScenarios.js';

const DEFAULT_SCENARIO_ID = 'colossus-1-300mw';
const SCORE_THRESHOLDS = {
  strong: 72,
  conditional: 48,
};

const departments = Object.entries(gridCapacity.departments ?? {})
  .map(([key, value]) => ({ key, ...value }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

const departmentByKey = new Map(departments.map((department) => [department.key, department]));

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function voltageScore(maxVoltageKv, loadMw) {
  if (loadMw >= 1_000) {
    return maxVoltageKv >= 400 ? 82 : maxVoltageKv >= 225 ? 24 : 4;
  }

  if (loadMw >= 300) {
    return maxVoltageKv >= 400 ? 96 : maxVoltageKv >= 225 ? 52 : 12;
  }

  return maxVoltageKv >= 400 ? 100 : maxVoltageKv >= 225 ? 88 : maxVoltageKv >= 90 ? 62 : 34;
}

function assessGrid(department, loadMw) {
  const availableMw = Number(department?.availableMw ?? 0);
  const maxVoltageKv = Number(department?.maxVoltageKv ?? 0);
  const highVoltageSites = Number(department?.highVoltageSites ?? 0);
  const coverageRatio = availableMw / Math.max(loadMw, 1);
  const capacityScore = clamp((coverageRatio / 1.25) * 100, 0, 100);
  const transmissionScore = voltageScore(maxVoltageKv, loadMw);
  const topologyScore = clamp(Math.log1p(highVoltageSites) * 26, 0, 100);
  const extremeScalePenalty = loadMw >= 2_000 ? 12 : 0;
  const score = Math.round(
    clamp(capacityScore * 0.55 + transmissionScore * 0.35 + topologyScore * 0.1 - extremeScalePenalty, 0, 100),
  );

  return {
    availableMw,
    coverageRatio,
    highVoltageSites,
    label:
      score >= SCORE_THRESHOLDS.strong
        ? 'Crédible à instruire'
        : score >= SCORE_THRESHOLDS.conditional
          ? 'Conditionnel — renforcement probable'
          : 'Incompatible sans infrastructure majeure',
    maxVoltageKv,
    score,
  };
}

function rankDepartments(loadMw) {
  return departments
    .map((department) => ({
      ...department,
      assessment: assessGrid(department, loadMw),
    }))
    .sort((a, b) => b.assessment.score - a.assessment.score || b.availableMw - a.availableMw);
}

const defaultDepartmentKey = rankDepartments(getColossusScenario(DEFAULT_SCENARIO_ID).electricalLoadMw)[0]?.key ?? departments[0]?.key;

function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)));
}

function formatDecimal(value, digits = 1) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(Number(value ?? 0));
}

function formatPower(valueMw) {
  const value = Number(valueMw ?? 0);
  return value >= 1_000 ? `${formatDecimal(value / 1_000)} GW` : `${formatNumber(value)} MW`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', {
    currency: 'EUR',
    maximumFractionDigits: 1,
    notation: 'compact',
    style: 'currency',
  }).format(Number(value ?? 0));
}

function Metric({ icon, label, value }) {
  return (
    <div className="border border-[#d8d0bd] bg-[#fffaf0] p-4">
      <div className="flex items-center justify-between gap-4 text-ink">
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-pewter">{label}</span>
        {icon}
      </div>
      <p className="mt-5 font-display text-3xl leading-none text-ink sm:text-4xl">{value}</p>
    </div>
  );
}

function FactRow({ label, value }) {
  return (
    <div className="grid gap-1 border-b border-[#e2dbc9] py-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)] sm:gap-4">
      <span className="text-sm text-graphite">{label}</span>
      <span className="break-words font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink sm:text-right">{value}</span>
    </div>
  );
}

function ScenarioChoice({ active, onSelect, scenario }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 ${
        active ? 'border-ink bg-ink text-white' : 'border-[#d8d0bd] bg-transparent text-ink hover:border-ink'
      }`}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="text-sm font-medium">{scenario.label}</span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em]">{formatPower(scenario.electricalLoadMw)}</span>
      </span>
      <span className="mt-3 block text-xs leading-5 opacity-70">~{formatNumber(scenario.gpuCount)} GPU</span>
    </button>
  );
}

function SimulatorDialog({ onClose }) {
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [electricityPrice, setElectricityPrice] = useState(
    COLOSSUS_SCALE_ASSUMPTIONS.defaultElectricityPriceEurPerKwh,
  );
  const [departmentKey, setDepartmentKey] = useState(defaultDepartmentKey);

  const scenario = getColossusScenario(scenarioId);
  const summary = useMemo(
    () => buildColossusScenarioSummary([scenario], electricityPrice)[0],
    [electricityPrice, scenario],
  );
  const ranking = useMemo(() => rankDepartments(scenario.electricalLoadMw), [scenario.electricalLoadMw]);
  const department = departmentByKey.get(departmentKey) ?? ranking[0];
  const assessment = assessGrid(department, scenario.electricalLoadMw);
  const topStation = department?.topStations?.[0];
  const baselineMultiplier = scenario.electricalLoadMw / 30;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="hyperscale-title">
      <button type="button" aria-label="Fermer le simulateur" className="fixed inset-0 cursor-default" onClick={onClose} />

      <section className="relative mx-auto max-w-[92rem] border border-[#d8d0bd] bg-porcelain p-5 shadow-2xl sm:p-8 lg:p-12">
        <header className="flex items-start justify-between gap-6 border-b border-[#d8d0bd] pb-7">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-pewter">PrismCenter · capacité industrielle</p>
            <h2 id="hyperscale-title" className="mt-4 max-w-5xl font-display text-[clamp(2.8rem,7vw,7rem)] font-normal leading-[0.86] text-ink">
              Simulateur hyperscale
            </h2>
            <p className="mt-6 max-w-3xl text-base font-light leading-7 text-graphite sm:text-lg sm:leading-8">
              Comparez un datacenter régional de 30 MW avec un campus Colossus 1 de 300 MW, puis testez les seuils 1 GW et 2 GW.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-ink text-ink transition hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4"
            aria-label="Fermer"
          >
            <X aria-hidden="true" size={18} strokeWidth={1.4} />
          </button>
        </header>

        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLOSSUS_SCENARIOS.map((item) => (
            <ScenarioChoice
              key={item.id}
              active={item.id === scenario.id}
              onSelect={() => setScenarioId(item.id)}
              scenario={item}
            />
          ))}
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
          <div className="grid content-start gap-8">
            <section className="border border-[#d8d0bd] bg-[#f4f0e7] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">{scenario.label}</p>
                  <p className="mt-3 font-display text-6xl leading-none text-ink sm:text-7xl">{formatPower(scenario.electricalLoadMw)}</p>
                </div>
                <span className="border border-ink px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink">
                  ×{formatDecimal(baselineMultiplier)} le site 30 MW
                </span>
              </div>
              <p className="mt-6 max-w-3xl text-sm leading-6 text-graphite">{scenario.description}</p>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric icon={<Cpu aria-hidden="true" size={17} strokeWidth={1.3} />} label="GPU" value={`~${formatNumber(summary.gpuCount)}`} />
              <Metric icon={<Server aria-hidden="true" size={17} strokeWidth={1.3} />} label="GPU seuls" value={`${formatNumber(summary.gpuPowerMw)} MW`} />
              <Metric icon={<Building2 aria-hidden="true" size={17} strokeWidth={1.3} />} label="Infrastructure" value={`${formatNumber(summary.infrastructurePowerMw)} MW`} />
              <Metric icon={<Zap aria-hidden="true" size={17} strokeWidth={1.3} />} label="Énergie / jour" value={`${formatDecimal(summary.energy.dailyGwh)} GWh`} />
              <Metric icon={<Gauge aria-hidden="true" size={17} strokeWidth={1.3} />} label="Énergie / an" value={`${formatDecimal(summary.energy.yearlyTwh, 2)} TWh`} />
              <Metric icon={<Euro aria-hidden="true" size={17} strokeWidth={1.3} />} label="Coût / jour" value={formatCurrency(summary.cost.dailyEur)} />
            </section>

            <section className="border border-[#d8d0bd] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">Hypothèse électricité</p>
                  <p className="mt-2 font-display text-4xl leading-none text-ink">{formatDecimal(electricityPrice, 2)} €/kWh</p>
                </div>
                <p className="max-w-md text-xs leading-5 text-graphite">
                  Contrats, PPA, gaz, batteries, taxes, maintenance et contraintes réseau peuvent déplacer fortement ce coût.
                </p>
              </div>
              <input
                aria-label="Prix de l’électricité en euros par kilowattheure"
                className="mt-6 w-full accent-black"
                type="range"
                min="0.02"
                max="0.25"
                step="0.01"
                value={electricityPrice}
                onChange={(event) => setElectricityPrice(clamp(Number(event.target.value), 0.02, 0.25))}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <FactRow label="Par jour" value={formatCurrency(summary.cost.dailyEur)} />
                <FactRow label="Par mois" value={formatCurrency(summary.cost.monthlyEur)} />
                <FactRow label="Par an" value={formatCurrency(summary.cost.yearlyEur)} />
              </div>
            </section>
          </div>

          <aside className="grid content-start gap-6 border border-[#d8d0bd] p-5 sm:p-7">
            <div>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">Test raccordement</p>
              <h3 className="mt-3 font-display text-4xl leading-none text-ink">{department?.name ?? 'Département'}</h3>
              <p className="mt-3 text-sm leading-6 text-graphite">{assessment.label}</p>
            </div>

            <label className="grid gap-2">
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-pewter">Département</span>
              <select
                className="h-12 min-w-0 border border-[#d8d0bd] bg-transparent px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                value={department?.key ?? ''}
                onChange={(event) => setDepartmentKey(event.target.value)}
              >
                {departments.map((item) => (
                  <option key={item.key} value={item.key}>{item.name}</option>
                ))}
              </select>
            </label>

            <div>
              <div className="flex items-end justify-between gap-4">
                <span className="font-display text-6xl leading-none text-ink">{assessment.score}</span>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-pewter">/100</span>
              </div>
              <div className="mt-4 h-3 border border-[#d8d0bd] p-[2px]">
                <div className="h-full bg-ink transition-all" style={{ width: `${assessment.score}%` }} />
              </div>
            </div>

            <div>
              <FactRow label="Besoin scénario" value={formatPower(scenario.electricalLoadMw)} />
              <FactRow label="Capacité disponible" value={`${formatNumber(assessment.availableMw)} MW`} />
              <FactRow label="Couverture" value={`${formatDecimal(assessment.coverageRatio * 100)}%`} />
              <FactRow label="Tension maximale" value={assessment.maxVoltageKv ? `${assessment.maxVoltageKv} kV` : 'Non qualifiée'} />
              <FactRow label="Postes haute tension" value={formatNumber(assessment.highVoltageSites)} />
              <FactRow label="File d’attente" value={`${formatNumber(department?.queueMw ?? 0)} MW`} />
              <FactRow label="Poste le plus ouvert" value={topStation ? `${topStation.name} · ${formatDecimal(topStation.availableMw)} MW` : 'Non qualifié'} />
            </div>

            <div className="border-t border-[#d8d0bd] pt-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">Top 5 départemental</p>
                <Activity aria-hidden="true" size={16} strokeWidth={1.3} />
              </div>
              <div className="mt-4 grid gap-2">
                {ranking.slice(0, 5).map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDepartmentKey(item.key)}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border border-[#d8d0bd] p-3 text-left transition hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <span className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-pewter">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{item.name}</span>
                      <span className="mt-1 block text-xs text-graphite">{formatNumber(item.availableMw)} MW · {item.maxVoltageKv} kV</span>
                    </span>
                    <span className="font-display text-2xl leading-none text-ink">{item.assessment.score}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <footer className="mt-10 flex flex-wrap items-start justify-between gap-5 border-t border-[#d8d0bd] pt-6">
          <p className="max-w-4xl text-xs leading-5 text-graphite">
            Ordres de grandeur uniquement. Caparéseau et les postes RTE sont agrégés au département: ils ne garantissent ni raccordement, ni délai, ni coût. Au-dessus de 300 MW, production dédiée, stockage, redondance N+1, eau, chaleur fatale et renforcement réseau doivent être instruits comme un projet énergétique industriel.
          </p>
          <a className="inline-flex items-center gap-2 border border-ink px-4 py-3 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink transition hover:bg-ink hover:text-white" href="https://github.com/Ryvexam/PrismCenter/blob/dev/docs/COLOSSUS_SCALE.md" target="_blank" rel="noreferrer">
            Voir les hypothèses
            <ArrowRight aria-hidden="true" size={13} strokeWidth={1.4} />
          </a>
        </footer>
      </section>
    </div>
  );
}

function HyperscaleLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[80] inline-flex min-h-12 items-center gap-3 border border-white bg-ink px-5 font-mono text-[0.62rem] uppercase tracking-[0.17em] text-white shadow-2xl transition hover:bg-white hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:bottom-6 sm:right-6"
      >
        <Zap aria-hidden="true" size={15} strokeWidth={1.4} />
        Simuler 300 MW–2 GW
      </button>
      {isOpen && <SimulatorDialog onClose={() => setIsOpen(false)} />}
    </>
  );
}

const rootElement = document.getElementById('hyperscale-root');

if (rootElement) {
  createRoot(rootElement).render(<HyperscaleLauncher />);
}
