/* Portrait - Manhwa 3.0 (id pnj-manhwa) — Groupes & Scène · réglages, données, hooks
   3.0 : groupes par Groupe MJ (Fiche Manhwa), sous-groupes sans limite (on les fait défiler à la molette), catégories avec icônes, police par groupe.
   Données (réglage monde « data ») : groupes (bibliothèque), étiquettes, surcharges par PNJ (alias, image, cadrage, révélé, portrait masqué), mises en scène enregistrées.
   Scène (réglage monde « scene ») : ce qui est à l'écran — panneaux (un par groupe affiché), orateurs, style. */
import { Stage } from "./stage.js";
import { Manager } from "./manager.js";

export const MOD = "pnj-manhwa";
export const POSITIONS = { bottom: "Bas", top: "Haut", left: "Gauche", right: "Droite", middle: "Milieu" };
export const FRAMES = { rounded: "Arrondi", square: "Carré", round: "Rond", hex: "Hexagone" };
export const RATIOS = { square: "Carré 1:1", portrait: "Portrait 3:4", tall: "Vertical 2:3", wide: "Paysage 4:3" };
export const NAME_STYLES = { inside: "Dans le portrait", below: "Sous le portrait", hidden: "Masqué" };
/* 3.4 : style des noms (fond, couleurs, graisse, taille) — « auto » garde le rendu du thème */
export const NAME_BGS = { auto: "Selon le thème", glass: "Verre (flou transparent)", solid: "Plein", gradient: "Dégradé", neon: "Bandeau néon", tag: "Étiquette", none: "Aucun fond" };
export const NAME_WEIGHTS = { normal: "Normal", bold: "Gras", black: "Très gras" };
export const NAME_SIZES = { s: "Petit", m: "Moyen", l: "Grand" };
export const NAME_DEFAULT = { bg: "auto", bgc: "#05070f", tc: "#ffffff", w: "bold", size: "m" };
export const MERGE_MODES = { auto: "Auto (au-delà du seuil)", always: "Toujours", never: "Jamais" };
export const NAME_FONTS = { sans: "Sans (Rajdhani)", title: "Titre (Orbitron)", serif: "Serif (Cinzel)", mono: "Mono (Share Tech)", plain: "Système (Signika)", display: "Affiche (Audiowide)", brush: "Pinceau (Permanent Marker)", gothic: "Gothique (UnifrakturCook)" };
export const FONT_CSS = { sans: "'Rajdhani', sans-serif", title: "'Orbitron', sans-serif", serif: "'Cinzel', serif", mono: "'Share Tech Mono', monospace", plain: "'Signika', sans-serif", display: "'Audiowide', sans-serif", brush: "'Permanent Marker', cursive", gothic: "'UnifrakturCook', serif" };
export const SUB_MODES = { free: "Chaque joueur fait défiler comme il veut", forced: "Le MJ impose la page affichée à tous" };
export const DEFAULT_CATS = [];   /* 3.1 : les catégories, c'est le MJ qui les crée (nom, icône, couleur, police) */
const OLD_CATS = ["ally", "enemy", "neutral", "merchant", "boss", "family"];
export const THEMES = { glass: "Verre — fin (défaut, façon Conversation HUD)", neon: "Néon — Portrait", "": "Personnalisé (couleur au choix)", eos: "Doré — fantasy", system: "Fenêtre système — bleu", clockwork: "Rouages — steampunk", nova: "Néon — cyberpunk", inertia: "Velours — noblesse", blood: "Sang — dark fantasy", sobre: "Sobre" };
export const ZONES = { "": "Zone par défaut", bottom: "Bas", top: "Haut", left: "Gauche", right: "Droite", middle: "Milieu" };
export const UNKNOWN = "???";

const DEFAULT_DATA = { v: 4, tags: [], groups: [], npcs: {}, presets: [], cats: null };
const DEFAULT_SCENE = { v: 7, active: false, groups: [], speakers: [], position: "bottom", size: 96, title: "",
  style: { theme: "glass", subMode: "free", compact: true, accent: "#38e0ff", frame: "rounded", ratio: "portrait", names: "inside", font: "sans", bg: true, dim: true, groups: true, tags: false, border: 2, radius: 10, gap: 6, fit: true, merge: "auto", mergeAt: 16, separators: true },
  merged: { size: null, compact: false, collapsed: false, pos: null }, panels: {} };
