// ======================
// DATA (APP STATE)
// ======================
let projects = {};
let currentProjectId = null;
let history = [];
let historyIndex = -1;
let savedSelection = { start: 0, end: 0 };
let currentDocumentId = null;
let saveTimeout;
let currentSearchQuery = "";
let searchQuery = "";
let isFocusMode = false;
let isPreviewMode = false;
let exportMode = "project";
let isModalOpen = false;
let graphAnimationFrame = null;
let graphAnimating = false;
let draggedNode = null;
let menuLocked = false;
let menuJustClosed = false;
let activeMenu = null;
let menuOpen = false;

const menus = {
  file: null,
  edit: null,
  view: null,
  help: null,
};

const regex = new RegExp(`(${escapeRegex(searchQuery)})`, "gi");

// =============
// GRAPH SYSTEM
// =============

const NODE_RADIUS = 20;
const CLICK_RADIUS = 25;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

let graphTransitioning = false;

let graphState = {
  nodes: [],
  edges: [],
  temperature: 1,
  selectedNodeId: null,
  scale: 1,
};

graphState.offsetX = 0;
graphState.offsetY = 0;

let isDraggingGraph = false;
let hasDragged = false;
let dragStartX = 0;
let dragStartY = 0;

// ======================
// ELEMENTS (DOM)
// ======================
const editorTitle = document.getElementById("editor-title");
const editorContent = document.getElementById("editor-content");
const tagInput = document.getElementById("tag-input");
const tagList = document.getElementById("tag-list");
const characterSelect = document.getElementById("character-select");
const addCharacterBtn = document.getElementById("add-character-btn");
const characterList = document.getElementById("character-list");
const searchInput = document.getElementById("search-input");
const projectSelect = document.getElementById("project-select");
const newProjectBtn = document.getElementById("new-project-btn");
const sections = document.querySelectorAll("details");
const addButtons = document.querySelectorAll(".add-btn");
const canvas = document.getElementById("graph-canvas");
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

// =====================
// STORAGE
// =====================

function savePreviewMode() {
  localStorage.setItem("tapestri_preview_mode", JSON.stringify(isPreviewMode));
}

function loadPreviewMode() {
  const saved = localStorage.getItem("tapestri_preview_mode");
  if (saved !== null) {
    isPreviewMode = JSON.parse(saved);
  }
}

function saveFocusMode() {
  localStorage.setItem("tapestri_focus_mode", JSON.stringify(isFocusMode));
}

function loadFocusMode() {
  const saved = localStorage.getItem("tapestri_focus_mode");
  if (saved !== null) {
    isFocusMode = JSON.parse(saved);
    document.body.classList.toggle("focus-mode", isFocusMode);
  }
}

function saveToLocalStorage() {
  localStorage.setItem("tapestriProjects", JSON.stringify(projects));
  localStorage.setItem("tapestriCurrentProject", currentProjectId);
}

function debounceSave() {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    saveToLocalStorage();
  }, 300);
}

function loadFromLocalStorage() {
  const data = localStorage.getItem("tapestriProjects");
  const savedProjectId = localStorage.getItem("tapestriCurrentProject");

  if (data) {
    projects = JSON.parse(data);

    for (const pid in projects) {
      const docs = projects[pid].documents;

      for (const id in docs) {
        const doc = docs[id];

        if (!doc.tags) doc.tags = [];

        if (!doc.relationships) {
          doc.relationships = { characters: [] };
        }

        if (!doc.relationships.characters) {
          doc.relationships.characters = [];
        }
      }
    }

    const projectIds = Object.keys(projects);

    if (savedProjectId && projects[savedProjectId]) {
      currentProjectId = savedProjectId;
    } else {
      currentProjectId = projectIds[0];
    }

    if (!currentProjectId) {
      currentProjectId = Object.keys(projects)[0];
    }
  } else {
    const defaultProjectId = "project1";

    projects = {
      [defaultProjectId]: {
        name: "My First Project",
        documents: {
          chapter1: {
            id: "chapter1",
            title: "Chapter 1",
            content: "",
            type: "chapter",
            tags: [],
            relationships: { characters: [] },
          },
        },
      },
    };

    currentProjectId = defaultProjectId;

    debounceSave();
  }
}

// =====================
// HELPERS
// =====================

function getDocumentById(id) {
  const docs = getCurrentDocs();
  if (!docs) return null;

  return Object.values(docs).find((doc) => doc.id === id);
}

function openMenu(name) {
  const menus = {
    file: document.getElementById("file-menu"),
    edit: document.getElementById("edit-menu"),
    view: document.getElementById("view-menu"),
    help: document.getElementById("help-menu"),
  };

  Object.values(menus).forEach((m) => (m.style.display = "none"));

  if (menus[name]) {
    menus[name].style.display = "block";
  }
}

function closeAllMenus() {
  Object.values(menus).forEach((m) => (m.style.display = "none"));
  activeMenu = null;
  menuOpen = false;
}

function focusEditor() {
  if (!editorContent) return;

  editorContent.focus();

  const length = editorContent.value.length;
  editorContent.setSelectionRange(length, length);
}

function getCurrentDocs() {
  if (!projects || !currentProjectId || !projects[currentProjectId]) {
    return {};
  }

  return projects[currentProjectId].documents;
}

function getItems() {
  return document.querySelectorAll("li[data-id]");
}

