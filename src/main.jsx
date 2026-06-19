import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { geoArea, geoCentroid, geoContains, geoMercator, geoPath } from 'd3-geo';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileText,
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
import gridCapacity from './data/gridCapacity.json';
import landPrices from './data/landPrices.json';
import { INDICE_PAGE_BY_ID, INDICE_PAGES } from './data/indices.js';
import { buildColossusScenarioSummary, getColossusScenario } from './data/colossusScenarios.js';
import {
  coolingScore as scoreTerrainCooling,
  fetchTerrain,
  landScore as scoreTerrainLand,
} from './data/sources.js';

const APP_NAME = 'PrismCenter';
const APP_TAGLINE = "Localisateur d'opportunité de datacenter";

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
const RTE_SUBSTATIONS_LINK = 'https://odre.opendatasoft.com/explore/dataset/postes-electriques-rte/information/';
const CAPARESEAU_LINK =
  'https://www.services-rte.com/fr/decouvrez-nos-offres-de-services/consulter-les-capacites-d-accueil-du-reseau-capareseau.html';
const DVF_LINK = 'https://files.data.gouv.fr/geo-dvf/';
const HUBEAU_LINK = 'https://hubeau.eaufrance.fr/';
const VIGIEAU_LINK = 'https://vigieau.gouv.fr/';
const API_ADRESSE_LINK = 'https://adresse.data.gouv.fr/api-doc/adresse';
const RYVEXAM_LINK = 'https://ryvexam.fr';
const RYVEWEB_LINK = 'https://ryveweb.fr';

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
    id: 'energy',
    label: 'Énergie bas carbone',
    question: 'Où la puissance raccordée est-elle déjà forte ?',
    description: 'ODRÉ distingue bas carbone, nucléaire, renouvelables et stockage; Eco2mix ajoute le signal réseau live.',
  },
  {
    id: 'grid',
    label: 'Raccordement',
    question: 'Où l’accès réseau est-il crédible ?',
    description: 'Inventaire RTE des postes de transformation par département, niveaux de tension et compatibilité de puissance.',
  },
  {
    id: 'score',
    label: 'Score IA',
    question: 'Où regarder en premier ?',
    description: 'Pré-score départemental pour un datacenter IA, avant analyse fine du site.',
  },
  {
    id: 'land',
    label: 'Foncier',
    question: 'Où existe-t-il une marge spatiale ?',
    description: 'Surface GeoJSON, densité d’installations et cible locale de 10-15 km des villes.',
  },
  {
    id: 'cooling',
    label: 'Refroidissement',
    question: 'Où le froid naturel aide-t-il ?',
    description: 'Latitude, hydraulique raccordée et signaux locaux eau/température au clic.',
  },
  {
    id: 'access',
    label: 'Route & équipes',
    question: 'Où l’accès humain reste-t-il crédible ?',
    description: 'Pré-signal territorial, affiné au clic par la voirie OSM/BAN et l’écart aux bassins de travailleurs.',
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
];

const SCENARIO_POWER_MIN_MW = 30;
const SCENARIO_POWER_MAX_MW = 2_000;
const SCENARIO_POWER_STEP_MW = 10;

const CRITERIA_LABELS = {
  access: 'Accès travailleurs',
  cooling: 'Refroidissement',
  energy: 'Énergie bas carbone',
  grid: 'Raccordement électrique',
  land: 'Foncier & ville 10-15 km',
  risk: 'Sismique & inondation',
};

const TOWN_TARGET_KM = {
  idealMin: 10,
  idealMax: 15,
  workableMax: 28,
};

const ROAD_TARGET_KM = {
  idealMin: 0.5,
  idealMax: 4,
  workableMax: 12,
};

const LEGAL_PAGES = {
  legal: {
    eyebrow: 'Cadre public',
    title: 'Mentions légales',
    intro:
      "PrismCenter est un prototype de hackathon. L'application agrège des sources publiques pour prioriser une instruction territoriale, sans se substituer aux études administratives, foncières, électriques ou environnementales.",
    sections: [
      {
        title: 'Éditeur',
        body:
          "Prototype expérimental PrismCenter. Les informations d'éditeur, d'hébergement et de contact doivent être complétées avant toute mise en ligne publique nominative.",
      },
      {
        title: 'Sources',
        body:
          "Les données proviennent notamment d'ODRÉ, Eco2mix, Géorisques, Open-Meteo, Hub'Eau, VigiEau, DVF, API Adresse, OpenStreetMap et france-geojson. Les liens sources sont exposés dans l'atlas.",
      },
      {
        title: 'Responsabilité',
        body:
          "Les scores sont des estimations de priorisation. Ils ne constituent pas une décision d'implantation, une étude de raccordement, une analyse PLU, une due diligence foncière ou un avis réglementaire.",
      },
    ],
  },
  terms: {
    eyebrow: 'Conditions prototype',
    title: "Conditions d'utilisation",
    intro:
      "L'utilisation de PrismCenter implique de lire les résultats comme une aide à l'exploration. Toute décision opérationnelle doit être confirmée par les autorités, opérateurs réseau, bureaux d'études et conseils compétents.",
    sections: [
      {
        title: 'Usage autorisé',
        body:
          "Le prototype peut être utilisé pour comparer des territoires, préparer une liste courte et identifier les points nécessitant une instruction approfondie.",
      },
      {
        title: 'Limites',
        body:
          "Les appels aux API publiques peuvent échouer, être incomplets ou évoluer. L'application prévoit des fallbacks, mais ne garantit ni exhaustivité, ni disponibilité continue, ni exactitude juridique.",
      },
      {
        title: 'Données personnelles',
        body:
          "Le prototype ne demande pas de compte utilisateur et ne stocke pas de données personnelles côté application. Les fournisseurs de données et l'hébergeur peuvent toutefois traiter des logs techniques.",
      },
    ],
  },
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

const INITIAL_FETCH_TIMEOUT_MS = 7000;
const POINT_FETCH_TIMEOUT_MS = 4000;
const EARTH_RADIUS_KM = 6371;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const cx = (...classes) => classes.filter(Boolean).join(' ');

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === 'studio') return { id: null, view: 'studio' };
  if (hash === 'legal') return { id: 'legal', view: 'legal' };
  if (hash === 'terms') return { id: 'terms', view: 'legal' };
  if (hash.startsWith('indice/')) {
    const id = decodeURIComponent(hash.replace('indice/', ''));
    return { id: INDICE_PAGE_BY_ID[id] ? id : 'score', view: 'indice' };
  }
  return { id: null, view: 'landing' };
}

function App() {
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    const syncViewWithHash = () => {
      setRoute(parseRoute());
    };

    syncViewWithHash();
    window.addEventListener('hashchange', syncViewWithHash);
    return () => window.removeEventListener('hashchange', syncViewWithHash);
  }, []);

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
  }, [route.id, route.view]);

  const openStudio = () => {
    window.history.replaceState(null, '', '#studio');
    setRoute({ id: null, view: 'studio' });
  };

  const openLanding = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setRoute({ id: null, view: 'landing' });
  };

  const openIndice = (id) => {
    const nextId = INDICE_PAGE_BY_ID[id] ? id : 'score';
    window.history.replaceState(null, '', `#indice/${nextId}`);
    setRoute({ id: nextId, view: 'indice' });
  };

  const openLegal = (id) => {
    const nextId = id === 'terms' ? 'terms' : 'legal';
    window.history.replaceState(null, '', `#${nextId}`);
    setRoute({ id: nextId, view: 'legal' });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-porcelain text-ink antialiased selection:bg-ink selection:text-white">
        <AnimatePresence mode="wait">
          {route.view === 'landing' ? (
            <Landing key="landing" onStart={openStudio} />
          ) : route.view === 'indice' ? (
            <IndicePage key={`indice-${route.id}`} id={route.id} onBack={openStudio} onHome={openLanding} onOpenIndice={openIndice} />
          ) : route.view === 'legal' ? (
            <LegalPage key={`legal-${route.id}`} id={route.id} onBack={openStudio} onHome={openLanding} onOpenLegal={openLegal} />
          ) : (
            <Studio key="studio" onBack={openLanding} onOpenIndice={openIndice} onOpenLegal={openLegal} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function Landing({ onStart }) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.main
      className="landing-canvas min-h-screen px-5 py-6 sm:px-8 md:px-16 md:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-50 flex items-center justify-center bg-porcelain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.p
              className="font-display text-[clamp(2.4rem,8vw,6rem)] leading-none text-ink"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              MERCI OPENAI <span className="text-[#e25555]">❤️</span>
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <Header />
      <section className="mx-auto grid min-h-[calc(100svh-12rem)] max-w-[94rem] items-center gap-10 pb-10 sm:gap-12 xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.62fr)] xl:gap-16 xl:pb-0">
        <div className="max-w-6xl">
          <p className="mb-7 font-mono text-[0.68rem] uppercase tracking-[0.24em] text-pewter">
            {APP_TAGLINE}
          </p>
          <p className="mb-5 font-mono text-[0.58rem] uppercase tracking-[0.22em] text-graphite">
            Contexte hackathon Defend Intelligence · prototype indépendant
          </p>
          <h1 className="max-w-6xl font-display text-[clamp(2.85rem,12vw,8.3rem)] font-normal leading-[0.86] tracking-normal text-ink">
            Où poser un datacenter IA,
            <span className="block italic text-graphite">sans aveugler le territoire.</span>
          </h1>
          <div className="mt-10 grid max-w-5xl gap-8 md:grid-cols-[0.82fr_1fr] md:items-end">
            <p className="text-lg font-light leading-8 text-graphite md:text-xl md:leading-9">
            {APP_NAME} croise la puissance électrique bas carbone, le raccordement et les contraintes territoriales
            pour des scénarios de 30 MW à 2 GW. Le scénario par défaut simule un campus de 300 MW
            proche de l’ordre de grandeur de Colossus 1.
            </p>
            <button
              type="button"
              onClick={onStart}
              className="primary-cta inline-flex min-h-14 w-fit items-center gap-4 border border-ink bg-ink px-7 text-sm font-medium uppercase tracking-[0.16em] text-white transition duration-300 hover:bg-transparent hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-porcelain md:justify-self-end"
            >
              Ouvrir l’atlas
              <ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <LandingPreview />
      </section>
      <SiteFooter />
    </motion.main>
  );
}


function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-[94rem] flex-col gap-3 border-t border-[#ddd6c4] pt-5 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-pewter sm:flex-row sm:items-center sm:justify-between">
      <span>Créé par Ryvexam</span>
      <nav className="flex flex-wrap gap-3" aria-label="Sites de Ryvexam">
        <a className="source-link" href={RYVEXAM_LINK} rel="noreferrer" target="_blank">
          Ryvexam.fr
          <ExternalLink aria-hidden="true" size={13} strokeWidth={1.4} />
        </a>
        <a className="source-link" href={RYVEWEB_LINK} rel="noreferrer" target="_blank">
          Ryveweb.fr
          <ExternalLink aria-hidden="true" size={13} strokeWidth={1.4} />
        </a>
      </nav>
    </footer>
  );
}

function LandingPreview() {
  const rows = [
    ['Énergie bas carbone', '92'],
    ['Raccordement RTE', '88'],
    ['Foncier utile', '71'],
    ['Risque naturel', '84'],
  ];

  return (
    <aside className="landing-preview" aria-label={`Aperçu éditorial de l’atlas ${APP_NAME}`}>
      <div className="landing-preview__plate">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">Lecture territoriale</p>
            <p className="mt-3 font-display text-5xl leading-none text-ink">86</p>
          </div>
          <MapPin aria-hidden="true" className="mt-1 text-ink" size={24} strokeWidth={1.2} />
        </div>
        <div className="landing-preview__map" aria-hidden="true">
          <span className="landing-preview__pin landing-preview__pin--a" />
          <span className="landing-preview__pin landing-preview__pin--b" />
          <span className="landing-preview__pin landing-preview__pin--c" />
        </div>
        <div className="grid gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="landing-preview__row">
              <span>{label}</span>
              <span>{value}/100</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Header({ backLabel = 'Retour', compact = false, onBack, onBrandClick }) {
  const brandClasses =
    'font-display text-2xl text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4';
  const brandAction = onBrandClick ?? onBack;

  return (
    <header className={cx('flex items-center justify-between', compact ? 'mb-4' : 'mb-8')}>
      {brandAction ? (
        <button type="button" onClick={brandAction} className={cx(brandClasses, 'cursor-pointer')} aria-label="Retour au manifeste">
          {APP_NAME}
        </button>
      ) : (
        <span className={cx(brandClasses, 'cursor-default')}>{APP_NAME}</span>
      )}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-10 items-center justify-center border border-ink text-ink transition hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4"
          aria-label={backLabel}
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.4} />
        </button>
      )}
    </header>
  );
}

