/* =========================================================
   Thumbnail Generator Pro — logique applicative (JS vanilla)
   Aucune dépendance de framework : DOM direct + html2canvas.
   ========================================================= */

const STAGE_W = 1280;
const STAGE_H = 720;
const DRAFT_KEY = "tg-draft-v1";
const PROJECTS_KEY = "tg-projects-v1";

/* ---------------------------------------------------------
   État applicatif
   --------------------------------------------------------- */
let layers = []; // ordre = z-index (index 0 = arrière-plan des objets)
let selectedId = null;
let nextId = 1;
let currentScale = 1;

function defaultBackground() {
  return {
    dataURL: null,
    naturalW: 0,
    naturalH: 0,
    zoom: 100,
    posX: 0,
    posY: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    opacity: 100,
  };
}
function defaultEffects() {
  return {
    vignette: { on: false, intensity: 50 },
    overlay: { on: false, color: "#000000", opacity: 40 },
    gradient: { on: false, direction: "bottom", color: "#000000", opacity: 70 },
  };
}

let background = defaultBackground();
let effects = defaultEffects();

/* ---------------------------------------------------------
   Bibliothèque d'objets graphiques (SVG générés + emoji)
   --------------------------------------------------------- */
const SHAPE_RENDERERS = {
  ring: (color) =>
    `<svg viewBox="0 0 100 100" class="layer-svg"><circle cx="50" cy="50" r="38" fill="none" stroke="${color}" stroke-width="11"/></svg>`,
  target: (color) => `<svg viewBox="0 0 100 100" class="layer-svg">
      <circle cx="50" cy="50" r="44" fill="none" stroke="${color}" stroke-width="6"/>
      <circle cx="50" cy="50" r="27" fill="none" stroke="${color}" stroke-width="6"/>
      <circle cx="50" cy="50" r="6" fill="${color}"/>
      <line x1="50" y1="0" x2="50" y2="13" stroke="${color}" stroke-width="6"/>
      <line x1="50" y1="87" x2="50" y2="100" stroke="${color}" stroke-width="6"/>
      <line x1="0" y1="50" x2="13" y2="50" stroke="${color}" stroke-width="6"/>
      <line x1="87" y1="50" x2="100" y2="50" stroke="${color}" stroke-width="6"/>
    </svg>`,
  circle: (color) =>
    `<svg viewBox="0 0 100 100" class="layer-svg"><circle cx="50" cy="50" r="44" fill="${color}"/></svg>`,
  arrow: (color) =>
    `<svg viewBox="0 0 100 100" class="layer-svg"><polygon points="8,18 52,50 8,82 28,82 72,50 28,18" fill="${color}"/></svg>`,
};

const SHAPE_LIBRARY = [
  { kind: "target", label: "Cible rouge", color: "#e2001a" },
  { kind: "ring", label: "Cercle rouge", color: "#e2001a" },
  { kind: "circle", label: "Rond plein", color: "#e2001a" },
  { kind: "arrow", label: "Flèche rouge", color: "#e2001a" },
  { kind: "arrow", label: "Flèche blanche", color: "#ffffff" },
  { kind: "emoji", label: "Question", emoji: "❓" },
  { kind: "emoji", label: "Exclamation", emoji: "❗" },
  { kind: "emoji", label: "Choqué", emoji: "😱" },
  { kind: "emoji", label: "Colère", emoji: "😡" },
  { kind: "emoji", label: "Feu", emoji: "🔥" },
  { kind: "emoji", label: "Argent", emoji: "💰" },
  { kind: "emoji", label: "Trophée", emoji: "🏆" },
  { kind: "emoji", label: "Ballon", emoji: "⚽" },
  { kind: "emoji", label: "Drapeau", emoji: "🚩" },
  { kind: "emoji", label: "Bateau", emoji: "🚢" },
  { kind: "emoji", label: "Logo/étoile", emoji: "⭐" },
];

const TEMPLATES = [
  {
    id: "breaking",
    name: "Breaking News",
    desc: "Grand texte blanc, fond sombre, accent rouge",
    colors: ["#000000", "#e2001a"],
  },
  {
    id: "mystere",
    name: "Mystère",
    desc: "Fond noir, grande zone vide, curiosité",
    colors: ["#000000", "#222222"],
  },
  {
    id: "foot",
    name: "Football",
    desc: "Sujet détouré, fond stade, flèche rouge",
    colors: ["#0a1533", "#e2001a"],
  },
  {
    id: "argent",
    name: "Argent / Business",
    desc: "Contraste élevé, texte blanc, fond sombre",
    colors: ["#000000", "#2ecc71"],
  },
];

/* ---------------------------------------------------------
   Utilitaires DOM
   --------------------------------------------------------- */
function mk(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function fieldRange(labelText, value, min, max, step, suffix, onInput) {
  const wrap = mk("div");
  const lab = mk("label", "field-label");
  const valSpan = mk("span", "value-tag");
  valSpan.textContent = round2(value) + (suffix || "");
  lab.textContent = labelText + " ";
  lab.appendChild(valSpan);
  const input = mk("input", "form-range");
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step || 1;
  input.value = value;
  input.addEventListener("input", () => {
    valSpan.textContent = round2(parseFloat(input.value)) + (suffix || "");
    onInput(parseFloat(input.value));
  });
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
function fieldColor(labelText, value, onInput) {
  const wrap = mk("div");
  const lab = mk("label", "field-label");
  lab.textContent = labelText;
  const input = mk("input", "form-control form-control-color");
  input.type = "color";
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}
function fieldSelect(labelText, value, options, onInput) {
  const wrap = mk("div");
  const lab = mk("label", "field-label");
  lab.textContent = labelText;
  const sel = mk("select", "form-select form-select-sm");
  options.forEach(([v, l]) => {
    const o = mk("option");
    o.value = v;
    o.textContent = l;
    if (v === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("input", () => onInput(sel.value));
  wrap.appendChild(lab);
  wrap.appendChild(sel);
  return wrap;
}
function fieldText(labelText, value, onInput, multiline) {
  const wrap = mk("div");
  const lab = mk("label", "field-label");
  lab.textContent = labelText;
  const input = mk(multiline ? "textarea" : "input", "form-control");
  if (!multiline) input.type = "text";
  else input.rows = 2;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}
function fieldCheck(labelText, checked, onInput) {
  const wrap = mk("div", "form-check form-switch mt-2");
  const input = mk("input", "form-check-input");
  input.type = "checkbox";
  input.checked = checked;
  const id = "chk" + Math.random().toString(36).slice(2);
  input.id = id;
  input.addEventListener("change", () => onInput(input.checked));
  const lab = mk("label", "form-check-label small");
  lab.textContent = labelText;
  lab.htmlFor = id;
  wrap.appendChild(input);
  wrap.appendChild(lab);
  return wrap;
}
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------------------------------------------------------
   Fichiers / drop zones
   --------------------------------------------------------- */
const fileInputHidden = document.getElementById("fileInputHidden");
let pendingFileCallback = null;
function pickFile(cb) {
  pendingFileCallback = cb;
  fileInputHidden.value = "";
  fileInputHidden.click();
}
fileInputHidden.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file && pendingFileCallback) pendingFileCallback(file);
  pendingFileCallback = null;
});
function wireDropZone(zone, cb) {
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) cb(file);
  });
}

/* ---------------------------------------------------------
   Modèle de calque
   --------------------------------------------------------- */
function makeBaseLayer(type, overrides) {
  return Object.assign(
    {
      id: "L" + nextId++,
      type,
      x: STAGE_W / 2,
      y: STAGE_H / 2,
      width: 400,
      height: 200,
      rotation: 0,
      opacity: 100,
      visible: true,
      locked: false,
      isSubject: false,
      isMainMessage: false,
      shadow: { on: false, color: "#000000", blur: 20, offsetX: 0, offsetY: 8 },
      outline: { on: false, color: "#ffffff", width: 4 },
      glow: { on: false, color: "#ffcc33", blur: 30 },
    },
    overrides,
  );
}

function addTextLayer(content) {
  const layer = makeBaseLayer("text", {
    width: 760,
    height: 150,
    text: {
      content: content || "NOUVEAU TITRE",
      font: "Anton",
      size: 90,
      color: "#ffffff",
      align: "center",
      letterSpacing: 0,
      lineHeight: 1.05,
      uppercase: true,
      stroke: { on: false, color: "#000000", width: 4 },
    },
  });
  layers.push(layer);
  selectLayer(layer.id);
  autosaveDraft();
}

function addImageLayerFromFile(file, opts) {
  opts = opts || {};
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = opts.isSubject ? 520 : 300;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const layer = makeBaseLayer("image", {
        width: w,
        height: h,
        isSubject: !!opts.isSubject,
        image: {
          dataURL: ev.target.result,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0 },
          flipX: false,
        },
      });
      layers.push(layer);
      selectLayer(layer.id);
      autosaveDraft();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function addShapeLayer(def) {
  const size = 160;
  const layer = makeBaseLayer("shape", {
    width: size,
    height: size,
    shape: { kind: def.kind, emoji: def.emoji || null, color: def.color || "#e2001a" },
  });
  layers.push(layer);
  selectLayer(layer.id);
  autosaveDraft();
}

function removeBackgroundStub() {
  alert(
    "Détourage automatique : fonctionnalité prête pour une intégration API (remove.bg, Clipdrop, etc.). " +
      "Aucun appel réseau n'est effectué dans cette version — branchez votre clé API dans removeBackgroundStub() (js/app.js) pour l'activer.",
  );
}

/* ---------------------------------------------------------
   Actions sur les calques
   --------------------------------------------------------- */