function getChaptersSorted() {
  const docs = getCurrentDocs();

  return Object.values(docs)
    .filter((doc) => doc.type === "chapter")
    .sort((a, b) => a.title.localeCompare(b.title));
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderMarkdown(text) {
  if (!text) return "";

  let html = text
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>")
    .replace(/\*(.*?)\*/gim, "<i>$1</i>")
    .replace(/__(.*?)__/gim, "<u>$1</u>")
    .replace(/\n/gim, "<br>");

  if (currentSearchQuery && currentSearchQuery.length > 0) {
    try {
      const safeQuery = escapeRegExp(currentSearchQuery);
      const regex = new RegExp(`(${safeQuery})`, "gi");
      html = html.replace(regex, `<mark>$1</mark>`);
    } catch (err) {
      console.error("Search highlight error:", err);
    }
  }

  return html;
}

function getWordCount(text) {
  if (!text) return 0;

  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function scrollToFirstMatch() {
  const match = document.querySelector("#preview-pane mark");
  if (match) {
    match.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function handleGraphClick(x, y) {
  let closestNode = null;
  let closestDistance = Infinity;
  if (hasDragged) return;

  for (const node of graphState.nodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestNode = node;
    }
  }

  if (closestNode && closestDistance <= CLICK_RADIUS) {
    if (graphTransitioning) return;

    graphTransitioning = true;

    graphState.selectedNodeId = closestNode.id;
    renderGraph();

    setTimeout(() => {
      graphTransitioning = false;
    }, 180);
  } else {
    graphState.selectedNodeId = null;
    renderGraph();
  }
}

function getConnectedNodeIds(nodeId) {
  const connected = new Set();

  graphState.edges.forEach((edge) => {
    if (edge.from === nodeId) connected.add(edge.to);
    if (edge.to === nodeId) connected.add(edge.from);
  });

  return connected;
}

function resetGraphView() {
  graphState.offsetX = 0;
  graphState.offsetY = 0;
  graphState.scale = 1;

  renderGraph();
}

// ====================
// CORE EDITOR FEATURES
// ====================

function saveDocument() {
  if (!currentDocumentId) return;

  projects[currentProjectId].documents[currentDocumentId].title =
    editorTitle.value;
  projects[currentProjectId].documents[currentDocumentId].content =
    editorContent.value;

  debounceSave();
}

function selectFirstDocument() {
  const docs = projects[currentProjectId]?.documents || {};
  const firstId = Object.keys(docs)[0];

  if (firstId) {
    loadDocument(firstId);
  }
}

function updatePreview() {
  const doc = getCurrentDocs()[currentDocumentId];
  if (!doc) return;

  const preview = document.getElementById("preview-pane");

  // 1. Render markdown FIRST
  let html = renderMarkdown(doc.content || "");

  // 2. Apply highlight ON TOP of rendered HTML
  if (searchQuery) {
    const regex = new RegExp(`(${searchQuery})`, "gi");
    html = html.replace(regex, "<mark>$1</mark>");
  }

  // 3. Render once
  preview.innerHTML = html;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatText(type) {
  const textarea = editorContent;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const doc = getCurrentDocs()[currentDocumentId];
  if (doc) {
    doc.content = editorContent.value;
  }

  const selectedText = textarea.value.substring(start, end);
  if (!selectedText) return;

  saveHistory();

  let formatted = "";

  switch (type) {
    case "bold":
      formatted = `**${selectedText}**`;
      break;
    case "italic":
      formatted = `*${selectedText}*`;
      break;
    case "underline":
      formatted = `__${selectedText}__`;
      break;
  }

  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);

  const newValue = before + formatted + after;

  textarea.value = newValue;

  textarea.focus();
  textarea.selectionStart = start;
  textarea.selectionEnd = start + formatted.length;

  history = history.slice(0, historyIndex + 1);
  history.push(newValue);
  historyIndex = history.length - 1;

  doc.content = editorContent.value;
  saveHistory();
  updatePreview();
  updateWordCount();
}

function togglePreview() {
  isPreviewMode = !isPreviewMode;

  const indicator = document.getElementById("mode-indicator");

  if (isPreviewMode) {
    indicator.classList.remove("hidden");

    graphAnimating = false;
    if (graphAnimationFrame) {
      cancelAnimationFrame(graphAnimationFrame);
      graphAnimationFrame = null;
    }
  } else {
    indicator.classList.add("hidden");

    setTimeout(() => {
      focusEditor();
    }, 0);
  }

  updateMenuState();
  applyPreviewMode();
  savePreviewMode();
}

function toggleFocusMode() {
  isFocusMode = !isFocusMode;

  document.body.classList.toggle("focus-mode", isFocusMode);

  setTimeout(() => {
    focusEditor();
  }, 0);

  saveFocusMode();
}

function applyPreviewMode() {
  const preview = document.getElementById("preview-pane");
  const textarea = document.getElementById("editor-content");

  if (isPreviewMode) {
    preview.classList.remove("hidden");
    textarea.classList.add("hidden");
    document.body.classList.add("preview-mode");
  } else {
    preview.classList.add("hidden");
    textarea.classList.remove("hidden");
    document.body.classList.remove("preview-mode");
  }

  const graphMenu = document.getElementById("open-graph-menu");

  if (graphMenu) {
    graphMenu.addEventListener("click", (e) => {
      e.stopPropagation();

      if (isPreviewMode) return;

      openGraph();
      closeAllMenus();
    });
  }

  document.body.classList.toggle("preview-mode", isPreviewMode);
}

function updateModeIndicator() {
  const indicator = document.getElementById("mode-indicator");

  if (!indicator) return;

  if (isPreviewMode && !isModalOpen) {
    indicator.classList.remove("hidden");
  } else {
    indicator.classList.add("hidden");
  }
}

function updateWordCount() {
  const text = editorContent.value;

  const words = getWordCount(text);
  const chars = text.length;

  document.getElementById("word-count").textContent =
    `Words: ${words} | Characters: ${chars}`;
}

function setEditorFontSize(size) {
  editorContent.style.fontSize = size;
  localStorage.setItem("editorFontSize", size);
}

function getGraphData() {
  const docs = getCurrentDocs();
  if (!docs) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];

  Object.values(docs).forEach((doc) => {
    // Add node
    nodes.push({
      id: String(doc.id),
      label: doc.title || "Untitled",
      type: doc.type,
    });

    // Relationships (chapters → characters)
    if (doc.type === "chapter" && doc.relationships?.characters) {
      doc.relationships.characters.forEach((charId) => {
        edges.push({
          from: String(doc.id),
          to: String(charId),
        });
      });
    }
  });

  return { nodes, edges };
}

function renderGraph() {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const selectedId = graphState.selectedNodeId;
  const connectedIds = selectedId ? getConnectedNodeIds(selectedId) : new Set();

  // Draw edges
  graphState.edges.forEach((edge) => {
    const from = graphState.nodes.find((n) => n.id === edge.from);
    const to = graphState.nodes.find((n) => n.id === edge.to);
    if (!from || !to) return;

    const isConnected = edge.from === selectedId || edge.to === selectedId;

    ctx.beginPath();
    ctx.moveTo(
      from.x * graphState.scale + graphState.offsetX,
      from.y * graphState.scale + graphState.offsetY,
    );

    ctx.lineTo(
      to.x * graphState.scale + graphState.offsetX,
      to.y * graphState.scale + graphState.offsetY,
    );

    if (!selectedId) {
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
    } else if (isConnected) {
      ctx.strokeStyle = "#f39c12";
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 1;
    }

    ctx.stroke();
  });

  // Draw nodes
  graphState.nodes.forEach((node) => {
    const isSelected = node.id === selectedId;
    const isConnected = connectedIds.has(node.id);

    ctx.beginPath();
    ctx.arc(
      node.x * graphState.scale + graphState.offsetX,
      node.y * graphState.scale + graphState.offsetY,
      NODE_RADIUS * graphState.scale,
      0,
      Math.PI * 2,
    );

    if (isSelected) {
      ctx.shadowColor = "#f39c12";
      ctx.shadowBlur = 15;
    } else {
      ctx.shadowBlur = 0;
    }

    if (!selectedId) {
      ctx.fillStyle = node.type === "character" ? "#2980b9" : "#27ae60";
    } else if (isSelected) {
      ctx.fillStyle = "#f39c12";
    } else if (isConnected) {
      ctx.fillStyle = "#3498db";
    } else {
      ctx.fillStyle = "#555";
    }

    ctx.fill();

    // Reset shadow AFTER drawing
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(
      node.label,
      node.x * graphState.scale + graphState.offsetX,
      node.y * graphState.scale + graphState.offsetY + 35,
    );
  });
}

function applyForces() {
  const nodes = graphState.nodes;
  const edges = graphState.edges;

  graphState.temperature *= 0.98;

  if (!nodes.length) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // REPULSION (push nodes apart)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const force = (6000 / (dist * dist)) * graphState.temperature;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;

      const minDist = 80;

      if (dist < minDist) {
        const push = (minDist - dist) * 0.01;
        const fx = (dx / dist) * push;
        const fy = (dy / dist) * push;

        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
  }

  // CENTER GRAVITY (keep nodes on screen)
  nodes.forEach((node) => {
    node.vx += (centerX - node.x) * 0.0005;
    node.vy += (centerY - node.y) * 0.0005;
  });

  // EDGE ATTRACTION (connected nodes pull together)
  edges.forEach((edge) => {
    const a = nodes.find((n) => n.id === edge.from);
    const b = nodes.find((n) => n.id === edge.to);

    if (!a || !b) return;

    const dx = b.x - a.x;
    const dy = b.y - a.y;

    a.vx += dx * 0.002 * graphState.temperature;
    a.vy += dy * 0.002 * graphState.temperature;
    b.vx -= dx * 0.002 * graphState.temperature;
    b.vy -= dy * 0.002 * graphState.temperature;
  });

  // APPLY VELOCITY + LIMITS
  const padding = 40;

  nodes.forEach((node) => {
    node.x += node.vx;
    node.y += node.vy;

    // Damping
    node.vx *= 0.9;
    node.vy *= 0.9;

    // Clamp to canvas
    node.x = Math.max(padding, Math.min(canvas.width - padding, node.x));
    node.y = Math.max(padding, Math.min(canvas.height - padding, node.y));

    // Limit velocity
    node.vx = Math.max(-4, Math.min(4, node.vx));
    node.vy = Math.max(-4, Math.min(4, node.vy));
  });
}

function animateGraph() {
  if (!graphAnimating) return;

  if (graphState.temperature < 0.01) {
    graphAnimating = false;
    return;
  }

  graphState.nodes.forEach((node) => {
    node.x += Math.random() * 2 - 1;
    node.y += Math.random() * 2 - 1;
  });

  applyForces();
  renderGraph();

  graphAnimationFrame = requestAnimationFrame(animateGraph);
}

function openGraph() {
  if (isPreviewMode) return;

  const modal = document.getElementById("graph-modal");
  modal.classList.remove("hidden");

  // HARD RESET
  graphAnimating = false;

  if (graphAnimationFrame) {
    cancelAnimationFrame(graphAnimationFrame);
    graphAnimationFrame = null;
  }

  // RESET STATE
  graphState.nodes = [];
  graphState.edges = [];
  graphState.offsetX = 0;
  graphState.offsetY = 0;
  graphState.scale = 1;
  graphState.temperature = 1;
  graphState.selectedNodeId = null;

  // Canvas sizing
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  // Build graph
  const data = getGraphData();

  graphState.nodes = data.nodes.map((node) => ({
    ...node,
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
  }));

  if (graphState.temperature < 0.01) {
    graphAnimating = false;
    return;
  }

  graphState.edges = data.edges;

  // RESTART LOOP
  graphAnimating = true;
  animateGraph();
}

function closeGraph() {
  const modal = document.getElementById("graph-modal");
  modal.classList.add("hidden");

  graphAnimating = false;

  if (graphAnimationFrame) {
    cancelAnimationFrame(graphAnimationFrame);
    graphAnimationFrame = null;
  }
}

function openDocumentFromGraph(id) {
  closeGraph();
  loadDocument(id);

  setTimeout(() => {
    editorContent.focus();
  }, 100);
}

// ======================
// HISTORY SYSTEM
// ======================

function saveHistory() {
  const value = editorContent.value;

  if (historyIndex >= 0 && history[historyIndex] === value) return;

  history = history.slice(0, historyIndex + 1);
  history.push(value);
  historyIndex = history.length - 1;
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    editorContent.value = history[historyIndex];

    updatePreview();
    updateWordCount();
    saveDocument();
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    editorContent.value = history[historyIndex];

    updatePreview();
    updateWordCount();
    saveDocument();
  }
}

// ======================
// TAG SYSTEM
//=======================

function renderTags(doc) {
  tagList.innerHTML = "";

  if (!doc || !doc.tags) return;

  doc.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    span.classList.add("tag");

    span.addEventListener("click", () => {
      removeTag(tag);
    });

    tagList.appendChild(span);
  });
}

