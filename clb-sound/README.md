# CLB Sound

La musique des créateurs Suno, gratuite pour tout le monde. Les artistes publient leurs chansons (lien Suno ou fichier MP3) et tout le monde peut les écouter en boucle ou en aléatoire.

Version 1.0.0

## Fonctions
- **Écouter** : liste des nouveautés ou des plus écoutées, recherche par titre, artiste ou genre.
- **Lecteur** : lecture/pause, précédente/suivante, **aléatoire**, **répéter** (toute la liste ou ce titre), barre de progression, volume, contrôles sur l'écran verrouillé du téléphone.
- **Publier** sans compte :
  - **Lien Suno** (`suno.com/song/…`) : l'audio et la pochette restent chez Suno, rien n'est stocké chez nous.
  - **Fichier MP3/WAV/M4A** (15 Mo max) + pochette facultative, stockés dans Supabase.
- **Partager** un titre (lien direct `?t=…`), **signaler** un abus : une chanson signalée 5 fois est masquée automatiquement.
- Installable sur téléphone (PWA).

## Mise en ligne (une seule fois, environ 10 minutes)

### 1. Base de données gratuite (Supabase)
1. Crée un compte sur https://supabase.com puis **New project** (région : Europe ou la plus proche).
2. Menu **SQL Editor** › **New query** : colle tout le contenu de `supabase/schema.sql`, puis **Run**.
3. Menu **Project Settings** › **API** : copie la **Project URL** et la clé **anon public**.
4. Colle-les dans `config.js`. La clé *anon* est publique par conception ; ne mets jamais la clé *service_role* ici.

### 2. Hébergement gratuit (GitHub Pages)
Dans le dépôt : **Settings** › **Pages** › Source : *Deploy from a branch*, branche `main`, dossier `/ (root)`.
L'appli sera à `https://<ton-compte>.github.io/<nom-du-depot>/`.

## Modération
Dans Supabase › **Table Editor** › `tracks` :
- pour remettre en ligne une chanson masquée : `hidden` = false et `reports` = 0 ;
- pour supprimer : supprime la ligne (et le fichier dans **Storage** › `songs` si c'était un envoi MP3).

## Limites à connaître
- **Droits Suno** : avec l'offre gratuite de Suno, les chansons appartiennent à Suno et ne sont utilisables qu'à titre non commercial. Une plateforme gratuite et sans publicité reste dans ce cadre. Avant toute monétisation (pubs, abonnements), n'accepter que les chansons créées avec un abonnement Suno payant (Pro/Premier).
- **Liens courts** `suno.com/s/…` : le navigateur ne peut pas les déchiffrer ; l'appli demande l'adresse complète `suno.com/song/…`.
- **Offre gratuite Supabase** : 500 Mo de base (des centaines de milliers de titres) et 1 Go de fichiers (environ 200 à 250 MP3). Les liens Suno ne consomment pas de stockage.
- Un projet Supabase gratuit se met en pause après 7 jours sans aucune visite ; il suffit de le relancer depuis le tableau de bord.

## Fichiers
- `index.html`, `style.css`, `app.js` : l'appli
- `config.js` : adresse et clé publique Supabase
- `supabase/schema.sql` : tables, règles de sécurité, stockage
- `sw.js`, `manifest.json`, `icon.svg` : installation sur téléphone
