// ARCHÉA — maquette 3D réaliste (Three.js, PBR, ciel physique, ombres)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { furniture, LEVEL_H, WALL_H, T_EXT, T_INT } from './plan.js';

// ---------- Styles de décor ----------
export const STYLES = {
  tropical: { n: "Moderne tropical", d: "Façade blanche, bois et claustras, toit plat, grands carreaux clairs", facade: "#f1ede4", accent: "#8a5a36", roof: "flat", roofC: "#d9d4ca", floor: "tile", floorC: "#e2d8c6", wall: "#f5f1ea", fabric: "#c9b79c", wood: "#8a5a36", frame: "#2b2b2b", sw: ["#f1ede4", "#8a5a36", "#e2d8c6", "#6f8f5a"] },
  contemporain: { n: "Contemporain minimaliste", d: "Gris, béton ciré, menuiseries noires, toit-terrasse", facade: "#d7d7d3", accent: "#8c8c88", roof: "flat", roofC: "#9a9a96", floor: "concrete", floorC: "#b9b8b3", wall: "#eeeeec", fabric: "#5a6470", wood: "#3a3a3a", frame: "#141414", sw: ["#d7d7d3", "#8c8c88", "#141414", "#5a6470"] },
  afro: { n: "Afro-chic", d: "Terre cuite, bois sombre, motifs bogolan, toiture à quatre pans", facade: "#c9875a", accent: "#3b2a1e", roof: "hip", roofC: "#7a3b22", floor: "terracotta", floorC: "#b8673e", wall: "#ead6b8", fabric: "#a9532d", wood: "#5a3a22", frame: "#3b2a1e", pattern: 1, sw: ["#c9875a", "#3b2a1e", "#a9532d", "#ead6b8"] },
  luxe: { n: "Luxe néo-classique", d: "Crème et or, marbre blanc, toiture ardoise", facade: "#efe6d6", accent: "#b8923a", roof: "hip", roofC: "#4a4f55", floor: "marble", floorC: "#f1efea", wall: "#f4efe6", fabric: "#e8dcc8", wood: "#2f2a26", frame: "#b8923a", sw: ["#efe6d6", "#b8923a", "#f1efea", "#2f2a26"] },
  medit: { n: "Méditerranéen", d: "Blanc éclatant, bleu, tuiles en terre cuite", facade: "#ffffff", accent: "#2f6fa3", roof: "hip", roofC: "#b5552e", floor: "terracotta", floorC: "#c27a4d", wall: "#fbfaf6", fabric: "#2f6fa3", wood: "#a87a4f", frame: "#2f6fa3", sw: ["#ffffff", "#2f6fa3", "#b5552e", "#c27a4d"] },
  indus: { n: "Industriel", d: "Brique, acier noir, parquet chêne, cuir", facade: "#8f4a35", accent: "#1b1b1b", roof: "flat", roofC: "#5a5a58", floor: "wood", floorC: "#9b7448", wall: "#e9e4dc", fabric: "#6b4a33", wood: "#2a2a2a", frame: "#1b1b1b", brick: 1, sw: ["#8f4a35", "#1b1b1b", "#9b7448", "#6b4a33"] },
};