function addTag(tag) {
  if (!currentDocumentId) return;

  const doc = projects[currentProjectId].documents[currentDocumentId];

  if (!doc.tags.includes(tag)) {
    doc.tags.push(tag);
  }

  renderTags(doc);
  debounceSave();
}

function removeTag(tag) {
  if (!currentDocumentId) return;

  const doc = projects[currentProjectId].documents[currentDocumentId];

  doc.tags = doc.tags.filter((t) => t !== tag);

  renderTags(doc);
  debounceSave();
}

// ======================
// RELATIONSHIPS
// ======================

function populateCharacterSelect() {
  characterSelect.innerHTML = "";

  const docs = projects[currentProjectId]?.documents || {};

  for (const id in docs) {
    const doc = projects[currentProjectId].documents[id];

    if (doc.type === "character") {
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.title;

      characterSelect.appendChild(option);
    }
  }
}

function renderCharacterRelationships(id) {
  const docs = getCurrentDocs();
  const doc = docs[id];

  const characterList = document.getElementById("character-list");
  characterList.innerHTML = "";

  if (!doc || !doc.relationships || !doc.relationships.characters) return;

  doc.relationships.characters.forEach((charId) => {
    const charDoc = docs[charId];
    if (!charDoc) return;

    const li = document.createElement("li");
    li.textContent = "👤 " + charDoc.title;

    li.addEventListener("click", () => {
      removeCharacterFromChapter(charId);
    });

    characterList.appendChild(li);
  });
}

