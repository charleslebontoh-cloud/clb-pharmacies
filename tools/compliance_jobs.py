# -*- coding: utf-8 -*-
"""VERITAS · offres d'emploi conformité / LBC-FT / risques en Côte d'Ivoire.
Sources publiques : LinkedIn (offres invitées), Africarrières, Educarriere, Go Africa Online.
Écrit compliance/data/jobs.json : {"u": date de mise à jour, "jobs": [...]}.
Les offres sont cumulées d'un jour à l'autre, gardées 60 jours, retirées une fois expirées."""
import json, os, re, html, urllib.request, urllib.parse, datetime as dt

P = "compliance/data/jobs.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
TODAY = dt.date.today()
CORE = re.compile(r"conformit|compliance|\bLCB|\bLBC|\bAML\b|\bKYC\b|blanchiment|s[ée]curit[ée] financi|sanctions?\b|anti.?corruption|[ée]thique|MLRO|criminalit[ée] financi", re.I)
NEAR = re.compile(r"contr[oô]le (interne|permanent|p[ée]riodique)|contr[oô]leur interne|audit interne|auditeur interne|risques?\b|fraude|\bDPO\b|donn[ée]es personnelles|r[ée]glementaire", re.I)
BAN = re.compile(r"\bHSE\b|QHSE(?!.*conformit)|s[ée]curit[ée] (au travail|incendie)|guérite|documentaire|chauffeur|commercial(?!.*conformit)", re.I)
MOIS = {m: i + 1 for i, m in enumerate(["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"])}


def get(u, t=40):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"}), timeout=t)
        return r.read().decode("utf-8", "ignore")
    except Exception as e:
        print("ERR", u[:90], str(e)[:80])
        return ""


def txt(s):
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def cat(title):
    if BAN.search(title):
        return None
    if CORE.search(title):
        return "Conformité"
    if NEAR.search(title):
        return "Risques & contrôle"
    return None


def dmy(s):
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", s or "")
    return dt.date(int(m[3]), int(m[2]), int(m[1])).isoformat() if m else None


def rel(s):
    """'il y a 4 semaines' -> date ISO approximative"""
    m = re.search(r"il y a (\d+|un|une) (minute|heure|jour|semaine|mois)", s or "")
    if not m:
        return None
    n = 1 if m[1] in ("un", "une") else int(m[1])
    d = {"minute": 0, "heure": 0, "jour": n, "semaine": 7 * n, "mois": 30 * n}[m[2]]
    return (TODAY - dt.timedelta(days=d)).isoformat()


def linkedin():
    out = []
    for kw in ["compliance", "conformité", "anti-money laundering", "KYC", "LCB-FT", "risk management banque", "contrôle interne"]:
        for start in (0, 25):
            q = urllib.parse.urlencode({"keywords": kw, "location": "Côte d'Ivoire", "start": start})
            s = get("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" + q)
            for li in re.split(r"<li>", s)[1:]:
                t = re.search(r'base-search-card__title[^>]*>(.*?)</h3>', li, re.S)
                u = re.search(r'base-card__full-link[^>]*href="([^"?]+)', li) or re.search(r'href="(https://[a-z]+\.linkedin\.com/jobs/view/[^"?]+)', li)
                if not (t and u):
                    continue
                c = re.search(r'base-search-card__subtitle[^>]*>(.*?)</h4>', li, re.S)
                l = re.search(r'job-search-card__location[^>]*>(.*?)</span>', li, re.S)
                d = re.search(r'<time[^>]*datetime="([\d-]+)"', li)
                out.append({"t": txt(t[1]), "c": txt(c[1]) if c else "", "l": txt(l[1]) if l else "Côte d'Ivoire",
                            "d": d[1] if d else None, "u": html.unescape(u[1]), "s": "LinkedIn"})
    return out


def africarrieres():
    out = []
    for kw in ["conformité", "compliance", "LCB-FT", "KYC", "blanchiment", "risques", "contrôle interne", "audit interne"]:
        s = get("https://africarrieres.com/ivory-coast/fr/emplois?" + urllib.parse.urlencode({"q": kw}))
        for m in re.finditer(r'<a\s+href="(https://africarrieres\.com/[a-z-]+/fr/emplois/[^"]+)"\s+class="block"\s*>(.*?)</a>', s, re.S):
            b = m[2]
            t = re.search(r"<h3[^>]*>(.*?)</h3>", b, re.S)
            if not t:
                continue
            ps = [txt(x) for x in re.findall(r"<(?:p|span)[^>]*>(.*?)</(?:p|span)>", b[t.end():], re.S)]
            ps = [x for x in ps if x and len(x) < 90]
            rest = txt(b[t.end():])
            co = ps[0] if ps else ""
            loc = "Abidjan" if "Abidjan" in rest else "Côte d'Ivoire"
            ct = re.search(r"\b(CDI|CDD|Stage|Freelance|Intérim|Consultant)\b", rest)
            out.append({"t": txt(t[1]), "c": co.split(" Abidjan")[0][:70], "l": loc, "k": ct[1] if ct else "",
                        "d": rel(rest), "u": m[1], "s": "Africarrières"})
    return out


