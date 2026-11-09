"""Construit pharmacies-all.json : toutes les pharmacies connues de Côte d'Ivoire avec leur position.
Sources : OpenStreetMap (Overpass) + réseau de soins Vitalis (positions géocodées)."""
import json, urllib.request, urllib.parse, unicodedata, re, math, time
def norm(s): return re.sub(r"[^A-Z0-9 ]+"," ",unicodedata.normalize("NFD",s or "").encode("ascii","ignore").decode().upper()).strip()
def key(n): n=norm(n); n=re.sub(r"^(PHARMACIE|PHCIE|PHIE|PHARMA)\s+","",n); n=re.sub(r"\b(DE LA|DE L|DES|DU|DE|D|LA|LE|LES|L)\b"," ",n); return re.sub(r"\s+"," ",n).strip()
def km(a,b,c,d):
    r=math.pi/180; x=math.sin((c-a)*r/2)**2+math.cos(a*r)*math.cos(c*r)*math.sin((d-b)*r/2)**2; return 12742*math.asin(math.sqrt(x))
Q='[out:json][timeout:180];nwr["amenity"="pharmacy"](4.3,-8.7,10.8,-2.4);out center tags;'
EP=["https://overpass.kumi.systems/api/interpreter","https://overpass.private.coffee/api/interpreter","https://overpass-api.de/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
osm=[]
for k in range(8):
    u=EP[k%len(EP)]
    try:
        with urllib.request.urlopen(urllib.request.Request(u,data=urllib.parse.urlencode({"data":Q}).encode(),headers={"User-Agent":"CLB-Health/1.0 (github.com/charleslebontoh-cloud)"}),timeout=240) as r: osm=json.load(r)["elements"]; print("ok",u); break
    except Exception as e: print("overpass",u,e); time.sleep(10)
out=[]
for e in osm:
    t=e.get("tags",{}); la=e.get("lat") or (e.get("center") or {}).get("lat"); lo=e.get("lon") or (e.get("center") or {}).get("lon")
    if la is None or not t.get("name"): continue
    adr=", ".join(x for x in [t.get("addr:street"),t.get("addr:suburb") or t.get("addr:district"),t.get("addr:city")] if x)
    out.append({"n":t["name"].strip(),"la":round(la,6),"lo":round(lo,6),"t":(t.get("phone") or t.get("contact:phone") or "").strip(),"h":t.get("opening_hours",""),"a":adr,"s":"osm"})
print("osm",len(out))
try:
    V=json.load(open("reseaux/vitalis.json"))["lieux"]
    for v in V:
        if v.get("cat")!="pharmacie" or v.get("prec") not in ("exacte","quartier"): continue
        k=key(v["nom"]); dup=[o for o in out if key(o["n"])==k and km(o["la"],o["lo"],v["lat"],v["lon"])<2]
        if dup:
            if not dup[0]["t"] and v.get("tel"): dup[0]["t"]=v["tel"]
            continue
        out.append({"n":v["nom"] if v["nom"].lower().startswith("pharmacie") else "Pharmacie "+v["nom"],"la":v["lat"],"lo":v["lon"],"t":v.get("tel",""),"h":"","a":", ".join(x for x in [v.get("adr"),v.get("zone"),v.get("commune") or v.get("ville")] if x),"s":"vitalis"+("" if v["prec"]=="exacte" else "~")})
except Exception as e: print("vitalis",e)
print("total",len(out))
json.dump({"maj":time.strftime("%Y-%m-%d"),"sources":"OpenStreetMap (ODbL) + réseau Vitalis","liste":out},open("pharmacies-all.json","w"),ensure_ascii=False,separators=(",",":"))
