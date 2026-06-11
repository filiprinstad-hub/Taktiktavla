const STORAGE_KEY = "simple-tactic-board-max-v1";

const FULL_PITCH_SVG = `
<svg class="pitch-lines" viewBox="0 0 840 1200" preserveAspectRatio="none" aria-hidden="true">
  <rect x="35" y="35" width="770" height="1130" rx="4"></rect>
  <line x1="35" y1="600" x2="805" y2="600"></line>
  <circle cx="420" cy="600" r="82"></circle>
  <circle cx="420" cy="600" r="4" class="filled"></circle>

  <rect x="240" y="35" width="360" height="170"></rect>
  <rect x="320" y="35" width="200" height="72"></rect>
  <circle cx="420" cy="150" r="4" class="filled"></circle>
  <path d="M 320 205 A 105 105 0 0 0 520 205"></path>

  <rect x="240" y="995" width="360" height="170"></rect>
  <rect x="320" y="1093" width="200" height="72"></rect>
  <circle cx="420" cy="1050" r="4" class="filled"></circle>
  <path d="M 320 995 A 105 105 0 0 1 520 995"></path>

  <path d="M95 35 Q95 95 35 95"></path>
  <path d="M745 35 Q745 95 805 95"></path>
  <path d="M95 1165 Q95 1105 35 1105"></path>
  <path d="M745 1165 Q745 1105 805 1105"></path>
</svg>`;

const HALF_PITCH_SVG = `
<svg class="pitch-lines" viewBox="0 0 840 1200" preserveAspectRatio="none" aria-hidden="true">
  <rect x="35" y="35" width="770" height="1130" rx="4"></rect>

  <rect x="240" y="35" width="360" height="170"></rect>
  <rect x="320" y="35" width="200" height="72"></rect>
  <circle cx="420" cy="150" r="4" class="filled"></circle>
  <path d="M 320 205 A 105 105 0 0 0 520 205"></path>

  <line x1="35" y1="1165" x2="805" y2="1165"></line>
  <path d="M 338 1165 A 82 82 0 0 1 502 1165"></path>
  <circle cx="420" cy="1110" r="4" class="filled"></circle>

  <path d="M95 35 Q95 95 35 95"></path>
  <path d="M745 35 Q745 95 805 95"></path>
  <path d="M95 1165 Q95 1105 35 1105"></path>
  <path d="M745 1165 Q745 1105 805 1105"></path>
</svg>`;

const board = document.getElementById("board");

const boardFrame = document.querySelector(".board-frame");
const canvas = document.getElementById("canvas");
const layer = document.getElementById("magnetsLayer");
const saveStatus = document.getElementById("saveStatus");

const addRed = document.getElementById("addRed");
const addBlue = document.getElementById("addBlue");
const addYellow = document.getElementById("addYellow");
const addRedSub = document.getElementById("addRedSub");
const addBlueSub = document.getElementById("addBlueSub");
const toggleField = document.getElementById("toggleField");
const toggleLock = document.getElementById("toggleLock");
const exportImage = document.getElementById("exportImage");
const saveBoard = document.getElementById("saveBoard");
const clearBoard = document.getElementById("clearBoard");

const magnetModal = document.getElementById("magnetModal");
const closeModal = document.getElementById("closeModal");
const cancelModal = document.getElementById("cancelModal");
const magnetForm = document.getElementById("magnetForm");
const nameInput = document.getElementById("nameInput");
const markerInput = document.getElementById("markerInput");
const typePreview = document.getElementById("typePreview");
const modalTitle = document.getElementById("modalTitle");

const startModal = document.getElementById("startModal");
const newBoardBtn = document.getElementById("newBoardBtn");
const continueBoardBtn = document.getElementById("continueBoardBtn");
const continueHint = document.getElementById("continueHint");

let magnets = [];
let activeDrag = null;
let statusTimer = null;
let modalState = null;
let fieldMode = "full";
let isLocked = false;
let hasSavedState = false;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function setStatus(text) {
  if (!saveStatus) return;
  saveStatus.textContent = text;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    saveStatus.textContent = "Redo";
  }, 1800);
}

function getState() {
  return {
    magnets,
    fieldMode,
    isLocked
  };
}

