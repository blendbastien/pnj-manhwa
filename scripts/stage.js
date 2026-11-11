/* Portrait - Manhwa 3.0 — la scène à l'écran (joueurs et MJ)
   #pm-stage = calque plein écran ; .pm-dock = pile de panneaux à la position choisie ; .pm-panel.float = panneau détaché (position en % de l'écran).
   Un panneau = un groupe PRINCIPAL et ses sous-groupes (pages) : on clique le panneau puis la molette (ou ↑ ↓, Page préc./suiv.) fait défiler les sous-groupes.
   Mode des sous-groupes : « libre » (chaque joueur choisit sa page) ou « imposé » (la page du MJ s'affiche chez tous).
   Panneaux réservés à un Groupe MJ : seuls ses joueurs (et le MJ) les voient.
   MJ : disposition PARTAGÉE (scene.panels). Joueur : PERSONNELLE (navigateur), bouton ↺ = revenir à celle du MJ. */
import { MOD, FONT_CSS, NAME_DEFAULT, getData, getScene, setScene, updateScene, npcView, esc, prune, rootOf, descendants, pathOf, visibleFor } from "./main.js";

let lastSpeakers = null;
const LOCAL_KEY = "pnj-manhwa.local";
const ALL = "__all";
const clampSize = v => Math.max(28, Math.min(400, Math.round(v)));

