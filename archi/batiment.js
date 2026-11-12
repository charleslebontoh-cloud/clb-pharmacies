// ARCHÉA — bâtiments composés : hôtel, magasin(s), maison ; formes en bande, en L, en U
// Principe : chaque aile est une barre « double épaisseur » (bande sur rue / couloir / bande arrière) ; les ailes se raccordent
// par un nœud (escalier, palier) ; les niveaux sans couloir (boutiques) sont découpés en cellules traversantes.
import { buildProgram, envelope, LEVEL_H, T_EXT } from './plan.js';

const R2 = v => Math.round(v * 100) / 100, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), E = 1e-3;

export const TYPES = [["maison", "Maison"], ["magasin", "Magasin / boutiques"], ["hotel", "Hôtel"]];
export const FORMES = [["auto", "Auto"], ["bande", "En bande"], ["L", "En L"], ["U", "En U"]];
export const isBat = p => p.type === "hotel" || p.type === "magasin" || ["bande", "L", "U"].includes(p.forme);

// ---------- variantes ----------
const VAR = [
  { forme: "bande", hall: "centre" }, { forme: "bande", hall: "bout" }, { forme: "bande", hall: "bout", tr: 1 },
  { forme: "L", side: "R", rho: .7 }, { forme: "L", side: "L", rho: .7 }, { forme: "L", side: "R", rho: 1.2 },
  { forme: "U", rho: .55 }, { forme: "U", rho: .95 }];
export function batVariants(p) {
  const shop = p.type === "magasin", house = p.type !== "hotel" && !shop;
  const nm = [shop ? "Bande sur rue · accès au centre" : house ? "Bande · entrée au centre" : "Bande · hall au centre", shop ? "Bande sur rue · accès en bout" : house ? "Bande · entrée en bout" : "Bande · hall en bout",
    "Bande en profondeur", shop ? "En L · terrain d'angle" : "En L · aile à droite", shop ? "En L · angle à gauche" : "En L · aile à gauche", "En L · grande aile",
    "En U · cour arrière", "En U · ailes longues"];
  return VAR.map((v, i) => ({ ...v, name: nm[i] }));
}

// ---------- cellules (repère local : u le long de l'aile, v de 0 côté couloir/arrière à d côté façade) ----------
const full = (k, n, o = {}) => (w, d) => [{ k, n, ...o, u0: 0, u1: w, v0: 0, v1: d }];
// empilement de pièces de la façade intérieure vers la façade extérieure ; h = profondeur fixe, sinon le reste
const stack = items => (w, d) => { const fx = items.reduce((s, i) => s + (i.h || 0), 0), nr = items.filter(i => !i.h).length || 1; let v = 0;
  return items.map((it, j) => { let h = it.h ? Math.min(it.h, d - .8 * (items.length - 1 - j)) : Math.max(.8, (d - fx) / nr); if (j === items.length - 1) h = d - v; const o = { ...it, u0: 0, u1: w, v0: v, v1: v + h }; delete o.h; v += h; return o; }); };
const row = items => (w, d) => { const fx = items.reduce((s, i) => s + (i.w || 0), 0), nr = items.filter(i => !i.w).length || 1; let u = 0;
  return items.flatMap((it, j) => { let ww = it.w ? it.w : Math.max(.8, (w - fx) / nr); if (j === items.length - 1) ww = w - u; const sub = it.b ? it.b(ww, d) : [{ ...it, u0: 0, u1: ww, v0: 0, v1: d }]; const o = sub.map(r => { const q = { ...r, u0: r.u0 + u, u1: r.u1 + u }; delete q.w; delete q.b; return q; }); u += ww; return o; }); };
const cell = (w, build, o = {}) => ({ w, build, zone: "any", ...o });

function hotelRoom(num, suite) {
  const id = "h" + num;
  return (w, d) => { const hb = clamp(d * .32, 2.1, 2.5), ws = 1.15;
    if (!suite) return [{ k: "sdh", n: "SdE", u0: 0, u1: w - ws, v0: 0, v1: hb, acc: id + "e", wet: 1 }, { k: "sas", n: "", id: id + "e", u0: w - ws, u1: w, v0: 0, v1: hb }, { k: "chh", n: "Chambre " + num, id, u0: 0, u1: w, v0: hb, v1: d, hab: 1, acc: id + "e" }];
    const h = w / 2; return [{ k: "sdh", n: "SdB suite", u0: 0, u1: h - ws, v0: 0, v1: hb, acc: id + "e", wet: 1 }, { k: "sas", n: "", id: id + "e", u0: h - ws, u1: h, v0: 0, v1: hb }, { k: "dress", n: "Dressing", u0: h, u1: w, v0: 0, v1: hb, acc: id },
      { k: "salon", n: "Salon suite " + num, id: id + "s", u0: 0, u1: h, v0: hb, v1: d, hab: 1, acc: id + "e" }, { k: "chh", n: "Chambre suite", id, u0: h, u1: w, v0: hb, v1: d, hab: 1, acc: id + "s" }]; };
}
const boutique = (i, arr) => (w, d) => { if (!arr) return [{ k: "vente", n: "Boutique " + i, u0: 0, u1: w, v0: 0, v1: d, entry: 1, hab: 1, id: "b" + i }];
  const dr = clamp(d * .3, 2.4, 4), ww = w < 3.4 ? 1.15 : 1.3;
  return [{ k: "res", n: "Réserve " + i, id: "r" + i, u0: 0, u1: w - ww, v0: 0, v1: dr, acc: "b" + i }, { k: "wc", n: "WC", u0: w - ww, u1: w, v0: 0, v1: dr, acc: "r" + i, wet: 1 },
    { k: "vente", n: "Boutique " + i, id: "b" + i, u0: 0, u1: w, v0: dr, v1: d, entry: 1, hab: 1 }]; };