function addCharacterToChapter() {
  if (!currentDocumentId) return;

  const doc = projects[currentProjectId].documents[currentDocumentId];

  if (doc.type !== "chapter") return;

  const charId = characterSelect.value;
  if (!charId) return;

  if (!doc.relationships.characters.includes(charId)) {
    doc.relationships.characters.push(charId);
  }

  renderCharacterRelationships(currentDocumentId);
  debounceSave();
}

function removeCharacterFromChapter(charId) {
  const doc = projects[currentProjectId].documents[currentDocumentId];

  doc.relationships.characters = doc.relationships.characters.filter(
    (id) => id !== charId,
  );

  renderCharacterRelationships(currentDocumentId);
  debounceSave();
}

function getChaptersForCharacter(characterId) {
  const chapters = [];

  const docs = projects[currentProjectId]?.documents || {};

  for (const id in docs) {
    const doc = projects[currentProjectId].documents[id];

    if (doc.type === "chapter") {
      if (
        doc.relationships &&
        doc.relationships.characters &&
        doc.relationships.characters.includes(characterId)
      ) {
        chapters.push(doc);
      }
    }
  }
  return chapters;
}

function renderChapterAppearances(characterId) {
  const list = document.getElementById("chapter-appearances");
  list.innerHTML = "";

  const chapters = getChaptersForCharacter(characterId);

  chapters.forEach((chapter) => {
    const li = document.createElement("li");
    li.textContent = chapter.title;

    li.addEventListener("click", () => {
      loadDocument(chapter.id);
    });
    list.appendChild(li);
  });
}

// =========================
// DOCUMENT MANAGEMENT
// =========================

function loadDocument(id) {
  const docs = getCurrentDocs();
  const doc = docs[id];

  if (!doc) return;

  currentDocumentId = id;

  editorTitle.value = doc.title || "";
  editorContent.value = doc.content || "";

  document.getElementById("empty-state").style.display = "none";

  renderTags(doc);
  renderCharacterRelationships(id);
  populateCharacterSelect();

  const appearancesContainer = document.querySelector(".reverse-relationships");

  if (doc.type === "character") {
    appearancesContainer.style.display = "block";
    renderChapterAppearances(id);
  } else {
    appearancesContainer.style.display = "none";
  }

  document
    .querySelectorAll("li")
    .forEach((li) => li.classList.remove("active"));

  const activeItem = document.querySelector(`[data-id="${id}"]`);
  if (activeItem) activeItem.classList.add("active");

  history = [editorContent.value];
  historyIndex = 0;

  updateWordCount();
  updatePreview();
}

function clearEditor() {
  editorTitle.value = "";
  editorContent.value = "";

  tagList.innerHTML = "";
  characterList.innerHTML = "";

  const appearances = document.getElementById("chapter-appearances");
  if (appearances) appearances.innerHTML = "";

  characterSelect.innerHTML = "";
  document.getElementById("empty-state").style.display = "block";
}

function addNewItem(section) {
  const ul = section.querySelector("ul");

  if (!ul) {
    console.error("No UL found in section");
    return;
  }

  const type = ul.dataset.type;
  const id = Date.now().toString();

  const newLi = document.createElement("li");
  newLi.textContent = "New " + type;
  newLi.dataset.id = id;
  newLi.dataset.type = type;

  ul.appendChild(newLi);

  projects[currentProjectId].documents[id] = {
    id: id,
    title: newLi.textContent,
    content: "",
    type: type,
    tags: [],
    relationships: {
      characters: [],
    },
  };

  attachItemListeners(newLi);
  handleItemClick(newLi);
  debounceSave();
}

function renameItem(item) {
  const newName = prompt("Enter new name:");

  if (!newName) return;

  item.textContent = newName;

  const id = item.dataset.id;
  projects[currentProjectId].documents[id].title = newName;

  if (currentDocumentId === id) {
    editorTitle.value = newName;
  }

  debounceSave();
}

