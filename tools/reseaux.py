"""Construit reseaux/<nom>.json à partir du PDF du réseau de soins (texte pdftotext -layout), puis géocode (Photon/OSM)."""
import re, json, os, sys, time, unicodedata, urllib.request, urllib.parse
COMMUNES = ["ABOBO","ADJAME","ANYAMA","ATTECOUBE","BINGERVILLE","COCODY","KOUMASSI","MARCORY","PLATEAU","PORT-BOUET","PORT BOUET","TREICHVILLE","YOPOUGON","SONGON","BASSAM","GRAND-BASSAM","DABOU"]
def norm(s): return unicodedata.normalize("NFD", s).encode("ascii","ignore").decode().upper().strip()
def cat_of(h):
    h = norm(h)
    if "PHARMA" in h: return "pharmacie"
    if "DENTAIRE" in h or "DENTIST" in h: return "dentiste"
    if "OPTI" in h: return "opticien"
    if "LABORATOIRE" in h or "IMAGERIE" in h or "IMMAGERIE" in h or "RADIO" in h: return "laboratoire"
    if "HOPITAL" in h or "HOSPITALIER" in h or "CHR" == h or "CHU" in h: return "hopital"
    if "CLINIQUE" in h or "POLYCLINIQUE" in h or "CENTRE MEDICAL" in h or "CABINET MEDICAL" in h or "INFIRMERIE" in h: return "clinique"
    return None
ENTRY = re.compile(r"^\s{0,4}(\d{1,3})\s{2,}(\S.*?)(?:\s{2,}(\S.*?))?(?:\s{2,}((?:\+?\d[\d .,]{6,}\d)(?:\s*/\s*[\d .,]+)?))?\s*$")
def parse(txt):
    out=[]; sec=None; ville=None; zone=None; cat=None; commune=None
    for raw in txt.splitlines():
        line = raw.rstrip()
        if not line.strip(): continue
        s = line.strip(); n = norm(s)
        if "***" in s:
            sec = "pharma" if "PHARMA" in n else "soins"; ville = "ABIDJAN" if "ABIDJAN" in n else None; zone=None; cat=None; commune=None
            if "INTERIEUR" in n: ville=None
            continue
        if sec is None: continue
        if n.startswith("RESEAU DE SOINS") or re.fullmatch(r"\d{1,3}", s) or n=="INTERIEUR DU PAYS": 
            if n=="INTERIEUR DU PAYS": ville=None
            continue
        m = ENTRY.match(line)
        if m and len(line) - len(line.lstrip()) < 6:
            nom = re.sub(r"\s+"," ",m.group(2)).strip(); adr=(m.group(3) or "").strip(); tel=(m.group(4) or "").strip()
            mt=re.search(r"\s{2,}((?:\d{2}[ .,]?){4}\d{2})$", adr)
            if not tel and mt: tel, adr = mt.group(1), adr[:mt.start()].strip()
            if not tel and re.fullmatch(r"[\d .,]{8,}", adr): tel, adr = adr, ""
            c = "pharmacie" if sec=="pharma" else (cat or cat_of(nom) or "clinique")
            if c!="pharmacie" and cat_of(nom)=="hopital": c="hopital"
            out.append({"nom":nom.title().replace("D'","d'").replace(" De "," de ").replace(" Du "," du ").replace(" La "," la ").replace(" Des "," des "),"cat":c,"adr":adr.title(),"tel":re.sub(r"[ .,]","",tel),"ville":(ville or "").title(),"commune":(commune or "").title(),"zone":(zone or "").title()})
            continue
        if len(line) - len(line.lstrip()) >= 10 and not re.search(r"\d{6,}", s):
            c = cat_of(s)
            if c and not (sec=="pharma"): cat = c; continue
            if c and sec=="pharma": continue
            # lieu
            if ville and norm(ville)=="ABIDJAN":
                if n in COMMUNES or n.replace("-"," ") in COMMUNES: commune=s; zone=None; cat=None; continue
                zone = s; cat=None if sec=="soins" else cat; continue
            ville = s; zone=None; cat=None
    return out
