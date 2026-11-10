import re,html,urllib.request,ssl
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
U=["https://africarrieres.com/ivory-coast/fr/emplois?q=conformit%C3%A9",
"https://africarrieres.com/ivory-coast/fr/emplois?search=compliance",
"https://www.goafricaonline.com/ci/emploi?q=conformit%C3%A9",
"https://www.goafricaonline.com/ci/emploi",
"https://emploi.educarriere.ci/nos-offres?motcle=conformite",
"https://emploi.educarriere.ci/",
"https://simoon-cv.com/emplois?q=conformite",
"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=compliance&location=C%C3%B4te%20d%27Ivoire&start=0",
"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=conformit%C3%A9&location=Abidjan&start=0",
"https://ci.indeed.com/jobs?q=conformit%C3%A9&l=Abidjan",
"https://www.novojob.com/cote-d-ivoire/offres-d-emploi?q=conformite",
"https://news.google.com/rss/search?q=%22offre+d%27emploi%22+conformit%C3%A9+Abidjan&hl=fr&gl=CI&ceid=CI:fr",
"https://www.emploi.ci/recherche-jobs-cote-ivoire?f%5B0%5D=im_field_offre_metiers%3A31"]
for u in U:
  print("===",u,flush=True)
  try:
    r=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA,"Accept-Language":"fr"}),timeout=40)
    s=r.read().decode('utf-8','ignore');print("HTTP",r.status,len(s))
  except Exception as e:
    print("ERR",str(e)[:120]);continue
  A=re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',s,re.S);n=0
  for h,t in A:
    t=re.sub(r'<[^>]+>',' ',t);t=html.unescape(re.sub(r'\s+',' ',t)).strip()
    if re.search(r'conformit|compliance|LBC|AML|KYC|risque|audit|contr[oô]le',t,re.I) and len(t)<160:
      print("  ",t[:100],"|",h[:120]);n+=1
    if n>=8:break
  if 'rss' in u: print("  items",s.count('<item>'),re.findall(r'<title>(.*?)</title>',s)[1:6])
  if n==0 and 'rss' not in u: print("  sample hrefs:",[h for h,_ in A if 'offre' in h or 'job' in h or 'emploi' in h][:6])
