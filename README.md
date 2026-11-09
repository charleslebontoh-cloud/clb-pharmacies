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
- Version 1.5.0 (prix en ligne Notino convertis en FCFA, valeur de la collection).

## Sentinel · BRVM Intelligence (dossier `bourse/`) — version 1.6.0

Appli de veille boursière BRVM : résumé de séance, cours en direct (différé 15 min), graphiques sur 10 ans, score Sentinel par valeur (modèle multifactoriel validé sur l'historique depuis 2017, fondamentaux, technique, actualités), prévisions 1, 3 et 12 mois avec fourchette, signaux d'achat/vente, alertes et portefeuille personnel (stocké uniquement sur le téléphone).

- Données : `bourse/data/` mises à jour par `.github/workflows/bourse.yml` (toutes les 30 min pendant la séance, analyse complète chaque soir).
- Moteur : `tools/bourse.py` (sources : brvm.org, sikafinance.com).
- Alertes sur iPhone : appli ntfy, canal affiché dans l'onglet Signaux.