function persistState(showMessage = false) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
  hasSavedState = true;
  if (showMessage) setStatus("Sparat");
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      hasSavedState = false;
      return null;
    }
    const parsed = JSON.parse(saved);
    hasSavedState = true;
    return parsed;
  } catch {
    hasSavedState = false;
    return null;
  }
}

function applyState(state) {
  magnets = Array.isArray(state?.magnets) ? state.magnets : [];
  fieldMode = state?.fieldMode === "half" ? "half" : "full";
  isLocked = !!state?.isLocked;
  renderPitch();
  updateControls();
  renderMagnets();
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  hasSavedState = false;
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("");
}

function getDisplayText(magnet) {
  const text = magnet.marker && magnet.marker.trim();
  return text || getInitials(magnet.name);
}


function fitBoardToFrame() {
  if (!boardFrame || !board) return;
  const rect = boardFrame.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = 7 / 10;
  const width = Math.min(rect.width, rect.height * ratio);
  const height = width / ratio;
  board.style.width = `${Math.max(1, Math.floor(width))}px`;
  board.style.height = `${Math.max(1, Math.floor(height))}px`;
}

function renderPitch() {
  board.innerHTML = fieldMode === "half" ? HALF_PITCH_SVG : FULL_PITCH_SVG;
}

function updateControls() {
  toggleField.textContent = fieldMode === "full" ? "Halvplan" : "Helplan";
  toggleLock.textContent = isLocked ? "Låst" : "Lås";
  toggleLock.classList.toggle("active-toggle", isLocked);
}

function renderMagnets() {
  layer.innerHTML = "";

  for (const magnet of magnets) {
    const el = document.createElement("div");
    el.className = `magnet ${magnet.color}${magnet.substitute ? " substitute" : ""}${isLocked ? " locked" : ""}`;
    el.dataset.id = magnet.id;
    el.style.left = `${magnet.x}%`;
    el.style.top = `${magnet.y}%`;
    el.tabIndex = 0;

    const disc = document.createElement("div");
    disc.className = "magnet-disc";

    const text = document.createElement("span");
    text.className = "magnet-text";
    text.textContent = getDisplayText(magnet);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-magnet";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Ta bort ${magnet.name}`);
    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      if (isLocked) return;
      magnets = magnets.filter(item => item.id !== magnet.id);
      persistState(true);
      renderMagnets();
    });

    const label = document.createElement("div");
    label.className = "magnet-name";
    label.textContent = magnet.name;
    label.title = magnet.name;

    disc.appendChild(text);
    disc.appendChild(deleteButton);
    el.appendChild(disc);
    el.appendChild(label);

    el.addEventListener("pointerdown", startDrag);
    el.addEventListener("dblclick", () => {
      if (!isLocked) openModalForEdit(magnet.id);
    });
    el.addEventListener("keydown", event => {
      if (event.key === "Enter" && !isLocked) openModalForEdit(magnet.id);
      if ((event.key === "Delete" || event.key === "Backspace") && !isLocked) {
        magnets = magnets.filter(item => item.id !== magnet.id);
        persistState(true);
        renderMagnets();
      }
    });

    layer.appendChild(el);
  }
}

function getTypeLabel(color, substitute) {
  if (substitute && color === "red") return "Röd avbytare";
  if (substitute && color === "blue") return "Blå avbytare";
  if (color === "yellow") return "Gul målvakt";
  if (color === "blue") return "Blå";
  return "Röd";
}

function updateTypePreview(color, substitute) {
  typePreview.textContent = getTypeLabel(color, substitute);
  typePreview.className = "type-preview";
  if (color === "red") typePreview.classList.add("type-red");
  if (color === "blue") typePreview.classList.add("type-blue");
  if (color === "yellow") typePreview.classList.add("type-yellow");
}

function openModal(config) {
  modalState = config;
  modalTitle.textContent = config.mode === "edit" ? "Ändra magnet" : "Ny magnet";
  nameInput.value = config.name || "";
  markerInput.value = config.marker || "";
  updateTypePreview(config.color, config.substitute);
  magnetModal.classList.remove("hidden");
  magnetModal.setAttribute("aria-hidden", "false");
  setTimeout(() => nameInput.focus(), 20);
}

function closeMagnetModal() {
  magnetModal.classList.add("hidden");
  magnetModal.setAttribute("aria-hidden", "true");
  modalState = null;
  magnetForm.reset();
}

