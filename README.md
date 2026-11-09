# CLB Health

Pharmacies de garde autour de toi (GPS), suivi d’'eau avec rappels, parking, numéros d’'urgence. Liste officielle UNPPCI mise à jour chaque samedi.

https://charleslebontoh-cloud.github.io/clb-pharmacies/

## Numérotation des versions (demande de Charles)

Toutes les applis suivent le format **MAJEURE.MINEURE.CORRECTIF** (ex. 7.1.2), affiché sur l'écran d'ouverture :
- **CORRECTIF** (7.0.1 → 7.0.2) : correction de bug, petit ajustement.
- **MINEURE** (7.0.2 → 7.1.0) : nouvelle fonction ou nouvelle section.
- **MAJEURE** (7.1.0 → 8.0.0) : refonte complète.
Le nom du cache du service worker (sw.js) change à chaque version publiée.

## Aurum · Private Fragrance Collection (ex CLB Parfums, `parfums/`)
Gestion de la collection de parfums de Charles : reconnaissance par photo (lecture du texte et code-barres), fiche, quantité et rachat, « Je me parfume » selon la météo (Open-Meteo), cocktails et découvertes.
- Base olfactive : jeu de données Parfumo publié par TidyTuesday (2024-12-10), reconstruite par `tools/parfums_db.py` via le workflow `parfums-data` ; quelques parfums manquants ajoutés à partir de leurs pyramides publiées.
- Images officielles : Open Beauty Facts quand le produit y figure, sinon la photo de l'utilisateur.
- Données personnelles : uniquement sur le téléphone (localStorage + IndexedDB).
- Version 1.4.0 (fin de flacon : racheter, déjà racheté ou sortir vers « Anciens parfums »).