function findLayer(id) {
  return layers.find((l) => l.id === id);
}
function selectLayer(id) {
  selectedId = id;
  renderLayers();
  renderSelectionPanel();
  renderLayersList();
}
function deleteLayer(id) {
  layers = layers.filter((l) => l.id !== id);
  if (selectedId === id) selectedId = null;
  renderAll();
  autosaveDraft();
}
function duplicateLayer(id) {
  const l = findLayer(id);
  if (!l) return;
  const copy = JSON.parse(JSON.stringify(l));
  copy.id = "L" + nextId++;
  copy.x += 24;
  copy.y += 24;
  layers.push(copy);
  selectLayer(copy.id);
  autosaveDraft();
}
function bringToFront(id) {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const [l] = layers.splice(idx, 1);
  layers.push(l);
  renderAll();
  autosaveDraft();
}
function sendToBack(id) {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const [l] = layers.splice(idx, 1);
  layers.unshift(l);
  renderAll();
  autosaveDraft();
}
function moveLayerUp(id) {
  const i = layers.findIndex((l) => l.id === id);
  if (i < layers.length - 1) {
    [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]];
    renderAll();
    autosaveDraft();
  }
}
function moveLayerDown(id) {
  const i = layers.findIndex((l) => l.id === id);
  if (i > 0) {
    [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]];
    renderAll();
    autosaveDraft();
  }
}
function toggleVisible(id) {
  const l = findLayer(id);
  if (l) {
    l.visible = !l.visible;
    renderAll();
    autosaveDraft();
  }
}
function toggleLock(id) {
  const l = findLayer(id);
  if (l) {
    l.locked = !l.locked;
    renderLayers();
    renderLayersList();
  }
}

window.addEventListener("keydown", (e) => {
  const tag = (document.activeElement.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;
  if (!selectedId) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    deleteLayer(selectedId);
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
    e.preventDefault();
    duplicateLayer(selectedId);
  }
});

/* ---------------------------------------------------------
   Stage : mise à l'échelle responsive (résolution fixe 1280x720)
   --------------------------------------------------------- */
const stageWrapEl = document.getElementById("stageWrap");
const stageInnerEl = document.getElementById("stageInner");
const mainEl = document.getElementById("main");

function fitStage() {
  const maxW = Math.max(200, mainEl.clientWidth - 24);
  const maxH = Math.max(150, mainEl.clientHeight - 70);
  currentScale = Math.max(0.15, Math.min(maxW / STAGE_W, maxH / STAGE_H, 1));
  stageInnerEl.style.transform = `scale(${currentScale})`;
  stageWrapEl.style.width = STAGE_W * currentScale + "px";
  stageWrapEl.style.height = STAGE_H * currentScale + "px";
}
function getStageFactor() {
  return currentScale;
}
window.addEventListener("resize", fitStage);
new ResizeObserver(fitStage).observe(mainEl);

stageInnerEl.addEventListener("pointerdown", (e) => {
  if (e.target === stageInnerEl || e.target.id === "objectsLayer" || e.target.id === "bgLayer") {
    selectLayer(null);
  }
});

/* ---------------------------------------------------------
   Rendu : fond
   --------------------------------------------------------- */
function renderBackground() {
  const el = document.getElementById("bgLayer");
  if (!background.dataURL || !background._imgEl) {
    el.style.backgroundImage = "";
    el.style.filter = "";
    return;
  }
  const img = background._imgEl;
  const baseScale = Math.max(STAGE_W / img.naturalWidth, STAGE_H / img.naturalHeight);
  const scale = baseScale * (background.zoom / 100);
  const dispW = img.naturalWidth * scale;
  const dispH = img.naturalHeight * scale;
  const ox = (STAGE_W - dispW) / 2 + background.posX;
  const oy = (STAGE_H - dispH) / 2 + background.posY;
  el.style.backgroundImage = `url(${background.dataURL})`;
  el.style.backgroundSize = `${dispW}px ${dispH}px`;
  el.style.backgroundPosition = `${ox}px ${oy}px`;
  el.style.backgroundRepeat = "no-repeat";
  el.style.filter = `brightness(${background.brightness}%) contrast(${background.contrast}%) saturate(${background.saturation}%) blur(${background.blur}px) opacity(${background.opacity}%)`;
}

/* ---------------------------------------------------------
   Rendu : effets globaux
   --------------------------------------------------------- */
function renderEffects() {
  const v = document.getElementById("fxVignette");
  v.style.background = effects.vignette.on
    ? `radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,${effects.vignette.intensity / 100}) 100%)`
    : "none";

  const o = document.getElementById("fxOverlay");
  o.style.background = effects.overlay.on
    ? hexToRgba(effects.overlay.color, effects.overlay.opacity / 100)
    : "none";

  const g = document.getElementById("fxGradient");
  if (effects.gradient.on) {
    const dirMap = { bottom: "to top", top: "to bottom", left: "to right", right: "to left" };
    const dir = dirMap[effects.gradient.direction] || "to top";
    g.style.background = `linear-gradient(${dir}, ${hexToRgba(effects.gradient.color, effects.gradient.opacity / 100)}, transparent)`;
  } else {
    g.style.background = "none";
  }
}

/* ---------------------------------------------------------
   Rendu : calques (texte / image / forme) + interactions
   --------------------------------------------------------- */
function applyLayerEffectsToEl(layer, el) {
  const filters = [];
  if (layer.outline && layer.outline.on) {
    const w = layer.outline.width;
    const c = layer.outline.color;
    filters.push(
      `drop-shadow(${w}px 0 0 ${c})`,
      `drop-shadow(${-w}px 0 0 ${c})`,
      `drop-shadow(0 ${w}px 0 ${c})`,
      `drop-shadow(0 ${-w}px 0 ${c})`,
    );
  }
  if (layer.glow && layer.glow.on) {
    filters.push(
      `drop-shadow(0 0 ${layer.glow.blur}px ${layer.glow.color})`,
      `drop-shadow(0 0 ${layer.glow.blur * 0.5}px ${layer.glow.color})`,
    );
  }
  if (layer.shadow && layer.shadow.on) {
    filters.push(
      `drop-shadow(${layer.shadow.offsetX}px ${layer.shadow.offsetY}px ${layer.shadow.blur}px ${layer.shadow.color})`,
    );
  }
  el.style.filter = filters.join(" ");
}

function buildHandle(pos) {
  const h = mk("div", "handle " + (pos === "rotate" ? "rotate" : "corner-" + pos));
  h.dataset.handle = pos;
  return h;
}
function buildMiniToolbar(layer) {
  const bar = mk("div", "mini-toolbar");
  bar.innerHTML = `
    <button data-act="dup" title="Dupliquer"><i class="bi bi-copy"></i></button>
    <button data-act="front" title="Devant"><i class="bi bi-bring-forward"></i></button>
    <button data-act="back" title="Derrière"><i class="bi bi-send-backward"></i></button>
    <button data-act="del" title="Supprimer"><i class="bi bi-trash"></i></button>
  `;
  bar.querySelectorAll("button").forEach((b) => {
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const act = b.dataset.act;
      if (act === "dup") duplicateLayer(layer.id);
      if (act === "front") bringToFront(layer.id);
      if (act === "back") sendToBack(layer.id);
      if (act === "del") deleteLayer(layer.id);
    });
  });
  return bar;
}