// ---------- programmes ----------
function progHotel(p, V) {
  const n = clamp(p.ch | 0 || 20, 4, 240), Lv = clamp(p.levels | 0 || 1, 1, 6), one = V.forme === "L" || V.forme === "U", d1 = 7.2, d2 = one ? 0 : 7.2, dB = 7.2, C = 1.6, lift = Lv >= 2, warn = []; // L / U : une seule rangée de chambres + galerie côté cour
  const per = Lv === 1 ? [n] : [0, ...Array.from({ length: Lv - 1 }, (_, i) => Math.floor(n / (Lv - 1)) + (i < n % (Lv - 1) ? 1 : 0))];
  const levels = per.map((k, l) => { const cells = [], top = l === Lv - 1 && l > 0;
    let ns = top && p.suites ? Math.min(2, Math.floor(k / 4)) : 0, num = 1;
    for (let i = 0; i < ns; i++, num++) cells.push(cell(7.4, hotelRoom(l * 100 + num, 1), { zone: "quiet", fix: 1, hab: 1 }));
    for (let i = 0; i < k - 2 * ns; i++, num++) cells.push(cell(3.7, hotelRoom(l * 100 + num), { zone: "quiet", fix: 1, room: 1 }));
    if (l > 0) cells.push(cell(2.8, full("office", "Office d'étage"), { min: 2.2 }));
    return { corr: 1, cells, fill: g => g >= 3 ? cell(g, full("tv", "Salon d'étage", { hab: 1 })) : null, roomsAt: num - 1 }; });
  const L0 = levels[0].cells, a = (s, dd) => s / dd, pub = [];
  pub.push(cell(a(24 + .45 * n, d1), full("lounge", "Salon · lounge", { hab: 1, open: 1 }), { zone: "street", min: 4 }));
  if (p.bar) pub.push(cell(a(18 + .25 * n, d1), full("bar", "Bar", { hab: 1, open: 1 }), { zone: "street", min: 3.5 }));
  if (p.resto) pub.push(cell(a(Math.max(36, 1.05 * n + 20), d1), full("resto", "Restaurant", { hab: 1, open: 1 }), { zone: "street", min: 5 }),
    cell(a(Math.max(18, .42 * n + 10), dB), stack([{ k: "cuisinepro", n: "Cuisine", hab: 1, wet: 1 }, { k: "eco", n: "Économat · froid", h: 2.6, ext2: 1 }]), { min: 3.2 }));
  if (p.semi) pub.push(cell(a(40 + .5 * n, d1), full("semi", "Salle de séminaire", { hab: 1, big: 1 }), { zone: "street", min: 5 }));
  pub.push(cell(3.4, stack([{ k: "bur", n: "Back-office", h: 3.4, hab: 1 }, { k: "dir", n: "Direction", hab: 1 }]), { min: 2.8 }),
    cell(2.4, full("sanH", "Sanitaires H", { wet: 1 }), { min: 2 }), cell(2.4, full("sanF", "Sanitaires F", { wet: 1 }), { min: 2 }),
    cell(a(14 + .22 * n, dB), full("linge", "Lingerie · buanderie", { wet: 1, ext2: 1 }), { min: 2.4 }), cell(2.8, full("vest", "Vestiaires personnel", { wet: 1 }), { min: 2.4 }), cell(2.6, full("local", "Local technique"), { min: 2.2 }));
  levels[0].cells = [...pub, ...L0]; let rn = levels[0].roomsAt;
  levels[0].fill = g => { const k = Math.floor(g / 3.7); if (Lv > 1 && k >= 1) return Array.from({ length: k }, () => cell(g / k, hotelRoom(++rn), { fix: 1, room: 1 })); return g >= 3.7 ? cell(g, full("tv", "Salon de lecture", { hab: 1 })) : null; };
  const wh = clamp(6 + n * .06, 6, 10);
  return { gallery: one, d1, C, d2, levels, warn, hall: { w: wh, build: full("hall", "Hall · réception", { circ: 1, entry: 1, main: 1, hab: 1 }) }, core: { lift, stair: Lv >= 2 }, kind: "hotel", n };
}
function progShop(p, V) {
  const nb = clamp(p.nb | 0 || 1, 1, 20), S = Math.max(30, p.S || 120), Lv = clamp(p.levels | 0 || 1, 1, 6), arr = p.arriere !== 0, warn = [];
  const office = () => ({ corr: 1, cells: [cell(2.4, full("sanH", "Sanitaires H", { wet: 1 })), cell(2.4, full("sanF", "Sanitaires F", { wet: 1 })), cell(2.6, full("kit", "Kitchenette", { wet: 1 })), cell(4, full("reu", "Salle de réunion", { hab: 1 }), { zone: "street" })],
    fill: g => cell(g, full("plateau", "Plateau de bureaux", { hab: 1 })) });
  if (nb >= 2) { const A = S / nb, D = clamp(Math.round(Math.sqrt(2.1 * A) * 2) / 2, 8.5, 16), wu = A / D, C = 1.5, d1 = (D - C) / 2;
    const cells = Array.from({ length: nb }, (_, i) => cell(wu, boutique(i + 1, arr), { zone: "street", fix: 1, min: 3 }));
    const levels = [{ corr: 0, cells, fill: () => null }]; for (let l = 1; l < Lv; l++) levels.push(office());
    return { d1, C, d2: D - C - d1, levels, warn, core: { stair: Lv > 1, lift: Lv >= 4, acces: 1 }, kind: "shops", nb }; }
  const d1 = clamp(.55 * Math.sqrt(S), 6, 16), C = 1.5, d2 = clamp(.25 * Math.sqrt(S) + 1.5, 4, 7), a = (s, dd) => s / dd;
  const cells = [cell(a(.68 * S, d1), full("vente", "Surface de vente", { hab: 1, entry: 1, main: 1 }), { zone: "street", min: 4 }),
    cell(a(.16 * S, d2), full("res", "Réserve · stock", { ext2: !p.livraison }), { min: 3 }), cell(2.8, full("bur", "Bureau du gérant", { hab: 1 }), { min: 2.4 }),
    cell(2.6, full("vest", "Vestiaires", { wet: 1 }), { min: 2.2 }), cell(1.8, full("sanH", "WC H", { wet: 1 })), cell(1.8, full("sanF", "WC F", { wet: 1 })), cell(2.2, full("local", "Local technique"))];
  if (p.livraison) cells.push(cell(4.5, full("quai", "Quai de livraison", { ext2: 1 }), { min: 3.6 }));
  const levels = [{ corr: 1, cells, fill: (g, k) => k === "F" ? null : cell(g, full("res", "Réserve", {})) }]; for (let l = 1; l < Lv; l++) levels.push(office());
  return { d1, C, d2, levels, warn, core: { stair: Lv > 1, lift: Lv >= 4 }, kind: "shop", nb: 1 };
}
function progHouse(p, V) {
  const prog = buildProgram({ ...p, levels: p.levels === 2 ? 2 : 1 }), Lv = prog.levels, rooms = prog.rooms.filter(r => !r.stair);
  const Amax = Math.max(...[0, 1].slice(0, Lv).map(l => rooms.filter(r => r.lvl === l).reduce((s, r) => s + r.a, 0)));
  // en L / en U : ailes simples (une rangée de pièces + galerie couverte côté cour) pour garder une vraie cour à ciel ouvert
  const one = V.forme === "L" || V.forme === "U", d = one ? clamp(Math.sqrt(Amax) / 2.4, 3.8, 5.0) : clamp(Math.sqrt(Amax) / 2.6, 3.8, 5.0), C = one ? 1.5 : 1.2;
  const levels = [0, 1].slice(0, Lv).map(l => { const rs = rooms.filter(r => r.lvl === l), cells = [], seen = new Set();
    const id = x => x.id || x.k, hostOf = x => x.acc ? rs.find(y => y !== x && id(y) === x.acc) : null;
    for (const r of rs) { if (seen.has(r) || hostOf(r)) continue; // les pièces annexes suivent leur pièce principale
      const main = r, sec = rs.filter(x => hostOf(x) === main); [main, ...sec].forEach(x => seen.add(x));
      const zone = r.night ? "quiet" : r.strip === "f" ? "street" : (one ? "street" : "any");
      const mk = x => ({ k: x.k, n: x.n, id: id(x), acc: x.acc, hab: x.hab, wet: x.wet, entry: x.k === "sejour" ? 1 : 0, main: x.k === "sejour" ? 1 : 0, ext2: x.k === "buand" || (x.k === "cuisine" && !p.buanderie) ? 1 : 0, open: x.k === "sejour" || x.k === "sam" || (x.k === "cuisine" && p.open) ? 1 : 0 });
      if (main.k === "wc" || main.k === "wcv") { cells.push(cell(1.5, stack([{ ...mk(main), h: 1.9 }, { k: "rgt", n: "Placard" }]), { zone, fix: 1 })); continue; }
      const mn = Math.max(main.minW || 2.4, /^(ch|chp|chdom)$/.test(main.k) ? 3 : /^(sejour|salon|jeux)$/.test(main.k) ? 3.8 : /^(sam|cuisine|bureau)$/.test(main.k) ? 2.8 : 0), wm = Math.max(main.a / d, mn), bm = full(main.k, main.n, mk(main));
      if (!sec.length) { cells.push(cell(wm, bm, { zone, min: mn })); continue; }
      // pièces annexes (salle d'eau, dressing) collées à leur chambre
      const A = sec.reduce((s, x) => s + x.a, 0), ws = Math.max(A / d, ...sec.map(x => x.minW || 1.5)), bs = sec.length > 1 && d > 3.6 ? stack(sec.map((x, i) => ({ ...mk(x), h: i < sec.length - 1 ? d * x.a / A : 0 }))) : full(sec[0].k, sec[0].n, mk(sec[0]));
      cells.push(cell(wm + ws, (w, dd) => row([{ w: Math.max(1.5, w * ws / (wm + ws)), b: bs }, { b: bm }])(w, dd), { zone, min: mn + 1.5 })); }
    return { corr: 1, cells, fill: g => l ? (g >= 2.8 ? cell(g, full("tv", "Salon d'étage", { hab: 1 })) : null) : (g >= 2.2 && g <= 3.6 ? cell(g, full("rgt", "Rangement")) : null) }; });
  return { d1: d, C, d2: one ? 0 : d, levels, warn: prog.warn.slice(), core: { stair: Lv > 1 }, kind: "house", gallery: one };
}

