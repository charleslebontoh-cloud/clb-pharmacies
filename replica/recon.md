# Recon map : Carcul, tableau de bord propriétaire (web, affiché sur mobile)

Portée : le tableau de bord de gestion de flotte de taxis (`carcul.ci/v2/`).
Écran étudié en détail : **ROI des véhicules** (S02). Les autres rubriques restent supposées.
Pour : une nouvelle rubrique du site CLB, sous la même forme que les autres
(un dossier autonome installable sur téléphone, comme `bourse/` ou `archi/` :
`index.html`, `manifest.json`, `sw.js`, icônes). Sous une marque CLB, pas Carcul.
Date : 2026-11-14

> **État.** S02 (ROI) est repéré à partir de 5 captures du compte de l'utilisateur,
> sur iPhone, le 14/11/2026. Les autres écrans ne viennent que des libellés du menu :
> ce sont des **suppositions**. Les captures ne sont pas versées au dépôt : elles
> contiennent l'immatriculation et les chiffres réels d'un véhicule de l'utilisateur.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | site public | https://carcul.ci/ | titre « CARCUL - Le taximetre connecté » ; contenu rendu en JavaScript, illisible ici |
| 2 | tableau de bord (coquille) | https://carcul.ci/v2/ | titre « CarCul Dashboard » ; menu de 22 rubriques, sélecteur de langue, déconnexion |
| 3 | compte de l'utilisateur, écran ROI | https://carcul.ci/v2/#/roi | 5 captures iPhone (période « Année entière » et période d'un jour), 14/11/2026 |
| 4 | fiches stores, tutoriels vidéo, réseaux sociaux | — | à trouver |
| 5 | conditions d'utilisation | — | à lire |

Sous-titre du logo : « Calculateur des recettes ».

## Core loop

Un propriétaire de taxis voit, véhicule par véhicule et sur une période choisie,
combien le véhicule a rapporté (versements du chauffeur), combien il a coûté,
et s'il a remboursé l'investissement.

## Screens

| ID | écran | route | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S02 | ROI des véhicules / Rentabilité du véhicule | `#/roi` | rentabilité par véhicule sur une période | voir détail ci-dessous | rempli (année), vide (un jour, 0 mouvement), investissement à 0 |
| S01 | Tableau de bord | ? | vue d'ensemble de la flotte | supposé | aucun |
| S03 | Appareils | ? | taximètres connectés | supposé | aucun |
| S04 | Configuration Carcul | ? | réglages des taximètres | supposé | aucun |
| S05 | Chauffeurs | ? | fiches chauffeurs | supposé | aucun |
| S06 | Transactions | ? | courses et versements | supposé | aucun |
| S07 | Transactions manuelles | ? | saisie à la main | supposé | aucun |
| S08 | Comptabilité | ? | recettes et charges | supposé | aucun |
| S09 | Facturation | ? | factures | supposé | aucun |
| S10 | Décaissements | ? | sorties d'argent | supposé | aucun |
| S11 | CGI | ? | fiscalité (icône d'alerte dans le menu) | supposé | aucun |
| S12 | CGI Simulation | ? | simulateur fiscal | supposé | aucun |
| S13 | Éditique | ? | documents imprimables | supposé | aucun |
| S14 | KPIs | ? | indicateurs de flotte | supposé | aucun |
| S15 | Documents | ? | pièces des véhicules et chauffeurs | supposé | aucun |
| S16 | Garage | ? | entretien | supposé | aucun |
| S17 | Radio pub | ? | publicité dans les taxis | supposé | aucun |
| S18 | Tracking | ? | géolocalisation | supposé | aucun |
| S19 | Collecte de données routières | ? | données routières | supposé | aucun |
| S20 | Propriétaires | ? | gestion des propriétaires | supposé | aucun |
| S21 | Facture Carcul | ? | abonnement Carcul | supposé | aucun |
| S22 | Tutoriel | ? | aide | supposé | aucun |

### S02 en détail, de haut en bas

1. **En-tête commun** : logo, menu horizontal défilant (onglet actif encadré en rouge), sélecteur de langue « FR ».
2. **Fil d'Ariane** : « ROI du véhicule > Détails du véhicule ». Titre « Rentabilité du véhicule ».
3. **Période** : champ de plage de dates (`JJ-MM-AAAA - JJ-MM-AAAA`) + bouton « Actualiser ».
   Puces de raccourci défilantes : « Année entière », puis les mois (« Nov 26 », « Oct 26 », « Sep 26 »…).
4. **Groupes** : recherche « Rechercher un groupe… » + cartes de groupes (« Tous Groupes · VÉHICULES »).
5. **Propriétaires** : section repliable, recherche « Rechercher un propriétaire… », bouton d'affichage en grille.
6. **Véhicules** : recherche « Rechercher un véhicule… » + puces par véhicule (immatriculation), la sélectionnée encadrée.
7. **Carte du véhicule** : immatriculation, badge « ✓ Analysé », « Sans groupe · Données de rentabilité consolidées »,
   « N mouvements sur la période sélectionnée ». Quatre chiffres avec légende :
   - Investissement total — « Capital investi »
   - Résultat net cumulé — « Recettes moins les dépenses »
   - ROI cumulé — « Performance de l'investissement »
   - Délai de récupération — « Estimation actuelle » (texte « Non récupéré » quand non remboursé)
8. **Onglets** : « Par groupe » · « Vue d'ensemble » (actif) · « Tous les véhicules ».
9. **Carte « Résultat net cumulé »** — « Lecture des flux financiers du véhicule » : montant en grand,
   « Capital récupéré » en % avec barre de progression, puis Recettes (vert) et Total dépenses (rouge).
10. **Carte « Répartition des sorties »** — « Tous les mouvements classés par type » : graphique en anneau,
    légende Investissement · Exploitation · Financement, puis « Total sorties ».
11. **Carte « Indicateurs clés »** — « Vue de synthèse du véhicule » : Recettes totales, Total dépenses,
    Résultat net cumulé, ROI, Délai estimé.
12. **Carte « Données d'exploitation »** — « Activité du véhicule sur la période sélectionnée » : grille de tuiles
    KM parcourus, Courses, Objectif cumulé, Montant versé, Taux d'atteinte, Recette / km (la suite n'est pas visible).

