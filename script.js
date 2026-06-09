const STORAGE_KEY = "simple-tactic-board-subs-v1";

const canvas = document.getElementById("canvas");
const layer = document.getElementById("magnetsLayer");
const saveStatus = document.getElementById("saveStatus");

const addRed = document.getElementById("addRed");
const addBlue = document.getElementById("addBlue");
const addYellow = document.getElementById("addYellow");
const addRedSub = document.getElementById("addRedSub");
const addBlueSub = document.getElementById("addBlueSub");
const saveBoard = document.getElementById("saveBoard");
const clearBoard = document.getElementById("clearBoard");

let magnets = [];
let activeDrag = null;
let statusTimer = null;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function setStatus(text) {
  if (!saveStatus) {
    return;
  }

  saveStatus.textContent = text;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    saveStatus.textContent = "Redo";
  }, 1800);
}

function loadMagnets() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    magnets = saved ? JSON.parse(saved) : [];
  } catch {
    magnets = [];
  }
}

function persistMagnets(showMessage = false) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(magnets));
  if (showMessage) {
    setStatus("Sparat");
  }
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

function render() {
  layer.innerHTML = "";

  for (const magnet of magnets) {
    const el = document.createElement("div");
    el.className = `magnet ${magnet.color}${magnet.substitute ? " substitute" : ""}`;
    el.dataset.id = magnet.id;
    el.style.left = `${magnet.x}%`;
    el.style.top = `${magnet.y}%`;
    el.tabIndex = 0;

    const disc = document.createElement("div");
    disc.className = "magnet-disc";

    const text = document.createElement("span");
    text.className = "magnet-text";
    text.textContent = getDisplayText(magnet);

    if (magnet.substitute) {
      const vest = document.createElement("span");
      vest.className = "vest";
      disc.appendChild(vest);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-magnet";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Ta bort ${magnet.name}`);
    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      magnets = magnets.filter(item => item.id !== magnet.id);
      persistMagnets(true);
      render();
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
    el.addEventListener("dblclick", () => editMagnet(magnet.id));
    el.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        editMagnet(magnet.id);
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        magnets = magnets.filter(item => item.id !== magnet.id);
        persistMagnets(true);
        render();
      }
    });

    layer.appendChild(el);
  }
}

function askForMagnetData(defaultName = "", defaultMarker = "") {
  const name = window.prompt("Namn på magneten:", defaultName);
  if (!name || !name.trim()) {
    return null;
  }

  const marker = window.prompt(
    "Nummer eller text i magneten. Lämna tomt för initialer:",
    defaultMarker || ""
  );

  return {
    name: name.trim(),
    marker: marker ? marker.trim() : ""
  };
}

function addMagnet(color, substitute = false) {
  const data = askForMagnetData();
  if (!data) {
    return;
  }

  const count = magnets.length;
  const offset = count % 10;

  const defaultX = substitute
    ? 15
    : 58 + ((offset % 5) - 2) * 6;

  const defaultY = substitute
    ? 18 + (count % 8) * 8
    : 50 + (Math.floor(offset / 5) - 1) * 8;

  magnets.push({
    id: uid(),
    name: data.name,
    marker: data.marker,
    color,
    substitute,
    x: defaultX,
    y: defaultY
  });

  persistMagnets(true);
  render();
}

function editMagnet(id) {
  const magnet = magnets.find(item => item.id === id);
  if (!magnet) {
    return;
  }

  const data = askForMagnetData(magnet.name, magnet.marker || "");
  if (!data) {
    return;
  }

  magnet.name = data.name;
  magnet.marker = data.marker;
  persistMagnets(true);
  render();
}

function startDrag(event) {
  if (event.target.closest(".delete-magnet")) {
    return;
  }

  const el = event.currentTarget;
  const id = el.dataset.id;
  const magnet = magnets.find(item => item.id === id);

  if (!magnet) {
    return;
  }

  event.preventDefault();
  el.setPointerCapture(event.pointerId);
  el.classList.add("dragging");

  activeDrag = {
    id,
    pointerId: event.pointerId,
    element: el
  };

  moveMagnet(event);
  el.addEventListener("pointermove", moveMagnet);
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
}

function moveMagnet(event) {
  if (!activeDrag) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  const clampedX = Math.max(4, Math.min(96, x));
  const clampedY = Math.max(3, Math.min(97, y));

  const magnet = magnets.find(item => item.id === activeDrag.id);
  if (!magnet) {
    return;
  }

  magnet.x = Number(clampedX.toFixed(2));
  magnet.y = Number(clampedY.toFixed(2));

  activeDrag.element.style.left = `${magnet.x}%`;
  activeDrag.element.style.top = `${magnet.y}%`;
}

function endDrag() {
  if (!activeDrag) {
    return;
  }

  const el = activeDrag.element;
  el.classList.remove("dragging");
  el.releasePointerCapture(activeDrag.pointerId);
  el.removeEventListener("pointermove", moveMagnet);
  el.removeEventListener("pointerup", endDrag);
  el.removeEventListener("pointercancel", endDrag);

  activeDrag = null;
  persistMagnets();
}

addRed.addEventListener("click", () => addMagnet("red", false));
addBlue.addEventListener("click", () => addMagnet("blue", false));
addYellow.addEventListener("click", () => addMagnet("yellow", false));
addRedSub.addEventListener("click", () => addMagnet("red", true));
addBlueSub.addEventListener("click", () => addMagnet("blue", true));

saveBoard.addEventListener("click", () => persistMagnets(true));

clearBoard.addEventListener("click", () => {
  if (!magnets.length) {
    return;
  }

  const ok = window.confirm("Vill du rensa hela tavlan?");
  if (!ok) {
    return;
  }

  magnets = [];
  persistMagnets(true);
  render();
});

loadMagnets();
render();
