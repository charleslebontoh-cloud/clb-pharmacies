"""Construit parfums/db.json depuis le jeu de données Parfumo (TidyTuesday 2024-12-10)."""
import csv, json, sys, re, collections
import os; os.makedirs("parfums", exist_ok=True)
src = sys.argv[1]
rows = list(csv.DictReader(open(src, encoding="utf-8")))
def f(x):
    try: return float(x)
    except: return None
def L(x): return [] if not x or x == "NA" else [t.strip() for t in x.split(",") if t.strip()]
keep = []
for r in rows:
    c = f(r["Rating_Count"]) or 0
    acc = L(r["Main_Accords"])
    has_notes = any(L(r[k]) for k in ("Top_Notes","Middle_Notes","Base_Notes"))
    if not acc or (c < 25 and not has_notes): continue
    if not has_notes and c < 25: continue
    keep.append(r)
keep.sort(key=lambda r: -(f(r["Rating_Count"]) or 0))
SUPP = [
 dict(Name="Sauvage", Brand="Dior", Release_Year="2015", Concentration="Eau de Toilette", Rating_Value="NA", Rating_Count="0", Main_Accords="Fresh, Spicy, Woody, Citrus, Synthetic", Top_Notes="Bergamot, Pepper", Middle_Notes="Sichuan pepper, Lavender, Pink pepper, Vetiver, Patchouli, Geranium, Elemi", Base_Notes="Ambroxan, Cedar, Labdanum", URL=""),
 dict(Name="Sauvage", Brand="Dior", Release_Year="2018", Concentration="Eau de Parfum", Rating_Value="NA", Rating_Count="0", Main_Accords="Fresh, Spicy, Sweet, Woody, Synthetic", Top_Notes="Bergamot", Middle_Notes="Sichuan pepper, Lavender, Star anise, Nutmeg", Base_Notes="Ambroxan, Vanilla", URL=""),
 dict(Name="Le Mâle", Brand="Jean Paul Gaultier", Release_Year="1995", Concentration="Eau de Toilette", Rating_Value="NA", Rating_Count="0", Main_Accords="Sweet, Spicy, Fresh, Powdery, Woody", Top_Notes="Lavender, Mint, Artemisia, Bergamot, Cardamom", Middle_Notes="Orange blossom, Cinnamon, Caraway", Base_Notes="Vanilla, Tonka bean, Amber, Sandalwood, Cedar", URL=""),
 dict(Name="Khamrah", Brand="Lattafa", Release_Year="2022", Concentration="Eau de Parfum", Rating_Value="NA", Rating_Count="0", Main_Accords="Sweet, Spicy, Gourmand, Oriental, Woody", Top_Notes="Cinnamon, Nutmeg, Bergamot", Middle_Notes="Dates, Praline, Tuberose, Mahonial", Base_Notes="Vanilla, Tonka bean, Amberwood, Myrrh, Benzoin, Akigalawood", URL=""),
 dict(Name="Asad", Brand="Lattafa", Release_Year="2021", Concentration="Eau de Parfum", Rating_Value="NA", Rating_Count="0", Main_Accords="Spicy, Sweet, Oriental, Woody, Smoky", Top_Notes="Black pepper, Tobacco, Pineapple", Middle_Notes="Patchouli, Coffee, Iris", Base_Notes="Vanilla, Amber, Dry wood, Benzoin, Labdanum", URL=""),
]
keep += SUPP
for r in SUPP:
    for k in ("Main_Accords","Top_Notes","Middle_Notes","Base_Notes"): pass
AC = collections.Counter(a for r in keep for a in L(r["Main_Accords"]))
NO = collections.Counter(n for r in keep for k in ("Top_Notes","Middle_Notes","Base_Notes") for n in L(r[k]))
acc_list = [a for a, _ in AC.most_common()]
note_list = [n for n, _ in NO.most_common()]
ai = {a: i for i, a in enumerate(acc_list)}; ni = {n: i for i, n in enumerate(note_list)}
CONC = {"Eau de Toilette":"EDT","Eau de Parfum":"EDP","Extrait de Parfum":"Extrait","Eau de Cologne":"EDC","Eau de Parfum Intense":"EDP Intense","Parfum":"Parfum","Cologne":"Cologne","Perfume":"Parfum","Extrait":"Extrait","Eau de Toilette Intense":"EDT Intense","Eau Fraîche":"Eau Fraîche","Elixir":"Elixir"}
def clean(name, brand, conc, year):
    i = name.find(" " + brand + " ")
    if i > 0:
        tail = name[i + len(brand) + 2:]; name = name[:i].strip(" -")
        m = re.match(r"(\d{4})\s+(.*)", tail)
        if m:
            year = year or int(m.group(1)); conc = conc or m.group(2)
        elif tail and not conc: conc = tail
    return name, CONC.get(conc, conc), year
out = []
for r in keep:
    url = r["URL"].replace("https://www.parfumo.com/Perfumes/", "")
    nm, cc, yr = clean(r["Name"], r["Brand"], "" if r["Concentration"] == "NA" else r["Concentration"], int(f(r["Release_Year"])) if f(r["Release_Year"]) else 0)
    out.append([nm, r["Brand"], yr, cc,
                f(r["Rating_Value"]) or 0, int(f(r["Rating_Count"]) or 0),
                [ai[a] for a in L(r["Main_Accords"])],
                [ni[n] for n in L(r["Top_Notes"])], [ni[n] for n in L(r["Middle_Notes"])], [ni[n] for n in L(r["Base_Notes"])],
                url])
json.dump({"src": "Parfumo via TidyTuesday 2024-12-10", "accords": acc_list, "notes": note_list,
           "cols": ["nom","marque","annee","conc","note","votes","accords","tete","coeur","fond","url"], "p": out},
          open("parfums/db.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("kept", len(out), os.path.getsize("parfums/db.json")); print("accords", AC.most_common(40)); print("concs", collections.Counter(r["Concentration"] for r in keep).most_common(12))
print([o for o in out if "Sauvage" in o[0]][:2])
