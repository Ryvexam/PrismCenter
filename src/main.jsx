import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { geoArea, geoCentroid, geoMercator, geoPath } from 'd3-geo';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Database,
  ExternalLink,
  Layers,
  MapPin,
  Radio,
  RotateCcw,
  Route,
  Shield,
  Snowflake,
  SunMedium,
  Target,
  Waves,
  Zap,
} from 'lucide-react';
import './styles.css';

const ENERGY_MIX_URL =
  'https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/registre-national-installation-production-stockage-electricite-agrege/records?select=codedepartement%2Cdepartement%2Cfiliere%2Csum(puismaxinstallee)%20as%20capacity_kw%2Ccount(*)%20as%20sites&where=codedepartement%20is%20not%20null&group_by=codedepartement%2Cdepartement%2Cfiliere&order_by=codedepartement';

const ECO2MIX_URL =
  'https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/records?limit=1&where=consommation%20is%20not%20null%20and%20solaire%20is%20not%20null&order_by=-date_heure';

const DEPARTMENTS_GEOJSON_URL =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson';

const ENERGY_DATASET_LINK =
  'https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege/information/';
const ECO2MIX_LINK = 'https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/information/';
const GEORISQUES_LINK = 'https://www.georisques.gouv.fr/';
const OPEN_METEO_LINK = 'https://open-meteo.com/';
const OVERPASS_LINK = 'https://overpass-turbo.eu/';
const GEOJSON_LINK = 'https://github.com/gregoiredavid/france-geojson';

const LOW_CARBON_FILIERES = [
  'Solaire',
  'Eolien',
  'Hydraulique',
  'Nucléaire',
  'Bioénergies',
  'Energies Marines',
  'Géothermie',
];

const MAP_LAYERS = [
  {
    id: 'score',
    label: 'Score IA',
    question: 'Où regarder en premier ?',
    description: 'Pré-score départemental pour un datacenter IA, avant analyse fine du site.',
  },
  {
    id: 'energy',
    label: 'Énergie bas carbone',
    question: 'Où la puissance raccordée est-elle déjà forte ?',
    description: 'Solaire, éolien, hydraulique, nucléaire, bioénergies et stockage déclarés dans ODRÉ.',
  },
  {
    id: 'land',
    label: 'Foncier',
    question: 'Où existe-t-il une marge spatiale ?',
    description: 'Surface géographique du département et pression territoriale estimée.',
  },
  {
    id: 'cooling',
    label: 'Refroidissement',
    question: 'Où le froid naturel aide-t-il ?',
    description: 'Latitude, hydraulique raccordée et signaux locaux eau/température au clic.',
  },
  {
    id: 'access',
    label: 'Accès',
    question: 'Où l’accès humain reste-t-il crédible ?',
    description: 'Pré-signal territorial, affiné au clic par la voirie et la distance aux villes.',
  },
  {
    id: 'risk',
    label: 'Pré-risque',
    question: 'Quels secteurs éviter avant étude locale ?',
    description: 'Filtre géographique prudent, remplacé par Géorisques au point cliqué.',
  },
];

const PROFILE_PRESETS = [
  {
    id: 'training',
    label: 'Cluster entraînement',
    footprint: '80-200 MW',
    description: 'Priorité à la puissance bas carbone et à la marge foncière.',
    weights: { access: 0.08, cooling: 0.14, energy: 0.4, land: 0.16, risk: 0.22 },
  },
  {
    id: 'sovereign',
    label: 'Campus souverain',
    footprint: '30-80 MW',
    description: 'Équilibre entre énergie, risques naturels et refroidissement.',
    weights: { access: 0.1, cooling: 0.15, energy: 0.34, land: 0.17, risk: 0.24 },
  },
  {
    id: 'inference',
    label: 'Inférence régionale',
    footprint: '5-30 MW',
    description: 'L’accès aux équipes et aux bassins urbains devient plus important.',
    weights: { access: 0.28, cooling: 0.1, energy: 0.26, land: 0.12, risk: 0.24 },
  },
];

const CRITERIA_LABELS = {
  access: 'Accès travailleurs',
  cooling: 'Refroidissement',
  energy: 'Énergie bas carbone',
  land: 'Foncier & distance villes',
  risk: 'Sismique & inondation',
};

const FALLBACK_REALTIME = {
  date: '2026-06-17',
  heure: '14:15',
  consommation: 50936,
  solaire: 18538,
  tauxCo2: 9,
};

const FALLBACK_DEPARTMENTS = [
  {
    code: '01',
    name: 'Ain',
    capacities: { Nucléaire: 3580000, Hydraulique: 815868, Solaire: 340947, Eolien: 29750 },
    sitesByFiliere: { Solaire: 1301, Hydraulique: 41, Nucléaire: 4, Eolien: 3 },
  },
  {
    code: '02',
    name: 'Aisne',
    capacities: { Eolien: 1533647, Solaire: 181712, Hydraulique: 4451 },
    sitesByFiliere: { Solaire: 727, Eolien: 137, Hydraulique: 12 },
  },
  {
    code: '33',
    name: 'Gironde',
    capacities: { Solaire: 1249794, Eolien: 187802, Bioénergies: 86137, Hydraulique: 22000 },
    sitesByFiliere: { Solaire: 2056, Eolien: 18, Bioénergies: 16 },
  },
  {
    code: '40',
    name: 'Landes',
    capacities: { Solaire: 1414233, Bioénergies: 156012, Hydraulique: 23750 },
    sitesByFiliere: { Solaire: 2338, Bioénergies: 20 },
  },
  {
    code: '45',
    name: 'Loiret',
    capacities: { Nucléaire: 5400000, Solaire: 289744, Eolien: 257230, Bioénergies: 31905 },
    sitesByFiliere: { Solaire: 1677, Nucléaire: 4, Eolien: 31 },
  },
  {
    code: '59',
    name: 'Nord',
    capacities: { Nucléaire: 5460000, Eolien: 466900, Solaire: 168200, Bioénergies: 124300 },
    sitesByFiliere: { Solaire: 1480, Eolien: 44, Nucléaire: 6 },
  },
  {
    code: '76',
    name: 'Seine-Maritime',
    capacities: { Nucléaire: 5320000, Eolien: 735000, Solaire: 146000, Bioénergies: 94200 },
    sitesByFiliere: { Solaire: 980, Eolien: 61, Nucléaire: 4 },
  },
  {
    code: '85',
    name: 'Vendée',
    capacities: { Solaire: 663102, Eolien: 487800, Bioénergies: 53300 },
    sitesByFiliere: { Solaire: 3500, Eolien: 45 },
  },
];

const MAP_BOUNDS = {
  width: 920,
  height: 760,
  padX: 70,
  padY: 54,
};

const EARTH_RADIUS_KM = 6371;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const cx = (...classes) => classes.filter(Boolean).join(' ');