// ---------- géométrie ----------
function strips(G, corr) {
  const { Lx, Ly, D, d1, C, d2, arms } = G, S = [], R = arms.includes("R"), Lf = arms.includes("L"), a0 = d1 + C, al = Ly + d2;
  if (corr) { S.push({ id: "barF", axis: "x", o: 0, len: Lx, c: d1, dir: -1, d: d1, kind: "F" }, { id: "barB", axis: "x", o: Lf ? D : 0, len: Lx - (Lf ? D : 0) - (R ? D : 0), c: d1 + C, dir: 1, d: d2, kind: "B" });
    // les ailes partent du couloir de la barre (l'angle appartient à l'aile)
    if (R) S.push({ id: "aRo", axis: "y", o: a0, len: al, c: Lx - d1, dir: 1, d: d1, kind: "AO" }, { id: "aRi", axis: "y", o: a0, len: al, c: Lx - d1 - C, dir: -1, d: d2, kind: "AI" });
    if (Lf) S.push({ id: "aLo", axis: "y", o: a0, len: al, c: d1, dir: -1, d: d1, kind: "AO" }, { id: "aLi", axis: "y", o: a0, len: al, c: d1 + C, dir: 1, d: d2, kind: "AI" }); }
  else { S.push({ id: "barX", axis: "x", o: 0, len: Lx, c: D, dir: -1, d: D, kind: "X" });
    if (R) S.push({ id: "aRx", axis: "y", o: D, len: Ly, c: Lx - D, dir: 1, d: D, kind: "AX" });
    if (Lf) S.push({ id: "aLx", axis: "y", o: D, len: Ly, c: D, dir: -1, d: D, kind: "AX" }); }
  return S.filter(x => x.d > .5 && x.len > .3);
}
const RANK = { street: { F: 0, X: 0, AO: 1, AX: 1, B: 3, AI: 4 }, quiet: { AO: 0, AX: 0, AI: 1, B: 2, F: 3, X: 1 }, any: { B: 0, AI: 1, AO: 2, AX: 1, F: 3, X: 0 } };
function mapRect(s, u0, u1, v0, v1) { const ua = R2(s.o + u0), ub = R2(s.o + u1), va = R2(s.c + s.dir * v0), vb = R2(s.c + s.dir * v1), lo = Math.min(va, vb), hi = Math.max(va, vb);
  return s.axis === "x" ? { x: ua, y: lo, w: R2(ub - ua), h: R2(hi - lo) } : { x: lo, y: ua, w: R2(hi - lo), h: R2(ub - ua) }; }
const facOf = s => ({ o: s.axis === "x" ? "h" : "v", out: s.dir });

