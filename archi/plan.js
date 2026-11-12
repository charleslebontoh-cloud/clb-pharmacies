// ARCHÉA — générateur de plans (programme → zonage → plan coté)
export const LEVEL_H = 3.0, WALL_H = 2.8, T_EXT = .2, T_INT = .1, CORR = 1.2;

// ---------- Programme ----------
export function buildProgram(p) {
  const R = [], add = (k, n, a, o = {}) => R.push(Object.assign({ k, n, a }, o));
  const ch = Math.max(1, p.ch | 0), sdb = Math.max(1, p.sdb | 0), duplex = p.levels === 2;
  add("sejour", "Séjour", 22 + 3 * ch, { strip: "f", hab: 1 });
  if (p.open) add("cuisine", "Cuisine ouverte", 13, { strip: "f", hab: 1, wet: 1 });
  else { add("sam", "Salle à manger", 11 + ch, { strip: "f", hab: 1 }); add("cuisine", "Cuisine", 10, { strip: "b", hab: 1, wet: 1 }); }
  if (p.salon) add("salon", "Salon VIP", 18, { strip: "f", hab: 1 });
  if (p.bureau) add("bureau", "Bureau", 10, { strip: "f", hab: 1 });
  add("wc", p.wcv ? "WC" : "WC", 2, { strip: "c", wet: 1 });
  if (p.wcv) add("wcv", "WC visiteurs", 2, { strip: "c", wet: 1 });
  if (p.cellier) add("cellier", "Cellier", 4, { strip: "b", minW: 1.5 });
  if (p.jeux) add("jeux", "Salle de jeux / sport", 14, { strip: "b", hab: 1 });
  if (p.buanderie) { add("buand", "Buanderie", 5, { strip: "b", col: "serv", wet: 1 }); add("mag", "Magasin", 3.5, { strip: "b", col: "serv", acc: "buand" }); }
  if (p.domestique) { add("chdom", "Ch. domestique", 9, { strip: "b", col: "dom", hab: 1 }); add("dch", "Douche", 3, { minW: 1.4, strip: "b", col: "dom", acc: "chdom", wet: 1 }); }
  // nuit
  const lvlN = duplex ? 1 : 0;
  add("chp", "Ch. parentale", 15, { strip: "b", hab: 1, lvl: lvlN, night: 1 });
  add("sdbp", "SdB parentale", 6, { minW: 1.8, strip: "b", col: "suite", acc: "chp", wet: 1, lvl: lvlN, night: 1 });
  add("dress", "Dressing", 4, { minW: 1.3, strip: "b", col: "suite", acc: "chp", lvl: lvlN, night: 1 });
  const guest = duplex && (ch >= 3 || (p.chRdc && ch >= 2));
  const ens = sdb >= ch && ch > 1; // chambres autonomes : chaque chambre a sa salle d'eau
  for (let i = 2; i <= ch; i++) { const g = guest && i === ch, lv = g ? 0 : lvlN;
    if (ens) { add("ch", g ? "Ch. d'amis" : "Chambre " + i, 12, { id: "ch" + i, strip: "b", col: "e" + i, hab: 1, lvl: lv, night: 1 }); add("sdb", "Salle d'eau ch." + (g ? " d'amis" : " " + i), 4.5, { minW: 1.7, strip: "b", col: "e" + i, acc: "ch" + i, wet: 1, lvl: lv, night: 1 }); }
    else add("ch", g ? "Ch. d'amis" : "Chambre " + i, 12, { strip: (duplex && i % 2 === 0 && !g) ? "f" : "b", hab: 1, lvl: lv, night: 1 }); }
  for (let i = ens ? ch + 1 : 2; i <= sdb; i++) { const g = !ens && guest && sdb >= 3 && i === sdb; add("sdb", ens ? "Salle d'eau commune" : g ? "Salle d'eau RDC" : (sdb > 2 ? "Salle d'eau " + (i - 1) : "Salle d'eau"), 5, { strip: "b", wet: 1, lvl: g ? 0 : lvlN, night: 1, minW: 1.9 }); }
  if (duplex) { add("esc", "Escalier", 9, { strip: "b", lvl: 0, minW: 2.6, stair: 1 }); add("esc", "Escalier", 9, { strip: "b", lvl: 1, minW: 2.6, stair: 1 }); }
  R.forEach(r => { if (r.lvl === undefined) r.lvl = 0; });
  // ajuste à la surface demandée (pièces de vie seulement)
  const fixed = R.filter(r => !r.hab).reduce((s, r) => s + r.a, 0), hab = R.filter(r => r.hab).reduce((s, r) => s + r.a, 0);
  const levels = duplex ? 2 : 1, corr = levels * 1.0 * Math.sqrt(p.S / levels) * CORR * .9;
  let k = (p.S - fixed - corr) / hab; const warn = [];
  if (k < .8) { warn.push(`La surface de ${p.S} m² est juste pour ce programme : pièces réduites au minimum (il faudrait environ ${Math.round((fixed + corr + hab * .8))} m²).`); k = .8; }
  if (k > 2) { k = 2; warn.push("Surface très généreuse pour ce programme : ajoute des pièces (bureau, chambres…) pour mieux l'exploiter."); }
  R.forEach(r => { if (r.hab) r.a *= k; r.a = Math.round(r.a * 10) / 10; });
  return { rooms: R, warn, levels };
}

// ---------- Composition d'un niveau ----------
function columns(rooms, order) {
  const cols = [], seen = new Set();
  for (const r of order(rooms)) { if (seen.has(r)) continue;
    if (r.col) { const g = rooms.filter(x => x.col === r.col); g.forEach(x => seen.add(x)); cols.push(g); }
    else { seen.add(r); cols.push([r]); } }
  return cols;
}
function orderBack(rs, lvl, duplex) {
  const pick = f => rs.filter(f);
  const night = [], chp = pick(r => r.k === "chp"), suite = pick(r => r.col === "suite"), chs = pick(r => r.k === "ch"), sdbs = pick(r => r.k === "sdb" && !r.acc);
  night.push(...chp, ...suite);
  chs.forEach((c, i) => { night.push(c); if (sdbs[i]) night.push(sdbs[i]); });
  sdbs.slice(chs.length).forEach(s => night.push(s));
  const dom = pick(r => r.col === "dom"), serv = pick(r => r.col === "serv"), cui = pick(r => r.k === "cuisine"), esc = pick(r => r.stair);
  const L = duplex === "B" ? [...cui, ...serv, ...dom, ...esc, ...night.reverse()] : [...night, ...dom, ...serv, ...cui, ...esc];
  const rest = rs.filter(r => !L.includes(r) && !(r.col && L.some(x => x.col === r.col))); return duplex === "B" ? [...rest, ...L] : [...L.slice(0, night.length), ...rest, ...L.slice(night.length)];
}
function orderFront(rs, B) { const o = B ? ["sejour", "sam", "cuisine", "bureau", "tv", "rgt", "ch", "sdb"] : ["ch", "sdb", "bureau", "tv", "rgt", "sejour", "sam", "cuisine"]; const ix = k => { const i = o.indexOf(k); return i < 0 ? 2.5 : i; }; return rs.slice().sort((a, b) => ix(a.k) - ix(b.k)); }