function buildLayerContentDom(layer) {
  const content = mk("div", "layer-content");
  applyLayerEffectsToEl(layer, content);

  if (layer.type === "text") {
    const t = layer.text;
    const div = mk("div", "layer-text");
    div.textContent = t.uppercase ? t.content.toUpperCase() : t.content;
    div.style.fontFamily = `'${t.font}', Arial, sans-serif`;
    div.style.fontSize = t.size + "px";
    div.style.fontWeight = "900";
    div.style.color = t.color;
    div.style.textAlign = t.align;
    div.style.letterSpacing = t.letterSpacing + "px";
    div.style.lineHeight = t.lineHeight;
    if (t.stroke && t.stroke.on) {
      div.style.webkitTextStroke = `${t.stroke.width}px ${t.stroke.color}`;
    }
    content.appendChild(div);
  } else if (layer.type === "image") {
    const img = mk("img", "layer-img");
    img.src = layer.image.dataURL;
    img.draggable = false;
    const f = layer.image.filters;
    img.style.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) blur(${f.blur}px)`;
    if (layer.image.flipX) img.style.transform = "scaleX(-1)";
    content.appendChild(img);
  } else if (layer.type === "shape") {
    if (layer.shape.kind === "emoji") {
      const d = mk("div", "layer-emoji");
      d.style.fontSize = Math.min(layer.width, layer.height) * 0.85 + "px";
      d.textContent = layer.shape.emoji;
      content.appendChild(d);
    } else {
      content.innerHTML += SHAPE_RENDERERS[layer.shape.kind](layer.shape.color);
    }
  }
  return content;
}

function renderLayers() {
  const container = document.getElementById("objectsLayer");
  container.innerHTML = "";
  layers.forEach((layer, idx) => {
    if (!layer.visible) return;
    const el = mk(
      "div",
      "tg-layer" + (layer.id === selectedId ? " selected" : "") + (layer.locked ? " locked" : ""),
    );
    el.dataset.id = layer.id;
    el.style.left = layer.x - layer.width / 2 + "px";
    el.style.top = layer.y - layer.height / 2 + "px";
    el.style.width = layer.width + "px";
    el.style.height = layer.height + "px";
    el.style.transform = `rotate(${layer.rotation}deg)`;
    el.style.opacity = layer.opacity / 100;
    el.style.zIndex = idx + 1;

    const content = buildLayerContentDom(layer);
    el.appendChild(content);

    if (layer.id === selectedId && !layer.locked) {
      el.appendChild(buildMiniToolbar(layer));
      const stick = mk("div", "rotate-stick");
      el.appendChild(stick);
      el.appendChild(buildHandle("rotate"));
      ["tl", "tr", "bl", "br"].forEach((p) => el.appendChild(buildHandle(p)));
    }

    wireLayerPointerEvents(el, layer);
    container.appendChild(el);
  });
}

function wireLayerPointerEvents(el, layer) {
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".handle") || e.target.closest(".mini-toolbar")) return;
    e.stopPropagation();
    selectLayer(layer.id);
    if (layer.locked) return;
    startMove(e, layer, el);
  });
  el.querySelectorAll(".handle").forEach((h) => {
    h.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const type = h.dataset.handle;
      if (type === "rotate") startRotate(layer);
      else startResize(layer, type);
    });
  });
}

function startMove(e, layer, el) {
  el.classList.add("dragging");
  const startX = e.clientX;
  const startY = e.clientY;
  const origX = layer.x;
  const origY = layer.y;
  function onMove(ev) {
    const factor = getStageFactor();
    layer.x = origX + (ev.clientX - startX) / factor;
    layer.y = origY + (ev.clientY - startY) / factor;
    renderLayers();
  }
  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    autosaveDraft();
  }
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function startResize(layer, handlePos) {
  const hx = handlePos.includes("r") ? 1 : -1;
  const hy = handlePos.includes("b") ? 1 : -1;
  const rad = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const width0 = layer.width;
  const height0 = layer.height;
  const fontSize0 = layer.type === "text" ? layer.text.size : null;
  const fixedLocal = { x: -hx * (width0 / 2), y: -hy * (height0 / 2) };
  const fixedWorld = {
    x: layer.x + (fixedLocal.x * cos - fixedLocal.y * sin),
    y: layer.y + (fixedLocal.x * sin + fixedLocal.y * cos),
  };

  function onMove(ev) {
    const factor = getStageFactor();
    const rect = stageInnerEl.getBoundingClientRect();
    const pointer = {
      x: (ev.clientX - rect.left) / factor,
      y: (ev.clientY - rect.top) / factor,
    };
    const rel = { x: pointer.x - fixedWorld.x, y: pointer.y - fixedWorld.y };
    const localX = rel.x * cos + rel.y * sin;
    const localY = -rel.x * sin + rel.y * cos;
    const rawW = Math.max(10, hx * localX);
    const rawH = Math.max(10, hy * localY);
    const scaleFactor = Math.max(rawW / width0, rawH / height0, 0.05);
    const newW = width0 * scaleFactor;
    const newH = height0 * scaleFactor;
    const newCenterLocal = { x: hx * (newW / 2), y: hy * (newH / 2) };
    layer.x = fixedWorld.x + (newCenterLocal.x * cos - newCenterLocal.y * sin);
    layer.y = fixedWorld.y + (newCenterLocal.x * sin + newCenterLocal.y * cos);
    layer.width = newW;
    layer.height = newH;
    if (fontSize0) layer.text.size = Math.max(6, fontSize0 * scaleFactor);
    renderLayers();
  }
  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    autosaveDraft();
    renderSelectionPanel();
  }
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function startRotate(layer) {
  function onMove(ev) {
    const factor = getStageFactor();
    const rect = stageInnerEl.getBoundingClientRect();
    const centerScreen = {
      x: rect.left + layer.x * factor,
      y: rect.top + layer.y * factor,
    };
    const angle = (Math.atan2(ev.clientY - centerScreen.y, ev.clientX - centerScreen.x) * 180) / Math.PI + 90;
    layer.rotation = Math.round(angle);
    renderLayers();
  }
  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    autosaveDraft();
    renderSelectionPanel();
  }
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/* ---------------------------------------------------------
   Panneau de sélection (contextuel)
   --------------------------------------------------------- */
function layerTypeLabel(layer) {
  if (layer.type === "text") return "📝 Texte";
  if (layer.type === "image") return layer.isSubject ? "🧍 Sujet principal" : "🖼 Image";
  if (layer.type === "shape") return "✨ Objet";
  return "Calque";
}

function renderSelectionPanel() {
  const body = document.getElementById("selectionBody");
  body.innerHTML = "";
  const layer = findLayer(selectedId);
  if (!layer) {
    body.innerHTML =
      '<p class="hint">Cliquez un élément dans l\'aperçu (ou dans les calques) pour modifier ses propriétés ici.</p>';
    return;
  }

  const head = mk("div");
  head.style.cssText = "font-size:12.5px;font-weight:700;margin-bottom:6px;";
  head.textContent = layerTypeLabel(layer);
  body.appendChild(head);

  const actGrid = mk("div", "btn-group-vert");
  actGrid.innerHTML = `
    <button class="btn btn-tool btn-sm" data-act="dup"><i class="bi bi-copy"></i> Dupliquer</button>
    <button class="btn btn-tool btn-sm" data-act="del"><i class="bi bi-trash"></i> Supprimer</button>
    <button class="btn btn-tool btn-sm" data-act="front"><i class="bi bi-bring-forward"></i> Devant</button>
    <button class="btn btn-tool btn-sm" data-act="back"><i class="bi bi-send-backward"></i> Derrière</button>
  `;
  actGrid.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      const act = b.dataset.act;
      if (act === "dup") duplicateLayer(layer.id);
      if (act === "del") deleteLayer(layer.id);
      if (act === "front") bringToFront(layer.id);
      if (act === "back") sendToBack(layer.id);
    });
  });
  body.appendChild(actGrid);

  body.appendChild(
    fieldRange("Opacité", layer.opacity, 0, 100, 1, "%", (v) => {
      layer.opacity = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldRange("Rotation", Math.round(layer.rotation), 0, 360, 1, "°", (v) => {
      layer.rotation = v;
      renderLayers();
      autosaveDraft();
    }),
  );

  if (layer.type === "text") body.appendChild(buildTextProps(layer));
  if (layer.type === "image") body.appendChild(buildImageProps(layer));
  if (layer.type === "shape") body.appendChild(buildShapeProps(layer));

  body.appendChild(buildEffectsProps(layer));
}

function buildTextProps(layer) {
  const wrap = mk("div");
  wrap.appendChild(mk("hr"));
  wrap.appendChild(
    fieldText(
      "Contenu (plusieurs lignes possibles)",
      layer.text.content,
      (v) => {
        layer.text.content = v;
        renderLayers();
        renderLayersList();
        autosaveDraft();
      },
      true,
    ),
  );

  const rowFont = mk("div", "row-2");
  rowFont.appendChild(
    fieldSelect(
      "Police",
      layer.text.font,
      [
        ["Anton", "Anton"],
        ["Archivo Black", "Archivo Black"],
        ["Oswald", "Oswald"],
        ["Bebas Neue", "Bebas Neue"],
        ["Arial Black", "Arial Black"],
      ],
      (v) => {
        layer.text.font = v;
        renderLayers();
        autosaveDraft();
      },
    ),
  );
  rowFont.appendChild(
    fieldSelect(
      "Alignement",
      layer.text.align,
      [
        ["left", "Gauche"],
        ["center", "Centré"],
        ["right", "Droite"],
      ],
      (v) => {
        layer.text.align = v;
        renderLayers();
        autosaveDraft();
      },
    ),
  );
  wrap.appendChild(rowFont);

  wrap.appendChild(
    fieldRange("Taille", Math.round(layer.text.size), 8, 300, 1, "px", (v) => {
      layer.text.size = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  wrap.appendChild(
    fieldRange("Espacement des lettres", layer.text.letterSpacing, -10, 60, 1, "px", (v) => {
      layer.text.letterSpacing = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  wrap.appendChild(
    fieldRange("Hauteur de ligne", layer.text.lineHeight, 0.7, 2, 0.05, "", (v) => {
      layer.text.lineHeight = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  wrap.appendChild(
    fieldColor("Couleur du texte", layer.text.color, (v) => {
      layer.text.color = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  wrap.appendChild(
    fieldCheck("MAJUSCULES automatiques", layer.text.uppercase, (v) => {
      layer.text.uppercase = v;
      renderLayers();
      autosaveDraft();
    }),
  );

  wrap.appendChild(mk("hr"));
  wrap.appendChild(
    fieldCheck("Contour du texte", layer.text.stroke.on, (v) => {
      layer.text.stroke.on = v;
      renderLayers();
      autosaveDraft();
      renderSelectionPanel();
    }),
  );
  if (layer.text.stroke.on) {
    const row = mk("div", "row-2");
    row.appendChild(
      fieldColor("Couleur contour", layer.text.stroke.color, (v) => {
        layer.text.stroke.color = v;
        renderLayers();
        autosaveDraft();
      }),
    );
    row.appendChild(
      fieldRange("Épaisseur", layer.text.stroke.width, 0, 20, 1, "px", (v) => {
        layer.text.stroke.width = v;
        renderLayers();
        autosaveDraft();
      }),
    );
    wrap.appendChild(row);
  }
  return wrap;
}

function buildImageProps(layer) {
  const wrap = mk("div");
  wrap.appendChild(mk("hr"));
  const f = layer.image.filters;
  wrap.appendChild(
    fieldRange("Luminosité", f.brightness, 0, 200, 1, "%", (v) => {
      f.brightness = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  wrap.appendChild(
    fieldRange("Contraste", f.contrast, 0, 200, 1, "%", (v) => {
      f.contrast = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  wrap.appendChild(
    fieldRange("Saturation", f.saturation, 0, 200, 1, "%", (v) => {
      f.saturation = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  wrap.appendChild(
    fieldRange("Flou", f.blur, 0, 20, 1, "px", (v) => {
      f.blur = v;
      renderLayers();
      autosaveDraft();
    }),
  );
  wrap.appendChild(
    fieldCheck("Miroir horizontal", layer.image.flipX, (v) => {
      layer.image.flipX = v;
      renderLayers();
      autosaveDraft();
    }),
  );

  if (layer.isSubject) {
    wrap.appendChild(mk("hr"));
    const btn = mk("button", "btn btn-tool w-100");
    btn.innerHTML = '<i class="bi bi-magic"></i> Supprimer l\'arrière-plan (bêta)';
    btn.addEventListener("click", removeBackgroundStub);
    wrap.appendChild(btn);
    const hint = mk("p", "hint");
    hint.textContent =
      "Nécessite un service externe (remove.bg, Clipdrop…) pour un vrai détourage. Le bouton est prêt à être branché à une API — aucune requête n'est envoyée pour l'instant.";
    wrap.appendChild(hint);
  }
  return wrap;
}

function buildShapeProps(layer) {
  const wrap = mk("div");
  wrap.appendChild(mk("hr"));
  if (layer.shape.kind !== "emoji") {
    wrap.appendChild(
      fieldColor("Couleur", layer.shape.color, (v) => {
        layer.shape.color = v;
        renderLayers();
        autosaveDraft();
      }),
    );
  } else {
    wrap.appendChild(
      fieldText("Emoji / caractère", layer.shape.emoji, (v) => {
        layer.shape.emoji = v;
        renderLayers();
        autosaveDraft();
      }),
    );
  }
  return wrap;
}

function buildEffectsProps(layer) {
  const wrap = mk("div");
  wrap.appendChild(mk("hr"));
  const title = mk("label", "field-label");
  title.textContent = "Effets";
  wrap.appendChild(title);

  wrap.appendChild(
    fieldCheck("Ombre portée", layer.shadow.on, (v) => {
      layer.shadow.on = v;
      renderLayers();
      autosaveDraft();
      renderSelectionPanel();
    }),
  );
  if (layer.shadow.on) {
    wrap.appendChild(
      fieldColor("Couleur ombre", layer.shadow.color, (v) => {
        layer.shadow.color = v;
        renderLayers();
        autosaveDraft();
      }),
    );
    wrap.appendChild(
      fieldRange("Flou", layer.shadow.blur, 0, 60, 1, "px", (v) => {
        layer.shadow.blur = v;
        renderLayers();
        autosaveDraft();
      }),
    );
    const row = mk("div", "row-2");
    row.appendChild(
      fieldRange("Décalage X", layer.shadow.offsetX, -40, 40, 1, "px", (v) => {
        layer.shadow.offsetX = v;
        renderLayers();
        autosaveDraft();
      }),
    );
    row.appendChild(
      fieldRange("Décalage Y", layer.shadow.offsetY, -40, 40, 1, "px", (v) => {
        layer.shadow.offsetY = v;
        renderLayers();
        autosaveDraft();
      }),
    );
    wrap.appendChild(row);
  }

  wrap.appendChild(
    fieldCheck("Contour lumineux", layer.outline.on, (v) => {
      layer.outline.on = v;
      renderLayers();
      autosaveDraft();
      renderSelectionPanel();
    }),
  );
  if (layer.outline.on) {
    wrap.appendChild(
      fieldColor("Couleur contour", layer.outline.color, (v) => {
        layer.outline.color = v;
        renderLayers();
        autosaveDraft();
      }),
    );
    wrap.appendChild(
      fieldRange("Épaisseur", layer.outline.width, 1, 20, 1, "px", (v) => {
        layer.outline.width = v;
        renderLayers();
        autosaveDraft();
      }),
    );
  }

  wrap.appendChild(
    fieldCheck("Glow (lueur)", layer.glow.on, (v) => {
      layer.glow.on = v;
      renderLayers();
      autosaveDraft();
      renderSelectionPanel();
    }),
  );
  if (layer.glow.on) {
    wrap.appendChild(
      fieldColor("Couleur glow", layer.glow.color, (v) => {
        layer.glow.color = v;
        renderLayers();
        autosaveDraft();
      }),
    );
    wrap.appendChild(
      fieldRange("Intensité", layer.glow.blur, 0, 80, 1, "px", (v) => {
        layer.glow.blur = v;
        renderLayers();
        autosaveDraft();
      }),
    );
  }
  return wrap;
}

/* ---------------------------------------------------------
   Panneau Fond
   --------------------------------------------------------- */
function buildFondPanel() {
  const body = document.getElementById("fondBody");
  body.innerHTML = "";

  const drop = mk("div", "file-drop");
  drop.innerHTML = '<i class="bi bi-cloud-upload"></i><br>Cliquer ou glisser une image de fond';
  drop.addEventListener("click", () => pickFile((file) => setBackgroundFile(file)));
  wireDropZone(drop, (file) => setBackgroundFile(file));
  body.appendChild(drop);

  const clearBtn = mk("button", "btn btn-tool w-100 mt-2");
  clearBtn.innerHTML = '<i class="bi bi-x-circle"></i> Retirer l\'image de fond';
  clearBtn.addEventListener("click", () => {
    background.dataURL = null;
    background._imgEl = null;
    renderBackground();
    autosaveDraft();
  });
  body.appendChild(clearBtn);

  body.appendChild(
    fieldRange("Zoom", background.zoom, 100, 300, 1, "%", (v) => {
      background.zoom = v;
      renderBackground();
      autosaveDraft();
    }),
  );
  const rowPos = mk("div", "row-2");
  rowPos.appendChild(
    fieldRange("Position X", background.posX, -400, 400, 1, "", (v) => {
      background.posX = v;
      renderBackground();
      autosaveDraft();
    }),
  );
  rowPos.appendChild(
    fieldRange("Position Y", background.posY, -400, 400, 1, "", (v) => {
      background.posY = v;
      renderBackground();
      autosaveDraft();
    }),
  );
  body.appendChild(rowPos);

  body.appendChild(mk("hr"));
  body.appendChild(
    fieldRange("Luminosité", background.brightness, 0, 200, 1, "%", (v) => {
      background.brightness = v;
      renderBackground();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldRange("Contraste", background.contrast, 0, 200, 1, "%", (v) => {
      background.contrast = v;
      renderBackground();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldRange("Saturation", background.saturation, 0, 200, 1, "%", (v) => {
      background.saturation = v;
      renderBackground();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldRange("Flou", background.blur, 0, 20, 1, "px", (v) => {
      background.blur = v;
      renderBackground();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldRange("Opacité", background.opacity, 0, 100, 1, "%", (v) => {
      background.opacity = v;
      renderBackground();
      autosaveDraft();
    }),
  );
}

function setBackgroundFile(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      background.dataURL = ev.target.result;
      background._imgEl = img;
      background.naturalW = img.naturalWidth;
      background.naturalH = img.naturalHeight;
      background.zoom = 100;
      background.posX = 0;
      background.posY = 0;
      buildFondPanel();
      renderBackground();
      autosaveDraft();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* ---------------------------------------------------------
   Panneau Sujet & Objets
   --------------------------------------------------------- */
function buildObjetsPanel() {
  const body = document.getElementById("objetsBody");
  body.innerHTML = "";

  const subjBtn = mk("button", "btn btn-tool w-100");
  subjBtn.innerHTML = '<i class="bi bi-person-add"></i> Ajouter le sujet principal';
  subjBtn.addEventListener("click", () => pickFile((file) => addImageLayerFromFile(file, { isSubject: true })));
  body.appendChild(subjBtn);

  const objBtn = mk("button", "btn btn-tool w-100 mt-2");
  objBtn.innerHTML = '<i class="bi bi-image-alt"></i> Ajouter une image / objet';
  objBtn.addEventListener("click", () => pickFile((file) => addImageLayerFromFile(file, { isSubject: false })));
  body.appendChild(objBtn);

  const dropZone = mk("div", "file-drop mt-2");
  dropZone.textContent = "ou glissez une image ici";
  wireDropZone(dropZone, (file) => addImageLayerFromFile(file, { isSubject: false }));
  body.appendChild(dropZone);

  body.appendChild(mk("hr"));
  const libLabel = mk("label", "field-label");
  libLabel.textContent = "Bibliothèque d'éléments";
  body.appendChild(libLabel);

  const grid = mk("div", "lib-grid");
  SHAPE_LIBRARY.forEach((def) => {
    const item = mk("div", "lib-item");
    item.title = def.label;
    if (def.kind === "emoji") item.textContent = def.emoji;
    else item.innerHTML = SHAPE_RENDERERS[def.kind](def.color);
    item.addEventListener("click", () => addShapeLayer(def));
    grid.appendChild(item);
  });
  body.appendChild(grid);
}

/* ---------------------------------------------------------
   Panneau Effets globaux
   --------------------------------------------------------- */
function buildEffetsPanel() {
  const body = document.getElementById("effetsBody");
  body.innerHTML = "";

  const l1 = mk("label", "field-label");
  l1.textContent = "Vignette sombre";
  body.appendChild(l1);
  body.appendChild(
    fieldCheck("Activer", effects.vignette.on, (v) => {
      effects.vignette.on = v;
      renderEffects();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldRange("Intensité", effects.vignette.intensity, 0, 100, 1, "%", (v) => {
      effects.vignette.intensity = v;
      renderEffects();
      autosaveDraft();
    }),
  );

  body.appendChild(mk("hr"));
  const l2 = mk("label", "field-label");
  l2.textContent = "Overlay sombre";
  body.appendChild(l2);
  body.appendChild(
    fieldCheck("Activer", effects.overlay.on, (v) => {
      effects.overlay.on = v;
      renderEffects();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldColor("Couleur", effects.overlay.color, (v) => {
      effects.overlay.color = v;
      renderEffects();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldRange("Opacité", effects.overlay.opacity, 0, 100, 1, "%", (v) => {
      effects.overlay.opacity = v;
      renderEffects();
      autosaveDraft();
    }),
  );

  body.appendChild(mk("hr"));
  const l3 = mk("label", "field-label");
  l3.textContent = "Dégradé";
  body.appendChild(l3);
  body.appendChild(
    fieldCheck("Activer", effects.gradient.on, (v) => {
      effects.gradient.on = v;
      renderEffects();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldSelect(
      "Côté sombre",
      effects.gradient.direction,
      [
        ["bottom", "Sombre en bas"],
        ["top", "Sombre en haut"],
        ["left", "Sombre à gauche"],
        ["right", "Sombre à droite"],
      ],
      (v) => {
        effects.gradient.direction = v;
        renderEffects();
        autosaveDraft();
      },
    ),
  );
  body.appendChild(
    fieldColor("Couleur", effects.gradient.color, (v) => {
      effects.gradient.color = v;
      renderEffects();
      autosaveDraft();
    }),
  );
  body.appendChild(
    fieldRange("Opacité", effects.gradient.opacity, 0, 100, 1, "%", (v) => {
      effects.gradient.opacity = v;
      renderEffects();
      autosaveDraft();
    }),
  );
}

/* ---------------------------------------------------------
   Panneau Calques
   --------------------------------------------------------- */
function layerIcon(layer) {
  if (layer.type === "text") return "📝";
  if (layer.type === "image") return layer.isSubject ? "🧍" : "🖼";
  if (layer.type === "shape") return "✨";
  return "◆";
}
function layerName(layer) {
  if (layer.type === "text") return (layer.text.content || "Texte").slice(0, 22);
  if (layer.type === "image") return layer.isSubject ? "Sujet principal" : "Image";
  if (layer.type === "shape")
    return layer.shape.kind === "emoji" ? "Objet " + layer.shape.emoji : "Objet " + layer.shape.kind;
  return "Calque";
}
function renderLayersList() {
  const listEl = document.getElementById("layersList");
  const emptyHint = document.getElementById("layersEmptyHint");
  const badge = document.getElementById("layerCountBadge");
  badge.textContent = layers.length;
  listEl.innerHTML = "";
  emptyHint.style.display = layers.length ? "none" : "block";

  layers
    .slice()
    .reverse()
    .forEach((layer) => {
      const row = mk(
        "div",
        "layer-row" + (layer.id === selectedId ? " active" : "") + (!layer.visible ? " hidden-layer" : ""),
      );
      row.innerHTML = `
      <span class="icon">${layerIcon(layer)}</span>
      <span class="name">${layerName(layer)}</span>
      <button class="mini-btn" data-act="vis" title="Afficher/Masquer"><i class="bi bi-${layer.visible ? "eye" : "eye-slash"}"></i></button>
      <button class="mini-btn" data-act="lock" title="Verrouiller"><i class="bi bi-${layer.locked ? "lock-fill" : "unlock"}"></i></button>
      <button class="mini-btn" data-act="up" title="Monter"><i class="bi bi-arrow-up"></i></button>
      <button class="mini-btn" data-act="down" title="Descendre"><i class="bi bi-arrow-down"></i></button>
      <button class="mini-btn" data-act="del" title="Supprimer"><i class="bi bi-trash"></i></button>
    `;
      row.addEventListener("click", (e) => {
        if (e.target.closest(".mini-btn")) return;
        selectLayer(layer.id);
      });
      row.querySelector('[data-act="vis"]').addEventListener("click", (e) => {
        e.stopPropagation();
        toggleVisible(layer.id);
      });
      row.querySelector('[data-act="lock"]').addEventListener("click", (e) => {
        e.stopPropagation();
        toggleLock(layer.id);
        renderLayersList();
      });
      row.querySelector('[data-act="up"]').addEventListener("click", (e) => {
        e.stopPropagation();
        moveLayerUp(layer.id);
      });
      row.querySelector('[data-act="down"]').addEventListener("click", (e) => {
        e.stopPropagation();
        moveLayerDown(layer.id);
      });
      row.querySelector('[data-act="del"]').addEventListener("click", (e) => {
        e.stopPropagation();
        deleteLayer(layer.id);
      });
      listEl.appendChild(row);
    });
}

/* ---------------------------------------------------------
   Panneau Modèles
   --------------------------------------------------------- */
function buildTemplatesPanel() {
  const body = document.getElementById("templatesBody");
  body.innerHTML = "";
  TEMPLATES.forEach((t) => {
    const card = mk("div", "tpl-card");
    card.innerHTML = `
      <div class="tpl-swatch"><div style="background:${t.colors[0]}"></div><div style="background:${t.colors[1]}"></div></div>
      <div><div class="tpl-name">${t.name}</div><div class="tpl-desc">${t.desc}</div></div>
    `;
    card.addEventListener("click", () => loadTemplate(t.id));
    body.appendChild(card);
  });
}

function loadTemplate(id) {
  if (layers.length && !confirm("Remplacer le contenu actuel par ce modèle ?")) return;
  layers = [];
  selectedId = null;
  background = defaultBackground();
  effects = defaultEffects();

  if (id === "breaking") {
    background.brightness = 55;
    background.saturation = 110;
    effects.overlay = { on: true, color: "#000000", opacity: 35 };
    effects.vignette = { on: true, intensity: 45 };
    layers.push(
      makeBaseLayer("text", {
        x: 640,
        y: 340,
        width: 1100,
        height: 220,
        text: {
          content: "DERNIÈRE MINUTE",
          font: "Anton",
          size: 110,
          color: "#ffffff",
          align: "center",
          letterSpacing: 2,
          lineHeight: 1,
          uppercase: true,
          stroke: { on: false, color: "#000000", width: 4 },
        },
        shadow: { on: true, color: "#000000", blur: 20, offsetX: 0, offsetY: 6 },
      }),
    );
    layers.push(
      makeBaseLayer("shape", {
        x: 1080,
        y: 560,
        width: 150,
        height: 150,
        shape: { kind: "target", color: "#e2001a" },
      }),
    );
  } else if (id === "mystere") {
    background.brightness = 35;
    layers.push(
      makeBaseLayer("text", {
        x: 640,
        y: 600,
        width: 900,
        height: 200,
        text: {
          content: "EUH...",
          font: "Anton",
          size: 140,
          color: "#ffffff",
          align: "center",
          letterSpacing: 4,
          lineHeight: 1,
          uppercase: true,
          stroke: { on: false, color: "#000000", width: 4 },
        },
      }),
    );
  } else if (id === "foot") {
    background.brightness = 70;
    background.saturation = 120;
    layers.push(
      makeBaseLayer("text", {
        x: 640,
        y: 120,
        width: 1150,
        height: 180,
        text: {
          content: "IL A TOUT CHANGÉ",
          font: "Anton",
          size: 92,
          color: "#ffffff",
          align: "center",
          letterSpacing: 1,
          lineHeight: 1,
          uppercase: true,
          stroke: { on: true, color: "#000000", width: 3 },
        },
      }),
    );
    layers.push(
      makeBaseLayer("shape", {
        x: 1120,
        y: 420,
        width: 160,
        height: 160,
        shape: { kind: "arrow", color: "#e2001a" },
      }),
    );
  } else if (id === "argent") {
    background.brightness = 45;
    background.contrast = 115;
    layers.push(
      makeBaseLayer("text", {
        x: 640,
        y: 150,
        width: 1150,
        height: 180,
        text: {
          content: "IL A TOUT PRIS",
          font: "Anton",
          size: 100,
          color: "#ffffff",
          align: "center",
          letterSpacing: 1,
          lineHeight: 1,
          uppercase: true,
          stroke: { on: false, color: "#000000", width: 4 },
        },
      }),
    );
    layers.push(
      makeBaseLayer("shape", {
        x: 980,
        y: 560,
        width: 180,
        height: 180,
        shape: { kind: "emoji", emoji: "💰" },
      }),
    );
  }

  buildFondPanel();
  buildEffetsPanel();
  renderAll();
  autosaveDraft();
}

/* ---------------------------------------------------------
   Rendu global
   --------------------------------------------------------- */
function renderAll() {
  renderBackground();
  renderEffects();
  renderLayers();
  renderSelectionPanel();
  renderLayersList();
}

/* ---------------------------------------------------------
   Persistance (localStorage)
   --------------------------------------------------------- */
function serializeState() {
  return {
    name: document.getElementById("projectName").value,
    layers: JSON.parse(JSON.stringify(layers)),
    background: (() => {
      const b = Object.assign({}, background);
      delete b._imgEl;
      return b;
    })(),
    effects: JSON.parse(JSON.stringify(effects)),
  };
}

function applyState(state) {
  layers = state.layers || [];
  nextId =
    1 +
    layers.reduce((m, l) => Math.max(m, parseInt((l.id || "L0").slice(1), 10) || 0), 0);
  background = Object.assign(defaultBackground(), state.background || {});
  background._imgEl = null;
  if (background.dataURL) {
    const img = new Image();
    img.onload = () => {
      background._imgEl = img;
      renderBackground();
    };
    img.src = background.dataURL;
  }
  effects = Object.assign(defaultEffects(), state.effects || {});
  selectedId = null;
  document.getElementById("projectName").value = state.name || "Mon projet";
  buildFondPanel();
  buildEffetsPanel();
  renderAll();
  if (typeof refreshMessageWarning === "function") refreshMessageWarning();
}

function autosaveDraft() {
  clearTimeout(autosaveDraft._t);
  autosaveDraft._t = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializeState()));
    } catch (e) {
      /* stockage indisponible ou plein : on ignore silencieusement */
    }
  }, 500);
}

function loadDraftIfAny() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    applyState(JSON.parse(raw));
    return true;
  } catch (e) {
    return false;
  }
}

function listNamedProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveNamedProject() {
  const name = document.getElementById("projectName").value.trim() || "Sans titre";
  const all = listNamedProjects();
  all[name] = serializeState();
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(all));
    alert('Projet "' + name + '" sauvegardé.');
  } catch (e) {
    alert("Impossible de sauvegarder (stockage plein ou indisponible).");
  }
}

function openLoadModal() {
  const body = document.getElementById("loadModalBody");
  const all = listNamedProjects();
  const names = Object.keys(all);
  body.innerHTML = "";
  if (!names.length) {
    body.innerHTML = '<p class="hint">Aucun projet sauvegardé pour le moment.</p>';
    return;
  }
  names.forEach((name) => {
    const row = mk("div", "d-flex align-items-center justify-content-between mb-2 p-2");
    row.style.background = "var(--panel-2)";
    row.style.borderRadius = "6px";
    const span = mk("span");
    span.textContent = name;
    row.appendChild(span);
    const btns = mk("div", "btn-group btn-group-sm");
    const loadBtn = mk("button", "btn btn-tool");
    loadBtn.textContent = "Charger";
    const delBtn = mk("button", "btn btn-tool");
    delBtn.innerHTML = '<i class="bi bi-trash"></i>';
    loadBtn.addEventListener("click", () => {
      applyState(all[name]);
      autosaveDraft();
      bootstrap.Modal.getInstance(document.getElementById("loadModal")).hide();
    });
    delBtn.addEventListener("click", () => {
      if (!confirm('Supprimer le projet "' + name + '" ?')) return;
      delete all[name];
      try {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(all));
      } catch (e) {}
      openLoadModal();
    });
    btns.appendChild(loadBtn);
    btns.appendChild(delBtn);
    row.appendChild(btns);
    body.appendChild(row);
  });
}

function newProject() {
  if (layers.length && !confirm("Créer un nouveau projet vierge ? Le travail non sauvegardé sera perdu.")) return;
  layers = [];
  selectedId = null;
  background = defaultBackground();
  effects = defaultEffects();
  document.getElementById("projectName").value = "Mon projet";
  buildFondPanel();
  buildEffetsPanel();
  renderAll();
  autosaveDraft();
}
function resetProject() {
  if (!confirm("Réinitialiser entièrement le canevas actuel ?")) return;
  layers = [];
  selectedId = null;
  background = defaultBackground();
  effects = defaultEffects();
  buildFondPanel();
  buildEffetsPanel();
  renderAll();
  autosaveDraft();
}

/* ---------------------------------------------------------
   Export PNG / JPG — rendu natif <canvas> (PAS html2canvas pour la
   composition finale : html2canvas ignore silencieusement la propriété
   CSS "filter", donc glow / ombre / contour / luminosité-contraste-
   saturation-flou n'apparaissaient jamais dans les fichiers exportés
   même s'ils s'affichaient très bien à l'écran. Le canvas natif
   supporte "filter" nativement, donc on compose nous-mêmes :
   - fond et filtres image : dessinés directement avec ctx.filter
   - texte / formes : toujours mis en page via le DOM (police, style,
     SVG) mais rasterisés à plat avec html2canvas SANS filtre, puis
     recomposés sur le canvas final avec ctx.filter pour l'ombre /
     le contour / le glow.
   --------------------------------------------------------- */
function buildCanvasFilterString(layer) {
  const filters = [];
  if (layer.outline && layer.outline.on) {
    const w = layer.outline.width;
    const c = layer.outline.color;
    filters.push(
      `drop-shadow(${w}px 0 0 ${c})`,
      `drop-shadow(${-w}px 0 0 ${c})`,
      `drop-shadow(0 ${w}px 0 ${c})`,
      `drop-shadow(0 ${-w}px 0 ${c})`,
    );
  }
  if (layer.glow && layer.glow.on) {
    filters.push(
      `drop-shadow(0 0 ${layer.glow.blur}px ${layer.glow.color})`,
      `drop-shadow(0 0 ${layer.glow.blur * 0.5}px ${layer.glow.color})`,
    );
  }
  if (layer.shadow && layer.shadow.on) {
    filters.push(
      `drop-shadow(${layer.shadow.offsetX}px ${layer.shadow.offsetY}px ${layer.shadow.blur}px ${layer.shadow.color})`,
    );
  }
  return filters.length ? filters.join(" ") : "none";
}

function loadImageAsync(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataURL;
  });
}

function computeContainRect(naturalW, naturalH, boxW, boxH) {
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const w = naturalW * scale;
  const h = naturalH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

async function rasterizeLayerForExport(layer) {
  const w = Math.max(1, Math.round(layer.width));
  const h = Math.max(1, Math.round(layer.height));

  if (layer.type === "image") {
    // Les filtres image (luminosité/contraste/saturation/flou) sont eux
    // aussi ignorés par html2canvas : on dessine donc directement avec
    // le canvas natif, qui les applique correctement.
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const img = await loadImageAsync(layer.image.dataURL);
    const f = layer.image.filters;
    ctx.save();
    if (layer.image.flipX) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) blur(${f.blur}px)`;
    const rect = computeContainRect(img.naturalWidth, img.naturalHeight, w, h);
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    return { canvas, w, h };
  }

  // texte / formes : on garde la mise en page DOM (police, contour de
  // texte, SVG) et on la rasterise à plat, sans filtre, hors écran.
  const temp = document.createElement("div");
  temp.style.position = "fixed";
  temp.style.left = "-99999px";
  temp.style.top = "0";
  temp.style.width = w + "px";
  temp.style.height = h + "px";
  const content = buildLayerContentDom(layer);
  content.style.filter = "none";
  content.style.width = "100%";
  content.style.height = "100%";
  temp.appendChild(content);
  document.body.appendChild(temp);

  // Sur l'aperçu, "overflow: visible" laisse le texte déborder de sa
  // boîte sans jamais le rogner (ex : une police/taille dont la hauteur
  // de ligne dépasse la boîte du calque). Mais html2canvas ne capture
  // que les dimensions exactes qu'on lui donne : sans ce correctif, ce
  // débordement était tronqué au téléchargement alors qu'il s'affichait
  // en entier à l'écran. On mesure donc le rendu réel et on agrandit le
  // cliché en conséquence, en gardant le contenu centré.
  let rw = w;
  let rh = h;
  const inner = content.firstElementChild;
  if (inner) {
    const rect = inner.getBoundingClientRect();
    rw = Math.max(w, Math.ceil(rect.width));
    rh = Math.max(h, Math.ceil(rect.height));
  }
  if (rw !== w || rh !== h) {
    temp.style.width = rw + "px";
    temp.style.height = rh + "px";
  }

  let shot;
  try {
    shot = await html2canvas(temp, {
      width: rw,
      height: rh,
      scale: 1,
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
  } finally {
    document.body.removeChild(temp);
  }
  const canvas = document.createElement("canvas");
  canvas.width = rw;
  canvas.height = rh;
  canvas.getContext("2d").drawImage(shot, 0, 0, rw, rh);
  return { canvas, w: rw, h: rh };
}

function drawBackgroundAndEffects(ctx) {
  // fond de secours (visible si aucune image de fond n'est définie)
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  if (background.dataURL && background._imgEl) {
    const img = background._imgEl;
    const baseScale = Math.max(STAGE_W / img.naturalWidth, STAGE_H / img.naturalHeight);
    const scale = baseScale * (background.zoom / 100);
    const dispW = img.naturalWidth * scale;
    const dispH = img.naturalHeight * scale;
    const ox = (STAGE_W - dispW) / 2 + background.posX;
    const oy = (STAGE_H - dispH) / 2 + background.posY;
    ctx.save();
    ctx.filter = `brightness(${background.brightness}%) contrast(${background.contrast}%) saturate(${background.saturation}%) blur(${background.blur}px)`;
    ctx.globalAlpha = background.opacity / 100;
    ctx.drawImage(img, ox, oy, dispW, dispH);
    ctx.restore();
  }

  if (effects.vignette.on) {
    const grad = ctx.createRadialGradient(
      STAGE_W / 2,
      STAGE_H / 2,
      Math.min(STAGE_W, STAGE_H) * 0.2,
      STAGE_W / 2,
      STAGE_H / 2,
      Math.max(STAGE_W, STAGE_H) * 0.72,
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${effects.vignette.intensity / 100})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }
  if (effects.overlay.on) {
    ctx.fillStyle = hexToRgba(effects.overlay.color, effects.overlay.opacity / 100);
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }
  if (effects.gradient.on) {
    const coordsMap = {
      bottom: [0, STAGE_H, 0, 0],
      top: [0, 0, 0, STAGE_H],
      left: [0, 0, STAGE_W, 0],
      right: [STAGE_W, 0, 0, 0],
    };
    const c = coordsMap[effects.gradient.direction] || coordsMap.bottom;
    const grad = ctx.createLinearGradient(c[0], c[1], c[2], c[3]);
    grad.addColorStop(0, hexToRgba(effects.gradient.color, effects.gradient.opacity / 100));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }
}

async function renderFinalCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = STAGE_W;
  canvas.height = STAGE_H;
  const ctx = canvas.getContext("2d");

  drawBackgroundAndEffects(ctx);

  for (const layer of layers) {
    if (!layer.visible) continue;
    const { canvas: raster, w: rw, h: rh } = await rasterizeLayerForExport(layer);
    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.globalAlpha = layer.opacity / 100;
    ctx.filter = buildCanvasFilterString(layer);
    ctx.drawImage(raster, -rw / 2, -rh / 2, rw, rh);
    ctx.restore();
  }
  return canvas;
}