export const DEFAULT_CROP = { x: 50, y: 25, z: 100 };

export const uid = () => foundry.utils.randomID(10);
export const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/* ───────── accès aux données ───────── */
export function getData() { const d = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_DATA), game.settings.get(MOD, "data") || {}, { inplace: false }); d.presets ||= []; if (!Array.isArray(d.cats)) d.cats = [];
  if ((d.v || 0) < 4) { d.cats = d.cats.filter(c => !OLD_CATS.includes(c.id)); for (const n of Object.values(d.npcs || {})) if (OLD_CATS.includes(n.cat)) n.cat = ""; d.v = 4; }   /* 3.1 : catégories par défaut retirées */
  for (const c of d.cats) { c.font ??= ""; c.icon ||= "fa-tag"; c.color ||= "#5ef0ff"; }
  for (const g of d.groups) { g.color ??= ""; g.zone ??= ""; g.parent ??= ""; g.gmg ??= ""; g.font ??= ""; g.members ||= []; }
  for (const g of d.groups) if (g.parent && (!d.groups.some(x => x.id === g.parent) || g.parent === g.id)) g.parent = "";   /* parent supprimé : redevient principal */
  return d; }
/* ── sous-groupes : arbre sans limite (un groupe peut être rattaché à un groupe principal, lui-même rattaché…) ── */
export const childrenOf = (d, id) => d.groups.filter(g => g.parent === id);
export function descendants(d, id, depth = 1, seen = new Set([id])) { const out = []; for (const c of childrenOf(d, id)) { if (seen.has(c.id)) continue; seen.add(c.id); out.push({ g: c, depth }, ...descendants(d, c.id, depth + 1, seen)); } return out; }
export function rootOf(d, id) { let g = d.groups.find(x => x.id === id); const seen = new Set(); while (g?.parent && !seen.has(g.id)) { seen.add(g.id); const p = d.groups.find(x => x.id === g.parent); if (!p) break; g = p; } return g || null; }
export const pathOf = (d, id) => { const out = []; let g = d.groups.find(x => x.id === id); const seen = new Set(); while (g && !seen.has(g.id)) { seen.add(g.id); out.unshift(g.name); g = d.groups.find(x => x.id === g.parent); } return out; };
/* ── Groupes MJ (Fiche Manhwa) : un groupe principal peut être réservé à un Groupe MJ ; ses sous-groupes suivent ── */
export const gmGroupsApi = () => globalThis.MANHWA?.gmGroups || null;
export const gmGroupList = () => { try { return gmGroupsApi()?.list() || []; } catch (e) { return []; } };
export function visibleFor(d, g, user = game.user) { if (user.isGM) return true; const r = rootOf(d, g.id) || g; if (!r.gmg) return true; try { return (gmGroupsApi()?.ofUser(user) || []).some(x => x.id === r.gmg); } catch (e) { return true; } }
export async function setData(d) { if (!game.user.isGM) return; await game.settings.set(MOD, "data", d); }
export function getScene() {
  const raw = game.settings.get(MOD, "scene") || {};
  const s = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_SCENE), raw, { inplace: false });
  if (!Array.isArray(s.groups)) s.groups = [];
  /* migration des scènes 1.x : thème → accent, scale → taille en px, sizeCollapsed → repli */
  if (raw.v && raw.v < 4) { const acc = { orv: "#38e0ff", eos: "#e2c273", clockwork: "#e0a060", nova: "#ff2bd6", inertia: "#e8c07a", sobre: "#ffffff" }[raw.theme] || "#38e0ff"; s.style.accent = acc; s.style.frame = raw.frame || s.style.frame; s.style.ratio = raw.ratio || s.style.ratio; s.style.names = raw.nameStyle || s.style.names; s.style.bg = raw.bg !== false; s.style.groups = raw.showGroups !== false; s.style.tags = !!raw.showTags;
    for (const g of s.groups) { if (g.scale && g.scale !== 100) g.size = Math.round(s.size * g.scale / 100); delete g.scale; } s.v = 4; }
  for (const g of s.groups) { g.shown ||= []; g.size ??= null; g.compact ??= false; g.collapsed ??= false; g.pos ??= null; }
  if ((raw.v || 0) < 7) { s.style.compact = true; for (const k of Object.keys(s.panels || {})) delete s.panels[k].compact; s.v = 7; }   /* 3.2 : compact par défaut, plus sobre */
  if ((raw.v || 0) < 6) { s.style.theme = "glass"; s.style.ratio = "tall"; if ((raw.v || 0) < 5) { s.style.gap = 10; s.style.bg = false; } s.v = 7; }   /* 3.1 : portraits fins en verre, façon Conversation HUD */
  s.merged ||= { size: null, compact: false, collapsed: false, pos: null }; s.style.tags = false; s.panels ||= {}; s.style.subMode ||= "free";
  for (const g of s.groups) if (!s.panels[g.id] && (g.size || g.pos || g.compact || g.collapsed)) s.panels[g.id] = { size: g.size, pos: g.pos, compact: g.compact, collapsed: g.collapsed };   /* 3.0 : réglages du panneau rangés à part (ils survivent quand le groupe se vide) */
  return s;
}
/* verrou par clé (partagé avec les autres modules via globalThis) : lecture et écriture d'un réglage dans la même section critique ;
 * deux modifications rapprochées (ou deux MJ) ne s'écrasent plus (2.4.0) */