export function generateBat(p, v = 12) {
  const VS = batVariants(p);
  if (v == null || v < 0 || v >= VS.length) { // automatique : la variante qui tient sur le terrain, puis la plus adaptée au programme
    const want = ["bande", "L", "U"].includes(p.forme) ? p.forme : null; let best = null;
    VS.forEach((V, i) => { if (want && V.forme !== want) return; const pl = layout(p, V, i); const pref = (p.type === "hotel" ? { bande: 0, L: 4, U: (p.ch || 0) >= 36 ? 2 : 9 } : p.type === "magasin" ? { bande: 0, L: 5, U: 9 } : { bande: 4, L: 0, U: 6 })[V.forme] + (V.tr ? 6 : 0) + (V.rho > 1 ? 2 : 0) + (V.hall === "bout" ? 1 : 0);
      const sc = pl.over * 60 + pl.warn.length * 8 + pref; if (!best || sc < best.sc) best = { sc, pl }; });
    best.pl.auto = 1; best.pl.variant = 12; return best.pl; }
  return layout(p, VS[v], v);
}

// calage sur la surface demandée (maison, magasin unique) : ±4 %
function layout(p, V, vi) { if (p.type === "hotel" || (p.type === "magasin" && (p.nb | 0) > 1) || !p.S) return layout0(p, V, vi);
  const shop = p.type === "magasin", met = pl => shop ? pl.levels[0].rooms.reduce((s, r) => s + r.w * r.h, 0) : pl.hab - (pl.gal || 0);
  const pl0 = layout0(p, V, vi); let q = { ...p }, pl = pl0; for (let i = 0; i < 6 && Math.abs(met(pl) - p.S) / p.S > .04; i++) { const nq = { ...q, S: Math.max(30, q.S * p.S / met(pl)) }; const np = layout0(nq, V, vi); if (Math.abs(met(np) - p.S) >= Math.abs(met(pl) - p.S) - .5) break; q = nq; pl = np; }
  // avertissements exprimés par rapport à la demande initiale
  pl.warn = [...pl0.warn.filter(w => /^La surface de/.test(w)), ...pl.warn.filter(w => !/^La surface de/.test(w))];
  const got = met(pl); if (got > p.S * 1.25) pl.warn.push(`La forme « ${V.name} » impose environ ${Math.round(got)} m² pour ${p.S} m² demandés : une forme plus compacte serait plus économique.`);
  pl.p = p; pl.Sreq = p.S; return pl; }
