// ARCHÉA — générateur de plans (programme → zonage → plan coté)
export const LEVEL_H = 3.0, WALL_H = 2.8, T_EXT = .2, T_INT = .1, CORR = 1.2;

// ---------- Programme ----------
export function buildProgram(p) {
  const R = [], add = (k, n, a, o = {}) => R.push(Object.assign({ k, n, a }, o));
  const ch = Math.max(1, p.ch | 0), sdb = Math.max(1, p.sdb | 0), duplex = p.levels === 2;
  add("sejour", "Séjour", 22 + 3 * ch, { strip: "f", hab: 1 });
  if (p.open) add("cuisine", "Cuisine ouverte", 13, { strip: "f", hab: 1, wet: 1 });
  else { add("sam", "Salle à manger", 11 + ch, { strip: "f", hab: 1 }); add("cuisine", "Cuisine", 10, { strip: "b", hab: 1, wet: 1 }); }
  if (p.bureau) add("bureau", "Bureau", 10, { strip: "f", hab: 1 });
  add("wc", "WC", 2, { strip: "c", wet: 1 });
  if (p.buanderie) { add("buand", "Buanderie", 5, { strip: "b", col: "serv", wet: 1 }); add("mag", "Magasin", 3.5, { strip: "b", col: "serv", acc: "buand" }); }
  if (p.domestique) { add("chdom", "Ch. domestique", 9, { strip: "b", col: "dom", hab: 1 }); add("dch", "Douche", 3, { minW: 1.4, strip: "b", col: "dom", acc: "chdom", wet: 1 }); }
  // nuit
  const lvlN = duplex ? 1 : 0;
  add("chp", "Ch. parentale", 15, { strip: "b", hab: 1, lvl: lvlN, night: 1 });
  add("sdbp", "SdB parentale", 6, { minW: 1.8, strip: "b", col: "suite", acc: "chp", wet: 1, lvl: lvlN, night: 1 });
  add("dress", "Dressing", 4, { minW: 1.3, strip: "b", col: "suite", acc: "chp", lvl: lvlN, night: 1 });
  const guest = duplex && ch >= 3;
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
  const vf = [1, 1, 1.15, .87][variant] || 1;
  let d = (-3.6 + Math.sqrt(12.96 + 24 * Amax)) / 12 * vf; d = Math.min(Math.max(d, 3.8), 5.6);
  let W = Amax / (2 * d), mode = "A";
  // terrain étroit : couloir perpendiculaire à la rue (plan « en longueur »)
  if (W > maxW * 1.02) { const dB = Math.min(d, (maxW - CORR) / 2); if (dB >= 3.4) { mode = "B"; d = dB; W = Amax / (2 * d); } else { W = maxW; d = Amax / (2 * W); } }
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
    let cx = 0, cw = W; const wcs = C.map(r => { const w = 1.5; const o = Object.assign({}, r, { x: W - w, y: df, w, h: CORR }); cw -= w; return o; });
    const stair = rooms.find(r => r.stair);
    rooms.push({ k: "couloir", n: l === 1 ? "Palier / dégagement" : "Dégagement", x: cx, y: df, w: cw, h: CORR, circ: 1 }, ...wcs);
    rooms.forEach(r => { r.lvl = l; r.a = Math.round(r.w * r.h * 10) / 10; });
    const op = openings(rooms, W, D, l, p, mode);
    if (mode === "B") { rooms.forEach(r => { [r.x, r.y, r.w, r.h] = [r.y, r.x, r.h, r.w]; });
      op.doors.forEach(o => { if (o.o === "h") { o.o = "v"; o.x = o.y; delete o.y; } else { o.o = "h"; o.y = o.x; delete o.x; } });
      op.wins.forEach(w => w.o = w.o === "h" ? "v" : "h"); }
    const PW = mode === "B" ? D : W;
    if (variant === 1 || variant === 3) { rooms.forEach(r => r.x = PW - r.x - r.w);
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
    else if (r.k === "wc") doors.push({ o: "v", x: near(r.x, 0) ? r.x + r.w : r.x, c: r.y + r.h / 2, w: .7, into: r.k, ir: rooms.indexOf(r) });
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
      if (r.k === "dress" || r.k === "mag") { w = .6; sill = 1.6; }
      let c = (a0 + a1) / 2;
      const md = doors.find(d => d.main && d.o === o && near(d.o === "h" ? d.y : d.x, at) && d.c > a0 && d.c < a1);
      if (md) c = Math.min(a1 - w / 2 - .3, Math.max(md.c + md.w / 2 + .4 + w / 2, c));
      wins.push({ o, at, c, w, sill, head: 2.2, k: r.k, baie: sill === 0 });
    }
  }
  return { doors, wins };
}

