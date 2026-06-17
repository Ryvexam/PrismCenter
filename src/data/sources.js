// Sources de données « terrain » pour l'analyse au point (eau réelle + foncier).
// Module autonome, sans React : fonctions pures + fetchers, testables sous Node.
//
// Eau (temps réel, CORS OK) :
//   - Hub'Eau Piézométrie  → niveau des nappes souterraines
//   - Hub'Eau Hydrométrie  → débit des rivières
//   - VigiEau              → niveau de restriction sécheresse
// Foncier :
//   - Overpass landuse     → part d'espace ouvert (champ/forêt) vs bâti
//   - DVF (pré-agrégé)     → prix médian €/m² par département  (src/data/landPrices.json)
//
// Intégration dans main.jsx : appeler fetchTerrain(point, deptCode) en plus des
// appels existants, puis fusionner le résultat dans buildPointAnalysis.

import landPrices from './landPrices.js';

const EARTH_RADIUS_KM = 6371;

// Miroirs Overpass : on bascule au suivant si 406 / timeout (overpass-api.de throttle).
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function distanceKm(aLat, aLon, bLat, bLon) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// fetch JSON avec timeout dur (AbortController), tolérant aux signaux externes.
async function fetchJsonTimeout(url, { timeoutMs = 4500, signal, options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/* ------------------------------------------------------------------ */
/* URL builders                                                        */
/* ------------------------------------------------------------------ */

function bbox(point, d) {
  // Hub'Eau attend bbox = lon_min,lat_min,lon_max,lat_max
  return `${point.lon - d},${point.lat - d},${point.lon + d},${point.lat + d}`;
}

export function buildPiezoUrl(point, d = 0.25) {
  return `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques_tr?bbox=${bbox(
    point,
    d,
  )}&size=40&sort=desc`;
}

export function buildHydroUrl(point, d = 0.3) {
  return `https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?bbox=${bbox(
    point,
    d,
  )}&grandeur_hydro=Q&size=20&sort=desc`;
}

export function buildVigieauUrl(point) {
  return `https://api.vigieau.beta.gouv.fr/api/zones?lat=${point.lat}&lon=${point.lon}&profil=entreprise`;
}

export function buildLanduseQuery(point, radius = 1500) {
  const kinds =
    'farmland|meadow|forest|orchard|vineyard|grass|greenfield|scrub|heath';
  const built = 'residential|commercial|industrial|retail|construction';
  return `[out:json][timeout:10];(way(around:${radius},${point.lat},${point.lon})["landuse"~"${kinds}"];way(around:${radius},${point.lat},${point.lon})["landuse"~"${built}"];way(around:${radius},${point.lat},${point.lon})["natural"~"wood|water|wetland"];);out tags;`;
}

/* ------------------------------------------------------------------ */
/* Parsers → signaux normalisés                                        */
/* ------------------------------------------------------------------ */

// Niveau de nappe : on prend la station la plus proche du point.
export function parseGroundwater(json, point) {
  const rows = json?.data ?? [];
  let best = null;
  for (const r of rows) {
    const lat = r.latitude ?? r.geometry?.coordinates?.[1];
    const lon = r.longitude ?? r.geometry?.coordinates?.[0];
    if (lat == null || lon == null) continue;
    const depth = r.profondeur_nappe;
    if (depth == null) continue;
    const dist = distanceKm(point.lat, point.lon, lat, lon);
    if (!best || dist < best.distanceKm) {
      best = { depthM: depth, distanceKm: dist, date: r.date_mesure, station: r.code_bss };
    }
  }
  return best; // null si aucune station exploitable dans la bbox
}

// Débit de la rivière la plus pertinente pour le refroidissement : on privilégie
// le plus gros débit dans la zone (un fleuve proche > un ruisseau plus proche).
// observations_tr → resultat_obs en litres/seconde.
export function parseRiverFlow(json, point) {
  const rows = json?.data ?? [];
  let best = null;
  for (const r of rows) {
    const lat = r.latitude ?? r.geometry?.coordinates?.[1];
    const lon = r.longitude ?? r.geometry?.coordinates?.[0];
    const q = r.resultat_obs; // litres/seconde
    if (q == null) continue;
    const dist = lat != null && lon != null ? distanceKm(point.lat, point.lon, lat, lon) : null;
    if (!best || q > best._q) {
      best = { _q: q, flowM3s: q / 1000, distanceKm: dist, station: r.code_station };
    }
  }
  if (best) delete best._q;
  return best;
}

// VigiEau : niveau de restriction le plus sévère sur les zones renvoyées.
const DROUGHT_ORDER = ['vigilance', 'alerte', 'alerte_renforcee', 'crise'];
const DROUGHT_LABEL = {
  vigilance: 'Vigilance',
  alerte: 'Alerte',
  alerte_renforcee: 'Alerte renforcée',
  crise: 'Crise',
};
const DROUGHT_PENALTY = { none: 0, vigilance: 8, alerte: 22, alerte_renforcee: 38, crise: 55 };

export function parseDrought(json) {
  const zones = Array.isArray(json) ? json : json?.zones ?? [];
  let worst = -1;
  for (const z of zones) {
    const lvl = (z.niveauGravite ?? z.niveau_gravite ?? z.niveau ?? '').toString().toLowerCase();
    const idx = DROUGHT_ORDER.indexOf(lvl);
    if (idx > worst) worst = idx;
  }
  const level = worst >= 0 ? DROUGHT_ORDER[worst] : 'none';
  return {
    level,
    label: worst >= 0 ? DROUGHT_LABEL[level] : 'Aucune restriction',
    penalty: DROUGHT_PENALTY[level] ?? 0,
  };
}

// Part d'espace ouvert (champ/forêt) vs bâti, à partir des landuse Overpass.
export function parseLanduse(json) {
  const open = new Set([
    'farmland', 'meadow', 'forest', 'orchard', 'vineyard', 'grass', 'greenfield', 'scrub', 'heath',
  ]);
  const built = new Set(['residential', 'commercial', 'industrial', 'retail', 'construction']);
  let openCount = 0;
  let builtCount = 0;
  let dominant = null;
  const tally = {};
  for (const el of json?.elements ?? []) {
    const lu = el.tags?.landuse;
    const nat = el.tags?.natural;
    if (lu && open.has(lu)) openCount += 1;
    else if (lu && built.has(lu)) builtCount += 1;
    else if (nat === 'wood') openCount += 1;
    const key = lu ?? nat;
    if (key) tally[key] = (tally[key] ?? 0) + 1;
  }
  const total = openCount + builtCount;
  for (const k in tally) if (!dominant || tally[k] > tally[dominant]) dominant = k;
  return {
    openShare: total ? openCount / total : null,
    openCount,
    builtCount,
    dominant,
  };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function bandScore(value, bands, fallback = 50) {
  if (value == null || Number.isNaN(value)) return fallback;
  return bands.find(([max]) => value <= max)?.[1] ?? bands[bands.length - 1][1];
}

// Nappe peu profonde + station proche = ressource accessible.
export function groundwaterScore(gw) {
  if (!gw) return null;
  const depth = bandScore(gw.depthM, [
    [3, 92], [8, 84], [15, 70], [30, 52], [60, 34], [Infinity, 20],
  ]);
  const near = bandScore(gw.distanceKm, [
    [5, 1], [12, 0.92], [25, 0.78], [Infinity, 0.6],
  ]);
  return clamp(depth * near, 0, 100);
}

export function riverScore(river) {
  if (!river || river.flowM3s == null) return null;
  // log : un fleuve à 50 m³/s sature, un ruisseau à 0.2 m³/s reste faible.
  return clamp(28 + Math.log10(Math.max(river.flowM3s, 0.05) + 1) * 52, 0, 100);
}

export function surfaceWaterScore(nearestWaterKm) {
  return bandScore(nearestWaterKm, [
    [0.2, 34], [2, 92], [8, 82], [18, 56], [Infinity, 32],
  ]);
}

export function temperatureScore(temperatureC) {
  if (temperatureC == null) return 58;
  return clamp(100 - Math.max(temperatureC - 12, 0) * 4, 12, 100);
}

// Refroidissement = température + eau réelle (nappe, rivière, surface) − sécheresse.
export function coolingScore({ temperatureC, groundwater, river, nearestWaterKm, drought }) {
  const t = temperatureScore(temperatureC);
  const gw = groundwaterScore(groundwater);
  const rv = riverScore(river);
  const sw = surfaceWaterScore(nearestWaterKm);
  // Pondération adaptative : on ignore les signaux absents.
  const parts = [
    [t, 0.3],
    [gw, 0.3],
    [rv, 0.18],
    [sw, 0.22],
  ].filter(([v]) => v != null);
  const wsum = parts.reduce((s, [, w]) => s + w, 0) || 1;
  const base = parts.reduce((s, [v, w]) => s + v * w, 0) / wsum;
  return clamp(base - (drought?.penalty ?? 0), 0, 100);
}

/* ------------------------------------------------------------------ */
/* Foncier : prix DVF + espace                                         */
/* ------------------------------------------------------------------ */

export function getLandPrice(deptCode) {
  const entry = landPrices[deptCode];
  if (entry?.price) return { price: entry.price, n: entry.n, estimated: false };
  const fallback = landPrices._meta?.nationalMedian ?? 2060;
  return { price: fallback, n: 0, estimated: true };
}

// Moins cher = meilleur score foncier.
export function priceScore(price) {
  return bandScore(price, [
    [1200, 95], [1600, 85], [2100, 72], [2800, 56], [4000, 38], [6000, 22], [Infinity, 8],
  ]);
}

export function openSpaceScore(landuse) {
  if (!landuse || landuse.openShare == null) return null;
  return clamp(landuse.openShare * 100, 0, 100);
}

export function townDistanceScore(nearestTownKm) {
  return bandScore(nearestTownKm, [
    [4, 24], [9, 58], [15, 92], [30, 80], [Infinity, 50],
  ]);
}

// landScore = 0.5·espace + 0.3·prixBas + 0.2·éloignement ville (README §3).
export function landScore({ landuse, price, nearestTownKm }) {
  const space = openSpaceScore(landuse);
  const cheap = priceScore(price);
  const town = townDistanceScore(nearestTownKm);
  const parts = [
    [space, 0.5],
    [cheap, 0.3],
    [town, 0.2],
  ].filter(([v]) => v != null);
  const wsum = parts.reduce((s, [, w]) => s + w, 0) || 1;
  return clamp(parts.reduce((s, [v, w]) => s + v * w, 0) / wsum, 0, 100);
}

/* ------------------------------------------------------------------ */
/* Overpass landuse avec bascule de miroir                             */
/* ------------------------------------------------------------------ */

export async function fetchLanduse(point, { signal } = {}) {
  const query = buildLanduseQuery(point);
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const json = await fetchJsonTimeout(`${endpoint}?data=${encodeURIComponent(query)}`, {
        timeoutMs: 4500,
        signal,
      });
      return parseLanduse(json);
    } catch {
      // miroir suivant
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Orchestrateur : tout le « terrain » d'un point en une fonction      */
/* ------------------------------------------------------------------ */

export async function fetchTerrain(point, deptCode, { signal } = {}) {
  const [piezo, hydro, vigieau, landuse] = await Promise.allSettled([
    fetchJsonTimeout(buildPiezoUrl(point), { signal, timeoutMs: 4500 }),
    fetchJsonTimeout(buildHydroUrl(point), { signal, timeoutMs: 4500 }),
    fetchJsonTimeout(buildVigieauUrl(point), { signal, timeoutMs: 4500 }),
    fetchLanduse(point, { signal }),
  ]);

  const groundwater = piezo.status === 'fulfilled' ? parseGroundwater(piezo.value, point) : null;
  const river = hydro.status === 'fulfilled' ? parseRiverFlow(hydro.value, point) : null;
  const drought = vigieau.status === 'fulfilled' ? parseDrought(vigieau.value) : null;
  const landuseData = landuse.status === 'fulfilled' ? landuse.value : null;
  const land = getLandPrice(deptCode);

  return { groundwater, river, drought, landuse: landuseData, price: land };
}
