// ARCHÉA — maquette 3D « rendu d'expert » (Three.js : PBR, ciel physique + éclairage d'environnement dynamique,
// ombres douces, occlusion ambiante GTAO, bloom, MSAA, végétation tropicale procédurale, mode nuit)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { furniture, envelope, extSegs, intSegs, LEVEL_H, WALL_H, T_EXT, T_INT } from './plan.js';

// ---------- Styles de décor ----------
export const STYLES = {
  tropical: { n: "Moderne tropical", d: "Façade blanche, bois et pergola à lames, toit plat, grands carreaux clairs", facade: "#f1ede4", accent: "#8a5a36", roof: "flat", roofC: "#d9d4ca", floor: "tile", floorC: "#e2d8c6", wall: "#f5f1ea", fabric: "#c9b79c", wood: "#8a5a36", frame: "#2b2b2b", plinth: "#6f6559", pergola: 1, sw: ["#f1ede4", "#8a5a36", "#e2d8c6", "#6f8f5a"] },
  contemporain: { n: "Contemporain minimaliste", d: "Gris, béton ciré, menuiseries noires, toit-terrasse", facade: "#d7d7d3", accent: "#4a4a48", roof: "flat", roofC: "#9a9a96", floor: "concrete", floorC: "#b9b8b3", wall: "#eeeeec", fabric: "#5a6470", wood: "#6b5a48", frame: "#141414", plinth: "#3a3a3a", pergola: 1, sw: ["#d7d7d3", "#4a4a48", "#141414", "#5a6470"] },
  afro: { n: "Afro-chic", d: "Terre cuite, bois sombre, motifs bogolan, toiture à quatre pans", facade: "#c9875a", accent: "#3b2a1e", roof: "hip", roofC: "#7a3b22", floor: "terracotta", floorC: "#b8673e", wall: "#ead6b8", fabric: "#a9532d", wood: "#5a3a22", frame: "#3b2a1e", plinth: "#5b3a26", pattern: 1, sw: ["#c9875a", "#3b2a1e", "#a9532d", "#ead6b8"] },
  luxe: { n: "Luxe néo-classique", d: "Crème et or, marbre blanc, toiture ardoise", facade: "#efe6d6", accent: "#b8923a", roof: "hip", roofC: "#4a4f55", floor: "marble", floorC: "#f1efea", wall: "#f4efe6", fabric: "#e8dcc8", wood: "#2f2a26", frame: "#b8923a", plinth: "#cfc3ad", sw: ["#efe6d6", "#b8923a", "#f1efea", "#2f2a26"] },
  medit: { n: "Méditerranéen", d: "Blanc éclatant, bleu, tuiles en terre cuite", facade: "#ffffff", accent: "#2f6fa3", roof: "hip", roofC: "#b5552e", floor: "terracotta", floorC: "#c27a4d", wall: "#fbfaf6", fabric: "#2f6fa3", wood: "#a87a4f", frame: "#2f6fa3", plinth: "#d9d2c3", sw: ["#ffffff", "#2f6fa3", "#b5552e", "#c27a4d"] },
  indus: { n: "Industriel", d: "Brique, acier noir, parquet chêne, cuir", facade: "#9a5a44", accent: "#1b1b1b", roof: "flat", roofC: "#5a5a58", floor: "wood", floorC: "#9b7448", wall: "#e9e4dc", fabric: "#6b4a33", wood: "#2a2a2a", frame: "#1b1b1b", plinth: "#2b2b2b", brick: 1, pergola: 1, sw: ["#8f4a35", "#1b1b1b", "#9b7448", "#6b4a33"] },
};