// ---------- Textures procédurales ----------
const texCache = new Map();
function ctex(key, w, h, draw, srgb = true) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t); return t;
}
function grain(g, w, h, a) { const im = g.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(im, 0, 0); }
const hex = c => new THREE.Color(c);
function shade(c, k) { const x = hex(c); x.multiplyScalar(k); return "#" + x.getHexString(); }
function floorTex(kind, col) {
  return ctex("f" + kind + col, 512, 512, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    if (kind === "tile" || kind === "terracotta") { const n = kind === "tile" ? 2 : 4, s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = shade(col, .93 + Math.random() * .12); g.fillRect(x * s, y * s, s, s); } grain(g, w, h, kind === "tile" ? 8 : 22); g.fillStyle = shade(col, .7); for (let i = 0; i <= n; i++) { g.fillRect(i * s - 2, 0, 4, h); g.fillRect(0, i * s - 2, w, 4); } }
    else if (kind === "wood") { const n = 8, s = h / n; for (let y = 0; y < n; y++) { const off = (y % 2) * w / 2; g.fillStyle = shade(col, .85 + Math.random() * .3); g.fillRect(0, y * s, w, s); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,20,5,${Math.random() * .12})`; g.beginPath(); const yy = y * s + Math.random() * s; g.moveTo(0, yy); g.bezierCurveTo(w / 3, yy + 3, 2 * w / 3, yy - 3, w, yy); g.stroke(); } g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, y * s, w, 2); g.fillRect(off, y * s, 2, s); } }
    else if (kind === "marble") { grain(g, w, h, 6); for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(110,110,115,${.08 + Math.random() * .18})`; g.lineWidth = .5 + Math.random() * 2; g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (Math.random() - .5) * 40; y += 20; g.lineTo(x, y); } g.stroke(); } g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(w / 2 - 1, 0, 2, h); g.fillRect(0, h / 2 - 1, w, 2); }
    else { grain(g, w, h, 14); for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .05})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 60, 0, 7); g.fill(); } }
  });
}
function plasterTex(col, brick) {
  return ctex("p" + col + brick, 256, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h);
    if (brick) { const bh = h / 8, bw = w / 3; for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) { g.fillStyle = shade(col, .82 + Math.random() * .3); g.fillRect(x * bw + (y % 2) * bw / 2 + 2, y * bh + 2, bw - 4, bh - 4); } grain(g, w, h, 18); }
    else { grain(g, w, h, 10); } });
}
function bogolan(col) { return ctex("bg" + col, 256, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.strokeStyle = "#f3e6cf"; g.lineWidth = 4; for (let y = 16; y < h; y += 42) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + (x / 16 % 2 ? 8 : -8)); g.stroke(); } g.fillStyle = "#2a1a10"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 6, 6); }); }
function grassTex() { return ctex("grass", 512, 512, (g, w, h) => { g.fillStyle = "#5f7d3e"; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { g.fillStyle = `hsl(${85 + Math.random() * 25},${35 + Math.random() * 25}%,${22 + Math.random() * 22}%)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 3 + Math.random() * 4); } }); }
function paveTex() { return ctex("pave", 256, 256, (g, w, h) => { g.fillStyle = "#b8b2a6"; g.fillRect(0, 0, w, h); const s = 32; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s * 2) { g.fillStyle = shade("#b8b2a6", .85 + Math.random() * .25); g.fillRect(x + (y / s % 2) * s + 1, y + 1, s * 2 - 2, s - 2); } grain(g, w, h, 12); }); }
function tileRoofTex(col) { return ctex("rt" + col, 256, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, y, w, 3); for (let x = (y / 16 % 2) * 12; x < w; x += 24) { g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(x, y, 2, 16); } } grain(g, w, h, 16); }); }

// ---------- Moteur ----------
export function createViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .82;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 600);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .495; controls.minDistance = .3; controls.maxDistance = 140;
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .35;
  const sky = new Sky(); sky.scale.setScalar(2000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.4; su.mieCoefficient.value = .005; su.mieDirectionalG.value = .8;
  const sun = new THREE.DirectionalLight(0xfff2e0, 3.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5040, .55); scene.add(hemi);
  let root = new THREE.Group(); scene.add(root);
  let state = { plan: null, style: STYLES.tropical, roof: true, upper: true, hour: 15, rooms: [] };
  const groups = { levels: [], roof: null };

  function resize() { const r = canvas.getBoundingClientRect(); const w = Math.max(100, r.width), h = Math.max(100, r.height); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  function setSun(hour) {
    state.hour = hour; const lat = 5.35 * Math.PI / 180, doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
    const dec = -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI / 365 * (doy + 10)), H = (hour - 12) * 15 * Math.PI / 180;
    const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)); // depuis le sud, positif vers l'ouest
    // repère : nord = -z, est = +x, sud = +z
    const dir = new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    su.sunPosition.value.copy(dir);
    const c = state.plan ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3();
    sun.position.copy(c).addScaledVector(dir, 60); sun.target.position.copy(c);
    const lowK = Math.max(0, Math.min(1, el / .5));
    sun.intensity = el > 0 ? 3.4 * (.35 + .65 * lowK) : 0; sun.color.setHSL(.09 - .03 * (1 - lowK), .6 * (1 - lowK) + .2, .62 + .2 * lowK);
    hemi.intensity = .25 + .45 * Math.max(0, Math.sin(el)); renderer.toneMappingExposure = el > 0 ? .78 : .5;
  }

  const M = {};
  function mats(st) {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    M.facade = std({ map: plasterTex(st.facade, st.brick), roughness: .88 });
    M.wallIn = std({ map: plasterTex(st.wall), roughness: .9 });
    M.accent = std({ color: st.accent, roughness: .55, metalness: st.accent === "#b8923a" ? .6 : 0 });
    M.floor = std({ map: floorTex(st.floor, st.floorC), roughness: st.floor === "marble" ? .18 : st.floor === "concrete" ? .45 : st.floor === "wood" ? .55 : .38 });
    M.wet = std({ map: floorTex("tile", "#dfe4e6"), roughness: .25 });
    M.slab = std({ color: "#d8d4cc", roughness: .9 });
    M.roof = st.roof === "flat" ? std({ color: st.roofC, roughness: .95 }) : std({ map: tileRoofTex(st.roofC), roughness: .8 });
    M.glass = new THREE.MeshPhysicalMaterial({ color: "#9fb8c4", roughness: .04, metalness: .1, transparent: true, opacity: .28, envMapIntensity: 1.6 });
    M.frame = std({ color: st.frame, roughness: .4, metalness: .5 });
    M.door = std({ map: floorTex("wood", st.wood), roughness: .5 });
    M.fabric = std({ color: st.fabric, map: st.pattern ? bogolan(st.fabric) : null, roughness: .95 });
    M.wood = std({ map: floorTex("wood", st.wood), roughness: .55 });
    M.white = std({ color: "#f4f4f2", roughness: .3 });
    M.ceramic = std({ color: "#fafafa", roughness: .12 });
    M.dark = std({ color: "#1c1c1e", roughness: .35, metalness: .3 });
    M.counter = std({ color: st.floor === "marble" ? "#efece6" : "#2d2d2f", roughness: .2 });
    M.metal = std({ color: "#b8bcc0", roughness: .25, metalness: .9 });
    M.grass = std({ map: grassTex(), roughness: 1 }); M.pave = std({ map: paveTex(), roughness: .85 });
    M.water = new THREE.MeshPhysicalMaterial({ color: "#2aa5c9", roughness: .03, metalness: 0, transparent: true, opacity: .82, envMapIntensity: 2 });
    M.poolTile = std({ color: "#7fd0e6", roughness: .3 });
    M.leaf = std({ color: "#3f6b2e", roughness: .9, flatShading: true }); M.leaf2 = std({ color: "#5b8a3a", roughness: .9, flatShading: true }); M.trunk = std({ color: "#5c4330", roughness: .95 });
    M.fence = std({ map: plasterTex("#e3ddd2"), roughness: .9 });
    M.bed = std({ color: "#f2efe9", roughness: .9 });
    M.grille = std({ color: st.frame, roughness: .45, metalness: .6, alphaTest: .5, side: THREE.DoubleSide, map: ctex("grille", 128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#fff"; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 6, h); g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8); g.fillRect(0, h / 2 - 3, w, 6); }) });
  }

  function box(w, h, d, m, x, y, z, parent, cast = true) { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(x, y, z); g.castShadow = cast; g.receiveShadow = true; (parent || root).add(g); return g; }

  // mur avec ouvertures (le long de x ou de z)
  function wall(axis, a0, a1, fixed, y0, t, m, holes, parent, mOut) {
    holes = holes.filter(h => h.c + h.w / 2 > a0 + .01 && h.c - h.w / 2 < a1 - .01).sort((p, q) => p.c - q.c);
    const piece = (b0, b1, h0, h1) => { if (b1 - b0 < .005 || h1 - h0 < .005) return; const L = b1 - b0, H = h1 - h0, c = (b0 + b1) / 2;
      const mm = mOut ? [mOut, m] : m;
      if (axis === "x") { const g = box(L, H, t, m, c, y0 + h0 + H / 2, fixed, parent); if (mOut) g.material = [m, m, m, m, mOut.z > 0 ? mOut.m : m, mOut.z < 0 ? mOut.m : m]; }
      else { const g = box(t, H, L, m, fixed, y0 + h0 + H / 2, c, parent); if (mOut) g.material = [mOut.x > 0 ? mOut.m : m, mOut.x < 0 ? mOut.m : m, m, m, m, m]; } };
    let cur = a0;
    for (const h of holes) { const s = Math.max(a0, h.c - h.w / 2), e = Math.min(a1, h.c + h.w / 2); piece(cur, s, 0, WALL_H); if (h.sill > 0) piece(s, e, 0, h.sill); piece(s, e, h.head, WALL_H); cur = e;
      // menuiserie
      if (h.win) { const L = e - s, H = h.head - h.sill, cy = y0 + h.sill + H / 2, c = (s + e) / 2;
        const gl = axis === "x" ? box(L, H, .02, M.glass, c, cy, fixed, parent, false) : box(.02, H, L, M.glass, fixed, cy, c, parent, false); gl.renderOrder = 2;
        const fr = (w, hh, x, y) => axis === "x" ? box(w, hh, .07, M.frame, x, y, fixed, parent, false) : box(.07, hh, w, M.frame, fixed, y, x, parent, false);
        fr(L, .05, c, y0 + h.sill + .025); fr(L, .05, c, y0 + h.head - .025); fr(.05, H, s + .025, cy); fr(.05, H, e - .025, cy); if (L > 1.2) fr(.04, H, c, cy);
        if (h.sill > 0) { const sill = axis === "x" ? box(L + .1, .04, t + .12, M.accent, c, y0 + h.sill - .02, fixed, parent) : box(t + .12, .04, L + .1, M.accent, fixed, y0 + h.sill - .02, c, parent); } }
      if (h.door && !h.open) { const L = e - s, c = (s + e) / 2, H = h.head; const leaf = new THREE.Mesh(new THREE.BoxGeometry(L - .04, H - .02, .04), h.main ? M.accent : M.door); leaf.castShadow = true;
        const pv = new THREE.Group(); (parent || root).add(pv); leaf.position.set((L - .04) / 2, H / 2, 0); pv.add(leaf);
        if (axis === "x") { pv.position.set(s + .02, y0, fixed); pv.rotation.y = -0.5 * (h.dir || 1); } else { pv.position.set(fixed, y0, s + .02); pv.rotation.y = Math.PI / 2 - .5 * (h.dir || 1); }
        const hd = new THREE.Mesh(new THREE.BoxGeometry(.12, .02, .02), M.metal); hd.position.set(L - .15, 1.05, .04); pv.add(hd); }
    }
    piece(cur, a1, 0, WALL_H);
  }

  function furn3d(f, y0, parent) {
    const cx = f.x + f.w / 2, cz = f.y + f.h / 2, P = (x, z) => [X(x), Z(z)];
    const [x, z] = P(cx, cz), W = f.w, D = f.h, g = new THREE.Group(); g.position.set(x, y0, z); parent.add(g);
    const b = (w, h, d, m, px, py, pz) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(px, py, pz); k.castShadow = true; k.receiveShadow = true; g.add(k); return k; };
    // repère plan → monde : x→x, y(plan)→-z
    switch (f.t) {
      case "lit": b(W, .32, D, M.wood, 0, .16, 0); b(W - .06, .2, D - .1, M.bed, 0, .42, .02); b(W, .9, .08, M.wood, 0, .45, -D / 2 + .04); b(W * .4, .12, .35, M.white, -W * .22, .58, -D / 2 + .3); b(W * .4, .12, .35, M.white, W * .22, .58, -D / 2 + .3); b(W - .04, .06, D * .45, M.fabric, 0, .55, D * .25); break;
      case "canape": { const lg = W > D, L = lg ? W : D, d = lg ? D : W, gg = new THREE.Group(); g.add(gg); if (!lg) gg.rotation.y = Math.PI / 2;
        const bb = (w, h, dd, px, py, pz) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), M.fabric); k.position.set(px, py, pz); k.castShadow = true; gg.add(k); };
        bb(L, .42, d, 0, .21, 0); bb(L, .45, .2, 0, .62, d / 2 - .1); bb(.18, .25, d, -L / 2 + .09, .55, 0); bb(.18, .25, d, L / 2 - .09, .55, 0); break; }
      case "table_basse": b(W, .06, D, M.wood, 0, .4, 0); b(W - .1, .36, D - .1, M.dark, 0, .2, 0); break;
      case "meuble_tv": b(W, .45, D, M.wood, 0, .225, 0); b(W * .7, .62, .05, M.dark, 0, 1.05, 0); break;
      case "fauteuil": b(W, .42, D, M.fabric, 0, .21, 0); b(W, .45, .16, M.fabric, 0, .65, -D / 2 + .08); break;
      case "table": { b(W, .05, D, M.wood, 0, .75, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(.06, .73, .06, M.wood, sx * (W / 2 - .08), .365, sz * (D / 2 - .08));
        for (let i = 0; i < 3; i++) for (const sz of [-1, 1]) { const cx2 = -W / 2 + W * (.18 + i * .32); b(.42, .05, .42, M.fabric, cx2, .46, sz * (D / 2 + .25)); b(.42, .45, .05, M.fabric, cx2, .7, sz * (D / 2 + .45)); } break; }
      case "plan": b(W, .86, D, M.white, 0, .43, 0); b(W, .04, D + .02, M.counter, 0, .88, 0); break;
      case "ilot": b(W, .88, D, M.wood, 0, .44, 0); b(W + .05, .04, D + .05, M.counter, 0, .9, 0); break;
      case "douche": b(W, .05, D, M.ceramic, 0, .025, 0); { const gl = b(.01, 2, D, M.glass, -W / 2, 1, 0); gl.castShadow = false; } break;
      case "wc_cuv": b(W, .4, D * .7, M.ceramic, 0, .2, D * .1); b(W, .35, .16, M.ceramic, 0, .55, -D / 2 + .08); break;
      case "vasque": b(W, .82, D, M.wood, 0, .41, 0); b(W, .04, D, M.ceramic, 0, .84, 0); break;
      case "armoire": b(W, 2.2, D, M.wood, 0, 1.1, 0); break;
      case "chevet": b(W, .5, D, M.wood, 0, .25, 0); break;
      case "bureau_t": b(W, .04, D, M.wood, 0, .74, 0); b(.04, .72, D, M.dark, -W / 2 + .03, .36, 0); b(.04, .72, D, M.dark, W / 2 - .03, .36, 0); break;
      case "biblio": b(W, 2, D, M.wood, 0, 1, 0); break;
      case "machine": b(W, .85, D, M.white, 0, .425, 0); break;
    }
  }

  let X = x => x, Z = y => y;
  function build(plan, st = state.style) {
    state.plan = plan; state.style = st; scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); root = new THREE.Group(); scene.add(root); groups.levels = []; state.rooms = [];
    mats(st);
    const { W, D, site } = plan, Lp = site.L, Pp = site.P;
    // repère monde : centre de la parcelle en (0,0) ; façade avant (y=0) vers +z (sud)
    const ox = -Lp / 2 + site.ox, oz = Pp / 2 - site.oy;
    X = x => ox + x; Z = y => oz - y;
    // terrain, allées, clôture
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(Lp, Pp), M.grass); M.grass.map.repeat.set(Lp / 4, Pp / 4); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
    const big = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: "#7f8264", roughness: 1 })); big.rotation.x = -Math.PI / 2; big.position.y = -.02; big.receiveShadow = true; root.add(big);
    M.pave.map.repeat.set(2, 2);
    const terr = new THREE.Mesh(new THREE.BoxGeometry(Math.min(W, 8), .08, 2.8), M.pave); terr.position.set(X(W / 2), .04, Z(-1.4)); terr.receiveShadow = true; root.add(terr);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(1.4, .06, site.oy), M.pave); walk.position.set(X(1.5), .03, Pp / 2 - site.oy / 2); walk.receiveShadow = true; root.add(walk);
    const fh = 2.1, ft = .2;
    [[0, Pp / 2 - ft / 2, Lp, ft], [0, -Pp / 2 + ft / 2, Lp, ft], [-Lp / 2 + ft / 2, 0, ft, Pp], [Lp / 2 - ft / 2, 0, ft, Pp]].forEach(([x, z, w, d], i) => {
      if (i === 0) { const gx = X(1.5), gw = 3.5; const l = (gx - gw / 2) - (-Lp / 2), r = Lp / 2 - (gx + gw / 2);
        // clôture sur rue : muret + grille ajourée
        for (const [len, cx] of [[l, -Lp / 2 + l / 2], [r, Lp / 2 - r / 2]]) { if (len < .1) continue; box(len, .9, d, M.fence, cx, .45, z); box(len, .06, d + .04, M.accent, cx, .93, z);
          const gr = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1), M.grille.clone()); gr.material.map = M.grille.map.clone(); gr.material.map.repeat.set(len / .6, 1); gr.material.map.needsUpdate = true; gr.position.set(cx, 1.51, z); gr.castShadow = true; root.add(gr);
          box(len, .05, .05, M.frame, cx, 2.06, z, root, false); }
        const gt = new THREE.Mesh(new THREE.PlaneGeometry(gw, 1.95), M.grille.clone()); gt.material.map = M.grille.map.clone(); gt.material.map.repeat.set(gw / .6, 1); gt.material.map.needsUpdate = true; gt.position.set(gx, 1.0, z); gt.castShadow = true; root.add(gt); box(gw, .06, .06, M.frame, gx, 1.98, z, root, false); } else box(w, fh, d, M.fence, x, fh / 2, z); });
    // piscine
    const p = plan.p;
    if (p.piscine) { const back = Pp - site.oy - D - 1; const pw = Math.min(8, W * .7), pd = 4; const inBack = back > pd + 2;
      const pz = inBack ? Z(D + 1 + pd / 2 + .5) : Pp / 2 - site.oy / 2, px = inBack ? X(W / 2) : X(W - pw / 2 - .5);
      if (inBack || site.oy > pd + 1.5) { box(pw + 1.2, .1, pd + 1.2, M.pave, px, .05, pz, root, false); const w = new THREE.Mesh(new THREE.BoxGeometry(pw, .05, pd), M.water); w.position.set(px, .06, pz); root.add(w); box(pw, .02, pd, M.poolTile, px, -.01, pz, root, false); } }
    // garage
    if (p.garage) { const gw = 3.6, gd = 6, sideR = Lp / 2 - X(W) - .2; const right = sideR > gw + .3; const gx = right ? X(W) + gw / 2 + .1 : X(0) - gw / 2 - .1; const gz = Z(gd / 2);
      if (Math.max(sideR, X(0) - (-Lp / 2) - .2) > gw + .2) { box(gw, 2.7, gd, M.facade, gx, 1.35, gz); box(gw + .3, .2, gd + .3, M.roof, gx, 2.8, gz); box(gw - .5, 2.2, .06, M.accent, gx, 1.1, gz + gd / 2 + .01);
        const dr = new THREE.Mesh(new THREE.BoxGeometry(gw - .4, .05, site.oy), M.pave); dr.position.set(gx, .03, Pp / 2 - site.oy / 2); dr.receiveShadow = true; root.add(dr); } }
    // arbres
    const tree = (x, z, s) => { const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g); const t = new THREE.Mesh(new THREE.CylinderGeometry(.12 * s, .18 * s, 2.6 * s, 8), M.trunk); t.position.y = 1.3 * s; t.castShadow = true; g.add(t);
      for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry((.9 + Math.random() * .6) * s, 1), i % 2 ? M.leaf : M.leaf2); c.position.set((Math.random() - .5) * 1.4 * s, (2.8 + Math.random() * 1.1) * s, (Math.random() - .5) * 1.4 * s); c.castShadow = true; g.add(c); } };
    const rnd = (a, b) => a + Math.random() * (b - a);
    tree(-Lp / 2 + 1.6, Pp / 2 - 1.6, 1.1); tree(Lp / 2 - 1.6, Pp / 2 - 1.8, .9); tree(-Lp / 2 + 1.5, -Pp / 2 + 1.8, 1.2); tree(Lp / 2 - 1.8, -Pp / 2 + 1.5, 1);
    // niveaux
    plan.levels.forEach((L, l) => {
      const g = new THREE.Group(); root.add(g); groups.levels.push(g); const y0 = l * LEVEL_H;
      // dalle
      box(W + 2 * T_EXT, .2, D + 2 * T_EXT, M.slab, X(W / 2), y0 + .1, Z(D / 2), g);
      for (const r of L.rooms) { state.rooms.push({ r, l });
        const wet = /sdb|wc|dch|buand/.test(r.k) || (r.k === "cuisine" && false);
        const sc = wet ? .6 : st.floor === "wood" ? 1.6 : st.floor === "terracotta" ? .8 : st.floor === "marble" ? 1.2 : 1.2, pg = new THREE.PlaneGeometry(r.w, r.h), uv = pg.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r.w / sc, uv.getY(i) * r.h / sc);
        const fl = new THREE.Mesh(pg, wet ? M.wet : M.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(X(r.x + r.w / 2), y0 + .201, Z(r.y + r.h / 2)); fl.receiveShadow = true; g.add(fl);
        for (const f of furniture(r)) furn3d(f, y0 + .2, g);
        if (r.stair) { const n = 16, run = r.h - .4; for (let i = 0; i < n; i++) box(r.w * .45, .18 * (i + 1), run / n, M.wood, X(r.x + r.w * .27), y0 + .2 + .09 * (i + 1), Z(r.y + .2 + run * (i + .5) / n), g); }
      }
      // ouvertures
      const yb = y0 + .2;
      const holesH = Y => [...L.wins.filter(w => w.o === "h" && near(w.at, Y)).map(w => ({ c: w.c, w: w.w, sill: w.sill, head: w.head, win: 1 })), ...L.doors.filter(d => d.o === "h" && near(d.y, Y)).map(d => ({ c: d.c, w: d.w, sill: 0, head: d.open ? 2.4 : 2.1, door: 1, open: d.open, main: d.main }))];
      const holesV = Xv => [...L.wins.filter(w => w.o === "v" && near(w.at, Xv)).map(w => ({ c: w.c, w: w.w, sill: w.sill, head: w.head, win: 1 })), ...L.doors.filter(d => d.o === "v" && near(d.x, Xv)).map(d => ({ c: d.c, w: d.w, sill: 0, head: 2.1, door: 1 }))];
      // façades (enduit extérieur)
      const holesWX = (Y) => holesH(Y).map(h => ({ ...h, c: X(h.c) }));
      const holesWZ = (Xv) => holesV(Xv).map(h => ({ ...h, c: Z(h.c) }));
      wall("x", X(0) - T_EXT, X(W) + T_EXT, Z(0) + T_EXT / 2, yb, T_EXT, M.wallIn, holesWX(0), g, { m: M.facade, z: 1 });
      wall("x", X(0) - T_EXT, X(W) + T_EXT, Z(D) - T_EXT / 2, yb, T_EXT, M.wallIn, holesWX(D), g, { m: M.facade, z: -1 });
      const zr = h => ({ ...h, c: h.c }); // z décroît quand y augmente : on trie en z
      wall("z", Z(D), Z(0), X(0) - T_EXT / 2, yb, T_EXT, M.wallIn, holesWZ(0), g, { m: M.facade, x: -1 });
      wall("z", Z(D), Z(0), X(W) + T_EXT / 2, yb, T_EXT, M.wallIn, holesWZ(W), g, { m: M.facade, x: 1 });
      // cloisons (dédoublonnées)
      const seen = new Set();
      for (const r of L.rooms) for (const s of [[r.x, r.y, r.x + r.w, r.y], [r.x, r.y + r.h, r.x + r.w, r.y + r.h], [r.x, r.y, r.x, r.y + r.h], [r.x + r.w, r.y, r.x + r.w, r.y + r.h]]) {
        const hz = near(s[1], s[3]); if (hz && (near(s[1], 0) || near(s[1], D))) continue; if (!hz && (near(s[0], 0) || near(s[0], W))) continue;
        const key = s.map(v => v.toFixed(2)).join(","); if (seen.has(key)) continue; seen.add(key);
        if (hz) wall("x", X(s[0]), X(s[2]), Z(s[1]), yb, T_INT, M.wallIn, holesH(s[1]).map(h => ({ ...h, c: X(h.c) })), g);
        else wall("z", Z(s[3]), Z(s[1]), X(s[0]), yb, T_INT, M.wallIn, holesV(s[0]).map(h => ({ ...h, c: Z(h.c) })), g);
      }
      // bandeau / acrotère décoratif
      ring(W, D, .18, .14, M.accent, yb + WALL_H + .09, g);
    });
    // toiture
    const top = plan.levels.length * LEVEL_H + .2; const rg = new THREE.Group(); root.add(rg); groups.roof = rg;
    if (st.roof === "flat") { box(W + 2 * T_EXT, .25, D + 2 * T_EXT, M.roof, X(W / 2), top + .1, Z(D / 2), rg); const h = .7, t = .2;
      box(W + 2 * T_EXT, h, t, M.facade, X(W / 2), top + h / 2 + .2, Z(0) + T_EXT - t / 2, rg); box(W + 2 * T_EXT, h, t, M.facade, X(W / 2), top + h / 2 + .2, Z(D) - T_EXT + t / 2, rg);
      box(t, h, D + 2 * T_EXT, M.facade, X(0) - T_EXT + t / 2, top + h / 2 + .2, Z(D / 2), rg); box(t, h, D + 2 * T_EXT, M.facade, X(W) + T_EXT - t / 2, top + h / 2 + .2, Z(D / 2), rg);
      ring(W, D, .08, .26, M.accent, top + .94, rg);
      // auvent sur la terrasse
      box(Math.min(W, 8) + .4, .15, 2.6, M.accent, X(W / 2), WALL_H + .1, Z(-1.3), rg); }
    else { const ov = .7, a = W + 2 * ov, b = D + 2 * ov, hgt = Math.min(a, b) * .32, x0 = X(-ov), x1 = X(W + ov), z0 = Z(-ov), z1 = Z(D + ov), cz = (z0 + z1) / 2, rl = (a - b) / 2;
      const r0 = [X(W / 2) - rl, top + hgt, cz], r1 = [X(W / 2) + rl, top + hgt, cz];
      const v = [x0, top, z0, x1, top, z0, x1, top, z1, x0, top, z1, ...r0, ...r1];
      const idx = [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 3, 0, 4, 1, 2, 5];
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const uv = []; for (let i = 0; i < v.length; i += 3) uv.push(v[i] / 2, (v[i + 2] + v[i + 1]) / 2); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      const rm = new THREE.Mesh(geo, M.roof); rm.material.side = THREE.DoubleSide; rm.castShadow = true; rm.receiveShadow = true; rg.add(rm);
      box(a, .12, b, M.slab, X(W / 2), top - .06, cz, rg); box(Math.min(W, 8) + .4, .15, 2.6, M.roof, X(W / 2), WALL_H + .1, Z(-1.3), rg); }
    // poteaux de terrasse
    for (const sx of [-1, 1]) box(.18, WALL_H, .18, M.accent, X(W / 2) + sx * (Math.min(W, 8) / 2), WALL_H / 2, Z(-2.45));
    // ombres : cadrage sur la parcelle
    const s = Math.max(Lp, Pp) * .75; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 200 }); sun.shadow.camera.updateProjectionMatrix();
    setSun(state.hour); applyVis(); view("34");
  }
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  // bandeau périphérique (4 lisses autour du gabarit)
  function ring(W, D, h, t, m, y, parent) { const e = T_EXT + .05, a = W + 2 * e, b = D + 2 * e;
    box(a, h, t, m, X(W / 2), y, Z(-e) - t / 2 + t, parent); box(a, h, t, m, X(W / 2), y, Z(D + e) + t / 2 - t, parent);
    box(t, h, b, m, X(-e) + t / 2, y, Z(D / 2), parent); box(t, h, b, m, X(W + e) - t / 2, y, Z(D / 2), parent); }
  function applyVis() { if (groups.roof) groups.roof.visible = state.roof && state.upper; groups.levels.forEach((g, i) => g.visible = i === 0 || state.upper); }

  function view(kind, roomIdx) {
    if (!state.plan) return; const { W, D } = state.plan, cx = X(W / 2), cz = Z(D / 2), H = state.plan.levels.length * LEVEL_H;
    camera.fov = kind === "room" ? 68 : kind === "front" ? 52 : 45; camera.updateProjectionMatrix();
    if (kind === "front") { const zc = state.plan.site.P / 2 + 4.5; camera.position.set(cx + W * .15, 1.7, zc); controls.target.set(cx, H * .45, Z(D * .3)); }
    else if (kind === "34") { camera.position.set(cx + W * .9 + 6, H + 9, Z(0) + D * .8 + 9); controls.target.set(cx, H * .35, cz); }
    else if (kind === "top") { camera.position.set(cx + .01, Math.max(W, D) * 1.9 + 8, cz + .01); controls.target.set(cx, 0, cz); }
    else if (kind === "room") { const it = state.rooms[roomIdx]; if (!it) return; const r = it.r, y = it.l * LEVEL_H + .2 + 1.6;
      camera.position.set(X(r.x + r.w * .15), y, Z(r.y + r.h * .15)); controls.target.set(X(r.x + r.w * .7), y - .25, Z(r.y + r.h * .75)); }
    controls.update();
  }

  let running = true, last = 0;
  function loop(t) { requestAnimationFrame(loop); if (!running) return; controls.update(); renderer.render(scene, camera); }
  requestAnimationFrame(loop);

  async function capture(w = 3840, h = 2160) {
    const ps = renderer.getPixelRatio(), r = canvas.getBoundingClientRect(), asp = camera.aspect;
    running = false; sun.shadow.mapSize.set(4096, 4096); sun.shadow.map?.dispose(); sun.shadow.map = null;
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", .93));
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.map?.dispose(); sun.shadow.map = null;
    renderer.setPixelRatio(ps); resize(); running = true; return blob;
  }

  return { build, resize, setSun, view, capture, set roof(v) { state.roof = v; applyVis(); }, set upper(v) { state.upper = v; applyVis(); }, get rooms() { return state.rooms; }, setStyle(st) { if (state.plan) build(state.plan, st); else state.style = st; }, pause(v) { running = !v; } };
}