Montants affichés « F CFA 256,350 » (virgule comme séparateur de milliers), négatifs « -F CFA 248,650 ».

### Calculs observés et déduits

Cas réel (période « Année entière », un véhicule) : recettes 256 350, dépenses 505 000,
investissement 0, financement 0 → résultat net −248 650, ROI 0,0 %, délai « Non récupéré ».
Montant versé = recettes totales = 256 350. Objectif cumulé 227 115. 2 221 km, 1 075 courses, 11 mouvements.

| indicateur | formule | confiance |
| --- | --- | --- |
| Résultat net cumulé | recettes − dépenses | haute (écrit à l'écran, vérifié par les chiffres) |
| Recettes totales | somme des versements du chauffeur sur la période | haute (égal à « Montant versé ») |
| Total dépenses / Total sorties | investissement + exploitation + financement | haute (la répartition se totalise ainsi) |
| ROI cumulé | résultat net ÷ investissement × 100, et 0 si l'investissement vaut 0 | moyenne |
| Capital récupéré | part de l'investissement couverte par le résultat net, bornée entre 0 et 100 % | moyenne |
| Délai de récupération | investissement restant ÷ résultat net moyen par mois ; « Non récupéré » si le résultat n'est pas positif | supposition |
| Taux d'atteinte | montant versé ÷ objectif cumulé × 100 (≈ 112,9 % ici) | moyenne |
| Recette / km | recettes ÷ km parcourus (≈ 115 F/km ici) | moyenne |

À noter pour la suite (`/replica-entrepreneur`) :
- Un investissement à 0 donne un ROI « 0,0 % » et masque un véhicule pourtant en perte : rien n'invite à saisir le prix d'achat.
- Le résultat net négatif s'affiche **en vert** sur la carte du véhicule et en rouge plus bas : couleurs incohérentes.
- Séparateur de milliers à l'anglaise (256,350) dans une interface en français.
- La longue suite de filtres (période, groupes, propriétaires, véhicules) repousse les chiffres très bas sur mobile.

## Flows

```
F01 Le propriétaire consulte la rentabilité d'un véhicule
    S02 : choisir la période (puce « Année entière » ou un mois) -> choisir le véhicule -> lire les cartes
    happy path : 2 touchers après ouverture de l'écran
    edge : aucun mouvement sur la période (tout à 0), investissement non saisi (ROI 0 %),
           résultat négatif, plage de dates d'un seul jour
F02 Le propriétaire compare ses véhicules
    S02 : onglet « Tous les véhicules » (non vu)
F03 Le propriétaire regarde un groupe de véhicules
    S02 : carte de groupe ou onglet « Par groupe » (non vu)
F04 Le propriétaire saisit une dépense ou un investissement (supposé)
    S07 ou S08 ou S10 -> le mouvement apparaît dans S02
```

## Components

| composant | variantes | états | utilisé sur |
| --- | --- | --- | --- |
| Menu horizontal défilant | onglet normal, onglet actif encadré | — | tous |
| Sélecteur de langue | — | ouvert, fermé | tous |
| Plage de dates + bouton Actualiser | — | — | S02 |
| Puces de période | active (pleine, rouge), inactive (contour) | — | S02 |
| Champ de recherche avec loupe | — | vide, saisi | S02 (×3) |
| Puce de véhicule | sélectionnée (contour rouge) | — | S02 |
| Carte de groupe | sélectionnée | — | S02 |
| Section repliable | ouverte, fermée | — | S02 |
| Badge de statut | « Analysé » (vert) | — | S02 |
| Bloc chiffre + légende | positif, négatif, neutre | — | S02 |
| Onglets à icône | actif souligné rouge | — | S02 |
| Carte avec titre, sous-titre et pastille d'icône colorée | verte, rouge, orange, gris-vert | — | S02 |
| Barre de progression | — | 0 %, partielle | S02 |
| Graphique en anneau + légende | — | vide, rempli | S02 |
| Ligne d'indicateur (icône carrée, libellé, valeur colorée) | recette verte, dépense rouge, neutre | — | S02 |
| Tuile d'indicateur (icône, libellé en majuscules, grand chiffre) | — | — | S02 |

## Inferred data model

```
Owner        id, nom
             evidence : S02 section « Propriétaires » ; confidence : high
VehicleGroup id, owner_id, nom
             evidence : S02 « Groupes », « Sans groupe » ; confidence : high
Vehicle      id, owner_id, group_id (nullable), immatriculation, statut d'analyse
             evidence : S02 puces et carte du véhicule ; confidence : high
Movement     id, vehicle_id, date, montant,
             type (recette | investissement | exploitation | financement), libellé
             evidence : S02 « 11 mouvements », « Répartition des sorties » ; confidence : medium
Activity     vehicle_id, jour, km, courses, objectif, montant versé
             evidence : S02 « Données d'exploitation » ; confidence : medium (fournie par le taximètre chez Carcul)
Driver       id, owner_id, nom, vehicle_id, objectif de versement
             evidence : menu « Chauffeurs », « Objectif cumulé » ; confidence : guess
```

Relations : Owner 1-n VehicleGroup, Owner 1-n Vehicle, VehicleGroup 1-n Vehicle,
Vehicle 1-n Movement, Vehicle 1-n Activity, Driver n-1 Vehicle.

## Feature matrix

Voir `features.csv`.

## Out of scope (ne peut pas ou ne doit pas être cloné)

- **Le taximètre physique** et son logiciel : c'est leur matériel. Chez Carcul, km, courses et versements arrivent tout seuls.
  Dans la version CLB, ils seront **saisis à la main** (versement du jour, km au compteur, nombre de courses).
- **Les données** de Carcul et de ses clients.
- **Radio pub**, **collecte de données routières**, **facture Carcul** : leur régie, leur parc, leur abonnement.

## Size

Pour la version CLB réduite (ROI + véhicules + groupes + saisie des mouvements et de l'activité) :
5 écrans, 4 flows, 6 entités. Parties dures : les formules (ROI, délai de récupération) à valider,
la saisie quotidienne qui doit rester rapide sur téléphone, le stockage (local ou en ligne).
**Taille : S à M.** Les 22 rubriques complètes restent XL.