function fillStrip(cols, x0, y0, W, d, rev) {
  if (d < 4.5) cols = cols.flatMap(g => g.length > 1 ? g.map(r => [r]) : [g]); // bande peu profonde : pièces côte à côte
  const nat = cols.map(g => { const a = g.reduce((s, r) => s + r.a, 0); let w = a / d; const mw = Math.max(...g.map(r => r.minW || 0)); const fix = mw > w; if (fix) w = mw; return { g, w, fix }; });
  const fixedW = nat.filter(c => c.fix).reduce((s, c) => s + c.w, 0), flexW = nat.filter(c => !c.fix).reduce((s, c) => s + c.w, 0);
  const k = flexW > 0 ? Math.max(.3, (W - fixedW) / flexW) : 1;
  let x = x0; const out = [];
  nat.forEach((c, i) => { let w = c.fix ? c.w : c.w * k; if (i === nat.length - 1) w = x0 + W - x;
    const g = rev ? c.g.slice().reverse() : c.g; c.g = g;
    const tot = g.reduce((s, r) => s + r.a, 0); let y = y0;
    const hs = g.map(r => d * r.a / tot); if (g.length > 1) { let mi = g.findIndex(r => r.hab); if (mi < 0) mi = 0; let o = 0; hs.forEach((v, j) => { if (j !== mi) { hs[j] = Math.min(Math.max(v, 1.6), (d - 2.6) / (g.length - 1)); o += hs[j]; } }); hs[mi] = d - o; }
    c.g.forEach((r, j) => { const h = j === c.g.length - 1 ? y0 + d - y : hs[j]; out.push(Object.assign({}, r, { x, y, w, h })); y += h; });
    x += w; });
  return out;
}

// ---------- Plan complet ----------
// 12 variantes : 3 proportions × miroir × 2 organisations (couloir parallèle A / perpendiculaire B à la rue) ; 12 = automatique
export const VARIANTS = Array.from({ length: 12 }, (_, i) => variantSpec(i));
export function variantSpec(v) { v = v | 0; if (v < 0 || v > 11) return { mode: "auto", mirror: 0, prop: 0, name: "Auto" };
  const prop = v % 3, mirror = (v / 3 | 0) % 2, mode = v >= 6 ? "B" : "A";
  return { mode, mirror, prop, name: (mode === "A" ? "Couloir parallèle" : "Plan en longueur") + " · " + ["standard", "compact", "allongé"][prop] + (mirror ? " · inversé" : "") }; }
export function generate(p, variant = 0) {
  const prog = buildProgram(p), duplex = prog.levels === 2, warn = prog.warn.slice();
  const lv = [0, 1].slice(0, prog.levels).map(l => prog.rooms.filter(r => r.lvl === l));
  // équilibre les deux bandes en déplaçant des chambres (profondeurs voisines)
  lv.forEach(rs => { const sum = s => rs.filter(r => r.strip === s).reduce((t, r) => t + r.a, 0);
    for (let i = 0; i < 6; i++) { const af = sum("f"), ab = sum("b");
      const mv = (from, to) => { const c = rs.filter(r => r.k === "ch" && r.strip === from).pop(); if (!c) return 0; rs.filter(r => r === c || (c.col && r.col === c.col)).forEach(r => r.strip = to); return 1; };
      if (ab > af * 1.35) { if (!mv("b", "f")) break; }
      else if (af > ab * 1.35) { if (!mv("f", "b")) break; }
      else break; } });
  // gabarit commun : largeur selon le niveau le plus chargé
  const area = lv.map(rs => rs.filter(r => r.strip !== "c").reduce((s, r) => s + r.a, 0));
  const Amax = Math.max(...area);
  const setS = p.recul || 3, setF = p.reculAv || 5;
  const maxW = Math.max(6, p.L - 2 * setS), maxD = Math.max(6, p.P - setF - setS);
  const V = variantSpec(variant), vf = [1, 1.15, .87][V.prop];
  let d = (-3.6 + Math.sqrt(12.96 + 24 * Amax)) / 12 * vf; d = Math.min(Math.max(d, 3.8), 5.6);
  let W = Amax / (2 * d), mode = "A";
  // terrain étroit : couloir perpendiculaire à la rue (plan « en longueur »)
  if (V.mode === "B") { mode = "B"; d = Math.max(3.4, Math.min(d, (maxW - CORR) / 2)); W = Amax / (2 * d); }
  else if (V.mode === "A") { if (W > maxW) { W = maxW; d = Amax / (2 * W); } }
  else if (W > maxW * 1.02) { const dB = Math.min(d, (maxW - CORR) / 2); if (dB >= 3.4) { mode = "B"; d = dB; W = Amax / (2 * d); } else { W = maxW; d = Amax / (2 * W); } }
  let D = 2 * d + CORR;
  const [lenX, lenY] = mode === "B" ? [D, W] : [W, D];
  if (lenY > maxD + .05 || lenX > maxW + .05) warn.push(`Le bâtiment (${lenX.toFixed(1)} × ${lenY.toFixed(1)} m) dépasse la zone constructible du terrain (reculs 5 m devant, 3 m sur les côtés et au fond) : passe en duplex ou agrandis le terrain.`);
  W = Math.round(W * 10) / 10; D = Math.round(D * 10) / 10;
  const levels = lv.map((rs, l) => {
    const F = rs.filter(r => r.strip === "f"), B = rs.filter(r => r.strip === "b"), C = rs.filter(r => r.strip === "c");
    const aF = F.reduce((s, r) => s + r.a, 0), aB = B.reduce((s, r) => s + r.a, 0);
    let df = (D - CORR) * aF / (aF + aB); df = Math.min(Math.max(df, 3.6), D - CORR - 3.4); const db = D - CORR - df;
    const natW = (rs, dd) => columns(rs, x => x).reduce((s, g) => s + Math.max(g.reduce((t, r) => t + r.a, 0) / dd, Math.max(0, ...g.map(r => r.minW || 0))), 0);
    for (const [S, dd, nm] of [[F, df, "f"], [B, db, "b"]]) { const left = W - natW(S, dd);
      if (S.length && left >= 2.6) S.push({ k: "tv", n: l === 0 ? "Salon TV" : "Salon d'étage", a: left * dd, strip: nm, hab: 1, lvl: l });
      else if (S.length && left >= 1.4) S.push({ k: "rgt", n: "Rangement", a: left * dd, strip: nm, lvl: l }); }
    let rooms = [...fillStrip(columns(F, x => orderFront(x, mode === "B")), 0, 0, W, df, true), ...fillStrip(columns(B, x => orderBack(x, l, mode === "B" ? "B" : duplex)), 0, df + CORR, W, db)];
    // couloir + WC en bout
    let cx = 0, cw = W; const wcs = C.map(r => { const w = 1.5; cw -= w; if (r.k === "wcv") { const o = Object.assign({}, r, { x: cx, y: df, w, h: CORR }); cx += w; return o; } return Object.assign({}, r, { x: cx + cw, y: df, w, h: CORR }); });
    const stair = rooms.find(r => r.stair);
    rooms.push({ k: "couloir", n: l === 1 ? "Palier / dégagement" : "Dégagement", x: cx, y: df, w: cw, h: CORR, circ: 1 }, ...wcs);
    rooms.forEach(r => { r.lvl = l; r.a = Math.round(r.w * r.h * 10) / 10; });
    const op = openings(rooms, W, D, l, p, mode);
    if (mode === "B") { rooms.forEach(r => { [r.x, r.y, r.w, r.h] = [r.y, r.x, r.h, r.w]; });
      op.doors.forEach(o => { if (o.o === "h") { o.o = "v"; o.x = o.y; delete o.y; } else { o.o = "h"; o.y = o.x; delete o.x; } });
      op.wins.forEach(w => w.o = w.o === "h" ? "v" : "h"); }
    const PW = mode === "B" ? D : W;
    if (V.mirror) { rooms.forEach(r => r.x = PW - r.x - r.w);
      op.doors.forEach(o => { if (o.o === "v") o.x = PW - o.x; else o.c = PW - o.c; }); op.wins.forEach(w => { if (w.o === "v") w.at = PW - w.at; else w.c = PW - w.c; }); }
    return { l, rooms, ...op, name: l === 0 ? (duplex ? "Rez-de-chaussée" : "Plain-pied") : "Étage" };
  });
  if (mode === "B") [W, D] = [D, W];
  const hab = levels.flatMap(L => L.rooms).filter(r => !r.circ && !r.stair).reduce((s, r) => s + r.a, 0);
  const emprise = W * D, ces = emprise / (p.L * p.P);
  if (ces > .6) warn.push(`Emprise au sol de ${Math.round(ces * 100)} % : au-delà de 60 %, la parcelle devient peu perméable et mal ventilée.`);
  return { p, W, D, levels, hab: Math.round(hab), emprise: Math.round(emprise), shon: Math.round(emprise * prog.levels), ces, warn, variant, duplex,
    mode, site: { L: p.L, P: p.P, ox: (p.L - W) / 2, oy: setF } };
}