function deleteItem(item) {
  const confirmDelete = confirm("Delete this item?");

  if (!confirmDelete) return;

  const id = item.dataset.id;

  delete projects[currentProjectId].documents[id];

  const nextItem = item.nextElementSibling || item.previousElementSibling;

  item.remove();

  if (nextItem) {
    handleItemClick(nextItem);
  } else {
    editorTitle.value = "";
    editorContent.value = "";
    currentDocumentId = null;
  }

  debounceSave();
}

function setActiveItem(clickedItem) {
  getItems().forEach((item) => item.classList.remove("active"));
  clickedItem.classList.add("active");
}

function handleItemClick(item) {
  const id = item.dataset.id;

  currentDocumentId = id;
  loadDocument(id);
  setActiveItem(item);
}

// ===========================
// PROJECT SYSTEM
// ===========================

function renderSidebar() {
  const lists = document.querySelectorAll("ul");
  lists.forEach((list) => {
    list.innerHTML = "";
  });

  const docs = projects[currentProjectId]?.documents || {};

  for (const id in docs) {
    const doc = docs[id];

    const matchesSearch =
      !searchQuery ||
      (doc.title || "").toLowerCase().includes(searchQuery) ||
      (doc.content || "").toLowerCase().includes(searchQuery) ||
      (doc.tags || []).some((tag) => tag.toLowerCase().includes(searchQuery)) ||
      (doc.type === "character" &&
        doc.title.toLowerCase().includes(searchQuery));

    if (!matchesSearch) continue;

    const li = document.createElement("li");
    li.textContent = doc.title;
    li.dataset.id = doc.id;
    li.dataset.type = doc.type;

    const list = document.querySelector(`ul[data-type="${doc.type}"]`);
    if (list) {
      list.appendChild(li);
      attachItemListeners(li);
    }
  }
}

function createNewProject() {
  const name = prompt("Project name?");
  if (!name) return;

  const id = "project_" + Date.now();

  projects[id] = {
    name: name,
    documents: {},
  };

  currentProjectId = id;

  debounceSave();
  renderProjectList();
  renderSidebar();
}

function deleteProject() {
  if (!currentProjectId) return;

  const confirmDelete = confirm(
    "Are you sure you want to delete this project?",
  );

  if (!confirmDelete) return;

  delete projects[currentProjectId];

  const remainingIds = Object.keys(projects);

  currentProjectId = remainingIds[0] || null;

  debounceSave();
  renderProjectList();
  renderSidebar();
  clearEditor();
}

function renameProject() {
  if (!currentProjectId) return;

  const newName = prompt("Rename project:");
  if (!newName) return;

  projects[currentProjectId].name = newName;

  debounceSave();
  renderProjectList();
}

function renderProjectList() {
  projectSelect.innerHTML = "";

  for (const pid in projects) {
    const option = document.createElement("option");

    option.value = pid;
    option.textContent = projects[pid].name;

    if (pid === currentProjectId) {
      option.selected = true;
    }

    projectSelect.appendChild(option);
  }
}

function searchDocuments(query) {
  query = query.toLowerCase();

  const lists = document.querySelectorAll("ul");
  lists.forEach((list) => (list.innerHTML = ""));

  const docs = projects[currentProjectId]?.documents || {};

  for (const id in docs) {
    const doc = projects[currentProjectId].documents[id];

    if (
      doc.title.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query)
    ) {
      const li = document.createElement("li");
      li.textContent = doc.title;
      li.dataset.id = doc.id;
      li.dataset.type = doc.type;

      const list = document.querySelector(`ul[data-type="${doc.type}"]`);
      if (list) {
        list.appendChild(li);
        attachItemListeners(li);
      }
    }
  }
}

// =====================
// EXPORT SYSTEM
// =====================

function openExportModal() {
  const modal = document.getElementById("export-modal");

  isModalOpen = true;

  modal.classList.remove("hidden");

  updateModeIndicator();

  document.getElementById("mode-indicator")?.classList.add("hidden");

  const input = document.getElementById("export-filename");
  input.value = exportMode === "document" ? "document.md" : "project.md";
  input.focus();

  const options = modal.querySelector(".export-options");
  options.innerHTML = "";

  const project = projects[currentProjectId];
  if (!project) return;

  if (exportMode === "document") {
    const docs = getCurrentDocs();

    options.innerHTML = Object.values(docs)
      .map(
        (doc) => `
        <label>
          <input type="checkbox" value="${doc.id}" checked />
          ${doc.title || "Untitled"}
        </label>
      `,
      )
      .join("");
  } else {
    const sections = [
      { key: "chapter", label: "Manuscript" },
      { key: "character", label: "Characters" },
      { key: "world", label: "Worldbuilding" },
      { key: "timeline", label: "Timeline" },
      { key: "notes", label: "Notes" },
      { key: "ideas", label: "Ideas" },
    ];

    options.innerHTML = sections
      .map(
        (section) => `
        <label>
          <input type="checkbox" value="${section.key}" checked />
          ${section.label}
        </label>
      `,
      )
      .join("");
  }
  closeAllMenus();
}

function closeExportModal() {
  document.getElementById("export-modal").classList.add("hidden");
  focusEditor();
}

function handleExportConfirm() {
  const filename = document.getElementById("export-filename").value.trim();
  if (!filename) return;

  let content = "";

  if (exportMode === "document") {
    const selectedDocs = Array.from(
      document.querySelectorAll("#export-modal input[type='checkbox']:checked"),
    ).map((cb) => cb.value);

    const docs = getCurrentDocs();

    content = selectedDocs
      .map((id) => docs[id])
      .filter(Boolean)
      .map((doc) => documentToMarkdown(doc))
      .join("\n\n");
  } else {
    const selectedSections = Array.from(
      document.querySelectorAll("#export-modal input[type='checkbox']:checked"),
    ).map((cb) => cb.value);

    content = buildExportContent(selectedSections);
  }

  const formatSelect = document.getElementById("export-format");
  const format = formatSelect.value;

  let finalFilename = filename.replace(/\.(md|txt)$/i, "");

  let finalContent = content;

  if (format === "txt") {
    finalFilename += ".txt";
    finalContent = convertToPlainText(content);
  } else {
    finalFilename += ".md";
  }

  downloadFile(finalFilename, finalContent);
  closeExportModal();
}