function App() {
  const [view, setView] = useState(() => (window.location.hash === '#studio' ? 'studio' : 'landing'));

  useEffect(() => {
    const syncViewWithHash = () => {
      setView(window.location.hash === '#studio' ? 'studio' : 'landing');
    };

    syncViewWithHash();
    window.addEventListener('hashchange', syncViewWithHash);
    return () => window.removeEventListener('hashchange', syncViewWithHash);
  }, []);

  const openStudio = () => {
    window.history.replaceState(null, '', '#studio');
    setView('studio');
  };

  const openLanding = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setView('landing');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-porcelain text-ink antialiased selection:bg-ink selection:text-white">
        <AnimatePresence mode="wait">
          {view === 'landing' ? (
            <Landing key="landing" onStart={openStudio} />
          ) : (
            <Studio key="studio" onBack={openLanding} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function Landing({ onStart }) {
  return (
    <motion.main
      className="min-h-screen px-6 py-8 md:px-16 md:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Header />
      <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl content-center gap-14">
        <div className="max-w-6xl">
          <p className="mb-7 font-mono text-[0.68rem] uppercase tracking-[0.24em] text-pewter">
            Implantation IA · énergie · risques · territoire
          </p>
          <h1 className="max-w-6xl font-display text-[clamp(3.2rem,8.8vw,8.3rem)] font-normal leading-[0.86] tracking-normal text-ink">
            Où poser un datacenter IA.
            <span className="block italic text-graphite">Sans aveugler le territoire.</span>
          </h1>
        </div>
        <div className="grid max-w-6xl gap-8 md:grid-cols-[0.82fr_1fr] md:items-end">
          <p className="text-lg font-light leading-8 text-graphite md:text-xl md:leading-9">
            Prisme croise la puissance électrique bas carbone, les contraintes naturelles
            et les signaux d’accès autour d’un point. Cliquez un département, puis un site
            potentiel pour obtenir un score d’aptitude.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex min-h-14 w-fit items-center gap-4 border border-ink bg-ink px-7 text-sm font-medium uppercase tracking-[0.16em] text-white transition duration-300 hover:bg-transparent hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-porcelain md:justify-self-end"
          >
            Explorer la carte
            <ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} />
          </button>
        </div>
      </section>
    </motion.main>
  );
}

function Header({ compact = false, onBack }) {
  return (
    <header className={cx('flex items-center justify-between', compact ? 'mb-4' : 'mb-8')}>
      <button
        type={onBack ? 'button' : undefined}
        onClick={onBack}
        className={cx(
          'font-serif text-2xl text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
          onBack ? 'cursor-pointer' : 'cursor-default',
        )}
        aria-label={onBack ? 'Retour au manifeste' : undefined}
      >
        Prisme.
      </button>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-10 items-center justify-center border border-ink text-ink transition hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4"
          aria-label="Retour"
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.4} />
        </button>
      )}
    </header>
  );
}