function openModalForAdd(color, substitute = false) {
  openModal({ mode: "add", color, substitute, name: "", marker: "" });
}

function openModalForEdit(id) {
  const magnet = magnets.find(item => item.id === id);
  if (!magnet) return;
  openModal({
    mode: "edit",
    id,
    color: magnet.color,
    substitute: magnet.substitute,
    name: magnet.name,
    marker: magnet.marker || ""
  });
}

function getNextSubstitutePosition() {
  const substitutes = magnets.filter(item => item.substitute);
  const index = substitutes.length;
  const columns = 5;
  const col = index % columns;
  const row = Math.floor(index / columns) % 2;
  return {
    x: 14 + col * 18,
    y: row === 0 ? 88.5 : 95
  };
}

function getNextFieldPosition() {
  const fielders = magnets.filter(item => !item.substitute);
  const index = fielders.length;
  return {
    x: 50 + ((index % 5) - 2) * 7,
    y: 54 + (Math.floor(index / 5) - 1) * 10
  };
}

function submitModal(event) {
  event.preventDefault();
  if (!modalState) return;

  const name = nameInput.value.trim();
  const marker = markerInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  if (modalState.mode === "add") {
    const pos = modalState.substitute ? getNextSubstitutePosition() : getNextFieldPosition();
    magnets.push({
      id: uid(),
      name,
      marker,
      color: modalState.color,
      substitute: modalState.substitute,
      x: pos.x,
      y: pos.y
    });
  } else if (modalState.mode === "edit") {
    const magnet = magnets.find(item => item.id === modalState.id);
    if (magnet) {
      magnet.name = name;
      magnet.marker = marker;
    }
  }

  persistState(true);
  renderMagnets();
  closeMagnetModal();
}

function startDrag(event) {
  if (isLocked) return;
  if (event.target.closest(".delete-magnet")) return;

  const el = event.currentTarget;
  const id = el.dataset.id;
  const magnet = magnets.find(item => item.id === id);
  if (!magnet) return;

  event.preventDefault();
  el.setPointerCapture(event.pointerId);
  el.classList.add("dragging");

  activeDrag = { id, pointerId: event.pointerId, element: el };

  moveMagnet(event);
  el.addEventListener("pointermove", moveMagnet);
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
}

function moveMagnet(event) {
  if (!activeDrag) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  const clampedX = Math.max(4, Math.min(96, x));
  const clampedY = Math.max(3, Math.min(97, y));

  const magnet = magnets.find(item => item.id === activeDrag.id);
  if (!magnet) return;

  magnet.x = Number(clampedX.toFixed(2));
  magnet.y = Number(clampedY.toFixed(2));
  activeDrag.element.style.left = `${magnet.x}%`;
  activeDrag.element.style.top = `${magnet.y}%`;
}

function endDrag() {
  if (!activeDrag) return;
  const el = activeDrag.element;
  el.classList.remove("dragging");
  el.releasePointerCapture(activeDrag.pointerId);
  el.removeEventListener("pointermove", moveMagnet);
  el.removeEventListener("pointerup", endDrag);
  el.removeEventListener("pointercancel", endDrag);
  activeDrag = null;
  persistState();
}

function toggleFieldMode() {
  fieldMode = fieldMode === "full" ? "half" : "full";
  renderPitch();
  updateControls();
  persistState(true);
}

function toggleLocked() {
  isLocked = !isLocked;
  updateControls();
  renderMagnets();
  persistState(true);
}

function startNewBoard() {
  magnets = [];
  fieldMode = "full";
  isLocked = false;
  renderPitch();
  updateControls();
  renderMagnets();
  clearState();
  closeStartModal();
}

function continueSavedBoard() {
  const saved = loadState();
  if (saved) applyState(saved);
  closeStartModal();
}

function closeStartModal() {
  startModal.classList.add("hidden");
  startModal.setAttribute("aria-hidden", "true");
}

