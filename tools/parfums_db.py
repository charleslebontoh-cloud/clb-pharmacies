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
AC = collections.Counter(a for r in keep for a in L(r["Main_Accords"]))
NO = collections.Counter(n for r in keep for k in ("Top_Notes","Middle_Notes","Base_Notes") for n in L(r[k]))
acc_list = [a for a, _ in AC.most_common()]
note_list = [n for n, _ in NO.most_common()]
ai = {a: i for i, a in enumerate(acc_list)}; ni = {n: i for i, n in enumerate(note_list)}
out = []
for r in keep:
    url = r["URL"].replace("https://www.parfumo.com/Perfumes/", "")
    out.append([r["Name"], r["Brand"], int(f(r["Release_Year"])) if f(r["Release_Year"]) else 0,
                "" if r["Concentration"] == "NA" else r["Concentration"],
                f(r["Rating_Value"]) or 0, int(f(r["Rating_Count"]) or 0),
                [ai[a] for a in L(r["Main_Accords"])],
                [ni[n] for n in L(r["Top_Notes"])], [ni[n] for n in L(r["Middle_Notes"])], [ni[n] for n in L(r["Base_Notes"])],
                url])
json.dump({"src": "Parfumo via TidyTuesday 2024-12-10", "accords": acc_list, "notes": note_list,
           "cols": ["nom","marque","annee","conc","note","votes","accords","tete","coeur","fond","url"], "p": out},
          open("parfums/db.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("kept", len(out), os.path.getsize("parfums/db.json")); print("accords", AC.most_common(40)); print("concs", collections.Counter(r["Concentration"] for r in keep).most_common(12))
print([o for o in out if "Sauvage" in o[0]][:2])
