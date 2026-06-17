# Prisme

**Outil d'aide à l'implantation de datacenters IA en France, à partir de données publiques en temps réel.**

Prisme n'est pas une démo décorative : c'est une application qui répond à une vraie
question de projet — *« Où peut-on poser un datacenter IA en France sans aveugler le
territoire ? »* — en croisant l'énergie bas carbone disponible, les risques naturels,
le foncier, le refroidissement et l'accès, au niveau d'un département puis d'un point précis.

---

## 1. Périmètre verrouillé (NE PLUS PIVOTER)

Le concept est figé. On ne change plus de paradigme : on fiabilise et on polit.

- **Question produit :** où implanter un datacenter IA en France ?
- **Promesse :** un pré-score par département, puis une analyse de site instantanée au clic,
  uniquement à partir de données publiques.
- **Hors périmètre (abandonné) :** slider horaire « heure simulée », « planificateur
  d'opération numérique », tout buzzword marketing. Ne pas les réintroduire.

### Parcours utilisateur unique (à rendre irréprochable)

1. Landing (manifeste) → bouton **Ouvrir la carte**.
2. Carte de France : 96 départements colorés par score d'aptitude.
3. **Clic sur un département** → zoom fort, le reste de la France passe en contexte fantôme.
4. **Clic sur un point dans le département** → analyse locale (risques, eau, route, ville,
   température) → score d'aptitude recalculé + verdict + le « pourquoi ».

C'est ce chemin, et lui seul, qui doit être parfait.

---

## 2. Données (réelles, publiques)

| Source | Usage | Niveau | Endpoint vérifié |
| --- | --- | --- | --- |
| **ODRÉ** — registre national production/stockage | Puissance bas carbone & sites par département | Département | `odre.opendatasoft.com/api/explore/v2.1/...` |
| **ODRÉ — Eco2mix national TR** | Conso / solaire / intensité CO₂ nationale | National | idem ODRÉ |
| **Géorisques (API)** | Sismicité, inondation, mouvements de terrain | Point cliqué | `georisques.gouv.fr/api/v1/...` |
| **Open-Meteo** | Température locale | Point cliqué | `api.open-meteo.com` |
| **OpenStreetMap / Overpass** | Distance ville/route/eau **+ `landuse` (foncier)** | Point cliqué | `overpass-api.de/api/interpreter` |
| **Hub'Eau — Piézométrie `chroniques_tr`** | **Nappes souterraines en temps réel** (profondeur/niveau) | Point cliqué | `hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques_tr?bbox=…&sort=desc` ✅ CORS |
| **Hub'Eau — Hydrométrie `observations_tr`** | **Débit des rivières en temps réel** (grandeur `Q`) | Point cliqué | `hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?bbox=…&grandeur_hydro=Q` ✅ CORS |
| **VigiEau** | **Niveau de restriction sécheresse** au point | Point cliqué | `api.vigieau.beta.gouv.fr/api/zones?lat=…&lon=…&profil=entreprise` ✅ |
| **DVF (geo-dvf)** | **Prix €/m²** (valeur foncière / surface) | Pré-agrégé | `files.data.gouv.fr/geo-dvf/latest/csv/<an>/communes/<dep>/<insee>.csv` (suivre redirection `-L`) |
| **france-geojson** | Géométrie des départements (d3-geo Mercator) | Carte | `raw.githubusercontent.com/gregoiredavid/france-geojson` |

### Règle de fiabilité (CRITIQUE pour une vraie app)

Le clic déclenche aujourd'hui **4 appels navigateur** (Géorisques, Open-Meteo, Overpass,
commune). En conditions réelles ça casse : CORS, rate-limit, timeouts (Overpass surtout).

À tenir :
- **Pré-calculer et mettre en cache les scores des 96 départements** au chargement (une
  fois), pas à chaque interaction.
- **Point cliqué = appels live, mais avec timeout court (≤ 4 s) + `AbortController`** et
  un **fallback élégant** : jamais d'écran cassé, jamais de « Mode dégradé » qui clignote.
- **Debounce** les clics rapprochés ; lancer les appels point en `Promise.allSettled`
  (Hub'Eau piézo + Hub'Eau hydro + VigiEau + Géorisques + Overpass landuse + Open-Meteo).
- **DVF : NE PAS appeler en live** (API communautaire `cquest` morte → 502 ; fichiers DVF
  trop lourds). Générer **un JSON pré-agrégé** (médiane €/m² par commune ou département)
  via un petit script `scripts/build-dvf.mjs`, et le bundler dans `src/data/`.
- L'app doit rester belle et lisible **même hors-ligne** (jeu de données de secours déjà
  présent : `FALLBACK_DEPARTMENTS`, `FALLBACK_REALTIME`).

---

## 3. Modèle de score (assumé comme une *estimation*)

Pré-score département (pondérations actuelles) :
`énergie 0.38 · foncier 0.20 · refroidissement 0.18 · risque 0.14 · réseau 0.10`.

Score au point : `énergie 0.34 · risque 0.24 · foncier 0.17 · refroidissement 0.14 · accès 0.11`.

Règle d'honnêteté : afficher clairement ce qui est **donnée source** vs **modèle
d'estimation**. Ne jamais écrire « probabilité » au sens statistique — parler de
**score d'aptitude**.