// ---------- Ouvertures ----------
const near = (a, b) => Math.abs(a - b) < 1e-3;
function openings(rooms, W, D, lvl, p, mode) {
  const doors = [], wins = [];
  const corr = rooms.find(r => r.k === "couloir"), by = k => rooms.find(r => r.id === k) || rooms.find(r => r.k === k);
  const hor = (x0, x1, y) => ({ x0, x1, y }), ver = (y0, y1, x) => ({ y0, y1, x });
  for (const r of rooms) {
    if (r.circ) continue;
    // accès
    const nd = doors.length;
    if (r.acc) { const h = by(r.acc); if (h) {
        if (near(h.x + h.w, r.x) || near(r.x + r.w, h.x)) { const x = near(h.x + h.w, r.x) ? r.x : r.x + r.w; const y0 = Math.max(r.y, h.y), y1 = Math.min(r.y + r.h, h.y + h.h); doors.push({ o: "v", x, c: (y0 + y1) / 2, w: .7, into: r.k, ir: rooms.indexOf(r) }); }
        else if (near(h.y + h.h, r.y) || near(r.y + r.h, h.y)) { const y = near(h.y + h.h, r.y) ? r.y : r.y + r.h; const x0 = Math.max(r.x, h.x), x1 = Math.min(r.x + r.w, h.x + h.w); doors.push({ o: "h", y, c: (x0 + x1) / 2, w: .7, into: r.k, ir: rooms.indexOf(r) }); }
      } }
    if (r.acc && doors.length > nd) { }
    else if (r.k === "wc" || r.k === "wcv") doors.push({ o: "v", x: near(r.x, 0) ? r.x + r.w : r.x, c: r.y + r.h / 2, w: .7, into: r.k, ir: rooms.indexOf(r) });
    else if (corr && (near(r.y + r.h, corr.y) || near(r.y, corr.y + corr.h))) {
      const y = near(r.y + r.h, corr.y) ? corr.y : corr.y + corr.h;
      const x0 = Math.max(r.x, corr.x), x1 = Math.min(r.x + r.w, corr.x + corr.w);
      if (x1 - x0 > .8) { const open = r.k === "sejour" || r.k === "sam" || (r.k === "cuisine" && p.open) || r.stair;
        const w = open ? Math.min(2.2, x1 - x0 - .3) : .83; const c = open ? (x0 + x1) / 2 : (r.strip === "b" ? x0 + .6 : x1 - .6);
        doors.push({ o: "h", y, c, w, into: r.k, ir: rooms.indexOf(r), open }); }
    }
    // porte d'entrée et de service (rdc)
    if (lvl === 0 && r.k === "sejour") doors.push(mode === "B" ? { o: "v", x: 0, c: r.y + Math.min(1.4, r.h / 4), w: 1.0, into: r.k, ir: rooms.indexOf(r), ext: 1, main: 1 } : { o: "h", y: 0, c: r.x + Math.min(1.4, r.w / 4), w: 1.0, into: r.k, ir: rooms.indexOf(r), ext: 1, main: 1 });
    if (lvl === 0 && (r.k === "buand" || (r.k === "cuisine" && !p.buanderie)) && near(r.y + r.h, D)) doors.push({ o: "h", y: D, c: r.x + r.w / 2, w: .9, into: r.k, ir: rooms.indexOf(r), ext: 1 });
    // fenêtres sur façades
    const exts = [];
    if (near(r.y, 0)) exts.push(["h", 0, r.x, r.x + r.w]);
    if (near(r.y + r.h, D)) exts.push(["h", D, r.x, r.x + r.w]);
    if (near(r.x, 0)) exts.push(["v", 0, r.y, r.y + r.h]);
    if (near(r.x + r.w, W)) exts.push(["v", W, r.y, r.y + r.h]);
    for (const [o, at, a0, a1] of exts) {
      const len = a1 - a0; if (len < 1) continue;
      let w = r.wet ? .6 : r.k === "sejour" ? Math.min(3.2, len * .55) : r.stair ? .8 : Math.min(1.6, Math.max(1, len * .45)), sill = r.wet ? 1.6 : (r.k === "sejour" && at === 0 && o === (mode === "B" ? "v" : "h")) ? 0 : .9;
      let head = 2.2; const B = +p.baies || 0, liv = /sejour|sam|salon|tv|jeux/.test(r.k), night = /chp|^ch$|bureau/.test(r.k);
      if (B && liv) { w = B === 2 ? Math.max(1.2, len - .8) : Math.min(4.2, len * .7); sill = 0; head = B === 2 ? 2.6 : 2.4; }
      else if (B && night) { w = B === 2 ? Math.min(2.6, len * .6) : Math.min(2.0, len * .5); sill = B === 2 ? 0 : .5; head = B === 2 ? 2.6 : 2.4; }
      if (r.k === "dress" || r.k === "mag") { w = .6; sill = 1.6; head = 2.2; }
      // dimensions normalisées des menuiseries (fabrication)
      { const STD = sill === 0 ? [1.2, 1.5, 1.8, 2.1, 2.4, 3.0, 3.6, 4.2, 4.8, 5.4] : [.6, .8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.4]; const f = STD.filter(v => v <= w + .001); w = f.length ? f[f.length - 1] : STD[0]; }
      let c = (a0 + a1) / 2;
      const md = doors.find(d => d.main && d.o === o && near(d.o === "h" ? d.y : d.x, at) && d.c > a0 && d.c < a1);
      if (md) { const free = a1 - (md.c + md.w / 2 + .4) - .3; if (free < 1) continue; w = Math.min(w, free); c = Math.min(a1 - w / 2 - .3, Math.max(md.c + md.w / 2 + .4 + w / 2, c)); }
      wins.push({ o, at, c, w, sill, head, k: r.k, baie: sill === 0 });
    }
  }
  return { doors, wins };
}

