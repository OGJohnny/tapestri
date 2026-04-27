// =====================
// GLOBAL STATE
// =====================

const appState = {
  currentProjectId: null,
  currentDocumentId: null,
};

const editorState = {
  history: [],
  historyIndex: -1,

  savedSelection: {
    start: 0,
    end: 0,
  },

  lastSelectionStart: 0,
  lastSelectionEnd: 0,

  isRestoring: false,
  isProgrammaticEdit: false,
};

const graphState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,

  scale: 1,
  offsetX: 0,
  offsetY: 0,

  filters: {
    chapter: true,
    character: true,
    tag: true,
  },

  focusMode: true,

  dragging: {
    isDraggingGraph: false,
    hasDragged: false,
    draggedNode: null,
    startX: 0,
    startY: 0,
    nodeOffsetX: 0,
    nodeOffsetY: 0,
  },
};

const menuState = {
  activeMenu: null,
  isLocked: false,
};

const menus = {
  file: null,
  edit: null,
  view: null,
  help: null,
};

const NODE_RADIUS = 20;
const CLICK_RADIUS = 25;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

let historyDebounceTimer = null;
let graphAnimating = false;
let graphAnimationFrame = null;
let graphTransitioning = false;
let menuJustClosed = false;
let menuOpen = false;
let projects = {};
let saveTimeout;
let currentSearchQuery = "";
let searchQuery = "";
let isFocusMode = false;
let isPreviewMode = false;
let isTogglingPreview = false;
let exportMode = "project";
let isModalOpen = false;
let eventsInitialized = false;
let isRestoringHistory = false;
let isProgrammaticEdit = false;

// ====================
// DOM REFERENCES
// ====================

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

// ====================
// GLOBAL HELPERS
// ====================

function getCurrentDocs() {
  if (
    !projects ||
    !appState.currentProjectId ||
    !projects[appState.currentProjectId]
  ) {
    return {};
  }

  return projects[appState.currentProjectId].documents;
}

function getDocumentById(id) {
  const docs = getCurrentDocs();
  if (!docs) return null;

  return Object.values(docs).find((doc) => doc.id === id);
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
  localStorage.setItem("tapestriCurrentProject", appState.currentProjectId);
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
      appState.currentProjectId = savedProjectId;
    } else {
      appState.currentProjectId = projectIds[0];
    }

    if (!appState.currentProjectId) {
      appState.currentProjectId = Object.keys(projects)[0];
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

    appState.currentProjectId = defaultProjectId;

    debounceSave();
  }
}

function debounceSave() {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    saveToLocalStorage();
  }, 300);
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

function getConnectedNodeIds(nodeId) {
  const connected = new Set();

  graphState.edges.forEach((edge) => {
    if (edge.from === nodeId) connected.add(edge.to);
    if (edge.to === nodeId) connected.add(edge.from);
  });

  return connected;
}

function getConnectedNodeIds(nodeId) {
  const connected = new Set();

  graphState.edges.forEach((edge) => {
    if (edge.from === nodeId) connected.add(edge.to);
    if (edge.to === nodeId) connected.add(edge.from);
  });

  return connected;
}

// ==============================================
//                GRAPH SYSTEM
// ==============================================
// ====================
// GRAPH RENDERING
// ====================