function layout0(p, V, vi) {
  const P = p.type === "hotel" ? progHotel(p, V) : p.type === "magasin" ? progShop(p, V) : progHouse(p, V);
  const { d1, C, d2 } = P, D = R2(d1 + C + d2), warn = P.warn.slice(), Lv = P.levels.length;
  const arms = V.forme === "L" ? [V.side] : V.forme === "U" ? ["L", "R"] : [], rho = V.rho || 0;
  // longueur de barre nécessaire (niveau le plus chargé)
  const stairW = 3.0, liftW = P.core.lift ? 2.4 : 0, coreW = stairW + liftW, hallW = P.hall ? P.hall.w : 0;
  let need = 0;
  P.levels.forEach((L, l) => { const T = L.cells.reduce((s, c) => s + c.w, 0) + (l === 0 ? hallW : 0) + (P.core.stair || P.hall ? coreW : 0);
    const ns = d2 > .5 ? 2 : 1, k = L.corr ? ns * (1 + arms.length * rho) : 1 + arms.length * rho; need = Math.max(need, T / k);
    const st = L.cells.filter(c => c.zone === "street").reduce((s, c) => s + c.w, 0) + (l === 0 ? hallW : 0); need = Math.max(need, st / (L.corr ? 1 + arms.length * rho * .5 : 1 + arms.length * rho) * .9); });
  // need = longueur équivalente de barre ; pour un L / U on garde la proportion des ailes sauf si la barre devient trop courte
  // une vraie cour : largeur et profondeur minimales selon le programme
  const nA0 = arms.length, cw = P.kind === "hotel" ? (nA0 === 2 ? 12 : 10) : P.kind === "house" ? (nA0 === 2 ? 7 : 6) : 8, cyMin = P.kind === "hotel" ? 10 : P.kind === "house" ? 6 : 7;
  const nA = arms.length, Lmin = Math.max(nA ? nA * D + cw : 6, hallW + coreW + (nA ? 3 : 0));
  let Lx = Math.max(need, Lmin), Ly = nA ? rho * Lx : 0;
  if (nA && need < Lmin) { const kk = P.levels.some(L => L.corr) && d2 > .5 ? 2 : 1; Ly = Math.max(3.7, need * (kk + kk * nA * rho) / (kk * nA) - Lx / nA); }
  Lx = Math.ceil(Lx * 10) / 10; Ly = nA ? Math.ceil(Math.max(cyMin, Ly) * 10) / 10 : 0;
  const G = { Lx, Ly, D, d1, C, d2, arms }, a0 = d1 + C, al = Ly + d2;
  // éléments fixes (mêmes positions à tous les niveaux pour la structure verticale) ; ua = abscisse absolue le long de l'aile
  const fixed = [], R = arms.includes("R"), Lf = arms.includes("L"), bB0 = Lf ? D : 0, bB1 = Lx - (R ? D : 0);
  const coreB = (lift, l) => row([{ k: "esc", n: "Escalier", stair: 1, w: stairW }, ...(lift ? [{ w: liftW, b: stack([{ k: "asc", n: "Ascenseur", h: 2.4 }, { k: "local", n: l ? "Gaine · local" : "Local" }]) }] : [])]);
  let hallU = null;
  if (P.hall) { // hôtel : hall sur rue (au centre, en bout, ou à l'angle pour un L)
    hallU = V.forme === "L" ? (R ? Lx - hallW : 0) : V.hall === "bout" ? 0 : R2((Lx - hallW) / 2);
    fixed.push({ strip: "barF", ua: hallU, w: hallW, lv: l => l === 0, build: P.hall.build, hall: 1, entrySide: V.tr ? "W" : null }); }
  const armCore = arms.length === 1 && !P.core.acces && (P.core.stair || P.core.lift), aS = arms[0];
  if (armCore) { // L : escalier (et ascenseur) à l'angle, au départ de l'aile
    if (P.core.stair) fixed.push({ strip: (aS === "R" ? "aR" : "aL") + (d2 > .5 ? "i" : "o"), ua: a0, w: 3.2, lv: (l, L) => L.corr, build: full("esc", "Escalier", { stair: 1 }) });
    if (P.core.lift) fixed.push({ strip: aS === "R" ? "aRo" : "aLo", ua: a0 + (d2 > .5 ? 0 : 3.2), w: 2.6, lv: (l, L) => L.corr, build: stack([{ k: "asc", n: "Ascenseur", h: 2.4 }, { k: "local", n: "Gaine · local" }]) }); }
  let coreU = null;
  if (!armCore && (P.core.stair || P.core.lift)) {
    const w = P.kind === "hotel" || P.core.lift ? coreW : stairW;
    coreU = P.hall ? clamp(V.hall === "bout" && !V.tr ? hallU : V.tr ? bB0 : hallU + (hallW - w) / 2, bB0, bB1 - w) : V.hall === "bout" || (P.core.acces && arms.length === 1) ? (R || !arms.length ? bB0 : bB1 - w) : R2(bB0 + (bB1 - bB0 - w) / 2);
    if (d2 < .5 && P.hall) coreU = hallU + hallW + w <= Lx - (R ? D : 0) ? hallU + hallW : hallU - w;
    if (coreU - bB0 < 1.6) coreU = bB0; if (bB1 - coreU - w < 1.6) coreU = bB1 - w;
    if (P.core.acces) fixed.push({ strip: "barB", ua: coreU, w, lv: () => true, place: L => L.corr ? null : "barX", build: (ww, dd, l, L) => L.corr ? coreB(P.core.lift, l)(ww, dd) : stack([{ k: "esc", n: "Escalier", stair: 1, h: d2, acc: "he" }, { k: "hallE", n: "Accès étages", id: "he", circ: 1, entry: 1, priv: 1 }])(ww, dd) });
    else fixed.push({ strip: "barB", ua: coreU, w, lv: () => true, build: (ww, dd, l) => coreB(P.core.lift, l)(ww, dd) }); }
  // escaliers de secours (bâtiments à étages : aucun point du couloir à plus de ~25 m d'un escalier)
  if (Lv > 1 && (P.kind === "hotel" || P.kind === "shop")) { const cores = []; if (coreU != null) cores.push(coreU + 1.5); if (armCore) cores.push(aS === "R" ? Lx - D / 2 : D / 2);
    const far = u => Math.min(...cores.map(c => Math.abs(c - u))), sec = full("esc", "Escalier de secours", { stair: 1 });
    if (!Lf && far(0) > 25) fixed.push({ strip: "barB", ua: 0, w: stairW, lv: (l, L) => L.corr, build: sec });
    if (!R && far(Lx) > 25) fixed.push({ strip: "barB", ua: Lx - stairW, w: stairW, lv: (l, L) => L.corr, build: sec });
    for (const a of arms) if (al + (a === "R" ? far(Lx) : far(0)) > 25) fixed.push({ strip: a === "R" ? "aRi" : "aLi", ua: a0 + al - stairW, w: stairW, lv: (l, L) => L.corr, build: sec }); }

  // cour non couverte (L / U) : seul le bâti forme le L ou le U
  const court0 = arms.length ? { x: Lf ? D : 0, y: D, w: R2(Lx - (Lf ? D : 0) - (R ? D : 0)), h: Ly } : null;
  // ---------- niveaux ----------
  let over = 0;
  const levels = P.levels.map((L, l) => {
    const SS = strips(G, L.corr), byId = Object.fromEntries(SS.map(s => [s.id, s])), rooms = [], add = (s, rs, base, extra = {}) => { for (const r of rs) { const q = { ...r, ...mapRect(s, base + r.u0, base + r.u1, r.v0, r.v1), fac: facOf(s), ...extra }; delete q.u0; delete q.u1; delete q.v0; delete q.v1; q.lvl = l; rooms.push(q); } };
    const fx = fixed.filter(f => f.lv(l, L)).map(f => { const sid = f.place ? (f.place(L) || f.strip) : (!L.corr && /^bar/.test(f.strip) ? "barX" : f.strip), sid2 = byId[sid] ? sid : ({ barB: "barF", aRi: "aRo", aLi: "aLo" })[sid] || sid, s = byId[sid2]; return { ...f, sid: sid2, u0: s ? f.ua - s.o : 0 }; });
    for (const f of fx) { const s = byId[f.sid]; if (!s) continue; add(s, f.build(f.w, s.d, l, L), f.u0, f.entrySide ? { entrySide: f.entrySide } : {}); }
    // segments libres
    const segs = []; for (const s of SS) { const cut = fx.filter(f => f.sid === s.id).map(f => [f.u0, f.u0 + f.w]).sort((a, b) => a[0] - b[0]); let a = 0;
      for (const [c0, c1] of [...cut, [s.len, s.len]]) { if (c0 - a > .05) segs.push({ s, a, b: c0, cells: [], anchor: fx.some(f => f.hall && f.sid === s.id && Math.abs(f.u0 - c0) < E) ? "end" : "start" }); a = Math.max(a, c1); } }
    // répartition (gloutonne, par zone de préférence)
    const order = ["street", "quiet", "any"], cells = L.cells.slice().sort((a, b) => order.indexOf(a.zone) - order.indexOf(b.zone));
    const free = sg => (sg.b - sg.a) - sg.cells.reduce((t, c) => t + c.w, 0);
    for (const c of cells) { const cand = segs.slice().sort((x, y) => (RANK[c.zone][x.s.kind] - RANK[c.zone][y.s.kind]) || (y.b - y.a) - (x.b - x.a));
      const sg = cand.find(x => free(x) >= c.w * .9) || cand.slice().sort((x, y) => free(y) - free(x))[0]; if (sg) sg.cells.push(c); }
    // ajustement des largeurs de chaque segment
    for (const sg of segs) { const len = sg.b - sg.a; if (!sg.cells.length && !(L.fill && len >= 2.2 && L.fill(len, sg.s.kind))) sg.cells.push(cell(len, full(len < 1.4 ? "gaine" : "local", len < 1.4 ? "Gaine" : "Local technique"))); let tot = sg.cells.reduce((t, c) => t + c.w, 0), gap = len - tot;
      if (gap > .05) { const f = L.fill && L.fill(gap, sg.s.kind); const flex = sg.cells.filter(c => !c.fix);
        if (f && gap >= 2.2) sg.cells.push(...[].concat(f));
        else if (flex.length) { const k = 1 + gap / flex.reduce((t, c) => t + c.w, 0); flex.forEach(c => c.w *= k); }
        else if (sg.cells.length) { const k = len / tot; sg.cells.forEach(c => c.w *= k); }
        else if (f) sg.cells.push(f); }
      else if (gap < -.05) { const flex = sg.cells.filter(c => !c.fix), fs = flex.reduce((t, c) => t + c.w, 0), room = flex.reduce((t, c) => t + Math.max(0, c.w - (c.min || 2)), 0);
        if (room >= -gap) flex.forEach(c => c.w -= -gap * Math.max(0, c.w - (c.min || 2)) / room);
        else { const k = len / tot; if (k < .88) over += (tot - len); sg.cells.forEach(c => c.w *= k); } }
      tot = sg.cells.reduce((t, c) => t + c.w, 0); if (Math.abs(tot - len) > .01 && sg.cells.length) sg.cells[sg.cells.length - 1].w += len - tot;
      const list = sg.anchor === "end" ? sg.cells.slice().reverse() : sg.cells; let u = sg.a;
      for (const c of list) { add(sg.s, c.build(c.w, sg.s.d, l, L), u); u += c.w; } }
    // couloirs (interrompus par les éléments traversants)
    if (L.corr) { const band = (x, y, w, h, n) => { if (w > .3 && h > .3) rooms.push({ k: "couloir", n, x: R2(x), y: R2(y), w: R2(w), h: R2(h), circ: 1, lvl: l }); };
      const cn = P.gallery ? "Galerie" : "Couloir"; band(0, d1, Lx, C, P.gallery ? cn : l ? "Couloir d'étage" : "Couloir");
      if (R) band(Lx - d1 - C, a0, C, al, cn); if (Lf) band(d1, a0, C, al, cn); }
    rooms.forEach(r => { r.a = R2(r.w * r.h); });
    if (P.kind === "hotel") { // numérotation continue le long du couloir
      const t = r => { const cx = r.x + r.w / 2, cy = r.y + r.h / 2; if (cy > D && R && cx > Lx - D) return Lx + cy; if (cy > D && Lf && cx < D) return -cy; return cx; };
      const units = rooms.filter(r => r.k === "chh" && !/suite/.test(r.n)).concat(rooms.filter(r => r.k === "salon" && /suite/.test(r.n))).sort((a, b) => t(a) - t(b) || a.y - b.y); let k = 0;
      for (const u of units) { k++; const num = l ? l * 100 + k : k; if (u.k === "salon") u.n = "Salon suite " + num; else u.n = "Chambre " + num; } }
    const op = openings(rooms, p, P, V, court0, l);
    return { l, rooms, ...op, name: Lv === 1 ? (P.kind === "house" ? "Plain-pied" : "Rez-de-chaussée") : l === 0 ? "Rez-de-chaussée" : Lv === 2 ? "Étage" : (l === 1 ? "1er" : l + "e") + " étage" };
  });
  // capacité réelle
  const nRooms = levels.reduce((s, L) => s + L.rooms.filter(r => r.k === "chh").length, 0);
  if (P.kind === "hotel" && nRooms < P.n) warn.push(`Le gabarit ne loge que ${nRooms} chambres sur les ${P.n} demandées : ajoute un niveau ou choisis une autre forme.`);
  if (over > .5) warn.push("Programme à l'étroit : certaines pièces ont été réduites pour tenir dans le gabarit.");
  // blocs (enveloppe) et transposition éventuelle (bande en profondeur)
  let blocks = [{ x: 0, y: 0, w: Lx, h: D, axis: "x" }], roofBlocks = [{ x: 0, y: 0, w: Lx, h: D }], court = null;
  if (R) { blocks.push({ x: R2(Lx - D), y: D, w: D, h: Ly, axis: "y" }); roofBlocks.push({ x: R2(Lx - D), y: 0, w: D, h: R2(D + Ly) }); }
  if (Lf) { blocks.push({ x: 0, y: D, w: D, h: Ly, axis: "y" }); roofBlocks.push({ x: 0, y: 0, w: D, h: R2(D + Ly) }); }
  let outside = [];
  if (arms.length) { court = court0; const c = court, td = P.kind === "hotel" ? 4 : 3;
    if (P.kind === "shops" || P.kind === "shop") outside.push({ k: "cour", n: "Cour de service (non couverte)", x: c.x, y: c.y, w: c.w, h: c.h });
    else { const th = Math.min(td, c.h); outside.push({ k: "terr", n: "Terrasse (non couverte)", x: c.x, y: c.y, w: c.w, h: th });
      if (c.h > td) { if (R) outside.push({ k: "terr", n: "", x: R2(c.x + c.w - td), y: R2(c.y + td), w: td, h: R2(c.h - td) }); if (Lf) outside.push({ k: "terr", n: "", x: c.x, y: R2(c.y + td), w: td, h: R2(c.h - td) });
        const gx = c.x + (Lf ? td : 0), gw = c.w - (Lf ? td : 0) - (R ? td : 0); if (gw > 1.5 && c.h - td > 1.5) outside.push({ k: "jardin", n: p.piscine ? "Jardin · piscine" : "Jardin", x: R2(gx), y: R2(c.y + td), w: R2(gw), h: R2(c.h - td) }); } }
    outside.forEach(z => z.a = R2(z.w * z.h)); }
  let W = Lx, Dt = R2(D + Ly);
  if (V.tr) { const sw = o => { [o.x, o.y, o.w, o.h] = [o.y, o.x, o.h, o.w]; };
    levels.forEach(L => { L.rooms.forEach(r => { sw(r); if (r.fac) r.fac = { o: r.fac.o === "h" ? "v" : "h", out: r.fac.out }; if (r.entrySide) r.entrySide = "S"; });
      L.doors.forEach(o => { if (o.o === "h") { o.o = "v"; o.x = o.y; delete o.y; } else { o.o = "h"; o.y = o.x; delete o.x; } });
      L.wins.forEach(w => { w.o = w.o === "h" ? "v" : "h"; }); });
    blocks.forEach(b => { sw(b); b.axis = b.axis === "x" ? "y" : "x"; }); roofBlocks.forEach(sw); [W, Dt] = [Dt, W]; }
  const setS = p.recul || 3, setF = p.reculAv || (p.parking ? 7 : 5), maxW = Math.max(6, p.L - 2 * setS), maxD = Math.max(6, p.P - setF - setS);
  let ovr = Math.max(0, W - maxW) + Math.max(0, Dt - maxD);
  if (ovr > .05) warn.push(`Le bâtiment (${W.toFixed(1)} × ${Dt.toFixed(1)} m) dépasse la zone constructible du terrain (reculs ${setF} m devant, ${setS} m sur les côtés et au fond) : ajoute un niveau, change de forme ou agrandis le terrain.`);
  if (court && court.w < 6 && V.forme === "U") warn.push(`Cour intérieure étroite (${court.w.toFixed(1)} m) : préfère une forme en L ou en bande.`);
  const emprise = blocks.reduce((s, b) => s + b.w * b.h, 0), hab = levels.flatMap(L => L.rooms).filter(r => !r.stair).reduce((s, r) => s + r.w * r.h, 0), ces = emprise / (p.L * p.P);
  if (ces > .6 && P.kind !== "shops") warn.push(`Emprise au sol de ${Math.round(ces * 100)} % : au-delà de 60 %, la parcelle devient peu perméable et mal ventilée.`);
  const lvl0 = levels[0]; const md = lvl0.doors.find(d => d.main) || lvl0.doors.find(d => d.ext);
  return { p, W: R2(W), D: R2(Dt), levels, hab: Math.round(hab), emprise: Math.round(emprise), shon: Math.round(emprise * Lv), ces, warn, variant: vi, duplex: Lv > 1, over: over + ovr,
    mode: "C", gal: P.gallery ? Math.round(levels.flatMap(L => L.rooms).filter(r => r.k === "couloir").reduce((s, r) => s + r.w * r.h, 0)) : 0, forme: V.forme, vname: V.name, strip: { d1, C, d2 }, tr: !!V.tr, kind: P.kind, nRooms, nb: P.nb, blocks, roofBlocks, court, outside, depth: D, bar: V.tr ? { x: 0, y: 0, w: D, h: Lx } : { x: 0, y: 0, w: Lx, h: D },
    entry: md ? (md.o === "h" ? { x: md.c, y: md.y } : { x: md.x, y: md.c }) : null, site: { L: p.L, P: p.P, ox: (p.L - W) / 2, oy: setF } };
}