// ---------- Mobilier (repère pièce, en m) ----------
// ---------- Disposition du mobilier (ergonomie) ----------
// Chaque meuble est posé contre un mur ou en îlot, en évitant portes (débattement 0,9 m), baies basses et circulations.
// rot : orientation du dos du meuble (0 = dos vers +y/nord, 90 = vers -x, 180 = vers -y, 270 = vers +x). iw/id = largeur/profondeur propres.
const TALL = new Set(["armoire", "biblio", "frigo", "colonne"]);
export function furniture(r, L) {
  const W = r.w, H = r.h, F = [], occ = [], E = 1e-3;
  const doors = [], wins = [];
  if (L) {
    for (const d of L.doors) { if (d.o === "h" && (Math.abs(d.y - r.y) < E || Math.abs(d.y - r.y - H) < E) && d.c > r.x && d.c < r.x + W) doors.push({ s: Math.abs(d.y - r.y) < E ? "S" : "N", u: d.c - r.x, w: d.w });
      if (d.o === "v" && (Math.abs(d.x - r.x) < E || Math.abs(d.x - r.x - W) < E) && d.c > r.y && d.c < r.y + H) doors.push({ s: Math.abs(d.x - r.x) < E ? "W" : "E", u: d.c - r.y, w: d.w }); }
    for (const w of L.wins) { if (w.o === "h" && (Math.abs(w.at - r.y) < E || Math.abs(w.at - r.y - H) < E) && w.c > r.x && w.c < r.x + W) wins.push({ s: Math.abs(w.at - r.y) < E ? "S" : "N", u: w.c - r.x, w: w.w, sill: w.sill });
      if (w.o === "v" && (Math.abs(w.at - r.x) < E || Math.abs(w.at - r.x - W) < E) && w.c > r.y && w.c < r.y + H) wins.push({ s: Math.abs(w.at - r.x) < E ? "W" : "E", u: w.c - r.y, w: w.w, sill: w.sill }); }
  }
  const len = s => s === "N" || s === "S" ? W : H, dep = s => s === "N" || s === "S" ? H : W;
  // zones de débattement des portes
  for (const d of doors) { const a = d.u - d.w / 2 - .1, b = d.u + d.w / 2 + .1, c = Math.min(.95, dep(d.s) * .45), st = d.s === "S" || d.s === "W" ? len(d.s) - b : a; occ.push(rect(d.s, st, b - a, c)); }
  function rect(s, u, w, d) { // rectangle local d'un objet de largeur w, profondeur d, posé contre le mur s à l'abscisse u
    if (s === "N") return { x: u, y: H - d, w, h: d, rot: 0 }; if (s === "S") return { x: W - u - w, y: 0, w, h: d, rot: 180 };
    if (s === "W") return { x: 0, y: H - u - w, w: d, h: w, rot: 90 }; return { x: W - d, y: u, w: d, h: w, rot: 270 }; }
  // abscisse le long du mur : N et E vont dans le sens +x/+y ; S et W dans le sens inverse (rect() gère l'inversion)
  const uOf = (s, a) => s === "S" || s === "W" ? len(s) - a : a; // a = position absolue le long de l'axe
  const hit = (q, m = 0) => occ.some(o => q.x < o.x + o.w - m && q.x + q.w > o.x + m && q.y < o.y + o.h - m && q.y + q.h > o.y + m);
  const inside = q => q.x >= -E && q.y >= -E && q.x + q.w <= W + E && q.y + q.h <= H + E;
  const blocked = (s, u, w, tall, noWin) => { for (const d of doors) if (d.s === s) { const du = uOf(s, d.u); if (u < du + d.w / 2 + .1 && u + w > du - d.w / 2 - .1) return true; }
    for (const x of wins) if (x.s === s) { const xu = uOf(s, x.u); if (u < xu + x.w / 2 && u + w > xu - x.w / 2 && (x.sill < .3 || (tall && x.sill < 2) || (noWin && x.sill < 1.2))) return true; } return false; };
  function put(t, s, w, d, o = {}) { // contre le mur s
    const Lw = len(s); if (w > Lw - .02 || d > dep(s) - .45) { if (!o.shrink) return null; w = Math.min(w, Lw - .1); if (w < o.shrink) return null; }
    const cand = []; const step = .05, mn = o.m ?? .05;
    for (let u = mn; u <= Lw - w - mn + E; u += step) cand.push(u);
    const pref = o.at === "start" ? 0 : o.at === "end" ? 1 : .5; cand.sort((a, b) => Math.abs(a / Math.max(E, Lw - w) - pref) - Math.abs(b / Math.max(E, Lw - w) - pref));
    for (const u of cand) { if (blocked(s, u, w, TALL.has(t) || o.tall, o.noWin)) continue; const q = rect(s, u, w, d); if (hit(q) || !inside(q)) continue; return add(t, q, w, d, o.pad); }
    return null; }
  function free(t, x, y, w, d, rot = 0, pad = 0) { const sw = rot % 180 ? d : w, sh = rot % 180 ? w : d, q = { x, y, w: sw, h: sh, rot }; if (!inside(q) || hit(q)) return null; return add(t, q, w, d, pad); }
  function add(t, q, iw, id, pad = 0) { F.push({ t, x: r.x + q.x, y: r.y + q.y, w: q.w, h: q.h, rot: q.rot, iw, id }); occ.push({ x: q.x - pad, y: q.y - pad, w: q.w + 2 * pad, h: q.h + 2 * pad }); return q; }
  const sides = ["N", "S", "W", "E"], doorOn = s => doors.some(d => d.s === s), winOn = s => wins.some(x => x.s === s), lowWin = s => wins.some(x => x.s === s && x.sill < 1);
  const opp = { N: "S", S: "N", W: "E", E: "W" }, mainDoor = doors[0] ? doors[0].s : "S";
  const rank = (f) => sides.slice().sort((a, b) => f(b) - f(a));
  const k = r.k;
  if (/^(chp|ch|chdom)$/.test(k)) {
    const bw = k === "chdom" ? .9 : k === "chp" ? (W > 3.4 && H > 3.4 ? 1.8 : 1.6) : (Math.min(W, H) > 3 ? 1.6 : 1.4), bl = 2.05;
    let bedQ = null;
    for (const [bwx, nw] of [[bw, true], [Math.min(bw, 1.4), true], [bw, false], [Math.min(bw, 1.4), false], [1.2, false], [.9, false]]) {
      for (const s of rank(s => (!winOn(s) ? 3 : 0) + (!doorOn(s) ? 2 : 0) + (dep(s) >= bl + .8 ? 2 : -5) + (len(s) >= bwx + 1.1 ? 1 : 0) + (s === opp[mainDoor] ? .5 : 0))) {
        if (dep(s) < bl + .55) continue; const q = put("lit", s, bwx, bl, { noWin: nw }); if (!q) continue; bedQ = q;
        const along = s === "N" || s === "S"; const cx = along ? q.x : q.y, L2 = along ? q.w : q.h;
        for (const sd of [-1, 1]) { const u0 = sd < 0 ? cx - .5 : cx + L2 + .05; if (u0 < 0 || u0 + .45 > len(s)) continue; const qq = s === "N" ? { x: u0, y: H - .4 } : s === "S" ? { x: u0, y: 0 } : s === "W" ? { x: 0, y: u0 } : { x: W - .4, y: u0 };
          free("chevet", qq.x, qq.y, .45, .4, q.rot); }
        break; }
      if (bedQ) break; }
    const aw = k === "chdom" ? 1 : k === "chp" ? 2.2 : 1.6;
    for (const s of rank(s => (!winOn(s) ? 2 : 0) + (!doorOn(s) ? 1 : 0) + len(s) / 4)) if (put("armoire", s, aw, .6, { shrink: 1, at: "end" })) break;
    if (k !== "chdom" && W * H > 11) for (const s of rank(s => (lowWin(s) ? 0 : winOn(s) ? 2 : 0))) if (put(k === "chp" ? "coiffeuse" : "bureau_t", s, 1.1, .55, { at: "start" })) break;
    if (k === "chp" && W * H > 15) put("fauteuil", rank(s => winOn(s) ? 2 : 0)[0], .8, .8, { at: "end" });
  }
  else if (k === "sejour" || k === "tv" || k === "salon") {
    const tvS = rank(s => (!doorOn(s) ? 3 : 0) + (!lowWin(s) ? 3 : 0) + (dep(s) >= 3.2 ? 2 : 0) + len(s) / 10)[0];
    if (k !== "salon") put("meuble_tv", tvS, Math.min(2, len(tvS) - .4), .45, { noWin: false });
    const D0 = dep(tvS), L0 = len(tvS), dist = Math.min(3.1, D0 - 1.05), sofaL = Math.min(k === "salon" ? 2.8 : 2.6, L0 - 1.2);
    // canapé face au mur TV, centré, dos vers le mur opposé
    const along = tvS === "N" || tvS === "S"; let placed = null;
    for (const off of [0, -.5, .5, -1, 1]) { const u = (L0 - sofaL) / 2 + off; if (u < .05) continue;
      const pos = tvS === "N" ? { x: u, y: H - .45 - dist - .9, rot: 180 } : tvS === "S" ? { x: W - u - sofaL, y: .45 + dist, rot: 0 } : tvS === "W" ? { x: .45 + dist, y: H - u - sofaL, rot: 270 } : { x: W - .45 - dist - .9, y: u, rot: 90 };
      placed = free("canape", pos.x, pos.y, sofaL, .9, pos.rot); if (placed) break; }
    if (!placed) placed = put("canape", opp[tvS], sofaL, .9, {}) || rank(s => (!lowWin(s) ? 2 : 0) + (!doorOn(s) ? 1 : 0) + len(s) / 5).reduce((q, s) => q || put("canape", s, Math.min(sofaL, len(s) - .6), .9, { shrink: 1.6 }), null);
    if (!placed || k === "salon") { free("table_basse", W / 2 - .55, H / 2 - .3, 1.1, .6, 0); for (const s of rank(s => !doorOn(s) && !lowWin(s) ? 1 : 0)) if (s !== tvS && put("fauteuil", s, .8, .8, { at: "start" })) break; for (const s of rank(s => !doorOn(s) ? 1 : 0)) if (s !== tvS && put("fauteuil", s, .8, .8, { at: "end" })) break; }
    if (placed && k !== "salon") { // table basse entre canapé et TV, fauteuils latéraux
      const cxm = placed.x + placed.w / 2, cym = placed.y + placed.h / 2, tb = 1.1, gap = .45;
      if (along) { const ty = tvS === "N" ? placed.y + placed.h + gap : placed.y - gap - .6; free("table_basse", cxm - tb / 2, ty, tb, .6, 0); free("tapis", cxm - 1.3, Math.min(ty, placed.y) - .1, 2.6, Math.abs(ty - placed.y) + .9, 0); 
        for (const sd of [-1, 1]) free("fauteuil", sd < 0 ? placed.x - .95 : placed.x + placed.w + .15, (ty + cym) / 2 - .4, .8, .8, sd < 0 ? 90 : 270); }
      else { const tx = tvS === "E" ? placed.x + placed.w + gap : placed.x - gap - .6; free("table_basse", tx, cym - tb / 2, tb, .6, 90);
        for (const sd of [-1, 1]) free("fauteuil", (tx + cxm) / 2 - .4, sd < 0 ? placed.y - .95 : placed.y + placed.h + .15, .8, .8, sd < 0 ? 0 : 180); } }
    if (k === "sejour") for (const s of rank(s => !lowWin(s) && !doorOn(s) ? 2 : 0)) if (s !== tvS && put("plante", s, .5, .5, { at: "start" })) break;
  }
  else if (k === "sam") {
    const lg = W >= H, A = lg ? W : H, B = lg ? H : W, tl = A > 4.2 && B > 3.2 ? 2 : A > 3.4 ? 1.6 : 1.2, tw = tl > 1.6 ? 1 : .85;
    free("table", lg ? (W - tl) / 2 : (W - tw) / 2, lg ? (H - tw) / 2 : (H - tl) / 2, tl, tw, lg ? 0 : 90);
    for (const s of rank(s => (!lowWin(s) ? 2 : 0) + (!doorOn(s) ? 1 : 0))) if (put("buffet", s, Math.min(1.8, len(s) * .5), .45, {})) break;
  }
  else if (k === "cuisine") {
    // plan de travail en L sur deux murs adjacents sans porte, évier sous fenêtre si possible
    const pairs = [["N", "E"], ["N", "W"], ["S", "E"], ["S", "W"], ["E", "N"], ["W", "N"], ["E", "S"], ["W", "S"]];
    pairs.sort((a, b) => ((doorOn(b[0]) ? 0 : 2) + (doorOn(b[1]) ? 0 : 1) + (winOn(b[0]) ? .5 : 0)) - ((doorOn(a[0]) ? 0 : 2) + (doorOn(a[1]) ? 0 : 1) + (winOn(a[0]) ? .5 : 0)));
    let done = false;
    for (const [s1, s2] of pairs) { const L1 = len(s1) - .1; const q1 = put("plan", s1, Math.min(L1, 3.6), .62, { shrink: 1.4, at: s2 === "E" || s2 === "N" ? "end" : "start", m: .03 }); if (!q1) continue;
      put("frigo", s2, .7, .68, { at: "start" }) || put("frigo", s1 === "N" ? "S" : opp[s2], .7, .68, {});
      put("plan", s2, Math.min(len(s2) - 1.6, 2.2), .62, { shrink: 1, at: s1 === "N" || s1 === "E" ? "end" : "start" }); done = true; break; }
    if (!done) put("plan", rank(s => len(s))[0], len(rank(s => len(s))[0]) - .2, .62, { shrink: 1 });
    if (r.strip === "f" && W > 3.4 && H > 3.4) free("ilot", W / 2 - .9, H / 2 - .45, 1.8, .9, W > H ? 0 : 90);
  }
  else if (/^(sdbp|sdb|dch)$/.test(k)) {
    // douche dans l'angle le plus éloigné de la porte, vasque et WC sur les murs libres
    const far = opp[mainDoor]; const cs = far === "N" || far === "S" ? ["E", "W"] : ["N", "S"];
    put("douche", far, Math.min(1.2, len(far) * .45), Math.min(.9, dep(far) * .45), { at: "end", m: 0 }) || put("douche", far, .8, .8, { at: "start", m: 0 });
    if (k !== "dch") { for (const s of [cs[0], cs[1], far, mainDoor]) if (put("vasque", s, Math.min(k === "sdbp" ? 1.4 : 1, len(s) - .5), .5, { at: "center" })) break;
      for (const s of [cs[1], cs[0], far, mainDoor]) if (put("wc_cuv", s, .4, .65, { at: "end" })) break; }
  }
  else if (k === "wc" || k === "wcv") { put("wc_cuv", opp[mainDoor], .4, .65, {}) || put("wc_cuv", rank(s => doorOn(s) ? 0 : 1)[0], .4, .65, {}); for (const s of sides) if (put("lave_mains", s, .4, .25, { at: "start" })) break; }
  else if (k === "bureau") { const s = rank(s => (winOn(s) && !lowWin(s) ? 2 : 0) + (!doorOn(s) ? 1 : 0))[0]; put("bureau_t", s, 1.4, .7, {}); for (const b of rank(s => (!winOn(s) ? 2 : 0) + (!doorOn(s) ? 1 : 0))) if (b !== s && put("biblio", b, Math.min(2, len(b) - .3), .35, { shrink: .8 })) break; }
  else if (k === "jeux") { free("table", W / 2 - .7, H / 2 - .4, 1.4, .8, W > H ? 0 : 90); for (const s of rank(s => !winOn(s) ? 1 : 0)) if (put("biblio", s, Math.min(1.8, len(s) - .3), .35, { shrink: .8 })) break; }
  else if (k === "dress") { for (const s of rank(s => len(s) - (doorOn(s) ? 9 : 0))) put("armoire", s, len(s) - .1, .55, { shrink: .8 }); }
  else if (k === "buand") { const s = rank(s => (!doorOn(s) ? 2 : 0) + len(s))[0]; put("machine", s, .6, .6, { at: "start" }); put("machine", s, .6, .6, { at: "start" }); put("plan", s, Math.min(1.2, len(s) - 1.4), .6, { shrink: .6, at: "end" }); }
  else if (k === "cellier" || k === "mag" || k === "rgt") { for (const s of rank(s => len(s) - (doorOn(s) ? 9 : 0)).slice(0, 2)) put("biblio", s, len(s) - .2, .4, { shrink: .6 }); }
  return F;
}

