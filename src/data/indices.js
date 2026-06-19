const SOURCE_LINKS = {
  odreEnergy:
    'https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege/information/',
  eco2mix: 'https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/information/',
  georisques: 'https://www.georisques.gouv.fr/',
  openMeteo: 'https://open-meteo.com/',
  hubEau: 'https://hubeau.eaufrance.fr/',
  vigieau: 'https://vigieau.gouv.fr/',
  dvf: 'https://files.data.gouv.fr/geo-dvf/',
  apiAdresse: 'https://adresse.data.gouv.fr/api-doc/adresse',
  capareseau:
    'https://www.services-rte.com/fr/decouvrez-nos-offres-de-services/consulter-les-capacites-d-accueil-du-reseau-capareseau.html',
  overpass: 'https://overpass-turbo.eu/',
  geojsonFrance: 'https://github.com/gregoiredavid/france-geojson',
  rteSubstations: 'https://odre.opendatasoft.com/explore/dataset/postes-electriques-rte/information/',
};

const dataSource = ({ name, link, usage, freshness }) => ({
  name,
  link,
  usage,
  freshness,
});

export const INDICE_PAGES = [
  {
    id: 'score',
    label: 'Score IA',
    title: 'Score global d’opportunité',
    shortLabel: 'Score',
    question: 'Comment PrismCenter classe-t-il les territoires à instruire en premier ?',
    scoreMeaning:
      'Le score global agrège les six indices opérationnels pour produire une priorité d’instruction. Il ne décide pas qu’un site est constructible: il hiérarchise les territoires et les points qui méritent une étude technique.',
    formulaSteps: [
      'Calculer les six indices: énergie bas carbone, raccordement électrique, risques naturels, foncier, refroidissement et accès travailleurs.',
      'Appliquer les pondérations du scénario choisi: Colossus 1 à 300 MW, campus 1 GW, extension 2 GW ou référence régionale 30 MW.',
      'Sur la carte, utiliser les signaux départementaux disponibles au chargement.',
      'Au point cliqué, remplacer ou ajuster les indices par les signaux locaux disponibles: Géorisques, météo, eau, sécheresse, route, ville, foncier local.',
      'Afficher séparément le niveau de confiance pour ne pas confondre score élevé et décision juridiquement qualifiée.',
    ],
    dataSources: [
      dataSource({
        name: 'Indices PrismCenter',
        link: SOURCE_LINKS.geojsonFrance,
        usage: 'Agrégation des six indices documentés dans les pages méthode.',
        freshness: 'Recalculé dans le navigateur à chaque changement de scénario, de département ou de point.',
      }),
      dataSource({
        name: 'ODRÉ, Caparéseau, postes électriques RTE, Eco2mix, Géorisques, Open-Meteo, Hub’Eau, VigiEau, DVF, API Adresse, OpenStreetMap',
        link: SOURCE_LINKS.odreEnergy,
        usage: 'Sources publiques utilisées par les indices sous-jacents.',
        freshness: 'Mélange de données live au clic et de jeux pré-agrégés quand les appels publics sont lourds ou instables.',
      }),
    ],
    limitations: [
      'Le score global ne remplace pas les études réseau, foncières, environnementales, sûreté, urbanisme et raccordement.',
      'Les pondérations sont des hypothèses de priorisation, pas des seuils réglementaires.',
      'Un score faible peut venir d’un signal absent ou non qualifié; le panneau de confiance précise ce niveau de prudence.',
    ],
    whyItMatters:
      'Pour un projet datacenter IA, la vraie question n’est pas seulement “où l’énergie est-elle forte ?” mais “où l’ensemble énergie, raccordement, risques, foncier, refroidissement et accès justifie du temps d’instruction ?”.',
  },
  {
    id: 'energy',
    label: 'Énergie bas carbone',
    title: 'Indice énergie bas carbone',
    shortLabel: 'Énergie',
    question: 'Où la puissance bas carbone raccordée est-elle déjà forte ?',
    scoreMeaning:
      'Un score élevé indique un département où la puissance installée bas carbone, l’ancrage nucléaire ou hydraulique, la diversité renouvelable et le signal réseau national sont favorables. Il ne garantit pas une capacité de raccordement disponible pour un nouveau site.',
    formulaSteps: [
      'Agréger par département les puissances ODRÉ des filières bas carbone: solaire, éolien, hydraulique, nucléaire, bioénergies, énergies marines et géothermie.',
      'Normaliser les puissances avec une échelle logarithmique pour éviter qu’un très grand parc écrase tous les autres signaux.',
      'Composer le score structurel: 43 % capacité bas carbone, 19 % ancrage nucléaire, 23 % diversité renouvelable, jusqu’à 10 points de part bas carbone et 5 % stockage.',
      'Calculer le signal Eco2mix à partir de l’intensité CO₂ et de la part solaire du dernier point disponible au chargement.',
      'Score départemental: 88 % structurel et 12 % Eco2mix; score au point: 84 % score départemental et 16 % Eco2mix.',
    ],
    dataSources: [
      dataSource({
        name: 'ODRÉ — registre national production et stockage',
        link: SOURCE_LINKS.odreEnergy,
        usage: 'Puissance installée et nombre de sites par département et par filière.',
        freshness: 'Chargé au démarrage; la fraîcheur dépend du jeu publié par ODRÉ.',
      }),
      dataSource({
        name: 'ODRÉ — Eco2mix national temps réel',
        link: SOURCE_LINKS.eco2mix,
        usage: 'Consommation nationale, production solaire et intensité CO₂ du réseau.',
        freshness: 'Dernier point disponible au chargement; fallback local si l’appel échoue.',
      }),
    ],
    limitations: [
      'La puissance installée ne vaut pas capacité de raccordement disponible.',
      'Eco2mix est utilisé comme signal national, pas comme mesure locale de congestion ou de disponibilité réseau.',
      'Le modèle ne connaît pas les postes sources, files d’attente de raccordement, contrats d’achat d’énergie, contraintes RTE/Enedis ni coûts de renforcement.',
    ],
    whyItMatters:
      'Un datacenter est d’abord contraint par l’accès à une puissance stable et bas carbone. Cet indice sert à orienter l’instruction vers les territoires déjà structurés énergétiquement, avant les études réseau.',
  },
  {
    id: 'grid',
    label: 'Raccordement électrique',
    title: 'Indice raccordement électrique',
    shortLabel: 'Raccord.',
    question: 'Où l’accès réseau est-il crédible pour 30 MW, 300 MW, 1 GW ou 2 GW ?',
    scoreMeaning:
      'Un score élevé indique un département où les capacités réservées disponibles Caparéseau, les postes RTE rapprochés et les niveaux de tension sont plus compatibles avec le profil datacenter sélectionné. Il ne vaut pas réponse de raccordement.',
    formulaSteps: [
      'Récupérer le fichier national Caparéseau et l’inventaire ODRÉ des postes électriques RTE en exploitation.',
      'Rapprocher les postes par code poste pour rattacher les capacités Caparéseau aux départements RTE.',
      'Additionner la capacité réservée disponible, la file d’attente S3REnR, les services système et les capacités de transformation.',
      'Identifier le niveau de tension maximal et le nombre de postes HTB significatifs par département.',
      'Comparer la capacité disponible avec le besoin du scénario: 30 MW pour la référence régionale, 300 MW pour Colossus 1, 1 000 MW pour le campus gigawatt et 2 000 MW pour le stress test.',
      'Composer le score: disponibilité de capacité, niveau de tension, densité de postes et cohérence avec le score énergie bas carbone.',
    ],
    dataSources: [
      dataSource({
        name: 'Caparéseau — capacités d’accueil du réseau',
        link: SOURCE_LINKS.capareseau,
        usage: 'Capacité réservée disponible, file d’attente et informations de travaux par poste.',
        freshness: 'Dataset embarqué généré par script; à régénérer pour actualiser les chiffres.',
      }),
      dataSource({
        name: 'ODRÉ — postes électriques RTE',
        link: SOURCE_LINKS.rteSubstations,
        usage: 'Code poste, nom, département, état, fonction et tension des postes de transformation RTE.',
        freshness: 'Chargé lors de la génération du dataset raccordement.',
      }),
      dataSource({
        name: 'ODRÉ — registre national production et stockage',
        link: SOURCE_LINKS.odreEnergy,
        usage: 'Score énergie bas carbone utilisé comme signal de cohérence territoriale.',
        freshness: 'Chargé au démarrage; la fraîcheur dépend du jeu publié par ODRÉ.',
      }),
    ],
    limitations: [
      'Le score est départemental: il ne localise pas précisément le poste disponible le plus proche du point cliqué.',
      'Les capacités Caparéseau ne garantissent ni faisabilité, ni coût, ni délai, ni disponibilité contractuelle au moment du projet.',
      'Le modèle ne remplace pas une étude exploratoire de raccordement, une demande auprès du gestionnaire de réseau ou une analyse de renforcement.',
      'Les coordonnées fines des postes ne sont pas exploitées ici; l’indice reste volontairement prudent sur la précision spatiale.',
    ],
    whyItMatters:
      'Le raccordement est souvent le verrou réel d’un datacenter IA. Deux territoires peuvent disposer d’énergie bas carbone, mais seul celui qui offre une puissance raccordable crédible mérite une instruction prioritaire.',
  },
  {
    id: 'risk',
    label: 'Risques naturels',
    title: 'Indice risques naturels',
    shortLabel: 'Risques',
    question: 'Quels secteurs faut-il écarter avant étude locale ?',
    scoreMeaning:
      'Un score élevé indique une exposition naturelle plus faible dans les signaux disponibles. Sur la carte, il s’agit d’une estimation départementale; au point cliqué, le score repose sur les réponses Géorisques.',
    formulaSteps: [
      'Sur la carte, estimer prudemment le risque à partir de la position du département: Pyrénées, Alpes, Alsace et Antilles sont pénalisées.',
      'Au point cliqué, lire Géorisques pour l’inondation, la sismicité, le retrait-gonflement des argiles et les mouvements de terrain.',
      'Convertir les libellés de statut en scores: fort ou important pénalise, faible favorise, non qualifié reste prudent.',
      'Composer le score local: 46 % inondation, 42 % sismicité et 12 % risques de sol.',
      'Qualifier la confiance selon le nombre de signaux Géorisques effectivement renseignés.',
    ],
    dataSources: [
      dataSource({
        name: 'Géorisques',
        link: SOURCE_LINKS.georisques,
        usage: 'Risques naturels au point: inondation, sismicité, retrait-gonflement des argiles et mouvements de terrain.',
        freshness: 'Appel live au clic; utilise la réponse disponible au moment de l’analyse.',
      }),
      dataSource({
        name: 'GeoJSON France',
        link: SOURCE_LINKS.geojsonFrance,
        usage: 'Géométrie des départements utilisée pour positionner la carte et produire l’aperçu départemental.',
        freshness: 'Chargé au démarrage depuis le fichier GeoJSON public.',
      }),
    ],
    limitations: [
      'L’aperçu carte n’est pas une donnée réglementaire: c’est une estimation géographique destinée à prioriser.',
      'Les libellés Géorisques sont interprétés par règles textuelles simples.',
      'L’indice ne remplace pas un état des risques, un PPRI, une étude géotechnique, une analyse assurantielle ni une instruction ICPE.',
    ],
    whyItMatters:
      'Les risques naturels peuvent rendre un terrain impossible à défendre, même si l’énergie et le foncier semblent favorables. Les identifier tôt évite de pousser des sites techniquement fragiles.',
  },
  {
    id: 'land',
    label: 'Foncier',
    title: 'Indice foncier',
    shortLabel: 'Foncier',
    question: 'Où existe-t-il une marge spatiale crédible ?',
    scoreMeaning:
      'Un score élevé indique un territoire où la surface, la pression d’occupation, le prix médian DVF et l’environnement immédiat du point sont plus compatibles avec un projet de grande emprise.',
    formulaSteps: [
      'À l’échelle départementale, mesurer la surface à partir du GeoJSON France et la pression d’occupation à partir de la densité de sites ODRÉ.',
      'Ajouter le prix médian DVF pré-agrégé par département: un prix plus bas améliore le score.',
      'Composer le score départemental: 38 % surface, 38 % espace libre estimé et 24 % prix foncier.',
      'Au point cliqué, interroger Overpass pour lire les landuse ouverts ou bâtis dans un rayon local.',
      'Calculer le signal local: 50 % espace ouvert, 30 % prix bas DVF et 20 % distance à la ville.',
      'Score au point: 22 % score départemental et 78 % signal local quand les données terrain sont disponibles.',
    ],
    dataSources: [
      dataSource({
        name: 'DVF — geo-dvf',
        link: SOURCE_LINKS.dvf,
        usage: 'Prix médian au mètre carré pré-agrégé et embarqué dans les données locales.',
        freshness: 'Instantané local généré hors ligne; ne se met pas à jour sans régénération du fichier DVF.',
      }),
      dataSource({
        name: 'OpenStreetMap / Overpass',
        link: SOURCE_LINKS.overpass,
        usage: 'Lecture des landuse autour du point: espaces ouverts, zones bâties, bois, eau et zones humides.',
        freshness: 'Appel live au clic, dépendant de la disponibilité des miroirs Overpass.',
      }),
      dataSource({
        name: 'ODRÉ — registre national production et stockage',
        link: SOURCE_LINKS.odreEnergy,
        usage: 'Densité et nombre de sites par département, utilisés comme proxy de pression territoriale et d’infrastructure.',
        freshness: 'Chargé au démarrage; la fraîcheur dépend du jeu publié par ODRÉ.',
      }),
      dataSource({
        name: 'GeoJSON France',
        link: SOURCE_LINKS.geojsonFrance,
        usage: 'Surface et géométrie départementales.',
        freshness: 'Chargé au démarrage depuis le fichier GeoJSON public.',
      }),
    ],
    limitations: [
      'DVF est agrégé: il ne donne pas le prix d’une parcelle précise ni sa disponibilité.',
      'Overpass compte des objets landuse; ce n’est pas un calcul cadastral de surface constructible.',
      'Le modèle ne lit pas le PLU, les servitudes, la propriété réelle, les zones protégées, les contraintes agricoles ni les coûts de dépollution.',
    ],
    whyItMatters:
      'Un site de datacenter exige une emprise maîtrisable, extensible et juridiquement instruisible. L’indice foncier ne choisit pas une parcelle, mais signale les endroits où l’examen détaillé a le plus de sens.',
  },
  {
    id: 'cooling',
    label: 'Refroidissement',
    title: 'Indice refroidissement',
    shortLabel: 'Froid',
    question: 'Où le climat et l’eau réduisent-ils la contrainte thermique ?',
    scoreMeaning:
      'Un score élevé indique des conditions plus favorables au refroidissement: température plus modérée, eau proche ou mesurée, débit exploitable et absence de restriction sécheresse sévère.',
    formulaSteps: [
      'À l’échelle départementale, composer le pré-signal avec 54 % latitude, 32 % puissance hydraulique installée et 14 % part bas carbone.',
      'Au point cliqué, lire Open-Meteo pour la température locale courante.',
      'Interroger Hub’Eau pour la nappe la plus proche et le débit de rivière le plus pertinent dans la zone.',
      'Interroger VigiEau pour appliquer une pénalité en cas de restriction sécheresse, jusqu’au niveau crise.',
      'Ajouter la distance aux eaux de surface repérée via Overpass.',
      'Score au point: température 30 %, nappe 30 %, débit rivière 18 %, eau de surface 22 %, avec pondération adaptative si un signal manque, puis pénalité sécheresse.',
    ],
    dataSources: [
      dataSource({
        name: 'Open-Meteo',
        link: SOURCE_LINKS.openMeteo,
        usage: 'Température locale courante au point cliqué.',
        freshness: 'Appel live au clic.',
      }),
      dataSource({
        name: 'Hub’Eau — Piézométrie',
        link: SOURCE_LINKS.hubEau,
        usage: 'Profondeur de nappe de la station exploitable la plus proche.',
        freshness: 'Dernières chroniques retournées par l’API au clic.',
      }),
      dataSource({
        name: 'Hub’Eau — Hydrométrie',
        link: SOURCE_LINKS.hubEau,
        usage: 'Débit de rivière, avec priorité au débit le plus significatif dans la zone.',
        freshness: 'Dernières observations retournées par l’API au clic.',
      }),
      dataSource({
        name: 'VigiEau',
        link: SOURCE_LINKS.vigieau,
        usage: 'Niveau de restriction sécheresse applicable au point pour un profil entreprise.',
        freshness: 'Appel live au clic.',
      }),
      dataSource({
        name: 'OpenStreetMap / Overpass',
        link: SOURCE_LINKS.overpass,
        usage: 'Distance aux rivières, canaux, plans d’eau et zones naturelles d’eau.',
        freshness: 'Appel live au clic, dépendant de la disponibilité des miroirs Overpass.',
      }),
      dataSource({
        name: 'ODRÉ — registre national production et stockage',
        link: SOURCE_LINKS.odreEnergy,
        usage: 'Puissance hydraulique départementale utilisée dans le pré-score carte.',
        freshness: 'Chargé au démarrage; la fraîcheur dépend du jeu publié par ODRÉ.',
      }),
    ],
    limitations: [
      'La température utilisée est instantanée; l’indice ne modélise pas les canicules longues, l’humidité, le wet-bulb ni les projections climatiques.',
      'La présence d’eau ne signifie pas droit de prélèvement, capacité de rejet, acceptabilité environnementale ou autorisation administrative.',
      'Hub’Eau peut manquer de station proche; dans ce cas la pondération ignore le signal absent au lieu de l’inventer.',
    ],
    whyItMatters:
      'Le refroidissement influence les coûts d’exploitation, la consommation d’eau, le choix technique et l’acceptabilité locale. Un bon signal réduit la friction, sans remplacer les études thermiques et hydrologiques.',
  },
  {
    id: 'access',
    label: 'Accès travailleurs',
    title: 'Indice accès',
    shortLabel: 'Accès',
    question: 'Où l’accès humain et routier reste-t-il crédible ?',
    scoreMeaning:
      'Un score élevé indique un point assez proche d’une voirie structurante et d’un bassin de vie, sans être placé au cœur urbain. L’indice cherche un compromis opérationnel, pas une centralité maximale.',
    formulaSteps: [
      'À l’échelle départementale, partir d’un socle 48, ajouter jusqu’à 24 points liés au nombre de sites ODRÉ, jusqu’à 16 points liés au score réseau et retrancher jusqu’à 10 points selon la surface.',
      'Au point cliqué, chercher via Overpass les routes principales et les villes ou bourgs dans les rayons de recherche.',
      'Utiliser API Adresse en repli pour estimer la distance au point adressé le plus proche lorsque le signal routier OSM manque.',
      'Noter la route avec une zone idéale autour de 0,5 à 4 km, puis une zone encore exploitable jusqu’à environ 12 km.',
      'Noter la ville avec une cible autour de 10 à 15 km: trop proche devient urbain, trop loin devient isolé.',
      'Score au point: 72 % distance route et 28 % distance ville.',
    ],
    dataSources: [
      dataSource({
        name: 'OpenStreetMap / Overpass',
        link: SOURCE_LINKS.overpass,
        usage: 'Routes principales, villes, bourgs et distances locales autour du point.',
        freshness: 'Appel live au clic, dépendant de la disponibilité des miroirs Overpass.',
      }),
      dataSource({
        name: 'API Adresse',
        link: SOURCE_LINKS.apiAdresse,
        usage: 'Reverse geocoding et distance au résultat d’adresse le plus proche, utilisés comme repli pour l’accès.',
        freshness: 'Appel live au clic.',
      }),
      dataSource({
        name: 'ODRÉ — registre national production et stockage',
        link: SOURCE_LINKS.odreEnergy,
        usage: 'Nombre de sites et signal énergétique départemental, utilisés comme proxy d’infrastructure existante.',
        freshness: 'Chargé au démarrage; la fraîcheur dépend du jeu publié par ODRÉ.',
      }),
      dataSource({
        name: 'GeoJSON France',
        link: SOURCE_LINKS.geojsonFrance,
        usage: 'Surface départementale utilisée pour pénaliser les territoires où l’accès moyen est plus diffus.',
        freshness: 'Chargé au démarrage depuis le fichier GeoJSON public.',
      }),
    ],
    limitations: [
      'L’indice mesure des distances à vol d’oiseau, pas des temps de trajet routier.',
      'Il ne qualifie pas les gabarits, ponts, accès poids lourds, servitudes, sécurité de chantier, fibre optique ni disponibilité de main-d’œuvre spécialisée.',
      'La qualité dépend de la complétude OpenStreetMap et de la disponibilité de l’API Adresse au moment du clic.',
    ],
    whyItMatters:
      'Un datacenter isolé complique l’exploitation, la maintenance et les interventions. Un site trop urbain augmente la friction foncière et sociale. L’indice cherche la zone opérationnelle intermédiaire.',
  },
];

export const INDICE_PAGE_BY_ID = Object.freeze(
  Object.fromEntries(INDICE_PAGES.map((page) => [page.id, page])),
);