// ---------- Mobilier (repère pièce, en m) ----------
export function furniture(r) {
  const F = [], add = (t, x, y, w, h, rot = 0) => F.push({ t, x: r.x + x, y: r.y + y, w, h, rot });
  const W = r.w, H = r.h;
  switch (r.k) {
    case "chp": case "ch": case "chdom": { const bw = r.k === "chdom" ? .9 : (r.k === "chp" ? 1.8 : 1.4), bl = 2; add("lit", (W - bw) / 2, H - bl - .05, bw, bl); if (W > bw + 1.4) { add("chevet", (W - bw) / 2 - .5, H - .5, .45, .4); add("chevet", (W + bw) / 2 + .05, H - .5, .45, .4); } if (H > 3.6) add("armoire", .05, .1, Math.min(1.8, W * .45), .6); break; }
    case "sejour": { add("canape", W * .15, H * .55, Math.min(2.6, W * .45), .9); add("canape", W * .15 - .95, H * .55 - 1.9 + .9, .9, 1.9); add("table_basse", W * .15 + .4, H * .55 - 1.1, 1.1, .6); add("meuble_tv", W * .15 + .2, .1, 1.8, .4); if (W > 6) add("fauteuil", W * .62, H * .25, .8, .8); break; }
    case "sam": add("table", W / 2 - .9, H / 2 - .5, 1.8, 1); break;
    case "cuisine": { add("plan", .05, H - .65, W - .1, .6); if (W > 3) add("plan", W - .65, .3, .6, H - 1); if (r.strip === "f" && W > 3.2) add("ilot", W / 2 - .9, H / 2 - .5, 1.8, .9); break; }
    case "sdbp": case "sdb": case "dch": { add("douche", W - .95, H - .95, .9, .9); if (r.k !== "dch") { add("wc_cuv", .1, H - .75, .4, .65); add("vasque", .1, .1, Math.min(1.2, W - .2), .5); } break; }
    case "wc": add("wc_cuv", r.w / 2 - .2, .05, .4, .65); break;
    case "tv": add("canape", W * .2, H * .5, Math.min(2.2, W * .5), .85); add("meuble_tv", W * .2, .1, Math.min(1.6, W * .5), .4); break;
    case "bureau": add("bureau_t", W / 2 - .7, H - .8, 1.4, .7); add("biblio", .05, .1, Math.min(2, W - .1), .35); break;
    case "dress": add("armoire", .05, .05, W - .1, .55); break;
    case "buand": add("machine", .1, .1, .6, .6); add("machine", .75, .1, .6, .6); break;
  }
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
  if (opt.furn !== false) for (const r of L.rooms) for (const f of furniture(r)) {
    const x = X(f.x), y = Yf(f.y + f.h), w = f.w * S, h = f.h * S;
    o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#8a8a85" stroke-width="2" rx="${f.t === "lit" || f.t === "canape" ? 6 : 2}"/>`);
    if (f.t === "lit") o.push(`<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${Math.min(40, h * .18)}" fill="none" stroke="#8a8a85" stroke-width="1.5" rx="6"/>`);
    if (f.t === "douche") o.push(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="#8a8a85" stroke-width="1.5"/><line x1="${x + w}" y1="${y}" x2="${x}" y2="${y + h}" stroke="#8a8a85" stroke-width="1.5"/>`);
    if (f.t === "wc_cuv") o.push(`<ellipse cx="${x + w / 2}" cy="${y + h * .62}" rx="${w * .42}" ry="${h * .34}" fill="none" stroke="#8a8a85" stroke-width="1.5"/>`);
    if (f.t === "table") for (let i = 0; i < 3; i++) { o.push(`<rect x="${x + w * (.18 + i * .3) - 18}" y="${y - 40}" width="36" height="34" fill="none" stroke="#8a8a85" stroke-width="1.5"/><rect x="${x + w * (.18 + i * .3) - 18}" y="${y + h + 6}" width="36" height="34" fill="none" stroke="#8a8a85" stroke-width="1.5"/>`); }
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
  o.push(`<rect x="${cx0}" y="${cy0}" width="${cw - 200 + m - 20}" height="100" fill="#fff" stroke="#1d2a36" stroke-width="3"/><text x="${cx0 + 20}" y="${cy0 + 38}" font-size="30" font-weight="700" fill="#1d2a36">${(opt.title || "Projet ARCHÉA").replace(/[<&]/g, "")} — ${L.name}</text><text x="${cx0 + 20}" y="${cy0 + 78}" font-size="24" fill="#555">Esquisse · 1/100 · surface habitable ${plan.hab} m² · by CLB</text>`);
  o.push(`</svg>`);
  return o.join("");
}