const LOCKS = globalThis.__manhwaLocks ||= new Map();
function withLock(key, fn) { const prev = LOCKS.get(key) || Promise.resolve(); const run = prev.then(fn); const tail = run.catch(() => {}); LOCKS.set(key, tail); tail.then(() => { if (LOCKS.get(key) === tail) LOCKS.delete(key); }); return run; }
export async function setScene(patch) { if (!game.user.isGM) return; await withLock(`set:${MOD}.scene`, () => game.settings.set(MOD, "scene", foundry.utils.mergeObject(getScene(), patch, { inplace: false }))); }
export async function updateData(fn) { if (!game.user.isGM) return getData(); return withLock(`set:${MOD}.data`, async () => { const d = getData(); const r = await fn(d); if (r !== false) await setData(d); return d; }); }
export async function updateScene(fn) { if (!game.user.isGM) return getScene(); return withLock(`set:${MOD}.scene`, async () => { const s = getScene(); const r = await fn(s); if (r !== false) await game.settings.set(MOD, "scene", s); return s; }); }

/* panneau d'un groupe (créé si absent) */
export function sceneGroup(scene, groupId, create = false) { let g = scene.groups.find(x => x.id === groupId); if (!g && create) { g = { id: groupId, shown: [], collapsed: false, pos: null, size: null, compact: false }; scene.groups.push(g); } return g; }
export function isShown(scene, actorId) { return scene.groups.some(g => g.shown.includes(actorId)); }
export function prune(s) { s.groups = s.groups.filter(g => g.shown.length); const all = new Set(s.groups.flatMap(g => g.shown)); s.speakers = s.speakers.filter(x => all.has(x)); }

/* fiche d'affichage d'un PNJ : acteur + surcharges + révélations */
export function npcView(actorId, data = getData(), scene = getScene()) {
  const a = game.actors.get(actorId); const o = data.npcs[actorId] || {};
  const revealed = !!o.revealed; const hidePortrait = !!o.hidePortrait;
  const realName = o.alias || a?.name || "PNJ supprimé";
  const img = o.img || a?.img || "icons/svg/mystery-man.svg";
  const tags = (o.tags || []).map(id => data.tags.find(t => t.id === id)).filter(Boolean); const cat = (data.cats || []).find(c => c.id === o.cat) || null;
  const crop = { ...DEFAULT_CROP, ...(o.crop || {}) };
  return { id: actorId, exists: !!a, actor: a, realName, img, revealed, hidePortrait, tags, tagIds: o.tags || [], crop, cat,
    name: (revealed || game.user.isGM) ? realName : UNKNOWN, shown: isShown(scene, actorId), speaker: scene.speakers.includes(actorId) };
}
export function ensureNpc(data, actorId) { data.npcs[actorId] ||= { alias: "", img: "", tags: [], revealed: false, hidePortrait: false, cat: "", crop: { ...DEFAULT_CROP } }; return data.npcs[actorId]; }