function buildExportContent(selectedSections) {
  const docs = getCurrentDocs();
  if (!docs) return "";

  let output = "";

  const sectionTitles = {
    chapter: "Manuscript",
    character: "Characters",
    world: "Worldbuilding",
    timeline: "Timeline",
    notes: "Notes",
    ideas: "Ideas",
  };

  selectedSections.forEach((section) => {
    const filteredDocs = Object.values(docs).filter(
      (doc) => doc.type === section,
    );

    if (filteredDocs.length === 0) return;

    output += `# ${sectionTitles[section] || section}\n\n`;

    filteredDocs.forEach((doc) => {
      output += `## ${doc.title || "Untitled"}\n\n`;
      output += `${doc.content || ""}\n\n`;
    });
  });

  return output;
}

function exportCurrentDocument() {
  const doc = getCurrentDocs()[currentDocumentId];
  if (!doc) return "";

  return `# ${doc.title}\n\n${doc.content}`;
}

function projectToMarkdown() {
  const docs = getCurrentDocs();

  let md = `# ${projects[currentProjectId].name}\n\n`;

  for (const id in docs) {
    const doc = docs[id];

    if (doc.type === "chapter") {
      md += documentToMarkdown(doc);
    }
  }

  return md;
}

function documentToMarkdown(doc) {
  let md = `## ${doc.title}\n\n`;

  if (doc.tags?.length) {
    md += `> Tags: ${doc.tags.join(", ")}\n\n`;
  }

  md += `${doc.content.trim()}\n\n---\n\n`;

  return md;
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/markdown" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function convertToPlainText(markdown) {
  return markdown
    .replace(/^# /gm, "")
    .replace(/^## /gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__/g, "")
    .replace(/<u>|<\/u>/g, "");
}

function openHelpModal(title, content) {
  const modal = document.getElementById("help-modal");

  isModalOpen = true;

  modal.classList.remove("hidden");

  document.getElementById("help-title").textContent = title;
  document.getElementById("help-body").innerHTML = content;

  updateModeIndicator();
}

function closeHelpModal() {
  document.getElementById("help-modal").classList.add("hidden");

  isModalOpen = false;

  updateModeIndicator();
  focusEditor();
}

function getAboutContent() {
  return `
    <p><strong>Tapestri</strong> is an AI-enhanced creative writing studio.</p>
    <p>Designed for long-form storytelling, worldbuilding, and character development.</p>
    <p>Built to evolve into a fully local AI-powered writing system.</p>
  `;
}

function getShortcutsContent() {
  return `
    <ul>
      <li><strong>Ctrl + B</strong> — Bold</li>
      <li><strong>Ctrl + I</strong> — Italic</li>
      <li><strong>Ctrl + U</strong> — Underline</li>
      <li><strong>Ctrl + P</strong> — Toggle Preview</li>
      <li><strong>Ctrl + Z</strong> — Undo</li>
      <li><strong>Ctrl + Shift + Z</strong> — Redo</li>
      <li><strong>Tab</strong> — Indent</li>
    </ul>
  `;
}

// =====================
// MENU SYSTEM
// =====================

function handleMenuAction(action) {
  activeMenu = null;
  closeAllMenus();

  setTimeout(action, 0);
}

function updateMenuState() {
  const graphItem = document.getElementById("open-graph-menu");
  if (!graphItem) return;

  if (isPreviewMode) {
    graphItem.classList.add("disabled");
  } else {
    graphItem.classList.remove("disabled");
  }
}

function initMenuSystem() {
  menus.file = document.getElementById("file-menu");
  menus.edit = document.getElementById("edit-menu");
  menus.view = document.getElementById("view-menu");
  menus.help = document.getElementById("help-menu");

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (menuLocked) return;

      e.stopPropagation();

      const menuName = item.dataset.menu;
      const menu = menus[menuName];

      if (activeMenu === menuName) {
        closeAllMenus();
        menuOpen = false;
        return;
      }

      Object.values(menus).forEach((m) => (m.style.display = "none"));
      menu.style.display = "block";

      activeMenu = menuName;
      menuOpen = true;
    });

    item.addEventListener("mouseenter", () => {
      if (!menuOpen) return;

      const menuName = item.dataset.menu;
      const menu = menus[menuName];

      if (menuName === activeMenu) return;

      Object.values(menus).forEach((m) => (m.style.display = "none"));
      menu.style.display = "block";

      activeMenu = menuName;
    });
  });

  document.addEventListener("click", () => {
    closeAllMenus();
  });

  document.addEventListener("mousedown", (e) => {
    const isMenuItem = e.target.closest(".menu-item");
    const isDropdown = e.target.closest(".menu-dropdown");

    if (isMenuItem || isDropdown) return;

    closeAllMenus();
  });

  const exportProject = document.getElementById("export-project");

  if (exportProject) {
    exportProject.addEventListener("click", () => {
      exportMode = "project";
      openExportModal();
    });
  }

  const exportDoc = document.getElementById("export-doc");

  if (exportDoc) {
    exportDoc.addEventListener("click", () => {
      exportMode = "document";
      openExportModal();
    });
  }

  const helpAbout = document.getElementById("help-about");

  if (helpAbout) {
    helpAbout.addEventListener("click", () => {
      openHelpModal("About Tapestri", getAboutContent());
    });
  }

  const helpShortcuts = document.getElementById("help-shortcuts");

  if (helpShortcuts) {
    helpShortcuts.addEventListener("click", () => {
      openHelpModal("Keyboard Shortcuts", getShortcutsContent());
    });
  }

  const closeHelp = document.getElementById("close-help");

  if (closeHelp) {
    closeHelp.addEventListener("click", closeHelpModal);
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
  });
}

// =====================
// EVENTS SYSTEM
// =====================