def educarriere():
    out = []
    for pg in ["https://emploi.educarriere.ci/", "https://emploi.educarriere.ci/nos-offres", "https://emploi.educarriere.ci/nos-offres/page-2"]:
        s = get(pg)
        for b in re.split(r'<div class="ej-card">', s)[1:]:
            a = re.search(r'<a href="([^"]+)" class="ej-poste">(.*?)</a>', b, re.S)
            if not a:
                continue
            co = re.search(r'ej-societe">(.*?)</div>', b, re.S)
            lo = re.search(r'fa-map-marker"></i>(.*?)</span>', b, re.S)
            ty = re.search(r'ej-tag[^"]*">(.*?)</span>', b, re.S)
            out.append({"t": txt(a[2]), "c": txt(co[1]) if co else "", "l": "Côte d'Ivoire" if not lo or txt(lo[1]) in ("CI", "") else txt(lo[1]).title(),
                        "k": txt(ty[1]) if ty else "", "d": dmy(re.search(r"Publié le ([\d/]+)", b)[1]) if re.search(r"Publié le ([\d/]+)", b) else None,
                        "x": dmy(re.search(r"Expire le ([\d/]+)", b)[1]) if re.search(r"Expire le ([\d/]+)", b) else None,
                        "u": a[1], "s": "Educarriere"})
    return out


def goafrica():
    out = []
    for pg in ["https://www.goafricaonline.com/ci/emploi", "https://www.goafricaonline.com/ci/emploi?page=2", "https://www.goafricaonline.com/ci/emploi?page=3"]:
        s = re.sub(r"<!--.*?-->", "", get(pg), flags=re.S)
        for m in re.finditer(r'href="(https://www\.goafricaonline\.com/ci/emploi/job-\d+[^"]*)"[^>]*>(.*?)</a>', s, re.S):
            seg = s[m.end():m.end() + 2500]
            d = re.search(r"Posté le (\d{1,2}) ([a-zéû]+)\.? (\d{4})", seg)
            dd = None
            if d and d[2][:4] in [k[:4] for k in MOIS]:
                mo = [v for k, v in MOIS.items() if k[:4] == d[2][:4]][0]
                dd = dt.date(int(d[3]), mo, int(d[1])).isoformat()
            co = re.search(r'font-bold text-16[^"]*">(.*?)</div>', seg, re.S)
            out.append({"t": txt(m[2]).capitalize() if txt(m[2]).isupper() else txt(m[2]), "c": txt(co[1]) if co else "", "l": "Abidjan" if "Abidjan" in seg else "Côte d'Ivoire",
                        "d": dd, "u": m[1], "s": "Go Africa Online"})
    return out


def main():
    try:
        old = json.load(open(P, encoding="utf-8")).get("jobs", [])
    except Exception:
        old = []
    new, stat = [], {}
    for f in (linkedin, africarrieres, educarriere, goafrica):
        try:
            r = f()
        except Exception as e:
            print("ERR", f.__name__, e)
            r = []
        k = [j for j in r if j["t"] and cat(j["t"])]
        stat[f.__name__] = (len(r), len(k))
        new += k
    seen, jobs = set(), []
    for j in new + old:
        key = re.sub(r"\W+", "", (j["t"] + j.get("c", "")).lower())[:80]
        if j["u"] in seen or key in seen:
            continue
        seen.update([j["u"], key])
        j["g"] = cat(j["t"]) or j.get("g")
        j.setdefault("f", TODAY.isoformat())  # première fois vue
        if not j.get("d"):
            j["d"] = j["f"]
        if j.get("x") and j["x"] < TODAY.isoformat():
            continue
        if j["d"] < (TODAY - dt.timedelta(days=60)).isoformat():
            continue
        jobs.append({k: v for k, v in j.items() if v not in (None, "")})
    jobs.sort(key=lambda j: (j["g"] != "Conformité", j["d"]), reverse=False)
    jobs.sort(key=lambda j: j["d"], reverse=True)
    os.makedirs(os.path.dirname(P), exist_ok=True)
    tmp = P + ".new"
    json.dump({"u": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"), "jobs": jobs[:120]}, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    os.replace(tmp, P)
    print("sources (brutes, retenues):", stat, "→", len(jobs), "offres")
    for j in jobs[:25]:
        print(" ", j["d"], j["g"][:4], "|", j["t"][:70], "|", j.get("c", "")[:30], "|", j["s"])


if __name__ == "__main__":
    main()
