/* CLB Health · le Professeur Santé
   Mascotte animée qui suit l'hydratation, les prises de médicaments, la chaleur et les effets indésirables.
   Il ralentit et s'attriste quand les objectifs ne sont pas atteints, retrouve son énergie quand ils le sont,
   et court montrer avec sa baguette les points les plus urgents. Données lues localement, rien n'est envoyé. */
(function(){
"use strict";
const HAS=n=>{try{return typeof eval(n)!=="undefined"}catch(e){return false}};
const G={W:()=>HAS("W")?eval("W"):null,M:()=>HAS("M")?eval("M"):null,P:()=>HAS("P")?eval("P"):null};
const LSG=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const LSS=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fr=n=>Math.round(n).toLocaleString("fr-FR").replace(/ /g," ");

/* ---------- styles */
const css=document.createElement("style");
css.textContent=`
#hprof{position:fixed;left:0;top:0;z-index:40;width:92px;height:118px;pointer-events:none;transition:opacity .4s;will-change:transform}
#hprof.off{opacity:0}
#hprof svg{width:92px;height:118px;pointer-events:auto;cursor:pointer;filter:drop-shadow(0 8px 10px rgba(14,40,80,.3));overflow:visible}
#hprof-b{position:fixed;z-index:41;top:0;left:10px;max-width:250px;background:#fff;border-radius:18px;padding:11px 13px;font:400 13px/1.45 -apple-system,system-ui,sans-serif;color:#0F2A3A;box-shadow:0 14px 30px -10px rgba(14,40,80,.45);opacity:0;transform:translateY(8px) scale(.95);transition:opacity .3s,transform .3s;pointer-events:none}
#hprof-b.hp-on{opacity:1;transform:none;pointer-events:auto}
#hprof-b b{color:#0E7490;display:inline!important;font-weight:800;margin:0!important}#hprof-b span,#hprof-b i,#hprof-b em{font-style:normal}
#hprof-b small{display:block;color:#64748B;font-size:10.5px;margin-top:4px}
#hprof-b .hp-ub{display:inline-block;font:800 10.5px -apple-system,system-ui;letter-spacing:.08em;color:#fff;border-radius:7px;padding:2px 7px;margin-bottom:5px;background:linear-gradient(135deg,#FB7185,#E11D48)}
#hprof-b.hp-warn .hp-ub{background:linear-gradient(135deg,#FBBF24,#D97706)}
#hprof-b.hp-good .hp-ub{background:linear-gradient(135deg,#34D399,#059669)}
#hprof-b.hp-urg{border:2px solid transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,#F59E0B,#E11D48,#7C3AED) border-box}
#hprof-b .hp-go{display:inline-block;margin-top:7px;font:800 12px -apple-system,system-ui;color:#fff;background:linear-gradient(135deg,#0EA5E9,#0E7490);border-radius:10px;padding:6px 11px;cursor:pointer}
#hprof-b .hp-mood{display:flex;gap:6px;margin-top:6px;font-size:11px;color:#475569}
#hprof-b .hp-mood i{flex:1;height:6px;border-radius:6px;background:#E2E8F0;overflow:hidden;display:block;margin-top:5px}
#hprof-b .hp-mood i em{display:block;height:100%;border-radius:6px}
.hp-spot{position:relative;z-index:6;animation:hpspot 1.1s ease-in-out infinite!important;border-radius:16px}
@keyframes hpspot{0%,100%{box-shadow:0 0 0 3px rgba(245,158,11,.95),0 0 0 8px rgba(245,158,11,.25)}50%{box-shadow:0 0 0 3px rgba(245,158,11,.95),0 0 0 15px rgba(245,158,11,.05)}}
`;
document.head.appendChild(css);

/* ---------- personnage */
const HAIR="M37.9 66.6 Q37.9 66.6 30.6 65.6 Q23.4 64.6 28.2 61.9 Q33.0 59.2 29.1 56.4 Q25.2 53.6 29.9 52.2 Q34.5 50.9 29.6 46.2 Q24.7 41.5 31.6 42.4 Q38.5 43.3 37.1 39.1 Q35.7 35.0 40.1 36.0 Q44.6 37.1 43.4 31.0 Q42.3 25.0 47.9 28.6 Q53.5 32.1 53.6 26.4 Q53.6 20.8 58.1 25.2 Q62.6 29.6 64.3 22.3 Q66.0 15.0 68.7 22.6 Q71.5 30.2 74.4 24.7 Q77.3 19.1 79.0 26.0 Q80.7 32.9 85.6 30.0 Q90.5 27.1 89.3 33.2 Q88.1 39.3 95.0 37.2 Q102.0 35.0 97.9 41.9 Q93.9 48.8 99.4 48.9 Q105.0 49.0 100.0 53.3 Q95.0 57.6 101.6 60.6 Q108.2 63.5 101.6 64.6 Q95.0 65.6 90.2 66.6 L90.2 66.6 Z";
const ICONS={
 water:'<path d="M118 50c-5 7-8 11-8 15a8 8 0 0 0 16 0c0-4-3-8-8-15z" fill="#38BDF8" stroke="#0284C7" stroke-width="1.4"/><path d="M114 65a4 4 0 0 0 3 4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
 med:'<g transform="rotate(-35 118 60)"><rect x="106" y="54" width="24" height="12" rx="6" fill="#FBBF24" stroke="#D97706" stroke-width="1.4"/><path d="M118 54v12" stroke="#D97706" stroke-width="1.4"/><rect x="118" y="54" width="12" height="12" rx="6" fill="#fff" opacity=".85"/></g>',
 heart:'<path d="M118 70c-9-6-13-10-13-15a6 6 0 0 1 13-2 6 6 0 0 1 13 2c0 5-4 9-13 15z" fill="#34D399" stroke="#059669" stroke-width="1.4"/>',
 alert:'<path d="M118 47l12 21h-24z" fill="#FB7185" stroke="#E11D48" stroke-width="1.4" stroke-linejoin="round"/><path d="M118 55v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="118" cy="64.5" r="1.4" fill="#fff"/>',
 sun:'<circle cx="118" cy="59" r="7" fill="#FBBF24" stroke="#D97706" stroke-width="1.2"/><path d="M118 47v4M118 67v4M106 59h4M126 59h4M110 51l3 3M123 64l3 3M126 51l-3 3M113 64l-3 3" stroke="#D97706" stroke-width="1.6" stroke-linecap="round"/>'};
const box=document.createElement("div");
box.innerHTML=`<div id="hprof-b"></div><div id="hprof" class="off"><svg id="hprof-s" viewBox="0 0 140 178" aria-label="Le Professeur Santé">
<defs><linearGradient id="hpc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E2E8F0"/></linearGradient><radialGradient id="hps" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#FAD7B5"/><stop offset="1" stop-color="#E9B48A"/></radialGradient><linearGradient id="hph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#D9E0EA"/></linearGradient></defs>
<ellipse id="hp-sh" cx="64" cy="172" rx="30" ry="4.5" fill="rgba(14,40,80,.22)"/>
<g id="hp-all">
 <g id="hp-legL"><path d="M54 132v28" stroke="#334155" stroke-width="10" stroke-linecap="round"/><path d="M47 163h15c3 0 4 3 2 4H46c-2 0-2-4 1-4z" fill="#1E293B"/></g>
 <g id="hp-legR"><path d="M74 132v28" stroke="#475569" stroke-width="10" stroke-linecap="round"/><path d="M67 163h15c3 0 4 3 2 4H66c-2 0-2-4 1-4z" fill="#0F172A"/></g>
 <path d="M28 146c0-26 14-40 36-40s36 14 36 40c-8 3-16 4-24 2l-12-6-12 6c-8 2-16 1-24-2z" fill="url(#hpc)" stroke="#94A3B8" stroke-width="1.6"/>
 <path d="M51 108l13 18 13-18z" fill="#A5F3FC"/>
 <path d="M51 108l-5 38M77 108l5 38" stroke="#CBD5E1" stroke-width="1.5"/>
 <path d="M44 120c4 5 4 12 0 16" stroke="#475569" stroke-width="2" fill="none"/><circle cx="44" cy="138" r="4" fill="none" stroke="#475569" stroke-width="2"/><path d="M44 120c-6-4-6-10-3-14" stroke="#475569" stroke-width="2" fill="none"/>
 <path d="M80 124h10v8H80z" fill="#fff" stroke="#E11D48" stroke-width="1"/><path d="M85 125.5v5M82.5 128h5" stroke="#E11D48" stroke-width="1.6"/>
 <g id="hp-armL"><path d="M37 116c-6 8-8 16-7 24" stroke="#94A3B8" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M37 116c-6 8-8 16-7 24" stroke="#fff" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="30" cy="142" r="5" fill="url(#hps)"/></g>
 <g id="hp-armR">
  <path d="M91 116c10-6 18-18 22-32" stroke="#94A3B8" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M91 116c10-6 18-18 22-32" stroke="#fff" stroke-width="9" stroke-linecap="round" fill="none"/>
  <circle cx="114" cy="80" r="6" fill="url(#hps)"/>
  <g id="hp-stick" opacity="0"><path d="M114 80L162 52" stroke="#92400E" stroke-width="3.4" stroke-linecap="round"/><path d="M114 80L162 52" stroke="#F59E0B" stroke-width="1.4" stroke-linecap="round"/><circle cx="163" cy="51.5" r="3.6" fill="#E11D48"/></g>
  <g id="hp-board"><rect x="103" y="44" width="30" height="30" rx="8" fill="#fff" stroke="#0E7490" stroke-width="2"/><g id="hp-icon">${ICONS.heart}</g></g>
 </g>
 <g id="hp-head">
  <rect x="57" y="86" width="14" height="24" rx="5" fill="#E9B48A"/>
  <g id="hp-hair"><path d="${HAIR}" fill="url(#hph)" stroke="#B6C2D2" stroke-width="1.4" stroke-linejoin="round"/></g>
  <ellipse cx="40" cy="68" rx="4.5" ry="6.5" fill="#E9B48A"/><ellipse cx="88" cy="68" rx="4.5" ry="6.5" fill="#E9B48A"/>
  <ellipse cx="64" cy="66" rx="24" ry="26" fill="url(#hps)"/>
  <g id="hp-brow" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1"><path id="hp-bl" d="M43 55c3-6 12-7 16-3-4 1-11 1-16 3z"/><path id="hp-br" d="M85 55c-3-6-12-7-16-3 4 1 11 1 16 3z"/></g>
  <g fill="rgba(255,255,255,.4)" stroke="#334155" stroke-width="2.2"><circle cx="53" cy="63" r="7.5"/><circle cx="75" cy="63" r="7.5"/></g><path d="M60.5 63h7" stroke="#334155" stroke-width="2.2"/>
  <g id="hp-eyes"><ellipse cx="53" cy="63" rx="2.5" ry="3" fill="#1E293B"/><ellipse cx="75" cy="63" rx="2.5" ry="3" fill="#1E293B"/><circle cx="54" cy="62" r=".9" fill="#fff"/><circle cx="76" cy="62" r=".9" fill="#fff"/></g>
  <path d="M64 66c-2 4-3 7 1 8" stroke="#C98B5E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <ellipse id="hp-ck1" cx="47" cy="74" rx="4.5" ry="2.8" fill="#F9A8A8" opacity=".75"/><ellipse id="hp-ck2" cx="81" cy="74" rx="4.5" ry="2.8" fill="#F9A8A8" opacity=".75"/>
  <path id="hp-mouth" d="M54 81c5 8 15 8 20 0z" fill="#fff" stroke="#9A3412" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M50 79c3-6 9-6 14-3 5-3 11-3 14 3-4 1-8-1-14 1-6-2-10 0-14-1z" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.1" stroke-linejoin="round"/>
  <g id="hp-sweat" opacity="0"><path d="M92 46c-3 4-4 6-4 8a4 4 0 0 0 8 0c0-2-1-4-4-8z" fill="#7DD3FC" stroke="#0284C7" stroke-width=".8"/><path d="M36 52c-2 3-3 4-3 6a3 3 0 0 0 6 0c0-2-1-3-3-6z" fill="#7DD3FC" stroke="#0284C7" stroke-width=".8"/></g>
 </g>
 <g id="hp-alarm" opacity="0"><circle cx="20" cy="28" r="13" fill="#E11D48" stroke="#fff" stroke-width="2.5"/><path d="M20 20v9" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="20" cy="34.5" r="2" fill="#fff"/></g>
 <g id="hp-zz" opacity="0" font-family="-apple-system,system-ui" font-weight="800" fill="#64748B"><text x="94" y="36" font-size="11">z</text><text x="101" y="27" font-size="14">Z</text></g>
</g></svg></div>`;
document.body.appendChild(box);
const $=id=>document.getElementById(id);

/* ---------- température extérieure (Open-Meteo, position déjà autorisée sinon Abidjan) */
let TEMP=LSG("hp-temp",null);
async function fetchTemp(){if(TEMP&&Date.now()-TEMP.at<45*60000)return;let la=5.36,lo=-4.01;
 try{if(navigator.permissions){const st=await navigator.permissions.query({name:"geolocation"});if(st.state==="granted"){const p=await new Promise((ok,ko)=>navigator.geolocation.getCurrentPosition(ok,ko,{timeout:6000,maximumAge:3600000}));la=p.coords.latitude;lo=p.coords.longitude}}}catch(e){}
 try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(3)}&longitude=${lo.toFixed(3)}&current=temperature_2m,apparent_temperature&timezone=auto`);const j=await r.json();
  TEMP={t:j.current.temperature_2m,f:j.current.apparent_temperature,at:Date.now()};LSS("hp-temp",TEMP);if(PF.on)refresh()}catch(e){}}

/* ---------- état de santé du jour */
function state(){const W=G.W(),M=G.M(),now=Date.now(),out={issues:[],g:1,hot:false,water:null,meds:null};
 const k=typeof today==="function"?today():new Date().toISOString().slice(0,10);
 // eau
 if(W){const t=(W.log[k]||[]).reduce((s,e)=>s+e[1],0),goal=W.goal||2000;let exp=0;try{exp=expectedNow()}catch(e){}
  const hot=TEMP&&(TEMP.f||TEMP.t)>=31;out.hot=hot;const need=exp*(hot?1.15:1);
  const wr=need>0?Math.min(1,t/need):(t>=goal?1:1);out.water={t,goal,exp:need,wr};
  const gap=need-t;
  if(t>=goal)out.issues.push({p:1,k:"good",tab:"eau",icon:"water",el:()=>$("w-ring"),h:`Objectif d'eau atteint : <b>${fr(t)} ml</b>. Bravo, ton corps te dit merci !`});
  else if(gap>=300)out.issues.push({p:gap>=700?9:6,k:gap>=700?"urg":"warn",tab:"eau",icon:hot?"sun":"water",el:()=>$("w-ring")||document.querySelector("#t-eau .drinks"),
   h:`${hot?`Il fait <b>${Math.round(TEMP.f||TEMP.t)} °C</b> ressentis. `:""}Tu as <b>${fr(gap)} ml de retard</b> sur ton eau (${fr(t)} / ${fr(goal)} ml). Bois un verre maintenant.`});
  else if(hot)out.issues.push({p:3,k:"warn",tab:"eau",icon:"sun",el:()=>$("w-ring"),h:`Chaleur : <b>${Math.round(TEMP.f||TEMP.t)} °C</b> ressentis. Garde ton rythme d'hydratation, ajoute un verre de plus.`});}
 // médicaments
 if(M&&typeof doses==="function"){let D=[];try{D=doses(k)}catch(e){}const due=D.filter(d=>d.at<=now);const missed=due.filter(d=>!M.taken[d.key]&&now-d.at>30*60000);
  out.meds={n:D.length,due:due.length,missed:missed.length,mr:due.length?(due.length-missed.length)/due.length:1};
  missed.slice(0,3).forEach(d=>{const late=Math.round((now-d.at)/60000);out.issues.push({p:late>120?10:8,k:"urg",tab:"med",icon:"med",el:()=>{const b=document.querySelector(`[data-take="${d.key}"]`);return b?(b.closest(".dose,.row,li,div")||b):null},
   h:`Prise oubliée : <b>${esc(d.m.nom)}</b> prévue à <b>${d.t}</b> (il y a ${late>=60?Math.floor(late/60)+" h "+String(late%60).padStart(2,"0"):late+" min"}). Prends-la si ton médecin l'autorise, puis touche « Pris ».`})});
  const next=D.find(d=>!M.taken[d.key]&&d.at>now&&d.at-now<45*60000);if(next)out.issues.push({p:4,k:"warn",tab:"med",icon:"med",el:()=>{const b=document.querySelector(`[data-take="${next.key}"]`);return b?(b.closest(".dose,.row,li,div")||b):null},h:`Bientôt : <b>${esc(next.m.nom)}</b> à <b>${next.t}</b>. Prépare-toi.`});
  if(D.length&&!missed.length&&due.length&&due.every(d=>M.taken[d.key]))out.issues.push({p:1,k:"good",tab:"med",icon:"heart",h:`Toutes tes prises du moment sont faites (${due.length}/${D.length}). Parfait !`});
  // effets indésirables sévères des dernières 24 h
  const fx=(M.fx||[]).find(f=>now-f.at<864e5&&f.lvl>=3);if(fx)out.issues.push({p:12,k:"urg",tab:"med",icon:"alert",el:()=>$("d-fx"),h:`Tu as signalé un <b>effet indésirable important</b>${fx.med?" avec "+esc(fx.med):""}. Contacte ton médecin ; en cas de gêne respiratoire ou de malaise, appelle le <b>185</b>.`});}
 // score global
 const wr=out.water?out.water.wr:1,mr=out.meds?out.meds.mr:1;out.g=Math.max(0,Math.min(1,.55*wr+.45*mr-(out.issues.some(i=>i.p>=12)?.3:0)));
 out.issues.sort((a,b)=>b.p-a.p);return out}

