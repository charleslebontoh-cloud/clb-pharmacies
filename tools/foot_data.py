"""Récupère les données foot (ESPN) côté serveur et les publie en JSON
pour CLB World : scores du jour, matchs à venir, classements, calendrier Barça/Real.
Pour les coupons, chaque match à venir reçoit aussi, quand elles existent :
- "_mk"  : les probabilités des bookmakers (cotes ESPN, marge retirée) ;
- "_elo" : les probabilités du modèle Elo de ClubElo (forme récente et niveau réel des clubs)."""
import json, urllib.request, datetime as D, time, csv, io, re, unicodedata, difflib
B = "https://site.api.espn.com/apis/site/v2/sports/soccer/"
B2 = "https://site.api.espn.com/apis/v2/sports/soccer/"
LG = ["esp.1", "eng.1", "uefa.champions", "fra.1", "ita.1", "ger.1", "uefa.europa", "esp.copa_del_rey"]
TB = ["esp.1", "eng.1", "fra.1", "ita.1", "ger.1"]
TEAMS = {"barca": 83, "real": 86}
# Championnats secondaires : affichés par CLB World pendant les trêves internationales (scores et coupons)
SEC = ["fifa.friendly", "club.friendly", "uefa.nations", "caf.nations_qual", "concacaf.nations.league", "fra.2", "esp.2", "eng.2", "eng.3", "eng.4", "ita.2", "ger.2", "ned.1", "por.1", "bel.1", "sco.1", "tur.1", "ksa.1", "bra.1", "arg.1", "usa.1", "mex.1", "col.1", "chi.1", "per.1", "ecu.1", "uru.1", "par.1", "jpn.1", "chn.1", "aus.1"]
T0 = time.monotonic()
def get(u):
    # Budget de temps : si ESPN est lent, on réduit les essais puis on s'arrête pour publier quand même
    el = time.monotonic() - T0
    if el > 420: return {"_error": "budget de temps dépassé"}
    tries, to = (3, 20) if el < 240 else (1, 8)
    err = ""
    for _ in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 CLB-World"}), timeout=to)
            return json.loads(r.read().decode())
        except Exception as e:
            err = str(e); time.sleep(2)
    return {"_error": err}
def dec(v):
    """Cote américaine (+150, -120) ou décimale (2.5) -> cote décimale."""
    try:
        if isinstance(v, dict): v = (v.get("close") or v.get("open") or {}).get("odds", v.get("odds"))
        if v is None or v == "": return None
        t = str(v).strip().replace(",", ".")
        if t.upper() in ("EVEN", "EV"): return 2.0
        x = float(t)
        if t.startswith(("+", "-")) or abs(x) >= 100: return 1 + x / 100 if x > 0 else 1 + 100 / -x
        return x if x > 1 else None
    except Exception:
        return None
def market(c):
    """Probabilités 1/N/2 (et plus de 2,5 buts) déduites des cotes, marge du bookmaker retirée."""
    for o in c.get("odds") or []:
        ml = o.get("moneyline") or {}
        h = dec((o.get("homeTeamOdds") or {}).get("moneyLine")) or dec(ml.get("home"))
        a = dec((o.get("awayTeamOdds") or {}).get("moneyLine")) or dec(ml.get("away"))
        d = dec((o.get("drawOdds") or {}).get("moneyLine")) or dec(ml.get("draw"))
        if not (h and a and d): continue
        s = 1 / h + 1 / d + 1 / a
        if not 0.95 < s < 1.35: continue
        r = {"p1": round(1 / h / s, 3), "pn": round(1 / d / s, 3), "p2": round(1 / a / s, 3),
             "src": ((o.get("provider") or {}).get("name") or "")[:20]}
        tot = o.get("total") or {}
        ov, un = dec(o.get("overOdds")) or dec(tot.get("over")), dec(o.get("underOdds")) or dec(tot.get("under"))
        if o.get("overUnder") == 2.5 and ov and un: r["o25"] = round((1 / ov) / (1 / ov + 1 / un), 3)
        return r
    return None
