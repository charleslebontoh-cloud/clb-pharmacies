# -*- coding: utf-8 -*-
"""Sentinel · moteur de collecte et d'analyse BRVM.

Modes :
  live   -> cours du jour (brvm.org) + analyse + alertes
  night  -> historiques (sikafinance), fondamentaux, actualités + analyse + alertes
  full   -> reconstruit tout l'historique depuis 2016 puis night
"""
import json, os, re, sys, time, math, html, unicodedata, datetime as dt, hashlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np

D = "bourse/data"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
NTFY = os.environ.get("NTFY_TOPIC", "")
APP = "https://charleslebontoh-cloud.github.io/clb-pharmacies/bourse/"
NOW = dt.datetime.utcnow()
os.makedirs(D + "/h", exist_ok=True)


# ---------------------------------------------------------------- utilitaires
def get(url, data=None, tries=3, timeout=45):
    for k in range(tries):
        try:
            h = {"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"}
            body = None
            if data is not None:
                body = json.dumps(data).encode()
                h["Content-Type"] = "application/json"
            r = urllib.request.urlopen(urllib.request.Request(url, body, h), timeout=timeout)
            return r.read().decode("utf-8", "ignore")
        except Exception as e:
            if k == tries - 1:
                print("ERR", url, e)
                return ""
            time.sleep(2 + 3 * k)


def load(p, dflt):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return dflt


def save(p, obj, compact=True):
    tmp = p + ".new"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":") if compact else None)
    os.replace(tmp, p)


def num(s):
    s = (s or "").replace("\xa0", "").replace(" ", "").replace("%", "").replace(" ", "")
    s = s.replace(",", ".")
    try:
        return float(s)
    except Exception:
        return None


def text_tokens(h):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S)
    t = re.sub(r"<[^>]+>", "|", t)
    t = html.unescape(t)
    t = re.sub(r"[ \t\r\n\xa0]+", " ", t)
    return [x.strip() for x in t.split("|") if x.strip()]


def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


# ---------------------------------------------------------------- univers
COUNTRY = [("COTE D'IVOIRE", "ci", "Côte d'Ivoire"), ("SENEGAL", "sn", "Sénégal"), ("BENIN", "bj", "Bénin"),
           ("BURKINA", "bf", "Burkina Faso"), ("MALI", "ml", "Mali"), ("NIGER", "ne", "Niger"), ("TOGO", "tg", "Togo")]

ALIAS = {
    "SNTS": ["Sonatel"], "ORAC": ["Orange CI", "Orange Côte d'Ivoire"], "SGBC": ["SGBCI", "Société Générale Côte", "SGCI"],
    "ECOC": ["Ecobank CI", "Ecobank Côte"], "ETIT": ["ETI", "Ecobank Transnational"], "TTLC": ["TotalEnergies Côte", "Total CI", "TotalEnergies CI"],
    "TTLS": ["TotalEnergies Sénégal", "Total Sénégal"], "CIEC": ["CIE"], "SDCC": ["Sodeci"], "PALC": ["Palmci"], "SPHC": ["SAPH"],
    "SOGC": ["SOGB"], "SCRC": ["Sucrivoire"], "SLBC": ["Solibra"], "NTLC": ["Nestlé CI", "Nestlé Côte", "Nestlé"], "UNLC": ["Unilever"],
    "UNXC": ["Uniwax"], "SMBC": ["SMB"], "ABJC": ["Servair"], "ONTBF": ["Onatel"], "ORGT": ["Oragroup"], "CBIBF": ["Coris Bank", "Coris"],
    "NSBC": ["NSIA Banque", "NSIA"], "SIBC": ["SIB"], "BICC": ["BICICI", "BICI CI", "BICI Côte"], "BICB": ["BIIC"], "CFAC": ["CFAO"],
    "PRSC": ["Tractafric"], "SHEC": ["Vivo Energy"], "STBC": ["SITAB"], "SEMC": ["Crown Siem", "Eviosys"], "FTSC": ["Filtisac"],
    "NEIC": ["NEI-CEDA", "NEI CEDA"], "SICC": ["Sicor"], "STAC": ["Setao"], "SAFC": ["Safca"], "CABC": ["Sicable"],
    "LNBB": ["Loterie Nationale du Bénin", "LNB"], "SDSC": ["AGL", "Africa Global Logistics", "Bolloré Transport"], "SVOC": ["Movis"],
    "BNBC": ["Bernabé"], "BBGC": ["Bridge Bank"], "SIVC": ["Erium", "Air Liquide CI"],
    "BOAC": ["BOA CI", "BOA Côte", "Bank of Africa CI", "Bank of Africa Côte"], "BOAM": ["BOA Mali", "Bank of Africa Mali"],
    "BOAS": ["BOA Sénégal", "Bank of Africa Sénégal"], "BOAB": ["BOA Bénin", "Bank of Africa Bénin"], "BOAN": ["BOA Niger", "Bank of Africa Niger"],
    "BOABF": ["BOA Burkina", "Bank of Africa Burkina"],
}

DISPLAY = {"ABJC": "Servair Abidjan", "BBGC": "Bridge Bank Group CI", "BICB": "BIIC Bénin", "BICC": "BICICI", "BNBC": "Bernabé CI",
           "BOAB": "BOA Bénin", "BOABF": "BOA Burkina Faso", "BOAC": "BOA Côte d'Ivoire", "BOAM": "BOA Mali", "BOAN": "BOA Niger",
           "BOAS": "BOA Sénégal", "CABC": "Sicable", "CBIBF": "Coris Bank International", "CFAC": "CFAO Motors CI", "CIEC": "CIE",
           "ECOC": "Ecobank CI", "ETIT": "Ecobank Transnational (ETI)", "FTSC": "Filtisac", "LNBB": "Loterie Nationale du Bénin",
           "NEIC": "NEI-CEDA", "NSBC": "NSIA Banque CI", "NTLC": "Nestlé CI", "ONTBF": "Onatel Burkina", "ORAC": "Orange Côte d'Ivoire",
           "ORGT": "Oragroup", "PALC": "Palmci", "PRSC": "Tractafric Motors", "SAFC": "Safca", "SCRC": "Sucrivoire", "SDCC": "SODECI",
           "SDSC": "Africa Global Logistics", "SEMC": "Eviosys Packaging Siem", "SGBC": "Société Générale CI", "SHEC": "Vivo Energy CI",
           "SIBC": "Société Ivoirienne de Banque", "SICC": "Sicor", "SIVC": "Erium CI (ex-Air Liquide)", "SLBC": "Solibra", "SMBC": "SMB",
           "SNTS": "Sonatel", "SOGC": "SOGB", "SPHC": "SAPH", "STAC": "Setao", "STBC": "Sitab", "TTLC": "TotalEnergies CI",
           "TTLS": "TotalEnergies Sénégal", "UNLC": "Unilever CI", "UNXC": "Uniwax"}

