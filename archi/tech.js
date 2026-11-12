// ARCHÉA — Dossier technique (plans d'exécution indicatifs) : plan coté et repérage des ouvertures,
// fondations & structure (prédimensionnement), coupe A-A, façades, tableau des menuiseries, réseaux, avant-métré.
// Hypothèses courantes en Côte d'Ivoire (à valider par un bureau d'études structure) : béton armé dosé à 350 kg/m³,
// béton de propreté 150 kg/m³, dallage 250 kg/m³, soubassement en agglos pleins de 15, élévation en agglos creux de 20 (façades) et de 10 (cloisons),
// poteaux et chaînages 20×20, longrines 20×40, plancher à corps creux 16+4.
import { svgPlan, furniture, envelope, extSegs, intSegs, LEVEL_H, WALL_H, T_EXT, T_INT, CORR } from './plan.js';

const near = (a, b) => Math.abs(a - b) < 1e-3, cm = v => Math.round(v * 100), f2 = v => v.toFixed(2).replace(".", ","), f1 = v => v.toFixed(1).replace(".", ",");
const INK = "#1d2a36", RED = "#b4552d", BLUE = "#2f6fa3";
const esc = t => String(t).replace(/[<&]/g, "");

// ---------- Repérage des menuiseries (identiques = même repère) ----------
export function joinery(plan, fin = {}) {
  const mat = { noir: "Aluminium laqué noir", blanc: "Aluminium laqué blanc", champ: "Aluminium champagne", bois: "Bois exotique traité" }[fin.menu] || "Aluminium laqué";
  const types = new Map(), list = [];
  plan.levels.forEach((L, l) => {
    const roomAt = (x, y) => L.rooms.find(r => x >= r.x - .01 && x <= r.x + r.w + .01 && y >= r.y - .01 && y <= r.y + r.h + .01);
    for (const w of L.wins) { const H = w.head - w.sill, kind = w.sill === 0 ? (w.w >= 2.4 ? "Baie coulissante" : "Porte-fenêtre") : w.sill >= 1.5 ? "Châssis haut (ventilation)" : "Fenêtre coulissante";
      const key = "F|" + kind + cm(w.w) + "x" + cm(H) + "|" + cm(w.sill); if (!types.has(key)) types.set(key, { id: "F" + (([...types.keys()].filter(k => k[0] === "F").length) + 1), kind, w: w.w, h: H, sill: w.sill, mat, n: 0, loc: new Set() });
      const t = types.get(key); t.n++; const wo = w.out ?? (near(w.at, 0) ? -1 : 1), px = w.o === "h" ? w.c : w.at, py = w.o === "h" ? w.at : w.c, r = roomAt(px - (w.o === "v" ? wo * .05 : 0), py - (w.o === "h" ? wo * .05 : 0)); t.loc.add((r ? r.n : "—") + (plan.levels.length > 1 ? (l ? " (ét.)" : " (RDC)") : ""));
      list.push({ l, o: w.o, c: w.c, at: w.at, id: t.id, win: 1, out: w.out }); }
    for (const d of L.doors) { if (d.open) continue; const kind = d.main ? "Porte d'entrée pleine" : d.ext ? "Porte de service" : d.w <= .75 ? "Porte isoplane (pièce d'eau)" : "Porte isoplane";
      const key = "P|" + kind + cm(d.w); if (!types.has(key)) types.set(key, { id: "P" + (([...types.keys()].filter(k => k[0] === "P").length) + 1), kind, w: d.w, h: d.main ? 2.2 : 2.1, sill: 0, mat: d.main ? "Bois massif / acier, serrure 3 points" : d.ext ? "Acier ou aluminium" : "Bois isoplan, huisserie bois", n: 0, loc: new Set() });
      const t = types.get(key); t.n++; const r = L.rooms[d.ir]; t.loc.add((r ? r.n : "—") + (plan.levels.length > 1 ? (l ? " (ét.)" : " (RDC)") : ""));
      list.push({ l, o: d.o, c: d.c, at: d.o === "h" ? d.y : d.x, id: t.id, out: d.ext ? d.out : undefined }); }
  });
  return { types: [...types.values()].sort((a, b) => a.id[0] === b.id[0] ? +a.id.slice(1) - +b.id.slice(1) : a.id < b.id ? -1 : 1), list };
}