function Studio({ onBack }) {
  const energy = useEnergyData();
  const [selectedCode, setSelectedCode] = useState('33');
  const [activeLayerId, setActiveLayerId] = useState('score');
  const [selectedProfileId, setSelectedProfileId] = useState('training');
  const [isZoomed, setIsZoomed] = useState(false);
  const [analysisPoint, setAnalysisPoint] = useState(null);

  const selectedProfile = PROFILE_PRESETS.find((profile) => profile.id === selectedProfileId) ?? PROFILE_PRESETS[0];
  const model = useMemo(
    () => buildDepartmentModel(energy.departments, energy.geojson, selectedProfile, energy.realtime),
    [energy.departments, energy.geojson, selectedProfile, energy.realtime],
  );
  const selectedMetric = model.byCode.get(selectedCode) ?? model.items[0];
  const selectedLayer = MAP_LAYERS.find((layer) => layer.id === activeLayerId) ?? MAP_LAYERS[0];

  useEffect(() => {
    if (!analysisPoint && selectedMetric?.centroid) {
      setAnalysisPoint({
        label: 'Point de référence',
        lat: selectedMetric.centroid[1],
        lon: selectedMetric.centroid[0],
      });
    }
  }, [analysisPoint, selectedMetric]);

  const pointAnalysis = usePointAnalysis(analysisPoint, selectedMetric, selectedProfile, energy.realtime);
  const finalScore = pointAnalysis.data?.score ?? selectedMetric?.datacenterScore ?? 0;
  const mode = finalScore >= 76 ? 'optimal' : finalScore < 52 ? 'tension' : 'transition';

  const handleDepartmentSelect = (code, point) => {
    const metric = model.byCode.get(code);
    setSelectedCode(code);
    setIsZoomed(true);
    setAnalysisPoint(
      point ??
        (metric?.centroid
          ? { label: 'Point de référence', lon: metric.centroid[0], lat: metric.centroid[1] }
          : null),
    );
  };

  const shellClasses = {
    optimal: 'bg-porcelain text-graphite p-5 md:p-12 lg:p-16',
    transition: 'bg-[#f8f8f4] text-graphite p-5 md:p-8 lg:p-12',
    tension: 'bg-white text-black p-3 md:p-5',
  };

  return (
    <motion.main
      className={cx(
        'min-h-screen transition-[background-color,color,padding] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
        shellClasses[mode],
        mode === 'tension' && 'font-light',
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      data-mode={mode}
    >
      <Header compact={mode === 'tension'} onBack={onBack} />

      <div
        className={cx(
          'studio-grid transition-[gap] duration-700',
          mode === 'optimal' ? 'gap-12' : mode === 'tension' ? 'gap-4' : 'gap-8',
        )}
      >
        <DepartmentMap
          activeLayerId={activeLayerId}
          analysisPoint={analysisPoint}
          energy={energy}
          isZoomed={isZoomed}
          mode={mode}
          model={model}
          selectedProfile={selectedProfile}
          selectedMetric={selectedMetric}
          setActiveLayerId={setActiveLayerId}
          setIsZoomed={setIsZoomed}
          setSelectedCode={handleDepartmentSelect}
        />
        <ControlDeck
          activeLayerId={activeLayerId}
          analysisPoint={analysisPoint}
          energy={energy}
          mode={mode}
          model={model}
          pointAnalysis={pointAnalysis}
          profiles={PROFILE_PRESETS}
          selectedLayer={selectedLayer}
          selectedMetric={selectedMetric}
          selectedProfile={selectedProfile}
          setActiveLayerId={setActiveLayerId}
          setSelectedCode={handleDepartmentSelect}
          setSelectedProfileId={setSelectedProfileId}
        />
      </div>
    </motion.main>
  );
}

function DepartmentMap({
  activeLayerId,
  analysisPoint,
  energy,
  isZoomed,
  mode,
  model,
  selectedProfile,
  selectedMetric,
  setActiveLayerId,
  setIsZoomed,
  setSelectedCode,
}) {
  const svgRef = useRef(null);
  const selectedFeature = model.features.find((feature) => feature.code === selectedMetric?.code);
  const transform = getZoomTransform(selectedFeature?.bounds, isZoomed);
  const marker = analysisPoint && model.projection ? model.projection([analysisPoint.lon, analysisPoint.lat]) : null;
  const layer = MAP_LAYERS.find((item) => item.id === activeLayerId) ?? MAP_LAYERS[0];

  const clickToLonLat = (event) => {
    if (!svgRef.current || !model.projection?.invert) return null;
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(svgRef.current.getScreenCTM().inverse());
    const sourceX = transform.scale === 1 ? svgPoint.x : (svgPoint.x - MAP_BOUNDS.width / 2) / transform.scale + transform.centerX;
    const sourceY = transform.scale === 1 ? svgPoint.y : (svgPoint.y - MAP_BOUNDS.height / 2) / transform.scale + transform.centerY;
    const lonLat = model.projection.invert([sourceX, sourceY]);
    if (!lonLat?.every(Number.isFinite)) return null;
    return { lon: lonLat[0], lat: lonLat[1] };
  };

  return (
    <section
      className={cx(
        'relative min-h-[42rem] overflow-hidden border transition-all duration-700',
        mode === 'tension'
          ? 'border-black bg-white p-3 md:p-5'
          : mode === 'optimal'
            ? 'border-[#dfd8c6] bg-[#f4f0e7] p-6 md:p-9 lg:p-11 shadow-editorial'
            : 'border-[#ded9ca] bg-[#f7f4ec] p-5 md:p-8',
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-pewter">
            Carte d’aptitude datacenter IA
          </p>
          <h2
            className={cx(
              'mt-3 font-display font-normal leading-none tracking-normal text-ink transition-all duration-700',
              mode === 'tension' ? 'text-3xl' : 'text-5xl md:text-6xl',
            )}
          >
            {selectedMetric?.name ?? 'France'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SourcePill source={energy.source} />
          {isZoomed && (
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="inline-flex h-10 items-center gap-2 border border-ink px-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4"
            >
              <RotateCcw aria-hidden="true" size={14} strokeWidth={1.4} />
              France
            </button>
          )}
        </div>
      </div>

      <LayerControls activeLayerId={activeLayerId} mode={mode} setActiveLayerId={setActiveLayerId} />

      <div className="relative mt-5 min-h-[38rem] min-w-0 overflow-hidden">
        {model.features.length ? (
          <svg
            ref={svgRef}
            className="h-[38rem] w-full max-w-full"
            role="img"
            aria-label="Carte interactive des départements français"
            viewBox={`0 0 ${MAP_BOUNDS.width} ${MAP_BOUNDS.height}`}
          >
            <defs>
              <filter id="department-shadow" x="-15%" y="-15%" width="130%" height="130%">
                <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#141414" floodOpacity="0.08" />
              </filter>
            </defs>
            <g transform={transform.value}>
              {model.features.map((feature) => {
                const metric = model.byCode.get(feature.code);
                const isSelected = feature.code === selectedMetric?.code;

                return (
                  <path
                    key={feature.code}
                    aria-label={`${feature.name}, score ${metric?.datacenterScore ?? 0}`}
                    className={cx(
                      'department-path cursor-crosshair transition-[fill,stroke,opacity] duration-500 focus:outline-none',
                      isSelected && 'department-path--selected',
                    )}
                    d={feature.path}
                    fill={departmentFill(metric, activeLayerId, mode, isSelected)}
                    filter={isSelected && mode !== 'tension' ? 'url(#department-shadow)' : undefined}
                    onClick={(event) => {
                      const point = clickToLonLat(event);
                      setSelectedCode(feature.code, point ? { ...point, label: 'Point cliqué' } : undefined);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        const centroid = metric?.centroid;
                        setSelectedCode(
                          feature.code,
                          centroid ? { label: 'Point de référence', lon: centroid[0], lat: centroid[1] } : undefined,
                        );
                      }
                    }}
                    role="button"
                    opacity={isZoomed && !isSelected ? 0.055 : 1}
                    stroke={isSelected ? '#141414' : mode === 'tension' ? '#000000' : '#d9d0bd'}
                    strokeWidth={isSelected ? 2.4 / transform.scale : 0.72 / transform.scale}
                    tabIndex="0"
                  />
                );
              })}
              {marker && selectedFeature && (
                <g className="pointer-events-none">
                  <circle cx={marker[0]} cy={marker[1]} r={7 / transform.scale} fill="#141414" />
                  <circle
                    cx={marker[0]}
                    cy={marker[1]}
                    r={18 / transform.scale}
                    fill="none"
                    stroke="#141414"
                    strokeWidth={1.2 / transform.scale}
                  />
                </g>
              )}
            </g>
          </svg>
        ) : (
          <FallbackDepartmentList departments={model.items} mode={mode} setSelectedCode={setSelectedCode} />
        )}
      </div>

      <div
        className={cx(
          'grid gap-3 border-t pt-5 text-sm md:grid-cols-3',
          mode === 'tension' ? 'border-black text-black' : 'border-[#ded6c4] text-graphite',
        )}
      >
        <Stat label="Score carte" value={`${Math.round(layerValue(selectedMetric, activeLayerId))}/100`} />
        <Stat label="Puissance bas carbone" value={`${formatMw((selectedMetric?.lowCarbonKw ?? 0) / 1000)} MW`} />
        <Stat label="Scénario" value={selectedProfile.footprint} />
      </div>

      <p className="mt-5 max-w-3xl text-sm leading-6 text-graphite">
        {layer.question} {layer.description}
      </p>
    </section>
  );
}

function LayerControls({ activeLayerId, mode, setActiveLayerId }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MAP_LAYERS.map((layer) => (
        <button
          key={layer.id}
          type="button"
          onClick={() => setActiveLayerId(layer.id)}
          className={cx(
            'inline-flex h-10 items-center gap-2 border px-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
            activeLayerId === layer.id
              ? 'border-ink bg-ink text-white'
              : mode === 'tension'
                ? 'border-black text-black hover:bg-black hover:text-white'
                : 'border-[#d8d0bd] text-ink hover:border-ink',
          )}
        >
          <Layers aria-hidden="true" size={13} strokeWidth={1.4} />
          {layer.label}
        </button>
      ))}
    </div>
  );
}

function ControlDeck({
  activeLayerId,
  analysisPoint,
  energy,
  mode,
  model,
  pointAnalysis,
  profiles,
  selectedLayer,
  selectedMetric,
  selectedProfile,
  setActiveLayerId,
  setSelectedCode,
  setSelectedProfileId,
}) {
  const score = pointAnalysis.data?.score ?? selectedMetric?.datacenterScore ?? 0;
  const verdict =
    score >= 78 ? 'Site à instruire' : score >= 58 ? 'À challenger' : 'À écarter';
  const statusMessage =
    pointAnalysis.status === 'loading'
      ? 'Analyse locale en cours. Prisme interroge les sources publiques autour du point.'
      : pointAnalysis.data?.summary ??
        'Cliquez dans le département pour remplacer le pré-score par une analyse locale.';

  return (
    <aside
      className={cx(
        'flex flex-col border bg-transparent transition-all duration-700',
        mode === 'tension'
          ? 'gap-4 border-black p-4'
          : mode === 'optimal'
            ? 'gap-8 border-[#d9d1be] p-7 md:p-9'
            : 'gap-6 border-[#ddd6c4] p-6 md:p-8',
      )}
    >
      <div className={cx('grid transition-[gap] duration-700', mode === 'tension' ? 'gap-3' : 'gap-5')}>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em]">Décision d’implantation</p>
        <h2
          className={cx(
            'font-display font-normal leading-none tracking-normal text-ink transition-all duration-700',
            mode === 'tension' ? 'text-3xl' : 'text-5xl md:text-6xl',
          )}
        >
          {verdict}
        </h2>
        <p
          className={cx(
            'transition-all duration-700',
            mode === 'tension' ? 'text-sm leading-6' : 'text-lg font-light leading-8',
          )}
        >
          {statusMessage}
        </p>
      </div>

      <LiveGridSignal energy={energy} mode={mode} />

      <ProfileSelector
        mode={mode}
        profiles={profiles}
        selectedProfile={selectedProfile}
        setSelectedProfileId={setSelectedProfileId}
      />

      <ScorePlate mode={mode} score={score} selectedMetric={selectedMetric} />

      <CriteriaGrid mode={mode} pointAnalysis={pointAnalysis} selectedMetric={selectedMetric} />

      <NationalRanking mode={mode} model={model} selectedCode={selectedMetric?.code} setSelectedCode={setSelectedCode} />

      <PointPanel analysisPoint={analysisPoint} mode={mode} pointAnalysis={pointAnalysis} />

      <ActionPlan mode={mode} pointAnalysis={pointAnalysis} selectedMetric={selectedMetric} />

      <DepartmentSearch
        departments={model.items}
        mode={mode}
        selectedCode={selectedMetric?.code}
        setSelectedCode={setSelectedCode}
      />

      <ScenarioPanel
        activeLayerId={activeLayerId}
        mode={mode}
        selectedLayer={selectedLayer}
        selectedMetric={selectedMetric}
        setActiveLayerId={setActiveLayerId}
      />

      <EvidencePanel energy={energy} mode={mode} pointAnalysis={pointAnalysis} />

      <div
        className={cx(
          'grid gap-4 border-t pt-5 text-sm leading-6 transition-colors duration-700',
          mode === 'tension' ? 'border-black text-black' : 'border-[#ddd6c4] text-graphite',
        )}
      >
        <FactRow label="Dernier point Eco2mix" value={`${energy.realtime.date} · ${energy.realtime.heure}`} />
        <FactRow label="Consommation nationale" value={`${formatNumber(energy.realtime.consommation)} MW`} />
        <FactRow label="Solaire national" value={`${formatNumber(energy.realtime.solaire)} MW`} />
        <FactRow label="Intensité CO₂" value={`${energy.realtime.tauxCo2} g/kWh`} />
      </div>

      <SourceLinks mode={mode} />
    </aside>
  );
}

function LiveGridSignal({ energy, mode }) {
  const liveScore = buildLiveGridScore(energy.realtime);
  const solarShare = Math.round((energy.realtime.solaire / Math.max(energy.realtime.consommation, 1)) * 100);
  const label = liveScore >= 78 ? 'Signal très favorable' : liveScore >= 55 ? 'Signal exploitable' : 'Signal contraint';

  return (
    <div className={cx('grid gap-3 border p-4', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Signal réseau maintenant</p>
        <SunMedium aria-hidden="true" size={17} strokeWidth={1.3} />
      </div>
      <div className="grid grid-cols-[auto_1fr] items-end gap-4">
        <p className="font-display text-5xl leading-none text-ink">{Math.round(liveScore)}</p>
        <p className="text-sm leading-6 text-graphite">
          {label}. CO₂ {energy.realtime.tauxCo2} g/kWh · solaire {solarShare}% · {energy.realtime.heure}.
        </p>
      </div>
      <div className={cx('h-2 border p-[2px]', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
        <div className={cx('h-full', mode === 'tension' ? 'bg-black' : 'bg-solar')} style={{ width: `${liveScore}%` }} />
      </div>
    </div>
  );
}

function ProfileSelector({ mode, profiles, selectedProfile, setSelectedProfileId }) {
  return (
    <div className={cx('grid gap-3 border-t pt-5', mode === 'tension' ? 'border-black' : 'border-[#ddd6c4]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Scénario datacenter</p>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{selectedProfile.footprint}</span>
      </div>
      <div className="grid gap-2">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => setSelectedProfileId(profile.id)}
            className={cx(
              'border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
              profile.id === selectedProfile.id
                ? 'border-ink bg-ink text-white'
                : mode === 'tension'
                  ? 'border-black hover:bg-black hover:text-white'
                  : 'border-[#d8d0bd] hover:border-ink',
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm">{profile.label}</span>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{profile.footprint}</span>
            </span>
            <span className="mt-1 block text-xs leading-5 opacity-70">{profile.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScorePlate({ mode, score, selectedMetric }) {
  return (
    <div className={cx('grid gap-3 border transition-all duration-700', mode === 'tension' ? 'border-black p-4' : 'border-[#d8d0bd] p-5')}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Score d’aptitude</p>
          <p className="mt-2 font-display text-6xl leading-none text-ink">{Math.round(score)}</p>
        </div>
        <Target aria-hidden="true" size={24} strokeWidth={1.2} />
      </div>
      <div className={cx('h-3 border p-[2px]', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
        <div
          className={cx('h-full transition-all duration-700', mode === 'tension' ? 'bg-black' : 'bg-solar')}
          style={{ width: `${clamp(score, 0, 100)}%` }}
        />
      </div>
      <p className="text-sm leading-6 text-graphite">
        Pré-score départemental : {Math.round(selectedMetric?.datacenterScore ?? 0)}/100. Le clic local ajuste ce score
        avec les risques, la route, l’eau et la température.
      </p>
    </div>
  );
}

function NationalRanking({ mode, model, selectedCode, setSelectedCode }) {
  const leaders = [...model.items].sort((a, b) => b.datacenterScore - a.datacenterScore).slice(0, 5);

  return (
    <div className={cx('grid gap-3 border-t pt-5', mode === 'tension' ? 'border-black' : 'border-[#ddd6c4]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Meilleurs candidats</p>
        <Activity aria-hidden="true" size={16} strokeWidth={1.3} />
      </div>
      <div className="grid gap-2">
        {leaders.map((department, index) => (
          <button
            key={department.code}
            type="button"
            onClick={() => setSelectedCode(department.code)}
            className={cx(
              'grid grid-cols-[auto_1fr_auto] items-center gap-3 border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
              department.code === selectedCode
                ? 'border-ink bg-ink text-white'
                : mode === 'tension'
                  ? 'border-black hover:bg-black hover:text-white'
                  : 'border-[#d8d0bd] hover:border-ink',
            )}
          >
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{index + 1}</span>
            <span>
              <span className="block text-sm">{department.name}</span>
              <span className="mt-1 block text-xs opacity-70">
                {formatMw(department.lowCarbonKw / 1000)} MW bas carbone · {formatNumber(department.areaKm2 ?? 0)} km²
              </span>
            </span>
            <span className="font-display text-3xl leading-none">{department.datacenterScore}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CriteriaGrid({ mode, pointAnalysis, selectedMetric }) {
  const criteria = pointAnalysis.data?.criteria ?? {
    energy: selectedMetric?.energyScore ?? 0,
    risk: selectedMetric?.riskScore ?? 0,
    land: selectedMetric?.landScore ?? 0,
    cooling: selectedMetric?.coolingScore ?? 0,
    access: selectedMetric?.accessScore ?? 52,
  };

  return (
    <dl className={cx('grid transition-[gap] duration-700', mode === 'tension' ? 'gap-2' : 'gap-3')}>
      <Signal icon={<Zap size={17} strokeWidth={1.3} />} label="Énergie bas carbone" mode={mode} value={`${Math.round(criteria.energy)}/100`} />
      <Signal icon={<Shield size={17} strokeWidth={1.3} />} label="Sismique & inondation" mode={mode} value={`${Math.round(criteria.risk)}/100`} />
      <Signal icon={<MapPin size={17} strokeWidth={1.3} />} label="Foncier & distance villes" mode={mode} value={`${Math.round(criteria.land)}/100`} />
      <Signal icon={<Snowflake size={17} strokeWidth={1.3} />} label="Refroidissement" mode={mode} value={`${Math.round(criteria.cooling)}/100`} />
      <Signal icon={<Route size={17} strokeWidth={1.3} />} label="Accès travailleurs" mode={mode} value={`${Math.round(criteria.access)}/100`} />
    </dl>
  );
}

function ActionPlan({ mode, pointAnalysis, selectedMetric }) {
  const criteria = pointAnalysis.data?.criteria ?? {
    access: selectedMetric?.accessScore ?? 52,
    cooling: selectedMetric?.coolingScore ?? 0,
    energy: selectedMetric?.energyScore ?? 0,
    land: selectedMetric?.landScore ?? 0,
    risk: selectedMetric?.riskScore ?? 0,
  };
  const weak = Object.entries(criteria).sort(([, a], [, b]) => a - b).slice(0, 3);
  const actions = weak.map(([key, value]) => buildAction(key, value, selectedMetric));

  return (
    <div className={cx('grid gap-3 border-t pt-5', mode === 'tension' ? 'border-black' : 'border-[#ddd6c4]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Prochaines vérifications</p>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">Top 3</span>
      </div>
      <div className="grid gap-2">
        {actions.map((action) => (
          <div
            key={action.label}
            className={cx('border p-3 text-sm leading-6', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{action.label}</span>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{Math.round(action.value)}/100</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-graphite">{action.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidencePanel({ energy, mode, pointAnalysis }) {
  const data = pointAnalysis.data;
  const rows = [
    ['Énergie', energy.source === 'live' ? 'ODRÉ + Eco2mix live' : 'Données locales de secours'],
    ['Risques', data ? 'Géorisques au point' : 'Pré-filtre départemental'],
    ['Température', data?.temperatureC != null ? 'Open-Meteo live' : 'En attente du clic'],
    ['Voirie', data?.roadLabel?.includes('OSM') ? 'OpenStreetMap' : data?.roadLabel?.includes('BAN') ? 'API Adresse' : 'En attente du clic'],
    ['Foncier', 'Surface GeoJSON + modèle prudent'],
  ];

  return (
    <div className={cx('grid gap-3 border-t pt-5', mode === 'tension' ? 'border-black' : 'border-[#ddd6c4]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Preuves utilisées</p>
        <Waves aria-hidden="true" size={16} strokeWidth={1.3} />
      </div>
      <div className="grid gap-2 text-sm leading-6">
        {rows.map(([label, value]) => (
          <FactRow key={label} label={label} value={value} />
        ))}
      </div>
      <p className="text-xs leading-5 text-graphite">
        Le score sert à prioriser une instruction technique. Il ne remplace pas les études réseau, PLU, foncier,
        sûreté et raccordement.
      </p>
    </div>
  );
}

function buildAction(key, value, selectedMetric) {
  const actions = {
    access: {
      label: CRITERIA_LABELS.access,
      text: 'Vérifier la route d’accès, la desserte transport et la capacité à recruter sans installer le site en cœur urbain.',
    },
    cooling: {
      label: CRITERIA_LABELS.cooling,
      text: 'Comparer la température annuelle, la disponibilité eau non conflictuelle et les solutions de free cooling.',
    },
    energy: {
      label: CRITERIA_LABELS.energy,
      text: `${formatMw((selectedMetric?.lowCarbonKw ?? 0) / 1000)} MW bas carbone identifiés. Vérifier le poste source et les délais de raccordement.`,
    },
    land: {
      label: CRITERIA_LABELS.land,
      text: 'Contrôler PLU, artificialisation, zones agricoles, emprise disponible et possibilité d’extension.',
    },
    risk: {
      label: CRITERIA_LABELS.risk,
      text: 'Lire les servitudes locales, PPRI, sismicité, retrait-gonflement et contraintes industrielles.',
    },
  };

  return { label: actions[key]?.label ?? key, text: actions[key]?.text ?? 'Critère à vérifier.', value };
}

function PointPanel({ analysisPoint, mode, pointAnalysis }) {
  const data = pointAnalysis.data;

  return (
    <div className={cx('grid gap-3 border-t pt-5', mode === 'tension' ? 'border-black' : 'border-[#ddd6c4]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Analyse au point</p>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">
          {pointAnalysis.status === 'loading' ? 'Live' : analysisPoint?.label ?? 'Attente'}
        </span>
      </div>
      <div className="grid gap-2 text-sm leading-6">
        <FactRow label="Coordonnées" value={analysisPoint ? `${analysisPoint.lat.toFixed(4)}, ${analysisPoint.lon.toFixed(4)}` : '—'} />
        <FactRow label="Commune" value={data?.commune ?? '—'} />
        <FactRow label="Écart ville" value={data?.townLabel ?? formatDistance(data?.nearestTownKm)} />
        <FactRow label="Accès voirie" value={data?.roadLabel ?? formatDistance(data?.nearestRoadKm)} />
        <FactRow label="Eau / rivière" value={formatDistance(data?.nearestWaterKm)} />
        <FactRow label="Température" value={data?.temperatureC != null ? `${formatDecimal(data.temperatureC)} °C` : '—'} />
        <FactRow label="Inondation" value={data?.floodLabel ?? '—'} />
        <FactRow label="Sismicité" value={data?.seismicLabel ?? '—'} />
      </div>
      {pointAnalysis.error && <p className="text-sm leading-6 text-black">{pointAnalysis.error}</p>}
    </div>
  );
}

function ScenarioPanel({ activeLayerId, mode, selectedLayer, selectedMetric, setActiveLayerId }) {
  const recommendations = [
    {
      id: 'energy',
      label: 'Sécuriser l’énergie',
      text: `${formatMw((selectedMetric?.lowCarbonKw ?? 0) / 1000)} MW bas carbone raccordés dans le département.`,
    },
    {
      id: 'risk',
      label: 'Écarter le risque',
      text: 'Cliquez précisément hors zones urbaines et laissez Géorisques qualifier le point.',
    },
    {
      id: 'cooling',
      label: 'Limiter le refroidissement',
      text: 'Croiser température locale, eau proche et absence de risque inondation.',
    },
  ];

  return (
    <div className={cx('grid gap-3 border-t pt-5', mode === 'tension' ? 'border-black' : 'border-[#ddd6c4]')}>
      <div>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Question active</p>
        <p className="mt-2 font-display text-3xl leading-none text-ink">{selectedLayer.question}</p>
      </div>
      <div className="grid gap-2">
        {recommendations.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveLayerId(item.id)}
            className={cx(
              'border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
              activeLayerId === item.id
                ? 'border-ink bg-ink text-white'
                : mode === 'tension'
                  ? 'border-black hover:bg-black hover:text-white'
                  : 'border-[#d8d0bd] hover:border-ink',
            )}
          >
            <span className="block text-sm">{item.label}</span>
            <span className="mt-1 block text-xs opacity-70">{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Signal({ icon, label, mode, value }) {
  return (
    <div
      className={cx(
        'grid grid-cols-[1fr_auto] items-end border transition-all duration-700',
        mode === 'tension' ? 'border-black p-3' : 'border-[#ded6c4] bg-white/35 p-4',
      )}
    >
      <dt className="flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.18em]">
        {mode !== 'tension' && icon}
        <span>{label}</span>
      </dt>
      <dd
        className={cx(
          'font-display leading-none tracking-normal',
          mode === 'tension' ? 'text-2xl font-light' : 'text-3xl font-normal text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function DepartmentSearch({ departments, mode, selectedCode, setSelectedCode }) {
  const ordered = [...departments].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <label className="grid gap-2">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Accès département</span>
      <select
        className={cx(
          'h-12 border bg-transparent px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
          mode === 'tension' ? 'border-black text-black' : 'border-[#d8d0bd] text-ink',
        )}
        onChange={(event) => setSelectedCode(event.target.value)}
        value={selectedCode}
      >
        {ordered.map((department) => (
          <option key={department.code} value={department.code}>
            {department.code} · {department.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function FactRow({ label, value }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4">
      <span>{label}</span>
      <span className="text-right font-mono text-[0.68rem] uppercase tracking-[0.16em]">{value}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-pewter">{label}</p>
      <p className="mt-2 font-display text-4xl leading-none text-ink">{value}</p>
    </div>
  );
}

function SourcePill({ source }) {
  return (
    <div
      className={cx(
        'inline-flex h-10 items-center gap-2 border px-3 font-mono text-[0.62rem] uppercase tracking-[0.18em]',
        source === 'live' ? 'border-[#b8a75e] text-[#685b25]' : 'border-black text-black',
      )}
    >
      {source === 'live' ? <Radio aria-hidden="true" size={14} /> : <Database aria-hidden="true" size={14} />}
      {source === 'live' ? 'Données live' : 'Mode dégradé'}
    </div>
  );
}

function SourceLinks({ mode }) {
  const links = [
    ['ODRÉ parc électrique', ENERGY_DATASET_LINK],
    ['Eco2mix temps réel', ECO2MIX_LINK],
    ['Géorisques', GEORISQUES_LINK],
    ['Open-Meteo', OPEN_METEO_LINK],
    ['OpenStreetMap', OVERPASS_LINK],
    ['GeoJSON France', GEOJSON_LINK],
  ];

  return (
    <div className={cx('flex flex-wrap gap-3 border-t pt-5', mode === 'tension' ? 'border-black' : 'border-[#ddd6c4]')}>
      {links.map(([label, href]) => (
        <a key={href} className="source-link" href={href} rel="noreferrer" target="_blank">
          {label}
          <ExternalLink aria-hidden="true" size={13} strokeWidth={1.4} />
        </a>
      ))}
    </div>
  );
}

function FallbackDepartmentList({ departments, mode, setSelectedCode }) {
  return (
    <div className="grid h-full content-center gap-3">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em]">Carte indisponible · liste de secours</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {departments.slice(0, 15).map((department) => (
          <button
            key={department.code}
            type="button"
            onClick={() => setSelectedCode(department.code)}
            className={cx(
              'border p-3 text-left text-sm transition',
              mode === 'tension' ? 'border-black hover:bg-black hover:text-white' : 'border-[#ded6c4] hover:border-ink',
            )}
          >
            {department.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function useEnergyData() {
  const [state, setState] = useState({
    departments: FALLBACK_DEPARTMENTS,
    error: null,
    geojson: null,
    realtime: FALLBACK_REALTIME,
    source: 'fallback',
    status: 'loading',
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [energyRows, realtimePayload, geojson] = await Promise.all([
          fetchPagedRecords(ENERGY_MIX_URL),
          fetchJson(ECO2MIX_URL),
          fetchJson(DEPARTMENTS_GEOJSON_URL),
        ]);
        const departments = normalizeEnergyRows(energyRows);
        const latest = realtimePayload.results?.[0];

        if (!departments.length || !latest || !geojson?.features?.length) {
          throw new Error('Réponse publique incomplète');
        }

        if (active) {
          setState({
            departments,
            error: null,
            geojson,
            realtime: {
              date: latest.date,
              heure: latest.heure,
              consommation: latest.consommation,
              solaire: latest.solaire,
              tauxCo2: latest.taux_co2,
            },
            source: 'live',
            status: 'ready',
          });
        }
      } catch (error) {
        try {
          const geojson = await fetchJson(DEPARTMENTS_GEOJSON_URL);
          if (active) {
            setState((current) => ({
              ...current,
              error: error.message,
              geojson,
              source: 'fallback',
              status: 'fallback',
            }));
          }
        } catch {
          if (active) {
            setState((current) => ({
              ...current,
              error: error.message,
              source: 'fallback',
              status: 'fallback',
            }));
          }
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

function usePointAnalysis(point, selectedMetric, selectedProfile, realtime) {
  const [state, setState] = useState({ data: null, error: null, status: 'idle' });

  useEffect(() => {
    if (!point || !selectedMetric) return undefined;
    const controller = new AbortController();

    async function load() {
      setState((current) => ({ ...current, error: null, status: 'loading' }));
      try {
        const [riskResult, weatherResult, communeResult, addressResult, osmResult] = await Promise.allSettled([
          fetchJson(buildGeorisquesUrl(point), controller.signal),
          fetchJson(buildWeatherUrl(point), controller.signal),
          fetchJson(buildCommuneUrl(point), controller.signal),
          fetchJson(buildAddressUrl(point), controller.signal),
          withTimeout(fetchJson(buildOverpassUrl(point), controller.signal), 4200, 'OSM timeout'),
        ]);

        if (controller.signal.aborted) return;

        const analysis = buildPointAnalysis({
          commune: communeResult.status === 'fulfilled' ? communeResult.value : null,
          address: addressResult.status === 'fulfilled' ? addressResult.value : null,
          metric: selectedMetric,
          osm: osmResult.status === 'fulfilled' ? osmResult.value : null,
          point,
          profile: selectedProfile,
          risk: riskResult.status === 'fulfilled' ? riskResult.value : null,
          realtime,
          weather: weatherResult.status === 'fulfilled' ? weatherResult.value : null,
        });

        setState({
          data: analysis,
          error: riskResult.status === 'rejected' ? 'Géorisques indisponible pour ce point.' : null,
          status: 'ready',
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            data: buildPointAnalysis({
              address: null,
              commune: null,
              metric: selectedMetric,
              osm: null,
              point,
              profile: selectedProfile,
              risk: null,
              realtime,
              weather: null,
            }),
            error: error.message,
            status: 'fallback',
          });
        }
      }
    }

    load();
    return () => controller.abort();
  }, [point, selectedMetric, selectedProfile, realtime]);

  return state;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Source indisponible (${response.status})`);
  return response.json();
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

async function fetchPagedRecords(baseUrl) {
  const records = [];
  const pageSize = 100;

  for (let offset = 0; offset < 1200; offset += pageSize) {
    const payload = await fetchJson(`${baseUrl}&limit=${pageSize}&offset=${offset}`);
    records.push(...(payload.results ?? []));
    if ((payload.results ?? []).length < pageSize) break;
  }

  return records;
}

function normalizeEnergyRows(rows) {
  const byCode = new Map();

  rows.forEach((row) => {
    const code = String(row.codedepartement ?? '');
    if (!code) return;

    const current =
      byCode.get(code) ??
      {
        capacities: {},
        code,
        name: row.departement ?? 'Département',
        sitesByFiliere: {},
      };

    current.capacities[row.filiere] = Number(row.capacity_kw ?? 0);
    current.sitesByFiliere[row.filiere] = Number(row.sites ?? 0);
    byCode.set(code, current);
  });

  return [...byCode.values()];
}

function buildDepartmentModel(departments, geojson, selectedProfile = PROFILE_PRESETS[0], realtime = FALLBACK_REALTIME) {
  if (!geojson?.features?.length) {
    const fallbackItems = departments.map((department) => buildBareMetric(department, selectedProfile));
    return {
      byCode: new Map(fallbackItems.map((department) => [department.code, department])),
      features: [],
      items: fallbackItems,
      maxByLayer: {},
      projection: null,
    };
  }

  const projection = geoMercator().fitExtent(
    [
      [MAP_BOUNDS.padX, MAP_BOUNDS.padY],
      [MAP_BOUNDS.width - MAP_BOUNDS.padX, MAP_BOUNDS.height - MAP_BOUNDS.padY],
    ],
    geojson,
  );
  const pathGenerator = geoPath(projection);
  const dataByCode = new Map(departments.map((department) => [department.code, department]));

  const features = geojson.features
    .map((feature) => {
      const code = String(feature.properties?.code ?? '');
      const name = feature.properties?.nom ?? dataByCode.get(code)?.name ?? 'Département';
      const path = pathGenerator(feature);
      const [[minX, minY], [maxX, maxY]] = pathGenerator.bounds(feature);
      const centroid = geoCentroid(feature);
      const areaKm2 = geoArea(feature) * EARTH_RADIUS_KM * EARTH_RADIUS_KM;

      if (!code || !path) return null;

      return {
        areaKm2,
        bounds: { maxX, maxY, minX, minY },
        centroid,
        code,
        feature,
        name,
        path,
      };
    })
    .filter(Boolean);

  const rawMetrics = features.map((feature) => {
    const department = dataByCode.get(feature.code) ?? {
      capacities: {},
      code: feature.code,
      name: feature.name,
      sitesByFiliere: {},
    };

    const capacities = department.capacities ?? {};
    const sitesByFiliere = department.sitesByFiliere ?? {};
    const lowCarbonKw = LOW_CARBON_FILIERES.reduce((sum, filiere) => sum + Number(capacities[filiere] ?? 0), 0);
    const renewableKw = LOW_CARBON_FILIERES.filter((filiere) => filiere !== 'Nucléaire').reduce(
      (sum, filiere) => sum + Number(capacities[filiere] ?? 0),
      0,
    );
    const nuclearKw = Number(capacities.Nucléaire ?? 0);
    const thermalKw = Number(capacities['Thermique non renouvelable'] ?? 0);
    const storageKw = Number(capacities['Stockage non hydraulique'] ?? 0);
    const solarKw = Number(capacities.Solaire ?? 0);
    const hydroKw = Number(capacities.Hydraulique ?? 0);
    const totalSites = Object.values(sitesByFiliere).reduce((sum, value) => sum + Number(value ?? 0), 0);
    const latitude = feature.centroid?.[1] ?? 46.7;
    const longitude = feature.centroid?.[0] ?? 2.4;

    return {
      ...department,
      areaKm2: feature.areaKm2,
      centroid: feature.centroid,
      feature,
      hydroKw,
      latitude,
      longitude,
      lowCarbonKw,
      nuclearKw,
      renewableKw,
      riskScore: estimateGeoRiskScore(longitude, latitude),
      solarKw,
      storageKw,
      thermalKw,
      totalSites,
    };
  });

  const maxLowCarbon = Math.max(...rawMetrics.map((item) => Math.log1p(item.lowCarbonKw)), 1);
  const maxArea = Math.max(...rawMetrics.map((item) => Math.sqrt(item.areaKm2)), 1);
  const maxHydro = Math.max(...rawMetrics.map((item) => Math.log1p(item.hydroKw)), 1);
  const maxSites = Math.max(...rawMetrics.map((item) => Math.log1p(item.totalSites)), 1);
  const maxStorage = Math.max(...rawMetrics.map((item) => Math.log1p(item.storageKw)), 1);
  const liveGridScore = buildLiveGridScore(realtime);

  const items = rawMetrics.map((item) => {
    const lowCarbonShare = item.lowCarbonKw / Math.max(item.lowCarbonKw + item.thermalKw, 1);
    const structuralEnergyScore = clamp(
      (Math.log1p(item.lowCarbonKw) / maxLowCarbon) * 70 + lowCarbonShare * 20 + (Math.log1p(item.storageKw) / maxStorage) * 10,
      0,
      100,
    );
    const energyScore = clamp(structuralEnergyScore * 0.84 + liveGridScore * 0.16, 0, 100);
    const landScore = clamp((Math.sqrt(item.areaKm2) / maxArea) * 82 + (1 - clamp(item.totalSites / 6000, 0, 1)) * 18, 0, 100);
    const latitudeCooling = clamp((item.latitude - 42.4) / 8.2, 0, 1);
    const coolingScore = clamp(latitudeCooling * 54 + (Math.log1p(item.hydroKw) / maxHydro) * 32 + lowCarbonShare * 14, 0, 100);
    const gridScore = clamp((energyScore * 0.75 + (Math.log1p(item.nuclearKw + item.hydroKw) / maxLowCarbon) * 25), 0, 100);
    const accessScore = clamp(
      48 + (Math.log1p(item.totalSites) / maxSites) * 24 + (gridScore / 100) * 16 - (Math.sqrt(item.areaKm2) / maxArea) * 10,
      0,
      100,
    );
    const criteria = { access: accessScore, cooling: coolingScore, energy: energyScore, land: landScore, risk: item.riskScore };
    const datacenterScore = scoreCriteria(criteria, selectedProfile);

    return {
      ...item,
      accessScore,
      coolingScore,
      datacenterScore,
      energyScore,
      gridScore,
      landScore,
    };
  });

  addRanks(items, ['datacenterScore', 'energyScore', 'landScore', 'coolingScore', 'accessScore', 'riskScore']);

  return {
    byCode: new Map(items.map((item) => [item.code, item])),
    features,
    items,
    maxByLayer: {
      cooling: 100,
      energy: 100,
      land: 100,
      access: 100,
      risk: 100,
      score: 100,
    },
    projection,
  };
}

function buildBareMetric(department, selectedProfile = PROFILE_PRESETS[0]) {
  const criteria = {
    access: 52,
    cooling: 45,
    energy: 45,
    land: 45,
    risk: 45,
  };
  return {
    ...department,
    accessScore: criteria.access,
    coolingScore: criteria.cooling,
    datacenterScore: scoreCriteria(criteria, selectedProfile),
    energyScore: criteria.energy,
    landScore: criteria.land,
    lowCarbonKw: LOW_CARBON_FILIERES.reduce((sum, filiere) => sum + Number(department.capacities?.[filiere] ?? 0), 0),
    riskScore: criteria.risk,
  };
}

function addRanks(items, keys) {
  keys.forEach((key) => {
    [...items]
      .sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0))
      .forEach((item, index) => {
        item.ranks = { ...(item.ranks ?? {}), [key]: index + 1 };
      });
  });
}

function scoreCriteria(criteria, profile = PROFILE_PRESETS[0]) {
  const weights = profile.weights ?? PROFILE_PRESETS[0].weights;
  return Math.round(
    Object.entries(weights).reduce((score, [key, weight]) => score + Number(criteria[key] ?? 0) * weight, 0),
  );
}

function buildLiveGridScore(realtime = FALLBACK_REALTIME) {
  const solarShare = realtime.solaire / Math.max(realtime.consommation, 1);
  const carbonScore = clamp(100 - Number(realtime.tauxCo2 ?? 80) * 0.9, 0, 100);
  const solarScore = clamp(solarShare / 0.32, 0, 1) * 100;
  return clamp(carbonScore * 0.72 + solarScore * 0.28, 0, 100);
}

function buildPointAnalysis({ address, commune, metric, osm, point, profile = PROFILE_PRESETS[0], realtime = FALLBACK_REALTIME, risk, weather }) {
  const osmSignals = parseOsmSignals(osm, point);
  const addressDistanceKm = Number(address?.features?.[0]?.properties?.distance ?? NaN) / 1000;
  const communePopulation = Number(commune?.[0]?.population ?? 0);
  const inferredTownKm =
    osmSignals.nearestTownKm ??
    (communePopulation > 100000 ? 0 : communePopulation > 30000 ? 5 : communePopulation > 8000 ? 10 : 15);
  const inferredRoadKm = osmSignals.nearestRoadKm ?? (Number.isFinite(addressDistanceKm) ? addressDistanceKm : null);
  const riskSignals = parseRiskSignals(risk);
  const temperatureC = weather?.current?.temperature_2m ?? null;
  const communeName = commune?.[0]?.nom ?? risk?.commune?.libelle ?? null;
  const coolingTemperatureScore = temperatureC == null ? 58 : clamp(100 - Math.max(temperatureC - 12, 0) * 4, 12, 100);
  const waterScore = distanceBandScore(osmSignals.nearestWaterKm, [
    [0.2, 30],
    [2, 92],
    [8, 82],
    [18, 54],
    [Infinity, 30],
  ]);
  const cooling = clamp(coolingTemperatureScore * 0.62 + waterScore * 0.38, 0, 100);
  const townScore = distanceBandScore(inferredTownKm, [
    [4, 24],
    [9, 62],
    [18, 96],
    [35, 78],
    [Infinity, 44],
  ]);
  const roadScore = distanceBandScore(inferredRoadKm, [
    [0.5, 52],
    [4, 96],
    [10, 84],
    [18, 56],
    [Infinity, 28],
  ]);
  const land = clamp(metric.landScore * 0.45 + townScore * 0.55, 0, 100);
  const riskScore = clamp(riskSignals.seismicScore * 0.42 + riskSignals.floodScore * 0.46 + riskSignals.groundScore * 0.12, 0, 100);
  const access = clamp(roadScore * 0.72 + townScore * 0.28, 0, 100);
  const energy = clamp(metric.energyScore * 0.84 + buildLiveGridScore(realtime) * 0.16, 0, 100);
  const criteria = {
    access,
    cooling,
    energy,
    land,
    risk: riskScore,
  };
  const score = scoreCriteria(criteria, profile);
  const summary =
    score >= 78
      ? 'Le point combine un signal énergétique solide, des contraintes acceptables et un accès exploitable.'
      : score >= 58
        ? 'Le point mérite une étude, mais au moins un critère doit être vérifié avant d’avancer.'
        : 'Le point présente trop de friction pour être défendu sans étude technique approfondie.';

  return {
    commune: communeName ?? 'Non identifié',
    criteria,
    floodLabel: riskSignals.floodLabel,
    nearestRoadKm: inferredRoadKm,
    nearestTownKm: inferredTownKm,
    nearestWaterKm: osmSignals.nearestWaterKm,
    roadLabel: inferredRoadKm == null ? '—' : `${formatDistance(inferredRoadKm)} · ${osmSignals.nearestRoadKm == null ? 'BAN' : 'OSM'}`,
    score,
    seismicLabel: riskSignals.seismicLabel,
    summary,
    temperatureC,
    townLabel:
      osmSignals.nearestTownKm == null && communePopulation
        ? `${formatDistance(inferredTownKm)} · ${formatNumber(communePopulation)} hab.`
        : formatDistance(inferredTownKm),
  };
}

function parseRiskSignals(risk) {
  const natural = risk?.risquesNaturels ?? {};
  const flood = natural.inondation;
  const seismic = natural.seisme;
  const clay = natural.retraitGonflementArgile;
  const movement = natural.mouvementTerrain;
  const floodStatus = flood?.libelleStatutAdresse ?? flood?.libelleStatutCommune ?? '';
  const seismicStatus = seismic?.libelleStatutAdresse ?? seismic?.libelleStatutCommune ?? '';
  const groundStatus = `${clay?.libelleStatutAdresse ?? ''} ${movement?.libelleStatutAdresse ?? ''}`;

  return {
    floodLabel: floodStatus || 'Non connu',
    floodScore: floodStatus.includes('Existant') ? 36 : 88,
    groundScore: scoreRiskText(groundStatus),
    seismicLabel: seismicStatus || 'Non connu',
    seismicScore: scoreRiskText(seismicStatus),
  };
}

function scoreRiskText(text) {
  const value = text.toLowerCase();
  if (!value || value.includes('non connu') || value.includes('inconnu')) return 64;
  if (value.includes('important') || value.includes('moyen') || value.includes('fort')) return 28;
  if (value.includes('modéré') || value.includes('modere')) return 54;
  if (value.includes('très faible') || value.includes('tres faible')) return 94;
  if (value.includes('faible')) return 82;
  if (value.includes('existant')) return 52;
  return 72;
}

function parseOsmSignals(osm, point) {
  const elements = osm?.elements ?? [];
  const roads = [];
  const towns = [];
  const waters = [];

  elements.forEach((element) => {
    const location = element.center ?? (element.lat && element.lon ? { lat: element.lat, lon: element.lon } : null);
    if (!location) return;

    const distance = distanceKm(point, location);
    if (element.tags?.highway) roads.push(distance);
    if (element.tags?.place) towns.push(distance);
    if (element.tags?.waterway || element.tags?.natural === 'water' || element.tags?.water) waters.push(distance);
  });

  return {
    nearestRoadKm: roads.length ? Math.min(...roads) : null,
    nearestTownKm: towns.length ? Math.min(...towns) : null,
    nearestWaterKm: waters.length ? Math.min(...waters) : null,
  };
}

function getZoomTransform(bounds, isZoomed) {
  if (!bounds || !isZoomed) {
    return { centerX: MAP_BOUNDS.width / 2, centerY: MAP_BOUNDS.height / 2, scale: 1, value: 'translate(0 0) scale(1)' };
  }

  const width = Math.max(bounds.maxX - bounds.minX, 18);
  const height = Math.max(bounds.maxY - bounds.minY, 18);
  const scale = clamp(Math.min(MAP_BOUNDS.width / (width * 1.18), MAP_BOUNDS.height / (height * 1.18)), 3.8, 11);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    centerX,
    centerY,
    scale,
    value: `translate(${MAP_BOUNDS.width / 2} ${MAP_BOUNDS.height / 2}) scale(${scale}) translate(${-centerX} ${-centerY})`,
  };
}

function departmentFill(metric, layerId, mode, isSelected) {
  if (mode === 'tension') return isSelected ? '#000000' : '#ffffff';
  if (!metric) return '#fbfaf5';
  if (isSelected) return '#e4c94e';

  const ratio = clamp(layerValue(metric, layerId) / 100, 0, 1);
  const hue = layerId === 'risk' ? 92 : layerId === 'cooling' ? 192 : layerId === 'access' ? 28 : layerId === 'land' ? 72 : 46;
  const saturation = 42 + ratio * 30;
  const lightness = 92 - ratio * 34;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function layerValue(metric, layerId) {
  if (!metric) return 0;
  if (layerId === 'energy') return metric.energyScore ?? 0;
  if (layerId === 'land') return metric.landScore ?? 0;
  if (layerId === 'cooling') return metric.coolingScore ?? 0;
  if (layerId === 'access') return metric.accessScore ?? 0;
  if (layerId === 'risk') return metric.riskScore ?? 0;
  return metric.datacenterScore ?? 0;
}

function estimateGeoRiskScore(lon, lat) {
  const pyrenees = lat < 43.7 && lon > -1.8 && lon < 3.4;
  const alps = lon > 5.0 && lat > 43.4 && lat < 46.6;
  const alsace = lon > 6.5 && lat > 47.2;
  const antilles = lon < -50;
  if (antilles) return 24;
  if (pyrenees || alps) return 58;
  if (alsace) return 62;
  return 84;
}

function buildGeorisquesUrl(point) {
  return `https://www.georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=${point.lon},${point.lat}`;
}

function buildWeatherUrl(point) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lon}&current=temperature_2m&timezone=auto`;
}

function buildCommuneUrl(point) {
  return `https://geo.api.gouv.fr/communes?lat=${point.lat}&lon=${point.lon}&fields=nom,population,centre&format=json&geometry=centre`;
}

function buildAddressUrl(point) {
  return `https://api-adresse.data.gouv.fr/reverse/?lon=${point.lon}&lat=${point.lat}&limit=1`;
}

function buildOverpassUrl(point) {
  const query = `[out:json][timeout:12];(way(around:15000,${point.lat},${point.lon})["highway"~"motorway|trunk|primary|secondary"];node(around:18000,${point.lat},${point.lon})["place"~"city|town"];way(around:9000,${point.lat},${point.lon})["waterway"~"river|canal"];way(around:9000,${point.lat},${point.lon})["natural"="water"];relation(around:9000,${point.lat},${point.lon})["natural"="water"];);out center tags;`;
  return `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
}

function distanceBandScore(distance, bands) {
  if (distance == null) return 50;
  return bands.find(([max]) => distance <= max)?.[1] ?? 50;
}

function distanceKm(a, b) {
  const lat1 = degreesToRadians(a.lat);
  const lat2 = degreesToRadians(b.lat);
  const deltaLat = degreesToRadians(b.lat - a.lat);
  const deltaLon = degreesToRadians(b.lon - a.lon);
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value ?? 0));
}

function formatDecimal(value) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value ?? 0);
}

function formatDistance(value) {
  if (value == null) return '—';
  if (value < 1) return `${Math.round(value * 1000)} m`;
  return `${formatDecimal(value)} km`;
}

function formatMw(value) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value ?? 0));
}

const rootElement = document.getElementById('root');
const root = globalThis.__prismeRoot ?? createRoot(rootElement);
globalThis.__prismeRoot = root;
root.render(<App />);