async function exportImage(format) {
  const canvas = await renderFinalCanvas();
  const name = (document.getElementById("projectName").value || "thumbnail")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-");
  const link = document.createElement("a");
  if (format === "jpg") {
    link.download = (name || "thumbnail") + ".jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.95);
  } else {
    link.download = (name || "thumbnail") + ".png";
    link.href = canvas.toDataURL("image/png");
  }
  link.click();
}

/* ===========================================================
   MODE FOOTBALL VIRAL
   Un jeu de raccourcis / heuristiques construits sur le même
   moteur de calques (aucune IA / vision par ordinateur réelle :
   le "score" et l'"optimisation" sont des règles déterministes
   sur la taille du texte, le contraste mesuré sur les pixels du
   fond, la longueur du message et le nombre de calques).
   =========================================================== */
function getSubjectLayer() {
  return layers.find((l) => l.isSubject);
}
function getMainMessageLayer() {
  return layers.find((l) => l.type === "text" && l.isMainMessage);
}
function ensureMainMessageLayer(defaultText) {
  let msg = getMainMessageLayer();
  if (!msg) {
    msg = makeBaseLayer("text", {
      x: STAGE_W / 2,
      y: STAGE_H * 0.84,
      width: 1000,
      height: 200,
      isMainMessage: true,
      text: {
        content: defaultText || "GOAT",
        font: "Anton",
        size: 130,
        color: "#ffffff",
        align: "center",
        letterSpacing: 1,
        lineHeight: 1,
        uppercase: true,
        stroke: { on: false, color: "#000000", width: 4 },
      },
      shadow: { on: true, color: "#000000", blur: 22, offsetX: 0, offsetY: 8 },
    });
    layers.push(msg);
  }
  return msg;
}

