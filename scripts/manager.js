/* Portrait - Manhwa 3.0 — fenêtre de gestion (MJ), plein écran avec les commandes 3D de la suite
   Haut : scène visible / masquée, Groupe MJ (filtre), mises en scène, Paramètres.
   Catégories (icônes) : trient les portraits du groupe choisi.
   Bandeaux « Affichés » (un réglage par panneau) et « Orateurs » (qui parle, « Aucun orateur »).
   Gauche : arbre des groupes — principal puis sous-groupes (sans limite), bouton + pour rattacher un sous-groupe.
   Centre : le groupe choisi — nom, couleur, police, Groupe MJ, rattachement, zone ; actions ; portraits avec Écran / Parle bien visibles. */
import { MOD, POSITIONS, FRAMES, RATIOS, NAME_STYLES, NAME_FONTS, NAME_BGS, NAME_WEIGHTS, NAME_SIZES, NAME_DEFAULT, FONT_CSS, MERGE_MODES, SUB_MODES, ZONES, THEMES, DEFAULT_CROP, DEFAULT_CATS, getData, updateData, getScene, setScene, updateScene, sceneGroup, prune, npcView, ensureNpc, uid, esc, childrenOf, descendants, rootOf, pathOf, gmGroupList } from "./main.js";
import { portraitHTML, Stage } from "./stage.js";