function initEditorEvents() {
  editorContent.addEventListener("select", () => {
    savedSelection.start = editorContent.selectionStart;
    savedSelection.end = editorContent.selectionEnd;
  });

  editorContent.addEventListener("input", () => {
    let doc = getCurrentDocs()[currentDocumentId];

    if (!doc) {
      const docs = getCurrentDocs();
      const firstId = Object.keys(docs)[0];
      if (firstId) {
        loadDocument(firstId);
        doc = docs[firstId];
      } else {
        return;
      }
    }

    doc.content = editorContent.value;

    saveHistory();
    updatePreview();
    updateWordCount();
    debounceSave();
  });

  const fontSize = document.getElementById("font-size");

  if (fontSize) {
    fontSize.addEventListener("change", (e) => {
      const start = editorContent.selectionStart;
      const end = editorContent.selectionEnd;

      setEditorFontSize(e.target.value);

      focusEditor();
      editorContent.setSelectionRange(start, end);
    });
  }

  editorContent.addEventListener("keydown", (e) => {
    // UNDO / REDO
    if (e.ctrlKey && e.key.toLowerCase() === "z") {
      e.preventDefault();

      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "g") {
      e.preventDefault();
      openGraph();
    }

    // TAB HANDLING
    if (e.key === "Tab") {
      e.preventDefault();

      const textarea = editorContent;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      const before = value.substring(0, start);
      const selection = value.substring(start, end);
      const after = value.substring(end);

      const tab = "  ";

      if (selection.includes("\n")) {
        const indented = selection
          .split("\n")
          .map((line) => tab + line)
          .join("\n");

        textarea.value = before + indented + after;
        textarea.selectionStart = start;
        textarea.selectionEnd = start + indented.length;
      } else {
        textarea.value = before + tab + after;
        textarea.selectionStart = textarea.selectionEnd = start + tab.length;
      }

      saveHistory();
      updatePreview();
      updateWordCount();
      saveDocument();
    }
  });

  editorTitle.addEventListener("input", () => {
    const doc = getCurrentDocs()[currentDocumentId];
    if (!doc) return;

    doc.title = editorTitle.value;
    debounceSave();
    renderSidebar();
  });

  editorTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadDocument(currentDocumentId);
      focusEditor();
    }
  });
}

function initSidebarEvents() {
  addButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const section = button.closest("details");
      addNewItem(section);
    });
  });
}

function initKeyboardShortcuts() {
  editorContent.addEventListener("keydown", (e) => {
    if (!e.ctrlKey) return;

    document.addEventListener("keydown", (e) => {
      if (e.altKey) {
        const key = e.key.toLowerCase();

        if (key === "f") openMenu("file");
        if (key === "e") openMenu("edit");
        if (key === "v") openMenu("view");
        if (key === "h") openMenu("help");
      }

      if (e.key.toLowerCase() === "c") {
        resetGraphView();
      }
    });

    switch (e.key.toLowerCase()) {
      case "b":
        e.preventDefault();
        formatText("bold");
        break;
      case "i":
        e.preventDefault();
        formatText("italic");
        break;
      case "u":
        e.preventDefault();
        formatText("underline");
        break;
    }
    closeAllMenus();
  });

  document.addEventListener("keydown", (e) => {
    // PREVIEW
    if (e.ctrlKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      togglePreview();
      return;
    }

    // FOCUS MODE
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      toggleFocusMode();
      return;
    }

    // Ignore modifier-only presses
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // If user is typing (real character keys)
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
      if (activeMenu) {
        closeAllMenus();
      }
    }

    // ESCAPE
    if (e.key === "Escape") {
      const graphModal = document.getElementById("graph-modal");
      const helpModal = document.getElementById("help-modal");

      if (graphModal && !graphModal.classList.contains("hidden")) {
        graphModal.classList.add("hidden");
        graphAnimating = false;

        if (isPreviewMode) {
          document.getElementById("mode-indicator")?.classList.remove("hidden");
        }

        setTimeout(() => focusEditor(), 0);
        return;
      }

      if (helpModal && !helpModal.classList.contains("hidden")) {
        helpModal.classList.add("hidden");
        setTimeout(() => focusEditor(), 0);
        return;
      }

      if (document.body.classList.contains("focus-mode")) {
        toggleFocusMode();
        return;
      }

      if (e.key === "Escape") {
        Object.values(menus).forEach((menu) => {
          menu.style.display = "none";
        });
        activeMenu = null;
        Object.values(menus).forEach((menu) => {
          menu.style.display = "none";
        });
      }
    }
  });
}