/* ---------- moteur d'animation */
const PF={x:-120,y:0,tx:0,ty:0,mode:"hide",face:1,t0:performance.now(),lastMove:0,on:false,el:null,side:-1,S:null,ph:0};
const PW=92,PH=118,NAVH=96,W_=()=>innerWidth,H_=()=>innerHeight;
const set=(id,tr)=>{const e=$(id);if(e)e.setAttribute("transform",tr)};
const home=()=>[W_()-PW-6,H_()-NAVH-PH];
const clampY=y=>Math.max(64,Math.min(H_()-NAVH-PH,y));
function anchor(el){const r=el.getBoundingClientRect();if(!r.width||r.bottom<64||r.top>H_()-NAVH-30)return null;const Wd=W_();let x,side;
 if(r.width<Wd*.6){if(r.right+PW-10<Wd){x=r.right-14;side=-1}else{x=r.left-PW+14;side=1}}else{x=Wd-PW-4;side=-1}
 const cy=Math.max(r.top,64)+Math.min(r.height,170)/2;return{x:Math.max(2,Math.min(Wd-PW-2,x)),y:clampY(cy-60),side}}
function spot(el){document.querySelectorAll(".hp-spot").forEach(e=>e.classList.remove("hp-spot"));if(el)el.classList.add("hp-spot")}
function runTo(x,y,then){PF.tx=x;PF.ty=y;PF.mode="run";PF.then=then||null}
function bubblePos(){const b=$("hprof-b");if(!b.classList.contains("hp-on"))return;const bw=b.offsetWidth||230,bh=b.offsetHeight||90;let top=PF.y-bh-6;if(top<56)top=PF.y+PH+6;if(top+bh>H_()-NAVH)top=Math.max(56,PF.y-bh-6);b.style.left=Math.max(8,Math.min(W_()-bw-8,PF.x+PW/2-bw/2))+"px";b.style.top=top+"px"}
const MOUTH={happy:"M54 81c5 8 15 8 20 0z",ok:"M55 83c4 3 14 3 18 0",sad:"M55 86c4-4 14-4 18 0"};
function frame(now){const dt=Math.min(50,now-(PF.last||now))/1000;PF.last=now;const t=(now-PF.t0)/1000;
 if(!PF.on){requestAnimationFrame(frame);return}
 const S=PF.S||{g:1,hot:false},g=S.g,energy=.3+.7*g,mood=g>=.85?"happy":g>=.55?"ok":"sad";
 PF.ph+=dt*(4+11*energy);const ph=PF.ph;
 if(PF.el&&(PF.mode==="run"||PF.mode==="point")){const a=anchor(PF.el);if(!a){endPoint()}else{PF.tx=a.x;PF.ty=a.y;PF.side=a.side;if(PF.mode==="point"&&Math.hypot(a.x-PF.x,a.y-PF.y)>30)PF.mode="run"}}
 let legA=0,armR=0,armL=0,bob=0,headR=0,lift=0,point=0,slump=mood==="sad"?7:mood==="ok"?2:0;
 if(PF.mode==="run"){const sp=(PF.urg?300:230)*energy,dx=PF.tx-PF.x,dy=PF.ty-PF.y,d=Math.hypot(dx,dy),st=Math.min(d,sp*dt);if(d>0){PF.x+=dx/d*st;PF.y+=dy/d*st}if(Math.abs(dx)>2)PF.face=dx>0?1:-1;
  legA=Math.sin(ph)*(16+18*energy);armL=-Math.sin(ph)*(12+18*energy);armR=Math.sin(ph)*10;bob=-Math.abs(Math.sin(ph))*(2+4*energy);headR=Math.sin(ph)*2+slump;
  if(d<1.5){PF.x=PF.tx;PF.y=PF.ty;PF.lastMove=now;PF.mode=PF.el?"point":PF.urg?"alert":"idle";const f=PF.then;PF.then=null;if(f)f()}}
 else if(PF.mode==="point"){PF.x+=(PF.tx-PF.x)*.2;PF.y+=(PF.ty-PF.y)*.2;PF.face=PF.side===-1?-1:1;point=1;armR=38+Math.sin(t*(2+3*energy))*6;armL=Math.sin(t*2)*5;headR=Math.sin(t*2.5)*3+slump*.5;bob=Math.sin(t*3*energy)*1.5;if(PF.urg)lift=-Math.abs(Math.sin(t*8))*(6+6*energy)}
 else if(PF.mode==="alert"){lift=-Math.abs(Math.sin(t*8))*14;legA=Math.sin(t*16)*10;armR=Math.sin(t*16)*24;armL=-20+Math.sin(t*16)*10;headR=Math.sin(t*8)*4}
 else if(PF.mode==="joy"){lift=-Math.abs(Math.sin(t*9))*18;armR=-10+Math.sin(t*18)*20;armL=-40+Math.sin(t*18)*10;legA=Math.sin(t*18)*12}
 else{const sl=energy;bob=Math.sin(t*2.4*sl)*2.2;armR=(Math.sin(t*1.6)>.5&&mood!=="sad"?Math.sin(t*9)*18:0);armL=Math.sin(t*1.2)*4;headR=Math.sin(t*1.3*sl)*3+slump;legA=Math.sin(t*1.2)*2;
  if(now-PF.lastMove>(mood==="sad"?22000:13000)&&!$("hprof-b").classList.contains("hp-on"))wander()}
 const blink=(t%4.3)<.12?.12:(mood==="sad"?.55:1);
 set("hp-legL",`rotate(${legA} 54 132)`);set("hp-legR",`rotate(${-legA} 74 132)`);
 set("hp-armL",`rotate(${armL} 37 116)`);set("hp-armR",`rotate(${armR} 91 116)`);
 const sk=$("hp-stick"),bd=$("hp-board");if(sk)sk.setAttribute("opacity",point);if(bd)bd.setAttribute("opacity",1-point);
 set("hp-head",`rotate(${headR} 64 100)`);set("hp-hair",`rotate(${Math.sin(t*3*energy)*2} 64 60)`);
 set("hp-eyes",`translate(0 ${63*(1-blink)}) scale(1 ${blink})`);
 set("hp-brow",`translate(0 ${PF.mode==="alert"||point?-3:mood==="sad"?2:0})`);
 const m=$("hp-mouth");if(m&&m.dataset.m!==mood){m.setAttribute("d",MOUTH[mood]);m.setAttribute("fill",mood==="happy"?"#fff":"none");m.dataset.m=mood}
 const sw=$("hp-sweat");if(sw)sw.setAttribute("opacity",S.hot||mood==="sad"?(.6+.4*Math.sin(t*4)):0);
 const zz=$("hp-zz");if(zz)zz.setAttribute("opacity",mood==="sad"&&PF.mode==="idle"?.5+.5*Math.sin(t*2):0);
 set("hp-all",`translate(0 ${bob+lift})`);
 const sh=$("hp-sh");if(sh){sh.setAttribute("rx",30-Math.abs(lift)/2);sh.setAttribute("opacity",1-Math.abs(lift)/30)}
 const al=$("hp-alarm");if(al)al.setAttribute("opacity",PF.urg?(Math.sin(t*10)>-.2?1:.25):0);
 $("hprof").style.transform=`translate(${PF.x}px,${PF.y}px)`;$("hprof-s").style.transform=`scaleX(${PF.face})`;bubblePos();
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);
function wander(){const x=8+Math.random()*(W_()-PW-16),y=clampY(80+Math.random()*(H_()-NAVH-PH-90));runTo(x,y,()=>setTimeout(()=>{if(PF.mode==="idle"&&!PF.el){const h=home();runTo(h[0],h[1])}},1800))}
function endPoint(){PF.el=null;spot(null);if(PF.mode==="point"||PF.mode==="run"){const h=home();runTo(h[0],h[1])}}
let PT=null,QUEUE=[],QI=0;
function setIcon(n){const g=$("hp-icon");if(g)g.innerHTML=ICONS[n]||ICONS.heart}
function gauge(S){const w=S.water?Math.round(S.water.wr*100):null,m=S.meds&&S.meds.due?Math.round(S.meds.mr*100):null;const bar=(l,v,c)=>v==null?"":`<span style="flex:1">${l} ${v} %<i><em style="width:${v}%;background:${c}"></em></i></span>`;
 return(w!=null||m!=null)?`<div class="hp-mood">${bar("💧 Eau",w,"linear-gradient(90deg,#38BDF8,#0284C7)")}${bar("💊 Prises",m,"linear-gradient(90deg,#FBBF24,#D97706)")}</div>`:""}