// ---------- Textures ----------
const TL = new THREE.TextureLoader(), cache = new Map();
function img(url, srgb = true) { if (cache.has(url)) return cache.get(url); const t = TL.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; cache.set(url, t); return t; }
function ctex(key, w, h, draw, srgb = true) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.userData.canvas = c;
  cache.set(key, t); return t;
}
// carte de normales calculée depuis une carte de hauteur (Sobel)
function nrm(key, w, h, drawH, k = 2) {
  return ctex("n" + key, w, h, (g) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const hg = c.getContext("2d", { willReadFrequently: true }); drawH(hg, w, h);
    const s = hg.getImageData(0, 0, w, h).data, o = g.createImageData(w, h), d = o.data, H = (x, y) => s[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
      d[i] = (-dx / l * .5 + .5) * 255; d[i + 1] = (dy / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255; }
    g.putImageData(o, 0, 0);
  }, false);
}
const rnd = (a, b) => a + Math.random() * (b - a);
function noise(g, w, h, a, n = 1) { const im = g.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - .5) * a; d[i] += v; d[i + 1] += v * n; d[i + 2] += v * n; } g.putImageData(im, 0, 0); }
function blotch(g, w, h, n, a, col = "0,0,0") { for (let i = 0; i < n; i++) { const r = rnd(10, w / 3), x = rnd(0, w), y = rnd(0, h), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }
const shade = (c, k) => { const x = new THREE.Color(c); x.multiplyScalar(k); return "#" + x.getHexString(); };
// motifs (taille en mètres d'une répétition → .userData.m)
const TILE = { tile: .6, terracotta: .4, marble: .8, concrete: 2, wood: 2.4 };
function floorMap(kind, col) {
  const t = ctex("f" + kind + col, 512, 512, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    if (kind === "tile" || kind === "terracotta") { const n = kind === "tile" ? 2 : 4, s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = shade(col, rnd(.94, 1.05)); g.fillRect(x * s, y * s, s, s); } blotch(g, w, h, 30, kind === "tile" ? .03 : .08); noise(g, w, h, kind === "tile" ? 6 : 18); g.fillStyle = shade(col, .78); for (let i = 0; i <= n; i++) { g.fillRect(i * s - 1.5, 0, 3, h); g.fillRect(0, i * s - 1.5, w, 3); } }
    else if (kind === "marble") { noise(g, w, h, 5); for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(120,118,125,${rnd(.06, .22)})`; g.lineWidth = rnd(.5, 2.2); g.beginPath(); let x = rnd(0, w), y = 0; g.moveTo(x, y); while (y < h) { x += rnd(-25, 25); y += 14; g.lineTo(x, y); } g.stroke(); } g.fillStyle = "rgba(0,0,0,.10)"; g.fillRect(w / 2 - 1, 0, 2, h); g.fillRect(0, h / 2 - 1, w, 2); g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); }
    else { blotch(g, w, h, 60, .06); blotch(g, w, h, 30, .05, "255,255,255"); noise(g, w, h, 10); }
  });
  return t;
}
function floorNrm(kind) {
  if (kind === "wood") return img("tex/wood_b.jpg", false);
  return nrm("fl" + kind, 256, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); noise(g, w, h, kind === "concrete" ? 30 : 10);
    const n = kind === "tile" ? 2 : kind === "terracotta" ? 4 : kind === "marble" ? 2 : 0; if (n) { const s = w / n; g.fillStyle = "#555"; for (let i = 0; i <= n; i++) { g.fillRect(i * s - 2, 0, 4, h); g.fillRect(0, i * s - 2, w, 4); } } }, kind === "concrete" ? 1 : 3);
}
const plasterN = () => nrm("plaster", 256, 256, (g, w, h) => { g.fillStyle = "#888"; g.fillRect(0, 0, w, h); blotch(g, w, h, 80, .25, "255,255,255"); blotch(g, w, h, 80, .25); noise(g, w, h, 40); }, 1.2);
function plasterMap(col) { return ctex("p" + col, 256, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); blotch(g, w, h, 25, .035); noise(g, w, h, 6); }); }
const roofTileMap = col => ctex("rt" + col, 256, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); const c1 = shade(col, rnd(.85, 1.1)); gr.addColorStop(0, shade(c1, .7)); gr.addColorStop(.5, shade(c1, 1.12)); gr.addColorStop(1, shade(c1, .7)); g.fillStyle = gr; g.fillRect(x, y, 32, 30); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x, y + 28, 32, 4); } blotch(g, w, h, 20, .12); noise(g, w, h, 10); });
const roofTileN = () => nrm("rt", 256, 256, (g, w, h) => { for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, "#222"); gr.addColorStop(.5, "#eee"); gr.addColorStop(1, "#222"); g.fillStyle = gr; g.fillRect(x, y, 32, 32); g.fillStyle = "#000"; g.fillRect(x, y + 28, 32, 4); } }, 3);
const paveMap = () => ctex("pave", 256, 256, (g, w, h) => { g.fillStyle = "#a9a296"; g.fillRect(0, 0, w, h); const s = 32; for (let y = 0; y < h; y += s) for (let x = -s; x < w; x += s * 2) { g.fillStyle = shade("#b9b2a5", rnd(.85, 1.08)); g.fillRect(x + (y / s % 2) * s + 1.5, y + 1.5, s * 2 - 3, s - 3); } noise(g, w, h, 12); });
const paveN = () => nrm("pave", 256, 256, (g, w, h) => { g.fillStyle = "#333"; g.fillRect(0, 0, w, h); const s = 32; g.fillStyle = "#eee"; for (let y = 0; y < h; y += s) for (let x = -s; x < w; x += s * 2) g.fillRect(x + (y / s % 2) * s + 2, y + 2, s * 2 - 4, s - 4); noise(g, w, h, 20); }, 2);
const asphaltMap = () => ctex("asph", 256, 256, (g, w, h) => { g.fillStyle = "#3d3d3e"; g.fillRect(0, 0, w, h); noise(g, w, h, 30); blotch(g, w, h, 20, .15); });
const lateriteMap = () => ctex("lat", 512, 512, (g, w, h) => { g.fillStyle = "#a07450"; g.fillRect(0, 0, w, h); blotch(g, w, h, 90, .06); blotch(g, w, h, 70, .12, "110,130,70"); noise(g, w, h, 16); });
function bogolan(col) { return ctex("bg" + col, 256, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.strokeStyle = "#f3e6cf"; g.lineWidth = 4; for (let y = 16; y < h; y += 42) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + (x / 16 % 2 ? 8 : -8)); g.stroke(); } g.fillStyle = "#2a1a10"; for (let i = 0; i < 40; i++) g.fillRect(rnd(0, w), rnd(0, h), 6, 6); }); }
const fabricN = () => nrm("fab", 128, 128, (g, w, h) => { g.fillStyle = "#888"; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 2) { g.fillStyle = i % 4 ? "#999" : "#777"; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } noise(g, w, h, 30); }, 1);
const leafMap = () => ctex("frond", 128, 512, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = "#fff"; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.lineWidth = 7;
  for (let y = 10; y < h - 8; y += 10) { const L = (w / 2 - 4) * Math.sin(Math.PI * Math.min(1, (y + 40) / h)); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + s * L * .5, y + 6, w / 2 + s * L, y + 22); g.stroke(); } } });
const grilleMap = () => ctex("grille", 128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#fff"; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 6, h); g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8); g.fillRect(0, h / 2 - 3, w, 6); });

// UV métriques : chaque face d'un pavé reçoit des UV en mètres
function boxGeo(w, h, d, rounded = 0) {
  const g = rounded ? new RoundedBoxGeometry(w, h, d, 3, Math.min(rounded, w / 2.1, h / 2.1, d / 2.1)) : new THREE.BoxGeometry(w, h, d);
  if (!rounded) { const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); } }
  return g;
}
const sizeTex = (m, meters) => { for (const k of ["map", "normalMap", "roughnessMap", "bumpMap"]) if (m[k]) { const src = m[k]; m[k] = src.clone(); if (src.isCanvasTexture) m[k].needsUpdate = true; m[k].repeat.set(1 / meters, 1 / meters); } return m; };

// ---------- Moteur ----------
export function createViewer(canvas, overlay = null) {
  const PLAN = { hide: [], show: [], site: [], level: -1 };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcfd9df, 160, 600);
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 900);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .495; controls.minDistance = .3; controls.maxDistance = 160;
  // ciel physique + environnement réfléchi calculé depuis ce même ciel
  const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky); const su = sky.material.uniforms;
  su.turbidity.value = 7; su.rayleigh.value = 1.6; su.mieCoefficient.value = .006; su.mieDirectionalG.value = .82;
  const envScene = new THREE.Scene(), envSky = new Sky(); envSky.scale.setScalar(4000); envScene.add(envSky);
  // sol chaud dans l'environnement (rebond lumineux latérite / gazon) : neutralise la dominante bleue du ciel
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(3000, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color("#c9c0b2").multiplyScalar(1.15), side: THREE.DoubleSide })); envGround.rotation.x = -Math.PI / 2; envGround.position.y = -20; envScene.add(envGround);
  const envWarm = new THREE.Mesh(new THREE.SphereGeometry(2500, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff1dc").multiplyScalar(.9), side: THREE.BackSide, transparent: true, opacity: .45, depthWrite: false })); envScene.add(envWarm);
  const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;
  const sun = new THREE.DirectionalLight(0xfff2e0, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0003; sun.shadow.normalBias = .025; sun.shadow.radius = 3; sun.shadow.blurSamples = 12; scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xf2f4f7, 0x8a7255, .35); scene.add(hemi);
  // post-traitement : MSAA + GTAO + bloom + sortie (tone mapping, sRGB)
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 16, 16); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = .75;
  gtao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 16 }); gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), .18, .5, .92); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let quality = true;

  let root = new THREE.Group(); scene.add(root);
  const state = { plan: null, style: STYLES.tropical, roof: true, upper: true, hour: 11, rooms: [], night: false, bright: 1, mode: "ext", room: null, fin: {} };
  const groups = { levels: [], roof: null, ceilings: [] }, nightLights = [], anim = [];

  function resize() { const r = canvas.getBoundingClientRect(); const w = Math.max(100, r.width), h = Math.max(100, r.height), pr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  let envTimer = 0;
  function setSun(hour) { if (PLAN.level >= 0) { state.hour = hour; return planLight(); }
    state.hour = hour; const lat = 5.35 * Math.PI / 180, now = new Date(), doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const dec = -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI / 365 * (doy + 10)), H = (hour - 12) * 15 * Math.PI / 180;
    const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)); // depuis le sud, positif vers l'ouest
    // repère : nord = -z, est = +x, sud = +z
    const dir = new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    su.sunPosition.value.copy(dir); envSky.material.uniforms.sunPosition.value.copy(dir);
    for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"]) envSky.material.uniforms[k].value = su[k].value;
    sun.position.copy(dir).multiplyScalar(80); sun.target.position.set(0, 0, 0);
    const lowK = THREE.MathUtils.clamp(el / .45, 0, 1); state.night = el < -.02;
    sun.intensity = el > 0 ? 3.6 * (.45 + .55 * lowK) : 0; sun.color.setHSL(.085 - .035 * (1 - lowK), .55 * (1 - lowK) + .25, .6 + .22 * lowK);
    hemi.intensity = state.night ? .08 : .3 + .15 * lowK; scene.environmentIntensity = (state.night ? .04 : .26 + .06 * lowK) * ENVK;
    renderer.toneMappingExposure = (state.night ? 1.3 : EXPO + .35 * (1 - lowK)) * state.bright; (scene.fog || PLAN.fog || { color: new THREE.Color() }).color.setHSL(.58, .25, state.night ? .05 : .55 + .25 * lowK);
    bloom.enabled = state.night; bloom.strength = .55; bloom.threshold = .6;
    for (const L of nightLights) { L.intensity = L.userData.on; L.visible = state.night; }
    if (M.glass) M.glass.emissiveIntensity = state.night ? 1.1 : 0; if (M.lamp) M.lamp.emissiveIntensity = state.night ? 6 : .6; if (M.led) M.led.emissiveIntensity = state.night ? 8 : 1.2; if (M.ceil) { M.ceil.emissiveIntensity = state.night ? .08 : .42; M.staff.emissiveIntensity = state.night ? .06 : .3; }
    clearTimeout(envTimer); envTimer = setTimeout(updateEnv, 60);
  }
  function updateEnv() { const old = envRT; envRT = pmrem.fromScene(envScene, 0, .1, 5000); if (PLAN.level < 0) scene.environment = envRT.texture; if (old) old.dispose(); }

  let ENVK = +(new URLSearchParams(location.search).get("envk") || 1), EXPO = +(new URLSearchParams(location.search).get("expo") || .78);
  const M = {};
  function mats(st) {
    const std = o => new THREE.MeshStandardMaterial(o), phy = o => new THREE.MeshPhysicalMaterial(o);
    const pn = plasterN();
    M.facade = st.brick ? sizeTex(std({ map: img("tex/brick_d.jpg"), bumpMap: img("tex/brick_b.jpg", false), bumpScale: 2.5, roughnessMap: img("tex/brick_r.jpg", false), color: "#e6c3b0" }), 1.6)
      : sizeTex(std({ map: plasterMap(st.facade), normalMap: pn, normalScale: new THREE.Vector2(.35, .35), roughness: .92 }), 2.2);
    M.wallIn = sizeTex(std({ map: plasterMap(st.wall), normalMap: pn, normalScale: new THREE.Vector2(.12, .12), roughness: .95 }), 2.2);
    M.plinth = sizeTex(std({ map: plasterMap(st.plinth), normalMap: pn, normalScale: new THREE.Vector2(.8, .8), roughness: .9 }), 1.2);
    M.accent = std({ color: st.accent, roughness: .5, metalness: st.accent === "#b8923a" ? .7 : 0 });
    const fm = TILE[st.floor];
    M.floor = st.floor === "wood" ? sizeTex(std({ map: img("tex/wood_d.jpg"), color: new THREE.Color(st.floorC).lerp(new THREE.Color("#f4ece0"), .55), normalMap: img("tex/wood_b.jpg", false), normalScale: new THREE.Vector2(.25, .25), roughnessMap: img("tex/wood_r.jpg", false) }), fm)
      : sizeTex(phy({ map: floorMap(st.floor, st.floorC), normalMap: floorNrm(st.floor), normalScale: new THREE.Vector2(.6, .6), roughness: st.floor === "marble" ? .12 : st.floor === "concrete" ? .4 : st.floor === "tile" ? .22 : .55, clearcoat: st.floor === "marble" || st.floor === "tile" ? .5 : 0, clearcoatRoughness: .15 }), fm);
    M.wet = sizeTex(phy({ map: floorMap("tile", "#dfe3e4"), normalMap: floorNrm("tile"), roughness: .18, clearcoat: .6 }), .3);
    M.wetWall = sizeTex(phy({ map: floorMap("tile", "#eef0f0"), normalMap: floorNrm("tile"), roughness: .15, clearcoat: .6 }), .6);
    M.slab = std({ color: "#d8d4cc", roughness: .9 }); M.ceil = std({ color: "#fbfaf7", roughness: .95, emissive: "#fff8ee", emissiveIntensity: .42 }); // rebond lumineux simulé (GI)
    M.roof = st.roof !== "flat" && st.roofMat === "bac" ? sizeTex(std({ map: ctex("bac" + st.roofC, 128, 128, (g, w, h) => { for (let x = 0; x < w; x++) { const v = .78 + .22 * Math.cos(x / w * Math.PI * 2 * 4); g.fillStyle = shade(st.roofC, v); g.fillRect(x, 0, 1, h); } noise(g, w, h, 5); }), normalMap: nrm("bac", 128, 128, (g, w, h) => { for (let x = 0; x < w; x++) { const v = Math.round(127 + 120 * Math.cos(x / w * Math.PI * 2 * 4)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); } }, 4), roughness: .35, metalness: .75 }), 1.0)
      : st.roof === "flat" ? sizeTex(std({ map: plasterMap(st.roofC), normalMap: pn, roughness: .95 }), 3) : sizeTex(std({ map: roofTileMap(st.roofC), normalMap: roofTileN(), normalScale: new THREE.Vector2(1.2, 1.2), roughness: .78 }), 1.1);
    M.glass = phy({ color: "#1f2b31", roughness: .03, metalness: .2, transparent: true, opacity: .55, envMapIntensity: 2.2, emissive: "#ffb565", emissiveIntensity: 0, side: THREE.DoubleSide, depthWrite: false });
    M.frame = std({ color: st.frame, roughness: .35, metalness: .6 });
    const wd = img("tex/wood_d.jpg"); M.wood = sizeTex(std({ map: wd, color: new THREE.Color(st.wood).lerp(new THREE.Color("#fff"), .25), normalMap: img("tex/wood_b.jpg", false), normalScale: new THREE.Vector2(.3, .3), roughness: .55 }), 1.6);
    M.door = M.wood;
    M.fabric = std({ color: st.fabric, map: st.pattern ? bogolan(st.fabric) : null, normalMap: fabricN(), normalScale: new THREE.Vector2(.4, .4), roughness: .95 });
    M.white = std({ color: "#f4f4f2", roughness: .35 }); M.ceramic = phy({ color: "#fafafa", roughness: .08, clearcoat: 1 });
    M.dark = std({ color: "#1c1c1e", roughness: .35, metalness: .3 }); M.metal = std({ color: "#c0c4c8", roughness: .22, metalness: 1 });
    M.counter = phy({ color: st.floor === "marble" ? "#efece6" : "#2d2d2f", roughness: .15, clearcoat: .8 });
    M.screen = std({ color: "#050505", roughness: .1, metalness: .5 });
    M.grass = sizeTex(std({ map: img("tex/grass.jpg"), color: "#cfe0b0", roughness: 1 }), 3);
    M.pave = sizeTex(std({ map: paveMap(), normalMap: paveN(), roughness: .85 }), 1.6);
    M.asphalt = sizeTex(std({ map: asphaltMap(), roughness: .95 }), 4); M.laterite = sizeTex(std({ map: lateriteMap(), roughness: 1 }), 28);
    const wn = img("tex/waternormals.jpg", false); M.water = phy({ color: "#1b9cc2", roughness: .02, metalness: 0, transparent: true, opacity: .78, normalMap: wn, normalScale: new THREE.Vector2(.25, .25), envMapIntensity: 1.6, clearcoat: 1 }); M.water.normalMap.repeat.set(.35, .35);
    M.poolTile = sizeTex(std({ map: floorMap("tile", "#5fc4e0"), roughness: .3 }), .5); M.coping = sizeTex(std({ map: plasterMap("#e9e3d6"), normalMap: pn, roughness: .8 }), 1);
    const leafCols = ["#3c6a2a", "#4f7f33", "#2f5a24"]; M.leaves = leafCols.map(c => std({ color: c, roughness: .85, vertexColors: true }));
    M.flower = std({ color: "#c2307a", roughness: .8, vertexColors: true }); M.trunk = std({ color: "#6b5644", roughness: .95, normalMap: fabricN(), normalScale: new THREE.Vector2(1.5, 1.5) });
    M.frond = std({ map: leafMap(), color: "#5f8f35", alphaTest: .5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .8 });
    M.fence = sizeTex(std({ map: plasterMap("#e6e0d5"), normalMap: pn, normalScale: new THREE.Vector2(.4, .4), roughness: .95 }), 2);
    const gm = grilleMap(); M.grille = std({ color: st.frame, roughness: .4, metalness: .6, alphaTest: .5, side: THREE.DoubleSide, map: gm });
    M.bed = std({ color: "#f3f1ec", roughness: .95, normalMap: fabricN(), normalScale: new THREE.Vector2(.3, .3) }); M.rug = std({ color: shade(st.fabric, .8), roughness: 1, normalMap: fabricN() });
    M.lamp = std({ color: "#fff3dc", emissive: "#ffcf8a", emissiveIntensity: 0 }); M.curtain = std({ color: shade(st.fabric, 1.15), roughness: 1, side: THREE.DoubleSide, normalMap: fabricN(), normalScale: new THREE.Vector2(.3, .3) }); M.cap = new THREE.MeshBasicMaterial({ color: "#1b1b1d" }); M.capWin = new THREE.MeshBasicMaterial({ color: "#cfd6da" }); M.led = std({ color: "#fff6e6", emissive: "#ffd9a0", emissiveIntensity: 1 }); M.staff = std({ color: "#fbfaf6", roughness: .9, emissive: "#fff8ee", emissiveIntensity: .3 }); M.gold = std({ color: "#c9a14a", roughness: .3, metalness: 1 }); M.pot = std({ color: "#b5714a", roughness: .9 });
    M.slat = st.wood ? M.wood : M.accent;
  }

  const shadowAll = o => { o.castShadow = true; o.receiveShadow = true; return o; };
  function box(w, h, d, m, x, y, z, parent, cast = true, rounded = 0) { const g = new THREE.Mesh(boxGeo(w, h, d, rounded), m); g.position.set(x, y, z); g.castShadow = cast; g.receiveShadow = true; (parent || root).add(g); return g; }

  // mur avec ouvertures (le long de x ou de z) ; mOut = { m, x|z : côté extérieur }
  function wall(axis, a0, a1, fixed, y0, t, m, holes, parent, mOut, mIn2) {
    holes = holes.filter(h => h.c + h.w / 2 > a0 + .01 && h.c - h.w / 2 < a1 - .01).sort((p, q) => p.c - q.c);
    const piece = (b0, b1, h0, h1) => { if (b1 - b0 < .005 || h1 - h0 < .005) return; const L = b1 - b0 + .004, H = h1 - h0 + .002, c = (b0 + b1) / 2;
      if (h0 === 0 && H > 1) { axis === "x" ? box(L, .09, t + .024, M.white, c, y0 + .045, fixed, parent, false) : box(t + .024, .09, L, M.white, fixed, y0 + .045, c, parent, false); }
      let g; if (axis === "x") { g = box(L, H, t, m, c, y0 + h0 + H / 2, fixed, parent); if (mOut || mIn2) g.material = [m, m, m, m, mOut && mOut.z > 0 ? mOut.m : (mIn2 && mIn2.z > 0 ? mIn2.m : m), mOut && mOut.z < 0 ? mOut.m : (mIn2 && mIn2.z < 0 ? mIn2.m : m)]; }
      else { g = box(t, H, L, m, fixed, y0 + h0 + H / 2, c, parent); if (mOut || mIn2) g.material = [mOut && mOut.x > 0 ? mOut.m : (mIn2 && mIn2.x > 0 ? mIn2.m : m), mOut && mOut.x < 0 ? mOut.m : (mIn2 && mIn2.x < 0 ? mIn2.m : m), m, m, m, m]; }
      // vue en plan : murs coupés (dessus noir), linteaux masqués, appuis de fenêtre en gris clair
      if (h0 > 0) PLAN.hide.push(g); else { const cap = new THREE.Mesh(new THREE.PlaneGeometry(axis === "x" ? L : t, axis === "x" ? t : L), h1 >= WALL_H - .01 ? M.cap : M.capWin); cap.rotation.x = -Math.PI / 2; cap.position.set(axis === "x" ? c : fixed, y0 + h1 + .004, axis === "x" ? fixed : c); cap.visible = false; (parent || root).add(cap); PLAN.show.push(cap); } };
    let cur = a0;
    for (const h of holes) { const s = Math.max(a0, h.c - h.w / 2), e = Math.min(a1, h.c + h.w / 2); piece(cur, s, 0, WALL_H); if (h.sill > 0) piece(s, e, 0, h.sill); piece(s, e, h.head, WALL_H); cur = e;
      const L = e - s, c = (s + e) / 2, B = (w, hh, dd, mm, u, y, off = 0, cast = false) => axis === "x" ? box(w, hh, dd, mm, u, y, fixed + off, parent, cast) : box(dd, hh, w, mm, fixed + off, y, u, parent, cast);
      if (h.win) { const H = h.head - h.sill, cy = y0 + h.sill + H / 2, out = mOut ? (axis === "x" ? mOut.z : mOut.x) : 0;
        const gl = B(L - .06, H - .06, .012, M.glass, c, cy); gl.renderOrder = 2; gl.receiveShadow = false;
        const fd = .06; B(L, .06, fd, M.frame, c, y0 + h.sill + .03); B(L, .06, fd, M.frame, c, y0 + h.head - .03); B(.06, H, fd, M.frame, s + .03, cy); B(.06, H, fd, M.frame, e - .03, cy);
        const nM = Math.max(0, Math.round(L / 1.1) - 1); for (let i = 1; i <= nM; i++) B(.045, H, fd, M.frame, s + L * i / (nM + 1), cy);
        if (H > 1.6 && !h.baie) B(L, .045, fd, M.frame, c, y0 + h.head - .55);
        if (h.sill > 0 && out) B(L + .1, .04, t / 2 + .1, M.accent, c, y0 + h.sill - .02, out * (t / 4 + .05), true);
        if (out && h.sill < 1.4 && !h.vit && !LITE) { const inn = -out * (t / 2 + .09), ch = Math.min(WALL_H - .05, h.head + .25); B(L + .7, .03, .03, M.metal, c, y0 + ch, inn);
          for (const sd of [-1, 1]) { const cu = new THREE.Mesh(curtainGeo(.42, ch - .02), M.curtain); cu.position.set(axis === "x" ? c + sd * (L / 2 + .12) : fixed + inn, y0 + (ch - .02) / 2, axis === "x" ? fixed + inn : c + sd * (L / 2 + .12)); if (axis !== "x") cu.rotation.y = Math.PI / 2; cu.castShadow = true; cu.receiveShadow = true; (parent || root).add(cu); PLAN.hide.push(cu); } } }
      if (h.shop) { const H = h.head, gl = B(L - .1, H - .1, .012, M.glass, c, y0 + H / 2); gl.renderOrder = 2; gl.receiveShadow = false; const fd = .07, out = mOut ? (axis === "x" ? mOut.z : mOut.x) : 1;
        B(L, .07, fd, M.frame, c, y0 + H - .035); B(.07, H, fd, M.frame, s + .035, y0 + H / 2); B(.07, H, fd, M.frame, e - .035, y0 + H / 2); B(.05, H, fd, M.frame, c, y0 + H / 2);
        B(L + .1, .32, .3, M.metal, c, y0 + H + .2, out * (t / 2 + .12), true); B(L + .1, .02, .34, M.dark, c, y0 + H + .03, out * (t / 2 + .12)); }
      else if (h.door && !h.open) { const H = h.head; const leaf = new THREE.Mesh(boxGeo(L - .04, H - .02, .045), h.main ? M.accent : M.door); leaf.castShadow = true; leaf.receiveShadow = true;
        const pv = new THREE.Group(); (parent || root).add(pv); PLAN.hide.push(pv); leaf.position.set((L - .04) / 2, H / 2, 0); pv.add(leaf);
        if (h.main) for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(boxGeo(L * .6, .02, .06), M.frame); p.position.set(L / 2, .45 + i * .45, 0); pv.add(p); }
        if (axis === "x") { pv.position.set(s + .02, y0, fixed); pv.rotation.y = -0.45; } else { pv.position.set(fixed, y0, s + .02); pv.rotation.y = Math.PI / 2 - .45; }
        const hd = new THREE.Mesh(new THREE.BoxGeometry(.14, .02, .03), M.metal); hd.position.set(L - .16, 1.05, .04); pv.add(hd);
        B(L, .06, t + .02, M.frame, c, y0 + H + .03); }
      if (h.door && !h.main && !h.shop) { const cs = .07, hd = h.head; B(cs, hd + cs, t + .04, M.white, s - cs / 2 + .005, y0 + (hd + cs) / 2); B(cs, hd + cs, t + .04, M.white, e + cs / 2 - .005, y0 + (hd + cs) / 2); B(L + 2 * cs, cs, t + .04, M.white, c, y0 + hd + cs / 2); }
    }
    piece(cur, a1, 0, WALL_H);
  }

  function curtainGeo(w, h) { const g = new THREE.PlaneGeometry(w, h, 24, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / w * Math.PI * 7) * .035); g.computeVertexNormals(); return g; }
  const artTex = () => ctex("art" + ((Math.random() * 4) | 0), 256, 192, (g, w, h) => { const pal = [["#e9e1d3", "#c26a3d", "#2f4a5f", "#d9b25c"], ["#f1ece4", "#1f3b4d", "#8aa39b", "#c9a14a"], ["#efe7da", "#5a3a22", "#b8673e", "#2a2a2a"], ["#eae6df", "#6f8f5a", "#c98b8b", "#2b3a55"]][(Math.random() * 4) | 0];
    g.fillStyle = pal[0]; g.fillRect(0, 0, w, h); for (let i = 0; i < 7; i++) { g.fillStyle = pal[1 + (i % 3)]; g.globalAlpha = rnd(.55, .95); g.beginPath(); if (i % 2) g.arc(rnd(30, w - 30), rnd(30, h - 30), rnd(14, 60), 0, 7); else g.rect(rnd(0, w * .7), rnd(0, h * .7), rnd(30, 120), rnd(20, 90)); g.fill(); } g.globalAlpha = 1; });
  function art(g, w, h, x, y, z) { const fr = new THREE.Mesh(boxGeo(w + .06, h + .06, .03), M.frame); fr.position.set(x, y, z); g.add(fr); const cv = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: artTex(), roughness: .8 })); cv.position.set(x, y, z + .017); g.add(cv); }
  // ---------- Mobilier ----------
  function furn3d(f, y0, parent, rk) {
    const [x, z] = [X(f.x + f.w / 2), Z(f.y + f.h / 2)], W = f.iw ?? f.w, D = f.id ?? f.h, g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = (f.rot || 0) * Math.PI / 180; parent.add(g);
    const b = (w, h, d, m, px, py, pz, r = 0) => { const k = new THREE.Mesh(boxGeo(w, h, d, r), m); k.position.set(px, py, pz); shadowAll(k); g.add(k); return k; };
    const legs = (w, d, h, m = M.dark, s = .04) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(s, h, s, m, sx * (w / 2 - .06), h / 2, sz * (d / 2 - .06)); };
    switch (f.t) {
      case "lit": { if (W > 1.2) art(g, Math.min(1.2, W * .7), .6, 0, 1.55, -D / 2 + .01); b(W + .04, .28, D, M.wood, 0, .2, 0, .02); b(W - .04, .22, D - .08, M.bed, 0, .45, .02, .06); b(W + .1, 1.0, .08, M.wood, 0, .5, -D / 2 + .04, .02);
        b(W - .08, .1, D * .55, M.fabric, 0, .58, D * .2, .04); for (const s of [-1, 1]) b(W * .4, .14, .38, M.white, s * W * .22, .62, -D / 2 + .3, .06);
        b(Math.min(W + 1, 3), .01, D * .6, M.rug, 0, .005, D * .3, 0); break; }
      case "canape": { const L = W, d = D; b(L, .22, d, M.fabric, 0, .2, 0, .06); const n = Math.max(1, Math.round((L - .4) / .75));
        for (let i = 0; i < n; i++) { const cw = (L - .36) / n, u = -L / 2 + .18 + cw * (i + .5); b(cw - .02, .16, d - .3, M.fabric, u, .38, .1, .07); b(cw - .04, .42, .2, M.fabric, u, .58, -d / 2 + .14, .08); }
        b(.18, .32, d, M.fabric, -L / 2 + .09, .46, 0, .06); b(.18, .32, d, M.fabric, L / 2 - .09, .46, 0, .06); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(.04, .09, .04, M.dark, sx * (L / 2 - .1), .045, sz * (d / 2 - .1));
        for (const sx of [-1, 1]) b(.42, .38, .12, M.white, sx * (L / 2 - .45), .62, -d / 2 + .3, .05); break; }
      case "table_basse": b(W, .05, D, M.wood, 0, .38, 0, .015); legs(W, D, .36); { const v = new THREE.Mesh(new THREE.CylinderGeometry(.06, .05, .2, 16), M.ceramic); v.position.set(W * .2, .5, 0); g.add(v); const pl = blob(.13, 2, M.leaves[1], .3); pl.position.set(W * .2, .68, 0); g.add(pl); } break;
      case "tapis": b(W, .012, D, M.rug, 0, .006, 0); break;
      case "plante": { const p = shadowAll(new THREE.Mesh(new THREE.CylinderGeometry(.22, .17, .45, 18), M.pot)); p.position.y = .225; g.add(p); for (let i = 0; i < 4; i++) { const c = blob(rnd(.22, .32), 2, M.leaves[i % 3], .35); c.position.set(rnd(-.12, .12), .7 + i * .22, rnd(-.12, .12)); g.add(c); } break; }
      case "frigo": b(W, 1.85, D, M.metal, 0, .925, 0, .02); b(.02, .5, .03, M.dark, W / 2 - .08, 1.2, D / 2 + .01); b(W, .005, .01, M.dark, 0, 1.25, D / 2 + .005); break;
      case "buffet": b(W, .8, D, M.wood, 0, .45, 0, .015); legs(W, D, .1); for (let i = 1; i < 3; i++) b(.005, .7, .01, M.dark, -W / 2 + W * i / 3, .45, D / 2 + .002); b(.3, .35, .05, M.dark, W * .25, 1.2, -D / 2 + .03); break;
      case "coiffeuse": b(W, .04, D, M.wood, 0, .75, 0, .01); legs(W, D, .73); b(W * .5, .7, .02, M.metal, 0, 1.25, -D / 2 + .02, .01); b(.4, .45, .4, M.fabric, 0, .22, D / 2 + .28, .1); break;
      case "lave_mains": b(W, .12, D, M.ceramic, 0, .82, 0, .04); b(.04, .2, .04, M.metal, 0, .95, -D / 2 + .05); break;
      case "meuble_tv": b(W, .42, D, M.wood, 0, .25, 0, .015); b(W * .75, .45, .04, M.screen, 0, 1.15, -D / 2 + .06, .01); break;
      case "fauteuil": b(W, .22, D, M.fabric, 0, .22, 0, .06); b(W - .1, .14, D - .2, M.fabric, 0, .38, .05, .06); b(W, .4, .16, M.fabric, 0, .6, -D / 2 + .08, .06); b(.12, .2, D, M.fabric, -W / 2 + .06, .42, 0, .05); b(.12, .2, D, M.fabric, W / 2 - .06, .42, 0, .05); break;
      case "table": { b(W, .045, D, rk === "jeux" ? M.dark : M.wood, 0, .75, 0, .015); legs(W, D, .73, M.dark, .05);
        const nc = Math.max(1, Math.floor(W / .62)); for (let i = 0; i < nc; i++) for (const sz of [-1, 1]) { const cx = -W / 2 + W * (i + .5) / nc; b(.44, .05, .44, M.fabric, cx, .46, sz * (D / 2 + .22), .02); b(.44, .48, .05, M.fabric, cx, .72, sz * (D / 2 + .43), .02); for (const lx of [-1, 1]) for (const lz of [-1, 1]) b(.03, .44, .03, M.dark, cx + lx * .19, .22, sz * (D / 2 + .22) + lz * .19); }
        b(.22, .02, .22, M.white, 0, .78, 0); break; }
      case "plan": { b(W, .86, D, M.white, 0, .43, 0); b(W + .02, .04, D + .02, M.counter, 0, .88, 0); const lg = W > D, n = Math.max(1, Math.round((lg ? W : D) / .6));
        for (let i = 0; i < n; i++) { const u = -((lg ? W : D) / 2) + (lg ? W : D) * (i + .5) / n; lg ? b(.12, .015, .015, M.metal, u, .78, D / 2 + .01) : b(.015, .015, .12, M.metal, W / 2 + .01, .78, u); } break; }
      case "ilot": b(W, .88, D, M.wood, 0, .44, 0); b(W + .08, .04, D + .08, M.counter, 0, .9, 0); for (let i = 0; i < 3; i++) { b(.36, .04, .36, M.dark, -W / 2 + W * (i + .5) / 3, .72, D / 2 + .35, .02); b(.03, .7, .03, M.metal, -W / 2 + W * (i + .5) / 3, .36, D / 2 + .35); } break;
      case "douche": { b(W, .05, D, M.ceramic, 0, .025, 0); const gl = b(W * .6, 2, .01, M.glass, -W * .2, 1, D / 2); gl.castShadow = false; b(.03, 2.05, .03, M.metal, W * .1, 1.02, D / 2); b(.25, .02, .25, M.metal, 0, 2.1, -D / 2 + .2); b(.03, .3, .03, M.metal, 0, 2.2, -D / 2 + .06); break; }
      case "wc_cuv": b(W * .9, .38, D * .62, M.ceramic, 0, .2, D * .12, .12); b(W, .05, D * .6, M.ceramic, 0, .41, D * .12, .02); b(W, .38, .16, M.ceramic, 0, .62, -D / 2 + .08, .04); break;
      case "vasque": b(W, .55, D, M.wood, 0, .5, 0, .01); b(W, .05, D, M.counter, 0, .8, 0); b(.42, .12, .32, M.ceramic, 0, .88, .02, .06); b(W * .9, .7, .02, M.metal, 0, 1.45, -D / 2 + .02); break;
      case "armoire": { b(W, 2.25, D, M.wood, 0, 1.125, 0, .01); const n = Math.max(2, Math.round(W / .5)); for (let i = 1; i < n; i++) b(.005, 2.2, .01, M.dark, -W / 2 + W * i / n, 1.125, D / 2 + .002); for (let i = 0; i < n; i++) b(.02, .3, .02, M.metal, -W / 2 + W * (i + .5) / n + .08, 1.1, D / 2 + .02); break; }
      case "chevet": b(W, .48, D, M.wood, 0, .24, 0, .015); b(.18, .02, .18, M.dark, 0, .49, 0); b(.04, .3, .04, M.metal, 0, .64, 0); b(.26, .2, .26, M.lamp, 0, .86, 0, .05); break;
      case "bureau_t": b(W, .035, D, M.wood, 0, .74, 0, .01); b(.04, .72, D, M.dark, -W / 2 + .03, .36, 0); b(.04, .72, D, M.dark, W / 2 - .03, .36, 0); b(.55, .34, .03, M.screen, 0, 1.02, -D / 2 + .15); b(.5, .5, .5, M.fabric, 0, .45, D / 2 + .3, .08); break;
      case "biblio": { b(W, 2, D, M.wood, 0, 1, 0, .01); const cols = ["#7a3b2a", "#2f4a5f", "#c9a24a", "#3d5a3a", "#8a8a8a"]; for (let s = 0; s < 4; s++) { let u = -W / 2 + .05; while (u < W / 2 - .1) { const bw = rnd(.03, .07), bh = rnd(.22, .3); const bk = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D * .7), new THREE.MeshStandardMaterial({ color: cols[(Math.random() * 5) | 0], roughness: .8 })); bk.position.set(u + bw / 2, .2 + s * .45 + bh / 2, .03); g.add(bk); u += bw + .005; } } break; }
      case "machine": b(W, .85, D, M.white, 0, .425, 0, .03); { const p = new THREE.Mesh(new THREE.CircleGeometry(.18, 24), M.dark); p.position.set(0, .45, D / 2 + .002); g.add(p); } break;
    }
  }

  // ---------- Végétation procédurale ----------
  function blob(r, det, m, jit = .22) { const geo = new THREE.IcosahedronGeometry(r, det), p = geo.attributes.position, col = []; const tmp = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { tmp.fromBufferAttribute(p, i); const n = 1 + (Math.sin(tmp.x * 5.1 + tmp.y * 3.7) * .5 + Math.sin(tmp.z * 6.3 - tmp.y * 4.1) * .5) * jit + rnd(-.04, .04); tmp.multiplyScalar(n); p.setXYZ(i, tmp.x, tmp.y * .85, tmp.z); const k = .75 + .35 * (tmp.y / r + 1) / 2 + rnd(-.06, .06); col.push(k, k, k); }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals(); return shadowAll(new THREE.Mesh(geo, m)); }
  function tree(x, z, s) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rnd(0, 6); root.add(g);
    const t = shadowAll(new THREE.Mesh(new THREE.CylinderGeometry(.1 * s, .2 * s, 2.6 * s, 10), M.trunk)); t.position.y = 1.3 * s; g.add(t);
    for (let i = 0; i < 3; i++) { const br = shadowAll(new THREE.Mesh(new THREE.CylinderGeometry(.04 * s, .08 * s, 1.4 * s, 6), M.trunk)); br.position.set(0, 2.4 * s, 0); br.rotation.set(rnd(.5, .9), i * 2.1, 0); br.translateY(.6 * s); g.add(br); }
    for (let i = 0; i < 7; i++) { const c = blob(rnd(.8, 1.3) * s, 3, M.leaves[i % 3]); const a = rnd(0, 6.28), r = rnd(.2, 1.1) * s; c.position.set(Math.cos(a) * r, rnd(2.9, 4.1) * s, Math.sin(a) * r); g.add(c); } }
  function palm(x, z, h) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rnd(0, 6.28); root.add(g);
    const lean = rnd(.6, 1.4), curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * .25, h * .35, 0), new THREE.Vector3(lean * .7, h * .7, 0), new THREE.Vector3(lean, h, 0)]);
    const tr = shadowAll(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .17, 10), M.trunk)); g.add(tr);
    const top = curve.getPoint(1); for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), M.trunk); c.position.copy(top).add(new THREE.Vector3(Math.cos(i * 1.6) * .18, -.2, Math.sin(i * 1.6) * .18)); g.add(c); }
    const n = 14; for (let i = 0; i < n; i++) { const L = rnd(2.6, 3.4), geo = new THREE.PlaneGeometry(1.25, L, 1, 10); geo.translate(0, L / 2, 0); const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) { const y = p.getY(k), u = y / L; p.setZ(k, Math.pow(u, 2) * L * .5); p.setX(k, p.getX(k) * (1 - u * .3)); } geo.computeVertexNormals();
      const f = new THREE.Mesh(geo, M.frond); f.castShadow = true; f.position.copy(top); f.rotation.order = "YXZ"; f.rotation.y = i / n * Math.PI * 2 + rnd(-.2, .2); f.rotation.x = i % 3 === 0 ? rnd(.5, .8) : rnd(1.05, 1.45); g.add(f); } }
  function bush(x, z, s, flower) { const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g); for (let i = 0; i < 3; i++) { const c = blob(rnd(.45, .7) * s, 2, flower && i ? M.flower : M.leaves[(i + 1) % 3], .3); c.position.set(rnd(-.4, .4) * s, rnd(.35, .6) * s, rnd(-.4, .4) * s); g.add(c); } }
  function pot(x, z, y = 0, parent = root) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); const p = shadowAll(new THREE.Mesh(new THREE.CylinderGeometry(.25, .18, .45, 16), M.pot)); p.position.y = .225; g.add(p); const c = blob(.38, 2, M.leaves[1], .35); c.position.y = .75; g.add(c); }

  let X = x => x, Z = y => y;
  function build(plan, st = state.style) {
    state.plan = plan; state.style = st; scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); root = new THREE.Group(); scene.add(root);
    groups.levels = []; groups.ceilings = []; PLAN.hide = []; PLAN.show = []; PLAN.site = []; PLAN.level = -1; groups.roof = null; state.rooms = []; state.room = null; state.vp = 0; state.roof = true; state.upper = true; nightLights.length = 0; anim.length = 0;
    mats(st);
    LIT = new Set(plan.levels.flatMap((L, l) => L.rooms.filter(r => r.hab && !r.stair).map(r => [r, r.w * r.h * (l ? .6 : 1)])).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]));
    // terrain d'affichage : si le bâtiment déborde de la parcelle saisie, on l'agrandit pour garder clôture et végétation hors des murs
    { const s0 = plan.site, Lg = Math.max(s0.L, plan.W + 6), Pg = Math.max(s0.P, s0.oy + plan.D + 3); if (Lg > s0.L + .01 || Pg > s0.P + .01) plan.site = { ...s0, L: Lg, P: Pg, ox: (Lg - plan.W) / 2, grown: 1 }; }
    const { W, D, site } = plan, Lp = site.L, Pp = site.P, p = plan.p, comp = !!plan.blocks, BL = plan.blocks || [{ x: 0, y: 0, w: W, h: D }], kind = plan.kind || "house";
    const ox = -Lp / 2 + site.ox, oz = Pp / 2 - site.oy; X = x => ox + x; Z = y => oz - y; // façade avant (y=0) vers +z (sud)
    const plane = (w, d, m, x, y, z) => { const pg = new THREE.PlaneGeometry(w, d), uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d); const k = new THREE.Mesh(pg, m); k.rotation.x = -Math.PI / 2; k.position.set(x, y, z); k.receiveShadow = true; root.add(k); return k; };
    // environnement : terre latéritique, rue goudronnée, trottoir
    plane(700, 700, M.laterite, 0, -.03, 0);
    plane(Lp + 40, 7, M.asphalt, 0, -.01, Pp / 2 + 5.2); plane(Lp + 40, 1.6, M.pave, 0, .02, Pp / 2 + .8);
    for (let i = -Lp / 2 - 18; i < Lp / 2 + 18; i += 4) plane(2, .12, M.white, i, 0, Pp / 2 + 5.2);
    plane(Lp, Pp, M.grass, 0, 0, 0);
    // allée, terrasse avant
    const ent = comp && plan.entry && plan.entry.y < .05 ? plan.entry.x : W / 2, tw = Math.min(W, 8), tcx = X(Math.min(W - tw / 2, Math.max(tw / 2, ent)));
    if (comp && kind !== "house") { // parvis minéral sur toute la façade (commerce, hôtel) + parking
      box(W + 2, .1, site.oy - .2, M.pave, X(W / 2), .05, Z(0) + (site.oy - .2) / 2, root, false);
      if (p.parking) { const n = Math.floor((W + 1) / 2.5); for (let i = 0; i <= n; i++) box(.1, .012, 4.6, M.white, X(-.5 + i * 2.5), .105, Z(0) + .9 + 2.3, root, false); box(W + 1, .012, .1, M.white, X(W / 2), .105, Z(0) + .9 + 4.6, root, false); } }
    else box(tw + .6, .12, 3, M.pave, tcx, .06, Z(0) + 1.5, root, false);
    box(1.4, .08, site.oy - 3, M.pave, X(1.5), .04, Pp / 2 - (site.oy - 3) / 2, root, false);
    // clôture
    const fh = 2.2, ft = .2, gx = X(1.5), gw = 3.5;
    const fwall = (len, x, z, rotZ) => { if (len < .1) return; const g = rotZ ? box(ft, fh, len, M.fence, x, fh / 2, z) : box(len, fh, ft, M.fence, x, fh / 2, z); rotZ ? box(ft + .06, .06, len, M.accent, x, fh + .03, z) : box(len, .06, ft + .06, M.accent, x, fh + .03, z); };
    fwall(Lp, 0, -Pp / 2 + ft / 2); fwall(Pp, -Lp / 2 + ft / 2, 0, 1); fwall(Pp, Lp / 2 - ft / 2, 0, 1);
    { const l = (gx - gw / 2) + Lp / 2, r = Lp / 2 - (gx + gw / 2), z = Pp / 2 - ft / 2;
      for (const [len, cx] of [[l, -Lp / 2 + l / 2], [r, Lp / 2 - r / 2]]) { if (len < .1) continue; box(len, .9, ft, M.fence, cx, .45, z); box(len, .06, ft + .04, M.accent, cx, .93, z);
        const gr = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1), M.grille.clone()); gr.material.map = M.grille.map.clone(); gr.material.map.repeat.set(len / .6, 1); gr.material.map.needsUpdate = true; gr.position.set(cx, 1.51, z); gr.castShadow = true; root.add(gr); box(len, .05, .05, M.frame, cx, 2.06, z, root, false);
        for (let u = cx - len / 2 + .1; u <= cx + len / 2; u += 3) box(.3, 2.2, .3, M.fence, u, 1.1, z); }
      const gt = new THREE.Mesh(new THREE.PlaneGeometry(gw, 1.95), M.grille.clone()); gt.material.map = M.grille.map.clone(); gt.material.map.repeat.set(gw / .6, 1); gt.material.map.needsUpdate = true; gt.position.set(gx, 1.0, z); gt.castShadow = true; root.add(gt);
      for (const s of [-1, 1]) { box(.4, 2.5, .4, M.fence, gx + s * (gw / 2 + .2), 1.25, z); box(.22, .3, .22, M.lamp, gx + s * (gw / 2 + .2), 2.66, z, root, false); const L = new THREE.PointLight(0xffc27a, 0, 9, 2); L.position.set(gx + s * (gw / 2 + .2), 2.6, z + .4); L.userData.on = 5; root.add(L); nightLights.push(L); } }
    // piscine
    // cour non couverte : terrasse dallée le long des façades intérieures, jardin au-delà
    for (const z of plan.outside || []) if (z.k !== "jardin") box(z.w, .1, z.h, M.pave, X(z.x + z.w / 2), .05, Z(z.y + z.h / 2), root, false);
    { const T = (plan.outside || []).find(z => z.k === "terr" && z.n); if (T) for (let u = T.x + 1.2; u < T.x + T.w - .8; u += 4.5) pot(X(u), Z(T.y + T.h - .5), .1); }
    const gz = (plan.outside || []).find(z => z.k === "jardin"), crt = gz && gz.w > 7 && gz.h > 6 ? gz : null;
    if (p.piscine) { const back = Pp - site.oy - D - 1, pw = crt ? Math.min(12, crt.w - 3) : Math.min(8, W * .7), pd = crt ? Math.min(6, crt.h - 2.5) : 4, inBack = crt || back > pd + 2.5;
      const pz = crt ? Z(crt.y + crt.h / 2) : inBack ? Z(D + 1.6 + pd / 2) : Pp / 2 - site.oy / 2, px = crt ? X(crt.x + crt.w / 2) : inBack ? X(W / 2) : X(W - pw / 2 - .5);
      if (inBack || site.oy > pd + 1.5) { const ringB = (w, d, t, m, y, h) => { box(w, h, t, m, px, y, pz - d / 2 + t / 2, root, false); box(w, h, t, m, px, y, pz + d / 2 - t / 2, root, false); box(t, h, d - 2 * t, m, px - w / 2 + t / 2, y, pz, root, false); box(t, h, d - 2 * t, m, px + w / 2 - t / 2, y, pz, root, false); };
        ringB(pw + 3, pd + 2.4, 1.2, M.pave, .04, .08); ringB(pw + .6, pd + .6, .3, M.coping, .07, .12);
        plane(pw, pd, M.poolTile, px, .05, pz);
        const wtr = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), M.water); wtr.rotation.x = -Math.PI / 2; wtr.position.set(px, .1, pz); root.add(wtr); anim.push(t => { M.water.normalMap.offset.set(t * .012, t * .008); });
        for (const s of [-1, 1]) { const ch = new THREE.Group(); ch.position.set(px + s * (pw / 2 - 1), .1, pz + (inBack ? pd / 2 + .9 : -pd / 2 - .9)); root.add(ch); const k = shadowAll(new THREE.Mesh(boxGeo(.65, .12, 1.8, .04), M.white)); k.position.y = .3; ch.add(k); const bk = shadowAll(new THREE.Mesh(boxGeo(.65, .08, .7, .03), M.white)); bk.position.set(0, .5, -.75); bk.rotation.x = .6; ch.add(bk); } } }
    // garage
    if (p.garage) { const gwd = 3.6, gd = 6, sideR = Lp / 2 - X(W) - .2, right = sideR > gwd + .3, gxx = right ? X(W) + gwd / 2 + .1 : X(0) - gwd / 2 - .1, gz = Z(gd / 2);
      if (Math.max(sideR, X(0) + Lp / 2 - .2) > gwd + .2) { box(gwd, 2.7, gd, M.facade, gxx, 1.35, gz); box(gwd + .4, .22, gd + .4, M.slab, gxx, 2.81, gz); box(gwd + .44, .08, gd + .44, M.accent, gxx, 2.95, gz);
        const door = box(gwd - .5, 2.2, .06, M.frame, gxx, 1.1, gz + gd / 2 + .01); for (let i = 1; i < 10; i++) box(gwd - .52, .015, .07, M.dark, gxx, i * .22, gz + gd / 2 + .02, root, false);
        box(gwd - .4, .08, site.oy, M.pave, gxx, .04, Pp / 2 - site.oy / 2, root, false); } }
    const freeAt = (x, z, m) => !BL.some(b => x > X(b.x) - m && x < X(b.x + b.w) + m && z > Z(b.y + b.h) - m && z < Z(b.y) + m);
    const palmS = (x, z, h) => freeAt(x, z, 2.8) && palm(x, z, h), treeS = (x, z, k) => freeAt(x, z, 2.4) && tree(x, z, k), bushS = (x, z, k, fl) => freeAt(x, z, .9) && bush(x, z, k, fl), potS = (x, z, y) => freeAt(x, z, .3) && pot(x, z, y);
    // végétation tropicale
    palmS(-Lp / 2 + 1.8, Pp / 2 - 2, rnd(6.5, 8)); palmS(Lp / 2 - 1.6, -Pp / 2 + 1.8, rnd(7, 9)); if (Lp > 16) palmS(Lp / 2 - 2.2, Pp / 2 - 2.6, rnd(5.5, 7));
    treeS(-Lp / 2 + 2.2, -Pp / 2 + 2.4, 1.15); if (Pp > 24) treeS(X(W) + 2.4 < Lp / 2 - 1.5 ? X(W) + 2.4 : -Lp / 2 + 2, Z(D) - 2, .9);
    for (let u = -Lp / 2 + 1; u < Lp / 2 - 1; u += rnd(1.6, 2.4)) if (Math.abs(u - gx) > gw / 2 + .8) bushS(u, Pp / 2 - .8, rnd(.7, 1), Math.random() < .35);
    for (let v = -Pp / 2 + 1.5; v < Pp / 2 - 3; v += rnd(1.8, 2.8)) { bushS(-Lp / 2 + .8, v, rnd(.7, 1.1), Math.random() < .3); bushS(Lp / 2 - .8, v, rnd(.7, 1.1), Math.random() < .3); }
    potS(tcx - tw / 2 + .3, Z(0) + .4, .12); potS(tcx + tw / 2 - .3, Z(0) + .4, .12);

    // cour aménagée : jardin planté, massifs fleuris, salons d'extérieur sur la terrasse
    { const G = (plan.outside || []).find(z => z.k === "jardin"), T = (plan.outside || []).find(z => z.k === "terr" && z.n);
      if (G) { for (let u = G.x + .8; u < G.x + G.w - .5; u += 1.9) bushS(X(u), Z(G.y + G.h - .7), rnd(.6, .9), Math.random() < .5);
        if (!p.piscine) { palmS(X(G.x + G.w * .25), Z(G.y + G.h * .55), rnd(5, 6.5)); if (G.w > 9) palmS(X(G.x + G.w * .75), Z(G.y + G.h * .45), rnd(5, 6.5)); treeS(X(G.x + G.w / 2), Z(G.y + G.h * .5), .8); } }
      if (T && T.w > 5) for (let u = T.x + 2.2; u < T.x + T.w - 2; u += 4.2) { const cx = X(u), cz = Z(T.y + T.h / 2); const tp = shadowAll(new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .04, 24), M.wood)); tp.position.set(cx, .82, cz); root.add(tp); box(.08, .72, .08, M.metal, cx, .46, cz);
          for (const [dx, dz] of [[.85, 0], [-.85, 0], [0, .85], [0, -.85]]) { box(.42, .05, .42, M.fabric, cx + dx, .52, cz + dz, root, true, .02); box(.05, .42, .05, M.dark, cx + dx, .31, cz + dz); } } }
    PLAN.site = root.children.slice(); const pbg = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: "#f3efe8", roughness: 1 })); pbg.rotation.x = -Math.PI / 2; pbg.position.y = .005; pbg.receiveShadow = true; pbg.visible = false; root.add(pbg); PLAN.show.push(pbg);
    // niveaux
    plan.levels.forEach((L, l) => {
      const g = new THREE.Group(); root.add(g); groups.levels.push(g); const y0 = l * LEVEL_H, yb = y0 + .2; LITE = comp && l >= 2 && plan.levels.length > 2; // étages courants : sans mobilier (fluidité)
      const env = comp ? envelope(L.rooms) : null, xs = comp ? extSegs(L.rooms, env) : null;
      const ends = (sg, e) => segEnds(L.rooms, sg, e);
      if (comp) { for (const b of BL) box(b.w + 2 * T_EXT, .2, b.h + 2 * T_EXT, M.slab, X(b.x + b.w / 2), y0 + .1, Z(b.y + b.h / 2), g);
        if (l === 0) { const pH = .45, e = T_EXT + .02; for (const sg of xs) { const [e0, e1] = ends(sg, e), len = sg.a1 - sg.a0 + e0 + e1, mid = (sg.a0 - e0 + sg.a1 + e1) / 2;
          if (sg.o === "h") box(len, pH, .04, M.plinth, X(mid), pH / 2, Z(sg.at + sg.out * e), g); else box(.04, pH, len, M.plinth, X(sg.at + sg.out * e), pH / 2, Z(mid), g); } } }
      else box(W + 2 * T_EXT, .2, D + 2 * T_EXT, M.slab, X(W / 2), y0 + .1, Z(D / 2), g);
      if (l === 0 && !comp) { const pH = .45, e = T_EXT + .02; box(W + 2 * e, pH, .04, M.plinth, X(W / 2), pH / 2, Z(-e), g); box(W + 2 * e, pH, .04, M.plinth, X(W / 2), pH / 2, Z(D + e), g); box(.04, pH, D + 2 * e, M.plinth, X(-e), pH / 2, Z(D / 2), g); box(.04, pH, D + 2 * e, M.plinth, X(W + e), pH / 2, Z(D / 2), g); }
      for (const r of L.rooms) { state.rooms.push({ r, l });
        const wet = /sdb|wc|dch|buand|sdh|san|vest|kit|cuisinepro|linge/.test(r.k);
        const pg = new THREE.PlaneGeometry(r.w, r.h), uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r.w, uv.getY(i) * r.h);
        const fl = new THREE.Mesh(pg, wet ? M.wet : M.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(X(r.x + r.w / 2), yb + .002, Z(r.y + r.h / 2)); fl.receiveShadow = true; g.add(fl);
        if (!LITE) for (const f of furniture(r, L)) furn3d(f, yb, g, r.k);
        if (r.stair) { const n = 16, run = r.h - .4, sw = Math.min(1.1, r.w * .45); for (let i = 0; i < n; i++) box(sw, .04, run / n + .02, M.wood, X(r.x + .1 + sw / 2), yb + .175 * (i + 1), Z(r.y + .2 + run * (i + .5) / n), g); for (let i = 0; i < n; i++) box(sw, .175 * (i + 1) - .04, run / n, M.white, X(r.x + .1 + sw / 2), yb + .175 * (i + 1) / 2 - .02, Z(r.y + .2 + run * (i + .5) / n), g);
          box(.04, .9, run, M.metal, X(r.x + .1 + sw), yb + 1.6, Z(r.y + .2 + run / 2), g); }
        if (r.hab && !r.stair && (!comp || lightOK(r, l))) { const lt = new THREE.PointLight(0xffc98a, 0, Math.max(r.w, r.h) * 1.8, 2); lt.position.set(X(r.x + r.w / 2), yb + WALL_H - .35, Z(r.y + r.h / 2)); lt.userData.on = 2.2 + r.w * r.h * .12; g.add(lt); nightLights.push(lt);
        }
      }
      // plafond (masqué avec la toiture)
      const cg = new THREE.Group(); g.add(cg); groups.ceilings.push(cg);
      for (const b of BL) { const cp = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), M.ceil); cp.rotation.x = Math.PI / 2; cp.position.set(X(b.x + b.w / 2), yb + WALL_H - .001, Z(b.y + b.h / 2)); cp.receiveShadow = true; cg.add(cp); }
      for (const r of L.rooms) if ((r.hab || r.k === "couloir") && !r.stair && !LITE) ceilingRoom(r, yb, cg);
      // ouvertures
      const near = (a, b) => Math.abs(a - b) < 1e-3;
      const dh = d => ({ c: d.c, w: d.w, sill: 0, head: d.shop ? 2.6 : d.open ? 2.4 : 2.1, door: 1, open: d.open, main: d.main, shop: d.shop });
      const holesH = Y => [...L.wins.filter(w => w.o === "h" && near(w.at, Y)).map(w => ({ c: w.c, w: w.w, sill: w.sill, head: w.head, win: 1, baie: w.baie, vit: w.vit })), ...L.doors.filter(d => d.o === "h" && near(d.y, Y)).map(dh)];
      const holesV = Xv => [...L.wins.filter(w => w.o === "v" && near(w.at, Xv)).map(w => ({ c: w.c, w: w.w, sill: w.sill, head: w.head, win: 1, baie: w.baie, vit: w.vit })), ...L.doors.filter(d => d.o === "v" && near(d.x, Xv)).map(dh)];
      const hx = Y => holesH(Y).map(h => ({ ...h, c: X(h.c) })), hz = Xv => holesV(Xv).map(h => ({ ...h, c: Z(h.c) }));
      if (comp) for (const sg of xs) { if (sg.o === "h") { const [e0, e1] = ends(sg, T_EXT); wall("x", X(sg.a0 - e0), X(sg.a1 + e1), Z(sg.at) - sg.out * T_EXT / 2, yb, T_EXT, M.wallIn, hx(sg.at), g, { m: M.facade, z: -sg.out }); }
        else wall("z", Z(sg.a1), Z(sg.a0), X(sg.at) + sg.out * T_EXT / 2, yb, T_EXT, M.wallIn, hz(sg.at), g, { m: M.facade, x: sg.out }); }
      else { wall("x", X(0) - T_EXT, X(W) + T_EXT, Z(0) + T_EXT / 2, yb, T_EXT, M.wallIn, hx(0), g, { m: M.facade, z: 1 });
      wall("x", X(0) - T_EXT, X(W) + T_EXT, Z(D) - T_EXT / 2, yb, T_EXT, M.wallIn, hx(D), g, { m: M.facade, z: -1 });
      wall("z", Z(D), Z(0), X(0) - T_EXT / 2, yb, T_EXT, M.wallIn, hz(0), g, { m: M.facade, x: -1 });
      wall("z", Z(D), Z(0), X(W) + T_EXT / 2, yb, T_EXT, M.wallIn, hz(W), g, { m: M.facade, x: 1 }); }
      // cloisons (dédoublonnées), faïence côté pièces d'eau
      const seen = new Set(), wetAt = (x, y) => L.rooms.some(r => /sdb|dch|wc|sdh|san/.test(r.k) && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
      const parts = comp ? intSegs(L.rooms, env).map(p => p.o === "h" ? [p.a0, p.at, p.a1, p.at] : [p.at, p.a0, p.at, p.a1]) : L.rooms.flatMap(r => [[r.x, r.y, r.x + r.w, r.y], [r.x, r.y + r.h, r.x + r.w, r.y + r.h], [r.x, r.y, r.x, r.y + r.h], [r.x + r.w, r.y, r.x + r.w, r.y + r.h]]);
      for (const s of parts) {
        const hzl = near(s[1], s[3]); if (!comp && hzl && (near(s[1], 0) || near(s[1], D))) continue; if (!comp && !hzl && (near(s[0], 0) || near(s[0], W))) continue;
        const key = s.map(v => v.toFixed(2)).join(","); if (seen.has(key)) continue; seen.add(key);
        if (hzl) { const mx = (s[0] + s[2]) / 2, a = wetAt(mx, s[1] + .05), b = wetAt(mx, s[1] - .05); // a : côté y+ (monde -z)
          wall("x", X(s[0]), X(s[2]), Z(s[1]), yb, T_INT, M.wallIn, holesH(s[1]).map(h => ({ ...h, c: X(h.c) })), g, null, a || b ? { m: M.wetWall, z: a ? -1 : 1 } : null); }
        else { const my = (s[1] + s[3]) / 2, a = wetAt(s[0] + .05, my), b = wetAt(s[0] - .05, my);
          wall("z", Z(s[3]), Z(s[1]), X(s[0]), yb, T_INT, M.wallIn, holesV(s[0]).map(h => ({ ...h, c: Z(h.c) })), g, null, a || b ? { m: M.wetWall, x: a ? 1 : -1 } : null); }
      }
      if (comp) ringSegs(xs, L.rooms, .2, .16, M.accent, yb + WALL_H + .1, g); else ring(W, D, .2, .16, M.accent, yb + WALL_H + .1, g);
      // appliques extérieures près de l'entrée
      if (l === 0) { const md = L.doors.find(d => d.main); if (md) { const mo = md.out ?? -1, mx = md.o === "h" ? X(md.c) : X(md.x), mz = md.o === "h" ? Z(md.y) : Z(md.c); for (const s of [-1, 1]) { const ax = md.o === "h" ? mx + s * (md.w / 2 + .35) : mx + (comp ? mo * .13 : 0), az = md.o === "h" ? mz - mo * .13 : mz + s * (md.w / 2 + .35); box(.1, .28, .1, M.lamp, ax, 2.2, az, g, false); const lt = new THREE.PointLight(0xffc27a, 0, 7, 2); lt.position.set(ax + (md.o === "v" && comp ? mo * .3 : 0), 2.1, az + (md.o === "h" ? -mo * .3 : 0)); lt.userData.on = 4; g.add(lt); nightLights.push(lt); } } }
    });
    // toiture
    const top = plan.levels.length * LEVEL_H + .2, rg = new THREE.Group(); root.add(rg); groups.roof = rg;
    const hipRoof = (bx, by, W, D) => { const ov = .8, a = W + 2 * ov, b = D + 2 * ov, hgt = Math.min(a, b) * .3, x0 = X(bx - ov), x1 = X(bx + W + ov), z0 = Z(by - ov), z1 = Z(by + D + ov), cz = (z0 + z1) / 2, rl = Math.max(0, (a - b) / 2), rw = Math.max(0, (b - a) / 2);
      const yb = top + .12, r0 = a >= b ? [X(bx + W / 2) - rl, yb + hgt, cz] : [X(bx + W / 2), yb + hgt, cz + rw], r1 = a >= b ? [X(bx + W / 2) + rl, yb + hgt, cz] : [X(bx + W / 2), yb + hgt, cz - rw];
      const v = [x0, yb, z0, x1, yb, z0, x1, yb, z1, x0, yb, z1, ...r0, ...r1];
      const tri = a >= b ? [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 3, 0, 4, 1, 2, 5] : [0, 1, 4, 1, 2, 5, 1, 5, 4, 2, 3, 5, 3, 0, 4, 3, 4, 5];
      // géométrie non indexée + UV planaires par pan (le long de la pente)
      const pos = [], uv = []; for (let i = 0; i < tri.length; i += 3) { const P = [0, 1, 2].map(j => new THREE.Vector3(v[tri[i + j] * 3], v[tri[i + j] * 3 + 1], v[tri[i + j] * 3 + 2]));
        const n = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0])).normalize(); const hz2 = new THREE.Vector3(n.x, 0, n.z).normalize(), side = new THREE.Vector3(-hz2.z, 0, hz2.x);
        for (const q of P) { pos.push(q.x, q.y, q.z); const slope = Math.hypot(n.x, n.z) > 1e-3 ? -(q.x * hz2.x + q.z * hz2.z) / Math.cos(Math.asin(Math.hypot(n.x, n.z))) : q.z; const sp = Math.sqrt(Math.max(1e-4, 1 - n.y * n.y)); uv.push(q.x * side.x + q.z * side.z, (q.y - yb) / sp); } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
      const rm = shadowAll(new THREE.Mesh(geo, M.roof)); rg.add(rm); M.roof.side = THREE.DoubleSide;
      box(a, .12, b, M.white, X(bx + W / 2), yb - .06, cz, rg); // sous-face (débord)
      const fz = (len, x, z) => box(len, .22, .05, M.accent, x, yb - .02, z, rg), fx = (len, x, z) => box(.05, .22, len, M.accent, x, yb - .02, z, rg);
      fz(a, X(bx + W / 2), z0); fz(a, X(bx + W / 2), z1); fx(b, x0, cz); fx(b, x1, cz); };
    if (st.roof === "flat" && comp) { for (const b of BL) box(b.w + 2 * T_EXT, .25, b.h + 2 * T_EXT, M.roof, X(b.x + b.w / 2), top + .1, Z(b.y + b.h / 2), rg);
      const LT = plan.levels[plan.levels.length - 1], xsT = extSegs(LT.rooms); parapetSegs(xsT, LT.rooms, .75, .2, M.facade, top + .575, rg); ringSegs(xsT, LT.rooms, .07, .3, M.accent, top + .98, rg);
      const bb = plan.bar, pvM = new THREE.MeshPhysicalMaterial({ color: "#16233a", roughness: .15, metalness: .4, clearcoat: 1 }), nP = Math.max(2, Math.min(14, Math.floor((bb.w - 2) / 1.1))), nR = Math.max(1, Math.min(3, Math.floor((bb.h - 2) / 2.6)));
      for (let row = 0; row < nR; row++) for (let i = 0; i < nP; i++) { const pnl = shadowAll(new THREE.Mesh(new THREE.BoxGeometry(1.0, .04, 1.7), pvM)); pnl.position.set(X(bb.x + 1 + i * 1.1 + .5), top + .7, Z(bb.y + 1.6 + row * 2.6)); pnl.rotation.x = .26; rg.add(pnl); }
      const tk = shadowAll(new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 1.5, 24), new THREE.MeshStandardMaterial({ color: "#1d1d1f", roughness: .5 }))); tk.position.set(X(bb.x + bb.w - 1.2), top + 1.0, Z(bb.y + bb.h - 1.2)); rg.add(tk); }
    else if (st.roof === "flat") { box(W + 2 * T_EXT, .25, D + 2 * T_EXT, M.roof, X(W / 2), top + .1, Z(D / 2), rg); const h = .75, t = .2;
      box(W + 2 * T_EXT, h, t, M.facade, X(W / 2), top + h / 2 + .2, Z(0) + T_EXT - t / 2, rg); box(W + 2 * T_EXT, h, t, M.facade, X(W / 2), top + h / 2 + .2, Z(D) - T_EXT + t / 2, rg);
      box(t, h, D + 2 * T_EXT, M.facade, X(0) - T_EXT + t / 2, top + h / 2 + .2, Z(D / 2), rg); box(t, h, D + 2 * T_EXT, M.facade, X(W) + T_EXT - t / 2, top + h / 2 + .2, Z(D / 2), rg);
      ring(W, D, .07, .3, M.accent, top + .98, rg);
      // panneaux photovoltaïques orientés plein sud + réservoir d'eau (polytank)
      const pvM = new THREE.MeshPhysicalMaterial({ color: "#16233a", roughness: .15, metalness: .4, clearcoat: 1, map: ctex("pv", 64, 128, (g, w, h) => { g.fillStyle = "#1b2b48"; g.fillRect(0, 0, w, h); g.strokeStyle = "#8fa3c0"; g.lineWidth = 1; for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }) });
      const nP = Math.max(2, Math.min(8, Math.floor((W - 2) / 1.1))); for (let row = 0; row < 2; row++) for (let i = 0; i < nP; i++) { const pnl = shadowAll(new THREE.Mesh(new THREE.BoxGeometry(1.0, .04, 1.7), pvM)); pnl.position.set(X(1 + i * 1.1 + .5), top + .7, Z(D * .25 + row * 2.6)); pnl.rotation.x = .26; rg.add(pnl); box(.05, .45, .05, M.metal, pnl.position.x, top + .45, pnl.position.z + .6, rg); }
      const tk = shadowAll(new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 1.5, 24), new THREE.MeshStandardMaterial({ color: "#1d1d1f", roughness: .5 }))); tk.position.set(X(W - 1.2), top + 1.0, Z(D - 1.2)); rg.add(tk); }
    else if (comp) for (const b of plan.roofBlocks) hipRoof(b.x, b.y, b.w, b.h);
    else hipRoof(0, 0, W, D);
    // auvent / pergola de terrasse
    const pz = Z(0) + 1.4, ph = WALL_H + .2;
    if (comp && kind !== "house") { const L0 = plan.levels[0], md = L0.doors.find(d => d.main && d.ext && d.o === "h" && d.out < 0);
      if (kind === "hotel" && md) { const cx = X(md.c), cz = Z(md.y); box(4.2, .2, 2.6, M.roof, cx, 3.05, cz + 1.3, rg); box(4.3, .26, .08, M.accent, cx, 3.05, cz + 2.6, rg); for (const sx of [-1, 1]) box(.16, 3.0, .16, M.metal, cx + sx * 1.95, 1.5, cz + 2.45);
        const lt = new THREE.PointLight(0xffc27a, 0, 9, 2); lt.position.set(cx, 2.7, cz + 1.3); lt.userData.on = 6; root.add(lt); nightLights.push(lt); }
      if (p.auvent || kind === "shops") for (const sg of extSegs(L0.rooms).filter(g => g.o === "h" && g.out < 0)) { const len = sg.a1 - sg.a0 + .4, cx = X((sg.a0 + sg.a1) / 2), cz = Z(sg.at) + T_EXT;
        box(len, .14, 1.9, M.roof, cx, 3.0, cz + .95, rg); box(len, .3, .06, M.accent, cx, 3.0, cz + 1.9, rg); for (let u = sg.a0 + .6; u < sg.a1; u += 3.2) { const rod = box(.03, .03, 2.1, M.metal, X(u), 3.55, cz + .9, rg, false); rod.rotation.x = -.5; } } }
    else if (st.pergola) { box(tw + .4, .2, .12, M.accent, tcx, ph, Z(0) + 2.85, rg); for (let u = -tw / 2; u <= tw / 2 + .01; u += .32) box(.08, .22, 2.9, M.slat, tcx + u, ph + .2, pz, rg); }
    else box(tw + .4, .16, 3, M.roof, tcx, ph + .08, pz, rg);
    if (!comp || kind === "house") { for (const sx of [-1, 1]) box(.2, ph, .2, M.accent, tcx + sx * (tw / 2), ph / 2, Z(0) + 2.8);
    { const lt = new THREE.PointLight(0xffc27a, 0, 8, 2); lt.position.set(tcx, ph - .3, pz); lt.userData.on = 6; root.add(lt); nightLights.push(lt); } }
    // ombres : cadrage serré sur la parcelle
    const s = Math.max(Lp, Pp) * .62; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 220 }); sun.shadow.camera.updateProjectionMatrix();
    setSun(state.hour); applyVis(); view("34");
  }
  // ---------- Staff (faux plafond) et luminaires ----------
  function ceilingRoom(r, yb, cg) {
    const F = state.fin, sk = +F.staff || 0, lt = F.light || "spots", top = yb + WALL_H, cx = X(r.x + r.w / 2), cz = Z(r.y + r.h / 2), big = r.w > 2.4 && r.h > 2.4;
    const b = (w, h, d, m, x, y, z) => { const k = new THREE.Mesh(boxGeo(w, h, d), m); k.position.set(x, y, z); k.receiveShadow = true; cg.add(k); return k; };
    let ceilY = top, inner = null;
    if (sk === 1 || (sk && !big)) { // corniche moulurée
      for (const [w, d, x, z] of [[r.w, .09, cx, Z(r.y) - .045], [r.w, .09, cx, Z(r.y + r.h) + .045], [.09, r.h, X(r.x) + .045, cz], [.09, r.h, X(r.x + r.w) - .045, cz]]) { b(w, .1, d, M.staff, x, top - .05, z); b(w, .03, d * 1.4, M.staff, x, top - .115, z); } }
    else if (sk >= 2) { // faux plafond périphérique + caisson central (gorge lumineuse)
      const bw = Math.min(.7, Math.min(r.w, r.h) * .22), hh = .28, y = top - .22; ceilY = top; inner = [r.w - 2 * bw, r.h - 2 * bw];
      for (const [w, d, x, z] of [[r.w, bw, cx, Z(r.y) - bw / 2], [r.w, bw, cx, Z(r.y + r.h) + bw / 2], [bw, r.h - 2 * bw, X(r.x) + bw / 2, cz], [bw, r.h - 2 * bw, X(r.x + r.w) - bw / 2, cz]]) b(w, hh, d, M.staff, x, y, z);
      // ruban LED caché dans la gorge
      for (const [w, d, x, z] of [[inner[0], .03, cx, Z(r.y + bw) + .02], [inner[0], .03, cx, Z(r.y + r.h - bw) - .02], [.03, inner[1], X(r.x + bw) + .02, cz], [.03, inner[1], X(r.x + r.w - bw) - .02, cz]]) b(w, .02, d, M.led, x, y + hh / 2 + .01, z);
      if (sk === 3) { // staff décoratif : moulures + rosace
        for (const [w, d, x, z] of [[inner[0] + .1, .05, cx, Z(r.y + bw) + .03], [inner[0] + .1, .05, cx, Z(r.y + r.h - bw) - .03], [.05, inner[1], X(r.x + bw) + .03, cz], [.05, inner[1], X(r.x + r.w - bw) - .03, cz]]) b(w, .05, d, M.staff, x, y - hh / 2 - .03, z);
        const ro = new THREE.Mesh(new THREE.TorusGeometry(Math.min(.45, inner[0] * .2), .045, 10, 40), M.staff); ro.rotation.x = Math.PI / 2; ro.position.set(cx, top - .03, cz); cg.add(ro);
        const ro2 = new THREE.Mesh(new THREE.CylinderGeometry(.18, .22, .05, 24), M.staff); ro2.position.set(cx, top - .03, cz); cg.add(ro2); } }
    // luminaires
    const spot = (x, z, y) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .015, 16), M.lamp); k.position.set(x, y, z); cg.add(k); const rr = new THREE.Mesh(new THREE.TorusGeometry(.05, .008, 6, 18), M.metal); rr.rotation.x = Math.PI / 2; rr.position.set(x, y - .005, z); cg.add(rr); };
    if (lt === "spots" || lt === "led" && !sk) { const yS = sk >= 2 ? top - .37 : top - .01, nx = Math.max(1, Math.round(r.w / 1.3)), nz = Math.max(1, Math.round(r.h / 1.3));
      if (sk >= 2) { for (let i = 0; i < nx; i++) for (const zz of [r.y + .35, r.y + r.h - .35]) spot(X(r.x + r.w * (i + .5) / nx), Z(zz), yS); }
      else for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) spot(X(r.x + r.w * (i + .5) / nx), Z(r.y + r.h * (j + .5) / nz), yS); }
    if (lt === "susp" || (sk === 3 && /sejour|sam|salon|chp/.test(r.k))) { const n = r.k === "sam" || r.k === "cuisine" ? 3 : 1, drop = sk === 3 ? .9 : .75;
      for (let i = 0; i < n; i++) { const x = n === 1 ? cx : X(r.x + r.w * (i + 1) / (n + 1)), y = top - drop;
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, drop, 6), M.dark); cord.position.set(x, top - drop / 2, cz); cg.add(cord);
        if (sk === 3 && n === 1) { const ch = new THREE.Group(); ch.position.set(x, y, cz); cg.add(ch); const ringG = new THREE.Mesh(new THREE.TorusGeometry(.35, .02, 8, 40), M.gold); ringG.rotation.x = Math.PI / 2; ch.add(ringG); for (let k = 0; k < 8; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), M.lamp); c.position.set(Math.cos(k * .785) * .35, .04, Math.sin(k * .785) * .35); ch.add(c); } }
        else { const sh = new THREE.Mesh(new THREE.CylinderGeometry(.08, .26, .28, 24, 1, true), M.frame); sh.material.side = THREE.DoubleSide; sh.position.set(x, y, cz); cg.add(sh); const bl = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 8), M.lamp); bl.position.set(x, y - .06, cz); cg.add(bl); } } }
    if (lt === "led" && !sk) for (const [w, d, x, z] of [[r.w - .1, .02, cx, Z(r.y) - .06], [r.w - .1, .02, cx, Z(r.y + r.h) + .06]]) b(w, .02, d, M.led, x, top - .04, z);
    if (lt === "appl") for (const [x, z] of [[X(r.x) + .07, cz], [X(r.x + r.w) - .07, cz]]) { b(.06, .22, .14, M.lamp, x, yb + 1.85, z); }
  }
  // ---------- Vue « plan 3D » (plan meublé vu de dessus, murs coupés, cotes) ----------
  function setPlanView(lv) { PLAN.level = lv; const on = lv >= 0;
    for (const o of PLAN.hide) o.visible = !on; for (const o of PLAN.show) o.visible = on; for (const o of root.children) if (!groups.levels.includes(o) && !PLAN.show.includes(o)) o.visible = !on;
    sky.visible = !on; scene.background = on ? new THREE.Color("#f6f3ee") : null; if (on) { if (scene.fog) PLAN.fog = scene.fog; scene.fog = null; } else if (PLAN.fog) scene.fog = PLAN.fog;
    if (on) { groups.levels.forEach((g, i) => g.visible = i === lv); if (groups.roof) groups.roof.visible = false; groups.ceilings.forEach(c => c.visible = false); }
    else applyVis();
    // éclairage de studio neutre + coupe horizontale juste au-dessus des murs
    if (on) { if (!PLAN.env) PLAN.env = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environment = PLAN.env; renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), lv * LEVEL_H + .2 + WALL_H + .02)]; }
    else { if (envRT) scene.environment = envRT.texture; renderer.clippingPlanes = []; }
    overlay && (overlay.style.display = on ? "block" : "none"); if (on) planLight(); else setSun(state.hour); }
  function planLight() { const dir = new THREE.Vector3(-.16, 1, -.22).normalize(); sun.position.copy(dir).multiplyScalar(80); sun.intensity = 2.2; sun.color.set("#fff1de"); hemi.intensity = .35; scene.environmentIntensity = .75 * ENVK; renderer.toneMappingExposure = EXPO * state.bright; bloom.enabled = false;
    for (const L of nightLights) L.visible = false; if (M.glass) M.glass.emissiveIntensity = 0; }
  const ROOMN = r => (r.n || "").toUpperCase();
  function drawOverlay(ctx, w, h, k = 1) {
    if (PLAN.level < 0 || !state.plan) return; const L = state.plan.levels[PLAN.level]; if (!L) return; const y = PLAN.level * LEVEL_H + .2 + WALL_H;
    const P = (x, z) => { const v = new THREE.Vector3(X(x), y, Z(z)).project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h]; };
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ppm = Math.abs(P(1, 0)[0] - P(0, 0)[0]); // pixels par mètre
    // portes : vantail et arc d'ouverture
    ctx.strokeStyle = "rgba(40,40,40,.85)"; ctx.lineWidth = Math.max(1, 1.4 * k);
    for (const d of L.doors) { if (d.open) continue; const r = L.rooms[d.ir]; if (!r) continue; const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      let hx, hy, ax, ay, lx, ly; if (d.o === "h") { hx = d.c - d.w / 2; hy = d.y; const sg = cy > d.y ? 1 : -1; lx = hx; ly = hy + sg * d.w; ax = d.c + d.w / 2; ay = d.y; }
      else { hx = d.x; hy = d.c - d.w / 2; const sg = cx > d.x ? 1 : -1; lx = hx + sg * d.w; ly = hy; ax = d.x; ay = d.c + d.w / 2; }
      const [Hx, Hy] = P(hx, hy), [Lx, Ly] = P(lx, ly), [Ax, Ay] = P(ax, ay), rr = Math.hypot(Lx - Hx, Ly - Hy);
      ctx.beginPath(); ctx.moveTo(Hx, Hy); ctx.lineTo(Lx, Ly); ctx.stroke(); const a0 = Math.atan2(Ly - Hy, Lx - Hx), a1 = Math.atan2(Ay - Hy, Ax - Hx); let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      ctx.beginPath(); ctx.arc(Hx, Hy, rr, a0, a1, da < 0); ctx.stroke(); }
    // étiquettes des pièces : numéro, nom, dimensions intérieures en mm
    L.rooms.forEach((r, i) => { if (r.w < .9 || r.h < .9) return; const [cx, cy] = P(r.x + r.w / 2, r.y + r.h / 2), fs = Math.max(9, Math.min(15, ppm * .22)) * k, bw = Math.min(r.w, r.h) * ppm;
      if (bw < 40 * k) return; const lines = [String(i + 1), ROOMN(r), `${Math.round(r.w * 1000)} × ${Math.round(r.h * 1000)} mm`];
      ctx.font = `600 ${fs}px Helvetica, Arial, sans-serif`; const tw = Math.max(...lines.map(t => ctx.measureText(t).width)) + 14 * k;
      ctx.fillStyle = "rgba(255,255,255,.78)"; const bh = fs * 3.8; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - tw / 2, cy - bh / 2, tw, bh, 6 * k) : ctx.rect(cx - tw / 2, cy - bh / 2, tw, bh); ctx.fill();
      ctx.fillStyle = "#222"; ctx.font = `700 ${fs * .95}px Helvetica, Arial, sans-serif`; ctx.fillText(lines[0], cx, cy - fs * 1.2); ctx.font = `700 ${fs}px Helvetica, Arial, sans-serif`; ctx.fillText(lines[1], cx, cy); ctx.font = `${fs * .85}px Helvetica, Arial, sans-serif`; ctx.fillStyle = "#444"; ctx.fillText(lines[2], cx, cy + fs * 1.15); });
    // cotes extérieures (hors-tout en haut et à gauche, chaînes des pièces à droite et en bas)
    const { W, D } = state.plan, off = .9, fs = Math.max(10, Math.min(16, ppm * .24)) * k; ctx.font = `600 ${fs}px Helvetica, Arial, sans-serif`; ctx.fillStyle = "#222"; ctx.strokeStyle = "#333"; ctx.lineWidth = 1.2 * k;
    const dimH = (a, b, yy) => { const [x0, y0] = P(a, yy), [x1] = P(b, yy); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); for (const xx of [x0, x1]) { ctx.moveTo(xx, y0 - 6 * k); ctx.lineTo(xx, y0 + 6 * k); } ctx.stroke(); ctx.fillText(`${Math.round((b - a) * 1000)} mm`, (x0 + x1) / 2, y0 - fs * .8); };
    const dimV = (a, b, xx, side) => { const [x0, y0] = P(xx, a), [, y1] = P(xx, b); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); for (const yy of [y0, y1]) { ctx.moveTo(x0 - 6 * k, yy); ctx.lineTo(x0 + 6 * k, yy); } ctx.stroke(); ctx.save(); ctx.translate(x0 + side * fs * .9, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${Math.round(Math.abs(b - a) * 1000)} mm`, 0, 0); ctx.restore(); };
    dimH(-T_EXT, W + T_EXT, D + T_EXT + off); dimV(-T_EXT, D + T_EXT, -T_EXT - off, -1);
    const ys = [...new Set(L.rooms.filter(r => Math.abs(r.x + r.w - W) < .01).flatMap(r => [r.y, r.y + r.h]).map(v => +v.toFixed(2)))].sort((a, b) => a - b); for (let i = 1; i < ys.length; i++) dimV(ys[i - 1], ys[i], W + T_EXT + off, 1);
    const xs = [...new Set(L.rooms.filter(r => Math.abs(r.y) < .01).flatMap(r => [r.x, r.x + r.w]).map(v => +v.toFixed(2)))].sort((a, b) => a - b); for (let i = 1; i < xs.length; i++) dimH(xs[i - 1], xs[i], -T_EXT - off);
    ctx.restore(); }
  function overlayFrame() { if (!overlay || PLAN.level < 0) return; const r = canvas.getBoundingClientRect(), pr = Math.min(devicePixelRatio || 1, 2); if (overlay.width !== Math.round(r.width * pr)) { overlay.width = Math.round(r.width * pr); overlay.height = Math.round(r.height * pr); }
    const ctx = overlay.getContext("2d"); ctx.clearRect(0, 0, overlay.width, overlay.height); drawOverlay(ctx, overlay.width, overlay.height, pr); }
  // bâtiments composés : prolongement des façades aux angles saillants (pas aux angles rentrants)
  function segEnds(rooms, sg, e) { const inAny = (x, y) => rooms.some(r => x > r.x + .001 && x < r.x + r.w - .001 && y > r.y + .001 && y < r.y + r.h - .001), o = sg.out * e / 2;
    const p0 = sg.o === "h" ? inAny(sg.a0 - e / 2, sg.at + o) : inAny(sg.at + o, sg.a0 - e / 2), p1 = sg.o === "h" ? inAny(sg.a1 + e / 2, sg.at + o) : inAny(sg.at + o, sg.a1 + e / 2); return [p0 ? 0 : e, p1 ? 0 : e]; }
  function ringSegs(xs, rooms, h, t, m, y, parent, inset = 0) { const e = T_EXT + .05 - inset;
    for (const sg of xs) { const [e0, e1] = segEnds(rooms, sg, e), len = sg.a1 - sg.a0 + e0 + e1, mid = (sg.a0 - e0 + sg.a1 + e1) / 2, off = sg.at + sg.out * (e - t / 2);
      if (sg.o === "h") box(len, h, t, m, X(mid), y, Z(off), parent); else box(t, h, len, m, X(off), y, Z(mid), parent); } }
  function parapetSegs(xs, rooms, h, t, m, y, parent) { for (const sg of xs) { const [e0, e1] = segEnds(rooms, sg, T_EXT), len = sg.a1 - sg.a0 + e0 + e1, mid = (sg.a0 - e0 + sg.a1 + e1) / 2, off = sg.at + sg.out * (T_EXT - t / 2);
      if (sg.o === "h") box(len, h, t, m, X(mid), y, Z(off), parent); else box(t, h, len, m, X(off), y, Z(mid), parent); } }
  let LIT = new Set(), LITE = false; const lightOK = r => LIT.has(r);
  // bandeau périphérique (4 lisses)
  function ring(W, D, h, t, m, y, parent, inset = 0) { const e = T_EXT + .05 - inset, a = W + 2 * e, b = D + 2 * e;
    box(a, h, t, m, X(W / 2), y, Z(-e) + t / 2, parent); box(a, h, t, m, X(W / 2), y, Z(D + e) - t / 2, parent);
    box(t, h, b, m, X(-e) + t / 2, y, Z(D / 2), parent); box(t, h, b, m, X(W + e) - t / 2, y, Z(D / 2), parent); }
  function applyVis() { const rv = state.roof && state.upper; if (groups.roof) groups.roof.visible = rv;
    const n = groups.levels.length; groups.levels.forEach((g, i) => g.visible = i === 0 || state.upper);
    groups.ceilings.forEach((c, i) => c.visible = (i < n - 1 && state.upper) || rv); }

  function setMode(m) { state.mode = m; controls.enableRotate = m !== "plan"; if (m === "plan") { controls.enablePan = true; controls.enableZoom = true; controls.minDistance = 3; controls.maxDistance = 600; state.room = null; return; } if (m === "room") { controls.enablePan = false; controls.enableZoom = false; controls.minPolarAngle = Math.PI * .28; controls.maxPolarAngle = Math.PI * .7; controls.minDistance = controls.maxDistance = .05; controls.rotateSpeed = .45; }
    else { controls.enablePan = true; controls.enableZoom = true; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI * .495; controls.minDistance = 1.5; controls.maxDistance = 160; controls.rotateSpeed = 1; state.room = null; } }
  // visite de pièce : la caméra reste sur un point de vue fixe (angle de la pièce) et pivote sur elle-même ; le pincement règle l'objectif
  function roomViewpoint(i) { const it = state.room, r = it.r, y = it.l * LEVEL_H + .2 + 1.55, m = Math.min(.4, r.w * .15, r.h * .15);
    const C = [[r.x + m, r.y + m], [r.x + r.w - m, r.y + m], [r.x + r.w - m, r.y + r.h - m], [r.x + m, r.y + r.h - m]], [px, py] = C[((i % 4) + 4) % 4], [qx, qy] = C[(((i % 4) + 4) % 4 + 2) % 4];
    const P = new THREE.Vector3(X(px), y, Z(py)), dir = new THREE.Vector3(X(qx) - X(px), -.35, Z(qy) - Z(py)).normalize();
    controls.target.copy(P).addScaledVector(dir, .05); camera.position.copy(P); state.vp = i; controls.update(); }
  function roomFov(f) { camera.fov = THREE.MathUtils.clamp(f, 38, 92); camera.updateProjectionMatrix(); }
  canvas.addEventListener("wheel", e => { if (state.mode !== "room") return; e.preventDefault(); roomFov(camera.fov + Math.sign(e.deltaY) * 4); }, { passive: false });
  { const tp = new Map(); let d0 = 0, f0 = 0;
    canvas.addEventListener("pointerdown", e => { tp.set(e.pointerId, e); if (tp.size === 2) { const [a, b] = [...tp.values()]; d0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); f0 = camera.fov; } });
    canvas.addEventListener("pointermove", e => { if (!tp.has(e.pointerId)) return; tp.set(e.pointerId, e); if (tp.size === 2 && state.mode === "room") { const [a, b] = [...tp.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (d0 > 0) roomFov(f0 * d0 / d); } });
    const up = e => tp.delete(e.pointerId); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up); }
  // contraintes caméra : rester dans la pièce, ne jamais traverser les murs de l'extérieur
  function constrain() {
    if (!state.plan || state.mode === "plan") return; const c = camera.position;
    if (state.mode === "room" && state.room) { const { r, l } = state.room, m = .15, y = l * LEVEL_H + .2;
      c.x = THREE.MathUtils.clamp(c.x, X(r.x) + m, X(r.x + r.w) - m); c.z = THREE.MathUtils.clamp(c.z, Z(r.y + r.h) + m, Z(r.y) - m); c.y = THREE.MathUtils.clamp(c.y, y + .5, y + WALL_H - .35); return; }
    const { W, D } = state.plan, e = T_EXT + .45, top = (state.upper ? state.plan.levels.length : 1) * LEVEL_H + (state.roof ? 2.6 : .6);
    for (const b of state.plan.blocks || [{ x: 0, y: 0, w: W, h: D }]) { const x0 = X(b.x) - e, x1 = X(b.x + b.w) + e, z0 = Z(b.y + b.h) - e, z1 = Z(b.y) + e;
    if (c.y < top && c.x > x0 && c.x < x1 && c.z > z0 && c.z < z1) { const d = [c.x - x0, x1 - c.x, c.z - z0, z1 - c.z, top - c.y], k = d.indexOf(Math.min(...d));
      if (k === 0) c.x = x0; else if (k === 1) c.x = x1; else if (k === 2) c.z = z0; else if (k === 3) c.z = z1; else c.y = top; } }
    if (c.y < .4) c.y = .4;
  }
  function view(kind, roomIdx) {
    if (!state.plan) return; camera.near = .1; camera.far = 900; const pl = /^plan(\d)$/.exec(kind || ""); setPlanView(pl ? Math.min(+pl[1], state.plan.levels.length - 1) : -1); setMode(kind === "room" ? "room" : pl ? "plan" : "ext"); const { W, D } = state.plan, cx = X(W / 2), cz = Z(D / 2), H = state.plan.levels.length * LEVEL_H, P = state.plan.site.P, Lp = state.plan.site.L;
    camera.fov = kind === "room" ? 70 : kind === "front" ? 52 : kind === "garden" ? 68 : 42; camera.updateProjectionMatrix();
    if (pl) { const lvl = PLAN.level, L = state.plan.levels[lvl], xs = L.rooms.flatMap(r => [r.x, r.x + r.w]), ys = L.rooms.flatMap(r => [r.y, r.y + r.h]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const pw = x1 - x0 + 5, pd = y1 - y0 + 4.4, f = 11; camera.fov = f; camera.updateProjectionMatrix(); const t = Math.tan(f / 2 * Math.PI / 180), dist = Math.max(pd / 2 / t, pw / 2 / t / camera.aspect);
      const cx2 = X((x0 + x1) / 2), cz2 = Z((y0 + y1) / 2); camera.near = Math.max(.1, dist - 25); camera.far = dist + 25; camera.updateProjectionMatrix(); camera.up.set(0, 0, -1); camera.position.set(cx2, lvl * LEVEL_H + dist, cz2 + .001); controls.target.set(cx2, lvl * LEVEL_H, cz2); controls.update(); camera.up.set(0, 1, 0); return; }
    if (kind === "front") { camera.position.set(cx + W * .2, 2.2, P / 2 + 6.2); controls.target.set(cx, H * .5, Z(D * .3)); }
    else if (kind === "34") { camera.position.set(cx + W * .9 + 7, H + 8, Z(0) + D * .7 + 10); controls.target.set(cx, H * .35, cz); }
    else if (kind === "garden") { const Lp2 = state.plan.site.L / 2; camera.position.set(Math.min(Lp2 - 4, Math.max(-Lp2 + 4, cx + W * .25)), 1.7, -P / 2 + 1.3); controls.target.set(cx - W * .1, H * .5, cz); }
    else if (kind === "drone") { camera.position.set(cx - Lp * .55, Math.max(Lp, P) * .9, P / 2 + P * .35); controls.target.set(cx, 0, cz); }
    else if (kind === "top") { camera.position.set(cx + .01, Math.max(W, D) * 1.9 + 8, cz + .01); controls.target.set(cx, 0, cz); }
    else if (kind === "room") { const it = state.rooms[roomIdx]; if (!it) return; state.room = it; const r = it.r, L = state.plan.levels[it.l];
      // premier point de vue : l'angle le plus proche de la porte d'entrée de la pièce
      const dr = L.doors.find(d => d.o === "h" ? (Math.abs(d.y - r.y) < .01 || Math.abs(d.y - r.y - r.h) < .01) && d.c > r.x && d.c < r.x + r.w : (Math.abs(d.x - r.x) < .01 || Math.abs(d.x - r.x - r.w) < .01) && d.c > r.y && d.c < r.y + r.h);
      let best = 0; if (dr) { const dx = dr.o === "h" ? dr.c : dr.x, dy = dr.o === "h" ? dr.y : dr.c, C = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; let bd = 1e9; C.forEach((c, i) => { const dd = Math.hypot(c[0] - dx, c[1] - dy); if (dd < bd) { bd = dd; best = i; } }); }
      camera.fov = 72; camera.updateProjectionMatrix(); roomViewpoint(best); return; }
    controls.update();
  }

  let running = true; const t0 = performance.now();
  function frame() { const t = (performance.now() - t0) / 1000; for (const f of anim) f(t); if (quality) composer.render(); else renderer.render(scene, camera); }
  function loop() { requestAnimationFrame(loop); if (!running) return; controls.update(); constrain(); frame(); overlayFrame(); }
  requestAnimationFrame(loop);

  async function capture(w = 3840, h = 2160) {
    const pr = renderer.getPixelRatio(), asp = camera.aspect; running = false;
    if (PLAN.level >= 0) { if (asp < 1) { h = 3840; w = Math.round(3840 * asp); } else { w = 3840; h = Math.round(3840 / asp); } }
    sun.shadow.mapSize.set(4096, 4096); sun.shadow.map?.dispose(); sun.shadow.map = null;
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); composer.setPixelRatio(1); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    gtao.updateGtaoMaterial({ samples: 24 }); const q = quality; quality = true; frame(); frame();
    let blob; if (PLAN.level >= 0) { const c2 = document.createElement("canvas"); c2.width = w; c2.height = h; const x = c2.getContext("2d"); x.drawImage(canvas, 0, 0); drawOverlay(x, w, h, w / 1000); blob = await new Promise(res => c2.toBlob(res, "image/jpeg", .92)); }
    else blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", .92));
    quality = q; gtao.updateGtaoMaterial({ samples: 16 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.map?.dispose(); sun.shadow.map = null;
    renderer.setPixelRatio(pr); resize(); running = true; return blob;
  }

  return { build, resize, setSun, view, capture, set roof(v) { state.roof = v; applyVis(); }, set upper(v) { state.upper = v; applyVis(); }, set quality(v) { quality = v; },
    get rooms() { return state.rooms; }, nextView() { if (state.mode === "room" && state.room) roomViewpoint((state.vp || 0) + 1); }, set bright(v) { state.bright = v; setSun(state.hour); }, set fin(v) { state.fin = v || {}; }, setStyle(st) { if (state.plan) build(state.plan, st); else state.style = st; }, pause(v) { running = !v; } };
}
