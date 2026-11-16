"""Vérifie les fichiers JSON produits par un workflow avant qu'il ne les commite.

Usage : python3 tools/valider_donnees.py FICHIER_OU_DOSSIER [...]
Un dossier est parcouru récursivement (*.json).

Pour chaque fichier, compare à la version déjà publiée (git HEAD) :
  - le JSON doit se lire ;
  - il ne doit pas être vide si la version publiée ne l'était pas ;
  - sa liste principale ne doit pas avoir fondu de plus de moitié
    (seulement si la version publiée comptait au moins 10 éléments) ;
  - un fichier publié ne doit pas avoir disparu.
Code de sortie 1 au moindre problème : le workflow s'arrête sans commiter
et alerte-echecs envoie une notification."""
import json, os, subprocess, sys

PERTE_MAX = 0.5   # on refuse si la taille tombe sous 50 % de la version publiée
SEUIL_PETIT = 10  # en dessous, on vérifie seulement que ce n'est pas vide


def taille(d):
    """Nombre d'éléments de la liste principale : la plus grande liste ou table du premier niveau."""
    if isinstance(d, list):
        return len(d)
    if isinstance(d, dict):
        listes = [len(v) for v in d.values() if isinstance(v, (list, dict))]
        return max(listes) if listes else len(d)
    return 1 if d not in (None, "") else 0


def publie(chemin):
    r = subprocess.run(["git", "show", f"HEAD:{chemin}"], capture_output=True)
    if r.returncode:
        return None
    try:
        return json.loads(r.stdout)
    except ValueError:
        return None


def suivis(dossier):
    r = subprocess.run(["git", "ls-files", "--", dossier], capture_output=True, text=True)
    return [f for f in r.stdout.split() if f.endswith(".json")]


fichiers, erreurs = [], []
for arg in sys.argv[1:]:
    arg = arg.rstrip("/")
    if os.path.isdir(arg):
        for racine, _, noms in os.walk(arg):
            fichiers += [os.path.join(racine, n) for n in noms if n.endswith(".json")]
        presents = set(fichiers)
        erreurs += [f"{f} : fichier publié disparu" for f in suivis(arg) if f not in presents]
    elif os.path.exists(arg):
        fichiers.append(arg)
    elif publie(arg) is not None:
        erreurs.append(f"{arg} : fichier publié disparu")
    else:
        erreurs.append(f"{arg} : introuvable")

for f in sorted(set(fichiers)):
    try:
        with open(f, encoding="utf-8") as h:
            neuf = json.load(h)
    except Exception as e:
        erreurs.append(f"{f} : JSON illisible ({e})")
        continue
    n = taille(neuf)
    ancien = publie(f)
    a = taille(ancien) if ancien is not None else None
    if n == 0 and (a is None or a > 0):
        erreurs.append(f"{f} : vide" + (f" (publié : {a})" if a else ""))
    elif a is not None and a >= SEUIL_PETIT and n < a * PERTE_MAX:
        erreurs.append(f"{f} : {n} éléments au lieu de {a} (perte de plus de {PERTE_MAX:.0%})")

print(f"{len(set(fichiers))} fichier(s) vérifié(s)")
for e in erreurs:
    print("::error::" + e)
sys.exit(1 if erreurs else 0)
