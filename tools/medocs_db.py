"""Construit sante/medocs.json depuis la Base de données publique des médicaments (ANSM, France)."""
import json, urllib.request, collections, os, sys
BASES=["https://base-donnees-publique.medicaments.gouv.fr/download/file/","https://base-donnees-publique.medicaments.gouv.fr/telechargement.php?fichier="]
def get(fn):
    for b in BASES:
        try:
            with urllib.request.urlopen(urllib.request.Request(b+fn,headers={"User-Agent":"Mozilla/5.0"}),timeout=120) as r: raw=r.read()
            if len(raw)>10000:
                for enc in ("utf-8","cp1252","latin-1"):
                    try: return raw.decode(enc)
                    except: pass
        except Exception as e: print("err",b+fn,e)
    sys.exit("download failed "+fn)
cis=[l.split("\t") for l in get("CIS_bdpm.txt").splitlines() if l.strip()]
comp=[l.split("\t") for l in get("CIS_COMPO_bdpm.txt").splitlines() if l.strip()]
print("cis",len(cis),"compo",len(comp)); print(cis[0]); print(comp[0])
C=collections.defaultdict(list)
for c in comp:
    if len(c)>=7 and c[6].strip()=="SA": C[c[0]].append([c[3].strip(),c[4].strip(),c[5].strip()])
F=[];V=[];fi={};vi={};out=[]
for r in cis:
    if len(r)<11: continue
    if "Commercialis" not in r[6] or "Non" in r[6]: continue
    f=r[2].strip(); v=r[3].strip()
    if f not in fi: fi[f]=len(F); F.append(f)
    if v not in vi: vi[v]=len(V); V.append(v)
    out.append([r[0].strip(), r[1].strip(), fi[f], vi[v], C.get(r[0].strip(),[]), r[10].strip()])
os.makedirs("sante",exist_ok=True)
json.dump({"src":"Base de données publique des médicaments (ANSM)","f":F,"v":V,"p":out},open("sante/medocs.json","w"),ensure_ascii=False,separators=(",",":"))
print("kept",len(out),os.path.getsize("sante/medocs.json")); print(out[:2])
# textes HAS (service médical rendu) en français, découpés par préfixe du code CIS
keep={r[0] for r in out}
try:
    smr=[l.split("\t") for l in get("CIS_HAS_SMR_bdpm.txt").splitlines() if l.strip()]
    best={}
    for r in smr:
        if len(r)<6 or r[0] not in keep: continue
        d=r[3]; t=r[5].strip()
        if not t: continue
        if r[0] not in best or d>best[r[0]][0]: best[r[0]]=(d,t)
    import re as _re
    os.makedirs("sante/smr",exist_ok=True); sh=collections.defaultdict(dict)
    for k,(d,t) in best.items(): sh[k[:3]][k]=_re.sub(r"\s+"," ",t)[:700]
    for p,dct in sh.items(): json.dump(dct,open(f"sante/smr/{p}.json","w"),ensure_ascii=False,separators=(",",":"))
    print("smr",len(best),"shards",len(sh)); print(list(best.items())[:1])
except SystemExit as e: print("smr indisponible",e)
