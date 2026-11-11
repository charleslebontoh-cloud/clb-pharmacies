"""Récupère les données foot (ESPN) côté serveur et les publie en JSON
pour CLB World : scores du jour, matchs à venir, classements, calendrier Barça/Real."""
import json, urllib.request, datetime as D, time
B = "https://site.api.espn.com/apis/site/v2/sports/soccer/"
B2 = "https://site.api.espn.com/apis/v2/sports/soccer/"
LG = ["esp.1", "eng.1", "uefa.champions", "fra.1", "ita.1", "ger.1", "uefa.europa", "esp.copa_del_rey"]
TB = ["esp.1", "eng.1", "fra.1", "ita.1", "ger.1"]
TEAMS = {"barca": 83, "real": 86}
# Championnats secondaires : affichés par CLB World pendant les trêves internationales (scores et coupons)
SEC = ["fra.2", "esp.2", "eng.2", "eng.3", "ita.2", "ger.2", "ger.3", "ned.1", "por.1", "bel.1", "sco.1", "tur.1", "ksa.1", "bra.1", "arg.1", "usa.1", "mex.1"]
def get(u):
    for _ in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 CLB-World"}), timeout=20)
            return json.loads(r.read().decode())
        except Exception as e:
            err = str(e); time.sleep(2)
    return {"_error": err}
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
    return {"id": e.get("id"), "date": e.get("date"), "name": e.get("name"), "_code": code,
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
for code in TB + SEC:
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
open("foot.json", "w").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print("ok", sum(len(v) for v in out["events"].values()), "matchs", len(out["errors"]), "erreurs")