export function sortMembers(ids, mode, data, scene = getScene()) {
  const views = ids.map(id => npcView(id, data, scene));
  if (mode === "name") views.sort((a, b) => a.realName.localeCompare(b.realName, "fr"));
  else if (mode === "tag") views.sort((a, b) => ((a.tags[0]?.name || "￿").localeCompare(b.tags[0]?.name || "￿", "fr")) || a.realName.localeCompare(b.realName, "fr"));
  return views;
}

/* ───────── réglages ───────── */
Hooks.once("init", () => {
  game.settings.register(MOD, "data", { scope: "world", config: false, type: Object, default: DEFAULT_DATA });
  game.settings.register(MOD, "scene", { scope: "world", config: false, type: Object, default: DEFAULT_SCENE });
  game.settings.register(MOD, "sound", { name: "Son à la prise de parole", hint: "Chemin d'un fichier audio, joué doucement chez tout le monde quand un orateur change. Vide = aucun son.", scope: "world", config: true, type: String, default: "", filePicker: "audio" });
  game.settings.register(MOD, "soundVolume", { name: "Volume du son", scope: "world", config: true, type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.25 });
  game.settings.register(MOD, "playerScale", { name: "Échelle de la scène (ce poste)", hint: "Multiplie la taille choisie par le MJ sur cet écran uniquement.", scope: "client", config: true, type: Number, range: { min: 0.5, max: 1.5, step: 0.05 }, default: 1, onChange: () => Stage.refresh() });
  game.settings.register(MOD, "personalLayout", { name: "Joueurs : disposition personnelle des panneaux", hint: "Chaque joueur peut déplacer, redimensionner, compacter et replier les panneaux sur son propre écran (bouton ↺ pour revenir à la disposition du MJ).", scope: "world", config: true, type: Boolean, default: true, onChange: () => Stage.refresh() });
  game.keybindings?.register(MOD, "subNext", { name: "Portraits : sous-groupe suivant (panneau choisi)", editable: [{ key: "PageDown" }], onDown: () => Stage.stepFocused(1) });
  game.keybindings?.register(MOD, "subPrev", { name: "Portraits : sous-groupe précédent (panneau choisi)", editable: [{ key: "PageUp" }], onDown: () => Stage.stepFocused(-1) });
  game.settings.register(MOD, "gmClickSpeaker", { name: "MJ : un clic sur un portrait de la scène change l'orateur", scope: "client", config: true, type: Boolean, default: true });
});

Hooks.once("ready", () => {
  Stage.refresh();
  game.modules.get(MOD).api = { open: () => Manager.open(), refresh: () => Stage.refresh(), resetLayout: () => Stage.resetLocal(), getData, getScene };
  Hooks.on("manhwaGmGroups", () => { Stage.refresh(); Manager.instance?.render(); });
});

Hooks.on("updateSetting", (setting) => { if (setting.key === `${MOD}.scene` || setting.key === `${MOD}.data`) { Stage.refresh(); Manager.instance?.render(); } });
Hooks.on("updateActor", (a, changes) => { if ("name" in changes || "img" in changes) { Stage.refresh(); Manager.instance?.render(); } });
Hooks.on("deleteActor", () => { Stage.refresh(); Manager.instance?.render(); });

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;
  const tool = { name: "pnjManhwa", title: "Portrait - Manhwa — portraits à l'écran", icon: "fa-solid fa-people-group", button: true, visible: true, order: 99, onChange: () => Manager.open(), onClick: () => Manager.open() };
  if (Array.isArray(controls)) { const t = controls.find(c => c.name === "token"); t?.tools?.push(tool); }
  else { const t = controls.tokens || controls.token; if (t?.tools) t.tools.pnjManhwa = tool; }
});