/* ---------- positionnement joueur / texte ---------- */
const PLAYER_POSITIONS = { centre: 0.5, gauche: 0.28, droite: 0.72 };
function setPlayerPosition(key) {
  const subject = getSubjectLayer();
  if (!subject) {
    alert("Ajoutez d'abord un sujet principal (joueur détouré) dans « Sujet & Objets ».");
    return;
  }
  subject.x = STAGE_W * PLAYER_POSITIONS[key];
  renderLayers();
  autosaveDraft();
}

function setTextPosition(key) {
  const msg = ensureMainMessageLayer();
  if (key === "derriere") {
    const subject = getSubjectLayer();
    layers = layers.filter((l) => l.id !== msg.id);
    const subjIdx = subject ? layers.findIndex((l) => l.id === subject.id) : -1;
    if (subjIdx >= 0) layers.splice(subjIdx, 0, msg);
    else layers.unshift(msg);
  } else {
    const map = {
      "bas-centre": { x: STAGE_W / 2, y: STAGE_H * 0.84, align: "center" },
      "bas-gauche": { x: STAGE_W * 0.3, y: STAGE_H * 0.84, align: "left" },
      "bas-droite": { x: STAGE_W * 0.7, y: STAGE_H * 0.84, align: "right" },
      centre: { x: STAGE_W / 2, y: STAGE_H / 2, align: "center" },
    };
    const pos = map[key] || map["bas-centre"];
    msg.x = pos.x;
    msg.y = pos.y;
    msg.text.align = pos.align;
  }
  renderAll();
  autosaveDraft();
  renderSelectionPanel();
}