function say(it,ms){const b=$("hprof-b");clearTimeout(PT);setIcon(it.icon);
 const lab=it.k==="urg"?"🚨 URGENT":it.k==="warn"?"⚠️ À FAIRE":"✅ BIEN JOUÉ";
 const tabOf=document.querySelector(".tab.on");const here=!tabOf||tabOf.id==="t-"+it.tab;
 b.className="hp-on hp-"+it.k;
 b.innerHTML=`<span class="hp-ub">${lab}</span><br>${it.h}${!here&&it.tab?`<br><span class="hp-go" data-tab="${it.tab}">Aller à ${it.tab==="eau"?"Eau":it.tab==="med"?"Médocs":"Moi"} ›</span>`:""}${gauge(PF.S)}<small>Le Professeur Santé · touche-moi pour la suite</small>`;
 const g=b.querySelector(".hp-go");if(g)g.onclick=e=>{e.stopPropagation();b.classList.remove("hp-on");if(typeof go==="function")go(g.dataset.tab)};
 bubblePos();if(ms)PT=setTimeout(()=>{b.classList.remove("hp-on");endPoint();next()},ms)}
function present(it){PF.urg=it.k==="urg";const tabOf=document.querySelector(".tab.on");const here=!tabOf||tabOf.id==="t-"+it.tab;
 const el=here&&it.el?it.el():null;const a=el&&anchor(el);$("hprof-b").classList.remove("hp-on");spot(null);
 const ms=it.k==="urg"?12000:8000;
 if(a){PF.el=el;spot(el);runTo(a.x,a.y,()=>say(it,ms))}else{PF.el=null;const h=home();runTo(h[0],h[1],()=>{if(it.k==="urg")PF.mode="alert";say(it,ms)})}
 if(it.k==="urg"&&navigator.vibrate&&!sessionStorage.getItem("hp-vib"+it.h.length)){navigator.vibrate([120,80,120]);sessionStorage.setItem("hp-vib"+it.h.length,1)}}