function IndicePage({ id, onBack, onHome, onOpenIndice }) {
  const page = INDICE_PAGE_BY_ID[id] ?? INDICE_PAGE_BY_ID.score;

  return (
    <motion.main
      className="method-canvas min-h-screen px-5 py-6 sm:px-8 md:px-16 md:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Header backLabel="Retour à l’atlas" onBack={onBack} onBrandClick={onHome} />

      <article className="method-shell mx-auto grid max-w-[94rem] gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(22rem,0.22fr)] lg:gap-14">
        <div className="min-w-0">
          <section className="method-hero border-b pb-10">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-pewter">
              {APP_NAME} · méthode
            </p>
            <h1 className="mt-6 max-w-5xl font-display text-[clamp(3rem,7.5vw,7.4rem)] font-normal leading-[0.86] tracking-normal text-ink">
              {page.title}
            </h1>
            <p className="mt-8 max-w-4xl text-lg font-light leading-8 text-graphite md:text-xl md:leading-9">
              {page.question}
            </p>
            <p className="mt-6 max-w-4xl text-base leading-7 text-graphite">
              {page.scoreMeaning}
            </p>
          </section>

          <section className="method-section">
            <div className="method-section__label">Calcul</div>
            <div className="method-rule-list">
              {page.formulaSteps.map((step, index) => (
                <div key={step} className="method-rule-row">
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-pewter">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="method-section">
            <div className="method-section__label">Données</div>
            <div className="method-source-list">
              {page.dataSources.map((source) => (
                <a key={`${page.id}-${source.name}`} className="method-source-row" href={source.link} rel="noreferrer" target="_blank">
                  <span className="method-source-row__title">
                    {source.name}
                    <ExternalLink aria-hidden="true" size={14} strokeWidth={1.4} />
                  </span>
                  <span>{source.usage}</span>
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-pewter">{source.freshness}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="method-section">
            <div className="method-section__label">Limites</div>
            <div className="grid gap-3">
              {page.limitations.map((limitation) => (
                <p key={limitation} className="method-limitation">
                  {limitation}
                </p>
              ))}
            </div>
          </section>

          <section className="method-section method-section--closing">
            <div className="method-section__label">Utilité</div>
            <p className="max-w-4xl font-display text-3xl leading-tight text-ink md:text-5xl">
              {page.whyItMatters}
            </p>
            <button
              type="button"
              onClick={onBack}
              className="primary-cta mt-8 inline-flex min-h-12 w-fit items-center gap-3 border border-ink bg-ink px-5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white transition duration-300 hover:bg-transparent hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4"
            >
              Retour à l’atlas
              <ArrowRight aria-hidden="true" size={15} strokeWidth={1.4} />
            </button>
          </section>
        </div>

        <aside className="method-nav">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">Indices</p>
          <div className="mt-4 grid gap-2">
            {INDICE_PAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={item.id === page.id ? 'page' : undefined}
                onClick={() => onOpenIndice(item.id)}
                className={cx('method-nav__item', item.id === page.id && 'method-nav__item--active')}
              >
                <span>{item.shortLabel}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>
      </article>
    </motion.main>
  );
}

function LegalPage({ id, onBack, onHome, onOpenLegal }) {
  const page = LEGAL_PAGES[id] ?? LEGAL_PAGES.legal;

  return (
    <motion.main
      className="method-canvas min-h-screen px-5 py-6 sm:px-8 md:px-16 md:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Header backLabel="Retour à l’atlas" onBack={onBack} onBrandClick={onHome} />

      <article className="mx-auto grid max-w-[78rem] gap-10">
        <section className="method-hero border-b pb-10">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-pewter">
            {APP_NAME} · {page.eyebrow}
          </p>
          <h1 className="mt-6 max-w-5xl font-display text-[clamp(3rem,7.5vw,7.2rem)] font-normal leading-[0.86] tracking-normal text-ink">
            {page.title}
          </h1>
          <p className="mt-8 max-w-4xl text-lg font-light leading-8 text-graphite md:text-xl md:leading-9">
            {page.intro}
          </p>
        </section>

        <div className="grid gap-8">
          {page.sections.map((section) => (
            <section key={section.title} className="legal-block">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">{section.title}</p>
              <p className="mt-4 max-w-4xl text-base leading-8 text-graphite">{section.body}</p>
            </section>
          ))}
        </div>

        <nav className="flex flex-wrap gap-3 border-t border-[#ddd6c4] pt-6" aria-label="Documents légaux">
          <button type="button" onClick={() => onOpenLegal('legal')} className="source-link">
            Mentions légales
          </button>
          <button type="button" onClick={() => onOpenLegal('terms')} className="source-link">
            Conditions d’utilisation
          </button>
        </nav>
      </article>
    </motion.main>
  );
}

function Studio({ onBack, onOpenIndice }) {
  const energy = useEnergyData();
  const [selectedCode, setSelectedCode] = useState('33');
  const [activeLayerId, setActiveLayerId] = useState('energy');
  const [scenarioPowerMw, setScenarioPowerMw] = useState(300);
  const [isZoomed, setIsZoomed] = useState(false);
  const [analysisPoint, setAnalysisPoint] = useState(null);

  const selectedProfile = useMemo(() => buildAiScenarioProfile(scenarioPowerMw), [scenarioPowerMw]);
  const model = useMemo(
    () => buildDepartmentModel(energy.departments, energy.geojson, selectedProfile, energy.realtime, energy.rteGrid),
    [energy.departments, energy.geojson, selectedProfile, energy.realtime, energy.rteGrid],
  );
  const selectedMetric = model.byCode.get(selectedCode) ?? model.items[0];
  const pointAnalysis = usePointAnalysis(analysisPoint, selectedMetric, selectedProfile, energy.realtime);
  const finalScore = pointAnalysis.data?.score ?? selectedMetric?.datacenterScore ?? 0;
  const mode = finalScore >= 76 ? 'optimal' : finalScore < 52 ? 'tension' : 'transition';

  const handleDepartmentSelect = (code, point) => {
    setSelectedCode(code);
    setIsZoomed(true);
    setAnalysisPoint(point ?? null);
  };

  const resetMapView = () => {
    setIsZoomed(false);
    setAnalysisPoint(null);
  };

  useEffect(() => {
    if (!isZoomed && analysisPoint) {
      setAnalysisPoint(null);
    }
  }, [analysisPoint, isZoomed]);

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
          'studio-grid mx-auto max-w-[98rem] transition-[gap] duration-700',
          mode === 'optimal' ? 'gap-12' : mode === 'tension' ? 'gap-4' : 'gap-8',
        )}
      >
        <DepartmentMap
          activeLayerId={activeLayerId}
          analysisPoint={analysisPoint}
          energy={energy}
          finalScore={finalScore}
          isZoomed={isZoomed}
          mode={mode}
          model={model}
          pointAnalysis={pointAnalysis}
          selectedProfile={selectedProfile}
          scenarioPowerMw={scenarioPowerMw}
          selectedMetric={selectedMetric}
          setActiveLayerId={setActiveLayerId}
          setScenarioPowerMw={setScenarioPowerMw}
          resetMapView={resetMapView}
          setSelectedCode={handleDepartmentSelect}
          onOpenIndice={onOpenIndice}
        />
        <ControlDeck
          energy={energy}
          mode={mode}
          pointAnalysis={pointAnalysis}
          selectedMetric={selectedMetric}
        />
      </div>
    </motion.main>
  );
}

function DepartmentMap({
  activeLayerId,
  analysisPoint,
  energy,
  finalScore,
  isZoomed,
  mode,
  model,
  pointAnalysis,
  scenarioPowerMw,
  selectedProfile,
  selectedMetric,
  setActiveLayerId,
  setScenarioPowerMw,
  resetMapView,
  setSelectedCode,
  onOpenIndice,
}) {
  const svgRef = useRef(null);
  const selectedFeature = model.features.find((feature) => feature.code === selectedMetric?.code);
  const transform = getZoomTransform(selectedFeature?.bounds, isZoomed);
  const marker = analysisPoint && isZoomed && model.projection ? model.projection([analysisPoint.lon, analysisPoint.lat]) : null;
  const layer = MAP_LAYERS.find((item) => item.id === activeLayerId) ?? MAP_LAYERS[0];
  const localCells = useMemo(
    () => buildLocalMapCells(selectedFeature, selectedMetric, activeLayerId, model.projection, isZoomed),
    [activeLayerId, isZoomed, model.projection, selectedFeature, selectedMetric],
  );
  const localClipId = selectedFeature ? `local-detail-${selectedFeature.code}` : 'local-detail';

  const clickToLonLat = (event) => {
    if (!svgRef.current || !model.projection?.invert) return null;
    const screenMatrix = svgRef.current.getScreenCTM();
    if (!screenMatrix) return null;

    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(screenMatrix.inverse());
    const sourceX = transform.scale === 1 ? svgPoint.x : (svgPoint.x - MAP_BOUNDS.width / 2) / transform.scale + transform.centerX;
    const sourceY = transform.scale === 1 ? svgPoint.y : (svgPoint.y - MAP_BOUNDS.height / 2) / transform.scale + transform.centerY;
    const lonLat = model.projection.invert([sourceX, sourceY]);
    if (!lonLat?.every(Number.isFinite)) return null;
    return { lon: lonLat[0], lat: lonLat[1] };
  };

  return (
    <section
      className={cx(
        'map-stage relative overflow-hidden border transition-all duration-700',
        mode === 'tension'
          ? 'border-black bg-white p-3 md:p-5'
          : mode === 'optimal'
            ? 'border-[#dfd8c6] bg-[#f4f0e7] p-5 sm:p-6 md:p-9 lg:p-11 shadow-editorial'
            : 'border-[#ded9ca] bg-[#f7f4ec] p-5 md:p-8',
      )}
    >
      <div className="relative z-10 mb-5 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-pewter">
            Carte énergétique d’aptitude datacenter IA
          </p>
          <h2
            className={cx(
              'mt-3 font-display font-normal leading-none tracking-normal text-ink transition-all duration-700',
              mode === 'tension' ? 'text-3xl' : 'text-5xl md:text-6xl',
            )}
          >
            {selectedMetric?.name ?? 'France'}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-graphite">
            {selectedMetric?.ranks?.datacenterScore
              ? `Rang ${selectedMetric.ranks.datacenterScore} national sur ce scénario.`
              : 'Prélecture nationale, à préciser par un clic local.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SourcePill source={energy.source} />
          {(isZoomed || analysisPoint) && (
            <button
              type="button"
              onClick={resetMapView}
              className="inline-flex h-10 items-center gap-2 border border-ink px-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4"
            >
              <RotateCcw aria-hidden="true" size={14} strokeWidth={1.4} />
              France
            </button>
          )}
        </div>
      </div>

      <LayerControls activeLayerId={activeLayerId} mode={mode} setActiveLayerId={setActiveLayerId} />

      <div
        className="map-viewport relative z-10 mt-5 min-w-0 overflow-hidden"
        aria-busy={pointAnalysis.status === 'loading'}
      >
        {model.features.length ? (
          <svg
            ref={svgRef}
            className="map-svg h-full w-full max-w-full"
            role="group"
            aria-label="Carte interactive des départements français"
            viewBox={`0 0 ${MAP_BOUNDS.width} ${MAP_BOUNDS.height}`}
          >
            <defs>
              <filter id="department-shadow" x="-15%" y="-15%" width="130%" height="130%">
                <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#141414" floodOpacity="0.08" />
              </filter>
              {selectedFeature && (
                <clipPath id={localClipId} clipPathUnits="userSpaceOnUse">
                  <path d={selectedFeature.path} />
                </clipPath>
              )}
            </defs>
            <g transform={transform.value}>
              {model.features.map((feature) => {
                const metric = model.byCode.get(feature.code);
                const isSelected = feature.code === selectedMetric?.code;
                const isVisuallySelected = isZoomed && isSelected;

                return (
                  <path
                    key={feature.code}
                    aria-label={`${feature.name}, score ${metric?.datacenterScore ?? 0}`}
                    aria-pressed={isVisuallySelected}
                    className={cx(
                      'department-path cursor-crosshair transition-[fill,stroke,opacity] duration-500 focus:outline-none',
                      isVisuallySelected && 'department-path--selected',
                    )}
                    d={feature.path}
                    fill={departmentFill(metric, activeLayerId, mode, isVisuallySelected)}
                    filter={isVisuallySelected && mode !== 'tension' ? 'url(#department-shadow)' : undefined}
                    onClick={(event) => {
                      const point = clickToLonLat(event);
                      setSelectedCode(feature.code, point ? { ...point, label: 'Point cliqué' } : undefined);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        const centroid = metric?.centroid;
                        setSelectedCode(
                          feature.code,
                          centroid ? { label: 'Point de référence', lon: centroid[0], lat: centroid[1] } : undefined,
                        );
                      }
                    }}
                    role="button"
                    opacity={isZoomed && !isSelected ? 0.055 : 1}
                    stroke={departmentStroke(metric, activeLayerId, mode, isVisuallySelected)}
                    strokeWidth={isVisuallySelected ? 2.4 / transform.scale : 0.72 / transform.scale}
                    tabIndex={0}
                  />
                );
              })}
              {localCells.length > 0 && (
                <g clipPath={`url(#${localClipId})`} className="pointer-events-none" opacity={mode === 'tension' ? 0 : 1}>
                  {localCells.map((cell) => (
                    <rect
                      key={cell.id}
                      x={cell.x}
                      y={cell.y}
                      width={cell.size}
                      height={cell.size}
                      fill={localCellFill(cell.value, activeLayerId)}
                      stroke="rgba(20,20,20,0.18)"
                      strokeWidth={0.35 / transform.scale}
                    />
                  ))}
                </g>
              )}
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
        {localCells.length > 0 && (
          <p className="pointer-events-none absolute right-4 top-4 z-20 max-w-xs border border-[#d8d0bd] bg-[#fffaf0]/90 px-3 py-2 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-graphite shadow-sm">
            Maille intra-département indicative · cliquez pour analyse locale réelle
          </p>
        )}
        {pointAnalysis.status === 'loading' && <CalculationStatus mode={mode} selectedMetric={selectedMetric} />}
        <MapScoreCartouche
          finalScore={finalScore}
          mode={mode}
          pointAnalysis={pointAnalysis}
          selectedMetric={selectedMetric}
          selectedProfile={selectedProfile}
        />
        <MapLayerLegend activeLayerId={activeLayerId} mode={mode} selectedMetric={selectedMetric} selectedProfile={selectedProfile} />
      </div>

      <div
        className={cx(
          'map-stat-strip relative z-10 grid gap-3 border-t pt-5 text-sm',
          'md:grid-cols-4',
          mode === 'tension' ? 'border-black text-black' : 'border-[#ded6c4] text-graphite',
        )}
      >
        {buildMapStats(activeLayerId, selectedMetric, selectedProfile).map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} />
        ))}
        <ScenarioPowerConfigurator
          mode={mode}
          powerMw={scenarioPowerMw}
          selectedProfile={selectedProfile}
          setPowerMw={setScenarioPowerMw}
        />
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-3xl text-sm leading-6 text-graphite">
          {layer.question} {layer.description}
        </p>
        <button
          type="button"
          onClick={() => onOpenIndice(layer.id)}
          className="method-link"
        >
          Comprendre l’indice
          <ArrowRight aria-hidden="true" size={13} strokeWidth={1.4} />
        </button>
      </div>
    </section>
  );
}

function MapLayerLegend({ activeLayerId, mode, selectedMetric, selectedProfile }) {
  if (activeLayerId !== 'grid') return null;

  const score = Math.round(layerValue(selectedMetric, activeLayerId));
  const availableMw = selectedMetric?.gridAvailableMw ?? 0;
  const needMw = profileToPowerNeedMw(selectedProfile);
  const capacityRatio = clamp((availableMw / Math.max(needMw, 1)) * 100, 0, 100);

  return (
    <div className={cx('map-layer-legend', mode === 'tension' && 'map-layer-legend--tension')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-pewter">Lecture raccordement</p>
          <p className="mt-2 font-display text-3xl leading-none text-ink">{score}/100</p>
        </div>
        <Activity aria-hidden="true" size={17} strokeWidth={1.3} />
      </div>
      <div className="map-layer-legend__scale" aria-hidden="true">
        <span style={{ width: `${score}%` }} />
      </div>
      <div className="grid gap-2 text-sm leading-6">
        <FactRow label="Capacité disponible" value={`${formatMw(availableMw)} MW`} />
        <FactRow label="Besoin scénario" value={`${formatMw(needMw)} MW`} />
        <FactRow label="Couverture" value={`${Math.round(capacityRatio)}%`} />
        <FactRow label="Tension max" value={selectedMetric?.rteMaxVoltageKv ? `${selectedMetric.rteMaxVoltageKv} kV` : '—'} />
        <FactRow label="Postes RTE" value={selectedMetric?.rteSubstationCount ? `${selectedMetric.rteSubstationCount}` : '—'} />
      </div>
    </div>
  );
}

function buildMapStats(activeLayerId, selectedMetric, selectedProfile) {
  if (activeLayerId === 'grid') {
    return [
      { label: 'Score raccordement', value: `${Math.round(layerValue(selectedMetric, activeLayerId))}/100` },
      { label: 'Capacité disponible', value: `${formatMw(selectedMetric?.gridAvailableMw ?? 0)} MW` },
      { label: 'Tension max', value: selectedMetric?.rteMaxVoltageKv ? `${selectedMetric.rteMaxVoltageKv} kV` : '—' },
      { label: 'Postes RTE', value: selectedMetric?.rteSubstationCount ? `${selectedMetric.rteSubstationCount}` : '—' },
    ];
  }

  return [
    { label: 'Score carte', value: `${Math.round(layerValue(selectedMetric, activeLayerId))}/100` },
    { label: 'Puissance bas carbone', value: `${formatMw((selectedMetric?.lowCarbonKw ?? 0) / 1000)} MW` },
    { label: 'Scénario', value: selectedProfile.footprint },
  ];
}

function CalculationStatus({ mode, selectedMetric }) {
  return (
    <div
      className={cx('calculation-status', mode === 'tension' && 'calculation-status--tension')}
      role="status"
      aria-live="polite"
    >
      <div className="calculation-status__panel">
        <span className="calculation-status__mark" aria-hidden="true" />
        <p className="calculation-status__label">Calcul du score en cours</p>
        <p className="calculation-status__title">Qualification énergétique du site</p>
        <p className="calculation-status__body">
          {selectedMetric?.name ?? 'Département'} · énergie bas carbone, signal réseau, eau, risques et accès sont recroisés au point cliqué.
        </p>
        <div className="calculation-status__sources" aria-hidden="true">
          <span>ODRÉ</span>
          <span>Caparéseau</span>
          <span>RTE</span>
          <span>Eco2mix</span>
          <span>Géorisques</span>
        </div>
      </div>
    </div>
  );
}

function MapScoreCartouche({ finalScore, mode, pointAnalysis, selectedMetric, selectedProfile }) {
  const score = Math.round(finalScore ?? 0);
  const isCalculating = pointAnalysis.status === 'loading';
  const hasLocalPoint = Boolean(pointAnalysis.data);
  const state =
    isCalculating
      ? 'Calcul du score'
      : hasLocalPoint
        ? 'Point instruit'
        : 'Pré-score départemental';
  const verdict =
    isCalculating
      ? 'Calcul du score en cours'
      : hasLocalPoint
        ? score >= 78
          ? 'Instruction prioritaire'
          : score >= 58
            ? 'Instruction conditionnelle'
            : 'Instruction défavorable'
        : score >= 78
          ? 'Pré-candidat fort'
          : score >= 58
            ? 'Pré-candidat'
            : 'Pré-candidat faible';

  return (
    <div className={cx('map-cartouche', mode === 'tension' && 'map-cartouche--tension')}>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-pewter">{state}</p>
          <p className="mt-2 font-display text-[4.8rem] leading-[0.82] text-ink">{score}</p>
        </div>
        <div className="grid gap-2">
          <p className="font-display text-2xl leading-none text-ink">{verdict}</p>
          <p className="text-sm leading-6 text-graphite">
            {selectedMetric?.name ?? 'Département'} · {selectedProfile.label} · {selectedProfile.footprint}
          </p>
        </div>
      </div>
      <div className="score-rule" aria-hidden="true">
        <span style={{ width: `${clamp(score, 0, 100)}%` }} />
      </div>
      {isCalculating && (
        <p className="calculation-caption" role="status" aria-live="polite">
          Sources publiques interrogées. Le score affiché reste provisoire.
        </p>
      )}
    </div>
  );
}

function LayerControls({ activeLayerId, mode, setActiveLayerId }) {
  return (
    <div className="layer-strip relative z-10 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
      {MAP_LAYERS.map((layer) => (
        <button
          key={layer.id}
          type="button"
          aria-pressed={activeLayerId === layer.id}
          onClick={() => setActiveLayerId(layer.id)}
          className={cx(
            'inline-flex h-11 shrink-0 items-center gap-2 border px-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
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
  energy,
  mode,
  pointAnalysis,
  selectedMetric,
}) {
  const [selectedCriterionKey, setSelectedCriterionKey] = useState(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const closeCriterionModal = () => setSelectedCriterionKey(null);
  const closeSourceModal = () => setIsSourceModalOpen(false);

  return (
    <aside
      className={cx(
        'dossier-panel flex flex-col transition-all duration-700',
        mode === 'tension'
          ? 'gap-4 border-black p-4'
          : mode === 'optimal'
            ? 'gap-8 border-[#d9d1be] p-5 sm:p-7 md:p-9'
            : 'gap-6 border-[#ddd6c4] p-5 sm:p-6 md:p-8',
      )}
      aria-label="Scores par catégorie"
    >
      <CriteriaGrid
        mode={mode}
        pointAnalysis={pointAnalysis}
        selectedCriterionKey={selectedCriterionKey}
        selectedMetric={selectedMetric}
        setSelectedCriterionKey={setSelectedCriterionKey}
      />

      <button
        type="button"
        onClick={() => setIsSourceModalOpen(true)}
        className={cx(
          'inline-flex min-h-11 items-center justify-center gap-3 border px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
          mode === 'tension'
            ? 'border-black text-black hover:bg-black hover:text-white'
            : 'border-[#d8d0bd] text-ink hover:border-ink hover:bg-ink hover:text-white',
        )}
      >
        Voir la provenance des données
        <ExternalLink aria-hidden="true" size={13} strokeWidth={1.4} />
      </button>

      <CriterionModal
        criterionKey={selectedCriterionKey}
        energy={energy}
        mode={mode}
        onClose={closeCriterionModal}
        pointAnalysis={pointAnalysis}
        selectedMetric={selectedMetric}
      />

      <DataProvenanceModal
        energy={energy}
        isOpen={isSourceModalOpen}
        mode={mode}
        onClose={closeSourceModal}
        pointAnalysis={pointAnalysis}
      />
    </aside>
  );
}

function EnergyPriorityPanel({ energy, mode, selectedMetric }) {
  const liveScore = buildLiveGridScore(energy.realtime);
  const lowCarbonMw = (selectedMetric?.lowCarbonKw ?? 0) / 1000;
  const energyScore = Math.round(selectedMetric?.energyScore ?? 0);
  const rank = selectedMetric?.ranks?.energyScore;
  const carbon = Number.isFinite(Number(energy.realtime?.tauxCo2)) ? Number(energy.realtime.tauxCo2) : null;
  const solar = Number.isFinite(Number(energy.realtime?.solaire)) ? Number(energy.realtime.solaire) : 0;
  const consumption = Number.isFinite(Number(energy.realtime?.consommation)) ? Number(energy.realtime.consommation) : 1;
  const solarShare = Math.round((solar / Math.max(consumption, 1)) * 100);

  return (
    <div className={cx('energy-priority grid gap-4 border p-4', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Énergie d’abord</p>
          <p className="mt-2 font-display text-4xl leading-none text-ink">{energyScore}/100</p>
        </div>
        <Zap aria-hidden="true" size={20} strokeWidth={1.25} />
      </div>
      <p className="text-sm leading-6 text-graphite">
        {formatMw(lowCarbonMw)} MW bas carbone raccordés. Le score commence par la capacité électrique existante,
        puis seulement ensuite par le foncier, les risques et l’accès.
      </p>
      <div className="grid gap-2 text-sm leading-6">
        <FactRow label="Rang énergie" value={rank ? `${rank} national` : '—'} />
        <FactRow label="Signal réseau live" value={`${Math.round(liveScore)}/100`} />
        <FactRow label="Carbone instantané" value={carbon == null ? '—' : `${carbon} gCO₂/kWh`} />
        <FactRow label="Solaire national" value={`${solarShare}% de la consommation`} />
      </div>
    </div>
  );
}

function GridConnectionPanel({ mode, selectedMetric, selectedProfile }) {
  const score = Math.round(selectedMetric?.gridScore ?? 0);
  const availableMw = selectedMetric?.gridAvailableMw ?? 0;
  const queueMw = selectedMetric?.gridQueueMw ?? 0;
  const needMw = profileToPowerNeedMw(selectedProfile);
  const topStation = selectedMetric?.rteTopStations?.[0];
  const fit = selectedMetric?.gridCompatibilityLabel ?? 'Non qualifié';
  const sourceLabel = selectedMetric?.gridConfidenceLabel ?? 'Source non qualifiée';

  return (
    <div className={cx('grid-connection grid gap-4 border p-4', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Raccordement électrique</p>
          <p className="mt-2 font-display text-4xl leading-none text-ink">{score}/100</p>
        </div>
        <Activity aria-hidden="true" size={20} strokeWidth={1.25} />
      </div>
      <p className="text-sm leading-6 text-graphite">
        {fit}. {formatMw(availableMw)} MW de capacité réservée disponible sont rapprochés des postes RTE du
        département pour un besoin indicatif de {formatMw(needMw)} MW.
      </p>
      <div className="grid gap-2 text-sm leading-6">
        <FactRow label="Source" value={sourceLabel} />
        <FactRow label="Tension maximale" value={selectedMetric?.rteMaxVoltageKv ? `${selectedMetric.rteMaxVoltageKv} kV` : '—'} />
        <FactRow label="Postes RTE rapprochés" value={selectedMetric?.rteSubstationCount ? `${selectedMetric.rteSubstationCount}` : '—'} />
        <FactRow label="File d’attente S3REnR" value={`${formatMw(queueMw)} MW`} />
        <FactRow
          label="Poste le plus ouvert"
          value={topStation ? `${topStation.name} · ${formatMw(topStation.availableMw)} MW` : '—'}
        />
      </div>
    </div>
  );
}

function HyperscaleScalePanel({ mode, selectedMetric, selectedProfile }) {
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
        <FactRow label="GPU" value={`~${formatNumber(summary.gpuCount)} · ${summary.architecture}`} />
        <FactRow label="Puissance GPU seule" value={`${formatMw(summary.gpuPowerMw)} MW`} />
        <FactRow label="Infra, refroidissement & pertes" value={`${formatMw(summary.infrastructurePowerMw)} MW`} />
        <FactRow label="Énergie quotidienne" value={`${formatDecimal(summary.energy.dailyGwh)} GWh`} />
        <FactRow label="Énergie annuelle" value={`${formatDecimal(summary.energy.yearlyTwh)} TWh`} />
        <FactRow label="Électricité / jour" value={formatCompactCurrency(summary.cost.dailyEur)} />
        <FactRow label="Électricité / an" value={formatCompactCurrency(summary.cost.yearlyEur)} />
        <FactRow label="Couverture Caparéseau" value={`${Math.round(coverage)}% · ${formatMw(availableMw)} MW`} />
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

function LiveGridSignal({ energy, mode }) {
  const liveScore = buildLiveGridScore(energy.realtime);
  const solaire = Number.isFinite(Number(energy.realtime?.solaire)) ? Number(energy.realtime.solaire) : 0;
  const consommation = Number.isFinite(Number(energy.realtime?.consommation)) ? Number(energy.realtime.consommation) : 1;
  const solarShare = Math.round((solaire / Math.max(consommation, 1)) * 100);
  const label = liveScore >= 78 ? 'Signal très favorable' : liveScore >= 55 ? 'Signal exploitable' : 'Signal contraint';
  const title = energy.source === 'live' ? 'Signal réseau maintenant' : 'Signal réseau de secours';
  const sourceNote =
    energy.source === 'live'
      ? `${energy.realtime.date} · ${energy.realtime.heure}`
      : 'données figées de secours';

  return (
    <div className={cx('live-signal grid gap-3 border p-4', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">{title}</p>
        <SunMedium aria-hidden="true" size={17} strokeWidth={1.3} />
      </div>
      <div className="grid grid-cols-[auto_1fr] items-end gap-4">
        <p className="font-display text-5xl leading-none text-ink">{Math.round(liveScore)}</p>
        <p className="min-w-0 text-sm leading-6 text-graphite">
          {label}. CO₂ {energy.realtime.tauxCo2} g/kWh · solaire {solarShare}% · {sourceNote}.
        </p>
      </div>
      <div className={cx('h-2 border p-[2px]', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
        <div className={cx('h-full', mode === 'tension' ? 'bg-black' : 'bg-solar')} style={{ width: `${liveScore}%` }} />
      </div>
    </div>
  );
}

function ProfileSelector({ mode, profiles, selectedProfile, setScenarioPowerMw }) {
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
            aria-pressed={profile.powerNeedMw === selectedProfile.powerNeedMw}
            onClick={() => setScenarioPowerMw(profile.powerNeedMw)}
            className={cx(
              'profile-choice border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
              profile.powerNeedMw === selectedProfile.powerNeedMw
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

function ScorePlate({ isCalculating = false, mode, score, selectedMetric }) {
  return (
    <div className={cx('score-plate grid gap-3 border transition-all duration-700', mode === 'tension' ? 'border-black p-4' : 'border-[#d8d0bd] p-5')}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">
            {isCalculating ? 'Calcul du score en cours' : 'Composition du score'}
          </p>
          <p className="mt-2 font-display text-5xl leading-none text-ink">{Math.round(score)}</p>
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
        Base départementale : {Math.round(selectedMetric?.datacenterScore ?? 0)}/100. Le clic local ajuste ce score
        avec les risques live, la route, l’écart ville 10-15 km, l’eau et la température.
      </p>
    </div>
  );
}

function MethodIndexPanel({ activeLayerId, mode, onOpenIndice }) {
  return (
    <div className={cx('method-panel grid gap-3 border p-4', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Méthode des indices</p>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{INDICE_PAGES.length}</span>
      </div>
      <div className="grid gap-2">
        {INDICE_PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            aria-current={activeLayerId === page.id ? 'true' : undefined}
            onClick={() => onOpenIndice(page.id)}
            className={cx(
              'method-choice border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
              activeLayerId === page.id
                ? 'border-ink bg-ink text-white'
                : mode === 'tension'
                  ? 'border-black hover:bg-black hover:text-white'
                  : 'border-[#d8d0bd] hover:border-ink',
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm">{page.label}</span>
              <ArrowRight aria-hidden="true" size={13} strokeWidth={1.4} />
            </span>
            <span className="mt-1 block text-xs leading-5 opacity-70">{page.question}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfidenceNote({ energy, mode, pointAnalysis }) {
  const confidence = buildConfidence(pointAnalysis, energy);

  return (
    <div className={cx('confidence-note grid gap-3 border p-4', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Confiance décisionnelle</p>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{confidence.value}/100</span>
      </div>
      <div className={cx('h-2 border p-[2px]', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
        <div
          className={cx('h-full transition-all duration-700', mode === 'tension' ? 'bg-black' : 'bg-forest')}
          style={{ width: `${confidence.value}%` }}
        />
      </div>
      <p className="text-sm leading-6 text-graphite">
        {confidence.label}. {confidence.detail}
      </p>
    </div>
  );
}

function CandidateMemo({ energy, mode, pointAnalysis, score, selectedMetric, selectedProfile, verdict }) {
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef(null);
  const confidence = buildConfidence(pointAnalysis, energy);
  const memoProfile = selectedProfile ?? buildAiScenarioProfile(300);
  const memoScore = Number.isFinite(score) ? score : selectedMetric?.datacenterScore ?? 0;
  const memoVerdict = verdict ?? 'Pré-candidat';
  const criteria = pointAnalysis.data?.criteria ?? {
    access: selectedMetric?.accessScore ?? 52,
    cooling: selectedMetric?.coolingScore ?? 0,
    energy: selectedMetric?.energyScore ?? 0,
    grid: selectedMetric?.gridScore ?? 0,
    land: selectedMetric?.landScore ?? 0,
    risk: selectedMetric?.riskScore ?? 0,
  };
  const strengths = Object.entries(criteria)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);
  const blockers = Object.entries(criteria)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 2);
  const memo = buildCandidateMemo({
    criteria,
    energy,
    pointAnalysis,
    score: memoScore,
    selectedMetric,
    selectedProfile: memoProfile,
    verdict: memoVerdict,
  });

  useEffect(() => () => window.clearTimeout(copyResetRef.current), []);

  const copyMemo = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponible');
      await navigator.clipboard.writeText(memo);
      setCopied(true);
      window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cx('candidate-memo grid gap-4 border p-4', mode === 'tension' ? 'border-black' : 'border-[#d8d0bd]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Dossier d’implantation</p>
        <FileText aria-hidden="true" size={17} strokeWidth={1.3} />
      </div>
      <p className="text-sm leading-6 text-graphite">
        {selectedMetric?.name} est évalué pour un scénario {memoProfile.label.toLowerCase()}.
        {pointAnalysis.data
          ? ' Le mémo reprend les signaux locaux disponibles maintenant.'
          : ' Le mémo reste départemental tant qu’aucun point n’est cliqué.'}
      </p>
      <FactRow label="Niveau de confiance" value={`${confidence.label} · ${confidence.value}/100`} />
      <div className="grid gap-3 md:grid-cols-2">
        <MemoList mode={mode} title="Forces" items={strengths} />
        <MemoList mode={mode} title="À lever" items={blockers} />
      </div>
      <button
        type="button"
        onClick={copyMemo}
        className={cx(
          'inline-flex h-11 w-fit items-center gap-3 border px-4 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
          mode === 'tension' ? 'border-black hover:bg-black hover:text-white' : 'border-ink hover:bg-ink hover:text-white',
        )}
      >
        <ClipboardCheck aria-hidden="true" size={14} strokeWidth={1.4} />
        {copied ? 'Mémo copié' : 'Copier le mémo'}
      </button>
    </div>
  );
}

function MemoList({ items, mode, title }) {
  return (
    <div className={cx('memo-list border p-3', mode === 'tension' ? 'border-black' : 'border-[#e0d8c5]')}>
      <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-pewter">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-sm">
            <span>{CRITERIA_LABELS[key]}</span>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{Math.round(value)}/100</span>
          </div>
        ))}
      </div>
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
            aria-current={department.code === selectedCode ? 'true' : undefined}
            onClick={() => setSelectedCode(department.code)}
            className={cx(
              'ranking-choice grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
              department.code === selectedCode
                ? 'border-ink bg-ink text-white'
                : mode === 'tension'
                  ? 'border-black hover:bg-black hover:text-white'
                  : 'border-[#d8d0bd] hover:border-ink',
            )}
          >
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">{index + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm">{department.name}</span>
              <span className="mt-1 block text-xs opacity-70">
                {formatMw(department.lowCarbonKw / 1000)} MW bas carbone · {formatMw(department.gridAvailableMw ?? 0)} MW raccord.
              </span>
            </span>
            <span className="font-display text-3xl leading-none">{department.datacenterScore}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CriteriaGrid({ mode, pointAnalysis, selectedCriterionKey, selectedMetric, setSelectedCriterionKey }) {
  const criteria = pointAnalysis.data?.criteria ?? {
    energy: selectedMetric?.energyScore ?? 0,
    grid: selectedMetric?.gridScore ?? 0,
    risk: selectedMetric?.riskScore ?? 0,
    land: selectedMetric?.landScore ?? 0,
    cooling: selectedMetric?.coolingScore ?? 0,
    access: selectedMetric?.accessScore ?? 52,
  };
  const rows = buildCriterionRows(criteria);

  return (
    <div className="grid gap-3" aria-label="Scores par catégorie">
      {rows.map((row) => (
        <Signal
          key={row.key}
          icon={row.icon}
          isActive={selectedCriterionKey === row.key}
          label={row.label}
          mode={mode}
          onClick={() => setSelectedCriterionKey(row.key)}
          value={`${Math.round(row.value)}/100`}
        />
      ))}
    </div>
  );
}

function CriterionModal({ criterionKey, energy, mode, onClose, pointAnalysis, selectedMetric }) {
  const criteria = pointAnalysis.data?.criteria ?? {
    energy: selectedMetric?.energyScore ?? 0,
    grid: selectedMetric?.gridScore ?? 0,
    risk: selectedMetric?.riskScore ?? 0,
    land: selectedMetric?.landScore ?? 0,
    cooling: selectedMetric?.coolingScore ?? 0,
    access: selectedMetric?.accessScore ?? 52,
  };
  const detail = criterionKey ? buildCriterionDetail(criterionKey, criteria[criterionKey], { energy, pointAnalysis, selectedMetric }) : null;

  return (
    <AnimatePresence>
      {detail && (
        <motion.div
          key="criterion-modal"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/30 px-4 py-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="criterion-modal-title"
          onClick={onClose}
        >
          <motion.div
            className={cx('w-full max-w-xl border p-6 shadow-2xl', mode === 'tension' ? 'border-black bg-white' : 'border-[#d8d0bd] bg-[#fffaf0]')}
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-5">
              <div className="grid gap-3">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">Détail du critère</p>
                <h3 id="criterion-modal-title" className="font-display text-4xl leading-none text-ink">{detail.label}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="border border-current px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] transition hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4"
              >
                Fermer
              </button>
            </div>
            <div className="mt-8 grid gap-5">
              <p className="font-display text-6xl leading-none text-ink">{Math.round(detail.value)}/100</p>
              <p className="text-base leading-7 text-graphite">{detail.summary}</p>
              <div className="grid gap-3 text-sm leading-6">
                {detail.facts.map((fact) => (
                  <FactRow key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </div>
              <p className="border-t border-current/20 pt-4 text-sm leading-6 text-graphite">{detail.explanation}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function buildCriterionRows(criteria) {
  return [
    { key: 'energy', icon: <Zap size={17} strokeWidth={1.3} />, label: CRITERIA_LABELS.energy, value: criteria.energy },
    { key: 'grid', icon: <Activity size={17} strokeWidth={1.3} />, label: CRITERIA_LABELS.grid, value: criteria.grid },
    { key: 'risk', icon: <Shield size={17} strokeWidth={1.3} />, label: CRITERIA_LABELS.risk, value: criteria.risk },
    { key: 'land', icon: <MapPin size={17} strokeWidth={1.3} />, label: CRITERIA_LABELS.land, value: criteria.land },
    { key: 'cooling', icon: <Snowflake size={17} strokeWidth={1.3} />, label: CRITERIA_LABELS.cooling, value: criteria.cooling },
    { key: 'access', icon: <Route size={17} strokeWidth={1.3} />, label: CRITERIA_LABELS.access, value: criteria.access },
  ];
}

function buildCriterionDetail(key, value = 0, { energy, pointAnalysis, selectedMetric }) {
  const rounded = Math.round(value ?? 0);
  const local = pointAnalysis.data;
  const hasQualifiedRiskSignal =
    local?.riskConfidenceLabel === 'qualifié' ||
    [local?.floodLabel, local?.seismicLabel, local?.groundMovementLabel].some(
      (label) => label && !isUnknownRiskText(label),
    );
  const details = {
    access: {
      summary: 'Mesure si le point reste exploitable par les équipes et les flux opérationnels.',
      facts: [
        { label: 'Route la plus proche', value: local?.nearestRoadKm != null ? formatDistance(local.nearestRoadKm) : 'Non qualifiée au point' },
        { label: 'Ville cible', value: local?.nearestTownKm != null ? formatDistance(local.nearestTownKm) : 'Signal départemental' },
        { label: 'Lecture', value: rounded >= 70 ? 'Accès favorable' : rounded >= 50 ? 'Accès à vérifier' : 'Accès contraint' },
      ],
      explanation: 'Le score favorise un site proche d’un axe routier sans être collé au tissu urbain, avec une distance ville compatible avec le recrutement et les opérations.'
    },
    cooling: {
      summary: 'Estime le potentiel de refroidissement naturel et la prudence eau/température.',
      facts: [
        { label: 'Température locale', value: local?.temperatureC != null ? `${Math.round(local.temperatureC)} °C` : 'Non qualifiée au point' },
        { label: 'Hydraulique raccordée', value: `${formatMw((selectedMetric?.capacities?.Hydraulique ?? 0) / 1000)} MW` },
        { label: 'Restriction sécheresse', value: local?.droughtLabel ?? 'Non qualifiée au point' },
      ],
      explanation: 'Le score combine latitude, signal hydraulique, température et disponibilité eau connue. Il reste indicatif tant qu’une étude thermique et hydrologique n’est pas produite.'
    },
    energy: {
      summary: 'Mesure la force du socle bas carbone déjà raccordé autour du département.',
      facts: [
        { label: 'Puissance bas carbone', value: `${formatMw((selectedMetric?.lowCarbonKw ?? 0) / 1000)} MW` },
        { label: 'Rang énergie', value: selectedMetric?.ranks?.energyScore ? `${selectedMetric.ranks.energyScore} national` : '—' },
        { label: 'CO₂ instantané', value: `${energy.realtime.tauxCo2} gCO₂/kWh` },
      ],
      explanation: 'Le score augmente avec la puissance bas carbone installée, la diversité des filières et le signal réseau national. Il ne garantit pas une capacité de raccordement disponible.'
    },
    grid: {
      summary: 'Évalue si les capacités Caparéseau et les postes RTE semblent cohérents avec le scénario.',
      facts: [
        { label: 'Capacité disponible', value: `${formatMw(selectedMetric?.gridAvailableMw ?? 0)} MW` },
        { label: 'Tension maximale', value: selectedMetric?.rteMaxVoltageKv ? `${selectedMetric.rteMaxVoltageKv} kV` : '—' },
        { label: 'Postes RTE', value: selectedMetric?.rteSubstationCount ? `${selectedMetric.rteSubstationCount}` : '—' },
      ],
      explanation: 'Le score rapproche capacité réservée disponible, niveau de tension et densité des postes. Il ne remplace pas une réponse de raccordement RTE/Enedis.'
    },
    land: {
      summary: 'Estime la marge foncière et l’écart ville utile pour un site à instruire.',
      facts: [
        { label: 'Prix foncier local', value: local?.landPriceLabel ?? formatLandPrice(selectedMetric?.landPricePerM2) },
        { label: 'Occupation du sol', value: local?.landuseLabel ?? 'Signal départemental' },
        { label: 'Écart ville cible', value: local?.nearestTownKm != null ? formatDistance(local.nearestTownKm) : '10-15 km visés' },
      ],
      explanation: 'Le score favorise les secteurs avec marge spatiale, prix foncier supportable et distance urbaine équilibrée. PLU, servitudes et artificialisation restent à vérifier.'
    },
    risk: {
      summary: 'Pré-filtre les risques naturels qui peuvent bloquer ou renchérir le projet.',
      facts: [
        { label: 'Inondation', value: local?.floodLabel ?? 'Pré-risque départemental' },
        { label: 'Sismicité', value: local?.seismicLabel ?? 'Pré-risque départemental' },
        { label: 'Mouvements terrain', value: local?.groundMovementLabel ?? 'Non qualifié au point' },
        { label: 'Confiance risque', value: local?.riskConfidenceLabel ?? 'Départemental' },
      ],
      explanation: hasQualifiedRiskSignal
        ? 'Plus le score est haut, moins les signaux de risque naturel semblent contraignants. Le score baisse seulement quand des signaux qualifiés indiquent inondation, sismicité, mouvements de terrain ou retrait-gonflement.'
        : 'Aucun signal risque qualifié n’a été reçu au point: le score reste volontairement neutre et doit être lu avec une confiance faible, pas comme une pénalité. Plus haut = moins contraint, mais une expertise réglementaire reste nécessaire.'
    },
  };

  return {
    label: CRITERIA_LABELS[key] ?? key,
    value: rounded,
    ...(details[key] ?? {
      summary: 'Critère à qualifier.',
      facts: [],
      explanation: 'Ce critère doit être confirmé par une instruction technique dédiée.',
    }),
  };
}

function ActionPlan({ mode, pointAnalysis, selectedMetric }) {
  const criteria = pointAnalysis.data?.criteria ?? {
    access: selectedMetric?.accessScore ?? 52,
    cooling: selectedMetric?.coolingScore ?? 0,
    energy: selectedMetric?.energyScore ?? 0,
    grid: selectedMetric?.gridScore ?? 0,
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

function EvidencePanel({ energy, mode, pointAnalysis, selectedMetric }) {
  const data = pointAnalysis.data;
  const gridEvidence = data
    ? `Caparéseau/RTE: ${data.gridCompatibilityLabel}, ${data.gridAvailableLabel} MW disponible`
    : selectedMetric?.gridCompatibilityLabel
      ? `Caparéseau/RTE: ${selectedMetric.gridCompatibilityLabel}, ${formatMw(selectedMetric.gridAvailableMw)} MW disponible`
      : 'Caparéseau/RTE non qualifié';
  const rows = [
    ['Énergie structurelle', energy.source === 'live' ? 'ODRÉ live: nucléaire + renouvelables + stockage' : 'Capacités locales de secours'],
    ['Raccordement électrique', gridEvidence],
    ['Réseau temps réel', energy.source === 'live' ? 'Eco2mix live: CO₂ + solaire national' : 'Eco2mix local de secours'],
    ['Risques live', data ? `Géorisques au point: ${data.riskConfidenceLabel}` : 'Pré-filtre départemental estimé'],
    ['Météo live', data?.temperatureC != null ? 'Open-Meteo au point' : 'En attente du clic'],
    ['Eau & sécheresse', data ? `Hub’Eau ${data.groundwaterLabel}; VigiEau ${data.droughtLabel}` : 'Hub’Eau / VigiEau au clic'],
    ['Ville / route', data ? 'OSM + API Adresse au point' : 'Estimation au clic à venir'],
    ['Foncier local', data ? `Overpass ${data.landuseLabel}; DVF ${data.landPriceLabel}` : 'GeoJSON + densité ODRÉ + DVF médian; PLU absent'],
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
      text: 'Vérifier une route exploitable et un bassin de travailleurs accessible sans installer le site en cœur urbain.',
    },
    cooling: {
      label: CRITERIA_LABELS.cooling,
      text: 'Comparer la température annuelle, la disponibilité eau non conflictuelle et les solutions de free cooling.',
    },
    energy: {
      label: CRITERIA_LABELS.energy,
      text: `${formatMw((selectedMetric?.lowCarbonKw ?? 0) / 1000)} MW bas carbone identifiés. Vérifier le poste source et les délais de raccordement.`,
    },
    grid: {
      label: CRITERIA_LABELS.grid,
      text: `${formatMw(selectedMetric?.gridAvailableMw ?? 0)} MW de capacité réservée disponible Caparéseau. Vérifier poste, file d’attente, tension HTB et coût de renforcement.`,
    },
    land: {
      label: CRITERIA_LABELS.land,
      text: 'Contrôler PLU, artificialisation, emprise disponible, extension et écart ville proche de 10-15 km.',
    },
    risk: {
      label: CRITERIA_LABELS.risk,
      text: 'Lire les servitudes locales, PPRI, sismicité, retrait-gonflement et contraintes industrielles.',
    },
  };

  return { label: actions[key]?.label ?? key, text: actions[key]?.text ?? 'Critère à vérifier.', value };
}

function buildCandidateMemo({ criteria, energy, pointAnalysis, score, selectedMetric, selectedProfile, verdict }) {
  const data = pointAnalysis.data;
  const confidence = buildConfidence(pointAnalysis, energy);
  const sortedCriteria = Object.entries(criteria).sort(([, a], [, b]) => b - a);
  const strengths = sortedCriteria
    .slice(0, 2)
    .map(([key, value]) => `${CRITERIA_LABELS[key]} ${Math.round(value)}/100`)
    .join(', ');
  const blockers = [...sortedCriteria]
    .reverse()
    .slice(0, 2)
    .map(([key, value]) => `${CRITERIA_LABELS[key]} ${Math.round(value)}/100`)
    .join(', ');
  const coordinates = data
    ? `${pointAnalysis.data?.commune ?? 'point non identifié'} · ${formatDistance(data.nearestRoadKm)} voirie · ${formatDistance(data.nearestTownKm)} ville`
    : 'point local non encore analysé';

  return [
    `${APP_NAME} · mémo candidat datacenter IA`,
    `Département: ${selectedMetric?.name ?? 'Non sélectionné'}`,
    `Scénario: ${selectedProfile.label} (${selectedProfile.footprint})`,
    `Décision: ${verdict} · score ${Math.round(score)}/100`,
    `Confiance: ${confidence.label} · ${confidence.value}/100`,
    `Signal réseau: ${energy.realtime.tauxCo2} gCO2/kWh, ${formatNumber(energy.realtime.solaire)} MW solaire, ${energy.realtime.date} ${energy.realtime.heure}`,
    `Raccordement: ${selectedMetric?.gridCompatibilityLabel ?? 'Non qualifié'}, ${formatMw(selectedMetric?.gridAvailableMw ?? 0)} MW disponible, tension max ${selectedMetric?.rteMaxVoltageKv ? `${selectedMetric.rteMaxVoltageKv} kV` : 'non qualifiée'}`,
    `Point: ${coordinates}`,
    data
      ? `Terrain: ${data.landPriceLabel}, ${data.landuseLabel}, ${data.droughtLabel}, ${data.riverLabel}`
      : `Terrain: non qualifié localement`,
    `Forces: ${strengths}`,
    `À lever: ${blockers}`,
    `Sources: ODRÉ, Caparéseau, postes électriques RTE, Eco2mix, Géorisques, Open-Meteo, Hub’Eau, VigiEau, DVF, API Adresse, OpenStreetMap/Overpass, GeoJSON France.`,
    `Note: score de priorisation, à compléter par études réseau, PLU, foncier, sûreté et raccordement.`,
  ].join('\n');
}

function buildConfidence(pointAnalysis, energy) {
  if (pointAnalysis.status === 'loading') {
    return {
      detail: 'Les sources locales sont en cours d’interrogation.',
      label: 'Calcul en cours',
      value: 60,
    };
  }

  const data = pointAnalysis.data;
  if (!data) {
    return {
      detail: 'Le score reste départemental: énergie, foncier agrégé et pré-risque géographique.',
      label: energy.source === 'live' ? 'Départementale' : 'Exploratoire',
      value: energy.source === 'live' ? 46 : 32,
    };
  }

  const terrainSignals = [
    data.temperatureC != null,
    data.terrain?.groundwater,
    data.terrain?.river,
    data.terrain?.drought,
    data.terrain?.landuse,
    data.nearestRoadKm != null,
    data.nearestTownKm != null,
  ].filter(Boolean).length;
  const value = Math.round(
    clamp(
      34 +
        (energy.source === 'live' ? 13 : 0) +
        terrainSignals * 5.6 +
        Number(data.riskConfidence ?? 0) * 0.22 -
        (pointAnalysis.error ? 8 : 0),
      18,
      92,
    ),
  );

  return {
    detail:
      value >= 78
        ? 'Le point dispose de plusieurs signaux publics convergents.'
        : value >= 58
          ? 'Le point est qualifié, mais certaines sources restent absentes ou partielles.'
          : 'La lecture reste fragile: les sources locales doivent être complétées.',
    label: value >= 78 ? 'Forte' : value >= 58 ? 'Moyenne' : 'Exploratoire',
    value,
  };
}

function PointPanel({ analysisPoint, mode, pointAnalysis }) {
  const data = pointAnalysis.data;
  const isWaitingForPoint = !analysisPoint;

  return (
    <div className={cx('grid gap-3 border-t pt-5', mode === 'tension' ? 'border-black' : 'border-[#ddd6c4]')}>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Analyse au point</p>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em]">
          {pointAnalysis.status === 'loading' ? 'Live' : analysisPoint?.label ?? 'Attente'}
        </span>
      </div>
      {isWaitingForPoint && (
        <p className="text-sm leading-6 text-graphite">
          Sélectionnez un point dans le département zoomé pour qualifier les risques, l’accès, la météo et l’écart aux villes.
        </p>
      )}
      <div className="grid gap-2 text-sm leading-6">
        <FactRow label="Coordonnées" value={analysisPoint ? `${analysisPoint.lat.toFixed(4)}, ${analysisPoint.lon.toFixed(4)}` : '—'} />
        <FactRow label="Commune" value={data?.commune ?? '—'} />
        <FactRow label="Écart ville" value={data?.townLabel ?? formatDistance(data?.nearestTownKm)} />
        <FactRow label="Cible ville 10-15 km" value={data?.townTargetLabel ?? '—'} />
        <FactRow label="Accès voirie" value={data?.roadLabel ?? formatDistance(data?.nearestRoadKm)} />
        <FactRow label="Route travailleurs" value={data?.roadTargetLabel ?? '—'} />
        <FactRow label="Raccordement" value={data?.gridCompatibilityLabel ?? '—'} />
        <FactRow label="Capacité disponible" value={data?.gridAvailableLabel ? `${data.gridAvailableLabel} MW` : '—'} />
        <FactRow label="Tension / postes" value={data?.gridVoltageLabel ?? '—'} />
        <FactRow label="File d’attente" value={data?.gridQueueLabel ? `${data.gridQueueLabel} MW` : '—'} />
        <FactRow
          label="Poste repère"
          value={data?.gridStations?.[0] ? `${data.gridStations[0].name} · ${formatMw(data.gridStations[0].availableMw)} MW` : '—'}
        />
        <FactRow label="Eau / rivière" value={formatDistance(data?.nearestWaterKm)} />
        <FactRow label="Nappe" value={data?.groundwaterLabel ?? '—'} />
        <FactRow label="Débit rivière" value={data?.riverLabel ?? '—'} />
        <FactRow label="Sécheresse" value={data?.droughtLabel ?? '—'} />
        <FactRow label="Occupation sol" value={data?.landuseLabel ?? '—'} />
        <FactRow label="Prix foncier DVF" value={data?.landPriceLabel ?? '—'} />
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
      text: `${formatMw((selectedMetric?.lowCarbonKw ?? 0) / 1000)} MW bas carbone raccordés, dont nucléaire et renouvelables ODRÉ.`,
    },
    {
      id: 'grid',
      label: 'Qualifier le raccordement',
      text: `${formatMw(selectedMetric?.gridAvailableMw ?? 0)} MW de capacité réservée disponible et ${selectedMetric?.rteMaxVoltageKv ?? '—'} kV max côté postes RTE.`,
    },
    {
      id: 'access',
      label: 'Tester l’accès',
      text: 'Viser une route exploitable et un site à 10-15 km d’un bassin urbain, pas en cœur de ville.',
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
            aria-pressed={activeLayerId === item.id}
            onClick={() => setActiveLayerId(item.id)}
            className={cx(
              'scenario-choice border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
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

function Signal({ icon, isActive = false, label, mode, onClick, value }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cx(
        'signal-row grid grid-cols-[minmax(0,1fr)_auto] items-center border text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
        mode === 'tension' ? 'border-black p-3' : 'border-[#ded6c4] bg-[#fffaf0] p-4 hover:border-ink hover:bg-white',
        isActive && 'border-ink bg-white',
      )}
    >
      <span className="flex min-w-0 items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.18em]">
        {icon}
        <span className="min-w-0">{label}</span>
      </span>
      <span
        className={cx(
          'font-display leading-none tracking-normal',
          mode === 'tension' ? 'text-2xl font-light' : 'text-3xl font-normal text-ink',
        )}
      >
        {value}
      </span>
    </button>
  );
}

function DepartmentSearch({ departments, mode, selectedCode, setSelectedCode }) {
  const ordered = [...departments].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <label className="grid gap-2">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.22em]">Accès département</span>
      <select
        className={cx(
          'h-12 min-w-0 border bg-transparent px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
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
    <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)] sm:gap-4">
      <span className="min-w-0">{label}</span>
      <span className="min-w-0 break-words font-mono text-[0.68rem] uppercase tracking-[0.16em] sm:text-right">{value}</span>
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

function ScenarioPowerConfigurator({ mode, powerMw, selectedProfile, setPowerMw }) {
  const handleChange = (event) => {
    setPowerMw(Number(event.target.value));
  };

  return (
    <div className={cx('grid gap-3', mode === 'tension' ? 'text-black' : 'text-graphite')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-pewter">Configurateur IA</p>
          <p className="mt-2 font-display text-4xl leading-none text-ink">{formatScenarioPower(powerMw)}</p>
        </div>
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-pewter">{selectedProfile.label}</span>
      </div>
      <label className="grid gap-2">
        <span className="sr-only">Puissance du datacenter IA</span>
        <input
          type="range"
          min={SCENARIO_POWER_MIN_MW}
          max={SCENARIO_POWER_MAX_MW}
          step={SCENARIO_POWER_STEP_MW}
          value={powerMw}
          onChange={handleChange}
          className="w-full accent-[#bfa245]"
        />
      </label>
      <div className="flex items-center justify-between font-mono text-[0.56rem] uppercase tracking-[0.14em] text-pewter">
        <span>{formatScenarioPower(SCENARIO_POWER_MIN_MW)}</span>
        <span>{formatNumber(estimateGpuCount(powerMw))} GPU approx.</span>
        <span>{formatScenarioPower(SCENARIO_POWER_MAX_MW)}</span>
      </div>
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

function DataProvenanceModal({ energy, isOpen, mode, onClose, pointAnalysis }) {
  const confidence = buildConfidence(pointAnalysis, energy);
  const sourceMode = energy.source === 'live' ? 'Données publiques chargées' : 'Mode dégradé avec données embarquées';
  const localStatus = pointAnalysis.data
    ? `Point local qualifié autour de ${pointAnalysis.data.commune ?? 'la coordonnée sélectionnée'}`
    : 'Analyse locale non lancée: cliquez sur la carte pour interroger les sources au point.';
  const links = [
    ['ODRÉ parc électrique', ENERGY_DATASET_LINK],
    ['Caparéseau', CAPARESEAU_LINK],
    ['Postes RTE', RTE_SUBSTATIONS_LINK],
    ['Eco2mix temps réel', ECO2MIX_LINK],
    ['Géorisques', GEORISQUES_LINK],
    ['Open-Meteo', OPEN_METEO_LINK],
    ['Hub’Eau', HUBEAU_LINK],
    ['VigiEau', VIGIEAU_LINK],
    ['DVF foncier', DVF_LINK],
    ['API Adresse', API_ADRESSE_LINK],
    ['OpenStreetMap / Overpass', OVERPASS_LINK],
    ['GeoJSON France', GEOJSON_LINK],
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="data-provenance-modal"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/30 px-4 py-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="data-provenance-title"
          onClick={onClose}
        >
          <motion.div
            className={cx(
              'max-h-[88vh] w-full max-w-2xl overflow-y-auto border p-6 shadow-2xl',
              mode === 'tension' ? 'border-black bg-white' : 'border-[#d8d0bd] bg-[#fffaf0]',
            )}
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-5">
              <div className="grid gap-3">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-pewter">Provenance des données</p>
                <h3 id="data-provenance-title" className="font-display text-4xl leading-none text-ink">
                  Sources publiques & niveau de confiance
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="border border-current px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] transition hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4"
              >
                Fermer
              </button>
            </div>

            <div className="mt-8 grid gap-5">
              <div className="grid gap-3 text-sm leading-6">
                <FactRow label="Statut global" value={sourceMode} />
                <FactRow label="Confiance" value={`${confidence.label} · ${confidence.value}/100`} />
                <FactRow label="Signal live" value={`${energy.realtime.tauxCo2} gCO₂/kWh · ${energy.realtime.date} ${energy.realtime.heure}`} />
                <FactRow label="Analyse locale" value={localStatus} />
              </div>

              <p className="border-t border-current/20 pt-5 text-sm leading-6 text-graphite">
                Les scores sont des estimations de priorisation. Les API publiques peuvent être incomplètes, indisponibles ou
                agrégées à une maille départementale: chaque point doit être confirmé par études réseau, foncières,
                environnementales et administratives.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {links.map(([label, href]) => (
                  <a key={href} className="source-link justify-between" href={href} rel="noreferrer" target="_blank">
                    {label}
                    <ExternalLink aria-hidden="true" size={13} strokeWidth={1.4} />
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SourceLinks({ mode, onOpenLegal }) {
  const links = [
    ['ODRÉ parc électrique', ENERGY_DATASET_LINK],
    ['Caparéseau', CAPARESEAU_LINK],
    ['Postes RTE', RTE_SUBSTATIONS_LINK],
    ['Eco2mix temps réel', ECO2MIX_LINK],
    ['Géorisques', GEORISQUES_LINK],
    ['Open-Meteo', OPEN_METEO_LINK],
    ['Hub’Eau', HUBEAU_LINK],
    ['VigiEau', VIGIEAU_LINK],
    ['DVF foncier', DVF_LINK],
    ['API Adresse', API_ADRESSE_LINK],
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
      <button type="button" className="source-link" onClick={() => onOpenLegal('legal')}>
        Mentions légales
      </button>
      <button type="button" className="source-link" onClick={() => onOpenLegal('terms')}>
        Conditions d’utilisation
      </button>
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
              'border p-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4',
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
    rteGrid: gridCapacity.departments,
    source: 'fallback',
    status: 'loading',
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const [energyRows, realtimePayload, geojson] = await Promise.all([
          fetchPagedRecords(ENERGY_MIX_URL, controller.signal),
          fetchJson(ECO2MIX_URL, controller.signal, INITIAL_FETCH_TIMEOUT_MS),
          fetchJson(DEPARTMENTS_GEOJSON_URL, controller.signal, INITIAL_FETCH_TIMEOUT_MS),
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
            rteGrid: gridCapacity.departments,
            source: 'live',
            status: 'ready',
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        try {
          const geojson = await fetchJson(DEPARTMENTS_GEOJSON_URL, controller.signal, INITIAL_FETCH_TIMEOUT_MS);
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
      controller.abort();
    };
  }, []);

  return state;
}

function usePointAnalysis(point, selectedMetric, selectedProfile, realtime) {
  const [state, setState] = useState({ data: null, error: null, status: 'idle' });

  useEffect(() => {
    if (!point || !selectedMetric) {
      setState((current) =>
        current.status === 'idle' && current.data == null && current.error == null
          ? current
          : { data: null, error: null, status: 'idle' },
      );
      return undefined;
    }

    const controller = new AbortController();

    async function load() {
      setState((current) => ({ ...current, error: null, status: 'loading' }));
      try {
        const [riskResult, weatherResult, communeResult, addressResult, osmResult, terrainResult] = await Promise.allSettled([
          fetchJson(buildGeorisquesUrl(point), controller.signal, POINT_FETCH_TIMEOUT_MS),
          fetchJson(buildWeatherUrl(point), controller.signal, POINT_FETCH_TIMEOUT_MS),
          fetchJson(buildCommuneUrl(point), controller.signal, POINT_FETCH_TIMEOUT_MS),
          fetchJson(buildAddressUrl(point), controller.signal, POINT_FETCH_TIMEOUT_MS),
          fetchJson(buildOverpassUrl(point), controller.signal, POINT_FETCH_TIMEOUT_MS),
          fetchTerrain(point, selectedMetric.code, { signal: controller.signal }),
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
          terrain: terrainResult.status === 'fulfilled' ? terrainResult.value : null,
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
              terrain: null,
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

async function fetchJson(url, signal, timeoutMs = INITIAL_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', abortFromParent, { once: true });
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Source indisponible (${response.status})`);
    return response.json();
  } catch (error) {
    if (timedOut) throw new Error(`Source trop lente (${Math.round(timeoutMs / 1000)} s)`);
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromParent);
  }
}

async function fetchPagedRecords(baseUrl, signal) {
  const records = [];
  const pageSize = 100;

  for (let offset = 0; offset < 1200; offset += pageSize) {
    const payload = await fetchJson(`${baseUrl}&limit=${pageSize}&offset=${offset}`, signal, INITIAL_FETCH_TIMEOUT_MS);
    records.push(...(payload.results ?? []));
    if ((payload.results ?? []).length < pageSize) break;
  }

  return records;
}

function normalizeEnergyRows(rows) {
  const byCode = new Map();

  rows.forEach((row) => {
    const code = String(row.codedepartement ?? '');
    const filiere = row.filiere;
    if (!code || !filiere) return;

    const current =
      byCode.get(code) ??
      {
        capacities: {},
        code,
        name: row.departement ?? 'Département',
        sitesByFiliere: {},
      };

    current.capacities[filiere] = Number(row.capacity_kw ?? 0);
    current.sitesByFiliere[filiere] = Number(row.sites ?? 0);
    byCode.set(code, current);
  });

  return [...byCode.values()];
}

function normalizeDepartmentName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildDepartmentModel(departments, geojson, selectedProfile = PROFILE_PRESETS[0], realtime = FALLBACK_REALTIME, rteGrid = {}) {
  if (!geojson?.features?.length) {
    const fallbackItems = departments.map((department) => buildBareMetric(department, selectedProfile, rteGrid));
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
    const siteDensityPer100Km2 = (totalSites / Math.max(feature.areaKm2, 1)) * 100;
    const landPrice = landPrices[feature.code]?.price ?? null;
    const rteInfo = rteGrid[normalizeDepartmentName(feature.name)] ?? null;

    return {
      ...department,
      areaKm2: feature.areaKm2,
      centroid: feature.centroid,
      feature,
      hydroKw,
      latitude,
      landPrice,
      longitude,
      lowCarbonKw,
      nuclearKw,
      renewableKw,
      riskScore: estimateGeoRiskScore(longitude, latitude),
      solarKw,
      siteDensityPer100Km2,
      storageKw,
      thermalKw,
      totalSites,
      rteInfo,
    };
  });

  const maxLowCarbon = Math.max(...rawMetrics.map((item) => Math.log1p(item.lowCarbonKw)), 1);
  const maxArea = Math.max(...rawMetrics.map((item) => Math.sqrt(item.areaKm2)), 1);
  const maxHydro = Math.max(...rawMetrics.map((item) => Math.log1p(item.hydroKw)), 1);
  const maxNuclear = Math.max(...rawMetrics.map((item) => Math.log1p(item.nuclearKw)), 1);
  const maxRenewable = Math.max(...rawMetrics.map((item) => Math.log1p(item.renewableKw)), 1);
  const maxSiteDensity = Math.max(...rawMetrics.map((item) => item.siteDensityPer100Km2), 1);
  const maxSites = Math.max(...rawMetrics.map((item) => Math.log1p(item.totalSites)), 1);
  const maxStorage = Math.max(...rawMetrics.map((item) => Math.log1p(item.storageKw)), 1);
  const maxRteSites = Math.max(...rawMetrics.map((item) => Math.log1p(item.rteInfo?.totalSites ?? 0)), 1);
  const maxRteHighVoltage = Math.max(...rawMetrics.map((item) => Math.log1p(item.rteInfo?.highVoltageSites ?? 0)), 1);
  const nationalLandMedian = Number(landPrices._meta?.nationalMedian ?? 2400);
  const liveGridScore = buildLiveGridScore(realtime);

  const items = rawMetrics.map((item) => {
    const lowCarbonShare = item.lowCarbonKw / Math.max(item.lowCarbonKw + item.thermalKw, 1);
    const lowCarbonCapacityScore = (Math.log1p(item.lowCarbonKw) / maxLowCarbon) * 100;
    const nuclearAnchorScore = (Math.log1p(item.nuclearKw) / maxNuclear) * 100;
    const renewableDiversityScore = (Math.log1p(item.renewableKw) / maxRenewable) * 100;
    const storageFlexScore = (Math.log1p(item.storageKw) / maxStorage) * 100;
    const structuralEnergyScore = clamp(
      lowCarbonCapacityScore * 0.43 +
        nuclearAnchorScore * 0.19 +
        renewableDiversityScore * 0.23 +
        lowCarbonShare * 10 +
        storageFlexScore * 0.05,
      0,
      100,
    );
    const energyScore = clamp(structuralEnergyScore * 0.88 + liveGridScore * 0.12, 0, 100);
    const areaScore = (Math.sqrt(item.areaKm2) / maxArea) * 100;
    const densityPressure = clamp(item.siteDensityPer100Km2 / maxSiteDensity, 0, 1);
    const freeSpaceScore = clamp(100 - densityPressure * 72 - clamp(item.totalSites / 7000, 0, 1) * 18, 0, 100);
    const landPriceScore =
      item.landPrice == null ? 58 : clamp(100 - (item.landPrice / Math.max(nationalLandMedian, 1) - 0.55) * 72, 12, 100);
    const landScore = clamp(areaScore * 0.38 + freeSpaceScore * 0.38 + landPriceScore * 0.24, 0, 100);
    const latitudeCooling = clamp((item.latitude - 42.4) / 8.2, 0, 1);
    const coolingScore = clamp(latitudeCooling * 54 + (Math.log1p(item.hydroKw) / maxHydro) * 32 + lowCarbonShare * 14, 0, 100);
    const gridFit = buildGridFit(item.rteInfo, selectedProfile);
    const rteSiteScore =
      item.rteInfo?.totalSites ? (Math.log1p(item.rteInfo.totalSites) / maxRteSites) * 100 : Math.min(energyScore * 0.58, 52);
    const rteVoltageScore =
      item.rteInfo?.highVoltageSites
        ? (Math.log1p(item.rteInfo.highVoltageSites) / maxRteHighVoltage) * 100
        : item.rteInfo?.maxVoltageKv >= 90
          ? 46
          : 28;
    const gridScore = clamp(gridFit.score * 0.46 + rteVoltageScore * 0.28 + rteSiteScore * 0.16 + energyScore * 0.1, 0, 100);
    const accessScore = clamp(
      48 + (Math.log1p(item.totalSites) / maxSites) * 24 + (gridScore / 100) * 16 - (Math.sqrt(item.areaKm2) / maxArea) * 10,
      0,
      100,
    );
    const criteria = { access: accessScore, cooling: coolingScore, energy: energyScore, grid: gridScore, land: landScore, risk: item.riskScore };
    const datacenterScore = scoreCriteria(criteria, selectedProfile);

    return {
      ...item,
      accessScore,
      coolingScore,
      datacenterScore,
      energyScore,
      gridScore,
      gridCompatibilityLabel: gridFit.label,
      gridConfidenceLabel: item.rteInfo ? 'RTE départemental' : 'Proxy énergie',
      gridFit,
      gridAvailableMw: item.rteInfo?.availableMw ?? 0,
      gridQueueMw: item.rteInfo?.queueMw ?? 0,
      gridReservedMw: item.rteInfo?.reservedMw ?? 0,
      landScore,
      landPriceScore,
      rteHighVoltageSites: item.rteInfo?.highVoltageSites ?? 0,
      rteMaxVoltageKv: item.rteInfo?.maxVoltageKv ?? 0,
      rteSubstationCount: item.rteInfo?.totalSites ?? 0,
      rteTopStations: item.rteInfo?.topStations ?? [],
      rteTensions: item.rteInfo?.tensions ?? {},
    };
  });

  addRanks(items, ['datacenterScore', 'energyScore', 'gridScore', 'landScore', 'coolingScore', 'accessScore', 'riskScore']);

  return {
    byCode: new Map(items.map((item) => [item.code, item])),
    features,
    items,
    maxByLayer: {
      cooling: 100,
      energy: 100,
      grid: 100,
      land: 100,
      access: 100,
      risk: 100,
      score: 100,
    },
    projection,
  };
}

function buildBareMetric(department, selectedProfile = PROFILE_PRESETS[0], rteGrid = {}) {
  const rteInfo = rteGrid[normalizeDepartmentName(department.name)] ?? null;
  const gridFit = buildGridFit(rteInfo, selectedProfile);
  const criteria = {
    access: 52,
    cooling: 45,
    energy: 45,
    grid: rteInfo ? gridFit.score : 42,
    land: 45,
    risk: 45,
  };
  return {
    ...department,
    accessScore: criteria.access,
    coolingScore: criteria.cooling,
    datacenterScore: scoreCriteria(criteria, selectedProfile),
    energyScore: criteria.energy,
    gridCompatibilityLabel: gridFit.label,
    gridAvailableMw: rteInfo?.availableMw ?? 0,
    gridConfidenceLabel: rteInfo ? 'RTE départemental' : 'Proxy énergie',
    gridQueueMw: rteInfo?.queueMw ?? 0,
    gridReservedMw: rteInfo?.reservedMw ?? 0,
    gridScore: criteria.grid,
    landScore: criteria.land,
    lowCarbonKw: LOW_CARBON_FILIERES.reduce((sum, filiere) => sum + Number(department.capacities?.[filiere] ?? 0), 0),
    riskScore: criteria.risk,
    rteHighVoltageSites: rteInfo?.highVoltageSites ?? 0,
    rteMaxVoltageKv: rteInfo?.maxVoltageKv ?? 0,
    rteSubstationCount: rteInfo?.totalSites ?? 0,
    rteTopStations: rteInfo?.topStations ?? [],
    rteTensions: rteInfo?.tensions ?? {},
  };
}

function buildGridFit(rteInfo, profile = PROFILE_PRESETS[0]) {
  if (!rteInfo?.totalSites) {
    return {
      label: 'Non qualifié',
      score: 38,
      thresholdMw: profileToPowerNeedMw(profile),
    };
  }

  const thresholdMw = profileToPowerNeedMw(profile);
  const maxVoltageKv = rteInfo.maxVoltageKv ?? 0;
  const highVoltageSites = rteInfo.highVoltageSites ?? 0;
  const totalSites = rteInfo.totalSites ?? 0;
  const availableMw = Number(rteInfo.availableMw ?? 0);
  const voltageBase =
    maxVoltageKv >= 400 ? 96 : maxVoltageKv >= 225 ? 78 : maxVoltageKv >= 150 ? 64 : maxVoltageKv >= 90 ? 52 : 38;
  const densityBonus = clamp(Math.log1p(totalSites) * 9 + Math.log1p(highVoltageSites) * 13, 0, 38);
  const capacityScore = clamp((availableMw / Math.max(thresholdMw * 1.4, 1)) * 100, 0, 100);
  const profilePenalty =
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
              : 10;
  const score = clamp(capacityScore * 0.48 + voltageBase * 0.32 + densityBonus * 0.2 - profilePenalty, 0, 100);

  return {
    label:
      availableMw >= thresholdMw && score >= 72
        ? 'Compatible à instruire'
        : score >= 58
          ? 'Plausible sous réserve'
          : 'Contrainte forte',
    score,
    thresholdMw,
  };
}

function buildAiScenarioProfile(powerMw = 300) {
  const powerNeedMw = clamp(Number(powerMw) || 300, SCENARIO_POWER_MIN_MW, SCENARIO_POWER_MAX_MW);
  const scale = clamp(Math.log(powerNeedMw / SCENARIO_POWER_MIN_MW) / Math.log(SCENARIO_POWER_MAX_MW / SCENARIO_POWER_MIN_MW), 0, 1);
  const rawWeights = {
    access: 0.19 - scale * 0.18,
    cooling: 0.1 + scale * 0.05,
    energy: 0.24 + scale * 0.11,
    grid: 0.18 + scale * 0.18,
    land: 0.11 - scale * 0.02,
    risk: 0.18 - scale * 0.14,
  };
  const weightTotal = Object.values(rawWeights).reduce((sum, value) => sum + Math.max(value, 0.01), 0);
  const weights = Object.fromEntries(
    Object.entries(rawWeights).map(([key, value]) => [key, Math.max(value, 0.01) / weightTotal]),
  );
  const gpuCount = estimateGpuCount(powerNeedMw);
  const label =
    powerNeedMw >= 1_500
      ? 'Extension 2 GW'
      : powerNeedMw >= 700
        ? 'Campus 1 GW'
        : powerNeedMw >= 160
          ? 'Colossus ajusté'
          : 'Datacenter régional';

  return {
    description: 'Scénario ajustable par puissance: plus la puissance augmente, plus raccordement, énergie et refroidissement pèsent dans le score.',
    footprint: `${formatScenarioPower(powerNeedMw)} · ~${formatNumber(gpuCount)} GPU`,
    id: 'custom-ai-power',
    label,
    powerNeedMw,
    scenarioId: powerNeedMw >= 1_500 ? 'colossus-2-2gw' : powerNeedMw >= 700 ? 'colossus-2-1gw' : powerNeedMw >= 160 ? 'colossus-1-300mw' : 'baseline-30mw',
    weights,
  };
}

function estimateGpuCount(powerMw) {
  return Math.round((Number(powerMw ?? 0) * 667) / 1_000) * 1_000;
}

function profileToPowerNeedMw(profile = PROFILE_PRESETS[0]) {
  const powerNeedMw = Number(profile?.powerNeedMw ?? PROFILE_PRESETS[0].powerNeedMw);
  return Number.isFinite(powerNeedMw) && powerNeedMw > 0 ? powerNeedMw : PROFILE_PRESETS[0].powerNeedMw;
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
  const solaire = Number.isFinite(Number(realtime?.solaire)) ? Number(realtime.solaire) : 0;
  const consommation = Number.isFinite(Number(realtime?.consommation)) ? Number(realtime.consommation) : 1;
  const tauxCo2 = Number.isFinite(Number(realtime?.tauxCo2)) ? Number(realtime.tauxCo2) : 80;
  const solarShare = solaire / Math.max(consommation, 1);
  const carbonScore = clamp(100 - tauxCo2 * 0.9, 0, 100);
  const solarScore = clamp(solarShare / 0.32, 0, 1) * 100;
  return clamp(carbonScore * 0.72 + solarScore * 0.28, 0, 100);
}

function buildPointAnalysis({
  address,
  commune,
  metric,
  osm,
  point,
  profile = PROFILE_PRESETS[0],
  realtime = FALLBACK_REALTIME,
  risk,
  terrain,
  weather,
}) {
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
  const terrainCooling = terrain
    ? scoreTerrainCooling({
        drought: terrain.drought,
        groundwater: terrain.groundwater,
        nearestWaterKm: osmSignals.nearestWaterKm,
        river: terrain.river,
        temperatureC,
      })
    : null;
  const cooling = terrainCooling == null ? clamp(coolingTemperatureScore * 0.62 + waterScore * 0.38, 0, 100) : terrainCooling;
  const townScore = distanceBandScore(inferredTownKm, [
    [5, 28],
    [TOWN_TARGET_KM.idealMin, 68],
    [TOWN_TARGET_KM.idealMax, 100],
    [TOWN_TARGET_KM.workableMax, 78],
    [35, 56],
    [Infinity, 34],
  ]);
  const roadScore = distanceBandScore(inferredRoadKm, [
    [ROAD_TARGET_KM.idealMin, 72],
    [ROAD_TARGET_KM.idealMax, 96],
    [10, 84],
    [ROAD_TARGET_KM.workableMax, 66],
    [18, 46],
    [Infinity, 26],
  ]);
  const terrainLand = terrain
    ? scoreTerrainLand({
        landuse: terrain.landuse,
        nearestTownKm: inferredTownKm,
        price: terrain.price?.price,
      })
    : null;
  const land = terrainLand == null ? clamp(metric.landScore * 0.45 + townScore * 0.55, 0, 100) : clamp(metric.landScore * 0.22 + terrainLand * 0.78, 0, 100);
  const riskScore = clamp(riskSignals.seismicScore * 0.42 + riskSignals.floodScore * 0.46 + riskSignals.groundScore * 0.12, 0, 100);
  const access = clamp(roadScore * 0.72 + townScore * 0.28, 0, 100);
  const energy = clamp(metric.energyScore * 0.84 + buildLiveGridScore(realtime) * 0.16, 0, 100);
  const grid = clamp((metric.gridScore ?? 42) * 0.9 + roadScore * 0.1, 0, 100);
  const criteria = {
    access,
    cooling,
    energy,
    grid,
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
    groundMovementLabel: riskSignals.groundLabel,
    groundwaterLabel: formatGroundwater(terrain?.groundwater),
    gridAvailableLabel: formatMw(metric.gridAvailableMw ?? 0),
    gridCompatibilityLabel: metric.gridCompatibilityLabel ?? 'Non qualifié',
    gridConfidenceLabel: metric.gridConfidenceLabel ?? 'Départemental',
    gridQueueLabel: formatMw(metric.gridQueueMw ?? 0),
    gridScore: grid,
    gridStations: metric.rteTopStations ?? [],
    gridVoltageLabel: metric.rteMaxVoltageKv ? `${metric.rteMaxVoltageKv} kV max · ${metric.rteSubstationCount ?? 0} postes` : 'Non qualifié',
    droughtLabel: terrain?.drought?.label ?? 'Non mesuré',
    landPriceLabel: formatLandPrice(terrain?.price?.price ?? metric.landPrice),
    landuseLabel: formatLanduse(terrain?.landuse),
    nearestRoadKm: inferredRoadKm,
    nearestTownKm: inferredTownKm,
    nearestWaterKm: osmSignals.nearestWaterKm,
    riverLabel: formatRiver(terrain?.river),
    roadLabel: inferredRoadKm == null ? '—' : `${formatDistance(inferredRoadKm)} · ${osmSignals.nearestRoadKm == null ? 'BAN' : 'OSM'}`,
    roadTargetLabel: buildRoadTargetLabel(inferredRoadKm),
    riskConfidence: riskSignals.confidence,
    riskConfidenceLabel: riskSignals.confidenceLabel,
    score,
    seismicLabel: riskSignals.seismicLabel,
    summary,
    terrain,
    temperatureC,
    townTargetLabel: buildTownTargetLabel(inferredTownKm),
    townLabel:
      osmSignals.nearestTownKm == null && communePopulation
        ? `${formatDistance(inferredTownKm)} · ${formatNumber(communePopulation)} hab.`
        : formatDistance(inferredTownKm),
  };
}

function parseRiskSignals(risk) {
  if (!risk?.risquesNaturels) {
    return {
      confidence: 18,
      confidenceLabel: 'non qualifié',
      floodLabel: 'Non qualifié',
      floodScore: 60,
      groundLabel: 'Non qualifié',
      groundScore: 60,
      seismicLabel: 'Non qualifié',
      seismicScore: 60,
    };
  }

  const natural = risk?.risquesNaturels ?? {};
  const flood = natural.inondation;
  const seismic = natural.seisme;
  const clay = natural.retraitGonflementArgile;
  const movement = natural.mouvementTerrain;
  const floodStatus = flood?.libelleStatutAdresse ?? flood?.libelleStatutCommune ?? '';
  const seismicStatus = seismic?.libelleStatutAdresse ?? seismic?.libelleStatutCommune ?? '';
  const groundStatus = `${clay?.libelleStatutAdresse ?? ''} ${movement?.libelleStatutAdresse ?? ''}`;
  const knownSignals = [floodStatus, seismicStatus, groundStatus.trim()].filter((value) => value && !isUnknownRiskText(value));

  return {
    confidence: knownSignals.length >= 3 ? 86 : knownSignals.length === 2 ? 70 : knownSignals.length === 1 ? 52 : 28,
    confidenceLabel: knownSignals.length >= 2 ? 'qualifié' : 'partiel',
    floodLabel: floodStatus || 'Non qualifié',
    floodScore: scoreFloodText(floodStatus),
    groundLabel: groundStatus.trim() || 'Non qualifié',
    groundScore: scoreRiskText(groundStatus),
    seismicLabel: seismicStatus || 'Non qualifié',
    seismicScore: scoreRiskText(seismicStatus),
  };
}

function scoreFloodText(text) {
  const value = text.toLowerCase();
  if (isUnknownRiskText(value)) return 60;
  if (value.includes('existant') || value.includes('important') || value.includes('moyen') || value.includes('fort')) return 30;
  if (value.includes('modéré') || value.includes('modere')) return 50;
  if (value.includes('faible')) return 74;
  if (value.includes('aucun') || value.includes('absent') || value.includes('non concerné') || value.includes('non concerne')) return 90;
  return 58;
}

function scoreRiskText(text) {
  const value = text.toLowerCase();
  if (isUnknownRiskText(value)) return 60;
  if (value.includes('important') || value.includes('moyen') || value.includes('fort')) return 28;
  if (value.includes('modéré') || value.includes('modere')) return 54;
  if (value.includes('très faible') || value.includes('tres faible')) return 94;
  if (value.includes('faible')) return 82;
  if (value.includes('existant')) return 52;
  return 72;
}

function isUnknownRiskText(text) {
  const value = String(text ?? '').toLowerCase();
  return !value.trim() || value.includes('non connu') || value.includes('inconnu') || value.includes('non qualifié');
}

function parseOsmSignals(osm, point) {
  const elements = osm?.elements ?? [];
  const roads = [];
  const towns = [];
  const waters = [];

  elements.forEach((element) => {
    const location = element.center ?? (element.lat != null && element.lon != null ? { lat: element.lat, lon: element.lon } : null);
    if (!location) return;

    const lat = Number(location.lat);
    const lon = Number(location.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const distance = distanceKm(point, { lat, lon });
    if (!Number.isFinite(distance)) return;

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

function buildLocalMapCells(selectedFeature, selectedMetric, layerId, projection, isZoomed) {
  if (!isZoomed || !selectedFeature?.feature || !selectedMetric || !projection?.invert) return [];

  const { maxX, maxY, minX, minY } = selectedFeature.bounds;
  const span = Math.max(maxX - minX, maxY - minY);
  const size = clamp(span / 13, 9, 22);
  const cells = [];
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const maxDistance = Math.hypot(maxX - centerX, maxY - centerY) || 1;

  for (let y = minY; y < maxY; y += size) {
    for (let x = minX; x < maxX; x += size) {
      const point = [x + size / 2, y + size / 2];
      const lonLat = projection.invert(point);
      if (!lonLat || !geoContains(selectedFeature.feature, lonLat)) continue;

      const urbanity = 1 - clamp(Math.hypot(point[0] - centerX, point[1] - centerY) / maxDistance, 0, 1);
      const eastWest = clamp((point[0] - minX) / Math.max(maxX - minX, 1), 0, 1);
      const northSouth = clamp((point[1] - minY) / Math.max(maxY - minY, 1), 0, 1);
      const texture = Math.sin((eastWest * 6.7 + northSouth * 3.9) * Math.PI) * 0.5 + 0.5;
      const value = localLayerValue(selectedMetric, layerId, { eastWest, northSouth, texture, urbanity });

      cells.push({ id: `${Math.round(x)}-${Math.round(y)}`, size: size * 0.96, value, x, y });
    }
  }

  return cells;
}

function localLayerValue(metric, layerId, signals) {
  const base = layerValue(metric, layerId);
  const { eastWest, northSouth, texture, urbanity } = signals;
  const rurality = 1 - urbanity;
  const variationByLayer = {
    access: urbanity * 22 + texture * 8 - rurality * 14,
    cooling: northSouth * 18 + rurality * 12 - urbanity * 8 + texture * 8,
    energy: texture * 18 + eastWest * 8 - 10,
    grid: urbanity * 18 + eastWest * 10 + texture * 6 - 12,
    land: rurality * 28 - urbanity * 24 + texture * 10,
    risk: rurality * 12 + northSouth * 8 - texture * 18,
    score: rurality * 9 + urbanity * 8 + texture * 12 - 10,
  };

  return clamp(base + (variationByLayer[layerId] ?? variationByLayer.score), 0, 100);
}

function localCellFill(value, layerId) {
  const ratio = mapContrastRatioFromValue(value);
  const hue = layerHue(layerId);
  const saturation = 38 + ratio * 50;
  const lightness = 95 - ratio * 58;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function departmentFill(metric, layerId, mode, isSelected) {
  if (mode === 'tension') return isSelected ? '#000000' : '#ffffff';
  if (!metric) return '#fbfaf5';

  const ratio = mapContrastRatio(metric, layerId);
  const hue = layerHue(layerId);
  const saturation = 34 + ratio * 48;
  const lightness = 96 - ratio * 54;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function departmentStroke(metric, layerId, mode, isSelected) {
  if (isSelected) return '#141414';
  if (mode === 'tension') return '#000000';
  if (!metric) return '#d9d0bd';

  const ratio = mapContrastRatio(metric, layerId);
  const hue = layerHue(layerId);
  const saturation = 26 + ratio * 32;
  const lightness = 78 - ratio * 34;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function mapContrastRatio(metric, layerId) {
  return mapContrastRatioFromValue(layerValue(metric, layerId));
}

function mapContrastRatioFromValue(value) {
  const rawRatio = clamp(value / 100, 0, 1);
  return clamp((rawRatio - 0.18) / 0.74, 0, 1) ** 0.72;
}

function layerHue(layerId) {
  if (layerId === 'risk') return 92;
  if (layerId === 'cooling') return 192;
  if (layerId === 'grid') return 210;
  if (layerId === 'access') return 28;
  if (layerId === 'land') return 72;
  return 46;
}

function layerValue(metric, layerId) {
  if (!metric) return 0;
  if (layerId === 'energy') return metric.energyScore ?? 0;
  if (layerId === 'grid') return metric.gridScore ?? 0;
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

function buildTownTargetLabel(distance) {
  if (distance == null || !Number.isFinite(distance)) return 'Non mesuré';
  if (distance < 5) return 'Trop urbain';
  if (distance < TOWN_TARGET_KM.idealMin) return 'Proche';
  if (distance <= TOWN_TARGET_KM.idealMax) return 'Zone idéale';
  if (distance <= TOWN_TARGET_KM.workableMax) return 'Zone exploitable';
  return 'Trop isolé';
}

function buildRoadTargetLabel(distance) {
  if (distance == null || !Number.isFinite(distance)) return 'Non mesuré';
  if (distance < ROAD_TARGET_KM.idealMin) return 'Très proche voirie';
  if (distance <= ROAD_TARGET_KM.idealMax) return 'Accès idéal';
  if (distance <= ROAD_TARGET_KM.workableMax) return 'Accès exploitable';
  return 'Accès à vérifier';
}

function distanceBandScore(distance, bands) {
  if (distance == null || !Number.isFinite(distance)) return 50;
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

function formatScenarioPower(value) {
  const numericValue = Number(value ?? 0);
  const safeValue = Number.isFinite(numericValue) ? numericValue : SCENARIO_POWER_MIN_MW;
  if (safeValue >= 1_000) return `${formatDecimal(safeValue / 1_000)} GW`;
  return `${formatNumber(safeValue)} MW`;
}

function formatNumber(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('fr-FR').format(Math.round(Number.isFinite(numericValue) ? numericValue : 0));
}

function formatDecimal(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatDistance(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 1) return `${Math.round(value * 1000)} m`;
  return `${formatDecimal(value)} km`;
}

function formatGroundwater(groundwater) {
  if (!groundwater) return 'Non mesurée';
  const depth = groundwater.depthM != null ? `${formatDecimal(groundwater.depthM)} m` : 'profondeur inconnue';
  const distance = groundwater.distanceKm != null ? ` · ${formatDistance(groundwater.distanceKm)}` : '';
  return `${depth}${distance}`;
}

function formatRiver(river) {
  if (!river) return 'Non mesuré';
  const flow = river.flowM3s != null ? `${formatDecimal(river.flowM3s)} m³/s` : 'débit inconnu';
  const distance = river.distanceKm != null ? ` · ${formatDistance(river.distanceKm)}` : '';
  return `${flow}${distance}`;
}

function formatLanduse(landuse) {
  if (!landuse || landuse.openShare == null) return 'Non mesuré';
  const openShare = Math.round(clamp(landuse.openShare, 0, 1) * 100);
  return `${openShare}% ouvert${landuse.dominant ? ` · ${landuse.dominant}` : ''}`;
}

function formatLandPrice(value) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 'non mesuré';
  return `${formatNumber(numericValue)} €/m²`;
}

function formatPowerScale(valueMw) {
  const numericValue = Number(valueMw ?? 0);
  if (!Number.isFinite(numericValue)) return '0 MW';
  if (numericValue >= 1_000) return `${formatDecimal(numericValue / 1_000)} GW`;
  return `${formatMw(numericValue)} MW`;
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
}

const rootElement = document.getElementById('root');
const root = globalThis.__prismCenterRoot ?? createRoot(rootElement);
globalThis.__prismCenterRoot = root;
root.render(<App />);