SECTOR_FIX = {"Services Financiers": "Services financiers", "Consommation de Base": "Consommation de base",
              "Consommation Discrétionnaire": "Consommation discrétionnaire", "Télécommunications": "Télécoms",
              "Services Publics": "Services publics", "Industriels": "Industrie", "Energie": "Énergie"}


def brvm_quotes():
    h = get("https://www.brvm.org/fr/cours-actions/0")
    rows = re.findall(r"<tr><td>([A-Z0-9]{3,6})</td><td>([^<]+)</td>(.*?)</tr>", h, flags=re.S)
    q = {}
    for t, name, rest in rows:
        cells = [re.sub(r"<[^>]+>", "", c) for c in re.findall(r"<td[^>]*>(.*?)</td>", rest, flags=re.S)]
        if len(cells) < 5:
            continue
        vol, prev, op, cl, var = [num(c) for c in cells[:5]]
        q[t] = {"n": html.unescape(name).strip(), "v": vol or 0, "p": prev, "o": op, "c": cl, "var": var}
    m = re.search(r"Dernière mise à jour\s*:\s*([^<]+)<", h)
    mk = {}
    for lab, key in [("Valeur des transactions", "val"), ("Capitalisation Actions", "capA"), ("Capitalisation des obligations", "capO")]:
        mm = re.search(re.escape(lab) + r"</td>\s*<td[^>]*>([^<]+)<", h)
        if mm:
            mk[key] = num(mm.group(1).replace("FCFA", ""))
    for lab in ["BRVM-C", "BRVM-30", "BRVM-PRES"]:
        mm = re.search(re.escape(lab) + r"</td>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>(.*?)</td>", h, flags=re.S)
        if mm:
            mk[lab] = [num(mm.group(1)), num(re.sub(r"<[^>]+>", "", mm.group(2)))]
    st = "ouverte" if re.search(r"Séance Ouverte", h, re.I) else "fermée"
    return q, (m.group(1).strip() if m else ""), mk, st


def brvm_sectors():
    sec = {}
    for i in range(188, 206):
        h = get("https://www.brvm.org/fr/cours-actions/%d" % i, tries=1)
        m = re.search(r'<h1 class="page-header">([^<]+)</h1>', h)
        if not m or m.group(1).strip() == "Toutes":
            continue
        name = html.unescape(m.group(1).strip())
        if name not in SECTOR_FIX:
            continue
        a = h.find('id="block-system-main"')
        body = h[a:h.find("</table>", a)] if a > 0 else ""
        for t in re.findall(r"<tr><td>([A-Z0-9]{3,6})</td>", body):
            sec[t] = SECTOR_FIX[name]
    return sec


def universe(q):
    U = load(D + "/tickers.json", {})
    for t, x in q.items():
        u = U.get(t, {"t": t})
        u["n"] = x["n"]
        up = fold(x["n"].replace("’", "'")).upper()
        for k, suf, lab in COUNTRY:
            if fold(k).upper() in up:
                u["c"] = lab
                u.setdefault("sk", t + "." + suf)
                u["nm"] = re.sub(r"\s+" + re.escape(k) + r".*$", "", x["n"], flags=re.I).strip() or x["n"]
                break
        u.setdefault("sk", t + ".ci")
        U[t] = u
    cnt = {}
    for t, u in U.items():
        u["nm"] = DISPLAY.get(t) or (u.get("nm") or t).title()
        cnt[u["nm"]] = cnt.get(u["nm"], 0) + 1
    for u in U.values():
        if cnt[u["nm"]] > 1 and u.get("c"):
            u["nm"] = u["nm"] + " " + u["c"]
    if any(u.get("s") in (None, "Actions") for u in U.values()) or (NOW.weekday() == 0 and NOW.hour >= 18) or os.environ.get("SECTORS"):
        try:
            sec = brvm_sectors()
            for t, s in sec.items():
                if t in U:
                    U[t]["s"] = s
        except Exception as e:
            print("secteurs", e)
    save(D + "/tickers.json", U)
    return U


# ---------------------------------------------------------------- historiques
def sika_hist(code, d0, d1):
    out = []
    a = d0
    while a <= d1:
        b = min(a + dt.timedelta(days=88), d1)
        r = get("https://www.sikafinance.com/api/general/GetHistos",
                {"ticker": code, "datedeb": a.isoformat(), "datefin": b.isoformat(), "xperiod": "0"}, tries=2)
        try:
            j = json.loads(r)
            if isinstance(j.get("lst"), list):
                for x in j["lst"]:
                    d = dt.datetime.strptime(x["Date"], "%d/%m/%Y").date().isoformat()
                    out.append((d, round(x["Close"], 2), int(x.get("Volume") or 0)))
        except Exception:
            pass
        a = b + dt.timedelta(days=1)
        time.sleep(0.25)
    return out


def merge_hist(path, rows):
    H = load(path, {"d": [], "c": [], "v": []})
    m = {d: (c, v) for d, c, v in zip(H["d"], H["c"], H["v"])}
    for d, c, v in rows:
        if c and c > 0:
            m[d] = (c, v)
    ds = sorted(m)
    H = {"d": ds, "c": [m[d][0] for d in ds], "v": [m[d][1] for d in ds]}
    save(path, H)
    return H


