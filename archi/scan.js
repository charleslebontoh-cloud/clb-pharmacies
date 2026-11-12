// ARCHÉA — lecture d'un croquis papier (photo) : détection de la silhouette bâtie, sans serveur ni IA.
// Méthode : seuillage local de l'encre → fermeture des petits trous → remplissage de l'extérieur depuis les bords →
// tout ce qui n'est pas « extérieur » est le bâti (murs + pièces fermées). La cour ouverte d'un L / U reste dehors.
async function load(file) { try { return await createImageBitmap(file); } catch (e) { return await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); }); } }
export async function scanSketch(file) {
  const img = await load(file), k = Math.min(1, 300 / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data, n = w * h, g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = .3 * d[4 * i] + .59 * d[4 * i + 1] + .11 * d[4 * i + 2];
  // moyenne locale (image intégrale) → encre = nettement plus sombre que le papier autour
  const I = new Float64Array((w + 1) * (h + 1)); for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) { s += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + s; } }
  const r = Math.max(8, Math.round(Math.max(w, h) / 10)); let ink = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    const m = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0)); if (g[y * w + x] < m * .74 && g[y * w + x] < 170) ink[y * w + x] = 1; }
  const dil = (src, rr) => { const o = new Uint8Array(n); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (src[y * w + x]) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) o[Y * w + X] = 1; } return o; };
  const comps = (mask, v) => { const lab = new Int32Array(n), out = []; let id = 0; const st = new Int32Array(n);
    for (let s = 0; s < n; s++) { if (mask[s] !== v || lab[s]) continue; id++; let sp = 0, a = 0, x0 = w, x1 = 0, y0 = h, y1 = 0; st[sp++] = s; lab[s] = id;
      while (sp) { const p = st[--sp], x = p % w, y = (p / w) | 0; a++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && mask[p - 1] === v && !lab[p - 1]) { lab[p - 1] = id; st[sp++] = p - 1; } if (x < w - 1 && mask[p + 1] === v && !lab[p + 1]) { lab[p + 1] = id; st[sp++] = p + 1; }
        if (y > 0 && mask[p - w] === v && !lab[p - w]) { lab[p - w] = id; st[sp++] = p - w; } if (y < h - 1 && mask[p + w] === v && !lab[p + w]) { lab[p + w] = id; st[sp++] = p + w; } }
      out.push({ id, a, x0, x1, y0, y1 }); } return { lab, out }; };
  let solid, best;
  for (let pass = 0; pass < 3; pass++) { const wall = dil(ink, 2), outside = new Uint8Array(n), st = new Int32Array(n); let sp = 0;
    const seed = p => { if (!wall[p] && !outside[p]) { outside[p] = 1; st[sp++] = p; } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); } for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (sp) { const p = st[--sp], x = p % w; if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1); if (p >= w) seed(p - w); if (p < n - w) seed(p + w); }
    solid = new Uint8Array(n); for (let i = 0; i < n; i++) solid[i] = outside[i] ? 0 : 1;
    const C = comps(solid, 1); best = C.out.sort((a, b) => b.a - a.a)[0]; if (!best) break;
    // bord de feuille / cadre de la photo pris pour un mur : on l'efface et on recommence
    if (best.x1 - best.x0 > w * .93 && best.y1 - best.y0 > h * .93) { for (let i = 0; i < n; i++) if (C.lab[i] === best.id && ink[i]) { const x = i % w, y = (i / w) | 0; let edge = 0; for (let t = 1; t <= 4 && !edge; t++) for (const q of [i - t, i + t, i - t * w, i + t * w]) if (q < 0 || q >= n || outside[q]) edge = 1; if (edge || x < 3 || y < 3 || x > w - 4 || y > h - 4) ink[i] = 0; } continue; }
    for (let i = 0; i < n; i++) if (C.lab[i] !== best.id) solid[i] = 0; break; }
  if (!best || best.a < n * .02) throw new Error("Je ne trouve pas de contour fermé. Dessine le contour du bâtiment d'un trait foncé et continu, sur une feuille blanche, et cadre la feuille entière.");
  // analyse dans la boîte englobante
  let { x0, x1, y0, y1 } = best; const bw = x1 - x0 + 1, bh = y1 - y0 + 1, fill = best.a / (bw * bh), empty = new Uint8Array(n).fill(2);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) empty[y * w + x] = solid[y * w + x] ? 0 : 1;
  // on érode le vide pour ignorer les liserés dus à une photo légèrement de travers (hors boîte = vide, la cour ouverte reste ouverte)
  const er = Math.max(2, Math.round(Math.min(bw, bh) * .08)), I2 = new Int32Array((w + 1) * (h + 1)); for (let y = 0; y < h; y++) { let q = 0; for (let x = 0; x < w; x++) { q += empty[y * w + x] === 0 ? 1 : 0; I2[(y + 1) * (w + 1) + x + 1] = I2[y * (w + 1) + x + 1] + q; } }
  const emptyE = new Uint8Array(n); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (empty[y * w + x] !== 1) continue; const a0 = Math.max(0, x - er), a1 = Math.min(w, x + er + 1), b0 = Math.max(0, y - er), b1 = Math.min(h, y + er + 1); if (I2[b1 * (w + 1) + a1] - I2[b0 * (w + 1) + a1] - I2[b1 * (w + 1) + a0] + I2[b0 * (w + 1) + a0] === 0) emptyE[y * w + x] = 1; }
  const E = comps(emptyE, 1).out.sort((a, b) => b.a - a.a)[0], mx = bw * .05 + 1, my = bh * .05 + 1;
  let geo = { forme: "bande", ar: bh / bw, tb: Math.min(bw, bh) / Math.max(bw, bh), tr: bh > bw * 1.25 ? 1 : 0 }, note = "";
  if (fill < .9 && E && E.a > bw * bh * .03) { const tL = E.x0 - x0 <= mx, tR = x1 - E.x1 <= mx, tT = E.y0 - y0 <= my, tB = y1 - E.y1 <= my, nt = tL + tR + tT + tB, ew = E.x1 - E.x0 + 1 + er * (!tL + !tR), eh = E.y1 - E.y0 + 1 + er * (!tT + !tB); if (!tL) E.x0 -= er; if (!tR) E.x1 += er; if (!tT) E.y0 -= er; if (!tB) E.y1 += er;
    if (nt === 2 && (tL || tR) && (tT || tB)) { geo = { forme: "L", side: tL ? "R" : "L", ar: bh / bw, tb: (bh - eh) / bw, ta: (bw - ew) / bw }; if (tB) note = "Sur ton dessin la cour donne sur la rue (bas de la feuille) : je la place à l'arrière, la barre principale sur rue."; }
    else if (nt === 1 || nt === 0) { const side = tL || tR; geo = side ? { forme: "U", ar: bw / bh, tb: (bw - ew) / bh, ta: ((E.y0 - y0) + (y1 - E.y1)) / 2 / bh } : { forme: "U", ar: bh / bw, tb: (bh - eh) / bw, ta: ((E.x0 - x0) + (x1 - E.x1)) / 2 / bw };
      if (nt === 0) note = "Cour entièrement fermée (patio) : je la traite comme un U ouvert à l'arrière."; else if (!tT) note = "Sur ton dessin la cour s'ouvre " + (tB ? "vers la rue (bas de la feuille)" : "sur le côté") + " : je la place à l'arrière, la barre principale sur rue."; } }
  // aperçu : photo + silhouette reconnue
  const pv = document.createElement("canvas"), ps = Math.min(1, 220 / Math.max(w, h)); pv.width = Math.round(w * ps); pv.height = Math.round(h * ps); const pc = pv.getContext("2d"); pc.drawImage(cv, 0, 0, pv.width, pv.height);
  const ov = cx.createImageData(w, h); for (let i = 0; i < n; i++) if (solid[i]) { ov.data[4 * i] = 176; ov.data[4 * i + 1] = 120; ov.data[4 * i + 2] = 72; ov.data[4 * i + 3] = 120; }
  const oc = document.createElement("canvas"); oc.width = w; oc.height = h; oc.getContext("2d").putImageData(ov, 0, 0); pc.drawImage(oc, 0, 0, pv.width, pv.height);
  for (const k2 of ["ar", "tb", "ta"]) if (geo[k2] != null) geo[k2] = Math.round(geo[k2] * 1000) / 1000;
  return { geo, note, prev: pv.toDataURL("image/jpeg", .7) };
}
