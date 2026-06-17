# PrismCenter

[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Déploiement-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Licence](https://img.shields.io/badge/licence-MIT-111111)](LICENSE)
[![Statut](https://img.shields.io/badge/statut-prototype_hackathon-e7c85d)](#statut-hackathon)
[![Données](https://img.shields.io/badge/données-publiques-2f855a)](#sources-de-données)

**PrismCenter est un prototype cartographique d'aide à l'identification de territoires propices à l'implantation de datacenters IA en France, à partir de données publiques.**

L'application croise des signaux énergétiques, fonciers, climatiques, hydrologiques, d'accès et de risques naturels pour produire un score d'aptitude. Elle aide à prioriser une instruction de site; elle ne remplace ni une étude technique, ni une étude réglementaire, ni une décision d'investissement.

## Pitch Produit

Les datacenters IA concentrent de fortes contraintes: puissance électrique bas carbone, refroidissement, foncier disponible, exposition aux risques naturels, accès opérationnel et acceptabilité territoriale.

PrismCenter propose une lecture energie-first de ces contraintes:

1. visualiser les départements français par potentiel électrique bas carbone;
2. sélectionner un département pour concentrer l'analyse;
3. cliquer un point sur la carte pour déclencher une analyse locale du score énergie-site;
4. comparer les critères qui soutiennent ou fragilisent le site.

Le produit assume une approche transparente: chaque score est une estimation issue de sources publiques et de pondérations documentées, pas une vérité réglementaire.

## Fonctionnalités

- Carte de France interactive avec géométrie départementale.
- Couche énergie bas carbone affichée par défaut pour ancrer le parcours dans le thème énergie.
- Pré-score départemental pour repérer les zones à instruire en priorité.
- Analyse locale au clic: énergie, risques, foncier, refroidissement et accès.
- Profils de pondération selon le type de datacenter: cluster d'entraînement, campus souverain, inférence régionale.
- Pages méthode dédiées aux indices et aux limites de calcul.
- Fallbacks locaux pour conserver une expérience lisible si une API publique est indisponible.
- Interface éditoriale en français, orientée démonstration professionnelle.

## Sources De Données

PrismCenter s'appuie sur des jeux publics et des API ouvertes. Leur disponibilité, leur fraîcheur et leur couverture peuvent varier.

| Source | Usage principal | Niveau | Mode d'utilisation |
| --- | --- | --- | --- |
| [ODRÉ - registre national production et stockage](https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege/information/) | Puissance installée bas carbone et sites par filière | Département | Chargement au démarrage avec fallback |
| [ODRÉ - Eco2mix national temps réel](https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/information/) | Consommation, solaire et intensité CO2 nationale | National | Chargement au démarrage avec fallback |
| [Géorisques](https://www.georisques.gouv.fr/) | Inondation, sismicité, mouvements de terrain, retrait-gonflement | Point cliqué | Appel live |
| [Open-Meteo](https://open-meteo.com/) | Température locale | Point cliqué | Appel live |
| [OpenStreetMap / Overpass](https://overpass-turbo.eu/) | Routes, eau de surface, occupation des sols | Point cliqué | Appel live, dépendant des miroirs Overpass |
| [Hub'Eau](https://hubeau.eaufrance.fr/) | Piézométrie et hydrométrie | Point cliqué | Appel live |
| [VigiEau](https://vigieau.gouv.fr/) | Niveau de restriction sécheresse | Point cliqué | Appel live |
| [DVF / geo-dvf](https://files.data.gouv.fr/geo-dvf/) | Prix foncier agrégé | Local pré-agrégé | Donnée embarquée, non appelée en live |
| [API Adresse](https://adresse.data.gouv.fr/api-doc/adresse) | Communes et contexte territorial | Point cliqué | Appel live selon disponibilité |
| [france-geojson](https://github.com/gregoiredavid/france-geojson) | Contours départementaux | Carte | Chargement de la géométrie publique |

## Modèle De Score

Le score global combine cinq familles de critères:

- **Énergie bas carbone**: puissance installée, diversité des filières et signal réseau national.
- **Risques naturels**: aperçu cartographique à l'échelle départementale, puis données Géorisques au point.
- **Foncier**: surface, pression territoriale, prix DVF agrégé et occupation locale des sols.
- **Refroidissement**: température, eau de surface, nappe, débit et restrictions sécheresse.
- **Accès**: proximité raisonnable des routes et bassins humains nécessaires à l'exploitation.

Les pondérations varient selon le profil sélectionné. Elles servent à hiérarchiser des opportunités d'instruction, pas à certifier la constructibilité d'un terrain.

## Architecture

```text
.
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── src/
│   ├── main.jsx
│   ├── styles.css
│   └── data/
│       ├── indices.js
│       └── ...
└── docs/
    ├── LEGAL.md
    ├── TERMS.md
    └── PRIVACY.md
```

Stack principale:

- **React 19** pour l'interface.
- **Vite 8** pour le développement et le build.
- **Tailwind CSS 3.4** pour le système visuel.
- **d3-geo** pour la projection cartographique.
- **Framer Motion** pour les transitions.
- **Lucide React** pour l'iconographie.

## Installation

Prérequis:

- Node.js récent compatible avec Vite 8.
- npm.

```bash
npm install
npm run dev
```

Par défaut, le serveur de développement Vite est exposé sur:

```text
http://127.0.0.1:5173
```

## Scripts

```bash
npm run dev       # lance l'application en local
npm run build     # génère le build de production
npm run preview   # prévisualise le build localement
```

## Variables D'Environnement

Aucune variable d'environnement n'est requise pour lancer le prototype dans son état actuel.

Les sources publiques sont appelées directement depuis le navigateur ou embarquées dans les données du projet. Si le projet évolue vers un usage de production, il faudra envisager un backend ou des fonctions serverless pour:

- maîtriser les délais d'appel et les quotas;
- mettre en cache les réponses;
- éviter d'exposer d'éventuels secrets;
- stabiliser les API publiques sujettes aux limites CORS, rate limits ou indisponibilités temporaires.

## Déploiement Vercel

PrismCenter est une application statique Vite et peut être déployée sur Vercel avec la configuration standard:

- **Framework Preset**: Vite
- **Install Command**: `npm install`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

Déploiement via CLI:

```bash
npm install -g vercel
vercel
vercel --prod
```

Aucune variable Vercel n'est nécessaire tant que l'application conserve son fonctionnement sans backend.

Le fichier [`vercel.json`](vercel.json) versionne ces choix dans le dépôt: preset Vite, build `npm run build`, sortie `dist`, fallback SPA vers `index.html` et en-têtes HTTP de base.

## Limites Connues

- Le score est une estimation exploratoire, non une recommandation réglementaire ou financière.
- Les appels live à des API publiques peuvent échouer, expirer ou retourner des données incomplètes.
- Les données DVF sont agrégées et ne décrivent pas la disponibilité réelle d'une parcelle.
- Le modèle ne lit pas les PLU, servitudes, contraintes ICPE, capacités de raccordement, files d'attente réseau, propriétés cadastrales, coûts de renforcement ou autorisations environnementales.
- L'intensité carbone Eco2mix est utilisée comme signal national, pas comme mesure locale de disponibilité électrique.
- La présence d'eau ne signifie pas droit de prélèvement, droit de rejet ou acceptabilité environnementale.

## Roadmap Décisionnelle

Les prochaines extensions doivent ajouter des preuves de décision, pas seulement de nouveaux scores décoratifs.

| Priorité | Module | Question traitée | Données publiques candidates | Impact démo |
| --- | --- | --- | --- | --- |
| 1 | Raccordement électrique | Où approcher 30, 80 ou 200 MW de manière crédible ? | Caparéseau, capacités d'accueil réseau, postes source, données RTE disponibles | Très fort |
| 2 | Urbanisme / constructibilité | Le terrain est-il au moins plausible au regard du zonage ? | API Carto du Géoportail de l'Urbanisme, PLU, documents GPU | Très fort |
| 3 | No-go environnemental | Qu'est-ce qui peut tuer le site avant étude technique ? | Natura 2000, ZNIEFF, INPN, ICPE, SEVESO, Géorisques | Très fort |
| 4 | Chaleur fatale | Peut-on transformer la chaleur du datacenter en bénéfice territorial ? | France Chaleur Urbaine, tracés réseaux de chaleur/froid, besoins Cerema | Élevé |
| 5 | Connectivité numérique | Le site est-il exploitable comme infrastructure numérique ? | ARCEP THD, zonage France Très Haut Débit, données de déploiement fibre | Moyen à élevé |

## Sécurité Et Robustesse

- Aucun secret applicatif ne doit être placé dans le code client.
- Les données externes doivent être traitées comme non fiables: timeouts, valeurs absentes et formats variables sont à anticiper.
- Les décisions critiques doivent être prises à partir d'études qualifiées et de sources officielles vérifiées.
- En production, il serait préférable d'introduire une couche serveur pour le cache, l'observabilité, la validation des réponses et la protection contre les abus.

## Documents Publics

- [Licence MIT](LICENSE)
- [Notice et attributions](NOTICE.md)
- [Notices des dépendances tierces](THIRD_PARTY_NOTICES.md)
- [Licences et attributions des données](docs/DATA_LICENSES.md)
- [Mentions légales](docs/LEGAL.md)
- [Conditions d'utilisation](docs/TERMS.md)
- [Politique de confidentialité](docs/PRIVACY.md)

## Statut Hackathon

PrismCenter est un prototype de hackathon. Son objectif est de démontrer une approche produit, data et cartographique crédible en temps limité.

Le projet n'est pas présenté comme un service certifié, un outil de conseil juridique, un outil de conseil financier, une étude d'implantation exhaustive ou un système de décision automatisée. Toute utilisation opérationnelle nécessiterait une consolidation des données, une revue juridique, une architecture de production et une validation métier.