def tidy(e):
    # Abidjan : la "zone" peut être commune ou sous-zone ; on garde un libellé lisible
    e["lieu"] = ", ".join(dict.fromkeys([x for x in [e["adr"], e["zone"], e["commune"], e["ville"]] if x]))
    return e
UA={"User-Agent":"CLB-Health/1.0 (github.com/charleslebontoh-cloud)"}
def photon(q, extra=""):
    u="https://photon.komoot.io/api/?q="+urllib.parse.quote(q)+"&limit=5&lang=fr&bbox=-8.7,4.2,-2.4,10.8"+extra
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=10) as r: return json.load(r).get("features",[])
        except Exception: time.sleep(1+k*2)
    return []
def toks(s): return set(w for w in re.findall(r"[A-Z0-9]{3,}", norm(s)) if w not in {"PHARMACIE","CLINIQUE","MEDICALE","CENTRE","MEDICAL","CABINET","DENTAIRE","HOPITAL","GENERAL","POLYCLINIQUE","OPTIQUE","LABORATOIRE","DES","DES","LES","SAINTE","SAINT"})
def km(a,b,c,d):
    import math; r=math.pi/180; x=math.sin((c-a)*r/2)**2+math.cos(a*r)*math.cos(c*r)*math.sin((d-b)*r/2)**2; return 12742*math.asin(math.sqrt(x))
DEADLINE=time.time()+float(os.environ.get("BUDGET","1500"))
def geocode(items, cache):
    centers={}
    def center(place):
        k="C|"+place
        if k in cache: return cache[k]
        f=photon(place+" Côte d'Ivoire"); time.sleep(.4)
        cache[k]=[f[0]["geometry"]["coordinates"][1],f[0]["geometry"]["coordinates"][0]] if f else None; return cache[k]
    for i,e in enumerate(items):
        key=e["cat"]+"|"+e["nom"]+"|"+e["lieu"];nk="N|"+norm(e["nom"])+"|"+norm(e["commune"] or e["ville"])
        if key in cache and (cache[key].get("prec")!="ville" or time.time()>DEADLINE):
            e.update(cache[key])
            if cache[key].get("prec")=="exacte": cache[nk]=cache[key]
            continue
        if nk in cache: e.update(cache[nk]); cache[key]=cache[nk]; continue
        ref = (center(e["zone"]+" "+(e["commune"] or "")+" Abidjan") if e["ville"].upper()=="ABIDJAN" and e["zone"] else None) or (center(e["commune"]+" Abidjan") if e["commune"] else None) or center(e["ville"] or "Abidjan")
        res=None; T=toks(e["nom"])
        tags="&osm_tag=amenity&osm_tag=healthcare&osm_tag=shop"
        if time.time()>DEADLINE: res=None
        else:
         for f in photon(e["nom"]+" "+(e["ville"] or ""), tags):
              p=f["properties"]; lat,lon=f["geometry"]["coordinates"][1],f["geometry"]["coordinates"][0]
              if p.get("countrycode")!="CI": continue
              if T and not (T & toks(p.get("name",""))): continue
              if ref and km(ref[0],ref[1],lat,lon)>25: continue
              res={"lat":round(lat,6),"lon":round(lon,6),"prec":"exacte"}; break
        if time.time()<DEADLINE: time.sleep(.5)
        if not res and e["adr"] and time.time()<DEADLINE:
            f=photon(e["adr"]+" "+(e["commune"] or e["ville"] or "")); time.sleep(.4)
            f=[x for x in f if not ref or km(ref[0],ref[1],x["geometry"]["coordinates"][1],x["geometry"]["coordinates"][0])<15]
            if f: res={"lat":round(f[0]["geometry"]["coordinates"][1],6),"lon":round(f[0]["geometry"]["coordinates"][0],6),"prec":"quartier"}
        if not res and ref: res={"lat":ref[0],"lon":ref[1],"prec":"ville"}
        res=res or {}; cache[key]=res; e.update(res)
        if res.get("prec")=="exacte": cache[nk]=res
        if i%25==0: print(i,len(items),e["nom"],res.get("prec"),flush=True)
    return items