function next(){QI++;if(QI<QUEUE.length)setTimeout(()=>present(QUEUE[QI]),500);else{PF.urg=false;const h=home();runTo(h[0],h[1])}}
function visibleTab(){const t=document.querySelector(".tab.on");return t?t.id.slice(2):""}
function allowed(){const sp=$("splash");if(sp&&!sp.classList.contains("out"))return false;if(LSG("hp-off",false))return false;return["moi","eau","med"].includes(visibleTab())}
function refresh(){PF.S=state()}
function show(){const ok=allowed();$("hprof").classList.toggle("off",!ok);PF.on=ok;clearTimeout(PT);spot(null);PF.el=null;$("hprof-b").classList.remove("hp-on");if(!ok)return;
 refresh();const tab=visibleTab();const S=PF.S;
 // les points les plus urgents d'abord : ceux de l'onglet ouvert, puis le plus urgent des autres onglets
 const mine=S.issues.filter(i=>i.tab===tab||(tab==="moi"&&i.p>=6));const other=S.issues.find(i=>i.tab!==tab&&i.p>=6&&!mine.includes(i));
 QUEUE=mine.slice(0,3);if(other&&QUEUE.length<3)QUEUE.push(other);
 if(!QUEUE.length){const g=S.g;QUEUE=[{p:0,k:"good",tab,icon:"heart",el:tab==="moi"?()=>$("day"):null,h:g>=.85?`Tout va bien aujourd'hui : objectifs d'eau et de médicaments en bonne voie. Continue comme ça !`:`Remplis tes objectifs au fil de la journée, je retrouverai toute mon énergie avec toi !`}]}
 if(PF.x<-50||PF.mode==="hide"){PF.x=-110;PF.y=clampY(H_()*.55)}PF.last=performance.now();QI=0;present(QUEUE[0])}
