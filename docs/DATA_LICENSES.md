# Licences et attributions des donnees

Derniere mise a jour: 17 juin 2026

Ce document decrit les principales sources de donnees utilisees ou referencees par PrismCenter. Il vise a rendre explicites les attributions et precautions de reutilisation. Il ne constitue pas un avis juridique.

## Synthese

| Source | Usage dans PrismCenter | Licence / conditions identifiees | Attribution recommandee | Notes |
| --- | --- | --- | --- | --- |
| ODRE - Registre national des installations de production et de stockage d'electricite | Puissance installee bas carbone par departement | Licence Ouverte v2.0 Etalab, indiquee dans les metadonnees ODRE | ODRE, RTE, Enedis, EDF SEI, ELD | Jeu agrege au departement dans PrismCenter. |
| Capareseau - Capacites d'accueil du reseau | Capacite reservee disponible, files d'attente et travaux par poste | Conditions de reutilisation a verifier aupres de RTE / Capareseau; donnees publiees pour consultation publique | RTE / Capareseau | Donnee embarquee apres generation par script; ne vaut pas engagement de raccordement. |
| ODRE - Postes electriques RTE | Postes de transformation, departement et tension | Licence Ouverte v2.0 Etalab, indiquee dans les metadonnees ODRE | RTE / ODRE | Utilise pour rattacher les postes Capareseau aux departements. |
| ODRE - Eco2mix national temps reel | Consommation, solaire, intensite CO2 nationale | Licence Ouverte v2.0 Etalab, indiquee dans les metadonnees ODRE | RTE / Eco2mix / ODRE | Les donnees temps reel peuvent etre remplacees par des donnees consolidees ulterieurement. |
| Georisques | Risques naturels et technologiques au point | API publique referencee sur data.gouv.fr; conditions et licences a verifier selon les jeux sous-jacents | Georisques / BRGM | Ne pas presenter comme une etude de risque exhaustive. |
| Open-Meteo | Temperature locale | API data sous Creative Commons Attribution 4.0 selon Open-Meteo | Open-Meteo | Respecter attribution et conditions d'usage de l'API. |
| OpenStreetMap / Overpass | Routes, eau de surface, occupation du sol | Open Database License 1.0 (ODbL) | © OpenStreetMap contributors | Evaluer les obligations ODbL pour toute base derivee publiee. |
| Hub'Eau | Pieziometrie, hydrometrie | Licence Ouverte Etalab selon les CGU Hub'Eau | Hub'Eau / Eaufrance et producteurs des jeux | Citer l'auteur des jeux de donnees reutilises. |
| VigiEau - Donnee Secheresse | Restrictions secheresse | Licence Ouverte v2.0 (`lov2`) sur data.gouv.fr | Ministere de la Transition ecologique / VigiEau | Donnees de restriction sujettes a evolution administrative. |
| DVF - Demandes de valeurs foncieres | Prix median departemental pre-agrege | Licence Ouverte v2.0 (`lov2`) sur data.gouv.fr | DGFiP / Ministeres economiques et financiers | La source brute comporte des obligations de non re-identification et de non-indexation externe. |
| Base Adresse Nationale / API Adresse | Commune et contexte territorial | Base Adresse Nationale sous Licence Ouverte v2.0 sur data.gouv.fr; API referencee par l'IGN | Base Adresse Nationale / IGN | L'API Adresse sert de service d'interrogation; verifier les conditions de l'endpoint utilise en production. |
| france-geojson | Geometries departementales simplifiees | Le projet renvoie aux conditions Admin Express / Licence Ouverte | Gregoire David, IGN Admin Express, INSEE COG | Les traces proviennent d'IGN Admin Express et les codes/noms de l'INSEE. |

## Attribution courte

Pour une page publique ou une presentation:

> Sources: ODRE/RTE, Enedis, EDF SEI, ELD; Capareseau/RTE; Eco2mix/RTE; Georisques/BRGM; Open-Meteo; OpenStreetMap contributors; Hub'Eau/Eaufrance; VigiEau; DVF/DGFiP; Base Adresse Nationale/IGN; france-geojson d'apres IGN Admin Express et INSEE COG.

## Precautions de reutilisation

- Les scores PrismCenter sont des estimations de priorisation, pas des certifications.
- Les donnees temps reel peuvent etre incompletes, corrigees ou consolidees apres publication.
- Les API publiques peuvent imposer quotas, conditions d'utilisation, indisponibilites temporaires ou restrictions techniques.
- Les donnees OSM et certaines donnees publiques peuvent imposer attribution visible et conservation des notices.
- Les donnees DVF brutes ne doivent pas etre reutilisees de maniere permettant la re-identification indirecte des personnes concernees.

## Sources de verification

- ODRE Registre national: https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege/information/
- Capareseau: https://www.services-rte.com/fr/decouvrez-nos-offres-de-services/consulter-les-capacites-d-accueil-du-reseau-capareseau.html
- ODRE Postes electriques RTE: https://odre.opendatasoft.com/explore/dataset/postes-electriques-rte/information/
- ODRE Eco2mix national temps reel: https://odre.opendatasoft.com/explore/dataset/eco2mix-national-tr/information/
- Licence Ouverte Etalab: https://github.com/etalab/licence-ouverte
- Georisques API: https://www.data.gouv.fr/dataservices/api-georisques
- Open-Meteo licence: https://open-meteo.com/en/licence
- OpenStreetMap copyright/license: https://www.openstreetmap.org/copyright
- Hub'Eau CGU: https://hubeau.eaufrance.fr/page/conditions-generales
- VigiEau API: https://www.data.gouv.fr/dataservices/api-vigieau
- Donnee Secheresse VigiEau: https://www.data.gouv.fr/datasets/donnee-secheresse-vigieau
- DVF: https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres
- API Adresse: https://www.data.gouv.fr/dataservices/api-adresse-base-adresse-nationale-ban
- Base Adresse Nationale: https://www.data.gouv.fr/datasets/base-adresse-nationale
- france-geojson: https://github.com/gregoiredavid/france-geojson