def update_hist(U, full=False):
    d1 = NOW.date()

    def one(t):
        u = U[t]
        p = "%s/h/%s.json" % (D, t)
        have = os.path.exists(p) and not full
        d0 = (d1 - dt.timedelta(days=120)) if have else dt.date(2016, 1, 1)
        rows = sika_hist(u["sk"], d0, d1)
        if not rows and not have:
            for suf in ["ci", "sn", "bj", "bf", "ml", "ne", "tg"]:
                c = t + "." + suf
                if c == u["sk"]:
                    continue
                rows = sika_hist(c, d1 - dt.timedelta(days=80), d1)
                if rows:
                    u["sk"] = c
                    rows = sika_hist(c, d0, d1)
                    break
        if rows:
            merge_hist(p, rows)
        return t, len(rows)

    with ThreadPoolExecutor(4) as ex:
        res = list(ex.map(one, sorted(U)))
    print("hist", sum(1 for _, n in res if n), "/", len(res))
    save(D + "/tickers.json", U)
    # indices
    I = load(D + "/idx.json", {})
    for code, key in [("BRVMC", "BRVM-C"), ("BRVM30", "BRVM-30"), ("BRVMPR", "BRVM-PRES")]:
        have = key in I and not full
        rows = sika_hist(code, (d1 - dt.timedelta(days=120)) if have else dt.date(2016, 1, 1), d1)
        m = dict(zip(I.get(key, {}).get("d", []), I.get(key, {}).get("c", [])))
        for d, c, v in rows:
            m[d] = c
        ds = sorted(m)
        I[key] = {"d": ds, "c": [m[d] for d in ds]}
    save(D + "/idx.json", I)


def live_into_hist(q, mk):
    """ajoute la séance du jour (cours brvm.org) aux historiques"""
    if NOW.weekday() >= 5:
        return
    d = NOW.date().isoformat()
    for t, x in q.items():
        if not x.get("c"):
            continue
        p = "%s/h/%s.json" % (D, t)
        if os.path.exists(p):
            merge_hist(p, [(d, x["c"], int(x["v"] or 0))])
    I = load(D + "/idx.json", {})
    for k in ["BRVM-C", "BRVM-30", "BRVM-PRES"]:
        if k in mk and k in I and mk[k][0]:
            m = dict(zip(I[k]["d"], I[k]["c"]))
            m[d] = mk[k][0]
            ds = sorted(m)
            I[k] = {"d": ds, "c": [m[x] for x in ds]}
    save(D + "/idx.json", I)


# ---------------------------------------------------------------- fondamentaux & actualités
LABELS = {"Chiffre d'affaires": "ca", "Croissance CA": "gca", "Résultat net": "rn", "Croissance RN": "grn",
          "BNPA": "bnpa", "PER": "per", "Dividende": "div"}


def parse_societe(h):
    T = text_tokens(h)
    f = {}
    for i, x in enumerate(T):
        if x.startswith("Nombre de titres"):
            f["shares"] = num(T[i + 1])
        elif x.startswith("Flottant"):
            f["float"] = num(T[i + 1])
        elif x.startswith("Principaux actionnaires") and i + 1 < len(T):
            f["hold"] = [[a.split("*")[0].strip().title(), num(a.split("*")[1])] for a in T[i + 1].split(";") if "*" in a][:6]
        elif x.startswith("Les chiffres sont en millions"):
            yrs = []
            j = i + 1
            while j < len(T) and re.fullmatch(r"\d{4}", T[j]):
                yrs.append(int(T[j]))
                j += 1
            f["yrs"] = yrs
            n = len(yrs)
            while j < len(T) and n:
                lab = T[j]
                if lab in LABELS:
                    k = LABELS[lab]
                    vals = []
                    j += 1
                    while j < len(T) and T[j] not in LABELS and len(vals) < n and re.fullmatch(r"[-+0-9 ,.%\xa0]+|-", T[j]):
                        vals.append(num(T[j]))
                        j += 1
                    if k in ("gca", "grn"):
                        vals = [None] * (n - len(vals)) + vals
                    f[k] = vals[:n]
                elif lab.startswith("Evolution") or lab.startswith("["):
                    break
                else:
                    j += 1
        elif re.match(r"(Secteur|Activité|Secteur d'activité)\s*:?$", x) and i + 1 < len(T):
            f.setdefault("act", T[i + 1][:120])
    return f


def parse_cotation(h, sk):
    T = text_tokens(h)
    f = {}
    for i, x in enumerate(T):
        if x == "Beta 1 an":
            f["beta"] = num(T[i + 1])
        elif x == "RSI" and "rsi" not in f:
            f["rsiS"] = num(T[i + 1])
        elif x == "DERNIERS DIVIDENDES":
            dv = []
            j = i + 4
            while j + 2 < len(T) and re.fullmatch(r"\d{4}", T[j]):
                dv.append([int(T[j]), num(T[j + 1]), num(T[j + 2])])
                j += 3
            f["dvh"] = dv
    # actualités de la valeur avec liens
    links = {html.unescape(re.sub(r"\s+", " ", b)).strip(): a for a, b in re.findall(r'href="(/marches/[^"]+_\d+)"[^>]*>([^<]{15,})<', h)}
    news = []
    try:
        i = T.index("ACTUALITES")
        j = i + 1
        while j + 1 < len(T) and T[j] != "HISTORIQUE":
            if re.fullmatch(r"\d\d/\d\d/\d\d", T[j]):
                ttl = T[j + 1]
                d = dt.datetime.strptime(T[j], "%d/%m/%y").date().isoformat()
                news.append([d, ttl, "https://www.sikafinance.com" + links[ttl] if ttl in links else ""])
                j += 2
            else:
                j += 1
    except ValueError:
        pass
    f["news"] = news[:10]
    com = []
    try:
        i = T.index("COMMUNIQUES")
        for j in range(i + 1, min(len(T) - 1, i + 30)):
            if re.fullmatch(r"\d\d/\d\d/\d{4}", T[j]):
                com.append([dt.datetime.strptime(T[j], "%d/%m/%Y").date().isoformat(), T[j + 1].replace("dactiv", "d'activ").replace("dactions", "d'actions")])
    except ValueError:
        pass
    f["com"] = com[:6]
    return f


def update_fund(U):
    F = load(D + "/fund.json", {})

    def one(t):
        sk = U[t]["sk"]
        f = dict(F.get(t, {}))
        h = get("https://www.sikafinance.com/marches/societe/" + sk, tries=2)
        if h:
            g = parse_societe(h)
            if g.get("yrs"):
                f.update(g)
        h = get("https://www.sikafinance.com/marches/cotation_" + sk, tries=2)
        if h:
            f.update(parse_cotation(h, sk))
        return t, f

    with ThreadPoolExecutor(4) as ex:
        for t, f in ex.map(one, sorted(U)):
            F[t] = f
    save(D + "/fund.json", F)
    return F


