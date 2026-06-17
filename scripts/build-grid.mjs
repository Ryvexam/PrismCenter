import fs from 'node:fs/promises';

const CAPARESEAU_CSV_URL = 'https://www.capareseau.fr/medias/EEF3B73A-27D0-9574-4D9E-ADFE0395905D';
const RTE_POSTES_URL =
  'https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/postes-electriques-rte/records?select=code_poste%2Cnom_poste%2Cfonction%2Cetat%2Ctension%2Cdepartement&where=departement%20is%20not%20null%20and%20etat%3D%22EN%20EXPLOITATION%22%20and%20fonction%3D%22Poste%20de%20transformation%22';

const OUTPUT = new URL('../src/data/gridCapacity.json', import.meta.url);

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ';' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }

  return rows;
};

const toNumber = (value) => {
  const normalized = String(value ?? '')
    .replace('%', '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseVoltageKv = (value) => {
  const match = String(value ?? '').match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

const normalizeName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

const fetchPaged = async (baseUrl) => {
  const records = [];
  const pageSize = 100;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const response = await fetch(`${baseUrl}&limit=${pageSize}&offset=${offset}`);
    if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${baseUrl}`);
    const payload = await response.json();
    records.push(...(payload.results ?? []));
    if ((payload.results ?? []).length < pageSize) break;
  }
  return records;
};

const [capareseauResponse, rteRows] = await Promise.all([fetch(CAPARESEAU_CSV_URL), fetchPaged(RTE_POSTES_URL)]);
if (!capareseauResponse.ok) throw new Error(`Capareseau fetch failed: ${capareseauResponse.status}`);

const capareseauText = await capareseauResponse.text();
const rows = parseCsv(capareseauText);
const headers = rows[0];
const records = rows.slice(2).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));

const rteByCode = new Map(rteRows.map((row) => [row.code_poste, row]));
const byDepartment = {};
let matched = 0;

records.forEach((record) => {
  const rte = rteByCode.get(record.Code);
  if (!rte?.departement) return;
  matched += 1;

  const key = normalizeName(rte.departement);
  const voltageKv = parseVoltageKv(rte.tension);
  const availableMw = toNumber(record.RTE_CDR) + toNumber(record.GRD1_CDR) + toNumber(record.GRD2_CDR) + toNumber(record.GRDHTB_CDR);
  const queueMw = toNumber(record.INFO_FAS3R) + toNumber(record.RTE_FAS3R) + toNumber(record.GRD1_FAS3R) + toNumber(record.GRD2_FAS3R);
  const reservedMw = toNumber(record.INFO_CR);
  const serviceMw = toNumber(record.INFO_ESS3R) + toNumber(record.RTE_ESS3R) + toNumber(record.GRD1_ESS3R) + toNumber(record.GRD2_ESS3R);
  const transformerMw = toNumber(record.GRD1_PTRE) + toNumber(record.GRD2_PTRE);
  const works = [record.RTE_TVX, record.GRD1_TVX, record.GRD2_TVX, record.GRDHTB_TVX]
    .filter(Boolean)
    .filter((value) => !/^0$|^sans objet$/i.test(String(value).trim()));

  const current =
    byDepartment[key] ??
    {
      availableMw: 0,
      highVoltageSites: 0,
      maxVoltageKv: 0,
      matchedCapareseauSites: 0,
      name: rte.departement,
      queueMw: 0,
      reservedMw: 0,
      serviceMw: 0,
      source: 'Capareseau + ODRÉ postes électriques RTE',
      tensions: {},
      topStations: [],
      totalSites: 0,
      transformerMw: 0,
      worksCount: 0,
    };

  current.availableMw += availableMw;
  current.queueMw += queueMw;
  current.reservedMw += reservedMw;
  current.serviceMw += serviceMw;
  current.transformerMw += transformerMw;
  current.worksCount += works.length;
  current.totalSites += 1;
  current.matchedCapareseauSites += 1;
  current.maxVoltageKv = Math.max(current.maxVoltageKv, voltageKv);
  if (voltageKv >= 225) current.highVoltageSites += 1;
  if (voltageKv) current.tensions[`${voltageKv}kV`] = (current.tensions[`${voltageKv}kV`] ?? 0) + 1;
  current.topStations.push({
    availableMw: Math.round(availableMw * 10) / 10,
    code: record.Code,
    name: record.Nom || rte.nom_poste,
    queueMw: Math.round(queueMw * 10) / 10,
    reservedMw: Math.round(reservedMw * 10) / 10,
    tension: rte.tension,
    works: works.slice(0, 2),
  });
  byDepartment[key] = current;
});

Object.values(byDepartment).forEach((department) => {
  department.availableMw = Math.round(department.availableMw * 10) / 10;
  department.queueMw = Math.round(department.queueMw * 10) / 10;
  department.reservedMw = Math.round(department.reservedMw * 10) / 10;
  department.serviceMw = Math.round(department.serviceMw * 10) / 10;
  department.transformerMw = Math.round(department.transformerMw * 10) / 10;
  department.topStations = department.topStations
    .sort((a, b) => b.availableMw - a.availableMw)
    .slice(0, 4);
});

const payload = {
  departments: byDepartment,
  meta: {
    capareseauCsvUrl: CAPARESEAU_CSV_URL,
    generatedAt: new Date().toISOString(),
    matchedCapareseauRows: matched,
    records: records.length,
    rteDatasetUrl: 'https://odre.opendatasoft.com/explore/dataset/postes-electriques-rte/information/',
  },
};

await fs.writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${OUTPUT.pathname} (${Object.keys(byDepartment).length} departments, ${matched} matched rows)`);
