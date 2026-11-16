"""Met à jour pharmacies.json : pharmacies de garde de la semaine (planning UNPPCI)
publiées par pharmacies-de-garde.ci, pour Abidjan et l'intérieur du pays.

Ne remplace jamais une bonne liste par une liste vide, partielle ou plus ancienne :
le script s'arrête en erreur (code 1) si les données lues ne sont pas plausibles."""
import json, re, html, sys, time, urllib.request

BASE = "https://www.pharmacies-de-garde.ci/"
PAGES = ["liste-des-pharmacies-de-garde-a-abidjan-votre-permanence/",
         "liste-des-pharmacies-de-garde-a-linterieur-votre-permanence/"]
MOIS = {m: i + 1 for i, m in enumerate("janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre".split())}
MIN_TOTAL = 120  # une semaine normale compte environ 200 pharmacies
OUT = "pharmacies.json"


def get(url):
    for k in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (CLB-Health/1.0)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:
            print("essai", k + 1, url, e)
            time.sleep(10 * (k + 1))
    sys.exit(f"impossible de lire {url}")


def plain(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\s+", " ", s).strip()


def sans_accents(s):
    import unicodedata
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def periode(page):
    """« du Samedi 14 Novembre au Vendredi 20 Novembre 2026 » -> ("2026-11-14", "2026-11-20")."""
    m = re.search(r"du\s+[a-z]+\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\s+au\s+[a-z]+\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})",
                  sans_accents(plain(page)))
    if not m or m.group(2) not in MOIS or m.group(5) not in MOIS:
        return None
    j1, m1, a1, j2, m2, a2 = int(m.group(1)), MOIS[m.group(2)], m.group(3), int(m.group(4)), MOIS[m.group(5)], int(m.group(6))
    a1 = int(a1) if a1 else (a2 - 1 if m1 > m2 else a2)
    return f"{a1:04d}-{m1:02d}-{j1:02d}", f"{a2:04d}-{m2:02d}-{j2:02d}"


def zone(z):
    z = re.sub(r"\s+", " ", z).strip().upper()
    z = re.sub(r"^ZONE\s+", "", z)
    z = re.sub(r"^PORT BOUET", "PORT-BOUET", z)
    if "SONGON" in z:
        z = "SONGON + KM 17"
    return z


def telephone(s):
    m = re.search(r"(\d{2})[ .]?(\d{2})[ .]?(\d{2})[ .]?(\d{2})[ .]?(\d{2})", s)
    return " ".join(m.groups()) if m else ""


liste, periodes = [], set()
for p in PAGES:
    page = get(BASE + p)
    per = periode(page)
    if not per:
        sys.exit(f"période introuvable sur {p}")
    periodes.add(per)
    rows = re.findall(r'<td class="column-1">(.*?)</td>\s*<td class="column-2">(.*?)</td>\s*<td class="column-3">(.*?)</td>', page, re.S)
    n = 0
    for z, nom, contact in rows:
        z, nom, contact = plain(z), plain(nom), plain(contact)
        if not z or not nom:
            continue  # lignes de titre de secteur, sans pharmacie
        liste.append({"z": zone(z), "n": nom.upper(), "t": telephone(contact)})
        n += 1
    print(p, per, n, "pharmacies")

if len(periodes) != 1:
    sys.exit(f"les deux pages n'annoncent pas la même semaine : {periodes}")
du, au = periodes.pop()
if len(liste) < MIN_TOTAL:
    sys.exit(f"seulement {len(liste)} pharmacies lues (minimum {MIN_TOTAL}) : liste non publiée")

try:
    ancien = json.load(open(OUT, encoding="utf-8"))
except Exception:
    ancien = {}
if ancien.get("du", "") > du:
    sys.exit(f"le site affiche une semaine plus ancienne ({du}) que la liste actuelle ({ancien['du']})")
if ancien.get("du") == du and ancien.get("liste") == liste:
    print("liste inchangée")
    sys.exit(0)

json.dump({"du": du, "au": au, "source": "pharmacies-de-garde.ci (planning UNPPCI)",
           "maj": time.strftime("%Y-%m-%d"), "liste": liste},
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
print("écrit", OUT, du, "→", au, len(liste), "pharmacies")