### Détail des critères (à implémenter)

**Foncier** — score complet, deux composantes :
1. *Espace disponible* (live, point) : via Overpass `landuse` dans un rayon ~1,5 km.
   `farmland` / `meadow` / `forest` / `grass` / `scrub` = favorable (champ = bien) ;
   `residential` / `commercial` / `industrial` / `retail` = défavorable. Bonus si
   distance à la ville la plus proche **> 10–15 km** et faible densité de bâti.
2. *Prix au m²* (pré-agrégé DVF) : médiane €/m² ; **moins cher = meilleur score**.
   Toujours **afficher la valeur en euros** (ex. « ≈ 1 240 €/m² »).
   `landScore = 0.5·espace + 0.3·prixBas + 0.2·éloignementVille`.

**Refroidissement** — disponibilité réelle de l'eau (live, point) :
1. *Nappe souterraine* (Hub'Eau Piézométrie `chroniques_tr`, bbox→piézo le plus proche) :
   nappe haute / peu profonde = favorable. Afficher `profondeur_nappe` (m) et la date.
2. *Débit rivière* (Hub'Eau Hydrométrie `observations_tr`, `grandeur_hydro=Q`).
3. *Sécheresse* (VigiEau) : si arrêté `crise`/`alerte renforcée` → **forte pénalité**
   (pomper pour refroidir devient interdit). Afficher le niveau.
4. Température locale (Open-Meteo) + distance eau de surface (Overpass) déjà présentes.
   `coolingScore = 0.35·température + 0.30·nappe + 0.20·débit − pénalitéSécheresse + 0.15·eauProche`.

**Risque** — voir §3bis ci-dessous (renommage).

### 3bis. Clarifier « pré-risque »

Le libellé actuel « Pré-risque » est incompréhensible. C'est en fait l'**aperçu carte du
risque au niveau département** : aujourd'hui une simple *estimation géographique*
(`estimateGeoRiskScore`), pas une vraie donnée. La vraie donnée arrive **au clic** via
Géorisques (sismicité, inondation, mouvement de terrain).

À faire :
- Renommer la couche **« Risque — aperçu carte »** (ou « Risque (estimation) »).
- Afficher sous la carte : *« Estimation. Cliquez un point pour la donnée Géorisques réelle. »*
- Au point, le score risque vient à 100 % de Géorisques (déjà branché).

---

## 4. Design system

Thème **light éditorial / luxe**, whitespace généreux, hairlines, pas de SaaS générique.

Tokens (voir `tailwind.config.js`) :
- Couleurs : `porcelain #fbfbf8`, `paper #f5f2ea`, `ink #141414`, `graphite #303030`,
  `pewter #8c8f8a`, `solar #e7c85d`.
- Fontes : `font-display` = Newsreader (serif éditorial), `font-sans` = Inter,
  `font-mono` = IBM Plex Mono (réservé aux eyebrows/labels, jamais au corps de texte).

### États visuels « optimal / tension »

Le passage `optimal → tension` (whitespace qui se contracte, passage monochrome) est la
signature visuelle. **Il doit être relié à un sens explicite et affiché à l'écran**
(ex. intensité CO₂ nationale / sobriété), sinon il est déroutant sur un outil de siting.
Si on ne le justifie pas clairement → le retirer plutôt que le laisser à moitié branché.

### Interdits

Glassmorphism, dégradés fluo, marquees, grilles de cartes identiques, tout-centré,
mono en corps de texte, drop-shadows génériques.

---

## 5. Architecture fichiers

```
index.html
src/
  main.jsx       # App, Studio (carte + control deck), hooks data
  Landing.jsx    # Landing page éditoriale (composant autonome)  ← importé par main.jsx
  styles.css     # Tailwind + tokens + styles slider/custom
tailwind.config.js
```

**Câblage de la landing :** dans `main.jsx`, supprimer le composant `Landing` interne et
le remplacer par :

```js
import { Landing } from './Landing.jsx';
```

Le contrat de props reste `<Landing onStart={() => setView('studio')} />`.

---

## 6. Consignes d'efficacité (pour le dev / Codex)

- **Ne pas re-pivoter.** Le périmètre §1 est gelé.
- **Commiter tôt et souvent** (le repo n'a aucun commit : `git add -A && git commit`).
- Un seul gros `main.jsx` : préférer extraire les composants stables (Landing faite) pour
  éviter les conflits d'édition.
- Avant de livrer : `npm run build` doit passer, **0 warning de variables inutilisées**
  (`Activity`, `SunMedium`, `Waves` semblent inutilisés), **0 erreur console runtime**.
- Pas de nouvel appel réseau par interaction sans timeout + fallback.

### Definition of Done (vraie app, pas démo)

- [ ] Carte : clic département → zoom net ; clic point → analyse.
- [ ] États **loading / erreur / hors-ligne** soignés sur chaque appel.
- [ ] Aucune erreur console, build propre, audit `npm audit` à 0.
- [ ] Accessibilité : focus visible, labels ARIA sur la carte et les contrôles.
- [ ] Sources publiques citées et cliquables dans l'UI.
- [ ] Le parcours du §1 fonctionne de bout en bout sans intervention.

## Lancer

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build
```