$("hprof-s").onclick=()=>{const was=PF.mode;PF.mode="joy";setTimeout(()=>{if(PF.mode==="joy")PF.mode="idle";if(QUEUE.length){QI=(QI+1)%QUEUE.length;present(QUEUE[QI])}},700)};
$("hprof-b").onclick=()=>{$("hprof-b").classList.remove("hp-on");clearTimeout(PT);endPoint();next()};
// réagir aux actions : verre bu, prise cochée
let lastG=null;
function react(){if(!PF.on)return;const before=PF.S?PF.S.g:null;refresh();const after=PF.S.g;
 if(before!=null&&after>before+.02){PF.mode="joy";PF.el=null;spot(null);setIcon("heart");const b=$("hprof-b");b.className="hp-on hp-good";b.innerHTML=`<span class="hp-ub">✅ BIEN JOUÉ</span><br>${after>=.85?"Super, je retrouve toute mon énergie !":"C'est mieux ! Encore un effort et je repars en pleine forme."}${gauge(PF.S)}<small>Le Professeur Santé</small>`;bubblePos();clearTimeout(PT);PT=setTimeout(()=>{b.classList.remove("hp-on");PF.mode="idle"},4500)}}
["wRender","mRender"].forEach(fn=>{try{const f=eval(fn);if(typeof f==="function"){eval(`${fn}=function(){const r=f.apply(this,arguments);setTimeout(react,60);return r}`)}}catch(e){}});
try{const _go=go;go=function(t){const r=_go.apply(this,arguments);setTimeout(show,120);return r}}catch(e){}
// démarrage : après l'écran d'accueil
const sp=$("splash");if(sp)new MutationObserver(()=>{if(sp.classList.contains("out"))setTimeout(show,700)}).observe(sp,{attributes:true,attributeFilter:["class"]});
setTimeout(show,1500);fetchTemp();setInterval(()=>{fetchTemp();if(PF.on&&PF.mode==="idle"&&!$("hprof-b").classList.contains("hp-on")){refresh()}},10*60000);
addEventListener("resize",()=>{const h=home();if(PF.mode==="idle"){PF.x=Math.min(PF.x,h[0]);PF.y=Math.min(PF.y,h[1])}});
window.HPROF={show,refresh,off:v=>{LSS("hp-off",!!v);show()}};
})();