function renderGraph() {
  const visibleNodes = graphState.nodes.filter(
    (node) => graphState.filters[node.type],
  );

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const selectedId = graphState.selectedNodeId;
  const connectedIds = selectedId ? getConnectedNodeIds(selectedId) : new Set();

  // Draw edges
  graphState.edges.forEach((edge) => {
    const from = visibleNodes.find((n) => n.id === edge.from);
    const to = visibleNodes.find((n) => n.id === edge.to);
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

    if (!selectedId || !graphState.focusMode) {
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
    } else if (isConnected) {
      ctx.strokeStyle = "#f39c12";
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
    }

    ctx.stroke();
  });

  // Draw nodes
  visibleNodes.forEach((node) => {
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

    if (!selectedId || !graphState.focusMode) {
      // default
      ctx.fillStyle = node.type === "character" ? "#2980b9" : "#27ae60";
    } else if (isSelected) {
      ctx.fillStyle = "#f39c12"; // selected
    } else if (isConnected) {
      ctx.fillStyle = "#3498db"; // connected
    } else {
      ctx.fillStyle = "#333"; // faded (stronger fade)
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

// ====================
// GRAPH PHYSICS
// ====================

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

// ====================
// GRAPH INTERACTION
// ====================

function handleGraphClick(x, y) {
  const drag = graphState.dragging;
  let closestNode = null;
  let closestDistance = Infinity;

  if (drag.hasDragged) return;

  const visibleNodes = graphState.nodes.filter(
    (node) => graphState.filters[node.type],
  );

  for (const node of visibleNodes) {
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

// ====================
// GRAPH CONTROLS
// ====================

function centerOnNode(nodeId) {
  const node = graphState.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const canvas = document.getElementById("graph-canvas");

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  graphState.offsetX = centerX - node.x * graphState.scale;
  graphState.offsetY = centerY - node.y * graphState.scale;

  renderGraph();
}

function resetGraphView() {
  graphState.offsetX = 0;
  graphState.offsetY = 0;
  graphState.scale = 1;

  renderGraph();
}

function fitGraphToScreen() {
  const nodes = graphState.nodes;
  if (!nodes.length) return;

  const canvas = document.getElementById("graph-canvas");

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;

  const padding = 100;

  const scaleX = (canvas.width - padding) / graphWidth;
  const scaleY = (canvas.height - padding) / graphHeight;

  graphState.scale = Math.min(scaleX, scaleY, 2); // cap zoom

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const graphCenterX = (minX + maxX) / 2;
  const graphCenterY = (minY + maxY) / 2;

  graphState.offsetX = centerX - graphCenterX * graphState.scale;
  graphState.offsetY = centerY - graphCenterY * graphState.scale;

  renderGraph();
}

// ====================
// GRAPH EVENTS
// ====================

function initGraphEvents() {
  initGraphCanvasEvent();
  initGraphUIEvents();
  initGraphKeyboardControls();
}

// ====================
// CANVAS EVENTS
// ====================

function initGraphCanvasEvent() {
  const canvas = document.getElementById("graph-canvas");

  canvas.addEventListener("mouseup", onGraphMouseUp);
  canvas.addEventListener("mousedown", onGraphMouseDown);
  canvas.addEventListener("mousemove", onGraphMouseMove);
  canvas.addEventListener("mouseleave", onGraphMouseLeave);
  canvas.addEventListener("wheel", onGraphWheel);
  canvas.addEventListener("click", onGraphClick);
  canvas.addEventListener("dblclick", onGraphDoubleClick);
}

function initGraphUIEvents() {
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

  const focusToggle = document.getElementById("focus-mode-toggle");

  if (focusToggle) {
    focusToggle.addEventListener("change", (e) => {
      graphState.focusMode = e.target.checked;
      renderGraph();
    });
  }

  const centerBtn = document.getElementById("center-node-btn");

  if (centerBtn) {
    centerBtn.addEventListener("click", () => {
      if (graphState.selectedNodeId) {
        centerOnNode(graphState.selectedNodeId);
      }
    });
  }

  const resetBtn = document.getElementById("reset-view-btn");

  if (resetBtn) {
    resetBtn.addEventListener("click", resetGraphView);
  }

  const fitBtn = document.getElementById("fit-graph-btn");

  if (fitBtn) {
    fitBtn.addEventListener("click", fitGraphToScreen);
  }

  document.querySelectorAll("#graph-filters input").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const type = e.target.dataset.type;
      graphState.filters[type] = e.target.checked;

      renderGraph();
    });
  });
}

function initGraphKeyboardControls() {
  document.addEventListener("keydown", (e) => {
    // Only run when graph is open
    if (!graphState.isOpen) return;

    // Prevent editor conflicts
    if (document.activeElement === editorContent) return;

    if (e.key.toLowerCase() === "c") {
      e.preventDefault();
      centerGraph();
    }
  });
}

// ====================
// GRAPH HANDLERS
// ====================

function centerGraph() {
  graphState.offsetX = 0;
  graphState.offsetY = 0;
  graphState.scale = 1;

  // Trigger re-render if needed
  renderGraph();
}

function onGraphMouseUp(e) {
  const drag = graphState.dragging;
  drag.isDraggingGraph = false;
  drag.draggedNode = null;
}

function onGraphMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const drag = graphState.dragging;

  const x = (e.clientX - rect.left - graphState.offsetX) / graphState.scale;
  const y = (e.clientY - rect.top - graphState.offsetY) / graphState.scale;

  drag.hasDragged = false;

  //  Check if clicking a node
  drag.draggedNode = null;

  const visibleNodes = graphState.nodes.filter(
    (node) => graphState.filters[node.type],
  );

  for (const node of visibleNodes) {
    // Convert node to SCREEN space
    const screenX = node.x * graphState.scale + graphState.offsetX;
    const screenY = node.y * graphState.scale + graphState.offsetY;
    const dx = screenX - (e.clientX - rect.left);
    const dy = screenY - (e.clientY - rect.top);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const scaledRadius = NODE_RADIUS * graphState.scale;

    if (distance <= scaledRadius) {
      drag.draggedNode = node;

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

  if (drag.draggedNode) {
    // Node dragging
    return;
  }

  // Graph dragging
  drag.isDraggingGraph = true;
  drag.startX = e.clientX;
  drag.startY = e.clientY;
}

function onGraphMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const drag = graphState.dragging;

  //  NODE DRAG
  if (drag.draggedNode) {
    drag.hasDragged = true;

    drag.draggedNode.x =
      (e.clientX - rect.left - graphState.offsetX) / graphState.scale -
      nodeOffsetX;

    drag.draggedNode.y =
      (e.clientY - rect.top - graphState.offsetY) / graphState.scale -
      nodeOffsetY;

    renderGraph();
    return;
  }

  //  GRAPH DRAG
  if (!drag.isDraggingGraph) return;

  drag.hasDragged = true;

  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;

  graphState.offsetX += dx;
  graphState.offsetY += dy;

  drag.startX = e.clientX;
  drag.startY = e.clientY;

  renderGraph();
}

function onGraphMouseLeave(e) {
  const drag = graphState.dragging;
  drag.isDraggingGraph = false;
  drag.draggedNode = null;
}

function onGraphWheel(e) {
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
}

function onGraphClick(e) {
  const rect = canvas.getBoundingClientRect();

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  handleGraphClick(
    (mouseX - graphState.offsetX) / graphState.scale,
    (mouseY - graphState.offsetY) / graphState.scale,
  );
}

function onGraphDoubleClick(e) {
  const rect = canvas.getBoundingClientRect();

  const x = (e.clientX - rect.left - graphState.offsetX) / graphState.scale;

  const y = (e.clientY - rect.top - graphState.offsetY) / graphState.scale;

  let closestNode = null;
  let closestDistance = Infinity;

  const visibleNodes = graphState.nodes.filter(
    (node) => graphState.filters[node.type],
  );

  for (const node of visibleNodes) {
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
}

// ==============================================
//                EDITOR SYSTEM
// ==============================================
// ====================
// EDITOR EVENTS
// ====================

function initEditorEvents() {
  initEditorInputEvents();
  initEditorKeyboardEvents();
  initEditorToolbarEvents();
  initEditorTitleEvents();
  initEditorUIEvents();
}

// ====================
// INPUT
// ====================

function initEditorInputEvents() {
  editorContent.addEventListener("input", onEditorInput);
  editorContent.addEventListener("keyup", updateToolbarState);
  editorContent.addEventListener("click", updateToolbarState);
}

function onEditorInput(e) {
  let doc = getCurrentDocs()[appState.currentDocumentId];
  if (!doc) return;
  if (editorState.isRestoring || editorState.isProgrammaticEdit) return;

  doc.content = editorContent.value;

  // Debounced history (typing only)
  if (historyDebounceTimer) {
    clearTimeout(historyDebounceTimer);
  }

  historyDebounceTimer = setTimeout(() => {
    saveHistory();
  }, 400);

  updatePreview();
  updateWordCount();
  debounceSave();
}

// ====================
// KEYBOARD
// ====================

function initEditorKeyboardEvents() {
  editorContent.addEventListener("keydown", handleEditorKeyDown);

  editorContent.addEventListener("blur", () => {
    editorState.lastSelectionStart = editorContent.selectionStart;
    editorState.lastSelectionEnd = editorContent.selectionEnd;
  });
}

function handleEditorKeyDown(e) {
  // --- UNDO / REDO ---
  if (e.ctrlKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }

  // --- FORMATTING ---
  if (e.ctrlKey) {
    switch (e.key.toLowerCase()) {
      case "b":
        e.preventDefault();
        formatText("bold");
        return;
      case "i":
        e.preventDefault();
        formatText("italic");
        return;
      case "u":
        e.preventDefault();
        formatText("underline");
        return;
    }
  }

  // --- GRAPH ---
  if (e.ctrlKey && e.key.toLowerCase() === "g") {
    e.preventDefault();
    openGraph();
    return;
  }

  // --- TAB INDENT ---
  if (handleTabIndent(e)) return;
}

function handleEditorShortcuts(e) {
  if (!e.ctrlKey) return;

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
  return false;
}

function handleTabIndent(e) {
  if (e.key !== "Tab") return false;

  e.preventDefault();

  const textarea = editorContent;

  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;

  const value = textarea.value;
  const before = value.substring(0, start);
  const selection = value.substring(start, end);
  const after = value.substring(end);

  const tab = "  ";

  let newValue, newStart, newEnd;

  if (selection.includes("\n")) {
    const indented = selection
      .split("\n")
      .map((line) => tab + line)
      .join("\n");

    newValue = before + indented + after;
    newStart = start;
    newEnd = start + indented.length;
  } else {
    newValue = before + tab + selection + after;
    newStart = start + tab.length;
    newEnd = newStart + selection.length;
  }

  textarea.value = newValue;

  saveHistory();
  updatePreview();
  updateWordCount();
  saveDocument();

  requestAnimationFrame(() => {
    editorState.isRestoring = true;
    textarea.setSelectionRange(newStart, newEnd);
    editorState.isRestoring = false;
  });

  return true;
}

// ====================
// TOOLBAR
// ====================

function initEditorToolbarEvents() {
  document.querySelectorAll(".format-toolbar button").forEach((button) => {
    button.addEventListener("mousedown", (e) => {
      e.preventDefault();
      editorContent.focus();
    });

    button.addEventListener("click", (e) => {
      const type = e.currentTarget.dataset.format;
      if (!type) return;

      formatText(type);
    });
  });

  document.querySelectorAll(".menu-dropdown").forEach((menu) => {
    menu.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
  });
}

function updateToolbarState() {
  const formats = getActiveFormats();

  document
    .querySelectorAll(".toolbar-btn[data-format='bold']")
    .forEach((btn) => btn.classList.toggle("active", formats.bold));

  document
    .querySelectorAll(".toolbar-btn[data-format='italic']")
    .forEach((btn) => btn.classList.toggle("active", formats.italic));

  document
    .querySelectorAll(".toolbar-btn[data-format='underline']")
    .forEach((btn) => btn.classList.toggle("active", formats.underline));
}

// ====================
// TITLE
// ====================

function initEditorTitleEvents() {
  editorTitle.addEventListener("input", onTitleChange);
  editorTitle.addEventListener("keydown", onTitleKeyDown);
}

function onTitleChange() {
  const docs = getCurrentDocs();
  const doc = docs[appState.currentDocumentId];
  if (!doc) return;

  doc.title = editorTitle.value;

  renderSidebar();
  renderCharacterRelationships(appState.currentDocumentId);
}

function onTitleKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();

    restoreEditorState();
  }
}

// ====================
// UI
// ====================

function initEditorUIEvents() {
  const fontSize = document.getElementById("font-size");

  if (!fontSize) return;

  fontSize.addEventListener("change", (e) => {
    const start = editorContent.selectionStart;
    const end = editorContent.selectionEnd;

    setEditorFontSize(e.target.value);

    restoreEditorState();
    editorContent.setSelectionRange(start, end);
  });
}

// ====================
// HELPERS
// ====================

function restoreSelection() {
  editorContent.focus();
}

function saveEditorState() {
  if (!editorContent) return;
  if (editorState.isRestoring) return;
}

function restoreEditorState() {
  const textarea = editorContent;
  if (!textarea) return;

  const start = editorState.lastSelectionStart ?? 0;
  const end = editorState.lastSelectionEnd ?? start;

  editorState.isRestoring = true;

  requestAnimationFrame(() => {
    textarea.focus();

    requestAnimationFrame(() => {
      textarea.setSelectionRange(start, end);

      setTimeout(() => {
        editorState.isRestoring = false;
      }, 0);
    });
  });
}

// ==============================================
//                MENU SYSTEM
// ==============================================
// ====================
// MENU EVENTS
// ====================

function initMenuSystem() {
  initMenuCoreEvents();
  initMenuSwitchEvents();
  initMenuActionEvents();
}

// ====================
// CORE
// ====================
function initMenuCoreEvents() {
  menus.file = document.getElementById("file-menu");
  menus.edit = document.getElementById("edit-menu");
  menus.view = document.getElementById("view-menu");
  menus.help = document.getElementById("help-menu");

  document.addEventListener("click", (e) => {
    const isMenu = e.target.closest(".menu-item, .menu-dropdown");
    if (!isMenu) closeAllMenus();
  });

  document.addEventListener("mousedown", (e) => {
    const isMenuItem = e.target.closest(".menu-item");
    const isDropdown = e.target.closest(".menu-dropdown");

    if (isMenuItem || isDropdown) return;

    closeAllMenus();
  });

  document.addEventListener("click", () => {
    closeAllMenus();
  });
}

// ====================
// HOVER
// ====================
function initMenuSwitchEvents() {
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (menuState.isLocked) return;

      e.stopPropagation();

      const menuName = item.dataset.menu;
      const menu = menus[menuName];

      if (menuState.activeMenu === menuName) {
        closeAllMenus();
        menuOpen = false;
        return;
      }

      Object.values(menus).forEach((m) => (m.style.display = "none"));
      menu.style.display = "block";

      menuState.activeMenu = menuName;
      menuOpen = true;
    });

    item.addEventListener("mouseenter", () => {
      if (!menuOpen) return;

      const menuName = item.dataset.menu;
      const menu = menus[menuName];

      if (menuName === menuState.activeMenu) return;

      Object.values(menus).forEach((m) => (m.style.display = "none"));
      menu.style.display = "block";

      menuState.activeMenu = menuName;
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
  });
}