AACI_COMMUNES={"ABOBO":"Abobo","ADJAME":"Adjame","ANYAMA":"Anyama","BINGERVILE":"Bingerville","BINGERVILLE":"Bingerville","COCODY":"Cocody","GRAND BASSAM":"Grand-Bassam","KOUMASSI":"Koumassi","MARCORY":"Marcory","PLATEAU":"Plateau","PORT BOUET":"Port-Bouet","SONGON":"Songon","TREICHVILLE":"Treichville","YOPOUGON":"Yopougon"}
PH=r"((?:\d{2}\s?){4}\d{2})"
def parse_aaci(txt):
    out=[];commune=None;cat=None
    for raw in txt.splitlines():
        s=raw.strip();n=norm(s)
        if not s or n.startswith("RESEAU DE SOINS") or n.startswith("PAGE "): continue
        if n in AACI_COMMUNES: commune=AACI_COMMUNES[n]; cat=None; continue
        if not raw.startswith(" ") and not re.match(r"\d",s):
            c=cat_of(n) or ("laboratoire" if "LABORATION" in n else "clinique" if "CENTRE DE SOINS" in n else None)
            if c: cat=c; continue
        m=re.match(r"^\s*(\d{1,3})\s+(.+?)\s{2,}(.*)$",raw)
        if not m or not commune: continue
        nom=re.sub(r"\s+"," ",m.group(2)).strip();rest=m.group(3).strip();tel="";adr=rest
        mt=re.match(PH+r"(?:\s*/\s*"+PH+r")?\s*(.*)$",rest)
        if mt: tel=mt.group(1);adr=mt.group(3).strip()
        c=cat or cat_of(nom) or "clinique"
        if c!="pharmacie" and cat_of(nom)=="hopital": c="hopital"
        out.append({"nom":nom.title().replace(" De "," de ").replace(" Du "," du ").replace(" La "," la ").replace(" Des "," des "),"cat":c,"adr":adr.strip(" ,;").capitalize(),"tel":re.sub(r"\D","",tel),"ville":"Grand-Bassam" if commune=="Grand-Bassam" else "Abidjan","commune":"" if commune=="Grand-Bassam" else commune,"zone":""})
    return out
NETS={"vitalis":{"nom":"Vitalis Santé","src":"reseaux/raw/vitalis-full.txt","url":"https://services.vitalis-ci.com/reseaudesoin/PRESENTATION.pdf","parse":parse,"maj":"2026"},
      "atlantique":{"nom":"Atlantique Assurances","src":"reseaux/raw/atlantique.txt","url":"https://www.atlantique-assurances.net/wp-content/uploads/2024/07/RESEAU-DE-SOINS-AACI-ABIDJAN.pdf","parse":parse_aaci,"maj":"janvier 2024"}}
def build(k,geo=True,cache=None):
    N=NETS[k];items=[tidy(e) for e in N["parse"](open(N["src"],encoding="utf-8").read())]
    seen=set();U=[]
    for e in items:
        kk=(e["cat"],norm(e["nom"]),norm(e["lieu"]))
        if kk in seen: continue
        seen.add(kk);U.append(e)
    if geo: geocode(U,cache)
    return U
if __name__=="__main__":
    from collections import Counter
    keys=list(NETS) if (len(sys.argv)<2 or sys.argv[1]=="all") else [sys.argv[1]]
    if "--nogeo" in sys.argv:
        for k in keys:
            U=build(k,False);print(k,len(U),Counter(e["cat"] for e in U));[print(e) for e in U[:3]+U[-3:]]
        sys.exit()
    cp="reseaux/geocache.json";cache=json.load(open(cp)) if os.path.exists(cp) else {}
    idx=[]
    try:
        for k in keys:
            U=build(k,True,cache);print(k,Counter(e.get("prec") for e in U),flush=True)
            json.dump({"nom":NETS[k]["nom"],"source":NETS[k]["url"],"maj":NETS[k]["maj"],"lieux":[{kk:v for kk,v in e.items() if kk!="lieu"} for e in U]},open("reseaux/"+k+".json","w"),ensure_ascii=False,separators=(",",":"))
            idx.append({"id":k,"nom":NETS[k]["nom"],"n":len(U),"maj":NETS[k]["maj"]})
    finally: json.dump(cache,open(cp,"w"),ensure_ascii=False)
    json.dump(idx,open("reseaux/index.json","w"),ensure_ascii=False)
