/* CLB Sound 1.0.0 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const cfg = window.CLB_SOUND_CONFIG || {};
  const ready = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = ready ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const PAGE = 50;

  // ---------- préférences locales ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("clbsound." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("clbsound." + k, JSON.stringify(v)); } catch {} }
  };

  // ---------- état ----------
  const S = {
    tracks: [], total: 0, sort: "new", q: "", page: 0, loading: false,
    queue: [], order: [], pos: -1,           // file de lecture, ordre (aléatoire ou non), position dans l'ordre
    shuffle: store.get("shuffle", false),
    repeat: store.get("repeat", "off"),      // off | all | one
    counted: false
  };
  const audio = $("audio");
  audio.volume = store.get("vol", 1);
  $("vol").value = audio.volume;

  // ---------- utilitaires ----------
  const fmt = s => { if (!isFinite(s)) return "0:00"; s = Math.floor(s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const nf = new Intl.NumberFormat("fr-FR");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function hue(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function fallbackCover(t) {
    const h = hue(t.title + t.artist);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},70%,55%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360},65%,30%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><text x="50" y="62" font-family="sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="rgba(255,255,255,.85)">${esc((t.title || "?")[0].toUpperCase())}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  function coverOf(t) { return t.cover_url || fallbackCover(t); }
  function setImg(img, t) { img.src = coverOf(t); img.onerror = () => { img.onerror = null; img.src = fallbackCover(t); }; }
  let toastTimer;
  function toast(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 2800); }
  function shareUrl(t) { const u = new URL(location.href); u.search = "?t=" + t.id; u.hash = ""; return u.toString(); }
  async function share(t) {
    const url = shareUrl(t);
    if (navigator.share) { try { await navigator.share({ title: t.title + " · " + t.artist, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); toast("Lien copié"); } catch { prompt("Copie ce lien :", url); }
  }

  // ---------- Suno ----------
  const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  function parseSuno(input) {
    const s = String(input || "").trim();
    let m = s.match(new RegExp("suno\\.(?:com|ai)/song/(" + UUID + ")", "i"))
         || s.match(new RegExp("cdn\\d?\\.suno\\.ai/(?:image_)?(" + UUID + ")", "i"))
         || s.match(new RegExp("^(" + UUID + ")$", "i"));
    if (m) return { id: m[1].toLowerCase() };
    if (/suno\.(com|ai)\/s\//i.test(s)) return { short: true };
    return null;
  }
  const sunoAudio = id => `https://cdn1.suno.ai/${id}.mp3`;
  const sunoCover = id => `https://cdn2.suno.ai/image_${id}.jpeg`;

  // ---------- chargement ----------
  async function load(reset = true) {
    if (!sb) { renderList(); return; }
    if (reset) { S.page = 0; S.tracks = []; }
    S.loading = true; renderList();
    let q = sb.from("tracks").select("*", { count: "exact" });
    if (S.q) {
      const term = S.q.replace(/[%,()]/g, " ").trim();
      q = q.or(`title.ilike.%${term}%,artist.ilike.%${term}%,genre.ilike.%${term}%`);
    }
    q = S.sort === "top" ? q.order("plays", { ascending: false }).order("created_at", { ascending: false })
                         : q.order("created_at", { ascending: false });
    const from = S.page * PAGE;
    const { data, error, count } = await q.range(from, from + PAGE - 1);
    S.loading = false;
    if (error) { $("empty").hidden = false; $("empty").textContent = "Impossible de charger les chansons. Vérifie ta connexion puis réessaie."; return; }
    S.tracks = S.tracks.concat(data || []); S.total = count ?? S.tracks.length;
    renderList();
  }

  // ---------- liste ----------
  function renderList() {
    const list = $("list"), empty = $("empty");
    $("setup").hidden = ready;
    list.innerHTML = "";
    const cur = S.queue[S.order[S.pos]];
    S.tracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = "row-t" + (cur && cur.id === t.id ? " is-current" : "");
      li.tabIndex = 0;
      li.dataset.i = i;
      const playing = cur && cur.id === t.id;
      li.innerHTML = `
        <span class="t-num">${playing ? `<span class="eq${audio.paused ? " paused" : ""}"><i></i><i></i><i></i></span>` : i + 1}</span>
        <img class="t-cover" alt="" loading="lazy">
        <span class="t-text"><span class="t-title">${esc(t.title)}</span><span class="t-sub">${esc(t.artist)}${t.genre ? " · " + esc(t.genre) : ""}</span></span>
        <span class="t-plays">${nf.format(t.plays)} écoute${t.plays > 1 ? "s" : ""}</span>
        <button class="t-menu" type="button" aria-label="Options pour ${esc(t.title)}"><svg viewBox="0 0 24 24"><path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4m0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/></svg></button>`;
      setImg(li.querySelector("img"), t);
      list.appendChild(li);
    });
    $("count").textContent = !ready ? "" : S.loading && !S.tracks.length ? "Chargement…" :
      S.total ? `${nf.format(S.total)} chanson${S.total > 1 ? "s" : ""}${S.q ? " trouvée" + (S.total > 1 ? "s" : "") : ""}` : "";
    empty.hidden = S.tracks.length > 0 || S.loading;
    empty.innerHTML = !ready ? "Les chansons apparaîtront ici dès que l'appli sera reliée à sa base de données."
      : S.q ? `Aucune chanson ne correspond à « ${esc(S.q)} ».`
      : `Aucune chanson pour l'instant. <a href="#" id="go-add">Publie la première.</a>`;
    const go = $("go-add"); if (go) go.onclick = e => { e.preventDefault(); show("add"); };
    $("more").hidden = S.tracks.length >= S.total || S.loading;
  }

  $("list").addEventListener("click", e => {
    const li = e.target.closest(".row-t"); if (!li) return;
    const t = S.tracks[+li.dataset.i];
    if (e.target.closest(".t-menu")) { openMenu(e.target.closest(".t-menu"), t); return; }
    const cur = S.queue[S.order[S.pos]];
    if (cur && cur.id === t.id) { togglePlay(); return; }
    startQueue(S.tracks, +li.dataset.i);
  });
  $("list").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("row-t")) { e.preventDefault(); e.target.click(); }
  });

  // menu contextuel
  let menuEl;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function openMenu(btn, t) {
    closeMenu();
    menuEl = document.createElement("div");
    menuEl.className = "menu";
    menuEl.innerHTML = `<button type="button" data-a="share">Partager</button><button type="button" data-a="report">Signaler un abus</button>`;
    Object.assign(menuEl.style, { position: "absolute", zIndex: 25, background: "var(--raise)", border: "1px solid var(--line)", borderRadius: "10px", padding: "4px", display: "grid", minWidth: "170px", boxShadow: "0 8px 24px rgba(0,0,0,.35)" });
    menuEl.querySelectorAll("button").forEach(b => Object.assign(b.style, { border: 0, background: "none", textAlign: "left", padding: "9px 12px", borderRadius: "7px", cursor: "pointer" }));
    document.body.appendChild(menuEl);
    const r = btn.getBoundingClientRect();
    menuEl.style.top = (scrollY + r.bottom + 4) + "px";
    menuEl.style.left = Math.max(8, Math.min(scrollX + r.right - 170, innerWidth - 178)) + "px";
    menuEl.onclick = async ev => {
      const a = ev.target.dataset.a; if (!a) return;
      if (a === "share") share(t);
      if (a === "report") {
        if (menuEl.dataset.confirm !== "1") { menuEl.dataset.confirm = "1"; ev.target.textContent = "Confirmer le signalement"; ev.target.style.color = "var(--danger)"; return; }
        if (sb) await sb.rpc("report_track", { track: t.id });
        toast("Merci, la chanson a été signalée.");
      }
      closeMenu();
    };
  }
  document.addEventListener("click", e => { if (menuEl && !menuEl.contains(e.target) && !e.target.closest(".t-menu")) closeMenu(); });

  // ---------- file de lecture ----------
  function buildOrder(startIdx) {
    const n = S.queue.length;
    let order = [...Array(n).keys()];
    if (S.shuffle) {
      order.splice(order.indexOf(startIdx), 1);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      order.unshift(startIdx);
      S.pos = 0;
    } else S.pos = startIdx;
    S.order = order;
  }
  function startQueue(list, idx, autoplay = true) {
    if (!list.length) return;
    S.queue = list.slice();
    buildOrder(idx);
    playCurrent(autoplay);
  }
  function playCurrent(autoplay = true) {
    const t = S.queue[S.order[S.pos]]; if (!t) return;
    S.counted = false;
    audio.src = t.audio_url;
    if (autoplay) audio.play().catch(() => {});
    $("p-title").textContent = t.title;
    $("p-artist").textContent = t.artist;
    const img = $("p-cover"); setImg(img, t); img.hidden = false;
    $("b-share").disabled = false;
    document.title = t.title + " · " + t.artist + " | CLB Sound";
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: "CLB Sound", artwork: [{ src: coverOf(t), sizes: "512x512" }] });
    }
    renderList();
  }
  function next(auto = false) {
    if (!S.queue.length) return;
    if (S.pos < S.order.length - 1) S.pos++;
    else if (S.repeat === "all" || !auto) {
      if (S.shuffle) { const last = S.order[S.pos]; buildOrder(Math.floor(Math.random() * S.queue.length)); if (S.queue.length > 1 && S.order[0] === last) S.pos = 1; }
      else S.pos = 0;
    } else { audio.pause(); audio.currentTime = 0; return; }
    playCurrent();
  }
  function prev() {
    if (!S.queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    S.pos = S.pos > 0 ? S.pos - 1 : S.order.length - 1;
    playCurrent();
  }
  function togglePlay() {
    if (!audio.src) { if (S.tracks.length) startQueue(S.tracks, 0); return; }
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  }

  // ---------- contrôles ----------
  function syncModes() {
    $("b-shuffle").setAttribute("aria-pressed", S.shuffle);
    $("b-repeat").setAttribute("aria-pressed", S.repeat !== "off");
    $("repeat-one").hidden = S.repeat !== "one";
    $("b-repeat").title = { off: "Répéter : non", all: "Répéter : toute la liste", one: "Répéter : ce titre" }[S.repeat];
    audio.loop = S.repeat === "one";
  }
  $("b-play").onclick = togglePlay;
  $("b-next").onclick = () => next(false);
  $("b-prev").onclick = prev;
  $("b-shuffle").onclick = () => {
    S.shuffle = !S.shuffle; store.set("shuffle", S.shuffle);
    if (S.queue.length) { const cur = S.order[S.pos]; buildOrder(cur); }
    syncModes(); toast(S.shuffle ? "Lecture aléatoire activée" : "Lecture dans l'ordre");
  };
  $("b-repeat").onclick = () => {
    S.repeat = { off: "all", all: "one", one: "off" }[S.repeat]; store.set("repeat", S.repeat);
    syncModes(); toast({ off: "Répétition désactivée", all: "Toute la liste en boucle", one: "Ce titre en boucle" }[S.repeat]);
  };
  $("b-share").onclick = () => { const t = S.queue[S.order[S.pos]]; if (t) share(t); };
  $("play-all").onclick = () => { if (!S.tracks.length) return; S.shuffle = false; store.set("shuffle", false); syncModes(); startQueue(S.tracks, 0); };
  $("shuffle-all").onclick = () => { if (!S.tracks.length) return; S.shuffle = true; store.set("shuffle", true); syncModes(); startQueue(S.tracks, Math.floor(Math.random() * S.tracks.length)); };
  $("vol").oninput = e => { audio.volume = +e.target.value; store.set("vol", audio.volume); };

  let seeking = false;
  $("seek").addEventListener("input", () => { seeking = true; $("t-cur").textContent = fmt($("seek").value / 1000 * audio.duration); });
  $("seek").addEventListener("change", () => { if (isFinite(audio.duration)) audio.currentTime = $("seek").value / 1000 * audio.duration; seeking = false; });

  audio.addEventListener("timeupdate", () => {
    if (!seeking && isFinite(audio.duration)) { $("seek").value = Math.round(audio.currentTime / audio.duration * 1000); $("t-cur").textContent = fmt(audio.currentTime); }
    if (!S.counted && audio.currentTime > 30) {
      S.counted = true;
      const t = S.queue[S.order[S.pos]];
      if (t && sb) sb.rpc("count_play", { track: t.id }).then(() => { t.plays++; });
    }
  });
  audio.addEventListener("loadedmetadata", () => { $("t-dur").textContent = fmt(audio.duration); });
  audio.addEventListener("play", () => { $("i-play").hidden = true; $("i-pause").hidden = false; $("b-play").title = "Pause"; renderList(); });
  audio.addEventListener("pause", () => { $("i-play").hidden = false; $("i-pause").hidden = true; $("b-play").title = "Lecture"; renderList(); });
  audio.addEventListener("ended", () => next(true));
  audio.addEventListener("error", () => { if (audio.src) { toast("Cette chanson n'est plus disponible, passage à la suivante."); setTimeout(() => next(true), 800); } });

  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => audio.play());
    ms.setActionHandler("pause", () => audio.pause());
    ms.setActionHandler("nexttrack", () => next(false));
    ms.setActionHandler("previoustrack", prev);
    try { ms.setActionHandler("seekto", d => { audio.currentTime = d.seekTime; }); } catch {}
  }
  document.addEventListener("keydown", e => {
    if (e.target.matches("input, textarea") ) return;
    if (e.code === "Space" && !e.target.closest("button, .row-t")) { e.preventDefault(); togglePlay(); }
  });

  // ---------- recherche et tri ----------
  let qTimer;
  $("q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.q = e.target.value.trim(); load(); }, 300); });
  document.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => {
    S.sort = b.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach(x => x.classList.toggle("is-on", x === b));
    load();
  });
  $("more").onclick = () => { S.page++; load(false); };

  // ---------- onglets ----------
  function show(view) {
    document.querySelectorAll(".tab").forEach(t => { const on = t.dataset.view === view; t.classList.toggle("is-on", on); t.setAttribute("aria-selected", on); });
    $("view-listen").hidden = view !== "listen";
    $("view-add").hidden = view !== "add";
    scrollTo({ top: 0 });
  }
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => show(t.dataset.view));

  // ---------- publication ----------
  let mode = "link";
  document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => {
    mode = b.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach(x => x.classList.toggle("is-on", x === b));
    document.querySelectorAll("[data-for]").forEach(f => f.hidden = f.dataset.for !== mode);
    updatePreview();
  });
  function msg(text, kind = "") { const el = $("form-msg"); el.textContent = text; el.className = "form-msg " + kind; }

  let pvUrl;
  function updatePreview() {
    const pv = $("preview"), a = $("pv-audio"), img = $("pv-cover");
    if (pvUrl) { URL.revokeObjectURL(pvUrl); pvUrl = null; }
    if (mode === "link") {
      const p = parseSuno($("f-link").value);
      if (p && p.id) { a.src = sunoAudio(p.id); img.src = sunoCover(p.id); img.onerror = () => { img.removeAttribute("src"); }; pv.hidden = false; msg(""); return; }
      if (p && p.short) msg("Ce lien court ne contient pas l'identifiant de la chanson. Ouvre-le dans ton navigateur, puis copie l'adresse complète (suno.com/song/…).", "err");
      pv.hidden = true; return;
    }
    const f = $("f-audio").files[0];
    if (f) { pvUrl = URL.createObjectURL(f); a.src = pvUrl; const c = $("f-cover").files[0]; if (c) img.src = URL.createObjectURL(c); else img.removeAttribute("src"); pv.hidden = false; }
    else pv.hidden = true;
  }
  $("f-link").addEventListener("input", updatePreview);
  $("f-audio").addEventListener("change", () => {
    const f = $("f-audio").files[0];
    if (f && !$("f-title").value) $("f-title").value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120);
    updatePreview();
  });
  $("f-cover").addEventListener("change", updatePreview);
  try { $("f-artist").value = store.get("artist", ""); } catch {}

  $("add-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!sb) { msg("L'appli n'est pas encore reliée à sa base de données (voir config.js).", "err"); return; }
    const title = $("f-title").value.trim(), artist = $("f-artist").value.trim(), genre = $("f-genre").value.trim() || null;
    if (!title || !artist) { msg("Indique le titre et ton nom d'artiste.", "err"); return; }
    if (!$("f-rights").checked) { msg("Coche la case pour confirmer que la chanson est la tienne.", "err"); return; }
    const btn = $("submit"); btn.disabled = true;
    try {
      let row;
      if (mode === "link") {
        const p = parseSuno($("f-link").value);
        if (!p || !p.id) { msg(p && p.short ? "Utilise l'adresse complète suno.com/song/…" : "Colle le lien de ta chanson Suno (suno.com/song/…).", "err"); return; }
        row = { title, artist, genre, source: "suno", suno_id: p.id, audio_url: sunoAudio(p.id), cover_url: sunoCover(p.id) };
      } else {
        const f = $("f-audio").files[0];
        if (!f) { msg("Choisis le fichier audio de ta chanson.", "err"); return; }
        if (f.size > 15 * 1024 * 1024) { msg("Le fichier dépasse 15 Mo. Exporte-le en MP3 depuis Suno.", "err"); return; }
        msg("Envoi du fichier…");
        const id = crypto.randomUUID();
        const ext = (f.name.split(".").pop() || "mp3").toLowerCase().slice(0, 4);
        const up = await sb.storage.from("songs").upload(`audio/${id}.${ext}`, f, { contentType: f.type || "audio/mpeg" });
        if (up.error) throw up.error;
        const audioUrl = sb.storage.from("songs").getPublicUrl(`audio/${id}.${ext}`).data.publicUrl;
        let coverUrl = null;
        const c = $("f-cover").files[0];
        if (c) {
          const cext = (c.name.split(".").pop() || "jpg").toLowerCase().slice(0, 4);
          const cu = await sb.storage.from("songs").upload(`covers/${id}.${cext}`, c, { contentType: c.type });
          if (!cu.error) coverUrl = sb.storage.from("songs").getPublicUrl(`covers/${id}.${cext}`).data.publicUrl;
        }
        row = { title, artist, genre, source: "upload", audio_url: audioUrl, cover_url: coverUrl };
      }
      msg("Publication…");
      const { error } = await sb.from("tracks").insert(row);
      if (error) {
        if (error.code === "23505") { msg("Cette chanson Suno est déjà sur CLB Sound.", "err"); return; }
        throw error;
      }
      store.set("artist", artist);
      msg("Publiée. Ta chanson est maintenant écoutable par tout le monde.", "ok");
      $("add-form").reset(); $("f-artist").value = artist; updatePreview();
      S.sort = "new"; document.querySelectorAll("[data-sort]").forEach(x => x.classList.toggle("is-on", x.dataset.sort === "new"));
      await load();
      setTimeout(() => { show("listen"); msg(""); }, 1400);
    } catch (err) {
      console.error(err);
      msg("La publication a échoué (" + (err.message || "erreur réseau") + "). Réessaie dans un instant.", "err");
    } finally { btn.disabled = false; }
  });

  // ---------- démarrage ----------
  syncModes();
  (async () => {
    await load();
    const id = new URLSearchParams(location.search).get("t");
    if (id && sb) {
      let t = S.tracks.find(x => x.id === id);
      if (!t) { const r = await sb.from("tracks").select("*").eq("id", id).maybeSingle(); t = r.data; }
      if (t) { const list = S.tracks.some(x => x.id === t.id) ? S.tracks : [t, ...S.tracks]; startQueue(list, list.indexOf(list.find(x => x.id === t.id)), false); toast("Appuie sur lecture pour écouter « " + t.title + " »"); }
    }
  })();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