function initGraphEvents() {
  const canvas = document.getElementById("graph-canvas");

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();

    const x = (e.clientX - rect.left - graphState.offsetX) / graphState.scale;
    const y = (e.clientY - rect.top - graphState.offsetY) / graphState.scale;

    hasDragged = false;

    //  Check if clicking a node
    draggedNode = null;

    for (const node of graphState.nodes) {
      // Convert node to SCREEN space
      const screenX = node.x * graphState.scale + graphState.offsetX;
      const screenY = node.y * graphState.scale + graphState.offsetY;
      const dx = screenX - (e.clientX - rect.left);
      const dy = screenY - (e.clientY - rect.top);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scaledRadius = NODE_RADIUS * graphState.scale;

      if (distance <= scaledRadius) {
        draggedNode = node;

        // offset still in WORLD space
        const worldX =
          (e.clientX - rect.left - graphState.offsetX) / graphState.scale;
        const worldY =
          (e.clientY - rect.top - graphState.offsetY) / graphState.scale;

        nodeOffsetX = worldX - node.x;
        nodeOffsetY = worldY - node.y;

        break;
      }
    }

    if (draggedNode) {
      // Node dragging
      return;
    }

    // Graph dragging
    isDraggingGraph = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();

    //  NODE DRAG
    if (draggedNode) {
      hasDragged = true;

      draggedNode.x =
        (e.clientX - rect.left - graphState.offsetX) / graphState.scale -
        nodeOffsetX;

      draggedNode.y =
        (e.clientY - rect.top - graphState.offsetY) / graphState.scale -
        nodeOffsetY;

      renderGraph();
      return;
    }

    //  GRAPH DRAG
    if (!isDraggingGraph) return;

    hasDragged = true;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    graphState.offsetX += dx;
    graphState.offsetY += dy;

    dragStartX = e.clientX;
    dragStartY = e.clientY;

    renderGraph();
  });

  canvas.addEventListener("mouseup", () => {
    isDraggingGraph = false;
    draggedNode = null;
  });

  canvas.addEventListener("mouseleave", () => {
    isDraggingGraph = false;
    draggedNode = null;
  });

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    handleGraphClick(
      (mouseX - graphState.offsetX) / graphState.scale,
      (mouseY - graphState.offsetY) / graphState.scale,
    );
  });

  canvas.addEventListener("dblclick", (e) => {
    const rect = canvas.getBoundingClientRect();

    const x = (e.clientX - rect.left - graphState.offsetX) / graphState.scale;

    const y = (e.clientY - rect.top - graphState.offsetY) / graphState.scale;

    let closestNode = null;
    let closestDistance = Infinity;

    for (const node of graphState.nodes) {
      const dx = node.x - x;
      const dy = node.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestNode = node;
      }
    }

    if (closestNode && closestDistance <= NODE_RADIUS) {
      openDocumentFromGraph(closestNode.id);
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleAmount = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;

    const newScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, graphState.scale + direction * scaleAmount),
    );

    // Zoom toward cursor
    const scaleRatio = newScale / graphState.scale;

    graphState.offsetX = mouseX - (mouseX - graphState.offsetX) * scaleRatio;
    graphState.offsetY = mouseY - (mouseY - graphState.offsetY) * scaleRatio;
    graphState.scale = newScale;

    renderGraph();
  });

  // Graph open
  const openGraphBtn = document.getElementById("open-graph");
  if (openGraphBtn) {
    openGraphBtn.addEventListener("click", openGraph);
  }

  // Graph close
  const closeGraphBtn = document.getElementById("close-graph");
  if (closeGraphBtn) {
    closeGraphBtn.addEventListener("click", closeGraph);
  }
}

function initEventListeners() {
  getItems().forEach((item) => {
    attachItemListeners(item);
  });

  document.addEventListener("mousedown", (e) => {
    const isEditor = e.target.closest("#editor-content");
    const isPreview = e.target.closest("#preview-pane");
    const isUI = e.target.closest(
      "button, input, select, .menu-item, .menu-dropdown",
    );
  });

  const newProject = document.getElementById("new-project");

  if (newProject) {
    newProject.addEventListener("click", () => {
      document.getElementById("new-project-btn").click();
    });
  }

  document.querySelectorAll("#edit-menu [data-format]").forEach((item) => {
    item.addEventListener("click", () => {
      formatText(item.dataset.format);
      closeAllMenus();
    });
  });

  const toggleFocus = document.getElementById("toggle-focus");

  if (toggleFocus) {
    toggleFocus.addEventListener("click", () => {
      toggleFocusMode();
      closeAllMenus();
    });
  }

  const togglePreviewMenu = document.getElementById("toggle-preview-menu");

  if (togglePreviewMenu) {
    togglePreviewMenu.addEventListener("click", () => {
      handleMenuAction(togglePreview);
    });
    updateMenuState();
  }

  const indicator = document.getElementById("mode-indicator");

  if (indicator) {
    indicator.addEventListener("click", () => {
      togglePreview();
    });
  }

  const togglePreviewBtn = document.getElementById("togglePreviewBtn");

  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener("click", togglePreview);
  }

  let currentSearchQuery = "";

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();

    renderSidebar();
    updatePreview();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      editorContent.focus();
      scrollToFirstMatch();
    }
  });

  tagInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const tag = tagInput.value.trim();

      if (tag) {
        addTag(tag);
        tagInput.value = "";
      }
    }
  });

  getItems().forEach((item) => {
    item.addEventListener("click", () => handleItemClick(item));
    item.addEventListener("dblclick", () => renameItem(item));
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      deleteItem(item);
    });
  });

  addCharacterBtn.addEventListener("click", addCharacterToChapter);
  newProjectBtn.addEventListener("click", createNewProject);

  projectSelect.addEventListener("change", () => {
    currentProjectId = projectSelect.value;
    currentDocumentId = null;

    debounceSave();
    renderProjectList();
    renderSidebar();

    selectFirstDocument();
  });

  const renameProjectBtn = document.getElementById("rename-project-btn");

  if (renameProjectBtn) {
    renameProjectBtn.addEventListener("click", renameProject);
  }

  const deleteProjectBtn = document.getElementById("delete-project-btn");

  if (deleteProjectBtn) {
    deleteProjectBtn.addEventListener("click", deleteProject);
  }

  const confirmExport = document.getElementById("confirm-export");

  if (confirmExport) {
    confirmExport.addEventListener("click", handleExportConfirm);
  }

  const cancelExport = document.getElementById("cancel-export");

  if (cancelExport) {
    cancelExport.addEventListener("click", closeExportModal);
  }
}

function attachItemListeners(item) {
  item.addEventListener("click", () => {
    handleItemClick(item);
  });

  item.addEventListener("dblclick", () => {
    renameItem(item);
  });

  item.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    deleteItem(item);
  });
}

// =====================
// INIT
// =====================

function initApp() {
  loadFromLocalStorage();

  initMenuSystem();
  initEditorEvents();
  initSidebarEvents();
  initKeyboardShortcuts();
  initGraphEvents();
  initEventListeners();

  renderProjectList();
  renderSidebar();
  selectFirstDocument();

  updatePreview();
  loadPreviewMode();
  applyPreviewMode();
  loadFocusMode();

  saveHistory();

  const savedSize = localStorage.getItem("editorFontSize");
  if (savedSize) {
    setEditorFontSize(savedSize);
    document.getElementById("font-size").value = savedSize;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
