// ARCHÉA — export PDF autonome (aucune bibliothèque) : chaque planche est rendue en image haute définition
// puis assemblée dans un vrai fichier PDF A3 paysage (une page par planche).
const A3 = [1190.55, 841.89], PX = [3508, 2480]; // 300 dpi ≈ trop lourd sur mobile → on réduit plus bas
const DPI_PX = [2480, 1754]; // ≈ 150 dpi

export async function svgToJpeg(svg, title) {
  const img = new Image(); const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error("Planche illisible : " + title)); img.src = url; });
  const [W, H] = DPI_PX, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), iw = vb ? +vb[1] : img.width, ih = vb ? +vb[2] : img.height, m = 60, k = Math.min((W - 2 * m) / iw, (H - 2 * m) / ih);
  g.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  return canvasJpeg(c);
}
// page de texte / tableau (rendu canvas)
export function textPage(title, blocks, ncol = 2) {
  const [W, H] = DPI_PX, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), m = 120;
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.fillStyle = "#1d2a36"; g.font = "600 52px Georgia, serif"; g.fillText(title, m, m + 20);
  g.fillStyle = "#b8743d"; g.fillRect(m, m + 50, 220, 5);
  let y = m + 130, col = 0; const colW = ncol === 1 ? W - 2 * m : (W - 2 * m - 80) / 2, x0 = () => m + col * (colW + 80);
  const next = h => { if (y + h > H - m) { if (col === 0 && ncol === 2) { col = 1; y = m + 130; } else return false; } return true; };
  for (const b of blocks) {
    if (b.table) { const cols = b.cols, fs = 26, lh = 38, tot = cols.reduce((s, c) => s + c, 0), cw = cols.map(c => c / tot * colW);
      const row = (cells, bold, bg) => { g.font = `${bold ? "700 " : ""}${fs}px Helvetica, Arial, sans-serif`; const lines = cells.map((t, i) => wrap(g, String(t), cw[i] - 10)); const h = Math.max(...lines.map(l => l.length)) * lh + 8;
        if (!next(h)) return; if (bg) { g.fillStyle = bg; g.fillRect(x0(), y - 4, colW, h); } g.fillStyle = "#222"; let x = x0(); lines.forEach((ls, i) => { ls.forEach((t, j) => g.fillText(t, x + 4, y + fs + j * lh)); x += cw[i]; });
        g.strokeStyle = "#ccc"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0(), y + h - 2); g.lineTo(x0() + colW, y + h - 2); g.stroke(); y += h; };
      row(b.head, true, "#efe9df"); for (const r of b.rows) row(r.cells, r.bold, r.bold ? "#f6f2ea" : null); y += 30; continue; }
    g.font = `${b.bold ? "700 " : ""}${b.size || 28}px Helvetica, Arial, sans-serif`; g.fillStyle = b.color || "#222";
    for (const t of wrap(g, b.text, colW)) { if (!next(42)) break; g.fillText(t, x0(), y); y += (b.size || 28) * 1.45; } y += 18;
  }
  g.font = "22px Helvetica, Arial, sans-serif"; g.fillStyle = "#777"; g.fillText("ARCHÉA by CLB — document indicatif, à faire valider par un architecte inscrit à l'OACI et un bureau d'études", m, H - 60);
  return canvasJpeg(c);
}
function wrap(g, t, w) { const out = []; for (const para of String(t).split("\n")) { let line = ""; for (const word of para.split(/\s+/)) { const tst = line ? line + " " + word : word; if (g.measureText(tst).width > w && line) { out.push(line); line = word; } else line = tst; } out.push(line); } return out; }
async function canvasJpeg(c) { const b = await new Promise(r => c.toBlob(r, "image/jpeg", .86)); return { w: c.width, h: c.height, data: new Uint8Array(await b.arrayBuffer()) }; }

export function buildPDF(pages, title = "ARCHÉA") {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = x => { const u = typeof x === "string" ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); body(); push(`\nendobj\n`); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, () => push(`<< /Type /Catalog /Pages 2 0 R >>`));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  pages.forEach((p, i) => { const po = 3 + i * 3, co = po + 1, io = po + 2, [W, H] = A3;
    const s = Math.min(W / p.w, H / p.h), dw = p.w * s, dh = p.h * s, cs = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${((W - dw) / 2).toFixed(2)} ${((H - dh) / 2).toFixed(2)} cm /Im0 Do Q`;
    obj(po, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>`));
    obj(co, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(io, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`); push(p.data); push(`\nendstream`); }); });
  const infoN = 3 + n * 3; obj(infoN, () => push(`<< /Title (${title.replace(/[()\\]/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "")}) /Producer (ARCHEA by CLB) >>`));
  const xref = len; push(`xref\n0 ${infoN + 1}\n0000000000 65535 f \n`); for (let i = 1; i <= infoN; i++) push(String(offs[i]).padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size ${infoN + 1} /Root 1 0 R /Info ${infoN} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}