/* ---------- message principal + catégories d'émotion ---------- */
const EMOTION_CATEGORIES = [
  { key: "colere", label: "Colère 😡", words: ["HONTE", "SCANDALE", "NON !", "FIASCO"] },
  { key: "surprise", label: "Surprise 😱", words: ["QUOI ?", "INCROYABLE", "OUF !", "PARDON ?"] },
  { key: "admiration", label: "Admiration 🐐", words: ["GOAT", "MONSTRE", "GÉNIE", "KING"] },
  { key: "doute", label: "Doute 🤔", words: ["EUH...", "VRAIMENT ?", "POURQUOI ?", "BIZARRE..."] },
  { key: "echec", label: "Échec ❌", words: ["RATÉ", "FINI", "FIASCO", "NON..."] },
];

function setMainMessage(word) {
  const msg = ensureMainMessageLayer(word);
  msg.text.content = word;
  renderAll();
  autosaveDraft();
  refreshMessageWarning();
}

function refreshMessageWarning() {
  const msg = getMainMessageLayer();
  const warn = document.getElementById("viralMsgWarning");
  const input = document.getElementById("viralMsgInput");
  if (!warn || !input) return;
  const text = msg ? msg.text.content : "";
  if (input.value !== text) input.value = text || "";
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  warn.style.display = words > 3 ? "block" : "none";
}

