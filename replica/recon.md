# Recon map : Carcul, tableau de bord propriétaire (web)

Portée : le tableau de bord de gestion de flotte de taxis (`carcul.ci/v2/`), les 22 rubriques du menu.
Pour : une nouvelle rubrique du site CLB, sous la même forme que les autres
(un dossier autonome installable sur téléphone, comme `bourse/` ou `archi/` :
`index.html`, `manifest.json`, `sw.js`, icônes). Sous une marque CLB, pas Carcul.
Date : 2026-11-14

> **État : PRÉLIMINAIRE.** Le tableau de bord est réservé aux comptes connectés.
> Tout ce qui suit vient uniquement du menu de navigation visible sans connexion.
> Les écrans, champs et calculs sont des **suppositions** tant que nous n'avons pas
> de captures du compte de l'utilisateur ou de sources publiques.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | site public | https://carcul.ci/ | titre « CARCUL - Le taximetre connecté » ; contenu rendu en JavaScript, illisible ici |
| 2 | tableau de bord (coquille) | https://carcul.ci/v2/ | titre « CarCul Dashboard » ; menu de 22 rubriques, sélecteur de langue, bouton de déconnexion |
| 3 | écran ROI | https://carcul.ci/v2/#/roi | derrière la connexion, non vu |
| 4 | compte de l'utilisateur | — | **à fournir** (captures d'écran) |
| 5 | fiches App Store / Play Store, tutoriels vidéo, réseaux sociaux | — | **à trouver** |
| 6 | conditions d'utilisation | — | **à lire** avant d'utiliser un compte pour ce projet |

## Core loop (supposé)

Un propriétaire de taxis équipés d'un taximètre Carcul suit en temps réel les courses,
les recettes et les chauffeurs de sa flotte, et voit quand ses véhicules sont rentabilisés.

## Screens (déduits des libellés du menu)

| ID | écran | route | but supposé | états vus |
| --- | --- | --- | --- | --- |
| S01 | Tableau de bord | `#/dashboard` ? | vue d'ensemble de la flotte : recettes du jour, véhicules actifs | aucun |
| S02 | ROI | `#/roi` | retour sur investissement par véhicule : coût, recettes, charges, délai de rentabilité | aucun |
| S03 | Appareils | ? | liste des taximètres connectés, état, véhicule associé | aucun |
| S04 | Configuration Carcul | ? | réglages des taximètres : tarifs, prise en charge, prix au km ou à la minute | aucun |
| S05 | Chauffeurs | ? | fiches chauffeurs, affectation aux véhicules | aucun |
| S06 | Transactions | ? | courses enregistrées par les taximètres | aucun |
| S07 | Transactions manuelles | ? | saisie à la main de courses ou de recettes | aucun |
| S08 | Comptabilité | ? | recettes et charges, journal | aucun |
| S09 | Facturation | ? | factures émises (clients, entreprises) | aucun |
| S10 | Décaissements | ? | sorties d'argent : versements, paiements | aucun |
| S11 | CGI | ? | fiscalité (Code général des impôts ivoirien ?) | aucun |
| S12 | Simulation CGI | ? | simulateur d'impôt ou de taxe | aucun |
| S13 | Éditique | ? | génération de documents imprimables (reçus, rapports) | aucun |
| S14 | KPIs | ? | indicateurs de performance de la flotte | aucun |
| S15 | Documents | ? | pièces des véhicules et chauffeurs (assurance, visite technique, permis) | aucun |
| S16 | Garage | ? | entretien et réparations | aucun |
| S17 | Radio pub | ? | diffusion de publicités dans les taxis ? | aucun |
| S18 | Suivi | ? | géolocalisation des véhicules sur une carte | aucun |
| S19 | Collecte de données routières | ? | données de trafic et de routes remontées par les véhicules | aucun |
| S20 | Propriétaires | ? | gestion des propriétaires (multi-propriétaires, vue administrateur ?) | aucun |
| S21 | Facture Carcul | ? | factures de l'abonnement Carcul au propriétaire | aucun |
| S22 | Tutoriel | ? | aide | aucun |
| S00 | Connexion | ? | authentification | aucun |

Transversal : sélecteur de langue (au moins deux langues, avec drapeaux).

## Flows (supposés, à confirmer)

```
F01 Le propriétaire consulte la rentabilité d'un taxi
    S00 connexion -> S01 tableau de bord -> S02 ROI -> choisir un véhicule
F02 Le propriétaire suit ses recettes du jour
    S01 -> S06 transactions (filtre véhicule, chauffeur, date)
F03 Le propriétaire saisit une recette hors taximètre
    S07 -> formulaire -> S06
F04 Le propriétaire affecte un chauffeur à un véhicule
    S05 -> fiche chauffeur -> véhicule / appareil
F05 Le propriétaire suit l'entretien
    S16 -> nouvelle intervention -> S08 (charge)
```

## Inferred data model (confiance : supposition pour tout)

```
Owner        id, nom, téléphone, langue
Vehicle      id, owner_id, immatriculation, prix d'achat, date de mise en service
Device       id, vehicle_id, numéro de série, statut, dernière connexion
Driver       id, owner_id, nom, permis, vehicle_id
Trip         id, device_id, driver_id, début, fin, distance, durée, montant, position départ/arrivée
Transaction  id, vehicle_id, type (course | manuelle | charge | versement), montant, date
Expense      id, vehicle_id, catégorie (carburant | entretien | assurance | taxe), montant, date
Document     id, vehicle_id ou driver_id, type, date d'expiration, fichier
Invoice      id, owner_id, numéro, lignes, total
```

Relations : Owner 1-n Vehicle, Vehicle 1-1 Device, Vehicle 1-n Trip, Driver 1-n Trip, Vehicle 1-n Expense.

## Out of scope (ne peut pas ou ne doit pas être cloné)

- **Le taximètre physique** et son logiciel embarqué : c'est du matériel, avec sans doute une homologation.
- **Les données** des courses, véhicules et clients de Carcul : elles lui appartiennent.
- **La régie Radio pub** : ce sont leurs contrats avec les annonceurs.
- **La collecte de données routières** : elle dépend de leur parc de véhicules équipés.
- Sans taximètre, un clone ne reçoit pas de courses automatiques : il faudrait soit une saisie manuelle, soit une app mobile chauffeur (GPS) pour les remplacer.

## Size

Écrans 23, flows 5 (supposés), entités 9. Parties dures : la source des courses
sans le boîtier, la fiscalité ivoirienne (CGI), le suivi GPS en temps réel, la comptabilité.
**Taille : XL pour les 22 rubriques. À recadrer**, voir le résumé.