// ---------- Dessin SVG normalisé (1 unité = 1 cm) ----------
export function svgPlan(plan, l, opt = {}) {
  const L = plan.levels[l], W = plan.W, D = plan.D, S = 100, m = 260;
  const vw = W * S + 2 * m, vh = D * S + 2 * m + 140;
  const X = x => m + x * S, Y = y => m + y * S; // y=0 façade avant (sud) en bas → on inverse
  const Yf = y => m + (D - y) * S;
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" font-family="Helvetica,Arial,sans-serif">`);
  o.push(`<defs><pattern id="hb" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="12" stroke="#2b2b2b" stroke-width="2"/></pattern></defs>`);
  o.push(`<rect width="${vw}" height="${vh}" fill="#fff"/>`);
  // sols
  const floorCol = k => ({ sejour: "#f6efe3", sam: "#f6efe3", cuisine: "#eef3f4", sdbp: "#e9f1f5", sdb: "#e9f1f5", dch: "#e9f1f5", wc: "#e9f1f5", couloir: "#f4f4f2", esc: "#eeeeea" })[k] || "#fbf8f2";
  for (const r of L.rooms) o.push(`<rect x="${X(r.x)}" y="${Yf(r.y + r.h)}" width="${r.w * S}" height="${r.h * S}" fill="${floorCol(r.k)}"/>`);
  // mobilier (trait fin)
  if (opt.furn !== false) for (const r of L.rooms) for (const f of furniture(r, L)) {
    const cx = X(f.x + f.w / 2), cy = Yf(f.y + f.h / 2), w = (f.iw ?? f.w) * S, h = (f.id ?? f.h) * S, x = -w / 2, y = -h / 2, st = `fill="none" stroke="#8a8a85" stroke-width="1.6"`, q = [];
    const R = (a, b, c, d, rx = 2, ex = "") => q.push(`<rect x="${a}" y="${b}" width="${c}" height="${d}" rx="${rx}" ${st} ${ex}/>`), C = (a, b, rr) => q.push(`<circle cx="${a}" cy="${b}" r="${rr}" ${st}/>`), Ln = (a, b, c, d) => q.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" ${st}/>`), El = (a, b, rx, ry) => q.push(`<ellipse cx="${a}" cy="${b}" rx="${rx}" ry="${ry}" ${st}/>`);
    switch (f.t) {
      case "lit": R(x, y, w, h, 6); R(x + 8, y + 8, w / 2 - 12, 34, 8); R(4, y + 8, w / 2 - 12, 34, 8); Ln(x, y + h * .38, x + w, y + h * .38); break;
      case "canape": case "fauteuil": R(x, y, w, h, 8); R(x, y, w, h * .28, 6); R(x, y, 16, h, 6); R(x + w - 16, y, 16, h, 6); break;
      case "armoire": R(x, y, w, h); Ln(x, y + h - 6, x + w, y + h - 6); for (let u = x + 30; u < x + w - 10; u += 40) Ln(u, y + 8, u, y + h - 12); break;
      case "meuble_tv": R(x, y, w, h); R(x + w * .15, y + 2, w * .7, 6, 1); break;
      case "table": { R(x, y, w, h, 4); const n = Math.max(1, Math.floor(w / 62)); for (let i = 0; i < n; i++) { const u = x + w * (i + .5) / n - 20; R(u, y - 46, 40, 38, 4); R(u, y + h + 8, 40, 38, 4); } break; }
      case "plan": R(x, y, w, h); Ln(x, y + h - 8, x + w, y + h - 8); if (w > 160) { R(x + w * .2, y + 10, 70, 42, 6); C(x + w * .62, y + h * .35, 11); C(x + w * .62 + 30, y + h * .35, 11); C(x + w * .62, y + h * .35 + 26, 11); C(x + w * .62 + 30, y + h * .35 + 26, 11); } break;
      case "frigo": R(x, y, w, h); Ln(x, y, x + w, y + h); break;
      case "ilot": R(x, y, w, h, 3); for (let i = 0; i < 3; i++) C(x + w * (i + .5) / 3, y + h + 26, 16); break;
      case "douche": R(x, y, w, h); Ln(x, y, x + w, y + h); Ln(x + w, y, x, y + h); C(0, 0, 6); break;
      case "vasque": R(x, y, w, h, 3); El(0, 4, Math.min(w * .3, 24), h * .28); break;
      case "lave_mains": R(x, y, w, h, 3); El(0, 2, w * .3, h * .3); break;
      case "wc_cuv": R(x, y, w, h * .28, 3); El(0, y + h * .62, w * .42, h * .34); break;
      case "bureau_t": case "coiffeuse": R(x, y, w, h); f.t === "bureau_t" ? R(-24, y + h + 6, 48, 44, 8) : C(0, y + h + 26, 20); break;
      case "biblio": case "buffet": R(x, y, w, h); Ln(x + 4, y + h - 6, x + w - 4, y + h - 6); break;
      case "machine": R(x, y, w, h, 4); C(0, 4, Math.min(w, h) * .3); break;
      case "table_basse": case "chevet": R(x, y, w, h, 3); break;
      case "tapis": R(x, y, w, h, 2, 'stroke-dasharray="8 8"'); break;
      case "plante": C(0, 0, w * .4); C(0, 0, w * .2); break;
      default: R(x, y, w, h);
    }
    o.push(`<g transform="translate(${cx} ${cy}) rotate(${-f.rot || 0})">${q.join("")}</g>`);
  }
  // escalier
  for (const r of L.rooms.filter(r => r.stair)) { const n = 14, x0 = X(r.x + .1), x1 = X(r.x + r.w - .1), y0 = Yf(r.y + r.h - .1), y1 = Yf(r.y + .1), mid = (x0 + x1) / 2;
    for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; o.push(`<line x1="${x0}" y1="${y}" x2="${mid - 6}" y2="${y}" stroke="#555" stroke-width="2"/>`); }
    o.push(`<line x1="${mid}" y1="${y0}" x2="${mid}" y2="${y1}" stroke="#555" stroke-width="2"/><path d="M${(x0 + mid) / 2} ${y1 - 10} l-12 30 h24 z" fill="#555"/>`); }
  // murs (poché) : cloisons puis enveloppe
  const segs = [];
  for (const r of L.rooms) segs.push([r.x, r.y, r.x + r.w, r.y], [r.x, r.y + r.h, r.x + r.w, r.y + r.h], [r.x, r.y, r.x, r.y + r.h], [r.x + r.w, r.y, r.x + r.w, r.y + r.h]);
  for (const s of segs) { const ext = (near(s[1], 0) && near(s[3], 0)) || (near(s[1], D) && near(s[3], D)) || (near(s[0], 0) && near(s[2], 0)) || (near(s[0], W) && near(s[2], W)); if (ext) continue;
    const t = T_INT * S; if (near(s[1], s[3])) o.push(`<rect x="${X(s[0]) - t / 2}" y="${Yf(s[1]) - t / 2}" width="${(s[2] - s[0]) * S + t}" height="${t}" fill="#2b2b2b"/>`);
    else o.push(`<rect x="${X(s[0]) - t / 2}" y="${Yf(s[3]) - t / 2}" width="${t}" height="${(s[3] - s[1]) * S + t}" fill="#2b2b2b"/>`); }
  const te = T_EXT * S;
  o.push(`<rect x="${X(0) - te / 2}" y="${Yf(D) - te / 2}" width="${W * S + te}" height="${D * S + te}" fill="none" stroke="#1a1a1a" stroke-width="${te}"/>`);
  // fenêtres
  for (const w of L.wins) { const half = w.w * S / 2;
    if (w.o === "h") { const cx = X(w.c), y = Yf(w.at), y0 = y - (w.at === 0 ? -te : te) * 1, yy = w.at === 0 ? y : y - te; const top = Math.min(y, w.at === 0 ? y + te : y - te);
      o.push(`<rect x="${cx - half}" y="${top - 1}" width="${2 * half}" height="${te + 2}" fill="#fff"/>`);
      for (const f of [0, .5, 1]) o.push(`<line x1="${cx - half}" y1="${top + te * f}" x2="${cx + half}" y2="${top + te * f}" stroke="#1a1a1a" stroke-width="${f === .5 ? 3 : 2}"/>`);
      o.push(`<line x1="${cx - half}" y1="${top}" x2="${cx - half}" y2="${top + te}" stroke="#1a1a1a" stroke-width="3"/><line x1="${cx + half}" y1="${top}" x2="${cx + half}" y2="${top + te}" stroke="#1a1a1a" stroke-width="3"/>`); }
    else { const cy = Yf(w.c), x = X(w.at), left = w.at === 0 ? x - te : x;
      o.push(`<rect x="${left - 1}" y="${cy - half}" width="${te + 2}" height="${2 * half}" fill="#fff"/>`);
      for (const f of [0, .5, 1]) o.push(`<line x1="${left + te * f}" y1="${cy - half}" x2="${left + te * f}" y2="${cy + half}" stroke="#1a1a1a" stroke-width="${f === .5 ? 3 : 2}"/>`);
      o.push(`<line x1="${left}" y1="${cy - half}" x2="${left + te}" y2="${cy - half}" stroke="#1a1a1a" stroke-width="3"/><line x1="${left}" y1="${cy + half}" x2="${left + te}" y2="${cy + half}" stroke="#1a1a1a" stroke-width="3"/>`); } }
  // portes (vantail + arc)
  for (const d of L.doors) { const t = (d.ext ? te : T_INT * S) + 4, w = d.w * S, into = d.ir != null ? L.rooms[d.ir] : L.rooms.find(r => r.k === d.into);
    if (d.o === "h") { const cx = X(d.c), y = Yf(d.y); const ry = into ? (Yf(into.y + into.h / 2) < y ? -1 : 1) : -1;
      const yc = d.ext ? (d.y === 0 ? y + te / 2 : y - te / 2) : y;
      o.push(`<rect x="${cx - w / 2}" y="${yc - t / 2}" width="${w}" height="${t}" fill="#fff"/>`);
      if (!d.open) { const hx = cx - w / 2, sy = ry * w; o.push(`<line x1="${hx}" y1="${yc}" x2="${hx}" y2="${yc + sy}" stroke="#1a1a1a" stroke-width="3"/><path d="M${hx} ${yc + sy} A${w} ${w} 0 0 ${ry > 0 ? 0 : 1} ${hx + w} ${yc}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="${d.main ? "0" : "8 6"}"/>`); } }
    else { const cy = Yf(d.c), x = X(d.x), rx = into ? (X(into.x + into.w / 2) < x ? -1 : 1) : 1;
      o.push(`<rect x="${x - t / 2}" y="${cy - w / 2}" width="${t}" height="${w}" fill="#fff"/>`);
      if (!d.open) { const hy = cy - w / 2, sx = rx * w; o.push(`<line x1="${x}" y1="${hy}" x2="${x + sx}" y2="${hy}" stroke="#1a1a1a" stroke-width="3"/><path d="M${x + sx} ${hy} A${w} ${w} 0 0 ${rx > 0 ? 1 : 0} ${x} ${hy + w}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="8 6"/>`); } } }
  // étiquettes
  for (const r of L.rooms) { if (r.k === "wc" && r.w < 1.6) { o.push(`<text x="${X(r.x + r.w / 2)}" y="${Yf(r.y + r.h / 2) + 10}" font-size="30" text-anchor="middle" fill="#333">WC</text>`); continue; }
    const fs = Math.max(26, Math.min(44, r.w * 11)); const cx = X(r.x + r.w / 2), cy = Yf(r.y + r.h / 2);
    o.push(`<text x="${cx}" y="${cy - 6}" font-size="${fs}" font-weight="700" text-anchor="middle" fill="#1d2a36">${r.n}</text>`);
    o.push(`<text x="${cx}" y="${cy + fs}" font-size="${fs * .78}" text-anchor="middle" fill="#7a5a32">${r.a.toFixed(1).replace(".", ",")} m²</text>`); }
  // cotation : chaînes extérieures (bas = façade avant) + hors-tout
  const dim = (a, b, y, txt, side = 1) => { const x0 = X(a), x1 = X(b); o.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#333" stroke-width="1.5"/><line x1="${x0 - 9}" y1="${y + 9}" x2="${x0 + 9}" y2="${y - 9}" stroke="#333" stroke-width="3"/><line x1="${x1 - 9}" y1="${y + 9}" x2="${x1 + 9}" y2="${y - 9}" stroke="#333" stroke-width="3"/><text x="${(x0 + x1) / 2}" y="${y - 10 * side}" font-size="26" text-anchor="middle" fill="#333">${txt}</text>`); };
  const dimV = (a, b, x, txt) => { const y0 = Yf(a), y1 = Yf(b); o.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#333" stroke-width="1.5"/><line x1="${x - 9}" y1="${y0 + 9}" x2="${x + 9}" y2="${y0 - 9}" stroke="#333" stroke-width="3"/><line x1="${x - 9}" y1="${y1 + 9}" x2="${x + 9}" y2="${y1 - 9}" stroke="#333" stroke-width="3"/><text x="${x - 12}" y="${(y0 + y1) / 2}" font-size="26" text-anchor="middle" fill="#333" transform="rotate(-90 ${x - 12} ${(y0 + y1) / 2})">${txt}</text>`); };
  const cm = v => Math.round(v * 100);
  const front = L.rooms.filter(r => near(r.y, 0)).sort((a, b) => a.x - b.x);
  front.forEach(r => dim(r.x, r.x + r.w, Yf(0) + 90, cm(r.w)));
  dim(0, W, Yf(0) + 170, cm(W) + " (hors œuvre " + cm(W + 2 * T_EXT) + ")");
  const left = L.rooms.filter(r => near(r.x, 0)).sort((a, b) => a.y - b.y); left.forEach(r => dimV(r.y, r.y + r.h, X(0) - 90, cm(r.h)));
  dimV(0, D, X(0) - 170, cm(D));
  // nord + échelle + cartouche
  const nx = vw - 120, ny = 120;
  o.push(`<circle cx="${nx}" cy="${ny}" r="52" fill="none" stroke="#1d2a36" stroke-width="3"/><path d="M${nx} ${ny - 62} L${nx + 22} ${ny + 30} L${nx} ${ny + 14} L${nx - 22} ${ny + 30} Z" fill="#1d2a36"/><text x="${nx}" y="${ny - 72}" font-size="34" font-weight="700" text-anchor="middle" fill="#1d2a36">N</text>`);
  const sy = vh - 70; o.push(`<text x="${m}" y="${sy - 30}" font-size="26" fill="#333">Échelle graphique (m)</text>`);
  for (let i = 0; i < 5; i++) o.push(`<rect x="${m + i * S}" y="${sy - 16}" width="${S}" height="16" fill="${i % 2 ? "#fff" : "#1d2a36"}" stroke="#1d2a36" stroke-width="2"/><text x="${m + i * S}" y="${sy + 24}" font-size="22" fill="#333">${i}</text>`);
  o.push(`<text x="${m + 5 * S}" y="${sy + 24}" font-size="22" fill="#333">5</text>`);
  const cw = 760, cx0 = vw - m - cw + 200, cy0 = vh - 120;
  o.push(`<rect x="${cx0}" y="${cy0}" width="${cw - 200 + m - 20}" height="100" fill="#fff" stroke="#1d2a36" stroke-width="3"/><text x="${cx0 + 20}" y="${cy0 + 38}" font-size="30" font-weight="700" fill="#1d2a36">${(opt.title || "Projet ARCHÉA").replace(/[<&]/g, "")} — ${opt.sheet || L.name}</text><text x="${cx0 + 20}" y="${cy0 + 78}" font-size="24" fill="#555">${opt.phase || "Esquisse · 1/100"} · surface habitable ${plan.hab} m² · by CLB</text>`);
  if (opt.extra) o.push(opt.extra({ X, Yf, S, m, vw, vh }));
  o.push(`</svg>`);
  return o.join("");
}
