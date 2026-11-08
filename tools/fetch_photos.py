"""Télécharge des photos libres (Wikimedia Commons) de paysages vus du ciel pour l'écran d'accueil de CLB World."""
import json, urllib.request, urllib.parse, os, re
UA = {"User-Agent": "CLB-World/1.0 (charleslebontoh-cloud.github.io; photos d'accueil)"}
API = "https://commons.wikimedia.org/w/api.php"
Q = ['aerial beach incategory:Quality_images', 'aerial view coast incategory:Quality_images', 'aerial lagoon island',
     'drone beach aerial turquoise', 'aerial forest river', 'aerial view tropical island']
os.makedirs("monde/photos/candidats", exist_ok=True)
seen, out = set(), []
for q in Q:
    p = {"action": "query", "format": "json", "generator": "search", "gsrnamespace": "6", "gsrlimit": "12",
         "gsrsearch": "filetype:bitmap " + q, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "1600"}
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request(API + "?" + urllib.parse.urlencode(p), headers=UA), timeout=30))
    except Exception as e:
        print("err", q, e); continue
    for pg in (r.get("query") or {}).get("pages", {}).values():
        ii = (pg.get("imageinfo") or [{}])[0]
        if pg["title"] in seen or ii.get("mime") != "image/jpeg" or ii.get("width", 0) < 2000: continue
        seen.add(pg["title"])
        m = ii.get("extmetadata", {})
        lic = (m.get("LicenseShortName") or {}).get("value", "")
        if not re.search(r"CC|Public domain|PD", lic, re.I): continue
        art = re.sub("<[^>]+>", "", (m.get("Artist") or {}).get("value", "")).strip()
        n = len(out)
        fn = f"monde/photos/candidats/c{n:02d}.jpg"
        try:
            open(fn, "wb").write(urllib.request.urlopen(urllib.request.Request(ii["thumburl"], headers=UA), timeout=60).read())
        except Exception as e:
            print("dl err", e); continue
        out.append({"f": fn, "title": pg["title"], "author": art, "license": lic, "page": ii.get("descriptionurl"), "q": q, "w": ii["width"], "h": ii["height"]})
        if len(out) >= 30: break
    if len(out) >= 30: break
json.dump(out, open("monde/photos/candidats/credits.json", "w"), ensure_ascii=False, indent=1)
print(len(out), "photos")