def slim_ev(e, code):
    c = e.get("competitions", [{}])[0]
    def team(t):
        tm = t.get("team", {})
        s = t.get("score")
        if isinstance(s, dict): s = s.get("displayValue", s.get("value"))
        return {"homeAway": t.get("homeAway"), "score": s if s is not None else "",
                "team": {"displayName": tm.get("displayName"), "shortDisplayName": tm.get("shortDisplayName") or tm.get("displayName"),
                         "logo": tm.get("logo") or ((tm.get("logos") or [{}])[0].get("href", ""))}}
    stt = (c.get("status") or e.get("status") or {}).get("type", {})
    st = (c.get("status") or e.get("status") or {})
    mk = market(c) if stt.get("state") == "pre" else None
    return {"id": e.get("id"), "date": e.get("date"), "name": e.get("name"), "_code": code, **({"_mk": mk} if mk else {}),
            "competitions": [{"status": {"type": {"state": stt.get("state"), "shortDetail": stt.get("shortDetail"), "displayClock": st.get("displayClock", "")}},
                              "competitors": [team(t) for t in c.get("competitors", [])]}]}
now = D.datetime.now(D.UTC)
out = {"updated": now.isoformat(), "events": {}, "standings": {}, "teams": {}, "errors": []}
for code in LG:
    evs = {}
    for d in range(-3, 15):  # 2 semaines à venir : couvre les trêves internationales
        day = (now + D.timedelta(days=d)).strftime("%Y%m%d")
        r = get(f"{B}{code}/scoreboard?dates={day}")
        if "_error" in r: out["errors"].append(f"{code} {day}: {r['_error']}"); continue
        for e in r.get("events", []): evs[e.get("id")] = slim_ev(e, code)
    out["events"][code] = list(evs.values())
out["sec_errors"] = []
for code in SEC:  # fenêtre courte (-2 à +3 jours) pour limiter le nombre d'appels
    evs = {}
    for d in range(-2, 4):
        day = (now + D.timedelta(days=d)).strftime("%Y%m%d")
        r = get(f"{B}{code}/scoreboard?dates={day}")
        if "_error" in r: out["sec_errors"].append(f"{code} {day}: {r['_error']}"); continue
        for e in r.get("events", []): evs[e.get("id")] = slim_ev(e, code)
    out["events"][code] = list(evs.values())
for code in TB + [c for c in SEC if "." in c and c.split(".")[0] not in ("fifa", "club", "uefa", "caf", "concacaf")]:  # pas de classement pour les amicaux et coupes
    r = get(f"{B2}{code}/standings")
    if "_error" in r: (out["errors"] if code in TB else out["sec_errors"]).append(f"standings {code}: {r['_error']}"); continue
    rows = []
    for ch in (r.get("children") or [r]):
        for en in (ch.get("standings") or {}).get("entries", []):
            st = {s.get("name"): s.get("value") for s in en.get("stats", [])}
            tm = en.get("team", {})
            rows.append({"team": tm.get("displayName"), "short": tm.get("shortDisplayName") or tm.get("displayName"),
                         "logo": ((tm.get("logos") or [{}])[0].get("href", "")), "gp": st.get("gamesPlayed"), "w": st.get("wins"),
                         "d": st.get("ties"), "l": st.get("losses"), "gf": st.get("pointsFor"), "ga": st.get("pointsAgainst"),
                         "gd": st.get("pointDifferential"), "pts": st.get("points"), "rk": st.get("rank")})
    rows.sort(key=lambda x: (x["rk"] or 99, -(x["pts"] or 0)))
    out["standings"][code] = rows
for k, tid in TEAMS.items():
    evs = {}
    for code in ["esp.1", "uefa.champions", "esp.copa_del_rey"]:
        for q in ["", "?fixture=true"]:
            r = get(f"{B}{code}/teams/{tid}/schedule{q}")
            if "_error" in r: continue
            for e in r.get("events", []): evs[e.get("id")] = slim_ev(e, code)
    out["teams"][k] = list(evs.values())