// ---------- portes et fenêtres (génériques) ----------
const STDW = [.6, .8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.4], STDB = [1.2, 1.5, 1.8, 2.1, 2.4, 3.0, 3.6, 4.2, 4.8, 5.4];
function openings(rooms, p, P, V, court, lvl = 0) {
  const doors = [], wins = [], env = envelope(rooms), idx = new Map(rooms.map((r, i) => [r, i]));
  const shared = (i, j) => { const ps = env.filter(e => e.ri === i && e.nb === j).sort((a, b) => a.a0 - b.a0); const out = []; for (const e of ps) { const l = out[out.length - 1]; if (l && l.o === e.o && Math.abs(l.at - e.at) < E && e.a0 <= l.a1 + .02) l.a1 = e.a1; else out.push({ ...e }); } return out.sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0)); };
  const door = (e, r, w, o = {}) => { const len = e.a1 - e.a0; w = Math.min(w, len - .15); if (w < .6) return; let c = (e.a0 + e.a1) / 2; if (o.side && len > w + 1.4) c = e.a0 + .45 + w / 2;
    doors.push(e.o === "h" ? { o: "h", y: e.at, c, w, into: r.k, ir: idx.get(r), ...o } : { o: "v", x: e.at, c, w, into: r.k, ir: idx.get(r), ...o }); };
  const find = id => rooms.find(q => q.id === id) || rooms.find(q => q.k === id);
  const done = new Set();
  rooms.forEach((r, i) => {
    if (r.acc) { const h = find(r.acc); if (h && h !== r) { const e = shared(i, rooms.indexOf(h))[0]; if (e) { door(e, r, r.wet ? .7 : r.k === "res" ? 1.0 : .83); return; } } }
    if (r.circ) { rooms.forEach((q, j) => { if (!q.circ || j === i || done.has(j + "-" + i)) return; done.add(i + "-" + j); for (const e of shared(i, j)) { const len = e.a1 - e.a0; if (len > .7) door(e, r, len - .1, { open: 1 }); } }); return; }
    // accès depuis une circulation
    let best = null; rooms.forEach((q, j) => { if (!q.circ || q.priv || j === i) return; const e = shared(i, j)[0]; if (e && (!best || e.a1 - e.a0 > best.a1 - best.a0)) best = e; });
    if (best) { const big = /^(lounge|resto|bar|semi|vente|plateau|sejour|sam|tv|reu)$/.test(r.k) || r.open, wide = r.open || /^(lounge|bar|tv)$/.test(r.k);
      if (wide) door(best, r, Math.min(2.4, best.a1 - best.a0 - .4), { open: 1 }); else door(best, r, r.stair ? Math.min(1.2, best.a1 - best.a0 - .3) : big ? 1.4 : r.wet ? .8 : .9, { side: !big && !r.stair, open: r.stair ? 1 : 0 }); }
    else if (!r.entry) { let b2 = null; rooms.forEach((q, j) => { if (j === i || q.wet || q.stair) return; const e = shared(i, j)[0]; if (e && (!b2 || e.a1 - e.a0 > b2.a1 - b2.a0)) b2 = e; }); if (b2) door(b2, r, .83); }
  });
  // portes extérieures
  const extP = i => env.filter(e => e.ri === i && e.ext);
  const dirOf = s => s === "S" ? { o: "h", out: -1 } : s === "N" ? { o: "h", out: 1 } : s === "W" ? { o: "v", out: -1 } : { o: "v", out: 1 };
  rooms.forEach((r, i) => {
    const ps = extP(i); if (!ps.length) return;
    if (r.entry) { const want = r.entrySide ? dirOf(r.entrySide) : r.fac || { o: "h", out: -1 }; const cand = ps.filter(e => e.o === want.o && e.out === want.out).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0));
      const e = cand[0] || ps.slice().sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))[0], len = e.a1 - e.a0;
      const w = r.k === "vente" ? (P.kind === "shops" ? Math.min(3, len - 1) : Math.min(2.4, len * .3)) : r.k === "hall" ? 1.8 : r.k === "hallE" ? 1.0 : 1.0;
      let c = (e.a0 + e.a1) / 2; if (r.k === "sejour") c = e.a0 + Math.min(1.4, len / 4) + .5;
      if (r.k === "hallE" || r.k === "sejour" || len > w + .3) doors.push(e.o === "h" ? { o: "h", y: e.at, c, w, into: r.k, ir: i, ext: 1, main: r.main || r.k === "vente" ? 1 : 0, out: e.out, shop: r.k === "vente" && P.kind === "shops" ? 1 : 0 } : { o: "v", x: e.at, c, w, into: r.k, ir: i, ext: 1, main: r.main || r.k === "vente" ? 1 : 0, out: e.out, shop: r.k === "vente" && P.kind === "shops" ? 1 : 0 }); }
    if (r.ext2) { const fa = r.fac; const cand = ps.filter(e => !(e.o === "h" && e.out === -1) && e.a1 - e.a0 > 1.4).sort((a, b) => (fa && b.o === fa.o && b.out === fa.out ? 1 : 0) - (fa && a.o === fa.o && a.out === fa.out ? 1 : 0) || (b.a1 - b.a0) - (a.a1 - a.a0))[0];
      if (cand) { const w = r.k === "quai" ? Math.min(3, cand.a1 - cand.a0 - .6) : .9; doors.push(cand.o === "h" ? { o: "h", y: cand.at, c: (cand.a0 + cand.a1) / 2, w, into: r.k, ir: i, ext: 1, out: cand.out } : { o: "v", x: cand.at, c: (cand.a0 + cand.a1) / 2, w, into: r.k, ir: i, ext: 1, out: cand.out }); } }
  });
  // fenêtres
  const B = +p.baies || 0;
  rooms.forEach((r, i) => { for (const e of extP(i)) { const len = e.a1 - e.a0; if (len < .9) continue;
    const k = r.k; let s;
    if (r.wet || /^(sdh|sdb|sdbp|dch|wc|wcv|sanH|sanF|vest|kit)$/.test(k)) s = { w: .6, sill: 1.6, head: 2.2 };
    else if (/^(sas|asc|gaine|bag|res|local|mag|cellier|rgt|eco|linge|office|arch|dress)$/.test(k)) s = len > 1.8 ? { w: .6, sill: 1.6, head: 2.2 } : null;
    else if (r.stair) s = { w: .8, sill: 1.2, head: 2.2 };
    else if (k === "couloir") { if (len >= 2.2 && court && P.gallery) { for (let u = e.a0 + 1.6; u < e.a1 - 1.2; u += 3.2) { const ww = Math.min(2.4, e.a1 - u - .4); if (ww > .9) wins.push({ o: e.o, at: e.at, c: u + ww / 2 - .2, w: ww > 2 ? 2.4 : 1.2, sill: lvl ? .9 : 0, head: 2.4, k, baie: !lvl, out: e.out, terr: lvl ? 0 : 1 }); } continue; }
      s = len < 2.2 ? { w: Math.min(1, len - .5), sill: .9, head: 2.2 } : null; }
    else if (k === "vente") s = { w: len - .8, sill: .3, head: 2.6, vit: 1 };
    else if (k === "quai") s = null;
    else if (/^(hall|lounge|resto|bar|semi|plateau|reu)$/.test(k)) s = { w: Math.min(k === "plateau" ? len - 1 : 4.8, len * .7), sill: k === "plateau" || k === "reu" ? .9 : 0, head: 2.4, baie: k !== "plateau" && k !== "reu" ? 1 : 0, vit: k === "plateau" ? 1 : 0 };
    else if (/^(sejour|salon|sam|tv)$/.test(k)) { s = { w: Math.min(3.2, len * .55), sill: e.out === -1 && e.o === "h" ? 0 : .9, head: 2.2 }; if (B) s = { w: B === 2 ? Math.max(1.2, len - .8) : Math.min(4.2, len * .7), sill: 0, head: B === 2 ? 2.6 : 2.4 }; }
    else if (/^(cuisinepro|cuisine)$/.test(k)) s = { w: Math.min(1.6, len * .4), sill: 1.1, head: 2.2 };
    else { s = { w: Math.min(1.6, Math.max(1, len * .45)), sill: .9, head: 2.2 }; if (B && /^(chh|chp|ch|bureau|bur|dir)$/.test(k)) s = { w: B === 2 ? Math.min(2.6, len * .6) : Math.min(2.0, len * .5), sill: B === 2 ? 0 : .5, head: B === 2 ? 2.6 : 2.4 }; }
    // façade donnant sur la cour : les pièces de vie s'ouvrent largement sur la terrasse
    const mid = (e.a0 + e.a1) / 2, px = e.o === "h" ? mid : e.at + e.out * .5, py = e.o === "h" ? e.at + e.out * .5 : mid;
    if (lvl === 0 && court && px > court.x && px < court.x + court.w && py > court.y && py < court.y + court.h && /^(sejour|salon|sam|tv|lounge|resto|bar|semi|hall)$/.test(k) && len >= 2) s = { w: Math.min(3.6, len * .6), sill: 0, head: 2.4, baie: 1, terr: 1 };
    if (!s) continue;
    // évite les portes posées sur le même mur
    const ds = doors.filter(d => d.o === e.o && Math.abs((d.o === "h" ? d.y : d.x) - e.at) < E && d.c > e.a0 - d.w && d.c < e.a1 + d.w).map(d => [d.c - d.w / 2 - .3, d.c + d.w / 2 + .3]).sort((a, b) => a[0] - b[0]);
    let a = e.a0 + .3, best = null; const ivs = []; for (const [c0, c1] of [...ds, [e.a1 - .3, e.a1]]) { if (c0 - a > .5) ivs.push([a, c0]); if (c0 - a > (best ? best[1] - best[0] : 0)) best = [a, c0]; a = Math.max(a, c1); }
    if (s.vit && ds.length) { for (const [x0, x1] of ivs) if (x1 - x0 >= .8) wins.push({ o: e.o, at: e.at, c: (x0 + x1) / 2, w: Math.floor((x1 - x0) * 10) / 10, sill: s.sill, head: s.head, k, baie: s.sill === 0, out: e.out, vit: 1 }); continue; }
    if (!best) continue; const free = best[1] - best[0]; let w = Math.min(s.w, free); if (w < .55) continue;
    if (!s.vit) { const L = s.sill === 0 ? STDB : STDW, f = L.filter(x => x <= w + E); w = f.length ? f[f.length - 1] : 0; if (!w) continue; } else w = Math.floor(w * 10) / 10;
    const c = ds.length ? (best[0] + best[1]) / 2 : Math.min(best[1] - w / 2, Math.max(best[0] + w / 2, (e.a0 + e.a1) / 2));
    wins.push({ o: e.o, at: e.at, c, w, sill: s.sill, head: s.head, k, baie: s.sill === 0, out: e.out, vit: s.vit ? 1 : 0, terr: s.terr ? 1 : 0 }); } });
  return { doors, wins };
}