function openStartModal() {
  startModal.classList.remove("hidden");
  startModal.setAttribute("aria-hidden", "false");
  const saved = loadState();
  continueBoardBtn.disabled = !saved;
  continueHint.textContent = saved ? "Det finns en sparad tavla att fortsätta med." : "Ingen sparad tavla ännu.";
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPitchSvgForExport() {
  const base = fieldMode === "full" ? FULL_PITCH_SVG : HALF_PITCH_SVG;
  return base
    .replace('class="pitch-lines" ', '')
    .replace('preserveAspectRatio="none" ', '')
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
}

function exportCurrentBoard() {
  const totalW = 840;
  const totalH = 1320;
  const benchTop = 1200;
  const pitchSvg = getPitchSvgForExport();

  let magnetSvg = "";
  for (const magnet of magnets) {
    const cx = (magnet.x / 100) * totalW;
    const cy = (magnet.y / 100) * totalH;
    const radius = 22;
    const color = magnet.color === "red" ? "#c5162e" : magnet.color === "blue" ? "#2467c9" : "#f4c430";
    const textColor = magnet.color === "yellow" ? "#1f1f1f" : "#ffffff";
    const label = escapeXml(magnet.name);
    const marker = escapeXml(getDisplayText(magnet));
    magnetSvg += `
      <g>
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" stroke="rgba(255,255,255,0.7)" stroke-width="2" />
        <text x="${cx}" y="${cy + 5}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="${textColor}">${marker}</text>
        <rect x="${cx - 38}" y="${cy + 24}" width="76" height="20" rx="8" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.08)" />
        <text x="${cx}" y="${cy + 38}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="#1f1f1f">${label}</text>
      </g>`;
  }

  const exportSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
    <rect width="100%" height="100%" fill="#f3f3f0"/>
    <g transform="translate(0,0)">${pitchSvg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 1200">', '').replace('</svg>', '')}</g>
    <rect x="0" y="${benchTop}" width="${totalW}" height="120" rx="12" fill="#aeea9f"/>
    <rect x="12" y="${benchTop + 12}" width="90" height="26" rx="13" fill="rgba(255,255,255,0.82)"/>
    <text x="57" y="${benchTop + 30}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" text-anchor="middle" fill="rgba(0,0,0,0.62)">Avbytare</text>
    <line x1="12" y1="${benchTop + 60}" x2="828" y2="${benchTop + 60}" stroke="rgba(0,0,0,0.12)" stroke-width="2" stroke-dasharray="8 6" />
    ${magnetSvg}
  </svg>`;

  const blob = new Blob([exportSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvasEl = document.createElement("canvas");
    canvasEl.width = totalW * 2;
    canvasEl.height = totalH * 2;
    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#f3f3f0";
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
    URL.revokeObjectURL(url);
    const link = document.createElement("a");
    link.href = canvasEl.toDataURL("image/png");
    link.download = `taktiktavla-${fieldMode}.png`;
    link.click();
    setStatus("Bild exporterad");
  };
  img.src = url;
}

addRed.addEventListener("click", () => openModalForAdd("red", false));
addBlue.addEventListener("click", () => openModalForAdd("blue", false));
addYellow.addEventListener("click", () => openModalForAdd("yellow", false));
addRedSub.addEventListener("click", () => openModalForAdd("red", true));
addBlueSub.addEventListener("click", () => openModalForAdd("blue", true));
toggleField.addEventListener("click", toggleFieldMode);
toggleLock.addEventListener("click", toggleLocked);
exportImage.addEventListener("click", exportCurrentBoard);
saveBoard.addEventListener("click", () => persistState(true));
clearBoard.addEventListener("click", () => {
  if (!magnets.length) return;
  const ok = window.confirm("Vill du rensa hela tavlan?");
  if (!ok) return;
  magnets = [];
  persistState(true);
  renderMagnets();
});

magnetForm.addEventListener("submit", submitModal);
closeModal.addEventListener("click", closeMagnetModal);
cancelModal.addEventListener("click", closeMagnetModal);
magnetModal.addEventListener("click", event => {
  if (event.target.hasAttribute("data-close-modal")) closeMagnetModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !magnetModal.classList.contains("hidden")) closeMagnetModal();
});

newBoardBtn.addEventListener("click", startNewBoard);
continueBoardBtn.addEventListener("click", continueSavedBoard);

window.addEventListener("resize", fitBoardToFrame);
window.addEventListener("orientationchange", () => setTimeout(fitBoardToFrame, 120));

renderPitch();
updateControls();
renderMagnets();
openStartModal();