# --- ClubElo : probabilités Elo des matchs à venir (clubs européens), rapprochées des matchs ESPN ---
ALIAS = {"man city": "manchester city", "man united": "manchester united", "paris sg": "paris saint-germain", "inter": "internazionale",
         "milan": "ac milan", "atletico": "atletico madrid", "bayern": "bayern munich", "dortmund": "borussia dortmund",
         "gladbach": "borussia monchengladbach", "leverkusen": "bayer leverkusen", "forest": "nottingham forest", "wolves": "wolverhampton wanderers",
         "spurs": "tottenham hotspur", "tottenham": "tottenham hotspur", "newcastle": "newcastle united", "west ham": "west ham united",
         "sociedad": "real sociedad", "betis": "real betis", "celta": "celta vigo", "bilbao": "athletic club", "psv": "psv eindhoven",
         "sporting": "sporting cp", "frankfurt": "eintracht frankfurt", "koeln": "fc cologne", "mainz": "mainz 05", "brighton": "brighton & hove albion",
         "leeds": "leeds united", "roma": "as roma", "lazio": "lazio", "napoli": "napoli", "marseille": "marseille", "lyon": "lyon"}
def norm(n):
    n = unicodedata.normalize("NFKD", n or "").encode("ascii", "ignore").decode().lower()
    n = ALIAS.get(n.strip(), n)
    return " ".join(w for w in re.split(r"[^a-z0-9&]+", n) if w and w not in ("fc", "cf", "ac", "sc", "afc", "ssc", "as", "club", "de", "1", "the"))
def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b: return 0
    if a == b or a in b or b in a: return 1
    return difflib.SequenceMatcher(None, a, b).ratio()
def clubelo():
    for u in ("http://api.clubelo.com/Fixtures", "https://api.clubelo.com/Fixtures"):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 CLB-World"}), timeout=25)
            return list(csv.DictReader(io.StringIO(r.read().decode("utf-8", "ignore"))))
        except Exception as e:
            out["errors"].append(f"clubelo: {e}")
    return []
def elo_probs(row):
    g = lambda k: float(row.get(k) or 0)
    gd = {k: g(k) for k in row if k and k.startswith("GD")}
    if not gd: return None
    p1 = sum(v for k, v in gd.items() if k == "GD>5" or (k.startswith("GD=") and int(k[3:]) > 0))
    pn = gd.get("GD=0", 0)
    p2 = sum(v for k, v in gd.items() if k == "GD<-5" or (k.startswith("GD=") and int(k[3:]) < 0))
    t = p1 + pn + p2
    if t <= 0: return None
    r = {"p1": round(p1 / t, 3), "pn": round(pn / t, 3), "p2": round(p2 / t, 3)}
    rs = [(k, float(v or 0)) for k, v in row.items() if k and k.startswith("R:") and "-" in k]
    if rs:
        tot = sum(v for _, v in rs) or 1
        def sc(k): h, a = k[2:].split("-"); return int(h), int(a)
        r["o25"] = round(sum(v for k, v in rs if sum(sc(k)) >= 3) / tot, 3)
        r["btts"] = round(sum(v for k, v in rs if min(sc(k)) > 0) / tot, 3)
    return r
fx = clubelo()
byday = {}
for row in fx: byday.setdefault(row.get("Date", "")[:10], []).append(row)
nelo = 0
for code, L in out["events"].items():
    if code in ("fifa.friendly", "caf.nations_qual", "uefa.nations", "concacaf.nations.league"): continue
    for e in L:
        if e["competitions"][0]["status"]["type"]["state"] != "pre": continue
        cs = e["competitions"][0]["competitors"]
        h = next((x for x in cs if x["homeAway"] == "home"), None); a = next((x for x in cs if x["homeAway"] == "away"), None)
        if not h or not a: continue
        d0 = D.datetime.fromisoformat(e["date"].replace("Z", "+00:00"))
        best, bs = None, 0
        for dd in (0, -1, 1):
            for row in byday.get((d0 + D.timedelta(days=dd)).strftime("%Y-%m-%d"), []):
                s1, s2 = sim(h["team"]["displayName"], row.get("Home")), sim(a["team"]["displayName"], row.get("Away"))
                if min(s1, s2) >= .85 and s1 + s2 > bs: best, bs = row, s1 + s2
        if best:
            pr = elo_probs(best)
            if pr: e["_elo"] = pr; nelo += 1
print("elo", len(fx), "matchs ClubElo,", nelo, "rapprochés ;", sum(1 for L in out["events"].values() for e in L if "_mk" in e), "matchs avec cotes")
open("foot.json", "w").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print("ok", sum(len(v) for v in out["events"].values()), "matchs", len(out["errors"]), "erreurs")