def update_news(U):
    N = load(D + "/news.json", {})
    h = get("https://www.sikafinance.com/marches/actualites_bourse_brvm")
    seen = 0
    best = {}
    for a, at, b in re.findall(r'href="(?:https?://www\.sikafinance\.com)?(/marches/[a-z0-9-]+_\d+)"([^>]*)>(.*?)</a>', h, flags=re.S):
        b = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", b))).strip()
        m = re.search(r'title="([^"]{20,})"', at)
        if len(b) < 20 and m:
            b = html.unescape(m.group(1)).strip()
        if len(b) > len(best.get(a, "")):
            best[a] = b
    for a, b in best.items():
        sl = 0
        if len(b) < 20:
            b, sl = a.split("/")[-1].rsplit("_", 1)[0].replace("-", " ").capitalize(), 1
        u = "https://www.sikafinance.com" + a
        if u not in N or not N[u].get("t") or (N[u].get("sl") and not sl):
            N[u] = {"t": b, "d": N.get(u, {}).get("d") or NOW.date().isoformat(), "id": int(a.rsplit("_", 1)[1]), "sl": sl}
            seen += 1
    F = load(D + "/fund.json", {})
    for t, f in F.items():
        for d, ttl, u in f.get("news", []):
            if u and (u not in N or N[u].get("sl")):
                N[u] = {"t": ttl, "d": d, "id": int(u.rsplit("_", 1)[1]) if re.search(r"_\d+$", u) else 0}
    # tagging
    al = {}
    for t, u in U.items():
        names = ALIAS.get(t, []) + ([u.get("nm")] if u.get("nm") and len(u.get("nm", "")) > 3 and not u["nm"].startswith("BOA") else [])
        al[t] = [fold(x) for x in names if x]
    for u, x in N.items():
        ft = " " + fold(x["t"]) + " "
        x["tk"] = [t for t, ns in al.items() if any(re.search(r"(?<![a-z0-9])" + re.escape(n) + r"(?![a-z0-9])", ft) for n in ns)]
        x["s"] = sentiment(x["t"])
    # garder 400 plus récentes
    N = {u: x for u, x in N.items() if x.get("t")}
    items = sorted(N.items(), key=lambda kv: (kv[1]["d"], kv[1].get("id", 0)), reverse=True)[:400]
    N = dict(items)
    save(D + "/news.json", N)
    print("news +", seen)
    return N


POS = ["hausse", "progress", "bond", "record", "croissance", "benefice", "rebond", "gagne", "envol", "plus haut", "hausse de",
       "s'apprecie", "surperform", "dividende en hausse", "augmente", "amelior", "solide", "performance", "succes", "attise l'engouement",
       "impulse", "porte le marche", "mene le rebond", "seuil psychologique", "acquisition", "contrat", "expansion", "relev"]
NEG = ["baisse", "recul", "chute", "perte", "deficit", "repli", "plonge", "degringol", "suspension", "suspend", "contentieux",
       "avertissement", "depreciation", "deprecie", "sanction", "litige", "difficult", "sous pression", "decroch", "effondr",
       "plombe", "freine", "degrad", "en berne", "abaisse", "redressement", "liquidation", "amende", "pese sur"]


def sentiment(t):
    f = fold(t)
    p = sum(1 for w in POS if w in f)
    n = sum(1 for w in NEG if w in f)
    m = re.search(r"(hausse|progression|bond|croissance)[^%]{0,40}?(\d+[.,]?\d*)\s*%", f)
    if m:
        p += 1
    m = re.search(r"(baisse|recul|chute|repli)[^%]{0,40}?(\d+[.,]?\d*)\s*%", f)
    if m:
        n += 1
    return max(-2, min(2, p - n))


# ---------------------------------------------------------------- analyse
def ema(x, n):
    a = 2 / (n + 1)
    out = np.empty_like(x)
    out[0] = x[0]
    for i in range(1, len(x)):
        out[i] = a * x[i] + (1 - a) * out[i - 1]
    return out


def rsi(c, n=14):
    d = np.diff(c, prepend=c[0])
    up = np.where(d > 0, d, 0.0)
    dn = np.where(d < 0, -d, 0.0)
    au, ad = ema(up, 2 * n - 1), ema(dn, 2 * n - 1)
    return 100 - 100 / (1 + au / np.maximum(ad, 1e-9))


def sma(x, n):
    c = np.cumsum(np.insert(x, 0, 0.0))
    out = np.full(len(x), np.nan)
    if len(x) >= n:
        out[n - 1:] = (c[n:] - c[:-n]) / n
    return out


FEATS = ["r21", "r63", "r126", "r252", "dma50", "dma200", "rsi", "vol63", "vr", "hi52", "rev5"]
H = 63  # horizon de prévision (≈ 3 mois de bourse)


def features(c, v):
    c = np.asarray(c, float)
    v = np.asarray(v, float)
    n = len(c)
    lc = np.log(c)

    def lag(k):
        out = np.full(n, np.nan)
        out[k:] = lc[k:] - lc[:-k]
        return out
    r1 = np.diff(lc, prepend=lc[0])
    vol = np.full(n, np.nan)
    for i in range(63, n):
        vol[i] = r1[i - 62:i + 1].std() * math.sqrt(252)
    hi = np.full(n, np.nan)
    for i in range(252, n):
        hi[i] = lc[i] - lc[i - 251:i + 1].max()
    vv = v * c
    vr = np.log((sma(vv, 20) + 1) / (sma(vv, 120) + 1))
    F = {"r21": lag(21), "r63": lag(63), "r126": lag(126), "r252": lag(252),
         "dma50": lc - np.log(sma(c, 50)), "dma200": lc - np.log(sma(c, 200)), "rsi": (rsi(c) - 50) / 50,
         "vol63": vol, "vr": vr, "hi52": hi, "rev5": lag(5)}
    return np.column_stack([F[k] for k in FEATS]), r1, vol


def zcs(X):
    """standardisation transversale (par date) robuste"""
    m = np.nanmedian(X, axis=0)
    s = np.nanstd(X, axis=0)
    s[s == 0] = 1
    Z = (X - m) / s
    return np.clip(np.nan_to_num(Z), -3, 3)