export function portraitHTML(v) {
  const c = v.crop; const src = esc(v.img).replace(/'/g, "%27");
  return `<img class="pm-pic" src="${src}" draggable="false" loading="lazy" style="object-position:${c.x}% ${c.y}%;${(c.z || 100) !== 100 ? `transform:scale(${c.z / 100});transform-origin:${c.x}% ${c.y}%` : ""}">`;
}

export class Stage {
  static local() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {}; } catch (e) { return {}; } }
  static setLocal(gid, patch) { const l = Stage.local(); l[gid] = { ...(l[gid] || {}), ...patch }; for (const k of Object.keys(l[gid])) if (l[gid][k] === undefined) delete l[gid][k]; if (!Object.keys(l[gid]).length) delete l[gid]; try { localStorage.setItem(LOCAL_KEY, JSON.stringify(l)); } catch (e) {} }
  static resetLocal(gid) { const l = Stage.local(); if (gid) delete l[gid]; else for (const k in l) delete l[k]; try { localStorage.setItem(LOCAL_KEY, JSON.stringify(l)); } catch (e) {} Stage.refresh(); }
  static canPersonal() { return !game.user.isGM && game.settings.get(MOD, "personalLayout"); }
  static canEdit() { return game.user.isGM || Stage.canPersonal(); }
  /* faire défiler les sous-groupes : MJ toujours ; joueur seulement en mode libre */
  static canRoll(scene = getScene()) { return game.user.isGM || (scene.style.subMode || "free") !== "forced"; }
  /* réglages personnels qui s'appliquent : rien pour le MJ ; la page seulement si la disposition personnelle est coupée ; pas de page en mode imposé */
  static myLocal(scene = getScene()) { if (game.user.isGM) return {}; const l = Stage.local(); const pers = Stage.canPersonal(), roll = Stage.canRoll(scene);
    for (const [k, v] of Object.entries(l)) { if (!pers) l[k] = v.sub ? { sub: v.sub } : {}; if (!roll) delete l[k].sub; } return l; }

  static el() {
    let el = document.getElementById("pm-stage");
    if (!el) { el = document.createElement("div"); el.id = "pm-stage"; document.body.appendChild(el);
      el.addEventListener("click", Stage.onClick); el.addEventListener("pointerdown", Stage.onDown);
      el.addEventListener("wheel", Stage.onWheel, { passive: false });
      el.addEventListener("dblclick", ev => { const h = ev.target.closest(".pm-ghead"); if (!h || !Stage.canEdit()) return; ev.preventDefault(); const gid = h.closest(".pm-panel").dataset.group;
        if (game.user.isGM) return Stage.setPanel(gid, { pos: null }); Stage.resetLocal(gid); });
      document.addEventListener("pointerdown", ev => { if (Stage._focus && !ev.target.closest?.(`#pm-stage .pm-panel[data-group="${Stage._focus}"]`)) Stage.setFocus(null); }, true);
      document.addEventListener("keydown", ev => { if (!Stage._focus || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable) return;
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { if (Stage.stepFocused(ev.key === "ArrowDown" ? 1 : -1)) { ev.preventDefault(); ev.stopPropagation(); } } else if (ev.key === "Escape") Stage.setFocus(null); }, true);
      window.addEventListener("resize", foundry.utils.debounce(() => Stage.fit(), 150)); }
    return el;
  }
  static panelOf(scene, id) { if (id === ALL) return scene.merged || {}; return scene.panels?.[id] || {}; }
  static effective(id, scene, local) { const p = Stage.panelOf(scene, id); const l = local[id] || {};
    return { pos: l.pos ?? p.pos ?? null, size: l.size ?? p.size ?? null, compact: l.compact ?? p.compact ?? (scene.style?.compact !== false), collapsed: l.collapsed ?? p.collapsed ?? false, sub: l.sub ?? p.sub ?? null,
      personal: !!(l.pos || l.size || l.compact !== undefined || l.collapsed !== undefined || l.sub) }; }
  static isMerged(scene, panels) { const m = scene.style.merge || "auto"; if (m === "always") return panels.length > 0; if (m === "never") return false; const n = panels.reduce((t, g) => t + g.views.length, 0); return panels.length > 1 && n > (Number(scene.style.mergeAt) || 16); }

  /** panneaux visibles : un par groupe principal, ses pages = lui puis ses sous-groupes (profondeur d'abord), seulement ceux qui ont des portraits à l'écran */
  static build(scene, data, local) {
    if (!scene.active) return [];
    const shown = new Map(scene.groups.map(sg => [sg.id, sg.shown || []]));
    const roots = new Map();
    for (const sg of scene.groups) { if (!sg.shown?.length) continue; const g = data.groups.find(x => x.id === sg.id); if (!g) continue; const r = rootOf(data, g.id) || g; if (!visibleFor(data, r)) continue; roots.set(r.id, r); }
    const out = [];
    for (const r of roots.values()) {
      const pages = [{ g: r, depth: 0 }, ...descendants(data, r.id)].map(({ g, depth }) => ({ id: g.id, name: g.name, color: g.color || r.color || "", depth, path: pathOf(data, g.id), views: (shown.get(g.id) || []).map(id => npcView(id, data, scene)).filter(v => v.exists) })).filter(p => p.views.length);
      if (!pages.length) continue;
      const eff = Stage.effective(r.id, scene, local); let cur = pages.findIndex(p => p.id === eff.sub); if (cur < 0) cur = 0;
      out.push({ id: r.id, name: r.name, color: r.color || "", zone: r.zone || "", font: r.font || "", pages, cur, page: pages[cur], views: pages[cur].views, allViews: pages.flatMap(p => p.views), ...eff });
    }
    return out;
  }

  static refresh() {
    if (Stage._dragging) return;
    const el = Stage.el(); const scene = getScene(); const data = getData(); const isGM = game.user.isGM; const st = scene.style;
    const local = Stage.myLocal(scene);
    let groups = Stage.build(scene, data, local);
    if (!groups.length) { el.classList.remove("on"); el.innerHTML = ""; lastSpeakers = null; Stage.paintPreview(scene.active ? "Aucun portrait à l'écran." : "Scène masquée — rien n'est affiché aux joueurs."); return; }
    const zoned = groups.filter(g => g.zone && g.zone !== scene.position), free = groups.filter(g => !g.zone || g.zone === scene.position);
    const merged = Stage.isMerged(scene, free);
    if (merged) { groups = [{ id: ALL, name: scene.title || "Scène", sections: free, views: free.flatMap(g => g.views), pages: null, ...Stage.effective(ALL, scene, local) }, ...zoned]; }
    const scale = game.settings.get(MOD, "playerScale") || 1; const roll = Stage.canRoll(scene);
    const nm = { ...NAME_DEFAULT, ...(st.nm || {}) };
    el.className = `on pos-${scene.position} frame-${st.frame} ratio-${st.ratio} name-${st.names} font-${st.font} nmbg-${nm.bg} nmw-${nm.w} nms-${nm.size}${nm.bg !== "auto" || nm.tc !== NAME_DEFAULT.tc ? " nmtc" : ""}${st.theme ? ` theme-${st.theme}` : ""}${st.bg ? " with-bg" : ""}${st.dim && groups.some(g => (g.sections ? g.sections.flatMap(x => x.views) : g.views).some(v => v.speaker)) ? " has-speaker" : ""}${isGM ? " gm" : " player"}${st.groups ? " with-groups" : ""}${merged ? " merged" : ""}${Stage.canEdit() ? " editable" : ""}${roll ? " can-roll" : ""}`;
    el.style.cssText = `--pm-nbg:${nm.bgc};--pm-ntc:${nm.tc};${st.theme ? "" : `--pm-acc:${st.accent};`}--pm-bw:${st.border}px;--pm-radius:${st.radius}px;--pm-gap:${st.gap}px;--pm-base:${Math.round(scene.size * scale)}px`;
    const card = v => `<div class="pm-card${v.speaker ? " speaker" : ""}${v.hidePortrait ? " masked" : ""}${v.revealed ? "" : " unknown"}" data-id="${v.id}" title="${isGM ? esc(v.realName) : ""}"${v.cat ? ` style="--pm-cc:${esc(v.cat.color)};${v.cat.font && FONT_CSS[v.cat.font] ? `--pm-nfont:${FONT_CSS[v.cat.font]};` : ""}"` : ""}><div class="pm-frame"><div class="pm-img">${portraitHTML(v)}</div><div class="pm-mask"><i class="fa-solid fa-question"></i></div><div class="pm-name"><span>${esc(v.name)}</span></div></div></div>`;
    /* bandeau des sous-groupes : la page affichée est allumée ; ↑ ↓ pour défiler */
    /* bas du panneau, sobre : le nom des sous-groupes en petit, celui affiché allumé (molette au survol pour changer) */
    const subs = g => { if (!(g.pages?.length > 1)) return ""; const N = g.pages.length, W = 2;   /* au plus 5 noms autour de celui affiché, et le compteur */
      const idx = N <= 2 * W + 1 ? g.pages.map((_, i) => i) : Array.from({ length: 2 * W + 1 }, (_, k) => (g.cur - W + k + N) % N);
      return `<nav class="pm-subs" title="${roll ? "Molette sur le panneau pour changer de sous-groupe" : "Le MJ choisit le sous-groupe affiché"}">${idx.map(i => { const p = g.pages[i]; return `<a data-pm="page" data-page="${p.id}" class="pg${i === g.cur ? " on" : ""}${roll ? "" : " ro"}" style="--pm-pc:${esc(p.color || g.color || "var(--pm-acc)")}">${esc(p.depth ? p.name : g.name)}</a>`; }).join("<i class=\"sep\">·</i>")}${N > 2 * W + 1 ? `<em class="pm-pgn">${g.cur + 1}/${N}</em>` : ""}</nav>`; };
    const panel = g => {
      const size = clampSize((g.size ?? scene.size) * scale);
      const ctl = "";   /* 3.2.2 : plus de barre d'outils sur le titre — on le saisit pour déplacer ; double-clic = remettre en place ; réglages dans la fenêtre de gestion */
      const pageTitle = false && g.page && g.page.depth ? `<div class="pm-pageh"><i class="fa-solid fa-layer-group"></i>${g.page.path.slice(1).map(esc).join(" <i class='fa-solid fa-angle-right'></i> ")}</div>` : "";
      const body = g.sections && st.separators && !g.collapsed
        ? g.sections.map(sec => `<div class="pm-sec" data-group="${sec.id}"${sec.color ? ` style="--pm-gc:${esc(sec.color)}"` : ""}><div class="pm-sech">${esc(sec.page?.depth ? sec.page.path.join(" › ") : sec.name)}<span>${sec.views.length}</span></div><div class="pm-row">${sec.views.map(card).join("")}</div>${subs(sec)}</div>`).join("")
        : `${pageTitle}<div class="pm-row" data-k="${esc(g.page?.id || "")}">${g.views.map(card).join("")}</div>${subs(g)}`;
      const n = g.allViews ? g.allViews.length : g.views.length;
      return `<section class="pm-panel${g.collapsed ? " collapsed" : ""}${g.compact ? " compact" : ""}${g.pos ? " float" : ""}${g.personal ? " personal" : ""}${g.sections ? " all" : ""}${g.color ? " tinted" : ""}${g.pages?.length > 1 ? " has-subs" : ""}${Stage._focus === g.id ? " focus" : ""}" data-group="${g.id}" style="--pm-sz:${size}px;${g.color ? `--pm-gc:${esc(g.color)};` : ""}${g.font && FONT_CSS[g.font] ? `--pm-gfont:${FONT_CSS[g.font]};` : ""}${g.pos ? `left:${g.pos.x}%;top:${g.pos.y}%;` : ""}${g.pages?.length > 1 ? `--pm-maxn:${Math.max(...g.pages.map(p => p.views.length))};` : ""}">
        <header class="pm-ghead" title="${Stage.canEdit() ? "Glisser pour déplacer · double-clic : remettre en place" : ""}"><i class="fa-solid fa-grip-lines grip"></i><span class="gn">${esc(g.name)}</span><span class="gc">${n}</span>${ctl}</header>
        <div class="pm-body">${body}</div></section>`;
    };
    const docked = groups.filter(g => !g.pos), floating = groups.filter(g => g.pos);
    const zoneOf = g => (g.id !== ALL && g.zone) || scene.position; const zones = [...new Set(docked.map(zoneOf))];
    el.innerHTML = zones.map(z => `<div class="pm-dock at-${z}">${z === scene.position && scene.title && !merged ? `<div class="pm-title">${esc(scene.title)}</div>` : ""}${docked.filter(g => zoneOf(g) === z).map(panel).join("")}</div>`).join("") + floating.map(panel).join("");
    /* roulement : dès que la page d'un panneau change (molette, MJ, autre poste), les portraits arrivent en tambour — vers le bas = suivant, vers le haut = précédent */
    const LP = Stage._lastPage ||= new Map();
    for (const g of groups.flatMap(x => x.sections || [x])) { if (!g.pages) continue; const prev = LP.get(g.id); LP.set(g.id, { id: g.page.id, i: g.cur });
      if (!prev || prev.id === g.page.id) continue; let d = Stage._rolled?.id === g.id ? Stage._rolled.d : (g.cur > prev.i ? 1 : -1);
      const row = el.querySelector(`.pm-panel[data-group="${g.id}"] .pm-row, .pm-sec[data-group="${g.id}"] .pm-row`); if (!row) continue;
      row.classList.add(d > 0 ? "roll-down" : "roll-up"); row.querySelectorAll(".pm-card").forEach((c, i) => c.style.setProperty("--ri", i)); }
    Stage._rolled = null;
    Stage._fitOn = st.fit !== false; Stage.fit(); Stage.paintPreview();
    const sig = scene.speakers.join(",");
    if (lastSpeakers !== null && sig !== lastSpeakers && scene.speakers.length) Stage.ding();
    lastSpeakers = sig;
  }
  /* aperçu dans la fenêtre de gestion (plein écran) : copie conforme de la scène, à plat et réduite */
  static paintPreview(empty = "") { const pv = document.getElementById("pm-preview"); if (!pv) return; const el = document.getElementById("pm-stage");
    if (empty || !el?.innerHTML) { pv.className = "empty"; pv.innerHTML = `<p class="pm-pv-empty">${empty || "Aucun portrait à l'écran."}</p>`; return; }
    pv.className = el.className + " pv"; pv.style.cssText = el.style.cssText; pv.innerHTML = el.innerHTML; pv.querySelectorAll(".pm-ctl").forEach(x => x.remove());
    /* tout doit tenir dans l'aperçu, même avec beaucoup de PNJ : on réduit l'échelle */
    requestAnimationFrame(() => Stage.fitPreview(pv));
    /* 3.4.2 : fenêtre réduite puis rouverte (ou redimensionnée) → on recalcule l'échelle quand l'aperçu retrouve sa taille */
    const wrap = pv.parentElement; if (wrap && Stage._pvWrap !== wrap) { Stage._pvRO?.disconnect(); Stage._pvWrap = wrap; Stage._pvRO = new ResizeObserver(() => { clearTimeout(Stage._pvT); Stage._pvT = setTimeout(() => { const p = document.getElementById("pm-preview"); if (p && p.parentElement === wrap) Stage.fitPreview(p); }, 60); }); Stage._pvRO.observe(wrap); } }
  static fitPreview(pv) { const wrap = pv?.parentElement; if (!wrap || pv.classList.contains("empty")) return; if (wrap.clientWidth < 80 || wrap.clientHeight < 60) return; /* fenêtre réduite ou cachée : rien à mesurer */
    pv.style.zoom = "1"; const kids = [...pv.children]; if (!kids.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const k of kids) { const r = k.getBoundingClientRect(); if (!r.width && !r.height) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    if (!Number.isFinite(x0)) return; const W = wrap.clientWidth - 30, H = wrap.clientHeight - 34; const z = Math.min(1, W / Math.max(1, x1 - x0), H / Math.max(1, y1 - y0)); pv.style.zoom = String(Math.max(0.12, z).toFixed(3)); }
  /* ajustement automatique : réduit la pile (facteur commun) jusqu'à ce qu'elle tienne dans la zone libre ; compacte en dessous de 70 % */
  static fit() { const el = document.getElementById("pm-stage"); if (!el) return; el.querySelectorAll(".pm-panel.float").forEach(p => Stage.fitFloat(p)); el.querySelectorAll(".pm-dock").forEach(d => Stage.fitDock(d)); Stage.clampFloats(el); }
  /* panneau détaché : il se réduit aussi pour tenir dans l'écran */
  static fitFloat(p) { const sb = document.getElementById("sidebar"); const sbw = sb && sb.offsetWidth > 60 ? sb.offsetWidth : 48;
    const availW = Math.max(240, window.innerWidth - sbw - 80), availH = Math.max(160, window.innerHeight - 110);
    p.style.setProperty("--pm-availw", `${availW}px`); p.style.setProperty("--pm-fit", "1"); Stage.reserve(p); if (!Stage._fitOn) return; let fit = 1;
    for (let i = 0; i < 10; i++) { Stage.reserve(p); const r = p.getBoundingClientRect(); const k = Math.min(availW / r.width, availH / r.height); if (k >= 0.995) break;
      fit = Math.max(0.25, fit * Math.max(0.55, k * 0.98)); p.style.setProperty("--pm-fit", fit.toFixed(3)); if (fit <= 0.25) break; } }
  /* un panneau à sous-groupes garde la taille de son plus grand sous-groupe (largeur ET hauteur) : les cadres ne bougent pas d'une page à l'autre */
  static reserve(root) { root.querySelectorAll(".pm-panel.has-subs").forEach(p => { const row = p.querySelector(".pm-row"); const c = row?.querySelector(".pm-card"); if (!row || !c) return; row.style.minHeight = "";
    const maxn = Number(getComputedStyle(p).getPropertyValue("--pm-maxn")) || 1; const gap = parseFloat(getComputedStyle(row).columnGap) || 0; const cw = c.offsetWidth + gap, ch = c.offsetHeight;
    const per = Math.max(1, Math.floor((row.clientWidth + gap) / cw)); const rows = Math.ceil(maxn / per); row.style.minHeight = `${rows * ch + (rows - 1) * (parseFloat(getComputedStyle(row).rowGap) || 0)}px`; }); }
  /* un panneau détaché ne sort jamais de l'écran (sinon impossible de le rattraper) */
  static clampFloats(el) { const sb = document.getElementById("sidebar"); const maxR = window.innerWidth - (sb && sb.offsetWidth > 60 ? sb.offsetWidth : 10) - 6;
    el.querySelectorAll(".pm-panel.float").forEach(p => { const r = p.getBoundingClientRect(); if (r.right > maxR) p.style.left = `${Math.max(4, maxR - r.width)}px`; if (r.left < 0) p.style.left = "4px"; if (r.bottom > window.innerHeight - 4) p.style.top = `${Math.max(4, window.innerHeight - r.height - 4)}px`; if (r.top < 0) p.style.top = "4px"; }); }
  static fitDock(dock) {
    const sb = document.getElementById("sidebar"); const sbw = sb && sb.offsetWidth > 60 ? sb.offsetWidth : 48;
    const pos = [...dock.classList].find(c => c.startsWith("at-"))?.slice(3) || "bottom";
    const side = pos === "left" || pos === "right";
    const availW = side ? Math.max(200, (window.innerWidth - sbw) * 0.32) : Math.max(240, window.innerWidth - 90 - sbw - 30), availH = Math.max(160, window.innerHeight - (pos === "bottom" ? 96 : 20) - (side ? 40 : 70));
    dock.style.setProperty("--pm-availw", `${availW}px`); dock.style.setProperty("--pm-fit", "1"); dock.classList.remove("auto-compact"); Stage.reserve(dock);
    if (!Stage._fitOn) return;
    let fit = 1;
    Stage.reserve(dock);
    for (let i = 0; i < 10; i++) {
      Stage.reserve(dock); const r = dock.getBoundingClientRect(); const k = Math.min(availW / r.width, availH / r.height);
      if (k >= 0.995) break;
      fit = Math.max(0.25, fit * Math.max(0.55, k * 0.98)); dock.style.setProperty("--pm-fit", fit.toFixed(3));
      dock.classList.toggle("auto-compact", fit < 0.7);
      if (fit <= 0.25) break;
    }
  }
  static ding() {
    const src = game.settings.get(MOD, "sound"); if (!src) return;
    const volume = game.settings.get(MOD, "soundVolume") ?? 0.25;
    try { (foundry.audio?.AudioHelper ?? AudioHelper).play({ src, volume, autoplay: true, loop: false }, false); } catch (e) { console.warn(MOD, e); }
  }
  /* propriété d'un panneau : MJ → scène partagée, joueur → disposition personnelle (la page des sous-groupes aussi, en mode libre) */
  static async setPanel(gid, patch) {
    if (game.user.isGM) await updateScene(s => { if (gid === ALL) { s.merged = { ...(s.merged || {}), ...patch }; return; } s.panels ||= {}; s.panels[gid] = { ...(s.panels[gid] || {}), ...patch }; });
    else if (Stage.canPersonal() || (Object.keys(patch).length === 1 && "sub" in patch && Stage.canRoll())) { Stage.setLocal(gid, patch); Stage.refresh(); }
  }
  static panelState(gid) { const s = getScene(); return { scene: s, ...Stage.effective(gid, s, Stage.myLocal(s)) }; }
  /* sous-groupes */
  static setFocus(id) { if (Stage._focus === id) return; Stage._focus = id; document.querySelectorAll("#pm-stage .pm-panel").forEach(p => p.classList.toggle("focus", p.dataset.group === id)); }
  static pagesOf(gid) { const s = getScene(); const g = Stage.build(s, getData(), Stage.myLocal(s)).find(x => x.id === gid); return g || null; }
  static step(gid, d) { if (!Stage.canRoll()) return false; const g = Stage.pagesOf(gid); if (!g || g.pages.length < 2) return false; const i = (g.cur + d + g.pages.length) % g.pages.length; Stage._rolled = { id: gid, d }; Stage.setPanel(gid, { sub: g.pages[i].id }); return true; }
  static stepFocused(d) { return Stage._focus ? Stage.step(Stage._focus, d) : false; }
  /* molette : il suffit de survoler le panneau ; on cumule le défilement (pavés tactiles) et on attend la fin du roulement avant le suivant */
  static onWheel(ev) {
    const p = ev.target.closest(".pm-sec, .pm-panel.has-subs"); if (!p || !Stage.canRoll()) return; const gid = p.dataset.group;
    ev.preventDefault(); ev.stopPropagation(); const now = Date.now();
    if (now - (Stage._wheelLast || 0) > 400) Stage._wheelAcc = 0; Stage._wheelLast = now;
    if (now < (Stage._wheelLock || 0)) return;
    Stage._wheelAcc = (Stage._wheelAcc || 0) + (ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY);
    if (Math.abs(Stage._wheelAcc) < 60) return;
    const d = Stage._wheelAcc > 0 ? 1 : -1; Stage._wheelAcc = 0; Stage._wheelLock = now + 550; Stage.step(gid, d);
  }
  static async onClick(ev) {
    if ((Date.now() - (Stage._dragEnd || 0)) < 350) return;
    const panelEl = ev.target.closest(".pm-panel"); if (panelEl?.classList.contains("has-subs") || panelEl?.querySelector(".pm-subs")) { const first = Stage._focus !== panelEl.dataset.group; Stage.setFocus(panelEl.dataset.group); if (first && !ev.target.closest("[data-pm]")) return; }   /* 1er clic = choisir le panneau (pas d'orateur) */
    const btn = ev.target.closest("[data-pm]");
    if (btn) { ev.preventDefault(); ev.stopPropagation(); const box = btn.closest(".pm-sec") || btn.closest(".pm-panel"); const gid = btn.dataset.pm === "page" || btn.dataset.pm === "prev" || btn.dataset.pm === "next" ? box.dataset.group : btn.closest(".pm-panel").dataset.group; const eff = Stage.panelState(gid);
      switch (btn.dataset.pm) {
        case "page": if (!Stage.canRoll()) return; return Stage.setPanel(gid, { sub: btn.dataset.page });
        case "prev": return Stage.step(gid, -1);
        case "next": return Stage.step(gid, 1);
        case "minus": case "plus": { const cur = eff.size ?? eff.scene.size; return Stage.setPanel(gid, { size: clampSize(cur + (btn.dataset.pm === "plus" ? 8 : -8)) }); }
        case "compact": return Stage.setPanel(gid, { compact: !eff.compact });
        case "collapse": return Stage.setPanel(gid, { collapsed: !eff.collapsed });
        case "dock": if (game.user.isGM) return Stage.setPanel(gid, { pos: null }); Stage.setLocal(gid, { pos: undefined }); return Stage.refresh();
        case "reset": return Stage.resetLocal(gid);
        case "close": { if (!game.user.isGM) return; if (gid === ALL) return setScene({ groups: [], speakers: [] }); const d = getData(); const ids = new Set([gid, ...descendants(d, gid).map(x => x.g.id)]); await updateScene(s => { s.groups = s.groups.filter(x => !ids.has(x.id)); prune(s); }); return; }
      } return; }
    if (ev.target.closest(".pm-ghead")) return;
    if (!game.user.isGM || !game.settings.get(MOD, "gmClickSpeaker")) return;
    const card = ev.target.closest(".pm-card"); if (!card) return;
    const id = card.dataset.id; const s = getScene();
    await setScene({ speakers: s.speakers.includes(id) ? s.speakers.filter(x => x !== id) : [...s.speakers, id] });
  }
  /* glisser l'en-tête = déplacer (le panneau devient détaché) */
  static onDown(ev) {
    if (ev.button !== 0 || !Stage.canEdit()) return;
    if (ev.target.closest(".pm-ctl")) return;
    const head = ev.target.closest(".pm-ghead"); if (!head) return;
    const panel = head.closest(".pm-panel"); const stage = Stage.el(); const r0 = panel.getBoundingClientRect(); const gid = panel.dataset.group;
    const start = { x: ev.clientX, y: ev.clientY, left: r0.left, top: r0.top }; let moved = false;
    ev.preventDefault();
    const move = e => {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) { moved = true; Stage._dragging = true; panel.classList.add("dragging", "float"); const fit = panel.closest(".pm-dock")?.style.getPropertyValue("--pm-fit"); if (fit) panel.style.setProperty("--pm-fit", fit); panel.style.width = r0.width + "px"; stage.appendChild(panel); }
      const x = Math.max(0, Math.min(window.innerWidth - r0.width, start.left + dx)), y = Math.max(0, Math.min(window.innerHeight - 40, start.top + dy)); panel.style.left = x + "px"; panel.style.top = y + "px";
    };
    const up = async () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (!moved) return;
      Stage._dragEnd = Date.now(); Stage._dragging = false;
      const r = panel.getBoundingClientRect(); await Stage.setPanel(gid, { pos: { x: +(r.left / window.innerWidth * 100).toFixed(2), y: +(r.top / window.innerHeight * 100).toFixed(2) } });
      Stage.refresh();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
}