/* ---------- templates Football Viral ---------- */
const VIRAL_TEMPLATES = [
  { id: "goat", name: "LE GOAT", message: "GOAT", desc: "Joueur au centre, texte énorme, admiration" },
  { id: "honte", name: "LA HONTE", message: "LA HONTE", desc: "Expression forte, texte très large" },
  { id: "fiasco", name: "LE FIASCO", message: "FIASCO", desc: "Sujet isolé, espace négatif autour" },
  { id: "non", name: "NON...", message: "NON...", desc: "Grande zone vide, sensation de choc" },
  { id: "ouf", name: "OUFFF...", message: "OUF...", desc: "Bras ouverts, action spectaculaire" },
];

function loadViralTemplate(id) {
  const tpl = VIRAL_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return;
  if (layers.length && !confirm("Remplacer le contenu actuel par ce modèle ?")) return;

  layers = [];
  selectedId = null;
  background = defaultBackground();
  effects = defaultEffects();
  background.brightness = 70;
  background.contrast = 122;
  effects.gradient = { on: true, direction: "bottom", color: "#000000", opacity: 78 };
  effects.vignette = { on: true, intensity: 35 };

  const subject = makeBaseLayer("shape", {
    x: STAGE_W * 0.5,
    y: STAGE_H * 0.4,
    width: 360,
    height: 360,
    isSubject: true,
    shape: { kind: "emoji", emoji: "🧍" },
  });
  const msg = makeBaseLayer("text", {
    x: STAGE_W / 2,
    y: STAGE_H * 0.85,
    width: 1150,
    height: 220,
    isMainMessage: true,
    text: {
      content: tpl.message,
      font: "Anton",
      size: 150,
      color: "#ffffff",
      align: "center",
      letterSpacing: 2,
      lineHeight: 1,
      uppercase: true,
      stroke: { on: false, color: "#000000", width: 4 },
    },
    shadow: { on: true, color: "#000000", blur: 25, offsetX: 0, offsetY: 8 },
  });
  layers.push(subject, msg);

  buildFondPanel();
  buildEffetsPanel();
  renderAll();
  autosaveDraft();
  refreshMessageWarning();
  computeAndShowScore();
}

/* ---------- presets de style (couleur / accent) ---------- */
const STYLE_PRESETS = [
  { key: "wiloo", label: "Wiloo Style", textColor: "#ffe000", accent: "#111111" },
  { key: "debat", label: "Débat Football", textColor: "#ffffff", accent: "#1a3fae" },
  { key: "breaking", label: "Breaking News", textColor: "#ffffff", accent: "#e2001a" },
  { key: "colere", label: "Colère", textColor: "#ff3b3b", accent: "#000000" },
  { key: "goat", label: "GOAT", textColor: "#ffd700", accent: "#000000" },
  { key: "fiasco", label: "Fiasco", textColor: "#ffffff", accent: "#3a0000" },
  { key: "mercato", label: "Mercato", textColor: "#00ff85", accent: "#032b1e" },
  { key: "elephants", label: "Journal des Éléphants 🇨🇮🐘", textColor: "#ff8200", accent: "#009e60" },
];
function applyStylePreset(key) {
  const preset = STYLE_PRESETS.find((p) => p.key === key);
  if (!preset) return;
  const msg = ensureMainMessageLayer();
  msg.text.color = preset.textColor;
  effects.overlay = { on: true, color: preset.accent, opacity: 22 };
  buildEffetsPanel();
  renderAll();
  autosaveDraft();
}