// ---------- 1. Plan d'exécution coté ----------
export function sheetCote(plan, l, fin, title) {
  const L = plan.levels[l], W = plan.W, D = plan.D, J = joinery(plan, fin);
  return svgPlan(plan, l, { furn: false, title, sheet: (L.name) + " — plan coté", phase: "Plan d'exécution indicatif · 1/50 (cotes en cm)", extra: ({ X, Yf }) => {
    const o = [], tag = (x, y, t) => o.push(`<g><rect x="${x - 34}" y="${y - 19}" width="68" height="34" rx="6" fill="#fff" stroke="${RED}" stroke-width="2.5"/><text x="${x}" y="${y + 8}" font-size="22" font-weight="700" text-anchor="middle" fill="${RED}">${t}</text></g>`);
    const dim = (a, b, y, txt) => { const x0 = X(a), x1 = X(b); o.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#333" stroke-width="1.5"/><line x1="${x0 - 8}" y1="${y + 8}" x2="${x0 + 8}" y2="${y - 8}" stroke="#333" stroke-width="3"/><line x1="${x1 - 8}" y1="${y + 8}" x2="${x1 + 8}" y2="${y - 8}" stroke="#333" stroke-width="3"/><text x="${(x0 + x1) / 2}" y="${y - 8}" font-size="20" text-anchor="middle" fill="#333">${txt}</text>`); };
    const dimV = (a, b, x, txt) => { const y0 = Yf(a), y1 = Yf(b); o.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#333" stroke-width="1.5"/><line x1="${x - 8}" y1="${y0 + 8}" x2="${x + 8}" y2="${y0 - 8}" stroke="#333" stroke-width="3"/><line x1="${x - 8}" y1="${y1 + 8}" x2="${x + 8}" y2="${y1 - 8}" stroke="#333" stroke-width="3"/><text x="${x + 22}" y="${(y0 + y1) / 2}" font-size="20" text-anchor="middle" fill="#333" transform="rotate(-90 ${x + 22} ${(y0 + y1) / 2})">${txt}</text>`); };
    // chaîne des ouvertures (façade arrière en haut, façade droite à droite)
    const chainH = (at, y) => { const ws = L.wins.filter(w => w.o === "h" && near(w.at, at)).concat(L.doors.filter(d => d.o === "h" && near(d.y, at)).map(d => ({ c: d.c, w: d.w }))).sort((a, b) => a.c - b.c); let p = 0; for (const w of ws) { const a = w.c - w.w / 2, b = w.c + w.w / 2; if (a - p > .05) dim(p, a, y, cm(a - p)); dim(a, b, y, cm(w.w)); p = b; } if (W - p > .05) dim(p, W, y, cm(W - p)); };
    const chainV = (at, x) => { const ws = L.wins.filter(w => w.o === "v" && near(w.at, at)).concat(L.doors.filter(d => d.o === "v" && near(d.x, at)).map(d => ({ c: d.c, w: d.w }))).sort((a, b) => a.c - b.c); let p = 0; for (const w of ws) { const a = w.c - w.w / 2, b = w.c + w.w / 2; if (a - p > .05) dimV(p, a, x, cm(a - p)); dimV(a, b, x, cm(w.w)); p = b; } if (D - p > .05) dimV(p, D, x, cm(D - p)); };
    if (!plan.blocks) { chainH(D, Yf(D) - 80); chainV(W, X(W) + 80); }
    // cotes intérieures de chaque pièce (largeur × profondeur, nu des murs)
    for (const r of L.rooms) { if (r.w < 1 || r.h < 1) continue; const iw = r.w - (near(r.x, 0) ? 0 : T_INT / 2) - (near(r.x + r.w, W) ? 0 : T_INT / 2), ih = r.h - (near(r.y, 0) ? 0 : T_INT / 2) - (near(r.y + r.h, D) ? 0 : T_INT / 2);
      o.push(`<text x="${X(r.x + r.w / 2)}" y="${Yf(r.y + r.h / 2) + (r.w > 2.2 ? 62 : 48)}" font-size="20" text-anchor="middle" fill="${BLUE}">${cm(iw)} × ${cm(ih)}</text>`);
      o.push(`<text x="${X(r.x + .12)}" y="${Yf(r.y + .12)}" font-size="17" fill="#777">${r.k === "couloir" ? "" : (l ? "+3,20" : "±0,00")}</text>`); }
    // repères des ouvertures
    for (const it of J.list.filter(x => x.l === l)) { const off = 46; let x, y;
      if (it.out != null) { if (it.o === "h") { x = X(it.c); y = Yf(it.at) - it.out * off; } else { x = X(it.at) + it.out * (off + 10); y = Yf(it.c); } }
      else if (it.o === "h") { x = X(it.c); y = Yf(it.at) + (near(it.at, 0) ? off : near(it.at, D) ? -off : (it.win ? off : -off * .9)); } else { x = X(it.at) + (near(it.at, 0) ? -off - 10 : near(it.at, W) ? off + 10 : off); y = Yf(it.c); }
      tag(x, y, it.id); }
    // ligne de coupe A-A
    const cx = cutX(plan), cy1 = plan.blocks ? plan.bar.y + plan.bar.h : D;
    o.push(`<line x1="${X(cx)}" y1="${Yf(cy1) - 150}" x2="${X(cx)}" y2="${Yf(0) + 210}" stroke="${RED}" stroke-width="3" stroke-dasharray="40 12 6 12"/><text x="${X(cx) + 14}" y="${Yf(cy1) - 150}" font-size="34" font-weight="700" fill="${RED}">A</text><text x="${X(cx) + 14}" y="${Yf(0) + 236}" font-size="34" font-weight="700" fill="${RED}">A</text>`);
    return o.join("");
  } });
}

// ---------- 2. Fondations & structure ----------
// position de la coupe A-A : au milieu de la plus grande pièce de vie située dans la barre principale
function cutX(plan) { const L0 = plan.levels[0]; if (!plan.blocks) { const se = L0.rooms.find(r => r.k === "sejour") || L0.rooms[0]; return se.x + se.w * .6; }
  const b = plan.bar, inBar = r => r.y >= b.y - .01 && r.y + r.h <= b.y + b.h + .01 && r.x >= b.x - .01 && r.x + r.w <= b.x + b.w + .01, arms = plan.blocks.filter(q => q !== plan.blocks[0]);
  const ok = r => inBar(r) && !arms.some(a => r.x + r.w * .6 > a.x && r.x + r.w * .6 < a.x + a.w && a.y < b.y + b.h + .01 && a.y + a.h > b.y + b.h - .01 && a.x < b.x + b.w);
  const se = L0.rooms.filter(r => ok(r) && !r.circ && !r.stair).sort((p, q) => q.w * q.h - p.w * p.h)[0] || L0.rooms[0]; return se.x + se.w * .6; }
function structureComp(plan) {
  const L0 = plan.levels[0], LC = plan.levels.find(L => L.rooms.some(r => r.k === "couloir")) || L0, span = 4.5, cols = [], beams = [], key = new Map();
  const addCol = (x, y) => { for (const c of cols) if (Math.abs(c[0] - x) < .35 && Math.abs(c[1] - y) < .35) return c; const c = [Math.round(x * 100) / 100, Math.round(y * 100) / 100]; cols.push(c); return c; };
  for (const b of plan.blocks) { const ax = b.axis === "y" ? "y" : "x", len = ax === "x" ? b.w : b.h, a0 = ax === "x" ? b.x : b.y, t0 = ax === "x" ? b.y : b.x, dep = ax === "x" ? b.h : b.w;
    // files longitudinales : façades + bords du couloir
    const ls = new Set([0, dep]); for (const r of LC.rooms.filter(r => r.k === "couloir")) { const lo = ax === "x" ? r.y : r.x, hi = ax === "x" ? r.y + r.h : r.x + r.w, along = ax === "x" ? r.w : r.h; if (along > (ax === "x" ? r.h : r.w) && lo > t0 - .01 && hi < t0 + dep + .01) { ls.add(Math.round((lo - t0) * 100) / 100); ls.add(Math.round((hi - t0) * 100) / 100); } }
    if (ls.size === 2 && dep > 7) ls.add(Math.round(dep / 2 * 100) / 100); const lines = [...ls].sort((p, q) => p - q);
    // trame : jonctions de cloisons les plus fréquentes, portée ≤ 4,50 m
    const cnt = new Map(); for (const r of L0.rooms) for (const v of ax === "x" ? [r.x, r.x + r.w] : [r.y, r.y + r.h]) { const u = Math.round((v - a0) * 20) / 20; if (u > .5 && u < len - .5) cnt.set(u, (cnt.get(u) || 0) + 1); }
    const cs = [...cnt.keys()].sort((p, q) => p - q), keep = [0]; let last = 0;
    while (last < len - 1e-3) { const reach = cs.filter(v => v > last + 1.2 && v <= last + span + 1e-3); let nx;
      if (len - last <= span) nx = len; else if (reach.length) { const far = reach.filter(v => v > last + span * .6); nx = (far.length ? far : reach).sort((p, q) => (cnt.get(q) - cnt.get(p)) || (q - p))[0]; } else nx = last + Math.min(span, (len - last) / Math.ceil((len - last) / span));
      keep.push(nx); last = nx; }
    const P = (u, v) => ax === "x" ? addCol(a0 + u, t0 + v) : addCol(t0 + v, a0 + u);
    for (const v of lines) { let prev = null; for (const u of keep) { const c = P(u, v); if (prev && prev !== c) beams.push([prev, c]); prev = c; } }
    for (const u of [0, len]) { let prev = null; for (const v of lines) { const c = P(u, v); if (prev && prev !== c) beams.push([prev, c]); prev = c; } } }
  const duplex = plan.levels.length > 1, sem = plan.levels.length >= 4 ? 1.6 : plan.levels.length === 3 ? 1.4 : duplex ? 1.2 : 1.0;
  const beamLen = beams.reduce((s, [a, b]) => s + Math.hypot(a[0] - b[0], a[1] - b[1]), 0);
  return { cols, beams, lines: [], horiz: true, sem, beamLen };
}
export function structure(plan) {
  if (plan.blocks) return structureComp(plan);
  const W = plan.W, D = plan.D, L0 = plan.levels[0], corr = L0.rooms.find(r => r.k === "couloir"), horiz = !corr || corr.w >= corr.h;
  const lines = horiz ? [0, corr ? corr.y : null, corr ? corr.y + corr.h : null, D].filter(v => v != null) : [0, corr.x, corr.x + corr.w, W];
  const span = 4.5, len = horiz ? W : D, cnt = new Map();
  // trame commune à toutes les files : jonctions de cloisons les plus fréquentes, portée ≤ 4,50 m
  for (const r of L0.rooms) for (const v of horiz ? [r.x, r.x + r.w] : [r.y, r.y + r.h]) { const k = Math.round(v * 20) / 20; cnt.set(k, (cnt.get(k) || 0) + 1); }
  const cs = [...cnt.keys()].filter(v => v > .5 && v < len - .5).sort((p, q) => p - q), keep = [0]; let last = 0;
  while (last < len - 1e-3) { const reach = cs.filter(v => v > last + 1.2 && v <= last + span + 1e-3); let nx;
    if (len - last <= span) nx = len; else if (reach.length) { const far = reach.filter(v => v > last + span * .6); nx = (far.length ? far : reach).sort((p, q) => (cnt.get(q) - cnt.get(p)) || (q - p))[0]; } else nx = last + Math.min(span, (len - last) / Math.ceil((len - last) / span));
    keep.push(nx); last = nx; }
  const uniq = []; for (const a of lines) for (const v of keep) uniq.push(horiz ? [v, a] : [a, v]);
  const beams = []; // tronçons porteurs (longrines / poutres)
  for (const a of lines) { const ps = uniq.filter(p => near(horiz ? p[1] : p[0], a)).sort((p, q) => (horiz ? p[0] - q[0] : p[1] - q[1])); for (let i = 1; i < ps.length; i++) beams.push([ps[i - 1], ps[i]]); }
  for (const e of horiz ? [0, W] : [0, D]) { const ps = uniq.filter(p => near(horiz ? p[0] : p[1], e)).sort((p, q) => (horiz ? p[1] - q[1] : p[0] - q[0])); for (let i = 1; i < ps.length; i++) beams.push([ps[i - 1], ps[i]]); }
  const duplex = plan.levels.length > 1, sem = duplex ? 1.2 : 1.0;
  const beamLen = beams.reduce((s, [a, b]) => s + Math.hypot(a[0] - b[0], a[1] - b[1]), 0);
  return { cols: uniq, beams, lines, horiz, sem, beamLen };
}
export function sheetStruct(plan, title) {
  const W = plan.W, D = plan.D, S = 100, m = 300, vw = W * S + 2 * m, vh = D * S + 2 * m + 560, X = x => m + x * S, Yf = y => m + (D - y) * S, st = structure(plan), o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" font-family="Helvetica,Arial,sans-serif"><rect width="${vw}" height="${vh}" fill="#fff"/>`);
  // murs du RDC en gris (repère)
  for (const r of plan.levels[0].rooms) o.push(`<rect x="${X(r.x)}" y="${Yf(r.y + r.h)}" width="${r.w * S}" height="${r.h * S}" fill="none" stroke="#c9c9c4" stroke-width="2"/>`);
  for (const b of plan.blocks || [{ x: 0, y: 0, w: W, h: D }]) o.push(`<rect x="${X(b.x - T_EXT)}" y="${Yf(b.y + b.h + T_EXT)}" width="${(b.w + 2 * T_EXT) * S}" height="${(b.h + 2 * T_EXT) * S}" fill="none" stroke="#9a9a95" stroke-width="3"/>`);
  // axes
  const xs = [...new Set(st.cols.map(p => p[0].toFixed(2)))].map(Number).sort((a, b) => a - b), ys = [...new Set(st.cols.map(p => p[1].toFixed(2)))].map(Number).sort((a, b) => a - b);
  xs.forEach((x, i) => { o.push(`<line x1="${X(x)}" y1="${Yf(D) - 170}" x2="${X(x)}" y2="${Yf(0) + 130}" stroke="#888" stroke-width="1.5" stroke-dasharray="30 8 4 8"/><circle cx="${X(x)}" cy="${Yf(D) - 200}" r="28" fill="#fff" stroke="${INK}" stroke-width="2.5"/><text x="${X(x)}" y="${Yf(D) - 190}" font-size="28" font-weight="700" text-anchor="middle" fill="${INK}">${i + 1}</text>`); });
  ys.forEach((y, i) => { o.push(`<line x1="${X(0) - 170}" y1="${Yf(y)}" x2="${X(W) + 130}" y2="${Yf(y)}" stroke="#888" stroke-width="1.5" stroke-dasharray="30 8 4 8"/><circle cx="${X(0) - 200}" cy="${Yf(y)}" r="28" fill="#fff" stroke="${INK}" stroke-width="2.5"/><text x="${X(0) - 200}" y="${Yf(y) + 10}" font-size="28" font-weight="700" text-anchor="middle" fill="${INK}">${String.fromCharCode(65 + i)}</text>`); });
  // entraxes
  for (let i = 1; i < xs.length; i++) o.push(`<text x="${(X(xs[i - 1]) + X(xs[i])) / 2}" y="${Yf(D) - 120}" font-size="22" text-anchor="middle" fill="#333">${cm(xs[i] - xs[i - 1])}</text>`);
  for (let i = 1; i < ys.length; i++) o.push(`<text x="${X(0) - 120}" y="${(Yf(ys[i - 1]) + Yf(ys[i])) / 2 + 8}" font-size="22" text-anchor="middle" fill="#333">${cm(ys[i] - ys[i - 1])}</text>`);
  // longrines
  for (const [a, b] of st.beams) { const hz = near(a[1], b[1]); const off = 10; if (hz) for (const s of [-1, 1]) o.push(`<line x1="${X(a[0])}" y1="${Yf(a[1]) + s * off}" x2="${X(b[0])}" y2="${Yf(b[1]) + s * off}" stroke="${BLUE}" stroke-width="2.5"/>`);
    else for (const s of [-1, 1]) o.push(`<line x1="${X(a[0]) + s * off}" y1="${Yf(a[1])}" x2="${X(b[0]) + s * off}" y2="${Yf(b[1])}" stroke="${BLUE}" stroke-width="2.5"/>`); }
  // semelles + poteaux
  const sz = st.sem * S;
  for (const [x, y] of st.cols) { o.push(`<rect x="${X(x) - sz / 2}" y="${Yf(y) - sz / 2}" width="${sz}" height="${sz}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="14 8"/><rect x="${X(x) - 10}" y="${Yf(y) - 10}" width="20" height="20" fill="${INK}"/>`); }
  // légende et notes
  const ly = Yf(0) + 190; const leg = [[`<rect x="0" y="-16" width="20" height="20" fill="${INK}"/>`, `Poteau BA 20×20 (${st.cols.length} u)`], [`<rect x="-10" y="-26" width="40" height="40" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="10 6"/>`, `Semelle isolée S1 ${cm(st.sem)}×${cm(st.sem)}×30 (${st.cols.length} u)`], [`<line x1="-10" y1="-10" x2="40" y2="-10" stroke="${BLUE}" stroke-width="2.5"/><line x1="-10" y1="4" x2="40" y2="4" stroke="${BLUE}" stroke-width="2.5"/>`, `Longrine BA 20×40 (${f1(st.beamLen)} ml)`]];
  leg.forEach(([sym, t], i) => o.push(`<g transform="translate(${m + 20} ${ly + i * 54})">${sym}<text x="60" y="0" font-size="26" fill="#222">${t}</text></g>`));
  const notes = ["Fond de fouille à −1,00 m sous terrain naturel (à confirmer par l'étude de sol) ; béton de propreté 150 kg/m³ ép. 5 cm.", "Semelles, amorces de poteaux, longrines, poteaux, chaînages et poutres en béton armé dosé à 350 kg/m³.", "Soubassement en agglos pleins de 15 ; dallage 10 cm dosé à 250 kg/m³ sur hérisson 20 cm compacté + film polyane + traitement anti-termite.", plan.levels.length > 1 ? "Plancher haut RDC à corps creux 16+4, poutres 20×40 sur files porteuses ; escalier en béton armé." : "Chaînage haut 20×20 sur tous les murs ; poutres 20×35 au droit des files porteuses.", "Ferraillage, sections définitives et contrainte du sol : note de calcul d'un bureau d'études agréé obligatoire."];
  notes.forEach((t, i) => o.push(`<text x="${m + 20}" y="${ly + 190 + i * 34}" font-size="22" fill="#333">${i + 1}. ${esc(t)}</text>`));
  o.push(cartouche(vw, vh, title, "Fondations &amp; structure — prédimensionnement", "Plan indicatif · 1/100 · à valider par un BET"));
  o.push(`</svg>`); return o.join("");
}
function cartouche(vw, vh, title, sheet, phase) { const cw = 900, x = vw - cw - 40, y = vh - 130; return `<rect x="${x}" y="${y}" width="${cw}" height="100" fill="#fff" stroke="${INK}" stroke-width="3"/><text x="${x + 20}" y="${y + 40}" font-size="30" font-weight="700" fill="${INK}">${esc(title)} — ${sheet}</text><text x="${x + 20}" y="${y + 78}" font-size="23" fill="#555">${phase} · ARCHÉA by CLB</text>`; }

// ---------- 3. Coupe A-A ----------
export function sheetCoupe(plan, roof, fin, title) {
  const D = plan.blocks ? plan.bar.y + plan.bar.h : plan.D, n = plan.levels.length, S = 100, m = 340, top = n * LEVEL_H, roofH = roof === "hip" ? Math.min(plan.blocks ? plan.bar.w : plan.W, D + 1.6) * .3 + .1 : 1.0;
  const vw = D * S + 2 * m + 2 * T_EXT * S, vh = (top + roofH + 1.6) * S + 2 * m + 120, X = y => m + (y + T_EXT) * S, Yz = z => m + (top + roofH - z) * S, o = [];
  const L0 = plan.levels[0], cx = cutX(plan), staff = +(fin.staff || 0);
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" font-family="Helvetica,Arial,sans-serif"><defs><pattern id="hc" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="14" stroke="#333" stroke-width="2"/></pattern><pattern id="ht" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2" fill="#8a7a62"/><circle cx="15" cy="13" r="1.5" fill="#8a7a62"/></pattern></defs><rect width="${vw}" height="${vh}" fill="#fff"/>`);
  // terrain naturel (−0,20) et sous-sol
  o.push(`<rect x="${X(-2.5)}" y="${Yz(-.2)}" width="${(D + 5) * S}" height="${1.3 * S}" fill="url(#ht)" opacity=".6"/><line x1="${X(-2.5)}" y1="${Yz(-.2)}" x2="${X(D + 2.5)}" y2="${Yz(-.2)}" stroke="#5b4a35" stroke-width="3"/>`);
  // dallage + hérisson
  o.push(`<rect x="${X(0)}" y="${Yz(0)}" width="${D * S}" height="${.1 * S}" fill="url(#hc)" stroke="#222" stroke-width="2"/><rect x="${X(0)}" y="${Yz(-.1)}" width="${D * S}" height="${.2 * S}" fill="#e9e3d6" stroke="#999" stroke-width="1.5"/>`);
  // murs coupés : façades + murs du dégagement si coupés
  const cuts = [[-T_EXT, T_EXT], [D, T_EXT]]; for (const r of L0.rooms.filter(r => cx > r.x && cx < r.x + r.w && r.y + r.h <= D + .01)) for (const e of [r.y, r.y + r.h]) if (!near(e, 0) && !near(e, D) && !cuts.some(c => near(c[0], e - T_INT / 2))) cuts.push([e - T_INT / 2, T_INT]);
  for (let l = 0; l < n; l++) { const z0 = l * LEVEL_H; const L = plan.levels[l];
    for (const [y, t] of cuts) { const ext = t === T_EXT; let segs = [[0, WALL_H]];
      if (ext) { const at = near(y, -T_EXT) ? 0 : D; const w = L.wins.find(w => w.o === "h" && near(w.at, at) && Math.abs(w.c - cx) < w.w / 2); const d = L.doors.find(d => d.o === "h" && near(d.y, at) && Math.abs(d.c - cx) < d.w / 2); if (w) segs = [[0, w.sill], [w.head, WALL_H]]; else if (d) segs = [[2.1, WALL_H]]; if (w || d) { const a = w ? w.sill : 0, b = w ? w.head : 2.1; o.push(`<line x1="${X(y + t / 2)}" y1="${Yz(z0 + a)}" x2="${X(y + t / 2)}" y2="${Yz(z0 + b)}" stroke="${BLUE}" stroke-width="5"/>`); } }
      for (const [a, b] of segs) if (b - a > .01) o.push(`<rect x="${X(y)}" y="${Yz(z0 + b)}" width="${t * S}" height="${(b - a) * S}" fill="url(#hc)" stroke="#111" stroke-width="3"/>`); }
    // plancher / dalle haute
    o.push(`<rect x="${X(-T_EXT)}" y="${Yz(z0 + LEVEL_H)}" width="${(D + 2 * T_EXT) * S}" height="${(LEVEL_H - WALL_H) * S}" fill="url(#hc)" stroke="#111" stroke-width="3"/>`);
    // poutres sur files porteuses
    for (const [y, t] of cuts) o.push(`<rect x="${X(y)}" y="${Yz(z0 + WALL_H)}" width="${t * S}" height="${.2 * S}" fill="#555"/>`);
    if (staff >= 2) o.push(`<line x1="${X(0)}" y1="${Yz(z0 + WALL_H - .25)}" x2="${X(D)}" y2="${Yz(z0 + WALL_H - .25)}" stroke="#777" stroke-width="2" stroke-dasharray="14 8"/><text x="${X(D / 2)}" y="${Yz(z0 + WALL_H - .25) + 26}" font-size="20" text-anchor="middle" fill="#777">faux plafond staff (gorge lumineuse)</text>`);
    o.push(`<text x="${X(D / 2)}" y="${Yz(z0 + 1.4)}" font-size="26" text-anchor="middle" fill="#666">${n > 1 ? (l ? (n > 2 ? "R+" + l : "ÉTAGE") : "REZ-DE-CHAUSSÉE") : "PLAIN-PIED"} — HSP 2,80</text>`); }
  // toiture
  const zt = top;
  if (roof === "hip") { const ov = .8; o.push(`<path d="M${X(-T_EXT - ov)} ${Yz(zt)} L${X(D / 2)} ${Yz(zt + roofH - .1)} L${X(D + T_EXT + ov)} ${Yz(zt)}" fill="none" stroke="#111" stroke-width="4"/><path d="M${X(-T_EXT - ov)} ${Yz(zt) + 12} L${X(D / 2)} ${Yz(zt + roofH - .1) + 12} L${X(D + T_EXT + ov)} ${Yz(zt) + 12}" fill="none" stroke="#777" stroke-width="2"/><text x="${X(D / 2)}" y="${Yz(zt + roofH * .35)}" font-size="22" text-anchor="middle" fill="#555">${fin.toit === "bac" ? "Charpente métallique, couverture en bac aluminium · pente ≈ 30 %" : "Charpente bois ou métallique, couverture en tuiles · pente ≈ 30 %"}</text>`); }
  else { o.push(`<rect x="${X(-T_EXT)}" y="${Yz(zt + .8)}" width="${T_EXT * S}" height="${.8 * S}" fill="url(#hc)" stroke="#111" stroke-width="3"/><rect x="${X(D)}" y="${Yz(zt + .8)}" width="${T_EXT * S}" height="${.8 * S}" fill="url(#hc)" stroke="#111" stroke-width="3"/><line x1="${X(0)}" y1="${Yz(zt + .06)}" x2="${X(D)}" y2="${Yz(zt + .06)}" stroke="${INK}" stroke-width="4"/><text x="${X(D / 2)}" y="${Yz(zt + .3)}" font-size="22" text-anchor="middle" fill="#555">Toit-terrasse : forme de pente 1,5 %, étanchéité multicouche + protection, acrotère h. 0,80</text>`); }
  // fondations sous façades
  for (const y of [-T_EXT, D]) { const c = y + T_EXT / 2; o.push(`<rect x="${X(c - .5)}" y="${Yz(-1.0)}" width="${S}" height="${.3 * S}" fill="url(#hc)" stroke="#111" stroke-width="3"/><rect x="${X(c - .55)}" y="${Yz(-1.0) + .3 * S}" width="${1.1 * S}" height="${.05 * S}" fill="#ccc" stroke="#999"/><rect x="${X(c - .1)}" y="${Yz(-.2)}" width="${.2 * S}" height="${.5 * S}" fill="url(#hc)" stroke="#111" stroke-width="2"/><rect x="${X(c - .1)}" y="${Yz(.2)}" width="${.2 * S}" height="${.4 * S}" fill="#555"/>`); }
  // cotes de niveaux
  const lv = [[-1.05, "−1,05 fond de fouille"], [-.2, "−0,20 TN"], [0, "±0,00 sol fini RDC"]]; for (let l = 0; l < n; l++) { lv.push([l * LEVEL_H + WALL_H, `+${f2(l * LEVEL_H + WALL_H)} sous plafond`]); if (l < n - 1) lv.push([(l + 1) * LEVEL_H, `+${f2((l + 1) * LEVEL_H)} sol fini étage`]); }
  lv.push([zt, `+${f2(zt)} dessus dalle haute`]); if (roof !== "hip") lv.push([zt + .8, `+${f2(zt + .8)} acrotère`]); else lv.push([zt + roofH - .1, `+${f2(zt + roofH - .1)} faîtage`]);
  const xr = X(D + T_EXT) + 60; lv.forEach(([z, t]) => o.push(`<path d="M${xr} ${Yz(z)} l14 -14 h-28 z" fill="${INK}"/><line x1="${xr - 30}" y1="${Yz(z)}" x2="${xr + 40}" y2="${Yz(z)}" stroke="${INK}" stroke-width="1.5"/><text x="${xr + 48}" y="${Yz(z) + 8}" font-size="21" fill="${INK}">${t}</text>`));
  o.push(cartouche(vw, vh, title, "Coupe A-A", "Coupe indicative · 1/50"));
  o.push(`</svg>`); return o.join("");
}

// ---------- 4. Façades ----------
// élévation d'un bâtiment composé : on projette toutes les façades tournées vers le côté demandé (les plus proches devant)
function facadeComp(plan, side, style, title) {
  const n = plan.levels.length, roof = style.roof, horiz = side === "S" || side === "N", len = horiz ? plan.W : plan.D, S = 100, m = 260, top = n * LEVEL_H + .2;
  const RB = plan.roofBlocks || plan.blocks, rhMax = roof === "hip" ? Math.max(...RB.map(b => Math.min(b.w, b.h) + 1.6)) * .3 : .8;
  const vw = (len + 2 * T_EXT + 2) * S + 2 * m, vh = (top + rhMax + 1) * S + 2 * m + 120, X = x => m + (x + T_EXT + 1) * S, Yz = z => m + (top + rhMax - z) * S, o = [];
  const facCol = style.facade || "#eee", acc = style.accent || "#555", fr = style.frame || "#222", flip = side === "N" || side === "W", ux = c => flip ? len - c : c;
  const want = { S: ["h", -1], N: ["h", 1], W: ["v", -1], E: ["v", 1] }[side];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" font-family="Helvetica,Arial,sans-serif"><rect width="${vw}" height="${vh}" fill="#fff"/>`);
  o.push(`<line x1="${X(-1.5)}" y1="${Yz(-.2)}" x2="${X(len + 1.5)}" y2="${Yz(-.2)}" stroke="#5b4a35" stroke-width="4"/>`);
  // toitures (derrière)
  if (roof === "hip") { const ov = .8; for (const b of RB.slice().sort((p, q) => (horiz ? q.h - p.h : q.w - p.w))) { const a0 = horiz ? b.x : b.y, al = horiz ? b.w : b.h, dp = horiz ? b.h : b.w, A = al + 2 * ov, B = dp + 2 * ov, rh = Math.min(A, B) * .3, r = Math.max(0, (A - B) / 2), mid = a0 + al / 2;
      const x0 = ux(a0 - ov), x1 = ux(a0 + al + ov), xm0 = ux(mid - r), xm1 = ux(mid + r); o.push(`<path d="M${X(x0)} ${Yz(top)} L${X(xm0)} ${Yz(top + rh)} L${X(xm1)} ${Yz(top + rh)} L${X(x1)} ${Yz(top)} Z" fill="${style.roofC || "#8a4a2a"}" stroke="#111" stroke-width="3"/>`); } }
  const LT = plan.levels[n - 1], segs = extSegs(LT.rooms).filter(g => g.o === want[0] && g.out === want[1]).sort((p, q) => want[1] < 0 ? q.at - p.at : p.at - q.at);
  for (const g of segs) { const a = Math.min(ux(g.a0), ux(g.a1)) - T_EXT, b = Math.max(ux(g.a0), ux(g.a1)) + T_EXT, w = (b - a) * S;
    o.push(`<rect x="${X(a)}" y="${Yz(top)}" width="${w}" height="${(top + .2) * S}" fill="${facCol}" stroke="#111" stroke-width="3"/><rect x="${X(a)}" y="${Yz(.25)}" width="${w}" height="${.45 * S}" fill="${style.plinth || "#777"}" opacity=".85"/>`);
    for (let l = 1; l < n; l++) o.push(`<rect x="${X(a)}" y="${Yz(l * LEVEL_H + .2)}" width="${w}" height="${.2 * S}" fill="${acc}" opacity=".85"/>`);
    if (roof !== "hip") o.push(`<rect x="${X(a)}" y="${Yz(top + .8)}" width="${w}" height="${.8 * S}" fill="${facCol}" stroke="#111" stroke-width="3"/><rect x="${X(a - .05)}" y="${Yz(top + .86)}" width="${w + 10}" height="${.08 * S}" fill="${acc}"/>`);
    plan.levels.forEach((L, l) => { const z0 = l * LEVEL_H + .2, on = (at, c) => Math.abs(at - g.at) < 1e-3 && c > g.a0 - .01 && c < g.a1 + .01;
      for (const wv of L.wins.filter(w => w.o === g.o && on(w.at, w.c))) { const x0 = X(ux(wv.c) - wv.w / 2); o.push(`<rect x="${x0}" y="${Yz(z0 + wv.head)}" width="${wv.w * S}" height="${(wv.head - wv.sill) * S}" fill="#2a3a44" stroke="${fr}" stroke-width="8"/>`);
        const k = Math.max(1, Math.round(wv.w / 1.1)); for (let i = 1; i < k; i++) o.push(`<line x1="${x0 + wv.w * S * i / k}" y1="${Yz(z0 + wv.head)}" x2="${x0 + wv.w * S * i / k}" y2="${Yz(z0 + wv.sill)}" stroke="${fr}" stroke-width="6"/>`);
        if (wv.sill > 0) o.push(`<rect x="${x0 - 6}" y="${Yz(z0 + wv.sill)}" width="${wv.w * S + 12}" height="6" fill="${acc}"/>`); }
      for (const d of L.doors.filter(d => d.ext && d.o === g.o && on(d.o === "h" ? d.y : d.x, d.c))) { const H = d.shop ? 2.6 : 2.2; o.push(`<rect x="${X(ux(d.c) - d.w / 2)}" y="${Yz(z0 + H)}" width="${d.w * S}" height="${H * S}" fill="${d.shop ? "#2a3a44" : d.main ? acc : "#6b4a2e"}" stroke="#111" stroke-width="4"/>`);
        if (d.shop) o.push(`<rect x="${X(ux(d.c) - d.w / 2 - .05)}" y="${Yz(z0 + H + .35)}" width="${(d.w + .1) * S}" height="${.3 * S}" fill="#8a8f93" stroke="#111" stroke-width="2"/>`); } }); }
  const nm = { S: "Façade principale (sud, sur rue)", N: "Façade arrière (nord)", W: "Façade latérale ouest", E: "Façade latérale est" }[side];
  const xr = X(len + T_EXT) + 70; [[-.2, "TN −0,20"], [0, "±0,00"], ...Array.from({ length: n - 1 }, (_, i) => [(i + 1) * LEVEL_H, "+" + f2((i + 1) * LEVEL_H)]), [top - .2, "+" + f2(top)]].forEach(([z, t]) => o.push(`<path d="M${xr} ${Yz(z)} l14 -14 h-28 z" fill="${INK}"/><text x="${xr + 26}" y="${Yz(z) + 8}" font-size="22" fill="${INK}">${t}</text>`));
  o.push(cartouche(vw, vh, title, nm, "Élévation indicative · 1/100")); o.push(`</svg>`); return o.join("");
}
export function sheetFacade(plan, side, style, title) {
  if (plan.blocks) return facadeComp(plan, side, style, title);
  const n = plan.levels.length, roof = style.roof, len = side === "S" || side === "N" ? plan.W : plan.D, S = 100, m = 260, top = n * LEVEL_H + .2, rh = roof === "hip" ? Math.min(plan.W, plan.D + 1.6) * .3 : .8;
  const vw = (len + 2 * T_EXT + 2) * S + 2 * m, vh = (top + rh + 1) * S + 2 * m + 120, X = x => m + (x + T_EXT + 1) * S, Yz = z => m + (top + rh - z) * S, o = [];
  const facCol = style.facade || "#eee", acc = style.accent || "#555", fr = style.frame || "#222";
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" font-family="Helvetica,Arial,sans-serif"><rect width="${vw}" height="${vh}" fill="#fff"/>`);
  o.push(`<line x1="${X(-1.5)}" y1="${Yz(-.2)}" x2="${X(len + 1.5)}" y2="${Yz(-.2)}" stroke="#5b4a35" stroke-width="4"/>`);
  o.push(`<rect x="${X(-T_EXT)}" y="${Yz(top)}" width="${(len + 2 * T_EXT) * S}" height="${(top + .2) * S}" fill="${facCol}" stroke="#111" stroke-width="3"/><rect x="${X(-T_EXT)}" y="${Yz(.25)}" width="${(len + 2 * T_EXT) * S}" height="${.45 * S}" fill="${style.plinth || "#777"}" opacity=".85"/>`);
  for (let l = 1; l < n; l++) o.push(`<rect x="${X(-T_EXT)}" y="${Yz(l * LEVEL_H + .2)}" width="${(len + 2 * T_EXT) * S}" height="${.2 * S}" fill="${acc}" opacity=".85"/>`);
  if (roof === "hip") { const ov = .8; o.push(`<path d="M${X(-T_EXT - ov)} ${Yz(top)} L${X(len * .3)} ${Yz(top + rh)} L${X(len * .7)} ${Yz(top + rh)} L${X(len + T_EXT + ov)} ${Yz(top)} Z" fill="${style.roofC || "#8a4a2a"}" stroke="#111" stroke-width="3"/>`); }
  else o.push(`<rect x="${X(-T_EXT)}" y="${Yz(top + .8)}" width="${(len + 2 * T_EXT) * S}" height="${.8 * S}" fill="${facCol}" stroke="#111" stroke-width="3"/><rect x="${X(-T_EXT - .05)}" y="${Yz(top + .86)}" width="${(len + 2 * T_EXT + .1) * S}" height="${.08 * S}" fill="${acc}"/>`);
  const at = side === "S" ? 0 : side === "N" ? plan.D : side === "W" ? 0 : plan.W, o2 = side === "S" || side === "N" ? "h" : "v", flip = side === "N" || side === "W";
  const ux = c => flip ? len - c : c;
  plan.levels.forEach((L, l) => { const z0 = l * LEVEL_H + .2;
    for (const w of L.wins.filter(w => w.o === o2 && near(w.at, at))) { const x0 = X(ux(w.c) - w.w / 2); o.push(`<rect x="${x0}" y="${Yz(z0 + w.head)}" width="${w.w * S}" height="${(w.head - w.sill) * S}" fill="#2a3a44" stroke="${fr}" stroke-width="8"/>`);
      const k = Math.max(1, Math.round(w.w / 1.1)); for (let i = 1; i < k; i++) o.push(`<line x1="${x0 + w.w * S * i / k}" y1="${Yz(z0 + w.head)}" x2="${x0 + w.w * S * i / k}" y2="${Yz(z0 + w.sill)}" stroke="${fr}" stroke-width="6"/>`);
      if (w.sill > 0) o.push(`<rect x="${x0 - 6}" y="${Yz(z0 + w.sill)}" width="${w.w * S + 12}" height="6" fill="${acc}"/>`); }
    for (const d of L.doors.filter(d => d.o === o2 && near(o2 === "h" ? d.y : d.x, at))) o.push(`<rect x="${X(ux(d.c) - d.w / 2)}" y="${Yz(z0 + 2.2)}" width="${d.w * S}" height="${2.2 * S}" fill="${d.main ? acc : "#6b4a2e"}" stroke="#111" stroke-width="4"/>`); });
  const nm = { S: "Façade principale (sud, sur rue)", N: "Façade arrière (nord)", W: "Façade latérale ouest", E: "Façade latérale est" }[side];
  const xr = X(len + T_EXT) + 70; [[-.2, "TN −0,20"], [0, "±0,00"], ...Array.from({ length: n - 1 }, (_, i) => [(i + 1) * LEVEL_H, "+" + f2((i + 1) * LEVEL_H)]), [top - .2, "+" + f2(top)], [top + (roof === "hip" ? rh : .8), "+" + f2(top + (roof === "hip" ? rh : .6))]].forEach(([z, t]) => o.push(`<path d="M${xr} ${Yz(z)} l14 -14 h-28 z" fill="${INK}"/><text x="${xr + 26}" y="${Yz(z) + 8}" font-size="22" fill="${INK}">${t}</text>`));
  o.push(cartouche(vw, vh, title, nm, "Élévation indicative · 1/100"));
  o.push(`</svg>`); return o.join("");
}

// ---------- 5. Réseaux (électricité inspirée de la NF C 15-100, plomberie) ----------
export function sheetReseaux(plan, l, fin, title) {
  const L = plan.levels[l];
  return svgPlan(plan, l, { furn: true, title, sheet: L.name + " — électricité &amp; plomberie", phase: "Plan de réseaux indicatif · 1/100", extra: ({ X, Yf }) => {
    const o = [], P = (x, y) => o.push(`<g transform="translate(${X(x)} ${Yf(y)})"><path d="M-14 0 a14 14 0 0 1 28 0" fill="none" stroke="${RED}" stroke-width="3"/><line x1="0" y1="0" x2="0" y2="10" stroke="${RED}" stroke-width="3"/></g>`),
      Lum = (x, y) => o.push(`<g transform="translate(${X(x)} ${Yf(y)})"><circle r="16" fill="#fff" stroke="${RED}" stroke-width="3"/><line x1="-11" y1="-11" x2="11" y2="11" stroke="${RED}" stroke-width="3"/><line x1="11" y1="-11" x2="-11" y2="11" stroke="${RED}" stroke-width="3"/></g>`),
      Int = (x, y) => o.push(`<g transform="translate(${X(x)} ${Yf(y)})"><circle r="8" fill="${RED}"/><line x1="0" y1="0" x2="14" y2="-14" stroke="${RED}" stroke-width="3"/></g>`),
      Eau = (x, y) => o.push(`<g transform="translate(${X(x)} ${Yf(y)})"><circle cx="-9" r="8" fill="${BLUE}"/><circle cx="9" r="8" fill="${RED}"/></g>`), Ev = (x, y) => o.push(`<rect x="${X(x) - 9}" y="${Yf(y) - 9}" width="18" height="18" fill="#6b4a2e"/>`);
    let nP = 0, nL = 0, nI = 0, nE = 0;
    for (const r of L.rooms) { if (r.stair) continue; const A = r.w * r.h;
      const want = r.k === "sejour" ? Math.max(5, Math.ceil(A / 4)) : /^(chp|ch|chdom)$/.test(r.k) ? 3 : r.k === "cuisine" ? 6 : /sdb|dch/.test(r.k) ? 1 : r.k === "couloir" ? 1 : /^wc/.test(r.k) ? 0 : 2;
      for (let i = 0; i < want; i++) { const t = (i + .5) / want, per = 2 * (r.w + r.h), d = t * per; let x, y; if (d < r.w) { x = r.x + d; y = r.y + .12; } else if (d < r.w + r.h) { x = r.x + r.w - .12; y = r.y + d - r.w; } else if (d < 2 * r.w + r.h) { x = r.x + r.w - (d - r.w - r.h); y = r.y + r.h - .12; } else { x = r.x + .12; y = r.y + r.h - (d - 2 * r.w - r.h); } P(x, y); nP++; }
      const nl = A > 25 ? 2 : 1; for (let i = 0; i < nl; i++) { Lum(r.x + r.w * (i + 1) / (nl + 1), r.y + r.h / 2); nL++; }
      const d = L.doors.find(d => L.rooms[d.ir] === r) || L.doors.find(d => d.o === "h" ? (near(d.y, r.y) || near(d.y, r.y + r.h)) && d.c > r.x && d.c < r.x + r.w : (near(d.x, r.x) || near(d.x, r.x + r.w)) && d.c > r.y && d.c < r.y + r.h);
      if (d) { const ix = d.o === "h" ? Math.min(r.x + r.w - .15, d.c + d.w / 2 + .15) : (near(d.x, r.x) ? r.x + .15 : r.x + r.w - .15), iy = d.o === "h" ? (near(d.y, r.y) ? r.y + .15 : r.y + r.h - .15) : Math.min(r.y + r.h - .15, d.c + d.w / 2 + .15); Int(ix, iy); nI++; }
      for (const f of furniture(r, L)) if (/douche|vasque|wc_cuv|lave_mains|machine/.test(f.t) || (f.t === "plan" && f.w * f.h > 1.2)) { const cx = f.x + f.w / 2, cy = f.y + f.h / 2; Eau(cx, cy); Ev(cx + .25, cy); nE++; } }
    const lx = X(0), ly = Yf(0) + 250; o.push(`<g font-size="22" fill="#222"><text x="${lx}" y="${ly}">Légende : </text>`);
    o.push(`<g transform="translate(${lx + 140} ${ly - 8})"><path d="M-14 0 a14 14 0 0 1 28 0" fill="none" stroke="${RED}" stroke-width="3"/></g><text x="${lx + 165}" y="${ly}">prise 16 A (${nP})</text>`);
    o.push(`<g transform="translate(${lx + 360} ${ly - 8})"><circle r="14" fill="#fff" stroke="${RED}" stroke-width="3"/></g><text x="${lx + 385}" y="${ly}">point lumineux (${nL})</text>`);
    o.push(`<g transform="translate(${lx + 640} ${ly - 8})"><circle r="8" fill="${RED}"/></g><text x="${lx + 660}" y="${ly}">interrupteur (${nI})</text>`);
    o.push(`<g transform="translate(${lx + 870} ${ly - 8})"><circle cx="-9" r="7" fill="${BLUE}"/><circle cx="9" r="7" fill="${RED}"/></g><text x="${lx + 895}" y="${ly}">eau froide / chaude (${nE})</text><rect x="${lx + 1180}" y="${ly - 17}" width="16" height="16" fill="#6b4a2e"/><text x="${lx + 1205}" y="${ly}">évacuation</text></g>`);
    return o.join(""); } });
}

// ---------- 6. Avant-métré (quantités, sans prix) ----------
export function metre(plan, roof, fin) {
  const comp = !!plan.blocks, st = structure(plan), n = plan.levels.length, W = plan.W, D = plan.D, BL = plan.blocks || [{ x: 0, y: 0, w: W, h: D }], emp = BL.reduce((a, b) => a + (b.w + 2 * T_EXT) * (b.h + 2 * T_EXT), 0) - (BL.length - 1) * 0, per = comp ? extSegs(plan.levels[0].rooms).reduce((a, g) => a + g.a1 - g.a0, 0) : 2 * (W + D), nc = st.cols.length, s = st.sem, J = joinery(plan, fin);
  let intLen = 0, open = 0, sol = 0, wet = 0, wetPer = 0, hab = 0;
  plan.levels.forEach(L => { const lines = new Map(); if (comp) for (const p of intSegs(L.rooms)) intLen += p.a1 - p.a0;
    for (const r of L.rooms) { sol += r.w * r.h; if (r.hab) hab += r.w * r.h; if (/sdb|dch|wc|sdh|san/.test(r.k)) { wet += r.w * r.h; wetPer += 2 * (r.w + r.h); }
      if (comp) continue;
      for (const sg of [[r.x, r.y, r.x + r.w, r.y], [r.x, r.y + r.h, r.x + r.w, r.y + r.h], [r.x, r.y, r.x, r.y + r.h], [r.x + r.w, r.y, r.x + r.w, r.y + r.h]]) { const hz = near(sg[1], sg[3]); if (hz ? (near(sg[1], 0) || near(sg[1], D)) : (near(sg[0], 0) || near(sg[0], W))) continue;
        const k = (hz ? "h" : "v") + (hz ? sg[1] : sg[0]).toFixed(2); if (!lines.has(k)) lines.set(k, []); lines.get(k).push(hz ? [sg[0], sg[2]] : [sg[1], sg[3]]); } }
    if (!comp) for (const iv of lines.values()) { iv.sort((a, b) => a[0] - b[0]); let [a, b] = iv[0]; for (const [c, d] of iv.slice(1)) { if (c <= b + 1e-3) b = Math.max(b, d); else { intLen += b - a; a = c; b = d; } } intLen += b - a; }
    for (const w of L.wins) open += w.w * (w.head - w.sill); for (const d of L.doors) if (!d.open) open += d.w * 2.1; });
  const extWall = per * WALL_H * n - plan.levels.reduce((a, L) => a + L.wins.reduce((b, w) => b + w.w * (w.head - w.sill), 0) + L.doors.filter(d => d.ext).reduce((b, d) => b + d.w * 2.2, 0), 0), intWall = intLen * WALL_H;
  const fouille = nc * (s + .2) * (s + .2) * 1.05, prop = nc * (s + .1) * (s + .1) * .05, semV = nc * s * s * .3, amorce = nc * .2 * .2 * 1.0, longr = st.beamLen * .2 * .4, soub = per * .6;
  const pot = nc * .2 * .2 * WALL_H * n, chain = (st.beamLen + per) * .2 * .2 * n, poutre = n > 1 ? st.beamLen * .2 * .4 * (n - 1) : 0, dallage = emp * .1, herisson = emp * .2, plancher = n > 1 ? emp * (n - 1) : 0, toit = roof === "hip" ? BL.reduce((a, b) => a + (b.w + 2 * T_EXT + 1.6) * (b.h + 2 * T_EXT + 1.6), 0) * 1.15 : emp;
  const ba = semV + amorce + longr + pot + chain + poutre + (n > 1 ? plancher * .1 : 0) + (roof !== "hip" ? toit * .1 : 0);
  const rows = [
    ["1", "TERRASSEMENTS & FONDATIONS"], ["1.1", "Fouilles en puits pour semelles", fouille, "m³"], ["1.2", "Béton de propreté 150 kg/m³ ép. 5 cm", prop, "m³"], ["1.3", `Semelles isolées BA 350 kg/m³ (${nc} u de ${cm(s)}×${cm(s)}×30)`, semV, "m³"],
    ["1.4", "Amorces de poteaux BA 20×20", amorce, "m³"], ["1.5", "Longrines BA 20×40", longr, "m³"], ["1.6", "Soubassement en agglos pleins de 15 (h. 0,60)", soub, "m²"], ["1.7", "Hérisson en pierres ép. 20 cm + film polyane + anti-termite", herisson, "m³"], ["1.8", "Dallage 10 cm dosé à 250 kg/m³", dallage, "m³"],
    ["2", "GROS ŒUVRE — ÉLÉVATION"], ["2.1", `Poteaux BA 20×20 (${nc} u × ${n} niveau${n > 1 ? "x" : ""})`, pot, "m³"], ["2.2", "Chaînages BA 20×20", chain, "m³"], ...(n > 1 ? [["2.3", n > 2 ? `Poutres BA 20×40 (${n - 1} planchers)` : "Poutres BA 20×40 (plancher haut RDC)", poutre, "m³"], ["2.4", "Plancher à corps creux 16+4", plancher, "m²"], ["2.5", "Escaliers en béton armé", Math.max(1, plan.levels[0].rooms.filter(r => r.stair).length), "u"]] : []),
    ["2.6", "Maçonnerie agglos creux de 20 (façades, ouvertures déduites)", extWall, "m²"], ["2.7", "Maçonnerie agglos creux de 10 (cloisons)", intWall, "m²"],
    ["3", "TOITURE"], roof === "hip" ? ["3.1", fin.toit === "bac" ? "Charpente métallique et couverture bac aluminium (débords compris)" : "Charpente et couverture tuiles (débords compris)", toit, "m²"] : ["3.1", "Dalle de toiture 16+4 + étanchéité multicouche", toit, "m²"], ...(roof === "hip" ? [] : [["3.2", "Acrotère h. 0,80 en agglos de 15 + couvertine", per, "ml"]]),
    ["4", "FINITIONS"], ["4.1", "Enduits intérieurs (2 faces des cloisons + face intérieure des façades)", intWall * 2 + extWall, "m²"], ["4.2", "Enduits extérieurs", extWall + (roof === "hip" ? 0 : per * .8), "m²"],
    ["4.3", `Revêtement de sol (${{ wood: "parquet", marble: "marbre", concrete: "béton ciré", terracotta: "terre cuite", tile: "carrelage" }[fin.sol] || "carrelage"})`, sol - wet, "m²"], ["4.4", "Carrelage antidérapant pièces d'eau", wet, "m²"], ["4.5", "Faïence murale h. 2,10 (pièces d'eau)", wetPer * 2.1, "m²"],
    ["4.6", "Peinture intérieure (murs + plafonds)", intWall * 2 + extWall + sol, "m²"], ...(+fin.staff ? [["4.7", "Staff : " + ["", "corniches", "faux plafonds à gorge lumineuse", "staff décoratif"][+fin.staff], +fin.staff === 1 ? plan.levels.reduce((a, L) => a + L.rooms.filter(r => r.hab).reduce((b, r) => b + 2 * (r.w + r.h), 0), 0) : hab, +fin.staff === 1 ? "ml" : "m²"]] : []),
    ["5", "MENUISERIES"], ...J.types.map((t, i) => [`5.${i + 1}`, `${t.id} — ${t.kind} ${cm(t.w)}×${cm(t.h)}`, t.n, "u"]),
  ];
  const cement = ba * .35 + prop * .15 + dallage * .25, agglo = (extWall + soub + intWall) * 12.5;
  return { rows, cement, agglo, ba };
}

// ---------- Planche de garde / hypothèses ----------
export function notesHTML(plan, roof, fin) {
  const M = metre(plan, roof, fin);
  return `<p><b>Hypothèses de prédimensionnement</b> (pratique courante en Côte d'Ivoire, à confirmer par un bureau d'études agréé après étude de sol) : fondations sur semelles isolées reliées par longrines 20×40 ; béton armé dosé à 350 kg/m³, béton de propreté à 150 kg/m³, dallage à 250 kg/m³ ; soubassement en agglos pleins de 15 ; murs de façade en agglos creux de 20, cloisons en agglos de 10 ; poteaux et chaînages 20×20 ; ${plan.levels.length > 1 ? "plancher à corps creux 16+4 ; " : ""}${roof === "hip" ? "charpente et couverture en tuiles." : "toit-terrasse en dalle 16+4 avec étanchéité et acrotère de 0,80 m."}</p>
  <p><b>Ordres de grandeur</b> : béton armé ≈ ${f1(M.ba)} m³ ; ciment pour les bétons ≈ ${f1(M.cement)} t (≈ ${Math.round(M.cement * 20)} sacs de 50 kg, hors mortiers et enduits) ; agglos ≈ ${Math.round(M.agglo / 50) * 50} unités (12,5 au m², format 40×20).</p>`;
}
