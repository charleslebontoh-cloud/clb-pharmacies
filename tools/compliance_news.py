# -*- coding: utf-8 -*-
"""VERITAS · veille automatique : actualités conformité / LBC-FT / sanctions (Google News RSS).
Écrit compliance/data/news.json (les 80 articles les plus récents, dédoublonnés)."""
import json, os, re, html, urllib.request, urllib.parse, email.utils, datetime as dt
import xml.etree.ElementTree as ET

QUERIES = [
    ("UEMOA", "blanchiment de capitaux Côte d'Ivoire"),
    ("UEMOA", "BCEAO conformité instruction"),
    ("UEMOA", "Commission bancaire UMOA sanction"),
    ("UEMOA", "CENTIF Côte d'Ivoire"),
    ("Monde", "GAFI blanchiment"),
    ("Monde", "conformité bancaire compliance"),
    ("Monde", "sanctions OFAC banque amende"),
    ("Monde", "anticorruption entreprise condamnation"),
    ("Monde", "AMLA lutte anti-blanchiment Europe"),
]
UA = "Mozilla/5.0 (VERITAS veille)"
P = "compliance/data/news.json"


def fetch(q):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q + " when:30d", "hl": "fr", "gl": "FR", "ceid": "FR:fr"})
    try:
        x = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read()
        return ET.fromstring(x).findall(".//item")
    except Exception as e:
        print("ERR", q, e)
        return []


def main():
    old = []
    try:
        old = json.load(open(P, encoding="utf-8"))
    except Exception:
        pass
    seen = {a["t"].lower()[:80]: a for a in old}
    for zone, q in QUERIES:
        for it in fetch(q)[:15]:
            t = html.unescape(it.findtext("title") or "").strip()
            src = it.find("source")
            s = src.text if src is not None else ""
            if s and t.endswith(" - " + s):
                t = t[: -len(" - " + s)]
            try:
                d = email.utils.parsedate_to_datetime(it.findtext("pubDate")).date().isoformat()
            except Exception:
                d = dt.date.today().isoformat()
            k = t.lower()[:80]
            if not t or k in seen:
                continue
            seen[k] = {"t": t, "u": it.findtext("link"), "s": s, "d": d, "z": zone, "q": q}
    items = sorted(seen.values(), key=lambda a: a["d"], reverse=True)[:80]
    os.makedirs("compliance/data", exist_ok=True)
    with open(P + ".new", "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(P + ".new", P)
    print(len(items), "articles")


if __name__ == "__main__":
    main()