const AppV2 = foundry.applications.api.ApplicationV2;
const DialogV2 = foundry.applications.api.DialogV2;
const elOf = d => d?.element instanceof HTMLElement ? d.element : (d instanceof HTMLElement ? d : (d?.[0] ?? document));
const FP = () => foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
const sel = (name, opts, cur) => `<select name="${name}">${Object.entries(opts).map(([k, v]) => `<option value="${esc(k)}"${k === cur ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
const SWATCHES = ["#ff3b4e", "#ff6b3d", "#ff9b3d", "#ffc63d", "#ffe45e", "#c6f04a", "#5aff9a", "#2fe0a8", "#2fd8d8", "#38e0ff", "#4aa8ff", "#5e7bff", "#8a6bff", "#b980ff", "#e06bff", "#ff6be0", "#ff8af0", "#ff7a9c", "#e2c273", "#c9a27a", "#9fb0d4", "#ffffff"];
/* nuances d'une couleur : du plus clair au plus foncé (clic droit sur une pastille) */
const hexMix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const shades = c => [...[.75, .55, .35, .15].map(t => hexMix(c, "#ffffff", t)), c, ...[.2, .4, .55, .7].map(t => hexMix(c, "#000000", t))];
const fa = i => `<i class="fa-solid ${i}"></i>`;
const sw = (name, on, label, hint = "") => `<label class="pm-sw"><input type="checkbox" name="${name}"${on ? " checked" : ""}><i></i><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ""}</span></label>`;
const field = (label, inner, hint = "") => `<label class="pm-fld"><b>${label}</b>${inner}${hint ? `<small>${hint}</small>` : ""}</label>`;
const range = (name, min, max, step, v, unit = "px") => `<span class="pm-rg"><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${v}${unit}</output></span>`;

export class Manager extends AppV2 {
  static instance = null;
  static DEFAULT_OPTIONS = { id: "pm-manager", classes: ["pm-manager", "ms-fsable"], window: { title: "Portrait - Manhwa", icon: "fa-solid fa-id-badge", resizable: true }, position: { width: 1180, height: 780 } };
  static open() { if (!game.user.isGM) return ui.notifications.warn("Réservé au MJ."); Manager.instance ??= new Manager(); Manager.instance.render(true); }
  constructor(...a) { super(...a); this.groupId = null; this.search = ""; this.showSet = false; this.gmg = "*"; this.cat = "*"; }
  _onClose() { Manager.instance = null; }
  _onRender(ctx, opts) { super._onRender?.(ctx, opts); try { globalThis.MANHWA?.fullscreen?.mount?.(this); } catch (e) {} }

  /* groupes principaux visibles avec le filtre Groupe MJ */
  roots(d) { return d.groups.filter(g => !g.parent && (this.gmg === "*" || (this.gmg === "" ? !g.gmg : g.gmg === this.gmg))); }

  async _renderHTML() {
    const data = getData(), scene = getScene(), st = scene.style; const GG = gmGroupList();
    const roots = this.roots(data); const inTree = new Set(roots.flatMap(r => [r.id, ...descendants(data, r.id).map(x => x.g.id)]));
    if (!inTree.has(this.groupId)) this.groupId = roots[0]?.id || null;
    const g = data.groups.find(x => x.id === this.groupId); const sg = g ? sceneGroup(scene, g.id) : null;
    const total = scene.groups.reduce((n, s) => n + s.shown.length, 0);
    const ggName = id => GG.find(x => x.id === id)?.name || "";

    /* ── barre du haut ── */
    const presets = data.presets.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    const ggChips = GG.length ? `<div class="pm-ggs"><span class="lbl">${fa("fa-crown")} Groupe MJ</span>${[["*", "Tous", "#9fb0d4"], ["", "Sans groupe MJ", "#7d8bb0"], ...GG.map(x => [x.id, x.name, x.color])].map(([id, n, c]) => `<a data-act="gmg" data-v="${esc(id)}" class="pm-ggc${this.gmg === id ? " on" : ""}" style="--c:${esc(c)}"><i></i>${esc(n)}</a>`).join("")}</div>` : "";
    const top = `<header class="pm-top">
      <button data-act="s-toggle" class="pm-3d b-live${scene.active ? " on" : ""}">${fa(scene.active ? "fa-eye" : "fa-eye-slash")}${scene.active ? "Scène visible" : "Scène masquée"}</button>
      <span class="cnt"><b>${total}</b> portrait${total > 1 ? "s" : ""} à l'écran</span>
      <span class="grow"></span>
      <span class="pm-preset"><b>${fa("fa-clapperboard")} Mise en scène</b><select name="preset"><option value="">—</option>${presets}</select>
        <button data-act="pr-load" class="pm-3d b-blue" data-tooltip="Afficher la mise en scène choisie">${fa("fa-play")}</button>
        <button data-act="pr-save" class="pm-3d b-green" data-tooltip="Enregistrer ce qui est à l'écran sous un nom">${fa("fa-floppy-disk")}</button>
        <button data-act="pr-del" class="pm-3d b-red" data-tooltip="Supprimer la mise en scène choisie">${fa("fa-trash")}</button></span>
      <button data-act="pv-toggle" class="pm-3d ${this.showPv === false ? "b-green" : "b-red"}">${fa(this.showPv === false ? "fa-eye" : "fa-eye-slash")}${this.showPv === false ? "Afficher l'aperçu" : "Retirer l'aperçu"}</button>
      <button data-act="set-toggle" class="pm-3d b-violet${this.showSet ? " on" : ""}">${fa("fa-sliders")}Paramètres</button>
    </header>${ggChips}`;
    /* ── catégories ── */
    const cats = `<div class="pm-cats">${data.cats.length ? [{ id: "*", name: "Tous", icon: "fa-border-all", color: "#9fb0d4" }, ...data.cats, { id: "", name: "Sans catégorie", icon: "fa-circle-question", color: "#7d8bb0" }].map(c => `<a data-act="cat" data-v="${esc(c.id)}" class="pm-cat${this.cat === c.id ? " on" : ""}" style="--c:${esc(c.color)}">${fa(c.icon)}<span style="font-family:${FONT_CSS[c.font] || "inherit"}">${esc(c.name)}</span></a>`).join("") : ""}<a data-act="cat-new" class="pm-cat add" style="--c:#3ddc84">${fa("fa-plus")}<span>Créer une catégorie</span></a></div>`;
    /* ── panneaux affichés (par groupe principal) ── */
    const shownRoots = [...new Set(scene.groups.filter(s => s.shown.length).map(s => rootOf(data, s.id)?.id).filter(Boolean))];
    const panels = shownRoots.map(rid => { const r = data.groups.find(x => x.id === rid); const P = scene.panels?.[rid] || {}; const n = [rid, ...descendants(data, rid).map(x => x.g.id)].reduce((t, id) => t + (sceneGroup(scene, id)?.shown.length || 0), 0); const size = Math.round(P.size ?? scene.size);
      const pages = [r, ...descendants(data, rid).map(x => x.g)].filter(x => sceneGroup(scene, x.id)?.shown.length);
      return `<div class="pm-chip" data-group="${rid}" style="--gc:${esc(r.color || "#8ea0c8")}"><i class="dot"></i><b>${esc(r.name)}</b><span class="c">${n}</span>
        ${pages.length > 1 ? `<select name="psub" data-tooltip="Sous-groupe affiché">${pages.map(x => `<option value="${x.id}"${(P.sub || pages[0].id) === x.id ? " selected" : ""}>${esc(x.id === rid ? x.name : pathOf(data, x.id).slice(1).join(" › "))}</option>`).join("")}</select>` : ""}
        <label data-tooltip="Taille des portraits"><input type="range" name="psize" min="32" max="320" step="4" value="${size}"><output>${size}</output></label>
        <span class="pm-pbtns"><a data-act="p-compact" class="pb${(P.compact ?? (st.compact !== false)) ? " on" : ""}" data-tooltip="Portraits serrés, noms fins">${fa("fa-table-cells")}<span>Compact</span></a><a data-act="p-collapse" class="pb${P.collapsed ? " on" : ""}" data-tooltip="Réduit le panneau à une rangée de pastilles rondes">${fa("fa-down-left-and-up-right-to-center")}<span>Replier</span></a>
        ${P.pos ? `<a data-act="p-dock" class="pb dock" data-tooltip="Le panneau a été déplacé à la main : le remettre dans la pile, à sa zone">${fa("fa-anchor")}<span>Remettre en place</span></a>` : ""}<a data-act="p-remove" class="pb danger" data-tooltip="Retirer ce groupe (et ses sous-groupes) de l'écran">${fa("fa-xmark")}<span>Retirer</span></a></span></div>`; }).join("");
    const live = `<div class="pm-strips">${panels ? `<div class="pm-live"><b class="lbl">${fa("fa-tv")} Affichés</b>${panels}<button data-act="m-all-off" class="pm-3d b-red sm">${fa("fa-broom")}Tout retirer</button></div>` : ""}
      ${scene.speakers.length ? `<div class="pm-live spk"><b class="lbl">${fa("fa-microphone")} Orateurs</b>${scene.speakers.map(id => { const v = npcView(id, data, scene); return `<a class="pm-spk" data-act="spk-off" data-id="${id}" data-tooltip="Ne parle plus"><img src="${esc(v.img)}"><span>${esc(v.realName)}</span>${fa("fa-xmark")}</a>`; }).join("")}<button data-act="m-no-speaker" class="pm-3d b-violet sm">${fa("fa-comment-slash")}Aucun orateur</button></div>` : ""}</div>`;
    /* ── paramètres (rangés par catégorie) ── */
    const set = this.showSet ? `<div class="pm-set">
      <section style="--sc:#38e0ff"><h4>${fa("fa-table-cells-large")} Disposition</h4>
        ${field("Zone par défaut", sel("position", POSITIONS, scene.position))}${field("Taille des portraits", range("size", 32, 320, 4, scene.size))}${field("Espace entre portraits", range("st.gap", 0, 24, 1, st.gap))}
        ${field("Regrouper en un seul panneau", sel("st.merge", MERGE_MODES, st.merge || "auto"))}${field("…à partir de", `<input type="number" name="st.mergeAt" min="2" max="200" value="${Number(st.mergeAt) || 16}"> portraits`)}
        ${sw("st.compact", st.compact !== false, "Compact par défaut", "portraits serrés, noms fins")}${sw("st.fit", st.fit !== false, "Ajuster à l'écran", "réduit les panneaux pour tout faire tenir")}${sw("st.separators", st.separators !== false, "Séparer les groupes", "dans le panneau unique")}</section>
      <section style="--sc:#ff8af0"><h4>${fa("fa-id-badge")} Portraits</h4>${field("Cadre", sel("st.frame", FRAMES, st.frame))}${field("Format", sel("st.ratio", RATIOS, st.ratio))}${field("Bord", range("st.border", 0, 6, 1, st.border))}${field("Arrondi", range("st.radius", 0, 40, 1, st.radius))}</section>
      <section style="--sc:#ffd070"><h4>${fa("fa-font")} Noms</h4>${field("Nom des portraits", sel("st.names", NAME_STYLES, st.names))}${field("Police des portraits", sel("st.font", NAME_FONTS, st.font))}
        ${(() => { const nm = { ...NAME_DEFAULT, ...(st.nm || {}) }; const row = (k, list) => `<div class="sw pm-nmsw" title="Clic : choisir · clic droit : nuances plus claires ou plus foncées">${list.map(c => `<a data-act="nm-swatch" data-k="${k}" data-c="${c}" style="--c:${c}" class="${c === nm[k] ? "on" : ""}"></a>`).join("")}${list.includes(nm[k]) ? "" : `<a data-act="nm-swatch" data-k="${k}" data-c="${esc(nm[k])}" style="--c:${esc(nm[k])}" class="on cur" title="Couleur actuelle"></a>`}</div>`;
          return `${field("Fond des noms", sel("st.nm.bg", NAME_BGS, nm.bg))}${nm.bg === "auto" || nm.bg === "none" ? "" : field("Couleur du fond", row("bgc", ["#05070f", "#1a1f33", "#2a1a0c", ...SWATCHES]))}${field("Couleur du texte", row("tc", ["#ffffff", "#ffe9a8", "#05070f", ...SWATCHES.filter(c => c !== "#ffffff")]))}${field("Graisse", sel("st.nm.w", NAME_WEIGHTS, nm.w))}${field("Taille", sel("st.nm.size", NAME_SIZES, nm.size))}`; })()}
        ${sw("st.groups", st.groups, "Nom des groupes", "en haut de chaque panneau")}${field("Titre de la scène", `<input type="text" name="title" value="${esc(scene.title)}" placeholder="aucun">`)}</section>
      <section style="--sc:#b980ff"><h4>${fa("fa-palette")} Couleurs</h4>${field("Thème", sel("st.theme", THEMES, st.theme || ""))}${st.theme ? "" : field("Couleur de l'orateur", `<input type="color" name="st.accent" value="${esc(st.accent)}">`)}
        ${sw("st.bg", st.bg, "Fond des panneaux")}${sw("st.dim", st.dim, "Estomper les autres", "pendant que quelqu'un parle")}</section>
      <section style="--sc:#3ddc84"><h4>${fa("fa-layer-group")} Sous-groupes et joueurs</h4>${field("Défilement des sous-groupes", sel("st.subMode", SUB_MODES, st.subMode || "free"), "On clique un panneau puis molette, ↑ ↓ ou Page préc./suiv.")}
        ${sw("o.personal", game.settings.get(MOD, "personalLayout"), "Disposition personnelle des joueurs", "déplacer, agrandir, replier sur leur écran")}${sw("o.gmClick", game.settings.get(MOD, "gmClickSpeaker"), "Clic sur un portrait de la scène = orateur", "MJ, ce poste")}</section>
      <section style="--sc:#ff9b3d" class="wide"><h4>${fa("fa-tags")} Catégories <button data-act="cat-add" class="pm-3d b-green sm">${fa("fa-plus")}Catégorie</button></h4>
        <div class="pm-catl">${data.cats.map((c, i) => `<div class="pm-cated" data-i="${i}" style="--c:${esc(c.color)}"><i class="fa-solid ${esc(c.icon)} pv"></i><input type="text" data-cf="name" value="${esc(c.name)}" placeholder="Nom" style="font-family:${FONT_CSS[c.font] || "inherit"}"><input type="text" data-cf="icon" value="${esc(c.icon)}" class="ic" placeholder="fa-skull" data-tooltip="Icône Font Awesome (ex. fa-skull, fa-crown, fa-heart)"><input type="color" data-cf="color" value="${esc(c.color)}"><select data-cf="font" data-tooltip="Police du nom des portraits de cette catégorie"><option value="">Police des portraits</option>${Object.entries(NAME_FONTS).map(([k, n]) => `<option value="${k}"${c.font === k ? " selected" : ""}>${esc(n)}</option>`).join("")}</select><a data-act="cat-del" class="x">${fa("fa-trash")}</a></div>`).join("") || `<p class="pm-hint">Aucune catégorie : crée les tiennes (nom, icône, couleur, police). Elles servent à trier les portraits en haut de la fenêtre.</p>`}</div></section></div>` : "";
    /* ── arbre des groupes ── */
    const node = (x, depth) => { const on = sceneGroup(scene, x.id); const sub = descendants(data, x.id); const all = on && x.members.length && x.members.every(m => on.shown.includes(m));
      return `<li class="pm-g${x.id === this.groupId ? " sel" : ""}${depth ? " sub" : ""}" data-id="${x.id}" draggable="true" style="--gc:${esc(x.color || "#8ea0c8")};--d:${depth}">
        ${depth ? `<i class="br"></i>` : ""}<i class="dot"></i><span class="n">${esc(x.name)}</span>${!depth && x.gmg ? `<small class="gg" data-tooltip="Groupe MJ">${fa("fa-crown")}${esc(ggName(x.gmg))}</small>` : ""}${x.zone ? `<small class="z">${esc(ZONES[x.zone] || "")}</small>` : ""}<span class="c">${on ? `${on.shown.length}/` : ""}${x.members.length}</span>
        <a data-act="g-sub" class="add" data-tooltip="Ajouter un sous-groupe">${fa("fa-plus")}</a><a data-act="g-screen" class="eye${all ? " on" : on?.shown.length ? " part" : ""}" data-tooltip="${all ? "Tout désactiver" : "Tout activer"}${sub.length ? " (avec ses sous-groupes)" : ""}">${fa("fa-tv")}</a></li>`; };
    const tree = roots.map(r => node(r, 0) + descendants(data, r.id).map(({ g: x, depth }) => node(x, depth)).join("")).join("");
    /* ── groupe choisi ── */
    let main;
    if (!g) main = `<div class="pm-empty">${fa("fa-id-badge")}<p>Aucun groupe${this.gmg !== "*" ? " pour ce Groupe MJ" : ""}. Crée-en un à gauche, puis glisse des acteurs depuis le répertoire.</p></div>`;
    else {
      const root = rootOf(data, g.id) || g; const isRoot = root.id === g.id; const banned = new Set([g.id, ...descendants(data, g.id).map(x => x.g.id)]);
      let views = g.members.map(id => npcView(id, data, scene));
      if (this.search) { const q = this.search.toLowerCase(); views = views.filter(v => v.realName.toLowerCase().includes(q) || (v.actor?.name || "").toLowerCase().includes(q)); }
      if (this.cat !== "*") views = views.filter(v => (v.cat?.id || "") === this.cat);
      const cards = views.map(v => { const inThis = !!sg?.shown.includes(v.id);
        return `<div class="pm-m${inThis ? " on" : ""}${v.speaker ? " spk" : ""}${v.exists ? "" : " missing"}${v.hidePortrait ? " masked" : ""}" data-id="${v.id}" draggable="${!this.search}"${v.cat ? ` style="--cc:${esc(v.cat.color)}"` : ""}>
          <div class="pm-thumb" data-act="m-shown" data-tooltip="${inThis ? "À l'écran — clic pour retirer" : "Clic pour afficher à l'écran"}">${portraitHTML(v)}${fa("fa-mask")}${inThis ? `<span class="live">${fa("fa-tv")}</span>` : ""}${v.speaker ? `<span class="talk">${fa("fa-microphone")} parle</span>` : ""}${v.cat ? `<span class="cat" data-tooltip="${esc(v.cat.name)}">${fa(v.cat.icon)}</span>` : ""}</div>
          <div class="nm" title="${esc(v.realName)}${v.actor && v.actor.name !== v.realName ? ` (acteur : ${esc(v.actor.name)})` : ""}">${v.revealed ? "" : `<i class="fa-solid fa-eye-slash hid" data-tooltip="Nom caché aux joueurs"></i>`}${esc(v.realName)}</div>
          <div class="pm-big"><a data-act="m-shown" class="b-tv${inThis ? " on" : ""}">${fa("fa-tv")}<span>${inThis ? "À l'écran" : "Écran"}</span></a><a data-act="m-speaker" class="b-spk${v.speaker ? " on" : ""}">${fa(v.speaker ? "fa-microphone" : "fa-microphone-slash")}<span>${v.speaker ? "Parle" : "Orateur"}</span></a></div>
          <div class="pm-btns"><a data-act="m-reveal" class="b-name${v.revealed ? " on" : ""}" data-tooltip="${v.revealed ? "Nom visible — clic pour cacher" : "Nom caché (???) — clic pour révéler"}">${fa(v.revealed ? "fa-eye" : "fa-eye-slash")}</a>
            <a data-act="m-cat" class="b-cat" data-tooltip="Catégorie suivante">${fa(v.cat?.icon || "fa-tag")}</a><a data-act="m-edit" class="b-edit" data-tooltip="Modifier : alias, image, cadrage, catégorie">${fa("fa-pen")}</a><a data-act="m-remove" class="b-del" data-tooltip="Retirer du groupe">${fa("fa-xmark")}</a></div></div>`; }).join("");
      const parents = data.groups.filter(x => !banned.has(x.id));
      main = `<div class="pm-ghd" style="--gc:${esc(g.color || "#8ea0c8")}">
          ${isRoot ? "" : `<div class="pm-crumb">${fa("fa-layer-group")}${pathOf(data, g.id).map(esc).join(` ${fa("fa-angle-right")} `)}</div>`}
          <div class="row1"><input type="text" name="g.name" class="gname" value="${esc(g.name)}" title="Nom du groupe" style="font-family:${FONT_CSS[g.font] || "inherit"}">
            <label class="gcol" data-tooltip="Couleur du groupe"><input type="color" name="g.color" value="${esc(g.color || "#8ea0c8")}"></label>
            ${field("Police du nom", `<select name="g.font"><option value="">Comme les portraits</option>${Object.entries(NAME_FONTS).map(([k, n]) => `<option value="${k}"${g.font === k ? " selected" : ""} style="font-family:${FONT_CSS[k]}">${esc(n)}</option>`).join("")}</select>`)}
            ${isRoot ? field(`${fa("fa-crown")} Groupe MJ`, `<select name="g.gmg"><option value="">Tous les joueurs</option>${GG.map(x => `<option value="${x.id}"${g.gmg === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`) : `<span class="pm-inh">${fa("fa-crown")} ${root.gmg ? esc(ggName(root.gmg)) : "Tous les joueurs"} <small>(comme ${esc(root.name)})</small></span>`}
            ${field(`${fa("fa-link")} Rattacher à`, `<select name="g.parent"><option value="">— groupe principal —</option>${parents.map(x => `<option value="${x.id}"${g.parent === x.id ? " selected" : ""}>${esc(pathOf(data, x.id).join(" › "))}</option>`).join("")}</select>`)}
            ${field("Zone", sel("g.zone", ZONES, g.zone || ""))}
            <span class="grow"></span><button data-act="g-del" class="pm-3d b-red" data-tooltip="Supprimer le groupe">${fa("fa-trash")}</button></div>
          <div class="sw" title="Clic : choisir · clic droit : nuances plus claires ou plus foncées">${SWATCHES.map(c => `<a data-act="g-swatch" data-c="${c}" style="--c:${c}" class="${c === g.color ? "on" : ""}"></a>`).join("")}${g.color && !SWATCHES.includes(g.color) ? `<a data-act="g-swatch" data-c="${esc(g.color)}" style="--c:${esc(g.color)}" class="on cur" title="Couleur actuelle"></a>` : ""}</div>
          <div class="row2">
            <button data-act="m-add" class="pm-3d b-blue">${fa("fa-user-plus")}Ajouter un portrait</button>
            <button data-act="g-sub" class="pm-3d b-cyan">${fa("fa-folder-plus")}Sous-groupe</button>
            <span class="pm-pair"><button data-act="m-all-on" class="pm-3d b-green">${fa("fa-toggle-on")}Tout activer</button><button data-act="m-group-off" class="pm-3d b-ghost">${fa("fa-toggle-off")}Tout désactiver</button></span>
            <span class="pm-pair"><button data-act="m-reveal-all" class="pm-3d b-gold">${fa("fa-eye")}Révéler tous les noms</button><button data-act="m-hide-all" class="pm-3d b-ghost">${fa("fa-user-secret")}Caché</button></span>
            <span class="grow"></span><label class="search">${fa("fa-magnifying-glass")}<input type="text" name="search" value="${esc(this.search)}" placeholder="Rechercher"></label></div></div>
        <div class="pm-members" data-drop="1">${cards || `<div class="pm-empty small"><p>${this.cat !== "*" ? "Aucun portrait dans cette catégorie." : "Groupe vide. Glisse des acteurs ici depuis le répertoire, ou « Ajouter un portrait »."}</p></div>`}</div>`;
    }
    const pv = `<div class="pm-pvwrap${this.showPv === false ? " off" : ""}"><span class="lbl">${fa("fa-display")} Aperçu — ce que voient les joueurs</span><div id="pm-preview"></div></div>`;
    return `<div class="pm-wrap">${top}${pv}${set}${cats}${live}<div class="pm-body">
        <aside class="pm-side"><h3>${fa("fa-sitemap")} Groupes</h3><ul class="pm-groups">${tree || `<li class="hint">Aucun groupe</li>`}</ul>
          <button data-act="g-add" class="pm-3d b-blue full">${fa("fa-plus")}Nouveau groupe principal</button></aside>
        <section class="pm-main">${main}</section></div></div>`;
  }
  _replaceHTML(result, content) { requestAnimationFrame(() => Stage.paintPreview()); const sc = content.querySelector(".pm-members")?.scrollTop || 0, ss = content.querySelector(".pm-side")?.scrollTop || 0; content.innerHTML = result; this._activate(content.firstElementChild);
    const m = content.querySelector(".pm-members"); if (m) m.scrollTop = sc; const sd = content.querySelector(".pm-side"); if (sd) sd.scrollTop = ss;
    if (this._focusSearch) { const s = content.querySelector('[name="search"]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } this._focusSearch = false; } }

  _activate(root) {
    root.addEventListener("contextmenu", ev => { const a = ev.target.closest('[data-act="g-swatch"], [data-act="nm-swatch"]'); if (!a) return; ev.preventDefault(); root.querySelector(".pm-shades")?.remove();
      const r = a.getBoundingClientRect(), R = root.getBoundingClientRect(); const box = document.createElement("div"); box.className = "pm-shades";
      box.innerHTML = shades(a.dataset.c).map(c => `<a data-act="${a.dataset.act}"${a.dataset.k ? ` data-k="${a.dataset.k}"` : ""} data-c="${c}" style="--c:${c}" title="${c}"></a>`).join(""); box.style.left = `${r.left - R.left + r.width / 2 - 15}px`; box.style.top = `${r.bottom - R.top + 6}px`; root.appendChild(box);
      const off = e => { if (!box.contains(e.target)) { box.remove(); document.removeEventListener("pointerdown", off, true); } }; setTimeout(() => document.addEventListener("pointerdown", off, true)); });
    root.addEventListener("click", ev => { const a = ev.target.closest("[data-act]"); if (a) { ev.preventDefault(); this._act(a.dataset.act, a, ev); } });
    root.querySelectorAll(".pm-groups .pm-g").forEach(li => li.addEventListener("click", ev => { if (ev.target.closest("[data-act]")) return; this.groupId = li.dataset.id; this.render(); }));
    const on = (n, fn) => root.querySelector(`[name="${n}"]`)?.addEventListener("change", fn);
    on("position", e => setScene({ position: e.target.value }));
    for (const k of ["theme", "frame", "ratio", "names", "font", "merge", "subMode"]) on(`st.${k}`, e => updateScene(s => { s.style[k] = e.target.value; }));
    for (const k of ["bg", "w", "size"]) on(`st.nm.${k}`, e => updateScene(s => { s.style.nm = { ...NAME_DEFAULT, ...(s.style.nm || {}), [k]: e.target.value }; }));
    for (const k of ["bg", "dim", "groups", "fit", "separators", "compact"]) on(`st.${k}`, e => updateScene(s => { s.style[k] = e.target.checked; }));
    on("o.personal", e => game.settings.set(MOD, "personalLayout", e.target.checked)); on("o.gmClick", e => game.settings.set(MOD, "gmClickSpeaker", e.target.checked));
    on("st.mergeAt", e => updateScene(s => { s.style.mergeAt = Math.max(2, Number(e.target.value) || 16); }));
    on("st.accent", e => updateScene(s => { s.style.accent = e.target.value; }));
    on("title", e => setScene({ title: e.target.value.trim() }));
    const G = d => d.groups.find(x => x.id === this.groupId);
    on("g.name", e => { const v = e.target.value.trim(); if (v) updateData(d => { G(d).name = v; }); });
    for (const k of ["color", "zone", "font", "gmg"]) on(`g.${k}`, e => updateData(d => { G(d)[k] = e.target.value; }));
    on("g.parent", e => updateData(d => { const g = G(d); const v = e.target.value; if (v && descendants(d, g.id).some(x => x.g.id === v)) return false; g.parent = v; if (v) g.gmg = ""; }));
    root.querySelectorAll("[data-cf]").forEach(inp => inp.addEventListener("change", () => { const i = +inp.closest("[data-i]").dataset.i; const v = inp.value.trim(); if (!v && inp.dataset.cf !== "font") return; updateData(d => { if (!d.cats[i]) return false; d.cats[i][inp.dataset.cf] = v; }); }));
    const stageEl = () => document.getElementById("pm-stage"); const sc = () => game.settings.get(MOD, "playerScale") || 1;
    const live = (n, fn, preview, unit = "px") => { const r = root.querySelector(`[name="${n}"]`); if (!r) return; r.addEventListener("input", () => { r.nextElementSibling.textContent = r.value + unit; preview?.(Number(r.value)); }); r.addEventListener("change", () => fn(Number(r.value))); };
    live("size", v => setScene({ size: v }), v => stageEl()?.style.setProperty("--pm-base", Math.round(v * sc()) + "px"));
    live("st.border", v => updateScene(s => { s.style.border = v; }), v => stageEl()?.style.setProperty("--pm-bw", v + "px"));
    live("st.radius", v => updateScene(s => { s.style.radius = v; }), v => stageEl()?.style.setProperty("--pm-radius", v + "px"));
    live("st.gap", v => updateScene(s => { s.style.gap = v; }), v => stageEl()?.style.setProperty("--pm-gap", v + "px"));
    root.querySelectorAll(".pm-chip [name='psize']").forEach(r => { const gid = r.closest(".pm-chip").dataset.group;
      r.addEventListener("input", () => { r.nextElementSibling.textContent = r.value; stageEl()?.querySelector(`.pm-panel[data-group="${gid}"]`)?.style.setProperty("--pm-sz", Math.round(r.value * sc()) + "px"); });
      r.addEventListener("change", () => updateScene(s => { s.panels ||= {}; s.panels[gid] = { ...(s.panels[gid] || {}), size: Number(r.value) }; })); });
    root.querySelectorAll(".pm-chip [name='psub']").forEach(r => r.addEventListener("change", () => { const gid = r.closest(".pm-chip").dataset.group; updateScene(s => { s.panels ||= {}; s.panels[gid] = { ...(s.panels[gid] || {}), sub: r.value }; }); }));
    const s = root.querySelector('[name="search"]'); if (s) { let t; s.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { this.search = s.value; this._focusSearch = true; this.render(); }, 250); }); }
    const drop = root.querySelector("[data-drop]") || root.querySelector(".pm-main");
    if (drop) {
      drop.addEventListener("dragover", ev => { if (ev.dataTransfer.types.includes("text/plain")) { ev.preventDefault(); drop.classList.add("over"); } });
      drop.addEventListener("dragleave", () => drop.classList.remove("over"));
      drop.addEventListener("drop", async ev => { drop.classList.remove("over"); let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; }
        if (d?.pmMember || d?.pmGroup) return; ev.preventDefault();
        if (d?.type === "Actor") { const doc = await fromUuid(d.uuid); if (doc) await this._addActors([doc.id]); }
        else if (d?.type === "Folder" && d.documentName === "Actor") { const f = await fromUuid(d.uuid); if (f) await this._addActors(f.contents.map(a => a.id)); } });
    }
    root.querySelectorAll('.pm-m[draggable="true"]').forEach(card => {
      card.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/plain", JSON.stringify({ pmMember: card.dataset.id, from: this.groupId })); card.classList.add("drag"); });
      card.addEventListener("dragend", () => card.classList.remove("drag"));
      card.addEventListener("dragover", ev => { ev.preventDefault(); card.classList.add("target"); });
      card.addEventListener("dragleave", () => card.classList.remove("target"));
      card.addEventListener("drop", async ev => { card.classList.remove("target"); let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; } if (!d?.pmMember || d.pmMember === card.dataset.id) return; ev.preventDefault(); ev.stopPropagation();
        await updateData(data => { const g = data.groups.find(x => x.id === this.groupId); if (!g) return false; const from = g.members.indexOf(d.pmMember), to = g.members.indexOf(card.dataset.id); if (from < 0 || to < 0) return false; g.members.splice(from, 1); g.members.splice(to, 0, d.pmMember); });
        await updateScene(s => { const sg = sceneGroup(s, this.groupId); if (!sg) return false; const g = getData().groups.find(x => x.id === this.groupId); sg.shown.sort((a, b) => g.members.indexOf(a) - g.members.indexOf(b)); }); });
    });
    root.querySelectorAll(".pm-g").forEach(li => {
      li.addEventListener("dragstart", ev => ev.dataTransfer.setData("text/plain", JSON.stringify({ pmGroup: li.dataset.id })));
      li.addEventListener("dragover", ev => ev.preventDefault());
      li.addEventListener("drop", async ev => { let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; }
        if (d?.type === "Actor") { ev.preventDefault(); ev.stopPropagation(); const doc = await fromUuid(d.uuid); if (doc) { this.groupId = li.dataset.id; await this._addActors([doc.id]); } return; }
        /* un portrait glissé sur un autre groupe y est copié */
        if (d?.pmMember) { ev.preventDefault(); ev.stopPropagation(); await updateData(data => { const g = data.groups.find(x => x.id === li.dataset.id); if (!g || g.members.includes(d.pmMember)) return false; g.members.push(d.pmMember); }); return this.render(); }
        if (!d?.pmGroup || d.pmGroup === li.dataset.id) return; ev.preventDefault(); ev.stopPropagation();
        await updateData(data => { const from = data.groups.findIndex(x => x.id === d.pmGroup), to = data.groups.findIndex(x => x.id === li.dataset.id); if (from < 0 || to < 0) return false; const [g] = data.groups.splice(from, 1); const tgt = data.groups.find(x => x.id === li.dataset.id); g.parent = tgt?.parent || ""; data.groups.splice(data.groups.findIndex(x => x.id === li.dataset.id), 0, g); }); });
    });
  }

  async _act(act, a) {
    const gid = a.closest(".pm-g")?.dataset.id, mid = a.closest(".pm-m")?.dataset.id || a.dataset.id, pid = a.closest(".pm-chip")?.dataset.group;
    const presetSel = () => this.element.querySelector('[name="preset"]')?.value || "";
    const group = () => getData().groups.find(x => x.id === this.groupId);
    const tree = id => { const d = getData(); return [id, ...descendants(d, id).map(x => x.g.id)]; };
    switch (act) {
      case "gmg": this.gmg = a.dataset.v; this.groupId = null; break;
      case "cat": this.cat = a.dataset.v; break;
      case "g-add": { const name = await askText("Nouveau groupe principal", "Nom", ""); if (!name) return; const id = uid(); const gmg = this.gmg !== "*" ? this.gmg : ""; await updateData(d => { d.groups.push({ id, name, members: [], color: SWATCHES[d.groups.length % SWATCHES.length], zone: "", parent: "", gmg, font: "" }); }); this.groupId = id; break; }
      case "g-sub": { const parent = gid || this.groupId; const p = getData().groups.find(x => x.id === parent); if (!p) return; const name = await askText(`Sous-groupe de « ${p.name} »`, "Nom", ""); if (!name) return; const id = uid(); await updateData(d => { d.groups.push({ id, name, members: [], color: p.color || SWATCHES[d.groups.length % SWATCHES.length], zone: "", parent, gmg: "", font: "" }); }); this.groupId = id; break; }
      case "g-del": { const g = group(); const kids = descendants(getData(), g.id).length; if (!await DialogV2.confirm({ window: { title: "Supprimer le groupe" }, classes: ["pm-dialog"], content: `<p>Supprimer <b>${esc(g.name)}</b> ? Les PNJ restent dans le monde.${kids ? ` Ses ${kids} sous-groupe${kids > 1 ? "s" : ""} remonte${kids > 1 ? "nt" : ""} d'un cran.` : ""}</p>` })) return;
        await updateData(d => { for (const c of childrenOf(d, g.id)) c.parent = g.parent || ""; d.groups = d.groups.filter(x => x.id !== g.id); }); await updateScene(s => { s.groups = s.groups.filter(x => x.id !== g.id); prune(s); }); break; }
      case "nm-swatch": await updateScene(s => { s.style.nm = { ...NAME_DEFAULT, ...(s.style.nm || {}), [a.dataset.k]: a.dataset.c }; }); break;
      case "g-swatch": await updateData(d => { d.groups.find(x => x.id === this.groupId).color = a.dataset.c; }); break;
      case "g-screen": { const ids = tree(gid); const d = getData(); const s0 = getScene(); const all = ids.every(id => { const g = d.groups.find(x => x.id === id); const sg = sceneGroup(s0, id); return !g.members.length || (sg && g.members.every(m => sg.shown.includes(m))); }) && ids.some(id => sceneGroup(s0, id)?.shown.length);
        if (all) await updateScene(s => { s.groups = s.groups.filter(x => !ids.includes(x.id)); prune(s); });
        else await updateScene(s => { for (const id of ids) { const g = d.groups.find(x => x.id === id); if (!g?.members.length) continue; const sg = sceneGroup(s, id, true); sg.shown = [...g.members]; } s.active = true; }); break; }
      case "m-add": await this._pickActors(); break;
      case "m-remove": await updateData(d => { const g = d.groups.find(x => x.id === this.groupId); g.members = g.members.filter(x => x !== mid); }); await updateScene(s => { const sg = sceneGroup(s, this.groupId); if (sg) sg.shown = sg.shown.filter(x => x !== mid); prune(s); }); break;
      case "m-shown": await updateScene(s => { const sg = sceneGroup(s, this.groupId, true); if (sg.shown.includes(mid)) sg.shown = sg.shown.filter(x => x !== mid); else { sg.shown.push(mid); const g = getData().groups.find(x => x.id === this.groupId); sg.shown.sort((a, b) => g.members.indexOf(a) - g.members.indexOf(b)); s.active = true; } prune(s); }); break;
      case "m-speaker": await updateScene(s => { s.speakers = s.speakers.includes(mid) ? s.speakers.filter(x => x !== mid) : [...s.speakers, mid]; if (s.speakers.includes(mid) && !s.groups.some(g => g.shown.includes(mid))) { sceneGroup(s, this.groupId, true).shown.push(mid); s.active = true; } }); break;
      case "spk-off": await updateScene(s => { s.speakers = s.speakers.filter(x => x !== a.dataset.id); }); break;
      case "m-reveal": await updateData(d => { const n = ensureNpc(d, mid); n.revealed = !n.revealed; }); break;
      case "m-cat": await updateData(d => { const n = ensureNpc(d, mid); const L = ["", ...d.cats.map(c => c.id)]; n.cat = L[(L.indexOf(n.cat || "") + 1) % L.length]; }); break;
      case "m-reveal-all": case "m-hide-all": await updateData(d => { const g = d.groups.find(x => x.id === this.groupId); for (const id of g.members) ensureNpc(d, id).revealed = act === "m-reveal-all"; }); break;
      case "m-edit": await this._editMember(mid); break;
      case "m-all-on": { const g = group(); await updateScene(s => { const sg = sceneGroup(s, g.id, true); sg.shown = [...g.members]; s.active = true; }); break; }
      case "m-group-off": await updateScene(s => { s.groups = s.groups.filter(x => x.id !== this.groupId); prune(s); }); break;
      case "m-all-off": await setScene({ groups: [], speakers: [] }); break;
      case "m-no-speaker": await setScene({ speakers: [] }); break;
      case "p-compact": case "p-collapse": { const k = act === "p-compact" ? "compact" : "collapsed"; await updateScene(s => { s.panels ||= {}; const P = s.panels[pid] ||= {}; const cur = k === "compact" ? (P.compact ?? (s.style.compact !== false)) : !!P.collapsed; P[k] = !cur; }); break; }
      case "p-dock": await updateScene(s => { s.panels ||= {}; s.panels[pid] = { ...(s.panels[pid] || {}), pos: null }; }); break;
      case "p-remove": { const ids = tree(pid); await updateScene(s => { s.groups = s.groups.filter(x => !ids.includes(x.id)); prune(s); }); break; }
      case "s-toggle": await setScene({ active: !getScene().active }); break;
      case "pv-toggle": this.showPv = this.showPv === false; break;
      case "set-toggle": this.showSet = !this.showSet; break;
      case "cat-new": this.showSet = true; await updateData(d => { d.cats.push({ id: uid(), name: "Nouvelle catégorie", icon: "fa-tag", color: SWATCHES[d.cats.length % SWATCHES.length], font: "" }); }); break;
      case "cat-add": await updateData(d => { d.cats.push({ id: uid(), name: "Nouvelle catégorie", icon: "fa-tag", color: SWATCHES[d.cats.length % SWATCHES.length], font: "" }); }); break;
      case "cat-del": { const i = +a.closest("[data-i]").dataset.i; await updateData(d => { const c = d.cats[i]; if (!c) return false; d.cats.splice(i, 1); for (const n of Object.values(d.npcs)) if (n.cat === c.id) n.cat = ""; }); if (this.cat !== "*" && !getData().cats.some(c => c.id === this.cat)) this.cat = "*"; break; }
      case "cat-reset": if (!await DialogV2.confirm({ window: { title: "Catégories par défaut" }, classes: ["pm-dialog"], content: "<p>Remettre les catégories par défaut ? Les portraits rangés dans une catégorie supprimée n'en ont plus.</p>" })) return; await updateData(d => { d.cats = foundry.utils.deepClone(DEFAULT_CATS); const ids = new Set(d.cats.map(c => c.id)); for (const n of Object.values(d.npcs)) if (n.cat && !ids.has(n.cat)) n.cat = ""; }); break;
      case "pr-save": { const cur = getData().presets.find(p => p.id === presetSel()); const name = await askText("Enregistrer la mise en scène", "Nom", cur?.name || ""); if (!name) return; const s = getScene(); const snap = { groups: foundry.utils.deepClone(s.groups), panels: foundry.utils.deepClone(s.panels || {}), speakers: [...s.speakers], position: s.position, title: s.title };
        await updateData(d => { const ex = d.presets.find(p => p.name === name); if (ex) ex.scene = snap; else d.presets.push({ id: uid(), name, scene: snap }); }); ui.notifications.info(`Mise en scène « ${name} » enregistrée.`); break; }
      case "pr-load": { const p = getData().presets.find(x => x.id === presetSel()); if (!p) return ui.notifications.warn("Choisis une mise en scène."); const ids = new Set(getData().groups.map(g => g.id)); await updateScene(s => { s.groups = foundry.utils.deepClone(p.scene.groups).filter(g => ids.has(g.id)); if (p.scene.panels) s.panels = foundry.utils.deepClone(p.scene.panels); s.speakers = [...p.scene.speakers]; s.position = p.scene.position || s.position; s.title = p.scene.title ?? s.title; prune(s); s.active = true; }); break; }
      case "pr-del": { const p = getData().presets.find(x => x.id === presetSel()); if (!p) return; if (!await DialogV2.confirm({ window: { title: "Supprimer" }, classes: ["pm-dialog"], content: `<p>Supprimer la mise en scène <b>${esc(p.name)}</b> ?</p>` })) return; await updateData(d => { d.presets = d.presets.filter(x => x.id !== p.id); }); break; }
    }
    this.render();
  }

  async _addActors(ids) {
    await updateData(d => { const g = d.groups.find(x => x.id === this.groupId); if (!g) { ui.notifications.warn("Sélectionne d'abord un groupe."); return false; } for (const id of ids) { if (!g.members.includes(id)) g.members.push(id); const n = ensureNpc(d, id); if (this.cat !== "*" && !n.cat) n.cat = this.cat; } });
    this.render();
  }
  async _pickActors() {
    if (!this.groupId) return ui.notifications.warn("Crée ou sélectionne un groupe d'abord.");
    const g = getData().groups.find(x => x.id === this.groupId);
    const actors = game.actors.contents.slice().sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const folders = f => { const p = []; let x = f; while (x) { p.unshift(x.name); x = x.folder; } return p.join(" / "); };
    const rows = actors.map(a => `<label class="pm-pick${g.members.includes(a.id) ? " in" : ""}" data-n="${esc((a.name + " " + folders(a.folder)).toLowerCase())}"><input type="checkbox" name="a" value="${a.id}"${g.members.includes(a.id) ? " checked disabled" : ""}><img src="${esc(a.img)}"><span class="n">${esc(a.name)}</span><span class="f">${esc(folders(a.folder))}</span></label>`).join("");
    const content = `<div class="pm-picker"><input type="text" class="q" placeholder="Filtrer" autofocus><div class="list">${rows}</div></div>`;
    const ids = await DialogV2.prompt({ window: { title: `Ajouter un portrait à « ${g.name} »`, icon: "fa-solid fa-user-plus" }, classes: ["pm-dialog"], position: { width: 560 }, content,
      ok: { label: "Ajouter la sélection", icon: "fa-solid fa-check", callback: (ev, btn) => [...btn.form.querySelectorAll('input[name="a"]:checked:not(:disabled)')].map(i => i.value) },
      render: (ev, dlg) => { const el = elOf(dlg); const q = el.querySelector(".q"); q.addEventListener("input", () => { const v = q.value.toLowerCase(); el.querySelectorAll(".pm-pick").forEach(l => l.style.display = l.dataset.n.includes(v) ? "" : "none"); }); } });
    if (ids?.length) await this._addActors(ids);
  }
  /* une seule fenêtre pour un portrait : alias, image, catégorie, masque, cadrage */
  async _editMember(mid) {
    const data = getData(); const n = ensureNpc(data, mid); const a = game.actors.get(mid); const v = npcView(mid, data); const scene = getScene(); const c = { ...v.crop };
    const content = `<div class="pm-form pm-edit">
      <div class="pm-crop ratio-${scene.style.ratio} frame-${scene.style.frame}"><div class="box"><img src="${esc(v.img)}" draggable="false"></div>
        <div class="ctrl"><label>Zoom <input type="range" name="z" min="100" max="300" step="2" value="${c.z}"><output>${c.z}%</output></label><button type="button" class="reset" title="Recentrer"><i class="fa-solid fa-rotate-left"></i></button></div>
        <p class="hint">Glisse l'image pour la cadrer, molette pour zoomer.</p></div>
      <div class="fields">
        <label><b>Nom affiché</b><input type="text" name="alias" value="${esc(n.alias)}" placeholder="${esc(a?.name || "")}"></label>
        <label><b>Image</b><span class="row"><input type="text" name="img" value="${esc(n.img)}" placeholder="portrait de l'acteur"><button type="button" class="browse" title="Parcourir"><i class="fa-solid fa-folder-open"></i></button></span></label>
        <label><b>Catégorie</b><select name="cat"><option value="">Sans catégorie</option>${data.cats.map(k => `<option value="${k.id}"${n.cat === k.id ? " selected" : ""}>${esc(k.name)}</option>`).join("")}</select></label>
        <label class="chk"><input type="checkbox" name="hidePortrait"${n.hidePortrait ? " checked" : ""}><b>Masquer le portrait (silhouette)</b></label>
        <label class="chk"><input type="checkbox" name="revealed"${n.revealed ? " checked" : ""}><b>Nom visible des joueurs</b></label>
      </div>
      <input type="hidden" name="x" value="${c.x}"><input type="hidden" name="y" value="${c.y}"></div>`;
    const r = await DialogV2.prompt({ window: { title: `Modifier — ${v.realName}`, icon: "fa-solid fa-pen" }, classes: ["pm-dialog"], position: { width: 560 }, content,
      ok: { label: "Enregistrer", icon: "fa-solid fa-check", callback: (ev, btn) => { const f = btn.form.elements; return { alias: f.alias.value.trim(), img: f.img.value.trim(), cat: f.cat.value, hidePortrait: f.hidePortrait.checked, revealed: f.revealed.checked, crop: { x: Number(f.x.value), y: Number(f.y.value), z: Number(f.z.value) } }; } },
      render: (ev, dlg) => {
        const el = elOf(dlg); const box = el.querySelector(".pm-crop .box"), img = box.querySelector("img"), z = el.querySelector('[name="z"]'), out = z.nextElementSibling, hx = el.querySelector('[name="x"]'), hy = el.querySelector('[name="y"]'), inp = el.querySelector('[name="img"]');
        const apply = () => { c.x = Math.max(0, Math.min(100, c.x)); c.y = Math.max(0, Math.min(100, c.y)); img.style.objectPosition = `${c.x}% ${c.y}%`; img.style.transform = `scale(${c.z / 100})`; img.style.transformOrigin = `${c.x}% ${c.y}%`; hx.value = c.x; hy.value = c.y; z.value = c.z; out.textContent = c.z + "%"; };
        z.addEventListener("input", () => { c.z = Number(z.value); apply(); });
        el.querySelector(".reset").addEventListener("click", () => { Object.assign(c, DEFAULT_CROP); apply(); });
        box.addEventListener("wheel", e => { e.preventDefault(); c.z = Math.max(100, Math.min(300, c.z - Math.sign(e.deltaY) * 8)); apply(); }, { passive: false });
        let drag = null;
        box.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y }; box.setPointerCapture(e.pointerId); });
        box.addEventListener("pointermove", e => { if (!drag) return; const rr = box.getBoundingClientRect(); const k = 100 / (c.z / 100); c.x = drag.cx - (e.clientX - drag.x) / rr.width * k; c.y = drag.cy - (e.clientY - drag.y) / rr.height * k; apply(); });
        box.addEventListener("pointerup", () => drag = null); box.addEventListener("pointercancel", () => drag = null);
        inp.addEventListener("change", () => img.src = inp.value || a?.img || "");
        el.querySelector(".browse").addEventListener("click", () => new (FP())({ type: "image", current: inp.value, callback: p => { inp.value = p; img.src = p; } }).render(true));
        apply();
      } });
    if (!r) return; await updateData(d => { Object.assign(ensureNpc(d, mid), r); });
  }
}

async function askText(title, label, value) {
  const r = await DialogV2.prompt({ window: { title }, classes: ["pm-dialog"], content: `<div class="pm-form"><label><b>${esc(label)}</b><input type="text" name="v" value="${esc(value)}" autofocus></label></div>`, ok: { label: "Valider", callback: (ev, btn) => btn.form.elements.v.value.trim() }, rejectClose: false });
  return r || null;
}