def spearman(a, b):
    if len(a) < 5:
        return np.nan
    ra = np.argsort(np.argsort(a))
    rb = np.argsort(np.argsort(b))
    return np.corrcoef(ra, rb)[0, 1]


def ridge(X, y, lam=8.0):
    X1 = np.column_stack([np.ones(len(X)), X])
    I = np.eye(X1.shape[1]) * lam
    I[0, 0] = 0
    return np.linalg.solve(X1.T @ X1 + I, X1.T @ y)


FW = {"ey": 0.35, "dy": 0.20, "lv": 0.15, "vr": 0.15, "rv": 0.15}
FEAT_FR = {"ey": "rendement bénéficiaire (PER bas)", "dy": "rendement du dividende", "lv": "faible volatilité",
           "vr": "regain d'intérêt des acheteurs (volumes)", "rv": "repli récent à rattraper"}


def model(HS, F):
    """Modèle multifactoriel BRVM : poids fixés a priori (valeur, rendement, faible volatilité,
    volumes, retour à la moyenne court terme), validé sur l'historique depuis 2017."""
    tk = sorted(HS)
    ds = sorted(set(d for h in HS.values() for d in h["d"]))
    di = {d: i for i, d in enumerate(ds)}
    T = len(ds)
    M = np.full((len(tk), T), np.nan)
    VV = np.zeros((len(tk), T))
    for k, t in enumerate(tk):
        for d, c, v in zip(HS[t]["d"], HS[t]["c"], HS[t]["v"]):
            M[k, di[d]] = c
            VV[k, di[d]] = v
        last = np.nan
        for i in range(T):
            if np.isnan(M[k, i]):
                M[k, i] = last
            else:
                last = M[k, i]
    L = np.log(M)
    MV = np.nan_to_num(M) * VV
    cs = np.cumsum(np.insert(MV, 0, 0, axis=1), axis=1)
    lr = np.diff(L, axis=1, prepend=L[:, :1])

    def mval(i, n):
        return (cs[:, i + 1] - cs[:, i + 1 - n]) / n

    def dvy(i):
        Y = int(ds[i][:4])
        out = np.full(len(tk), np.nan)
        for k, t in enumerate(tk):
            d = None
            for y, a, r in F.get(t, {}).get("dvh", []) or []:
                if y == Y - 2 and d is None:
                    d = a
                if y == Y - 1 and ds[i][5:] >= "07-01":
                    d = a
            if d and M[k, i] > 0:
                out[k] = d / M[k, i]
        return out

    def ey(i):
        Y = int(ds[i][:4])
        out = np.full(len(tk), np.nan)
        for k, t in enumerate(tk):
            f = F.get(t, {})
            e = None
            b = f.get("bnpa") or []
            for j, y in enumerate(f.get("yrs") or []):
                if j < len(b) and b[j] is not None and (y == Y - 2 or (y == Y - 1 and ds[i][5:] >= "06-01")):
                    e = b[j]
            if e is not None and M[k, i] > 0:
                out[k] = e / M[k, i]
        return out

    def factors(i):
        with np.errstate(all="ignore"):
            lv = -np.nanstd(lr[:, i - 62:i + 1], axis=1)
            vr = np.log((mval(i, 21) + 1) / (mval(i, 121) + 1))
            rv = -(L[:, i] - L[:, i - 5])
        return {"ey": ey(i), "dy": dvy(i), "lv": lv, "vr": vr, "rv": rv}

    def rz(x):
        r = np.full(len(x), np.nan)
        ok = ~np.isnan(x)
        if ok.sum() < 5:
            return np.zeros(len(x))
        rk = np.argsort(np.argsort(x[ok]))
        r[ok] = (rk / (ok.sum() - 1) - 0.5) * 2
        return np.nan_to_num(r)

    def score(i):
        f = factors(i)
        parts = {k: FW[k] * rz(f[k]) for k in FW}
        sc = sum(parts.values())
        sc[np.isnan(L[:, i])] = np.nan
        return sc, parts, f

    res, X, Yr = {}, [], []
    for i in range(260, T - H, 5):
        sc, _, _ = score(i)
        y = L[:, i + H] - L[:, i]
        ok = ~(np.isnan(sc) | np.isnan(y))
        if ok.sum() < 10:
            continue
        a, b = sc[ok], y[ok] - y[ok].mean()
        ic = spearman(a, b)
        o = np.argsort(a)
        q = max(2, ok.sum() // 5)
        r = res.setdefault(ds[i][:4], {"ic": [], "hit": [], "ls": []})
        r["ic"].append(ic)
        r["hit"].append(float(np.mean(np.sign(a) == np.sign(b))))
        r["ls"].append(float(b[o[-q:]].mean() - b[o[:q]].mean()))
        X.extend(a.tolist())
        Yr.extend(b.tolist())
    X, Yr = np.array(X), np.array(Yr)
    slope = float(max(0.0, (X @ Yr) / max(X @ X, 1e-9))) if len(X) > 50 else 0.0
    bt = [{"y": int(y), "ic": round(float(np.mean(r["ic"])), 3), "hit": round(float(np.mean(r["hit"])), 3),
           "ls": round(float(np.mean(r["ls"])), 4), "n": len(r["ic"])} for y, r in sorted(res.items())]
    ics = [v for r in res.values() for v in r["ic"]]
    i = T - 1
    sc, parts, f = score(i)
    pnow = {t: float(sc[k] * slope) for k, t in enumerate(tk) if not np.isnan(sc[k])}
    contrib = {t: {kk: float(parts[kk][k]) for kk in FW} for k, t in enumerate(tk)}
    summ = {"ic": round(float(np.mean(ics)), 3) if ics else None,
            "t": round(float(np.mean(ics) / (np.std(ics) or 1) * math.sqrt(len(ics) / 13)), 1) if ics else None,
            "hit": round(float(np.mean([b["hit"] for b in bt])), 3) if bt else None,
            "ls": round(float(np.mean([b["ls"] for b in bt])), 4) if bt else None,
            "slope": round(slope, 4), "years": bt, "w": FW, "h": H, "asof": ds[-1]}
    return pnow, contrib, summ


def pct(x, p):
    x = [v for v in x if v is not None and not (isinstance(v, float) and math.isnan(v))]
    return float(np.percentile(x, p)) if x else None


def analyze(U, q, mk, st, upd):
    HS = {}
    for t in U:
        h = load("%s/h/%s.json" % (D, t), None)
        if h and len(h["d"]) > 30:
            HS[t] = h
    F = load(D + "/fund.json", {})
    N = load(D + "/news.json", {})
    try:
        pnow, contrib, msum = model(HS, F)
    except Exception as e:
        print("model ERR", e)
        pnow, contrib, msum = {}, {}, load(D + "/signals.json", {}).get("model", {})
    today = NOW.date()
    S = {}
    # --- indicateurs individuels
    for t, h in HS.items():
        c = np.array(h["c"], float)
        v = np.array(h["v"], float)
        px = q.get(t, {}).get("c") or c[-1]
        n = len(c)
        r = lambda k: (px / c[-1 - k] - 1) if n > k else None
        ma = lambda k: float(np.mean(c[-k:])) if n >= k else None
        rs = float(rsi(c)[-1]) if n > 20 else None
        lr = np.diff(np.log(c[-253:])) if n > 30 else np.array([0.0])
        vol = float(lr.std() * math.sqrt(252)) if len(lr) > 10 else 0.3
        e12, e26 = ema(c, 12), ema(c, 26)
        macd = e12 - e26
        sig = ema(macd, 9)
        hi52 = float(c[-252:].max())
        lo52 = float(c[-252:].min())
        dv = float(np.mean((c * v)[-60:])) if n > 60 else float(np.mean(c * v))
        vr = float(np.mean((c * v)[-5:]) / max(np.mean((c * v)[-60:]), 1)) if n > 60 else 1
        ma50, ma200 = ma(50), ma(200)
        tech = 50.0
        reasons = []
        if ma50 and ma200:
            if px > ma50 > ma200:
                tech += 15
                reasons.append(["+", "Tendance haussière : cours au-dessus des moyennes 50 et 200 jours"])
            elif px < ma50 < ma200:
                tech -= 15
                reasons.append(["-", "Tendance baissière : cours sous les moyennes 50 et 200 jours"])
        if macd[-1] > sig[-1] and macd[-2] <= sig[-2]:
            tech += 6
            reasons.append(["+", "Croisement haussier du MACD"])
        elif macd[-1] < sig[-1] and macd[-2] >= sig[-2]:
            tech -= 6
            reasons.append(["-", "Croisement baissier du MACD"])
        if rs is not None:
            if rs < 30:
                tech += 6
                reasons.append(["+", "RSI %.0f : survente, rebond technique possible" % rs])
            elif rs > 75:
                tech -= 8
                reasons.append(["-", "RSI %.0f : surachat, risque de prise de bénéfices" % rs])
        if px >= hi52 * 0.995 and vr > 1.5:
            tech += 8
            reasons.append(["+", "Cassure du plus haut annuel avec volumes en hausse"])
        S[t] = {"px": px, "r1w": r(5), "r1m": r(21), "r3m": r(63), "r6m": r(126), "r1y": r(252),
                "ytd": (px / c[[i for i, d in enumerate(h["d"]) if d >= "%d-01-01" % today.year][0] - 1] - 1) if any(d >= "%d-01-01" % today.year for d in h["d"]) and h["d"][0] < "%d-01-01" % today.year else None,
                "rsi": rs, "vol": vol, "ma50": ma50, "ma200": ma200, "hi52": hi52, "lo52": lo52, "dv": dv, "vr": vr,
                "macd": float(macd[-1] - sig[-1]), "tech": max(0, min(100, tech)), "why": reasons,
                "sp": [float(x) for x in c[-64::3]] + ([float(px)] if px != c[-1] else [])}
    # --- fondamentaux par secteur
    for t, s in S.items():
        f = F.get(t, {})
        bnpa = [x for x in (f.get("bnpa") or []) if x]
        divs = [x for x in (f.get("div") or []) if x]
        s["per"] = s["px"] / bnpa[-1] if bnpa and bnpa[-1] > 0 else None
        s["dy"] = divs[-1] / s["px"] if divs else (f["dvh"][0][1] / s["px"] if f.get("dvh") and f["dvh"][0][1] else None)
        rn = [x for x in (f.get("rn") or []) if x is not None]
        ca = [x for x in (f.get("ca") or []) if x is not None]
        s["grn"] = ((rn[-1] / rn[-4]) ** (1 / 3) - 1) if len(rn) >= 4 and rn[-4] > 0 and rn[-1] > 0 else None
        s["gca"] = ((ca[-1] / ca[-4]) ** (1 / 3) - 1) if len(ca) >= 4 and ca[-4] > 0 and ca[-1] > 0 else None
        s["payout"] = divs[-1] / bnpa[-1] if divs and bnpa and bnpa[-1] > 0 else None
        s["loss"] = bool(rn and rn[-1] < 0)
        s["sec"] = U[t].get("s", "Autres")
    secs = {}
    for t, s in S.items():
        secs.setdefault(s["sec"], []).append(t)
    allper = [s["per"] for s in S.values() if s["per"] and 0 < s["per"] < 60]
    alldy = [s["dy"] for s in S.values() if s["dy"]]
    for t, s in S.items():
        peers = [S[x] for x in secs[s["sec"]]]
        mper = pct([p["per"] for p in peers if p["per"] and 0 < p["per"] < 60], 50) or pct(allper, 50)
        mdy = pct([p["dy"] for p in peers if p["dy"]], 50) or pct(alldy, 50)
        fs = 50.0
        why = []
        if s["loss"]:
            fs -= 20
            why.append(["-", "Dernier exercice en perte"])
        if s["per"] and mper:
            rel = s["per"] / mper
            fs += max(-15, min(15, (1 - rel) * 25))
            if rel < 0.8:
                why.append(["+", "Valorisation attractive : PER %.1f contre %.1f pour son secteur" % (s["per"], mper)])
            elif rel > 1.3:
                why.append(["-", "Valorisation tendue : PER %.1f contre %.1f pour son secteur" % (s["per"], mper)])
        if s["dy"]:
            fs += max(-5, min(15, (s["dy"] - 0.05) * 250))
            if s["dy"] >= 0.07:
                why.append(["+", "Rendement du dividende élevé : %.1f %%" % (s["dy"] * 100)])
        else:
            fs -= 5
        if s["grn"] is not None:
            fs += max(-12, min(12, s["grn"] * 80))
            if s["grn"] > 0.1:
                why.append(["+", "Bénéfices en croissance de %.0f %% par an sur 3 ans" % (s["grn"] * 100)])
            elif s["grn"] < -0.05:
                why.append(["-", "Bénéfices en recul de %.0f %% par an sur 3 ans" % (-s["grn"] * 100)])
        if s["payout"] and s["payout"] > 1.0:
            fs -= 5
            why.append(["-", "Dividende supérieur au bénéfice : peu soutenable"])
        s["fund"] = max(0, min(100, fs))
        s["mper"], s["mdy"] = mper, mdy
        # juste valeur
        fv = []
        bnpa = [x for x in (F.get(t, {}).get("bnpa") or []) if x]
        if bnpa and bnpa[-1] > 0 and mper:
            fv.append(bnpa[-1] * min(mper, 20))
        if s["dy"] and mdy:
            fv.append(s["px"] * s["dy"] / max(mdy, 0.03))
        s["fair"] = float(np.median(fv)) if fv else None
        s["why"] = s["why"] + why
    # --- actualités
    for t, s in S.items():
        items = [(x["d"], x["s"], x["t"], u) for u, x in N.items() if t in x.get("tk", [])]
        items.sort(reverse=True)
        sc = 0.0
        for d, se, ttl, u in items[:12]:
            age = (today - dt.date.fromisoformat(d)).days
            if age <= 60:
                sc += se * math.exp(-age / 25)
        s["news"] = max(0, min(100, 50 + sc * 12))
        s["nn"] = [[d, ttl, u, se] for d, se, ttl, u in items[:8]]
        if sc >= 1:
            s["why"].append(["+", "Actualité récente favorable"])
        elif sc <= -1:
            s["why"].append(["-", "Actualité récente défavorable"])
    # --- score composite et prévisions
    pv = [pnow[t] for t in S if t in pnow]
    for t, s in S.items():
        p = pnow.get(t)
        if p is not None and pv:
            rank = sum(1 for x in pv if x <= p) / len(pv)
            s["quant"] = 100 * rank
            top = sorted(contrib.get(t, {}).items(), key=lambda kv: -abs(kv[1]))[:2]
            for f, c in top:
                if abs(c) > 0.06:
                    s["why"].append(["+" if c > 0 else "-", "Modèle : %s %s" % (FEAT_FR[f], "favorable" if c > 0 else "défavorable")])
        else:
            s["quant"] = 50
        sc = 0.5 * s["quant"] + 0.25 * s["fund"] + 0.1 * s["tech"] + 0.15 * s["news"]
        liquid = s["dv"] >= 5e6
        s["liq"] = liquid
        if not liquid:
            s["why"].append(["-", "Titre peu liquide : ordres difficiles à exécuter"])
        s["score"] = round(sc, 1)
        first = "+" if sc >= 50 else "-"
        s["why"] = [w for w in s["why"] if w[0] == first] + [w for w in s["why"] if w[0] != first]
        reco = "Achat fort" if sc >= 72 else "Achat" if sc >= 62 else "Conserver" if sc >= 42 else "Alléger" if sc >= 33 else "Vendre"
        if not liquid and reco == "Achat fort":
            reco = "Achat"
        s["reco"] = reco
        # prévisions : modèle calibré (3 mois) + convergence vers la juste valeur + dividende
        m3 = p if p is not None else 0.0
        up = math.log(s["fair"] / s["px"]) if s.get("fair") else 0.0
        up = max(-0.5, min(0.5, up))
        dy = s["dy"] or 0
        mkt = 0.08  # dérive annuelle prudente du marché
        e = {"m1": m3 / 3 + mkt / 12 + up * 0.03, "m3": m3 + mkt / 4 + up * 0.08, "m12": m3 * 2 + mkt + up * 0.3}
        fc = {}
        for k, hz in [("m1", 21), ("m3", 63), ("m12", 252)]:
            sd = s["vol"] * math.sqrt(hz / 252)
            fc[k] = {"e": round(math.exp(e[k]) - 1, 4), "lo": round(math.exp(e[k] - 1.28 * sd) - 1, 4),
                     "hi": round(math.exp(e[k] + 1.28 * sd) - 1, 4), "tp": round(s["px"] * math.exp(e[k]))}
        s["fc"] = fc
        s["dy12"] = dy
    # --- résumé du marché
    ups = [t for t in q if (q[t].get("var") or 0) > 0]
    dns = [t for t in q if (q[t].get("var") or 0) < 0]
    srt = sorted([t for t in q if q[t].get("var") is not None], key=lambda t: q[t]["var"])
    secp = {}
    for sec, ts in secs.items():
        vs = [q[t]["var"] for t in ts if t in q and q[t].get("var") is not None]
        r1m = [S[t]["r1m"] for t in ts if S[t]["r1m"] is not None]
        secp[sec] = {"j": round(float(np.mean(vs)), 2) if vs else None, "m1": round(float(np.mean(r1m)) * 100, 2) if r1m else None,
                     "n": len(ts), "score": round(float(np.mean([S[t]["score"] for t in ts])), 1)}
    I = load(D + "/idx.json", {})
    comp = mk.get("BRVM-C")
    txt = []
    if comp:
        txt.append("Le BRVM Composite %s de %s %% à %s points." % ("gagne" if comp[1] > 0 else "cède" if comp[1] < 0 else "est stable,", fr(abs(comp[1])), fr(comp[0])))
    if q:
        txt.append("%d valeurs en hausse, %d en baisse, %d inchangées." % (len(ups), len(dns), len(q) - len(ups) - len(dns)))
    if srt:
        b, w = srt[-1], srt[0]
        txt.append("Meilleure performance : %s (%s %%) ; plus forte baisse : %s (%s %%)." % (nm(U, b), sg(q[b]["var"]), nm(U, w), sg(q[w]["var"])))
    if mk.get("val"):
        txt.append("%s FCFA échangés sur le marché des actions et obligations." % big(mk["val"]))
    best_sec = sorted([k for k in secp if secp[k]["j"] is not None], key=lambda k: secp[k]["j"])
    if best_sec:
        txt.append("Secteur le plus porteur du jour : %s ; le plus faible : %s." % (best_sec[-1], best_sec[0]))
    if "BRVM-C" in I and len(I["BRVM-C"]["c"]) > 260:
        cc = I["BRVM-C"]["c"]
        txt.append("Sur un an, l'indice composite évolue de %s %%." % sg((cc[-1] / cc[-253] - 1) * 100, 1))
    buys = sorted([t for t in S if S[t]["reco"] in ("Achat fort", "Achat")], key=lambda t: -S[t]["score"])[:3]
    if buys:
        txt.append("Opportunités repérées par Sentinel : %s." % ", ".join("%s (%s)" % (nm(U, t), S[t]["reco"].lower()) for t in buys))
    out = {"upd": upd, "gen": NOW.strftime("%Y-%m-%dT%H:%MZ"), "st": st, "mk": mk, "q": q, "summary": " ".join(txt), "sec": secp,
           "model": msum, "s": {t: rnd(s) for t, s in S.items()}}
    prev = load(D + "/signals.json", {})
    save(D + "/signals.json", out)
    alerts(U, out, prev, N)
    return out


def sg(x, n=2):
    return (("%+." + str(n) + "f") % x).replace(".", ",")


def fr(x):
    return ("%.2f" % x).replace(".", ",")


def big(x):
    return "{:,.0f}".format(x).replace(",", " ")


def nm(U, t):
    return (U.get(t, {}).get("nm") or t) if t in U else t


def rnd(s):
    s["why"] = [[g, re.sub(r"(\d)\.(\d)", r"\1,\2", w)] for g, w in s.get("why", [])]
    o = {}
    for k, v in s.items():
        if isinstance(v, float):
            o[k] = None if math.isnan(v) else round(v, 4)
        else:
            o[k] = v
    return o


# ---------------------------------------------------------------- alertes
def alerts(U, cur, prev, N):
    A = load(D + "/alerts.json", [])
    keys = {a["k"] for a in A}
    new = []
    day = NOW.date().isoformat()

    def add(k, t, lvl, title, msg):
        k = day + ":" + k
        if k in keys:
            return
        keys.add(k)
        a = {"k": k, "ts": NOW.strftime("%Y-%m-%dT%H:%MZ"), "t": t, "lv": lvl, "ti": title, "m": msg}
        A.insert(0, a)
        new.append(a)
    S, P = cur["s"], prev.get("s", {})
    rank = {"Vendre": 0, "Alléger": 1, "Conserver": 2, "Achat": 3, "Achat fort": 4}
    for t, s in S.items():
        n = nm(U, t)
        p = P.get(t)
        if p and p.get("reco") != s["reco"]:
            if rank[s["reco"]] >= 3 and rank[s["reco"]] > rank.get(p.get("reco"), 2):
                add("reco:" + t + s["reco"], t, "buy", "%s : signal %s" % (n, s["reco"].lower()),
                    "Score %.0f/100. Objectif 3 mois : %s FCFA (%+.1f %%). %s" % (s["score"], big(s["fc"]["m3"]["tp"]), s["fc"]["m3"]["e"] * 100, best_reason(s, "+")))
            elif rank[s["reco"]] <= 1 and rank[s["reco"]] < rank.get(p.get("reco"), 2):
                add("reco:" + t + s["reco"], t, "sell", "%s : signal %s" % (n, s["reco"].lower()),
                    "Score %.0f/100. %s" % (s["score"], best_reason(s, "-")))
        qv = cur["q"].get(t, {}).get("var")
        if qv is not None and abs(qv) >= 5:
            add("move:" + t, t, "up" if qv > 0 else "down", "%s %s de %s %%" % (n, "bondit" if qv > 0 else "chute", fr(abs(qv))[:-1] if abs(qv) < 10 else fr(abs(qv))),
                "Cours %s FCFA. Recommandation actuelle : %s." % (big(s["px"]), s["reco"].lower()))
        if s.get("hi52") and s["px"] >= s["hi52"] * 0.995 and (s.get("vr") or 0) > 1.8 and s["liq"]:
            add("brk:" + t, t, "buy", "%s casse son plus haut annuel" % n, "Volumes %s fois supérieurs à la moyenne : momentum haussier." % fr(s["vr"])[:-1])
        if s.get("rsi") is not None and s["rsi"] < 30 and s["fund"] >= 60:
            add("ovs:" + t, t, "buy", "%s en survente sur des fondamentaux solides" % n, "RSI %.0f, PER %s, rendement %s." % (
                s["rsi"], fr(s["per"])[:-1] if s.get("per") else "n.d.", (fr(s["dy"] * 100)[:-1] + " %") if s.get("dy") else "n.d."))
    # actualités fortes du jour
    for u, x in N.items():
        if x["d"] == day and abs(x.get("s", 0)) >= 2 and x.get("tk"):
            add("news:" + hashlib.md5(u.encode()).hexdigest()[:8], x["tk"][0], "news", "Actualité %s : %s" % ("positive" if x["s"] > 0 else "négative", nm(U, x["tk"][0])), x["t"])
    A = A[:300]
    save(D + "/alerts.json", A)
    print("alertes +", len(new))
    if NTFY and new and prev:
        for a in new[:6]:
            try:
                body = json.dumps({"topic": NTFY, "title": a["ti"], "message": a["m"], "click": APP + "#t=" + a["t"],
                                   "tags": [{"buy": "chart_with_upwards_trend", "up": "rocket", "sell": "warning", "down": "chart_with_downwards_trend", "news": "newspaper"}.get(a["lv"], "bell")],
                                   "priority": 4 if a["lv"] in ("buy", "sell") else 3}).encode()
                urllib.request.urlopen(urllib.request.Request("https://ntfy.sh/", body, {"Content-Type": "application/json"}), timeout=20)
            except Exception as e:
                print("ntfy", e)


def best_reason(s, sign):
    r = [w for g, w in s.get("why", []) if g == sign]
    return (r[0] + ".") if r else ""


# ---------------------------------------------------------------- main
def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "live"
    q, upd, mk, st = brvm_quotes()
    if not q:
        old = load(D + "/signals.json", {})
        q, upd, mk, st = old.get("q", {}), old.get("upd", ""), old.get("mk", {}), "fermée"
        print("brvm.org indisponible, reprise des cours précédents")
    U = universe(q)
    if mode in ("full", "night"):
        update_hist(U, full=(mode == "full"))
        update_fund(U)
        update_news(U)
    elif NOW.minute < 30 and NOW.hour in (10, 13):
        update_news(U)
    live_into_hist(q, mk)
    analyze(U, q, mk, st, upd)


if __name__ == "__main__":
    main()