// ====================
// ACTIONS
// ====================
function initMenuActionEvents() {
  // Edit Menu
  document.querySelectorAll("#edit-menu [data-format]").forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();

      const action = item.dataset.format;

      editorContent.focus();
      restoreEditorState();

      // Handle undo/redo separately
      if (action === "undo") {
        undo();
        closeAllMenus();
        return;
      }

      if (action === "redo") {
        redo();
        closeAllMenus();
        return;
      }

      // Everything else = formatting

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const start = editorContent.selectionStart;
          const end = editorContent.selectionEnd;
          const text = editorContent.value;

          let marker = "";
          if (action === "bold") marker = "**";
          else if (action === "italic") marker = "*";
          else if (action === "underline") marker = "__";

          if (marker) {
            const before = text.slice(start - marker.length, start);
            const after = text.slice(end, end + marker.length);

            if (before === marker && after === marker) {
              editorContent.setSelectionRange(
                start - marker.length,
                end + marker.length,
              );
            }
          }

          formatText(action);
          closeAllMenus();
        });
      });
    });
  });

  // graph
  document.getElementById("open-graph-menu")?.addEventListener("click", () => {
    saveEditorState();
    openGraph();
    closeAllMenus();
  });

  // Export Project
  const exportProject = document.getElementById("export-project");
  if (exportProject) {
    exportProject.addEventListener("click", () => {
      exportMode = "project";
      openExportModal();
    });
  }

  // Export Document
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
}