/* ---------- score de thumbnail (heuristique, pas d'IA) ---------- */
function luminanceOfHex(hex) {
  if (!hex) return 255;
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function sampleBackgroundLuminanceUnder(layer) {
  const off = document.createElement("canvas");
  off.width = STAGE_W;
  off.height = STAGE_H;
  const octx = off.getContext("2d");
  drawBackgroundAndEffects(octx);
  const x = Math.max(0, Math.round(layer.x - layer.width / 2));
  const y = Math.max(0, Math.round(layer.y - layer.height / 2));
  const w = Math.min(STAGE_W - x, Math.round(layer.width));
  const h = Math.min(STAGE_H - y, Math.round(layer.height));
  if (w <= 0 || h <= 0) return 128;
  const data = octx.getImageData(x, y, w, h).data;
  let total = 0;
  let count = 0;
  const stepPixels = Math.max(1, Math.floor(w * h / 400));
  for (let i = 0; i < data.length; i += 4 * stepPixels) {
    total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    count++;
  }
  return count ? total / count : 128;
}

function computeThumbnailScore() {
  const tips = [];
  let score = 100;
  const msg = getMainMessageLayer();
  const subject = getSubjectLayer();

  let words = 0;
  if (msg) words = (msg.text.content || "").trim().split(/\s+/).filter(Boolean).length;

  if (!msg) {
    score -= 30;
    tips.push("Ajoutez un message principal (1 à 3 mots).");
  } else if (words > 5) {
    score -= 20;
    tips.push("Le message est trop long — utilisez 1 à 3 mots très puissants.");
  } else if (words > 3) {
    score -= 8;
    tips.push("Essayez de raccourcir le message à 1-3 mots.");
  } else {
    tips.push("Message clair et puissant.");
  }

  let contrastOk = true;
  if (msg) {
    const ratio = msg.height / STAGE_H;
    if (ratio < 0.12) {
      score -= 20;
      tips.push("Le texte est trop petit — agrandissez-le.");
    } else if (ratio > 0.62) {
      score -= 5;
      tips.push("Le texte est peut-être trop grand pour le cadre.");
    }

    const bgLum = sampleBackgroundLuminanceUnder(msg);
    const textLum = luminanceOfHex(msg.text.color);
    contrastOk = Math.abs(bgLum - textLum) > 80;
    if (!contrastOk) {
      score -= 20;
      tips.push("Contraste texte/fond trop faible — ajoutez un dégradé sombre derrière le texte.");
    } else {
      tips.push("Excellent contraste.");
    }
  }

  if (layers.length > 6) {
    score -= 15;
    tips.push("Trop d'éléments sont présents — simplifiez la composition.");
  }
  if (!subject) {
    score -= 15;
    tips.push("Ajoutez un sujet principal (joueur détouré).");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, tips, contrastOk, words };
}

function computeAndShowScore() {
  const { score, tips } = computeThumbnailScore();
  const emoji = score >= 80 ? "🔥" : score >= 55 ? "👍" : "⚠️";
  const badge = document.getElementById("scoreBadge");
  if (badge) {
    badge.textContent = `SCORE : ${score}/100 ${emoji}`;
    badge.className =
      "badge " + (score >= 80 ? "text-bg-success" : score >= 55 ? "text-bg-warning" : "text-bg-danger");
  }
  const box = document.getElementById("viralScoreBody");
  if (box) {
    box.innerHTML = `
      <div style="font-family:'Anton',sans-serif;font-size:20px;color:${score >= 80 ? "#3fb44a" : score >= 55 ? "#f5b400" : "#e2001a"};">
        THUMBNAIL SCORE : ${score}/100 ${emoji}
      </div>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:var(--muted);">
        ${tips.map((t) => `<li>${t}</li>`).join("")}
      </ul>
    `;
  }
  return score;
}

function optimizeThumbnail() {
  const msg = ensureMainMessageLayer();
  const ratio = msg.height / STAGE_H;
  if (ratio < 0.16) {
    const targetRatio = 0.22;
    const factor = (targetRatio * STAGE_H) / msg.height;
    msg.height *= factor;
    msg.width *= factor;
    msg.text.size *= factor;
  }
  if (!sampleBackgroundLuminanceUnder || true) {
    const bgLum = sampleBackgroundLuminanceUnder(msg);
    const textLum = luminanceOfHex(msg.text.color);
    if (Math.abs(bgLum - textLum) <= 80) {
      effects.gradient = { on: true, direction: "bottom", color: "#000000", opacity: 78 };
      msg.shadow.on = true;
    }
  }
  background.contrast = Math.max(background.contrast, 115);

  buildFondPanel();
  buildEffetsPanel();
  renderAll();
  autosaveDraft();
  computeAndShowScore();
}

/* ---------- test mobile ---------- */
async function openMobileTest() {
  const canvas = await renderFinalCanvas();
  const dataUrl = canvas.toDataURL("image/png");
  const { score, contrastOk } = computeThumbnailScore();
  const msg = getMainMessageLayer();
  const ratio = msg ? msg.height / STAGE_H : 0;
  const good = ratio >= 0.16 && contrastOk && (!msg || (msg.text.content || "").trim().split(/\s+/).filter(Boolean).length <= 3);

  const body = document.getElementById("mobileModalBody");
  body.innerHTML = `
    <p class="hint" style="margin-bottom:14px;">Taille réelle d'une vignette YouTube sur mobile (comparée à la taille normale) :</p>
    <div style="display:flex; gap:24px; align-items:flex-end; justify-content:center; flex-wrap:wrap;">
      <div>
        <img src="${dataUrl}" style="width:360px; border-radius:6px; display:block;" />
        <div class="hint" style="margin-top:6px;">Aperçu normal</div>
      </div>
      <div>
        <img src="${dataUrl}" style="width:168px; border-radius:3px; display:block;" />
        <div class="hint" style="margin-top:6px;">Taille mobile réelle (168px)</div>
      </div>
    </div>
    <div style="margin-top:18px; font-family:'Anton',sans-serif; font-size:18px; color:${good ? "#3fb44a" : "#e2001a"};">
      LISIBILITÉ MOBILE : ${good ? "EXCELLENTE" : "À AMÉLIORER"}
    </div>
    <div class="hint" style="margin-top:4px;">Score complet : ${score}/100</div>
  `;
  new bootstrap.Modal(document.getElementById("mobileModal")).show();
}

/* ---------- panneau latéral ---------- */
function buildViralPanel() {
  const body = document.getElementById("viralBody");
  body.innerHTML = "";

  const quickBtn = mk("button", "btn btn-export w-100");
  quickBtn.innerHTML = "⚽ Créer une thumbnail Football Viral";
  quickBtn.addEventListener("click", () => loadViralTemplate("goat"));
  body.appendChild(quickBtn);

  // message principal
  const fsMsg = mk("fieldset");
  fsMsg.innerHTML = `<legend>Message principal</legend>`;
  const msgLabel = mk("label", "field-label");
  msgLabel.textContent = "MESSAGE PRINCIPAL (1 à 3 mots)";
  fsMsg.appendChild(msgLabel);
  const msgInput = mk("input", "form-control");
  msgInput.type = "text";
  msgInput.id = "viralMsgInput";
  msgInput.value = getMainMessageLayer() ? getMainMessageLayer().text.content : "";
  msgInput.placeholder = "GOAT, LA HONTE, FIASCO…";
  msgInput.addEventListener("input", () => {
    setMainMessage(msgInput.value);
  });
  fsMsg.appendChild(msgInput);
  const warn = mk("p", "hint");
  warn.id = "viralMsgWarning";
  warn.style.color = "#e2001a";
  warn.style.display = "none";
  warn.textContent = "Pour une meilleure thumbnail, utilisez 1 à 3 mots très puissants.";
  fsMsg.appendChild(warn);
  body.appendChild(fsMsg);

  // catégories d'émotion
  const fsEmo = mk("fieldset");
  fsEmo.innerHTML = `<legend>Catégories d'émotion</legend>`;
  EMOTION_CATEGORIES.forEach((cat) => {
    const catWrap = mk("div");
    catWrap.style.marginBottom = "8px";
    const catBtn = mk("button", "btn btn-tool w-100");
    catBtn.textContent = cat.label;
    const chipRow = mk("div", "lib-grid");
    chipRow.style.gridTemplateColumns = "repeat(2,1fr)";
    chipRow.style.display = "none";
    chipRow.style.marginTop = "6px";
    cat.words.forEach((w) => {
      const chip = mk("button", "btn btn-tool");
      chip.style.fontSize = "11px";
      chip.textContent = w;
      chip.addEventListener("click", () => setMainMessage(w));
      chipRow.appendChild(chip);
    });
    catBtn.addEventListener("click", () => {
      chipRow.style.display = chipRow.style.display === "none" ? "grid" : "none";
    });
    catWrap.appendChild(catBtn);
    catWrap.appendChild(chipRow);
    fsEmo.appendChild(catWrap);
  });
  body.appendChild(fsEmo);

  // position joueur
  const fsPlayer = mk("fieldset");
  fsPlayer.innerHTML = `<legend>Position du joueur</legend>`;
  const playerGrid = mk("div", "btn-group-vert");
  playerGrid.style.gridTemplateColumns = "1fr 1fr 1fr";
  [
    ["centre", "Centre"],
    ["gauche", "Gauche"],
    ["droite", "Droite"],
  ].forEach(([k, l]) => {
    const b = mk("button", "btn btn-tool");
    b.textContent = l;
    b.addEventListener("click", () => setPlayerPosition(k));
    playerGrid.appendChild(b);
  });
  fsPlayer.appendChild(playerGrid);
  body.appendChild(fsPlayer);

  // position texte
  const fsTextPos = mk("fieldset");
  fsTextPos.innerHTML = `<legend>Position du texte</legend>`;
  const textGrid = mk("div", "btn-group-vert");
  [
    ["bas-centre", "Bas centre"],
    ["bas-gauche", "Bas gauche"],
    ["bas-droite", "Bas droite"],
    ["centre", "Centre (sur le joueur)"],
    ["derriere", "Derrière le joueur"],
  ].forEach(([k, l]) => {
    const b = mk("button", "btn btn-tool");
    b.textContent = l;
    b.addEventListener("click", () => setTextPosition(k));
    textGrid.appendChild(b);
  });
  fsTextPos.appendChild(textGrid);
  body.appendChild(fsTextPos);
  const hintPos = mk("p", "hint");
  hintPos.textContent =
    "Pour le contour, l'ombre, le glow ou la luminosité du joueur/texte : sélectionnez le calque sur l'aperçu, les réglages apparaissent en haut dans « Sélection ».";
  body.appendChild(hintPos);

  // templates
  const fsTpl = mk("fieldset");
  fsTpl.innerHTML = `<legend>Modèles Football Viral</legend>`;
  VIRAL_TEMPLATES.forEach((t) => {
    const card = mk("div", "tpl-card");
    card.innerHTML = `<div><div class="tpl-name">${t.name}</div><div class="tpl-desc">${t.desc}</div></div>`;
    card.addEventListener("click", () => loadViralTemplate(t.id));
    fsTpl.appendChild(card);
  });
  body.appendChild(fsTpl);

  // presets de style
  const fsStyle = mk("fieldset");
  fsStyle.innerHTML = `<legend>Presets de style</legend>`;
  const styleGrid = mk("div", "btn-group-vert");
  STYLE_PRESETS.forEach((p) => {
    const b = mk("button", "btn btn-tool");
    b.textContent = p.label;
    b.addEventListener("click", () => applyStylePreset(p.key));
    styleGrid.appendChild(b);
  });
  fsStyle.appendChild(styleGrid);
  body.appendChild(fsStyle);

  // score
  const fsScore = mk("fieldset");
  fsScore.innerHTML = `<legend>Thumbnail Score</legend>`;
  const scoreBtn = mk("button", "btn btn-tool w-100");
  scoreBtn.innerHTML = '<i class="bi bi-graph-up"></i> Calculer le score';
  scoreBtn.addEventListener("click", computeAndShowScore);
  fsScore.appendChild(scoreBtn);
  const scoreBody = mk("div");
  scoreBody.id = "viralScoreBody";
  scoreBody.style.marginTop = "10px";
  fsScore.appendChild(scoreBody);
  body.appendChild(fsScore);

  // optimiser
  const fsOpt = mk("fieldset");
  fsOpt.innerHTML = `<legend>Optimisation automatique</legend>`;
  const optBtn = mk("button", "btn btn-export w-100");
  optBtn.innerHTML = '<i class="bi bi-magic"></i> OPTIMISER MA THUMBNAIL';
  optBtn.addEventListener("click", optimizeThumbnail);
  fsOpt.appendChild(optBtn);
  const optHint = mk("p", "hint");
  optHint.textContent =
    "Règles automatiques : agrandit le texte s'il est trop petit, ajoute un dégradé sombre si le contraste est faible, augmente légèrement le contraste du fond. (Basé sur des règles mesurables, pas sur une vraie IA/vision.)";
  fsOpt.appendChild(optHint);
  body.appendChild(fsOpt);
}

/* ---------------------------------------------------------
   Câblage des boutons statiques + initialisation
   --------------------------------------------------------- */
document.getElementById("btnAddText").addEventListener("click", () => addTextLayer("NOUVEAU TITRE"));
document.getElementById("btnNew").addEventListener("click", newProject);
document.getElementById("btnSave").addEventListener("click", saveNamedProject);
document.getElementById("btnReset").addEventListener("click", resetProject);
document.getElementById("btnLoad").addEventListener("click", () => {
  openLoadModal();
  new bootstrap.Modal(document.getElementById("loadModal")).show();
});
document.getElementById("btnExportPng").addEventListener("click", () => exportImage("png"));
document.getElementById("btnExportJpg").addEventListener("click", () => exportImage("jpg"));
document.getElementById("projectName").addEventListener("input", autosaveDraft);
document.getElementById("btnMobileTest").addEventListener("click", openMobileTest);

function init() {
  buildFondPanel();
  buildObjetsPanel();
  buildEffetsPanel();
  buildTemplatesPanel();
  buildViralPanel();
  fitStage();
  const loaded = loadDraftIfAny();
  if (!loaded) renderAll();
  refreshMessageWarning();
}
init();
