import re,urllib.request
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
def g(u):return urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA,"Accept-Language":"fr"}),timeout=40).read().decode('utf-8','ignore')
for u,pat in [("https://africarrieres.com/ivory-coast/fr/emplois?q=conformit%C3%A9","chargee-de-conformite"),
 ("https://www.novojob.com/cote-d-ivoire/offres-d-emploi/conformite","offre-d-emploi"),
 ("https://emploi.educarriere.ci/","offre-158167"),
 ("https://www.goafricaonline.com/ci/emploi","job-23316")]:
  s=g(u);i=s.find(pat);print("=====",u,len(s),i);print(re.sub(r'\s+',' ',s[max(0,i-1500):i+1500]))
s=g("https://www.novojob.com/cote-d-ivoire/offres-d-emploi/conformite")
print("NOVO links",sorted(set(re.findall(r'href="(/cote-d-ivoire/offres-d-emploi/[^"]+)"',s)))[:30])