// ====================
// HELPERS
// ====================

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
  menuState.activeMenu = null;
  menuOpen = false;
}

// ==============================================
//                SIDEBAR SYSTEM
// ==============================================
// ====================
// SIDEBAR EVENTS
// ====================

function initSidebarEvents() {
  initSidebarSearch();

  addButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const section = button.closest("details");
      addNewItem(section);
    });
  });
}

function initSidebarSearch() {
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
}

function renderSidebar() {
  const lists = document.querySelectorAll("ul");
  lists.forEach((list) => {
    list.innerHTML = "";
  });

  const docs = projects[appState.currentProjectId]?.documents || {};

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

// ====================
// CORE EDITOR FEATURES
// ====================

function saveDocument() {
  if (!appState.currentDocumentId) return;

  projects[appState.currentProjectId].documents[
    appState.currentDocumentId
  ].title = editorTitle.value;
  projects[appState.currentProjectId].documents[
    appState.currentDocumentId
  ].content = editorContent.value;

  debounceSave();
}

function selectFirstDocument() {
  const docs = projects[appState.currentProjectId]?.documents || {};
  const firstId = Object.keys(docs)[0];

  if (firstId) {
    loadDocument(firstId);
  }
}

function updatePreview() {
  const doc = getCurrentDocs()[appState.currentDocumentId];
  if (!doc) return;

  doc.content = editorContent.value;

  let html = renderMarkdown(doc.content || "");

  if (searchQuery) {
    const regex = new RegExp(`(${escapeRegex(searchQuery)})`, "gi");
    html = html.replace(regex, "<mark>$1</mark>");
  }

  const preview = document.getElementById("preview-pane");
  preview.innerHTML = html;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatText(type) {
  const start = editorContent.selectionStart;
  const end = editorContent.selectionEnd;

  const text = editorContent.value;
  const selected = text.slice(start, end);

  let marker = "";

  if (type === "bold") marker = "**";
  if (type === "italic") {
    // Detect double marker (bold) and avoid breaking it
    const before2 = text.slice(start - 2, start);
    const after2 = text.slice(end, end + 2);

    const isInsideBold = before2 === "**" && after2 === "**";

    if (isInsideBold) {
      // Apply italic INSIDE bold, not over it
      const formatted = `*${selected}*`;

      const newValue = text.slice(0, start) + formatted + text.slice(end);

      editorState.isProgrammaticEdit = true;

      saveHistory();

      editorContent.value = newValue;
      editorContent.focus();
      editorContent.setSelectionRange(start, start + formatted.length);

      saveHistory();

      editorState.isProgrammaticEdit = false;
      updateToolbarState();

      return;
    }

    marker = "*";
  }
  if (type === "underline") marker = "__";

  let formatted = selected;

  // Toggle OFF if already wrapped
  if (selected.startsWith(marker) && selected.endsWith(marker)) {
    formatted = selected.slice(marker.length, -marker.length);
  } else {
    // Toggle ON
    formatted = `${marker}${selected}${marker}`;
  }

  // STEP 1: Save PRE-FORMAT state (this is what undo needs)
  saveHistory();

  const newValue = text.slice(0, start) + formatted + text.slice(end);

  const newStart = start;
  const newEnd = start + formatted.length;

  // Prevent input-triggered history
  editorState.isProgrammaticEdit = true;

  editorContent.value = newValue;

  editorContent.focus();
  editorContent.setSelectionRange(newStart, newEnd);

  // STEP 2: Save POST-FORMAT state (redo target)
  saveHistory();
  updateToolbarState();
  editorState.isProgrammaticEdit = false;
}

function isInsideMarker(text, pos, marker) {
  const before = text.slice(0, pos);
  const after = text.slice(pos);

  const beforeCount = before.split(marker).length - 1;
  const afterCount = after.split(marker).length - 1;

  return beforeCount % 2 === 1 && afterCount > 0;
}

function normalizeSelectionForFormat(type) {
  const start = editorContent.selectionStart;
  const end = editorContent.selectionEnd;
  const text = editorContent.value;

  let marker = "";
  if (type === "bold") marker = "**";
  else if (type === "italic") marker = "*";
  else if (type === "underline") marker = "__";
  else return;

  // Look OUTSIDE selection
  const before = text.slice(start - marker.length, start);
  const after = text.slice(end, end + marker.length);

  if (before === marker && after === marker) {
    editorContent.setSelectionRange(start - marker.length, end + marker.length);
  }
}

function getActiveFormats() {
  const pos = editorContent.selectionStart;
  const text = editorContent.value;

  const isBold = isInsideMarker(text, pos, "**");
  const isUnderline = isInsideMarker(text, pos, "__");

  // 🔥 FIX: italic must NOT trigger inside bold/underline markers
  const isItalic = !isBold && !isUnderline && isInsideMarker(text, pos, "*");

  return {
    bold: isBold,
    italic: isItalic,
    underline: isUnderline,
    italic: isInsideMarker(text, pos, "*") && !isInsideMarker(text, pos, "**"),
  };
}

function togglePreview() {
  if (isTogglingPreview) return;
  isTogglingPreview = true;

  if (!isPreviewMode) {
    saveEditorState();
  }

  isPreviewMode = !isPreviewMode;

  updatePreview();
  applyPreviewMode();
  updateMenuState();
  savePreviewMode();

  const indicator = document.getElementById("mode-indicator");

  if (isPreviewMode) {
    indicator.classList.remove("hidden");
  } else {
    indicator.classList.add("hidden");

    requestAnimationFrame(() => {
      restoreEditorState();
    });
  }

  setTimeout(() => {
    isTogglingPreview = false;
  }, 0);
}

function toggleFocusMode() {
  isFocusMode = !isFocusMode;

  document.body.classList.toggle("focus-mode", isFocusMode);
  saveFocusMode();
}

function applyPreviewMode() {
  const preview = document.getElementById("preview-pane");
  const textarea = document.getElementById("editor-content");

  if (isPreviewMode) {
    preview.classList.remove("hidden");
    textarea.classList.add("hidden");
  } else {
    preview.classList.add("hidden");
    textarea.classList.remove("hidden");
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

function openGraph() {
  if (isPreviewMode) return;

  graphState.isOpen = true;

  graphState.filters = {
    chapter: true,
    character: true,
    tag: true,
  };

  graphState.focusMode = true;

  document
    .querySelectorAll("#graph-filters input[type='checkbox']")
    .forEach((checkbox) => {
      const type = checkbox.dataset.type;

      if (type) {
        checkbox.checked = graphState.filters[type];
      }

      if (checkbox.id === "focus-mode-toggle") {
        checkbox.checked = graphState.focusMode;
      }
    });

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
  setupCanvasSize();

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
  if (!modal) return;

  graphState.isOpen = false;

  modal.classList.add("hidden");

  graphAnimating = false;

  if (graphAnimationFrame) {
    cancelAnimationFrame(graphAnimationFrame);
    graphAnimationFrame = null;
  }

  if (isPreviewMode) {
    document.getElementById("mode-indicator")?.classList.remove("hidden");
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      restoreEditorState();
    });
  });
}

function setupCanvasSize() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
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

let lastSavedContent = "";

function saveHistory() {
  if (editorState.isRestoring) return;

  const content = editorContent.value;

  // 🚨 Prevent duplicate spam entries
  if (
    content === lastSavedContent &&
    editorContent.selectionStart === editorState.lastSelectionStart &&
    editorContent.selectionEnd === editorState.lastSelectionEnd
  )
    return;

  editorState.lastSelectionStart = editorContent.selectionStart;
  editorState.lastSelectionEnd = editorContent.selectionEnd;

  lastSavedContent = content;

  // Trim redo stack
  editorState.history = editorState.history.slice(
    0,
    editorState.historyIndex + 1,
  );

  editorState.history.push({
    content,
    selectionStart: editorContent.selectionStart,
    selectionEnd: editorContent.selectionEnd,
  });

  editorState.historyIndex++;
}

function undo() {
  if (editorState.historyIndex <= 0) return;

  editorState.historyIndex--;

  const entry = editorState.history[editorState.historyIndex];

  editorState.isRestoring = true;

  editorContent.value = entry.content;

  requestAnimationFrame(() => {
    editorContent.focus();
    editorContent.setSelectionRange(
      entry.selectionStart ?? 0,
      entry.selectionEnd ?? entry.selectionStart ?? 0,
    );

    updateToolbarState();

    editorState.isRestoring = false;
  });
}

function redo() {
  if (editorState.historyIndex >= editorState.history.length - 1) return;

  editorState.historyIndex++;

  const entry = editorState.history[editorState.historyIndex];

  editorState.isRestoring = true;

  editorContent.value = entry.content;

  requestAnimationFrame(() => {
    editorContent.focus();
    editorContent.setSelectionRange(
      entry.selectionStart ?? 0,
      entry.selectionEnd ?? entry.selectionStart ?? 0,
    );

    updateToolbarState();

    editorState.isRestoring = false;
  });
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
  if (!appState.currentDocumentId) return;

  const doc =
    projects[appState.currentProjectId].documents[appState.currentDocumentId];

  if (!doc.tags.includes(tag)) {
    doc.tags.push(tag);
  }

  renderTags(doc);
  debounceSave();
}

function removeTag(tag) {
  if (!appState.currentDocumentId) return;

  const doc =
    projects[appState.currentProjectId].documents[appState.currentDocumentId];

  doc.tags = doc.tags.filter((t) => t !== tag);

  renderTags(doc);
  debounceSave();
}

// ======================
// RELATIONSHIPS
// ======================

function populateCharacterSelect() {
  characterSelect.innerHTML = "";

  const docs = projects[appState.currentProjectId]?.documents || {};

  for (const id in docs) {
    const doc = projects[appState.currentProjectId].documents[id];

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
  if (!appState.currentDocumentId) return;

  const doc =
    projects[appState.currentProjectId].documents[appState.currentDocumentId];

  if (doc.type !== "chapter") return;

  const charId = characterSelect.value;
  if (!charId) return;

  if (!doc.relationships.characters.includes(charId)) {
    doc.relationships.characters.push(charId);
  }

  renderCharacterRelationships(appState.currentDocumentId);
  debounceSave();
}

function removeCharacterFromChapter(charId) {
  const doc =
    projects[appState.currentProjectId].documents[appState.currentDocumentId];

  doc.relationships.characters = doc.relationships.characters.filter(
    (id) => id !== charId,
  );

  renderCharacterRelationships(appState.currentDocumentId);
  debounceSave();
}

function getChaptersForCharacter(characterId) {
  const chapters = [];

  const docs = projects[appState.currentProjectId]?.documents || {};

  for (const id in docs) {
    const doc = projects[appState.currentProjectId].documents[id];

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

  appState.currentDocumentId = id;

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

  editorState.history = [
    {
      content: editorContent.value || "",
      selectionStart: 0,
      selectionEnd: 0,
    },
  ];
  editorState.historyIndex = 0;

  updateWordCount();
  updatePreview();
  saveHistory();
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

  projects[appState.currentProjectId].documents[id] = {
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
  projects[appState.currentProjectId].documents[id].title = newName;

  if (appState.currentDocumentId === id) {
    editorTitle.value = newName;
  }

  debounceSave();
}

function deleteItem(item) {
  const confirmDelete = confirm("Delete this item?");

  if (!confirmDelete) return;

  const id = item.dataset.id;

  delete projects[appState.currentProjectId].documents[id];

  const nextItem = item.nextElementSibling || item.previousElementSibling;

  item.remove();

  if (nextItem) {
    handleItemClick(nextItem);
  } else {
    editorTitle.value = "";
    editorContent.value = "";
    appState.currentDocumentId = null;
  }

  debounceSave();
}

function setActiveItem(clickedItem) {
  getItems().forEach((item) => item.classList.remove("active"));
  clickedItem.classList.add("active");
}

function handleItemClick(item) {
  const id = item.dataset.id;

  appState.currentDocumentId = id;
  loadDocument(id);
  setActiveItem(item);
}

// ===========================
// PROJECT SYSTEM
// ===========================

function createNewProject() {
  const name = prompt("Project name?");
  if (!name) return;

  const id = "project_" + Date.now();

  projects[id] = {
    name: name,
    documents: {},
  };

  appState.currentProjectId = id;

  debounceSave();
  renderProjectList();
  renderSidebar();
}

function deleteProject() {
  if (!appState.currentProjectId) return;

  const confirmDelete = confirm(
    "Are you sure you want to delete this project?",
  );

  if (!confirmDelete) return;

  delete projects[appState.currentProjectId];

  const remainingIds = Object.keys(projects);

  appState.currentProjectId = remainingIds[0] || null;

  debounceSave();
  renderProjectList();
  renderSidebar();
  clearEditor();
}

function renameProject() {
  if (!appState.currentProjectId) return;

  const newName = prompt("Rename project:");
  if (!newName) return;

  projects[appState.currentProjectId].name = newName;

  debounceSave();
  renderProjectList();
}

function renderProjectList() {
  projectSelect.innerHTML = "";

  for (const pid in projects) {
    const option = document.createElement("option");

    option.value = pid;
    option.textContent = projects[pid].name;

    if (pid === appState.currentProjectId) {
      option.selected = true;
    }

    projectSelect.appendChild(option);
  }
}

function searchDocuments(query) {
  query = query.toLowerCase();

  const lists = document.querySelectorAll("ul");
  lists.forEach((list) => (list.innerHTML = ""));

  const docs = projects[appState.currentProjectId]?.documents || {};

  for (const id in docs) {
    const doc = projects[appState.currentProjectId].documents[id];

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

  const project = projects[appState.currentProjectId];
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

function initModalEvents() {
  document
    .getElementById("close-help")
    ?.addEventListener("click", closeHelpModal);

  document
    .getElementById("close-export")
    ?.addEventListener("click", closeExportModal);

  document.getElementById("close-graph")?.addEventListener("click", closeGraph);
}

function closeExportModal() {
  document.getElementById("export-modal").classList.add("hidden");
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
  const doc = getCurrentDocs()[appState.currentDocumentId];
  if (!doc) return "";

  return `# ${doc.title}\n\n${doc.content}`;
}

function projectToMarkdown() {
  const docs = getCurrentDocs();

  let md = `# ${projects[appState.currentProjectId].name}\n\n`;

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
  menuState.activeMenu = null;
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

// ====================
// EVENTS SYSTEM
// ====================

function initKeyboardShortcuts() {
  document.addEventListener("keydown", handleKeyboardShorts);
}

function handleKeyboardShorts(e) {
  const isEditorFocused = document.activeElement === editorContent;

  // --- UNDO / REDO (ONLY IF NOT IN EDITOR) ---
  if (!isEditorFocused && e.ctrlKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }

  // --- PREVIEW ---
  if (e.ctrlKey && e.key.toLowerCase() === "p") {
    e.preventDefault();
    togglePreview();
    return;
  }

  // --- FOCUS MODE ---
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    toggleFocusMode();
    return;
  }

  // --- CLOSE MENUS ON TYPING ---
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
      if (menuState.activeMenu) closeAllMenus();
    }
  }

  // --- ESCAPE ---
  if (e.key === "Escape") {
    const graphModal = document.getElementById("graph-modal");
    const helpModal = document.getElementById("help-modal");

    if (graphModal && !graphModal.classList.contains("hidden")) {
      closeGraph();
      return;
    }

    if (helpModal && !helpModal.classList.contains("hidden")) {
      closeHelpModal();
      return;
    }

    if (document.body.classList.contains("focus-mode")) {
      toggleFocusMode();
      return;
    }

    closeAllMenus();
  }
}

function initEventListeners() {
  const newProject = document.getElementById("new-project");

  if (eventsInitialized) return;
  eventsInitialized = true;

  if (newProject) {
    newProject.addEventListener("click", () => {
      document.getElementById("new-project-btn").click();
    });
  }

  const toggleFocus = document.getElementById("toggle-focus");

  if (toggleFocus) {
    toggleFocus.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFocusMode();
      closeAllMenus();
    });
  }

  const togglePreviewMenu = document.getElementById("toggle-preview-menu");

  if (togglePreviewMenu) {
    togglePreviewMenu.addEventListener("click", () => {
      togglePreview();
      closeAllMenus();
    });
    updateMenuState();
  }

  const indicator = document.getElementById("mode-indicator");

  if (indicator) {
    indicator.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePreview();
    });
  }

  const togglePreviewBtn = document.getElementById("togglePreviewBtn");

  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener("click", togglePreview);
  }

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

  addCharacterBtn.addEventListener("click", addCharacterToChapter);
  newProjectBtn.addEventListener("click", createNewProject);

  projectSelect.addEventListener("change", () => {
    appState.currentProjectId = projectSelect.value;
    appState.currentDocumentId = null;

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
  initModalEvents();
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
