// =====================================================
// TAPESTRI
// Main Application Script
// =====================================================

// =====================================================
// GLOBAL APPLICATION STATE
// =====================================================

// Core app/project state
const appState = {
  currentProjectId: null,
  currentDocumentId: null,
};

// Editor state/history/selection
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

// Graph visualization state
const graphState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  hoveredNodeId: null,

  tracedPath: [],
  traceStartNodeId: null,

  scale: 1,
  offsetX: 0,
  offsetY: 0,

  targetOffsetX: 0,
  targetOffsetY: 0,
  targetScale: 1,

  temperature: 1,
  isOpen: false,

  filters: {
    chapter: true,
    character: true,
    timeline: true,
    world: true,
    notes: true,
    ideas: true,
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

  tooltip: {
    nodeId: null,
  },

  minimap: {
    dragging: false,
  },

  communityColors: [
    "#5B8CFF",
    "#7A5CFF",
    "#4FD1C5",
    "#F6AD55",
    "#F687B3",
    "#68D391",
    "#63B3ED",
    "#B794F4",
  ],

  communityLabels: {},
  communityAnchors: new Map(),
  tensionMap: new Map(),
  nodeMap: new Map(),
  arcMap: new Map(),
  characterDynamics: new Map(),
  emotionMap: new Map(),
  relationshipDynamics: new Map(),
  eventPropagationMap: new Map(),
  eventPulseTime: 0,
  animationTime: 0,
  semanticZoomLevel: 2,

  timelineIndex: 0,
  timelineNodes: [],
  temporalStateMap: new Map(),
  timelinePlaying: false,
  timelineSpeed: 1,

  semanticInferenceMap: new Map(),
  semanticMotifMap: new Map(),
  semanticAnomalyMap: new Map(),

  agentSystem: {
    active: true,
    agents: new Map(),
    tasks: [],
    insights: [],
    conflicts: [],
    activeAgent: null,
  },

  cognitiveContext: {
    activeWindow: [],
    maxNodes: 12,
    maxDepth: 2,
    summary: "",
  },
};

const AGENT_TYPES = {
  MANAGER: "manager",
  RESEARCH: "research",
  MARKETING: "marketing",
  WRITER: "writer",
  CONTINUITY: "continuity",
  LOREKEEPER: "lorekeeper",
  PSYCHOLOGIST: "psychologist",
  EDITOR: "editor",
  READER: "reader",
};

const edgePhysics = {
  character: {
    attraction: 0.018,
    preferredDistance: 140,
  },

  tag: {
    attraction: 0.004,
    preferredDistance: 260,
  },

  timeline: {
    attraction: 0.012,
    preferredDistance: 180,
  },

  semantic: {
    attraction: 0.006,
    preferredDistance: 220,
  },
};

// Cluster positioning system
const clusterCenters = {
  chapter: { x: 0, y: 0 },
  character: { x: 0, y: 0 },
  tag: { x: 0, y: 0 },
};

// Menu system state
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

// =====================================================
// GLOBAL CONSTANTS
// =====================================================

const NODE_RADIUS = 20;
const CLICK_RADIUS = 25;

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

// =====================================================
// GLOBAL VARIABLES
// =====================================================

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

let lastSavedContent = "";

// =====================================================
// DOM ELEMENT REFERENCES
// =====================================================

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

const graphTooltip = document.getElementById("graph-tooltip");
const graphModalContent = document.querySelector("#graph-modal .modal-content");

const minimapCanvas = document.getElementById("graph-minimap");
const minimapCtx = minimapCanvas.getContext("2d");

const canvas = document.getElementById("graph-canvas");

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

// =====================================================
// CORE DATA HELPERS
// =====================================================

// Project/document retrieval
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

function getItems() {
  return document.querySelectorAll("li[data-id]");
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getChaptersSorted() {
  const docs = getCurrentDocs();

  return Object.values(docs)
    .filter((doc) => doc.type === "chapter")
    .sort((a, b) => a.title.localeCompare(b.title));
}

function getGraphData() {
  const docs = getCurrentDocs();

  if (!docs) {
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];
  const addedTags = new Set();

  Object.values(docs).forEach((doc) => {
    nodes.push({
      id: String(doc.id),
      label: doc.title || "Untitled",
      type: doc.type,
    });

    // CHARACTER RELATIONSHIPS
    if (doc.relationships) {
      Object.entries(doc.relationships).forEach(
        ([relationshipType, relationshipIds]) => {
          if (!Array.isArray(relationshipIds)) return;

          relationshipIds.forEach((targetId) => {
            edges.push({
              from: String(doc.id),
              to: String(targetId),
              relationshipType,
              strength:
                relationshipType === "characters"
                  ? 2.2
                  : relationshipType === "timeline"
                    ? 1.7
                    : relationshipType === "worldbuilding"
                      ? 1.6
                      : 1,
              style: "explicit",

              flowType:
                relationshipType === "timeline"
                  ? "temporal"
                  : relationshipType === "characters"
                    ? "character"
                    : relationshipType === "worldbuilding"
                      ? "lore"
                      : "semantic",
            });
          });
        },
      );
    }

    // TAG RELATIONSHIPS
    if (doc.tags && Array.isArray(doc.tags)) {
      doc.tags.forEach((tag) => {
        const tagId = `tag-${tag}`;

        if (!addedTags.has(tagId)) {
          addedTags.add(tagId);

          nodes.push({
            id: tagId,
            label: `#${tag}`,
            type: "tag",
          });
        }

        edges.push({
          from: String(doc.id),
          to: tagId,
          relationshipType: "tag",
          strength: 0.7,
          direction: false,
          style: "explicit",
        });
      });
    }
  });

  buildSemanticEdges(nodes, edges, docs);

  return { nodes, edges };
}

function buildNarrativeTimeline() {
  const chapters = graphState.nodes
    .filter((node) => node.type === "chapter")
    .sort((a, b) => {
      return extractChapterNumber(a.label) - extractChapterNumber(b.label);
    });

  graphState.timelineNodes = chapters;
}

function extractChapterNumber(label) {
  const match = label.match(/\d+/);

  return match ? Number(match[0]) : 9999;
}

const SEMANTIC_STOP_WORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "they",
  "them",
  "were",
  "have",
  "there",
  "their",
  "about",
  "which",
  "would",
  "could",
  "should",
  "into",
  "through",
  "after",
  "before",
  "because",
  "while",
  "where",
  "when",
  "been",
]);

function tokenizeNarrativeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => {
      return word.length > 3 && !SEMANTIC_STOP_WORDS.has(word);
    });
}

function buildSemanticEdges(nodes, edges, docs) {
  const docsArray = Object.values(docs);

  for (let i = 0; i < docsArray.length; i++) {
    for (let j = i + 1; j < docsArray.length; j++) {
      const a = docsArray[i];
      const b = docsArray[j];

      if (!a.tags || !b.tags) continue;

      const sharedTags = a.tags.filter((tag) => b.tags.includes(tag));

      if (sharedTags.length === 0) continue;

      // avoid duplicate explicit links
      const alreadyLinked = edges.some(
        (edge) =>
          (edge.from === String(a.id) && edge.to === String(b.id)) ||
          (edge.from === String(b.id) && edge.to === String(a.id)),
      );

      if (alreadyLinked) continue;

      edges.push({
        from: String(a.id),
        to: String(b.id),
        relationshipType: "semantic",
        strength: Math.min(2.5, 0.6 + sharedTags.length * 0.35),
        direction: false,
        kind: "semantic",
        style: "semantic",
        sharedTags,
      });
    }
  }
}

function getTooltipData(node) {
  const docs = getCurrentDocs();

  if (!node || !docs) return null;

  // TAG NODE
  if (node.type === "tag") {
    const connectedCount = graphState.edges.filter(
      (edge) => edge.to === node.id,
    ).length;

    return {
      title: node.label,
      type: "tag",
      excerpt: `${connectedCount} connected documents`,
      meta: [`${connectedCount} relationships`],
    };
  }

  const doc = docs[node.id];

  if (!doc) return null;

  const excerpt =
    (doc.content || "").replace(/\n/g, " ").trim().slice(0, 140) ||
    "No content";

  const relationshipCount = graphState.edges.filter(
    (edge) => edge.from === node.id || edge.to === node.id,
  ).length;

  return {
    title: doc.title || "Untitled",
    type: doc.type,
    excerpt,
    meta: [
      `${relationshipCount} relationships`,
      ...(doc.tags || []).slice(0, 3),
    ],
  };
}

// Utility helpers
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function debounceSave() {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    saveToLocalStorage();
  }, 300);
}

function snap(value, target, epsilon = 0.01) {
  return Math.abs(value - target) < epsilon ? target : value;
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

// Graph helpers
function getConnectedNodeIds(nodeId) {
  const connected = new Set();

  graphState.edges.forEach((edge) => {
    if (edge.from === nodeId) connected.add(edge.to);
    if (edge.to === nodeId) connected.add(edge.from);
  });

  return connected;
}

function getGraphBounds() {
  const nodes = graphState.nodes;
  if (!nodes.length) return null;

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;

  nodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getNodeAtPosition(x, y) {
  const visibleNodes = graphState.nodes.filter(
    (node) => graphState.filters[node.type],
  );

  for (let i = visibleNodes.length - 1; i >= 0; i--) {
    const node = visibleNodes[i];

    const dx = node.x - x;
    const dy = node.y - y;

    const radius =
      Math.max(10, NODE_RADIUS * Math.max(graphState.scale, 0.7)) /
      graphState.scale;

    if (Math.sqrt(dx * dx + dy * dy) <= radius) {
      return node;
    }
  }

  return null;
}

function getMinimapTransform() {
  const bounds = getGraphBounds();

  if (!bounds) return null;

  const padding = 20;

  const scaleX = (minimapCanvas.width - padding * 2) / bounds.width;

  const scaleY = (minimapCanvas.height - padding * 2) / bounds.height;

  const minimapScale = Math.min(scaleX, scaleY);

  const offsetX = minimapCanvas.width / 2 - bounds.centerX * minimapScale;

  const offsetY = minimapCanvas.height / 2 - bounds.centerY * minimapScale;

  return {
    minimapScale,
    offsetX,
    offsetY,
  };
}

function quadraticBezier(p0, p1, p2, t) {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

function getConnectedNeighbors(nodeId) {
  const neighbors = [];

  graphState.edges.forEach((edge) => {
    if (edge.from === nodeId) {
      const neighbor = graphState.nodeMap.get(edge.to);

      if (neighbor) {
        neighbors.push(neighbor);
      }
    }

    if (edge.to === nodeId) {
      const neighbor = graphState.nodeMap.get(edge.from);

      if (neighbor) {
        neighbors.push(neighbor);
      }
    }
  });

  return neighbors;
}

function buildCognitiveContextWindow(startNodeId) {
  const visited = new Set();

  const queue = [
    {
      id: startNodeId,
      depth: 0,
    },
  ];

  const collected = [];

  while (
    queue.length &&
    collected.length < graphState.cognitiveContext.maxNodes
  ) {
    const current = queue.shift();

    if (!current || visited.has(current.id)) {
      continue;
    }

    visited.add(current.id);

    const node = graphState.nodeMap.get(current.id);

    if (!node) continue;

    collected.push(node);

    if (current.depth >= graphState.cognitiveContext.maxDepth) {
      continue;
    }

    const neighbors = getConnectedNeighbors(node.id);

    neighbors
      .sort((a, b) => {
        return getContextRelevance(b, node) - getContextRelevance(a, node);
      })
      .forEach((neighbor) => {
        queue.push({
          id: neighbor.id,
          depth: current.depth + 1,
        });
      });
  }

  graphState.cognitiveContext.activeWindow = collected;

  buildContextSummary(collected);
}

function buildContextSummary(nodes) {
  const summary = [];

  nodes.forEach((node) => {
    const arc = graphState.arcMap.get(node.id);

    const emotion = graphState.emotionMap.get(node.id);

    const dynamics = graphState.characterDynamics.get(node.id);

    summary.push({
      id: node.id,

      label: node.label,

      type: node.type,

      arc: arc?.phase || null,

      emotion: emotion?.state || null,

      role: dynamics?.role || null,

      importance: getSemanticImportance(node),
    });
  });

  graphState.cognitiveContext.summary = JSON.stringify(summary, null, 2);
}

function edgeConnectionCount(nodeId) {
  let count = 0;

  graphState.edges.forEach((edge) => {
    if (edge.from === nodeId || edge.to === nodeId) {
      count++;
    }
  });

  return count;
}

function getFlowSpeed(edge) {
  switch (edge.flowType) {
    case "temporal":
      return 1.8;

    case "character":
      return 1.2;

    case "lore":
      return 0.7;

    default:
      return 1;
  }
}

function getFlowColor(edge) {
  switch (edge.flowType) {
    case "temporal":
      return "#00d4ff";

    case "character":
      return "#f39c12";

    case "lore":
      return "#9b59b6";

    default:
      return "#95a5a6";
  }
}

function getArcColor(phase) {
  switch (phase) {
    case "setup":
      return "rgba(52,152,219,0.7)";

    case "development":
      return "rgba(46,204,113,0.7)";

    case "escalation":
      return "rgba(243,156,18,0.8)";

    case "climax":
      return "rgba(231,76,60,0.9)";

    default:
      return "rgba(255,255,255,0.4)";
  }
}

function getCharacterRoleColor(role) {
  switch (role) {
    case "protagonist":
      return "rgba(241,196,15";

    case "major":
      return "rgba(230,126,34";

    case "secondary":
      return "rgba(52,152,219";

    default:
      return "rgba(127,140,141";
  }
}

function getEmotionColor(state) {
  switch (state) {
    case "chaotic":
      return "rgba(231,76,60";

    case "intense":
      return "rgba(243,156,18";

    case "elevated":
      return "rgba(155,89,182";

    default:
      return "rgba(52,152,219";
  }
}

function getRelationshipColor(relationship) {
  if (!relationship) {
    return "#666";
  }

  return relationship.polarity === "alliance" ? "#2ecc71" : "#e74c3c";
}

function getPropagationColor(type) {
  switch (type) {
    case "catastrophic":
      return "rgba(231,76,60";

    case "volatile":
      return "rgba(243,156,18";

    case "active":
      return "rgba(155,89,182";

    default:
      return "rgba(52,152,219";
  }
}

function getTemporalColor(state) {
  switch (state) {
    case "dominant":
      return "rgba(241,196,15";

    case "active":
      return "rgba(52,152,219";

    case "emerging":
      return "rgba(155,89,182";

    default:
      return "rgba(120,120,120";
  }
}

function getSemanticImportance(node) {
  const connections = edgeConnectionCount(node.id);

  const communityBonus = node.community != null ? 1.25 : 1;

  const typeWeight = {
    chapter: 2.2,
    character: 1.9,
    world: 1.5,
    timeline: 1.4,
    notes: 1.2,
    ideas: 1.1,
    tag: 0.6,
  };

  return connections * (typeWeight[node.type] || 1) * communityBonus;
}

function getContextRelevance(node, sourceNode) {
  let score = 0;

  if (node.community === sourceNode.community) {
    score += 8;
  }

  if (node.type === sourceNode.type) {
    score += 5;
  }

  const emotion = graphState.emotionMap.get(node.id);

  if (emotion?.intensity > 7) {
    score += 6;
  }

  const arc = graphState.arcMap.get(node.id);

  if (arc?.phase === "climax") {
    score += 10;
  }

  score += getSemanticImportance(node) * 0.35;

  return score;
}

function calculateNarrativeTension() {
  const tensionMap = new Map();

  graphState.nodes.forEach((node) => {
    const importance = getSemanticImportance(node);

    const neighbors = getConnectedNeighbors(node.id);

    const connectionCount = neighbors.length;

    let crossCommunityCount = 0;

    neighbors.forEach((neighbor) => {
      if (neighbor.community !== node.community) {
        crossCommunityCount++;
      }
    });

    // ISOLATION PRESSURE
    const isolation = importance / Math.max(1, connectionCount);

    // CROSS-COMMUNITY PRESSURE
    const bridgeStress = crossCommunityCount * 1.4;

    // COMMUNITY CENTRALIZATION
    const centralization = Math.max(0, importance - connectionCount) * 0.45;

    // FINAL SCORE
    const tension = isolation * 0.35 + bridgeStress + centralization;

    tensionMap.set(node.id, tension);
  });

  graphState.tensionMap = tensionMap;
}

function detectNarrativeArcs() {
  const arcMap = new Map();

  graphState.nodes.forEach((node) => {
    const neighbors = getConnectedNeighbors(node.id);

    const tension = graphState.tensionMap.get(node.id) || 0;

    const importance = getSemanticImportance(node);

    let temporalConnections = 0;

    graphState.edges.forEach((edge) => {
      if (
        edge.flowType === "temporal" &&
        (edge.from === node.id || edge.to === node.id)
      ) {
        temporalConnections++;
      }
    });

    const progressionScore =
      neighbors.length * 0.45 +
      tension * 1.2 +
      importance * 0.35 +
      temporalConnections * 2;

    let arcPhase = "setup";

    if (progressionScore > 20) {
      arcPhase = "climax";
    } else if (progressionScore > 13) {
      arcPhase = "escalation";
    } else if (progressionScore > 7) {
      arcPhase = "development";
    }

    arcMap.set(node.id, {
      phase: arcPhase,
      score: progressionScore,
    });
  });

  graphState.arcMap = arcMap;
}

function analyzeCharacterDynamics() {
  const dynamics = new Map();

  const timelineNodes = graphState.nodes.filter(
    (node) => node.type === "timeline",
  );

  graphState.nodes.forEach((node) => {
    if (node.type !== "character") {
      return;
    }

    const neighbors = getConnectedNeighbors(node.id);

    const tension = graphState.tensionMap.get(node.id) || 0;

    const arc = graphState.arcMap.get(node.id);

    let temporalInfluence = 0;
    let chapterInfluence = 0;
    let crossCommunityInfluence = 0;

    neighbors.forEach((neighbor) => {
      if (neighbor.type === "timeline") {
        temporalInfluence += 2.5;
      }

      if (neighbor.type === "chapter") {
        chapterInfluence += 1.4;
      }

      if (neighbor.community !== node.community) {
        crossCommunityInfluence += 1.8;
      }
    });

    const influence =
      temporalInfluence +
      chapterInfluence +
      crossCommunityInfluence +
      tension * 0.8 +
      neighbors.length * 0.45;

    let role = "supporting";

    if (influence > 24) {
      role = "protagonist";
    } else if (influence > 16) {
      role = "major";
    } else if (influence > 10) {
      role = "secondary";
    }

    dynamics.set(node.id, {
      influence,
      role,
      arcPhase: arc?.phase || "setup",
    });
  });

  graphState.characterDynamics = dynamics;
}

function analyzeEmotionalTrajectories() {
  const emotionMap = new Map();

  graphState.nodes.forEach((node) => {
    const neighbors = getConnectedNeighbors(node.id);

    const tension = graphState.tensionMap.get(node.id) || 0;

    const arc = graphState.arcMap.get(node.id);

    const characterData = graphState.characterDynamics.get(node.id);

    let emotionalPressure = 0;

    // TENSION CONTRIBUTION
    emotionalPressure += tension * 1.4;

    // ARC PHASE CONTRIBUTION
    if (arc) {
      if (arc.phase === "climax") {
        emotionalPressure += 14;
      } else if (arc.phase === "escalation") {
        emotionalPressure += 8;
      } else if (arc.phase === "development") {
        emotionalPressure += 4;
      }
    }

    // CHARACTER CONTRIBUTION
    if (characterData) {
      if (characterData.role === "protagonist") {
        emotionalPressure += 10;
      } else if (characterData.role === "major") {
        emotionalPressure += 6;
      }
    }

    // CROSS-COMMUNITY TURBULENCE
    neighbors.forEach((neighbor) => {
      if (neighbor.community !== node.community) {
        emotionalPressure += 1.8;
      }
    });

    // DENSITY CONTRIBUTION
    emotionalPressure += neighbors.length * 0.55;

    let emotionalState = "calm";

    if (emotionalPressure > 34) {
      emotionalState = "chaotic";
    } else if (emotionalPressure > 24) {
      emotionalState = "intense";
    } else if (emotionalPressure > 14) {
      emotionalState = "elevated";
    }

    emotionMap.set(node.id, {
      pressure: emotionalPressure,
      state: emotionalState,
    });
  });

  graphState.emotionMap = emotionMap;
}

function analyzeRelationshipDynamics() {
  const dynamics = new Map();

  graphState.edges.forEach((edge) => {
    const from = graphState.nodeMap.get(edge.from);

    const to = graphState.nodeMap.get(edge.to);

    if (!from || !to) return;

    // CHARACTER-ONLY EVOLUTION
    if (from.type !== "character" && to.type !== "character") {
      return;
    }

    const fromEmotion = graphState.emotionMap.get(from.id);

    const toEmotion = graphState.emotionMap.get(to.id);

    const fromArc = graphState.arcMap.get(from.id);

    const toArc = graphState.arcMap.get(to.id);

    let affinity = 0;
    let volatility = 0;

    // COMMUNITY COHESION
    if (from.community === to.community) {
      affinity += 8;
    } else {
      volatility += 6;
    }

    // EMOTIONAL TURBULENCE
    if (fromEmotion?.state === "chaotic" || toEmotion?.state === "chaotic") {
      volatility += 10;
    }

    // ARC ESCALATION
    if (fromArc?.phase === "climax" || toArc?.phase === "climax") {
      volatility += 8;
    }

    // STRUCTURAL STABILITY
    affinity += (edge.strength || 1) * 3;

    const polarity = affinity >= volatility ? "alliance" : "rivalry";

    const stability = Math.max(0, affinity - volatility);

    dynamics.set(`${edge.from}-${edge.to}`, {
      affinity,
      volatility,
      polarity,
      stability,
    });
  });

  graphState.relationshipDynamics = dynamics;
}

function analyzeNarrativePropagation() {
  const propagation = new Map();

  graphState.nodes.forEach((node) => {
    const neighbors = getConnectedNeighbors(node.id);

    const tension = graphState.tensionMap.get(node.id) || 0;

    const emotion = graphState.emotionMap.get(node.id);

    const arc = graphState.arcMap.get(node.id);

    let propagationStrength = 0;

    // TENSION
    propagationStrength += tension * 1.2;

    // EMOTIONAL STATE
    if (emotion) {
      if (emotion.state === "chaotic") {
        propagationStrength += 18;
      } else if (emotion.state === "intense") {
        propagationStrength += 10;
      } else if (emotion.state === "elevated") {
        propagationStrength += 4;
      }
    }

    // ARC CONTRIBUTION
    if (arc) {
      if (arc.phase === "climax") {
        propagationStrength += 12;
      } else if (arc.phase === "escalation") {
        propagationStrength += 6;
      }
    }

    // NETWORK CENTRALITY
    propagationStrength += neighbors.length * 0.9;

    // CROSS-COMMUNITY SPREAD
    neighbors.forEach((neighbor) => {
      if (neighbor.community !== node.community) {
        propagationStrength += 2.5;
      }
    });

    let propagationType = "stable";

    if (propagationStrength > 42) {
      propagationType = "catastrophic";
    } else if (propagationStrength > 28) {
      propagationType = "volatile";
    } else if (propagationStrength > 14) {
      propagationType = "active";
    }

    propagation.set(node.id, {
      strength: propagationStrength,
      type: propagationType,
    });
  });

  graphState.eventPropagationMap = propagation;
}

function analyzeTemporalNarrativeState() {
  const temporalMap = new Map();

  const currentChapter = graphState.timelineNodes[graphState.timelineIndex];

  if (!currentChapter) {
    graphState.temporalStateMap = temporalMap;

    return;
  }

  const chapterNumber = extractChapterNumber(currentChapter.label);

  graphState.nodes.forEach((node) => {
    let temporalWeight = 0;

    // CHAPTER SELF
    if (node.id === currentChapter.id) {
      temporalWeight += 30;
    }

    // CONNECTED NODES
    graphState.edges.forEach((edge) => {
      if (edge.from === currentChapter.id && edge.to === node.id) {
        temporalWeight += 12;
      }

      if (edge.to === currentChapter.id && edge.from === node.id) {
        temporalWeight += 12;
      }
    });

    // EMOTIONAL INHERITANCE
    const emotion = graphState.emotionMap.get(node.id);

    if (emotion) {
      temporalWeight += emotion.pressure * 0.25;
    }

    // ARC ESCALATION
    const arc = graphState.arcMap.get(node.id);

    if (arc) {
      if (arc.phase === "climax") {
        temporalWeight += 14;
      } else if (arc.phase === "escalation") {
        temporalWeight += 8;
      }
    }

    // RELATIONSHIP INFLUENCE
    graphState.relationshipDynamics.forEach((relationship, key) => {
      if (key.includes(node.id)) {
        temporalWeight += relationship.affinity * 0.2;

        temporalWeight += relationship.volatility * 0.35;
      }
    });

    let temporalState = "background";

    if (temporalWeight > 40) {
      temporalState = "dominant";
    } else if (temporalWeight > 22) {
      temporalState = "active";
    } else if (temporalWeight > 10) {
      temporalState = "emerging";
    }

    temporalMap.set(node.id, {
      weight: temporalWeight,
      state: temporalState,
      chapter: chapterNumber,
    });
  });

  graphState.temporalStateMap = temporalMap;
}

function analyzeSemanticInference() {
  const inferenceMap = new Map();

  const nodes = graphState.nodes.filter((node) => node.type !== "tag");

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      const aTokens = tokenizeNarrativeText(a.label);

      const bTokens = tokenizeNarrativeText(b.label);

      const shared = aTokens.filter((token) => bTokens.includes(token));

      let semanticScore = 0;

      // SHARED TOKENS
      semanticScore += shared.length * 8;

      // COMMUNITY PROXIMITY
      if (a.community === b.community) {
        semanticScore += 4;
      }

      // EMOTIONAL SIMILARITY
      const aEmotion = graphState.emotionMap.get(a.id);

      const bEmotion = graphState.emotionMap.get(b.id);

      if (aEmotion && bEmotion && aEmotion.state === bEmotion.state) {
        semanticScore += 6;
      }

      // ARC SIMILARITY
      const aArc = graphState.arcMap.get(a.id);

      const bArc = graphState.arcMap.get(b.id);

      if (aArc && bArc && aArc.phase === bArc.phase) {
        semanticScore += 5;
      }

      // TEMPORAL PROXIMITY
      const aTemporal = graphState.temporalStateMap.get(a.id);

      const bTemporal = graphState.temporalStateMap.get(b.id);

      if (
        aTemporal &&
        bTemporal &&
        Math.abs(aTemporal.chapter - bTemporal.chapter) <= 2
      ) {
        semanticScore += 4;
      }

      if (semanticScore < 14) {
        continue;
      }

      inferenceMap.set(`${a.id}-${b.id}`, {
        score: semanticScore,
        sharedTokens: shared,
      });
    }
  }

  graphState.semanticInferenceMap = inferenceMap;
}

function analyzeSemanticMotifs() {
  const motifMap = new Map();

  graphState.nodes.forEach((node) => {
    const tokens = tokenizeNarrativeText(node.label);

    tokens.forEach((token) => {
      if (!motifMap.has(token)) {
        motifMap.set(token, []);
      }

      motifMap.get(token).push(node.id);
    });
  });

  graphState.semanticMotifMap = motifMap;
}

function analyzeNarrativeAnomalies() {
  const anomalyMap = new Map();

  graphState.nodes.forEach((node) => {
    const neighbors = getConnectedNeighbors(node.id);

    const importance = getSemanticImportance(node);

    // ISOLATED IMPORTANT NODE
    if (importance > 18 && neighbors.length <= 1) {
      anomalyMap.set(node.id, {
        type: "isolated-significance",
      });
    }

    // HIGH TENSION BUT LOW CONNECTION
    const tension = graphState.tensionMap.get(node.id);

    if (tension > 10 && neighbors.length <= 2) {
      anomalyMap.set(node.id, {
        type: "unstable-isolation",
      });
    }
  });

  graphState.semanticAnomalyMap = anomalyMap;
}

function updateNarrativeTimeline() {
  if (!graphState.timelinePlaying) {
    return;
  }

  if (graphState.timelineNodes.length === 0) {
    return;
  }

  graphState.timelineTimer =
    (graphState.timelineTimer || 0) + graphState.timelineSpeed;

  if (graphState.timelineTimer < 120) {
    return;
  }

  graphState.timelineTimer = 0;

  graphState.timelineIndex++;

  if (graphState.timelineIndex >= graphState.timelineNodes.length) {
    graphState.timelineIndex = 0;
  }
}

function detectCommunities() {
  let currentCommunity = 0;

  const visited = new Set();

  graphState.nodes.forEach((node) => {
    node.community = -1;
  });

  graphState.nodes.forEach((node) => {
    if (visited.has(node.id)) return;

    const queue = [node];

    while (queue.length) {
      const current = queue.shift();

      if (!current || visited.has(current.id)) {
        continue;
      }

      visited.add(current.id);

      current.community = currentCommunity;
      current.subcommunity = -1;

      const neighbors = getConnectedNeighbors(current.id);

      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor.id)) {
          queue.push(neighbor);
        }
      });
    }

    currentCommunity++;
  });

  detectSubcommunities();
  generateCommunityLabels();
  initializeCommunityAnchors();
}

function detectSubcommunities() {
  const communities = new Map();

  // GROUP NODES BY COMMUNITY
  graphState.nodes.forEach((node) => {
    if (!communities.has(node.community)) {
      communities.set(node.community, []);
    }

    communities.get(node.community).push(node);
  });

  // PROCESS EACH COMMUNITY
  communities.forEach((communityNodes) => {
    let subId = 0;

    const visited = new Set();

    communityNodes.forEach((node) => {
      if (visited.has(node.id)) return;

      const queue = [node];

      while (queue.length) {
        const current = queue.shift();

        if (!current || visited.has(current.id)) {
          continue;
        }

        visited.add(current.id);

        current.subcommunity = subId;

        const neighbors = getConnectedNeighbors(current.id);

        neighbors.forEach((neighbor) => {
          if (
            neighbor.community === current.community &&
            !visited.has(neighbor.id)
          ) {
            queue.push(neighbor);
          }
        });
      }

      subId++;
    });
  });
}

function getCommunityCenters() {
  const centers = new Map();

  graphState.nodes.forEach((node) => {
    if (!centers.has(node.community)) {
      centers.set(node.community, {
        x: 0,
        y: 0,
        count: 0,
      });
    }

    const center = centers.get(node.community);

    center.x += node.x;
    center.y += node.y;
    center.count++;
  });

  centers.forEach((center) => {
    center.x /= center.count;
    center.y /= center.count;
  });

  return centers;
}

function initializeCommunityAnchors() {
  const centers = getCommunityCenters();

  centers.forEach((center, communityId) => {
    if (graphState.communityAnchors.has(communityId)) {
      return;
    }

    const angle = (communityId * Math.PI * 2) / 12;

    const radius = 600;

    graphState.communityAnchors.set(communityId, {
      x: canvas.width / 2 + Math.cos(angle) * radius,

      y: canvas.height / 2 + Math.sin(angle) * radius,
    });
  });
}

function getCommunityRadii(centers) {
  const radii = new Map();
  const massMap = new Map();

  graphState.nodes.forEach((node) => {
    massMap.set(node.community, (massMap.get(node.community) || 0) + 1);

    const center = centers.get(node.community);

    if (!center) return;

    const dx = node.x - center.x;
    const dy = node.y - center.y;

    const dist = Math.sqrt(dx * dx + dy * dy);

    const current = radii.get(node.community) || 0;

    radii.set(node.community, Math.max(current, dist));

    graphState.communityMass = massMap;
  });

  return radii;
}

function incrementFrequency(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

// Formatting helpers
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

  // italic must NOT trigger inside bold/underline markers
  const isItalic = !isBold && !isUnderline && isInsideMarker(text, pos, "*");

  return {
    bold: isBold,
    italic: isItalic,
    underline: isUnderline,
    italic: isInsideMarker(text, pos, "*") && !isInsideMarker(text, pos, "**"),
  };
}

// Markdown/export helpers
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
      const safeQuery = escapeRegex(currentSearchQuery);
      const regex = new RegExp(`(${safeQuery})`, "gi");
      html = html.replace(regex, `<mark>$1</mark>`);
    } catch (err) {
      console.error("Search highlight error:", err);
    }
  }

  return html;
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

// =====================================================
// AI Agents
// =====================================================

function initializeAgents() {
  const agents = graphState.agentSystem.agents;

  agents.clear();

  agents.set(AGENT_TYPES.MANAGER, {
    id: AGENT_TYPES.MANAGER,
    color: "#ffffff",
    priority: 100,
    focus: ["coordination", "routing", "prioritization"],
  });

  agents.set(AGENT_TYPES.RESEARCH, {
    id: AGENT_TYPES.RESEARCH,
    color: "#16a085",
    priority: 7,
    focus: ["facts", "references", "accuracy"],
  });

  agents.set(AGENT_TYPES.MARKETING, {
    id: AGENT_TYPES.MARKETING,
    color: "#ff66cc",
    priority: 5,
    focus: ["marketability", "hooks", "audience"],
  });

  agents.set(AGENT_TYPES.WRITER, {
    id: AGENT_TYPES.WRITER,
    color: "#3498db",
    priority: 8,
    focus: ["pacing", "structure", "flow"],
  });

  agents.set(AGENT_TYPES.CONTINUITY, {
    id: AGENT_TYPES.CONTINUITY,
    color: "#e67e22",
    priority: 10,
    focus: ["timeline", "consistency", "logic"],
  });

  agents.set(AGENT_TYPES.LOREKEEPER, {
    id: AGENT_TYPES.LOREKEEPER,
    color: "#9b59b6",
    priority: 7,
    focus: ["worldbuilding", "history", "rules"],
  });

  agents.set(AGENT_TYPES.PSYCHOLOGIST, {
    id: AGENT_TYPES.PSYCHOLOGIST,
    color: "#e74c3c",
    priority: 9,
    focus: ["emotion", "motivation", "behavior"],
  });

  agents.set(AGENT_TYPES.EDITOR, {
    id: AGENT_TYPES.EDITOR,
    color: "#2ecc71",
    priority: 9,
    focus: ["clarity", "redundancy", "readability"],
  });

  agents.set(AGENT_TYPES.READER, {
    id: AGENT_TYPES.READER,
    color: "#f1c40f",
    priority: 6,
    focus: ["engagement", "confusion", "interest"],
  });
}

function createAgentTask({
  agent,
  type,
  nodeId,
  priority,
  description,
  payload = {},
}) {
  graphState.agentSystem.tasks.push({
    id: crypto.randomUUID(),

    agent,

    type,

    nodeId,

    priority,

    description,

    payload,

    status: "pending",

    created: performance.now(),

    completed: null,
  });
}

function sortAgentTasks() {
  graphState.agentSystem.tasks.sort((a, b) => {
    return b.priority - a.priority;
  });
}

function executeAgentTasks() {
  const tasks = graphState.agentSystem.tasks;

  tasks.forEach((task) => {
    if (task.status !== "pending") {
      return;
    }

    switch (task.agent) {
      case AGENT_TYPES.CONTINUITY:
        executeContinuityTask(task);
        break;

      case AGENT_TYPES.PSYCHOLOGIST:
        executePsychologyTask(task);
        break;

      case AGENT_TYPES.READER:
        executeReaderTask(task);
        break;

      case AGENT_TYPES.LOREKEEPER:
        executeLoreTask(task);
        break;

      case AGENT_TYPES.WRITER:
        executeWriterTask(task);
        break;

      case AGENT_TYPES.EDITOR:
        executeEditorTask(task);
        break;

      case AGENT_TYPES.RESEARCH:
        executeResearchTask(task);
        break;

      case AGENT_TYPES.MARKETING:
        executeMarketingTask(task);
        break;
    }

    task.status = "completed";

    task.completed = performance.now();
  });

  // PREVENT INFINITE GROWTH
  if (tasks.length > 500) {
    graphState.agentSystem.tasks = tasks.slice(-300);
  }
}

function addAgentInsight({ agent, nodeId, severity, message }) {
  graphState.agentSystem.insights.push({
    id: crypto.randomUUID(),
    agent,
    nodeId,
    severity,
    message,
    created: performance.now(),
  });

  // PREVENT UNBOUNDED GROWTH
  if (graphState.agentSystem.insights.length > 300) {
    graphState.agentSystem.insights.shift();
  }
}

function runContinuityAgent() {
  graphState.nodes.forEach((node) => {
    const temporal = graphState.temporalStateMap.get(node.id);

    const arc = graphState.arcMap.get(node.id);

    if (!temporal || !arc) return;

    // CLIMAX TOO EARLY
    if (arc.phase === "climax" && temporal.progress < 0.35) {
      addAgentInsight({
        agent: AGENT_TYPES.CONTINUITY,
        nodeId: node.id,
        severity: "warning",
        message: "Major climax occurring unusually early.",
      });
    }

    // RESOLUTION TOO EARLY
    if (arc.phase === "resolution" && temporal.progress < 0.6) {
      addAgentInsight({
        agent: AGENT_TYPES.CONTINUITY,
        nodeId: node.id,
        severity: "warning",
        message: "Narrative resolution occurring prematurely.",
      });
    }
  });
}

function runPsychologyAgent() {
  graphState.nodes.forEach((node) => {
    if (node.type !== "character") {
      return;
    }

    const emotion = graphState.emotionMap.get(node.id);

    const dynamics = graphState.characterDynamics.get(node.id);

    if (!emotion || !dynamics) {
      return;
    }

    // EXTREME EMOTION INSTABILITY
    if (emotion.intensity > 8 && dynamics.stability < 3) {
      addAgentInsight({
        agent: AGENT_TYPES.PSYCHOLOGIST,
        nodeId: node.id,
        severity: "critical",
        message: "Character displaying unstable emotional trajectory.",
      });
    }

    // STATIC CHARACTER
    if (dynamics.growth < 2) {
      addAgentInsight({
        agent: AGENT_TYPES.PSYCHOLOGIST,
        nodeId: node.id,
        severity: "info",
        message: "Character may lack meaningful development.",
      });
    }
  });
}

function runReaderAgent() {
  graphState.nodes.forEach((node) => {
    const neighbors = getConnectedNeighbors(node.id);

    const importance = getSemanticImportance(node);

    // IMPORTANT BUT ISOLATED
    if (importance > 12 && neighbors.length <= 1) {
      addAgentInsight({
        agent: AGENT_TYPES.READER,
        nodeId: node.id,
        severity: "warning",
        message: "Reader may struggle to contextualize this narrative element.",
      });
    }

    // TOO MANY CONNECTIONS
    if (neighbors.length > 18) {
      addAgentInsight({
        agent: AGENT_TYPES.READER,
        nodeId: node.id,
        severity: "info",
        message: "High narrative density may overwhelm readers.",
      });
    }
  });
}

function runAgentSystem() {
  if (!graphState.agentSystem.active) {
    return;
  }

  graphState.agentSystem.insights = [];

  runContinuityAgent();

  runPsychologyAgent();

  runReaderAgent();

  runManagerAgent();

  executeAgentTasks();
}

function runManagerAgent() {
  const insights = graphState.agentSystem.insights;

  const conflicts = [];

  // GROUP INSIGHTS BY NODE
  const grouped = new Map();

  insights.forEach((insight) => {
    if (!grouped.has(insight.nodeId)) {
      grouped.set(insight.nodeId, []);
    }

    grouped.get(insight.nodeId).push(insight);
  });

  // DETECT AGENT CONFLICTS
  grouped.forEach((nodeInsights, nodeId) => {
    const severities = nodeInsights.map((i) => i.severity);

    const hasCritical = severities.includes("critical");

    const hasInfo = severities.includes("info");

    if (hasCritical && hasInfo) {
      conflicts.push({
        nodeId,
        type: "priority-conflict",
      });
    }
  });

  graphState.agentSystem.conflicts = conflicts;

  // ACTIVE AGENT FOCUS
  const highest = insights.sort((a, b) => {
    const score = {
      critical: 3,
      warning: 2,
      info: 1,
    };

    return score[b.severity] - score[a.severity];
  })[0];

  graphState.agentSystem.activeAgent = highest?.agent || null;

  generateAgentTasks();
}

function generateAgentTasks() {
  graphState.nodes.forEach((node) => {
    const tension = graphState.tensionMap.get(node.id) || 0;

    const importance = getSemanticImportance(node);

    const neighbors = getConnectedNeighbors(node.id);

    // CONTINUITY TASK
    if (tension > 9 && neighbors.length < 2) {
      createAgentTask({
        agent: AGENT_TYPES.CONTINUITY,

        type: "continuity-review",

        nodeId: node.id,

        priority: 10,

        description: "Review narrative isolation during high tension.",
      });
    }

    // PSYCHOLOGY TASK
    if (node.type === "character") {
      const emotion = graphState.emotionMap.get(node.id);

      if (emotion && emotion.intensity > 8) {
        createAgentTask({
          agent: AGENT_TYPES.PSYCHOLOGIST,

          type: "emotion-analysis",

          nodeId: node.id,

          priority: 9,

          description: "Analyze emotional instability.",
        });
      }
    }

    // READER TASK
    if (importance > 18 && neighbors.length > 16) {
      createAgentTask({
        agent: AGENT_TYPES.READER,

        type: "reader-overload",

        nodeId: node.id,

        priority: 7,

        description: "Evaluate reader cognitive load.",
      });
    }
  });

  sortAgentTasks();
}

function executeContinuityTask(task) {
  addAgentInsight({
    agent: AGENT_TYPES.CONTINUITY,

    nodeId: task.nodeId,

    severity: "warning",

    message: "Continuity Agent reviewed narrative structural consistency.",
  });
}

function executePsychologyTask(task) {
  addAgentInsight({
    agent: AGENT_TYPES.PSYCHOLOGIST,

    nodeId: task.nodeId,

    severity: "critical",

    message: "Psychologist Agent detected emotional instability.",
  });
}

function executeReaderTask(task) {
  addAgentInsight({
    agent: AGENT_TYPES.READER,

    nodeId: task.nodeId,

    severity: "info",

    message: "Reader Simulator evaluated cognitive narrative density.",
  });
}

function executeWriterTask(task) {
  addAgentInsight({
    agent: AGENT_TYPES.WRITER,

    nodeId: task.nodeId,

    severity: "info",

    message:
      "Writer Agent identified potential narrative enhancement opportunity.",
  });
}

function executeEditorTask(task) {
  addAgentInsight({
    agent: AGENT_TYPES.EDITOR,

    nodeId: task.nodeId,

    severity: "warning",

    message: "Editor Agent detected possible clarity issue.",
  });
}

function executeResearchTask(task) {
  addAgentInsight({
    agent: AGENT_TYPES.RESEARCH,

    nodeId: task.nodeId,

    severity: "info",

    message: "Research Agent identified possible expansion area.",
  });
}

function executeMarketingTask(task) {
  addAgentInsight({
    agent: AGENT_TYPES.MARKETING,

    nodeId: task.nodeId,

    severity: "info",

    message:
      "Marketing Agent identified potential audience engagement hotspot.",
  });
}

function executeLoreTask(task) {
  addAgentInsight({
    agent: AGENT_TYPES.LOREKEEPER,

    nodeId: task.nodeId,

    severity: "warning",

    message: "Lorekeeper Agent reviewing world consistency.",
  });
}

// =====================================================
// LOCAL STORAGE / PERSISTENCE
// =====================================================

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

// =====================================================
// HISTORY SYSTEM
// =====================================================

function saveHistory() {
  if (editorState.isRestoring) return;

  const content = editorContent.value;

  // Prevent duplicate spam entries
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

// =====================================================
// GRAPH SYSTEM
// =====================================================

// Graph rendering
function prepareGraphRenderState() {
  const selectedId = graphState.selectedNodeId;

  const hoveredId = graphState.hoveredNodeId;

  const activeId = hoveredId || selectedId;

  const connectedIds = activeId ? getConnectedNodeIds(activeId) : new Set();

  const visibleNodes = graphState.nodes.filter(
    (node) => graphState.filters[node.type],
  );

  const visibleNodeMap = new Map();

  visibleNodes.forEach((node) => {
    visibleNodeMap.set(node.id, node);
  });

  return {
    selectedId,
    hoveredId,
    activeId,
    connectedIds,
    visibleNodes,
    visibleNodeMap,
  };
}

function renderGraph() {
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const renderState = prepareGraphRenderState();

  drawSemanticInfluenceFields(ctx);
  drawNarrativeTensionFields(ctx);
  drawNarrativeArcFields(ctx);
  drawCharacterInfluenceFields(ctx);
  drawEmotionalFields(ctx);
  drawRelationshipFields(ctx);
  drawNarrativePropagationFields(ctx);
  drawTemporalNarrativeFields(ctx);
  drawSemanticInferenceEdges(ctx);
  drawNarrativeAnomalies(ctx);
  drawAgentInsights(ctx);
  drawCommunityHulls(ctx);
  drawEdges(ctx, renderState);
  drawNodes(ctx, renderState);
  drawLabels(ctx, renderState);
  drawCommunityLabels(ctx);
  renderMinimap();
}

function renderMinimap() {
  const ctx = minimapCtx;

  ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  const bounds = getGraphBounds();

  if (!bounds) return;

  const padding = 20;

  const scaleX = (minimapCanvas.width - padding * 2) / bounds.width;

  const scaleY = (minimapCanvas.height - padding * 2) / bounds.height;

  const minimapScale = Math.min(scaleX, scaleY);

  const offsetX = minimapCanvas.width / 2 - bounds.centerX * minimapScale;

  const offsetY = minimapCanvas.height / 2 - bounds.centerY * minimapScale;

  // EDGES
  graphState.edges.forEach((edge) => {
    const from = graphState.nodeMap.get(edge.from);

    const to = graphState.nodeMap.get(edge.to);

    if (!from || !to) return;

    // Skip hidden nodes
    if (!graphState.filters[from.type] || !graphState.filters[to.type]) {
      return;
    }

    ctx.beginPath();

    ctx.moveTo(
      from.x * minimapScale + offsetX,
      from.y * minimapScale + offsetY,
    );

    ctx.lineTo(to.x * minimapScale + offsetX, to.y * minimapScale + offsetY);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;

    ctx.stroke();
  });

  // NODES
  const visibleNodes = graphState.nodes.filter(
    (node) => graphState.filters[node.type],
  );

  visibleNodes.forEach((node) => {
    const radius = graphState.scale < 0.35 ? 2 : 3;

    ctx.beginPath();

    ctx.arc(
      node.x * minimapScale + offsetX,
      node.y * minimapScale + offsetY,
      radius,
      0,
      Math.PI * 2,
    );

    ctx.fillStyle = getNodeTypeColor(node.type);

    ctx.fill();
  });

  renderMinimapViewport({
    minimapScale,
    offsetX,
    offsetY,
  });
}

function renderMinimapViewport({ minimapScale, offsetX, offsetY }) {
  const ctx = minimapCtx;

  const viewWidth = canvas.width / graphState.scale;

  const viewHeight = canvas.height / graphState.scale;

  const worldX = -graphState.offsetX / graphState.scale;

  const worldY = -graphState.offsetY / graphState.scale;

  ctx.strokeStyle = "#f39c12";
  ctx.lineWidth = 2;

  ctx.strokeRect(
    worldX * minimapScale + offsetX,
    worldY * minimapScale + offsetY,
    viewWidth * minimapScale,
    viewHeight * minimapScale,
  );
}

function getEdgeCurve(fromX, fromY, toX, toY, edge = null) {
  const dx = toX - fromX;
  const dy = toY - fromY;

  const distance = Math.sqrt(dx * dx + dy * dy);

  const midX = (fromX + toX) * 0.5;
  const midY = (fromY + toY) * 0.5;

  const normalX = -dy / distance;
  const normalY = dx / distance;

  let curveStrength = Math.min(120, distance * 0.18);

  // OPTIONAL EDGE STYLING
  if (edge?.style === "semantic") {
    curveStrength *= 1.4;
  } else if (edge?.style === "relationship") {
    curveStrength *= 0.9;
  }

  const controlX = midX + normalX * curveStrength;

  const controlY = midY + normalY * curveStrength;

  return {
    controlX,
    controlY,
  };
}

function hashEdge(a, b) {
  let hash = 0;

  const str = `${a}-${b}`;

  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);

    hash |= 0;
  }

  return Math.abs(hash);
}

function drawEdgePulses({
  ctx,
  fromX,
  fromY,
  toX,
  toY,
  controlX,
  controlY,
  strength = 1,
}) {
  const pulseCount = Math.min(5, Math.max(1, strength));

  const speed = 0.6 + strength * 0.25;

  ctx.save();

  for (let i = 0; i < pulseCount; i++) {
    const offset = i / pulseCount;

    const t = (graphState.animationTime * speed + offset) % 1;

    const pulseX = quadraticBezier(fromX, controlX, toX, t);

    const pulseY = quadraticBezier(fromY, controlY, toY, t);

    const radius = 2 + strength * 0.8;

    ctx.beginPath();

    ctx.arc(pulseX, pulseY, radius, 0, Math.PI * 2);

    ctx.fillStyle = "#f39c12";

    ctx.globalAlpha = 0.75 + strength * 0.08;

    ctx.shadowColor = "#f39c12";

    ctx.shadowBlur = 10 + strength * 2;

    ctx.fill();
  }

  ctx.restore();
}

function drawNarrativeFlow({
  ctx,
  fromX,
  fromY,
  toX,
  toY,
  controlX,
  controlY,
  edge,
}) {
  const time = graphState.animationTime * getFlowSpeed(edge);

  const t = ((Math.sin(time) + 1) / 2) * 0.92 + 0.04;

  const x =
    (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * controlX + t * t * toX;

  const y =
    (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * controlY + t * t * toY;

  const color = getFlowColor(edge);

  ctx.beginPath();

  const intensity = Math.min(1.4, edge.strength || 1);

  ctx.arc(x, y, 2.2 + intensity, 0, Math.PI * 2);

  ctx.fillStyle = color;

  ctx.globalAlpha = 0.65;

  ctx.shadowColor = color;
  ctx.shadowBlur = 12;

  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawEdgeArrow({
  ctx,
  fromX,
  fromY,
  toX,
  toY,
  controlX,
  controlY,
  color,
}) {
  const t = 0.92;

  const arrowX = quadraticBezier(fromX, controlX, toX, t);

  const arrowY = quadraticBezier(fromY, controlY, toY, t);

  const tangentX = 2 * (1 - t) * (controlX - fromX) + 2 * t * (toX - controlX);

  const tangentY = 2 * (1 - t) * (controlY - fromY) + 2 * t * (toY - controlY);

  const angle = Math.atan2(tangentY, tangentX);

  const arrowSize = 8;

  ctx.save();

  ctx.translate(arrowX, arrowY);

  ctx.rotate(angle);

  ctx.beginPath();

  ctx.moveTo(0, 0);

  ctx.lineTo(-arrowSize, arrowSize * 0.5);

  ctx.lineTo(-arrowSize, -arrowSize * 0.5);

  ctx.closePath();

  ctx.fillStyle = color;

  ctx.globalAlpha = 0.85;

  ctx.fill();

  ctx.restore();
}

function drawEdges(ctx, renderState) {
  const { activeId, visibleNodeMap } = renderState;

  ctx.lineCap = "round";

  // BUILD TRACED EDGE SET ONCE
  const tracedEdges = new Set();

  for (let i = 0; i < graphState.tracedPath.length - 1; i++) {
    tracedEdges.add(
      `${graphState.tracedPath[i]}-${graphState.tracedPath[i + 1]}`,
    );
  }

  graphState.edges.forEach((edge) => {
    const relationship = graphState.relationshipDynamics.get(
      `${edge.from}-${edge.to}`,
    );
    const zoomLevel = graphState.semanticZoomLevel;
    const from = visibleNodeMap.get(edge.from);
    const to = visibleNodeMap.get(edge.to);

    // SEMANTIC LOD FILTERING
    if (zoomLevel === 1) {
      // MACRO VIEW:
      // only strongest explicit edges

      if (edge.style === "semantic" || (edge.strength || 0) < 2) {
        return;
      }
    }

    if (zoomLevel === 2) {
      // COMMUNITY VIEW:
      // reduce weak semantic edges
      if (edge.style === "semantic" && (edge.strength || 0) < 1.4) {
        return;
      }
    }

    if (!from || !to) return;

    const fromX = from.x * graphState.scale + graphState.offsetX;
    const fromY = from.y * graphState.scale + graphState.offsetY;

    const toX = to.x * graphState.scale + graphState.offsetX;
    const toY = to.y * graphState.scale + graphState.offsetY;

    const isConnected = edge.from === activeId || edge.to === activeId;

    const fromTension = graphState.tensionMap.get(edge.from) || 0;
    const toTension = graphState.tensionMap.get(edge.to) || 0;
    const edgeTension = (fromTension + toTension) / 2;

    const isTraced = tracedEdges.has(`${edge.from}-${edge.to}`);

    const { controlX, controlY } = getEdgeCurve(fromX, fromY, toX, toY, edge);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.quadraticCurveTo(controlX, controlY, toX, toY);

    // TRACED PATH
    if (isTraced) {
      ctx.strokeStyle = "#00d4ff";
      ctx.lineWidth = 4;
      ctx.globalAlpha = 1;
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 18;

      // DEFAULT
    } else if (!activeId || !graphState.focusMode) {
      const dist = Math.sqrt(
        (toX - fromX) * (toX - fromX) + (toY - fromY) * (toY - fromY),
      );

      const sameCommunity = from.community === to.community;

      if (!sameCommunity) {
        ctx.globalAlpha *= 0.45;
      }

      const depthFade = Math.max(0.08, 1 - dist / 1400);

      // SEMANTIC EDGES
      if (edge.style === "semantic") {
        ctx.strokeStyle = "#6f7d91";
        ctx.lineWidth = Math.max(0.7, graphState.scale * 0.9) * depthFade;

        const semanticStrength = Math.min(1, (edge.strength || 1) / 2.5);

        ctx.globalAlpha = (0.08 + semanticStrength * 0.18) * depthFade;

        ctx.setLineDash([5, 8]);
      } else {
        // EXPLICIT EDGES
        ctx.strokeStyle = "#7f8794";

        ctx.lineWidth = Math.max(1, graphState.scale * 1.3) * depthFade;

        ctx.globalAlpha = 0.42 * depthFade;

        ctx.setLineDash([]);
      }

      // CONNECTED
    } else if (isConnected) {
      ctx.strokeStyle = "#f39c12";
      ctx.lineWidth = Math.max(1.8, graphState.scale * 2.2);
      ctx.globalAlpha = 0.95;
      ctx.shadowColor = "#f39c12";
      ctx.shadowBlur = 12;

      // FADED
    } else {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.12;
    }

    // RELATIONSHIP WEIGHTING
    if (edge.strength) {
      ctx.lineWidth *= edge.strength * Math.min(1.8, 1 + edgeTension * 0.06);

      if (edge.flowType === "temporal") {
        ctx.lineWidth *= 1.25;
      }
    }

    if (relationship) {
      ctx.strokeStyle = getRelationshipColor(relationship);

      ctx.globalAlpha *= relationship.polarity === "alliance" ? 0.9 : 0.75;

      ctx.shadowColor = ctx.strokeStyle;

      ctx.shadowBlur += relationship.volatility * 0.45;

      // VOLATILE RELATIONSHIPS THICKEN
      ctx.lineWidth += relationship.volatility * 0.05;
    }

    ctx.stroke();

    // NARRATIVE FLOW FIELDS

    if (graphState.semanticZoomLevel >= 3 && edge.style !== "semantic") {
      drawNarrativeFlow({
        ctx,
        fromX,
        fromY,
        toX,
        toY,
        controlX,
        controlY,
        edge,
      });
    }

    ctx.setLineDash([]);

    // DIRECTIONAL ARROWS
    if (edge.direction && (!graphState.focusMode || isConnected || isTraced)) {
      drawEdgeArrow({
        ctx,
        fromX,
        fromY,
        toX,
        toY,
        controlX,
        controlY,
        color: ctx.strokeStyle,
      });
    }

    // EDGE PULSES
    if (isConnected || isTraced) {
      drawEdgePulses({
        ctx,
        fromX,
        fromY,
        toX,
        toY,
        controlX,
        controlY,
        strength: edge.strength || 1,
      });
    }

    ctx.shadowBlur = 0;
  });

  ctx.globalAlpha = 1;
}

function getNodeTypeColor(type) {
  switch (type) {
    case "chapter":
      return "#27ae60";

    case "character":
      return "#2980b9";

    case "timeline":
      return "#f39c12";

    case "world":
      return "#8e44ad";

    case "notes":
      return "#16a085";

    case "ideas":
      return "#e74c3c";

    case "tag":
      return "#7f8c8d";

    default:
      return "#cccccc";
  }
}

function drawNodes(ctx, renderState) {
  const { activeId, connectedIds, visibleNodes, selectedId, hoveredId } =
    renderState;

  visibleNodes.forEach((node) => {
    const isSelected = node.id === selectedId;

    const isHovered = node.id === hoveredId;

    const isConnected = connectedIds.has(node.id);

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const radius = Math.max(10, NODE_RADIUS * Math.max(graphState.scale, 0.7));

    const communityColor =
      graphState.communityColors[
        node.community % graphState.communityColors.length
      ];

    const typeColor = getNodeTypeColor(node.type);

    // GLOBAL SEMANTIC VALUES
    const importance = getSemanticImportance(node);

    const tension = graphState.tensionMap.get(node.id) || 0;

    const arc = graphState.arcMap.get(node.id);

    const characterData = graphState.characterDynamics.get(node.id);

    const emotion = graphState.emotionMap.get(node.id);

    const propagation = graphState.eventPropagationMap.get(node.id);

    const temporal = graphState.temporalStateMap.get(node.id);

    const zoomLevel = graphState.semanticZoomLevel;

    const inContextWindow = graphState.cognitiveContext.activeWindow.some(
      (n) => n.id === node.id,
    );

    // SEMANTIC NODE LOD
    if (zoomLevel === 1) {
      if (importance < 5 && node.type === "tag") {
        return;
      }
    }

    if (zoomLevel === 2) {
      if (importance < 2 && node.type === "tag") {
        return;
      }
    }

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    // RESET
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.globalAlpha = 1;

    /*
     * ACTIVE NODE
     */
    if (isSelected || isHovered) {
      ctx.fillStyle = "#f39c12";
      ctx.shadowColor = "#f39c12";
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 1;
    } else if (activeId && graphState.focusMode && isConnected) {
      /*
       * CONNECTED NODE
       */
      ctx.fillStyle = typeColor;

      ctx.shadowColor = communityColor;

      ctx.shadowBlur = 10 + edgeConnectionCount(node.id) * 0.35;

      ctx.globalAlpha = 0.95;
    } else if (activeId && graphState.focusMode) {
      /*
       * FADED NODE
       */
      ctx.fillStyle = "#333";
      ctx.globalAlpha = 0.18;
    } else {
      /*
       * NORMAL VIEW
       */
      ctx.fillStyle = typeColor;

      ctx.globalAlpha = Math.min(1, 0.45 + importance * 0.035);

      ctx.shadowColor = tension > 5 ? "rgba(255,120,80,0.8)" : "transparent";

      ctx.shadowBlur = tension > 5 ? 10 + tension * 1.5 : 0;
    }

    if (inContextWindow) {
      ctx.lineWidth = 2;

      ctx.strokeStyle = "rgba(255,255,255,0.35)";

      ctx.stroke();
    }

    if (node.type === "character" && characterData) {
      ctx.shadowColor = getCharacterRoleColor(characterData.role) + ",0.9)";

      ctx.shadowBlur +=
        characterData.role === "protagonist"
          ? 26
          : characterData.role === "major"
            ? 16
            : 8;
    }

    if (emotion) {
      ctx.shadowColor = getEmotionColor(emotion.state) + ",0.85)";

      ctx.shadowBlur +=
        emotion.state === "chaotic" ? 24 : emotion.state === "intense" ? 14 : 8;
    }

    if (propagation) {
      ctx.shadowColor = getPropagationColor(propagation.type) + ",0.75)";

      ctx.shadowBlur +=
        propagation.type === "catastrophic"
          ? 30
          : propagation.type === "volatile"
            ? 18
            : 10;
    }

    if (temporal) {
      ctx.shadowColor = getTemporalColor(temporal.state) + ",0.75)";

      ctx.shadowBlur +=
        temporal.state === "dominant"
          ? 32
          : temporal.state === "active"
            ? 18
            : 8;
    }

    // ARC EMPHASIS
    if (arc) {
      ctx.shadowColor = getArcColor(arc.phase);

      ctx.shadowBlur +=
        arc.phase === "climax" ? 18 : arc.phase === "escalation" ? 10 : 4;
    }

    ctx.fill();

    // CLEAN RESET
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.globalAlpha = 1;
  });
}

function drawLabels(ctx, renderState) {
  const { visibleNodes } = renderState;

  const minScale = 0.25;
  const maxScale = 0.65;

  // FULLY HIDDEN
  if (graphState.scale <= minScale) {
    return;
  }

  // SMOOTH INTERPOLATION
  const alpha = Math.min(
    1,
    (graphState.scale - minScale) / (maxScale - minScale),
  );

  ctx.save();

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Dynamic font scaling
  const fontSize = Math.max(11, Math.min(16, 14 * graphState.scale));

  ctx.font = `${fontSize}px sans-serif`;

  visibleNodes
    .slice()
    .sort((a, b) => getSemanticImportance(b) - getSemanticImportance(a))
    .forEach((node) => {
      const isHovered = node.id === graphState.hoveredNodeId;

      const screenX = node.x * graphState.scale + graphState.offsetX;

      const screenY = node.y * graphState.scale + graphState.offsetY;

      const radius = Math.max(
        10,
        NODE_RADIUS * Math.max(graphState.scale, 0.7),
      );

      const importance = getSemanticImportance(node);

      const arc = graphState.arcMap.get(node.id);

      const characterData = graphState.characterDynamics.get(node.id);

      const emotion = graphState.emotionMap.get(node.id);

      const zoomLevel = graphState.semanticZoomLevel;

      // SEMANTIC LABEL LOD
      if (zoomLevel === 1) {
        if (importance < 14) {
          return;
        }
      }

      if (zoomLevel === 2) {
        if (importance < 8) {
          return;
        }
      }

      // TAG DENSITY REDUCTION
      if (alpha < 0.35 && node.type === "tag" && !isHovered) {
        return;
      }

      const densityFade = Math.min(1, importance / 10);

      // RESET PER LABEL
      ctx.globalAlpha = alpha * (0.35 + densityFade * 0.65);

      ctx.shadowColor = "rgba(0,0,0,0.6)";

      ctx.shadowBlur = 4;

      const label =
        node.type === "character" &&
        characterData &&
        graphState.semanticZoomLevel >= 3
          ? `${node.label} • ${characterData.role}`
          : emotion && graphState.semanticZoomLevel >= 4
            ? `${node.label} • ${emotion.state}`
            : arc && graphState.semanticZoomLevel >= 3
              ? `${node.label} • ${arc.phase}`
              : node.label;

      ctx.fillText(label, screenX, screenY + radius + 18);
    });

  ctx.shadowBlur = 0;

  ctx.restore();
}

function getConvexHull(points) {
  if (points.length < 3) return points;

  const sorted = [...points].sort((a, b) =>
    a.x === b.x ? a.y - b.y : a.x - b.x,
  );

  const cross = (o, a, b) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];

  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];

  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];

    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }

    upper.push(p);
  }

  upper.pop();
  lower.pop();

  return lower.concat(upper);
}

function expandHull(points, padding = 60) {
  let centerX = 0;
  let centerY = 0;

  points.forEach((p) => {
    centerX += p.x;
    centerY += p.y;
  });

  centerX /= points.length;
  centerY /= points.length;

  return points.map((p) => {
    const dx = p.x - centerX;
    const dy = p.y - centerY;

    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    return {
      x: p.x + (dx / dist) * padding,
      y: p.y + (dy / dist) * padding,
    };
  });
}

function drawSmoothHull(ctx, points) {
  if (points.length < 3) return;

  ctx.beginPath();

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;

    if (i === 0) {
      ctx.moveTo(midX, midY);
    } else {
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }
  }

  const first = points[0];
  const last = points[points.length - 1];

  const midX = (first.x + last.x) / 2;
  const midY = (first.y + last.y) / 2;

  ctx.quadraticCurveTo(last.x, last.y, midX, midY);

  ctx.closePath();
}

function drawSemanticInfluenceFields(ctx) {
  const communityCenters = getCommunityCenters();
  const communityRadii = getCommunityRadii(communityCenters);
  const zoomLevel = graphState.semanticZoomLevel;

  communityCenters.forEach((center, communityId) => {
    const radius = communityRadii.get(communityId);

    if (!radius) return;

    const color =
      graphState.communityColors[
        communityId % graphState.communityColors.length
      ];

    const screenX = center.x * graphState.scale + graphState.offsetX;

    const screenY = center.y * graphState.scale + graphState.offsetY;

    const zoomMultiplier = zoomLevel === 1 ? 1.5 : zoomLevel === 2 ? 1.2 : 1;

    const scaledRadius = radius * graphState.scale * 1.15 * zoomMultiplier;

    // OUTER FIELD
    const gradient = ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      scaledRadius,
    );

    gradient.addColorStop(0, `${color}10`);
    gradient.addColorStop(0.4, `${color}08`);
    gradient.addColorStop(1, `${color}00`);

    const hotspotGradient = ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      scaledRadius * 0.45,
    );

    hotspotGradient.addColorStop(0, `${color}14`);
    hotspotGradient.addColorStop(1, `${color}00`);

    ctx.fillStyle = hotspotGradient;

    ctx.beginPath();

    ctx.arc(screenX, screenY, scaledRadius * 0.45, 0, Math.PI * 2);

    ctx.fill();

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);

    ctx.fill();
  });
}

function drawNarrativeTensionFields(ctx) {
  graphState.nodes.forEach((node) => {
    const tension = graphState.tensionMap.get(node.id);

    if (!tension || tension < 4) {
      return;
    }

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const radius = Math.min(180, 40 + tension * 12) * graphState.scale;

    const gradient = ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      radius,
    );

    gradient.addColorStop(0, "rgba(255,80,80,0.14)");

    gradient.addColorStop(0.4, "rgba(255,120,80,0.08)");

    gradient.addColorStop(1, "rgba(255,0,0,0)");

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    ctx.fill();
  });
}

function drawNarrativeArcFields(ctx) {
  graphState.nodes.forEach((node) => {
    const arc = graphState.arcMap.get(node.id);

    if (!arc) return;

    if (arc.phase === "setup") {
      return;
    }

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const radius = Math.min(220, 50 + arc.score * 5) * graphState.scale;

    const gradient = ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      radius,
    );

    const color = getArcColor(arc.phase);

    gradient.addColorStop(0, color);

    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;

    ctx.globalAlpha = 0.16;

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    ctx.fill();

    ctx.globalAlpha = 1;
  });
}

function drawCharacterInfluenceFields(ctx) {
  graphState.characterDynamics.forEach((data, nodeId) => {
    const node = graphState.nodeMap.get(nodeId);

    if (!node) return;

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const radius = Math.min(260, 60 + data.influence * 4) * graphState.scale;

    const gradient = ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      radius,
    );

    const color = getCharacterRoleColor(data.role);

    gradient.addColorStop(0, color.replace(")", ",0.18)"));

    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    ctx.fill();
  });
}

function drawEmotionalFields(ctx) {
  graphState.emotionMap.forEach((emotion, nodeId) => {
    const node = graphState.nodeMap.get(nodeId);

    if (!node) return;

    if (emotion.state === "calm") {
      return;
    }

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const radius = Math.min(320, 70 + emotion.pressure * 4) * graphState.scale;

    const gradient = ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      radius,
    );

    const color = getEmotionColor(emotion.state);

    gradient.addColorStop(0, color + ",0.16)");

    gradient.addColorStop(0.45, color + ",0.06)");

    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    ctx.fill();
  });
}

function drawRelationshipFields(ctx) {
  graphState.relationshipDynamics.forEach((relationship, key) => {
    const [fromId, toId] = key.split("-");

    const from = graphState.nodeMap.get(fromId);

    const to = graphState.nodeMap.get(toId);

    if (!from || !to) return;

    const fromX = from.x * graphState.scale + graphState.offsetX;

    const fromY = from.y * graphState.scale + graphState.offsetY;

    const toX = to.x * graphState.scale + graphState.offsetX;

    const toY = to.y * graphState.scale + graphState.offsetY;

    const midX = (fromX + toX) * 0.5;

    const midY = (fromY + toY) * 0.5;

    const radius = Math.min(180, 40 + relationship.volatility * 5);

    const gradient = ctx.createRadialGradient(
      midX,
      midY,
      0,
      midX,
      midY,
      radius,
    );

    const color =
      relationship.polarity === "alliance"
        ? "rgba(46,204,113"
        : "rgba(231,76,60";

    gradient.addColorStop(0, color + ",0.12)");

    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(midX, midY, radius, 0, Math.PI * 2);

    ctx.fill();
  });
}

function drawNarrativePropagationFields(ctx) {
  graphState.eventPropagationMap.forEach((event, nodeId) => {
    if (event.type === "stable") {
      return;
    }

    const node = graphState.nodeMap.get(nodeId);

    if (!node) return;

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const pulse = Math.sin(graphState.eventPulseTime) * 0.5 + 0.5;

    const radius = (60 + event.strength * 3 + pulse * 24) * graphState.scale;

    const gradient = ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      radius,
    );

    const color = getPropagationColor(event.type);

    gradient.addColorStop(0, color + ",0.16)");

    gradient.addColorStop(0.5, color + ",0.06)");

    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    ctx.fill();
  });
}

function drawSemanticInferenceEdges(ctx) {
  graphState.semanticInferenceMap.forEach((inference, key) => {
    const [fromId, toId] = key.split("-");

    const from = graphState.nodeMap.get(fromId);

    const to = graphState.nodeMap.get(toId);

    if (!from || !to) return;

    const fromX = from.x * graphState.scale + graphState.offsetX;

    const fromY = from.y * graphState.scale + graphState.offsetY;

    const toX = to.x * graphState.scale + graphState.offsetX;

    const toY = to.y * graphState.scale + graphState.offsetY;

    const { controlX, controlY } = getEdgeCurve(fromX, fromY, toX, toY);

    ctx.beginPath();

    ctx.moveTo(fromX, fromY);

    ctx.quadraticCurveTo(controlX, controlY, toX, toY);

    const pulse = Math.sin(graphState.animationTime * 2) * 0.5 + 0.5;

    ctx.strokeStyle = `rgba(120,180,255,${0.08 + pulse * 0.06})`;

    ctx.lineWidth = 0.5 + inference.score * 0.03;

    ctx.setLineDash([6, 10]);

    ctx.shadowColor = "rgba(120,180,255,0.35)";

    ctx.shadowBlur = 8;

    ctx.stroke();

    ctx.setLineDash([]);

    ctx.shadowBlur = 0;
  });
}

function drawNarrativeAnomalies(ctx) {
  graphState.semanticAnomalyMap.forEach((anomaly, nodeId) => {
    const node = graphState.nodeMap.get(nodeId);

    if (!node) return;

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const pulse = Math.sin(graphState.animationTime * 4) * 0.5 + 0.5;

    const radius = (28 + pulse * 8) * graphState.scale;

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    ctx.strokeStyle = "rgba(255,80,80,0.8)";

    ctx.lineWidth = 2;

    ctx.setLineDash([4, 6]);

    ctx.stroke();

    ctx.setLineDash([]);
  });
}

function drawAgentInsights(ctx) {
  graphState.agentSystem.insights.forEach((insight) => {
    const node = graphState.nodeMap.get(insight.nodeId);

    if (!node) return;

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const pulse = Math.sin(graphState.animationTime * 5) * 0.5 + 0.5;

    const severityScale =
      insight.severity === "critical"
        ? 1.4
        : insight.severity === "warning"
          ? 1
          : 0.7;

    const radius = (36 + pulse * 10) * severityScale * graphState.scale;

    const agent = graphState.agentSystem.agents.get(insight.agent);

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    ctx.strokeStyle = agent?.color || "#ffffff";

    ctx.lineWidth = 2;

    ctx.globalAlpha = 0.35;

    ctx.setLineDash([5, 8]);

    ctx.stroke();

    ctx.setLineDash([]);

    ctx.globalAlpha = 1;
  });
}

function drawTemporalNarrativeFields(ctx) {
  graphState.temporalStateMap.forEach((temporal, nodeId) => {
    if (temporal.state === "background") {
      return;
    }

    const node = graphState.nodeMap.get(nodeId);

    if (!node) return;

    const screenX = node.x * graphState.scale + graphState.offsetX;

    const screenY = node.y * graphState.scale + graphState.offsetY;

    const pulse = Math.sin(graphState.animationTime * 2) * 0.5 + 0.5;

    const radius = (40 + temporal.weight * 2 + pulse * 12) * graphState.scale;

    const gradient = ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      radius,
    );

    const color = getTemporalColor(temporal.state);

    gradient.addColorStop(0, color + ",0.14)");

    gradient.addColorStop(0.5, color + ",0.05)");

    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

    ctx.fill();
  });
}

function drawCommunityHulls(ctx) {
  const communities = new Map();

  graphState.nodes.forEach((node) => {
    if (node.community == null) return;

    if (!graphState.filters[node.type]) return;

    if (!communities.has(node.community)) {
      communities.set(node.community, []);
    }

    communities.get(node.community).push(node);
  });

  communities.forEach((nodes, communityId) => {
    if (nodes.length < 3) return;

    const color =
      graphState.communityColors[
        communityId % graphState.communityColors.length
      ];

    const screenPoints = nodes.map((node) => ({
      x: node.x * graphState.scale + graphState.offsetX,
      y: node.y * graphState.scale + graphState.offsetY,
    }));

    // 1. BUILD CONVEX HULL
    let hull = getConvexHull(screenPoints);

    // 2. EXPAND HULL
    hull = expandHull(hull, 55 * graphState.scale);

    // 3. DRAW SMOOTH REGION
    drawSmoothHull(ctx, hull);

    // ATMOSPHERIC FILL
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.045;

    ctx.fill();

    // VERY SOFT GLOW
    ctx.shadowColor = color;
    ctx.shadowBlur = 25;
    ctx.globalAlpha = 0.025;

    ctx.fill();

    // CLEAN RESET
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });
}

function getNodeTypeDisplayName(type) {
  switch (type) {
    case "notes":
      return "Research";

    case "world":
      return "Worldbuilding";

    case "timeline":
      return "Timeline";

    case "ideas":
      return "Ideas";

    case "chapter":
      return "Chapters";

    case "character":
      return "Characters";

    default:
      return capitalize(type);
  }
}

function generateCommunityLabels() {
  const labels = {};
  const communities = new Map();

  graphState.nodes.forEach((node) => {
    if (!communities.has(node.community)) {
      communities.set(node.community, []);
    }

    communities.get(node.community).push(node);
  });

  communities.forEach((nodes, communityId) => {
    const frequencies = new Map();

    nodes.forEach((node) => {
      /*
       * Ignore tags for naming
       */
      if (node.type === "tag") {
        return;
      }

      /*
       * Type weighting
       */
      incrementFrequency(frequencies, getNodeTypeDisplayName(node.type), 2);

      /*
       * Label words
       */
      const words = node.label
        .toLowerCase()
        .split(/\s+/)
        .filter(
          (word) =>
            word !== node.type.toLowerCase() &&
            word !== getNodeTypeDisplayName(node.type).toLowerCase(),
        );

      words.forEach((word) => {
        if (word.length < 4) {
          return;
        }

        incrementFrequency(frequencies, word, 1);
      });
    });

    const sorted = [...frequencies.entries()].sort((a, b) => b[1] - a[1]);

    const unique = [];

    sorted.forEach(([word]) => {
      const normalized = word.toLowerCase();

      if (!unique.some((existing) => existing.toLowerCase() === normalized)) {
        unique.push(word);
      }
    });

    const best = unique.slice(0, 2).map(capitalize);

    labels[communityId] = best.join(" • ");
  });

  graphState.communityLabels = labels;
}

function drawCommunityLabels(ctx) {
  const communities = new Map();

  graphState.nodes.forEach((node) => {
    if (node.community == null) return;

    if (!communities.has(node.community)) {
      communities.set(node.community, []);
    }

    communities.get(node.community).push(node);
  });

  communities.forEach((nodes, communityId) => {
    const label = graphState.communityLabels[communityId];

    if (!label) return;

    let avgX = 0;
    let avgY = 0;

    nodes.forEach((node) => {
      avgX += node.x;
      avgY += node.y;
    });

    avgX /= nodes.length;
    avgY /= nodes.length;

    const screenX = avgX * graphState.scale + graphState.offsetX;

    const screenY = avgY * graphState.scale + graphState.offsetY;

    ctx.save();

    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";

    ctx.fillStyle = "rgba(255,255,255,0.75)";

    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;

    ctx.fillText(label, screenX, screenY);

    ctx.restore();
  });
}

function drawOverlays(ctx, renderState) {
  drawCommunityLabels(ctx);
}

function renderGraphTooltip(node, mouseX, mouseY) {
  const data = getTooltipData(node);

  if (!data) {
    hideGraphTooltip();
    return;
  }

  graphTooltip.innerHTML = `
    <div class="graph-tooltip-title">
      ${data.title}
    </div>

    <div class="graph-tooltip-type">
      ${data.type}
    </div>

    <div class="graph-tooltip-excerpt">
      ${data.excerpt}
    </div>

    <div class="graph-tooltip-meta">
      ${data.meta
        .map((item) => `<span class="graph-tooltip-pill">${item}</span>`)
        .join("")}
    </div>
  `;

  positionGraphTooltip(mouseX, mouseY);

  graphTooltip.classList.remove("hidden");

  requestAnimationFrame(() => {
    graphTooltip.classList.add("visible");
  });
}

function applyForces() {
  const nodes = graphState.nodes;
  const edges = graphState.edges;
  if (!nodes.length) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Smooth cooling (slower = nicer animation)
  graphState.temperature *= 0.96;

  nodes.forEach((node) => {
    if (node.fixed) return;

    const neighbors = getConnectedNeighbors(node.id);

    if (!neighbors.length) return;

    let avgX = 0;
    let avgY = 0;

    neighbors.forEach((neighbor) => {
      avgX += neighbor.x;
      avgY += neighbor.y;
    });

    avgX /= neighbors.length;
    avgY /= neighbors.length;

    const dx = avgX - node.x;
    const dy = avgY - node.y;

    const cohesionStrength = 0.0025;

    node.vx += dx * cohesionStrength;
    node.vy += dy * cohesionStrength;
  });

  // --- REPULSION + MIN DISTANCE (prevents overlap)
  const minDist = 140; //  about node size spacing

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Normal repulsion
      const force = 40000 / (dist * dist);

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;

      // HARD separation if too close
      if (dist < minDist) {
        const push = (minDist - dist) * 0.05;
        const px = (dx / dist) * push;
        const py = (dy / dist) * push;

        a.vx -= px;
        a.vy -= py;
        b.vx += px;
        b.vy += py;
      }
    }
  }

  // --- EDGE ATTRACTION (stronger so things cluster)
  edges.forEach((edge) => {
    const a = graphState.nodeMap.get(edge.from);

    const b = graphState.nodeMap.get(edge.to);

    if (!a || !b) return;

    const dx = b.x - a.x;
    const dy = b.y - a.y;

    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const physics = edgePhysics[edge.relationshipType] || edgePhysics.character;

    const preferred = physics.preferredDistance;

    const attraction = physics.attraction;

    const force = (dist - preferred) * attraction;

    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    a.vx += fx;
    a.vy += fy;

    b.vx -= fx;
    b.vy -= fy;
  });

  const communityCenters = getCommunityCenters();
  const communityRadii = getCommunityRadii(communityCenters);

  nodes.forEach((node) => {
    if (node.fixed) return;

    const center = communityCenters.get(node.community);

    if (!center) return;

    const dx = center.x - node.x;
    const dy = center.y - node.y;

    const communityGravity =
      0.0022 + Math.min(0.002, edgeConnectionCount(node.id) * 0.00004);

    node.vx += dx * communityGravity;
    node.vy += dy * communityGravity;
  });

  // TOPOLOGY MEMORY FIELDS
  nodes.forEach((node) => {
    if (node.fixed) return;

    const anchor = graphState.communityAnchors.get(node.community);

    if (!anchor) return;

    const dx = anchor.x - node.x;
    const dy = anchor.y - node.y;

    const memoryStrength = 0.00045;

    node.vx += dx * memoryStrength;
    node.vy += dy * memoryStrength;
  });

  const communities = [...communityCenters.keys()];

  for (let i = 0; i < communities.length; i++) {
    for (let j = i + 1; j < communities.length; j++) {
      const aId = communities[i];
      const bId = communities[j];

      const aCenter = communityCenters.get(aId);

      const bCenter = communityCenters.get(bId);

      const aRadius = communityRadii.get(aId) || 0;

      const bRadius = communityRadii.get(bId) || 0;

      const dx = bCenter.x - aCenter.x;

      const dy = bCenter.y - aCenter.y;

      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const minDist = aRadius + bRadius + 120;

      if (dist >= minDist) continue;

      const overlap = minDist - dist;

      const nx = dx / dist;
      const ny = dy / dist;

      const push = overlap * 0.0025;

      graphState.nodes.forEach((node) => {
        if (node.community === aId) {
          node.vx -= nx * push;
          node.vy -= ny * push;
        }

        if (node.community === bId) {
          node.vx += nx * push;
          node.vy += ny * push;
        }
      });
    }
  }

  // SOFT CLUSTER GRAVITY
  nodes.forEach((node) => {
    if (node.fixed) return;

    const cluster = clusterCenters[node.type] || clusterCenters.chapter;

    const dx = cluster.x - node.x;
    const dy = cluster.y - node.y;

    node.vx += dx * 0.0008;
    node.vy += dy * 0.0008;
  });

  // MIGRATION ESCAPE FORCES
  nodes.forEach((node) => {
    if (node.fixed) return;

    const anchor = graphState.communityAnchors.get(node.community);

    if (!anchor) return;

    let blockingForceX = 0;
    let blockingForceY = 0;

    nodes.forEach((other) => {
      if (other.id === node.id || other.community === node.community) {
        return;
      }

      const dx = other.x - node.x;
      const dy = other.y - node.y;

      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // ONLY VERY CLOSE INTERFERENCE
      if (dist > 120) return;

      blockingForceX -= (dx / dist) * (120 - dist) * 0.012;

      blockingForceY -= (dy / dist) * (120 - dist) * 0.012;
    });

    // DIRECTION TO TARGET COMMUNITY
    const targetDX = anchor.x - node.x;

    const targetDY = anchor.y - node.y;

    const targetDist =
      Math.sqrt(targetDX * targetDX + targetDY * targetDY) || 1;

    // ESCAPE VECTOR
    node.vx += blockingForceX + (targetDX / targetDist) * 0.08;

    node.vy += blockingForceY + (targetDY / targetDist) * 0.08;
  });

  // --- APPLY MOVEMENT
  const padding = 60;

  nodes.forEach((node) => {
    if (node.fixed) return;

    node.x += node.vx;
    node.y += node.vy;

    // Strong damping = no runaway
    node.vx *= 0.72;
    node.vy *= 0.72;

    // HARD BOUNDS (prevents flying off screen)
    node.x = Math.max(padding, Math.min(canvas.width - padding, node.x));
    node.y = Math.max(padding, Math.min(canvas.height - padding, node.y));

    // velocity cap
    node.vx = Math.max(-3, Math.min(3, node.vx));
    node.vy = Math.max(-3, Math.min(3, node.vy));
  });
}

function updateGraphPhysics() {
  applyForces();
}

function wakeGraphPhysics() {
  graphState.temperature = 1;

  startGraphLoop();
}

function animateGraph() {
  if (!graphAnimating) return;

  updateGraphPhysics();
  updateGraphCamera();
  updateSemanticZoomLevel();
  calculateNarrativeTension();
  detectNarrativeArcs();
  analyzeCharacterDynamics();
  analyzeEmotionalTrajectories();
  analyzeRelationshipDynamics();
  analyzeNarrativePropagation();
  analyzeTemporalNarrativeState();
  analyzeSemanticInference();
  analyzeSemanticMotifs();
  analyzeNarrativeAnomalies();
  runAgentSystem();
  updateNarrativeTimeline();

  graphState.animationTime += 0.016;
  graphState.eventPulseTime += 0.045;

  renderGraph();

  const cameraSettled =
    Math.abs(graphState.offsetX - graphState.targetOffsetX) < 0.5 &&
    Math.abs(graphState.offsetY - graphState.targetOffsetY) < 0.5 &&
    Math.abs(graphState.scale - graphState.targetScale) < 0.001;

  const physicsSettled = graphState.temperature < 0.02;

  if (!cameraSettled || !physicsSettled) {
    graphAnimationFrame = requestAnimationFrame(animateGraph);
  } else {
    graphAnimating = false;
  }
}

// Camera system
function updateGraphCamera() {
  if (graphState.dragging.isDraggingGraph) {
    return;
  }

  const cameraLerp = 0.14;
  const zoomLerp = 0.12;

  graphState.offsetX +=
    (graphState.targetOffsetX - graphState.offsetX) * cameraLerp;

  graphState.offsetY +=
    (graphState.targetOffsetY - graphState.offsetY) * cameraLerp;

  graphState.scale += (graphState.targetScale - graphState.scale) * zoomLerp;

  graphState.scale = Math.max(0.05, graphState.scale);

  graphState.targetScale = Math.max(0.05, graphState.targetScale);

  clampGraphCamera();
}

function setCamera(scale, offsetX, offsetY) {
  graphState.targetScale = scale;
  graphState.targetOffsetX = offsetX;
  graphState.targetOffsetY = offsetY;

  // immediately start animation loop
  wakeGraphPhysics();
}

function startGraphLoop() {
  if (graphAnimating) return;

  graphAnimating = true;
  graphAnimationFrame = requestAnimationFrame(animateGraph);
}

function centerGraph() {
  const bounds = getGraphBounds();
  if (!bounds) return;

  graphState.targetOffsetX =
    canvas.width / 2 - bounds.centerX * graphState.scale;

  graphState.targetOffsetY =
    canvas.height / 2 - bounds.centerY * graphState.scale;

  wakeGraphPhysics();
}

function focusNode(nodeId, options = {}) {
  const node = graphState.nodeMap.get(nodeId);

  if (!node) return;

  const { scale = Math.max(graphState.scale, 0.9), animate = true } = options;

  const offsetX = canvas.width / 2 - node.x * scale;

  const offsetY = canvas.height / 2 - node.y * scale;

  setCamera(scale, offsetX, offsetY);

  if (animate) {
    wakeGraphPhysics();
  } else {
    graphState.scale = scale;
    graphState.offsetX = offsetX;
    graphState.offsetY = offsetY;
  }

  if (isNodeNearCenter(node)) {
    return;
  }
}

function centerOnNode(nodeId) {
  focusNode(nodeId);
}

function isNodeNearCenter(node) {
  const screenX = node.x * graphState.scale + graphState.offsetX;

  const screenY = node.y * graphState.scale + graphState.offsetY;

  const dx = screenX - canvas.width / 2;

  const dy = screenY - canvas.height / 2;

  return Math.sqrt(dx * dx + dy * dy) < 180;
}

function resetGraphView() {
  setCamera(
    graphState.initialScale,
    graphState.initialOffsetX,
    graphState.initialOffsetY,
  );
}

function fitGraphToScreen() {
  const bounds = getGraphBounds();
  if (!bounds) return;

  const padding = 120;

  const scaleX = (canvas.width - padding) / bounds.width;
  const scaleY = (canvas.height - padding) / bounds.height;

  const newScale = Math.min(scaleX, scaleY);

  setCamera(
    newScale,
    canvas.width / 2 - bounds.centerX * newScale,
    canvas.height / 2 - bounds.centerY * newScale,
  );

  wakeGraphPhysics();
}

function clampGraphCamera() {
  const bounds = getGraphBounds();
  if (!bounds) return;

  const scaledWidth = bounds.width * graphState.scale;
  const scaledHeight = bounds.height * graphState.scale;

  const padding = 1000;

  const minOffsetX = canvas.width - scaledWidth - padding;
  const maxOffsetX = padding;

  const minOffsetY = canvas.height - scaledHeight - padding;
  const maxOffsetY = padding;

  graphState.offsetX = Math.max(
    minOffsetX,
    Math.min(maxOffsetX, graphState.offsetX),
  );

  graphState.offsetY = Math.max(
    minOffsetY,
    Math.min(maxOffsetY, graphState.offsetY),
  );
}

function updateSemanticZoomLevel() {
  const scale = graphState.scale;

  if (scale < 0.28) {
    graphState.semanticZoomLevel = 1;
  } else if (scale < 0.5) {
    graphState.semanticZoomLevel = 2;
  } else if (scale < 0.9) {
    graphState.semanticZoomLevel = 3;
  } else {
    graphState.semanticZoomLevel = 4;
  }
}

function navigateFromMinimap(x, y) {
  const transform = getMinimapTransform();

  if (!transform) return;

  const { minimapScale, offsetX, offsetY } = transform;

  const worldX = (x - offsetX) / minimapScale;

  const worldY = (y - offsetY) / minimapScale;

  graphState.targetOffsetX = canvas.width / 2 - worldX * graphState.scale;

  graphState.targetOffsetY = canvas.height / 2 - worldY * graphState.scale;

  wakeGraphPhysics();
}

// Graph interaction
function handleGraphClick(x, y, event) {
  if (graphState.hasDragged) return;

  const { node, distance } = findClosestNode(x, y);

  if (node && distance <= CLICK_RADIUS) {
    if (graphTransitioning) return;

    // PATH TRACING
    if (event.shiftKey) {
      if (graphState.traceStartNodeId) {
        graphState.tracedPath = findShortestPath(
          graphState.traceStartNodeId,
          node.id,
        );

        graphState.traceStartNodeId = null;
      } else {
        graphState.traceStartNodeId = node.id;

        graphState.tracedPath = [];
      }
    } else {
      graphState.tracedPath = [];

      graphState.traceStartNodeId = null;
    }

    graphTransitioning = true;

    graphState.selectedNodeId = node.id;

    // COGNITIVE CONTEXT
    buildCognitiveContextWindow(node.id);

    renderGraph();

    setTimeout(() => {
      graphTransitioning = false;
    }, 180);
  } else {
    graphState.selectedNodeId = null;

    graphState.tracedPath = [];

    graphState.traceStartNodeId = null;

    graphState.cognitiveContext.activeWindow = [];

    renderGraph();
  }
}

function findClosestNode(x, y) {
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

  return {
    node: closestNode,
    distance: closestDistance,
  };
}

function findShortestPath(startId, endId) {
  if (!startId || !endId) {
    return [];
  }

  const queue = [[startId]];

  const visited = new Set();

  visited.add(startId);

  while (queue.length) {
    const path = queue.shift();

    const current = path[path.length - 1];

    if (current === endId) {
      return path;
    }

    const neighbors = graphState.edges
      .filter((edge) => edge.from === current)
      .map((edge) => edge.to);

    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);

        queue.push([...path, next]);
      }
    }
  }

  return [];
}

function positionGraphTooltip(mouseX, mouseY) {
  const modalRect = graphModalContent.getBoundingClientRect();

  const tooltipRect = graphTooltip.getBoundingClientRect();

  const padding = 18;

  let x = mouseX + 18;
  let y = mouseY + 18;

  // RIGHT EDGE
  if (x + tooltipRect.width > modalRect.width - padding) {
    x = modalRect.width - tooltipRect.width - padding;
  }

  // BOTTOM EDGE
  if (y + tooltipRect.height > modalRect.height - padding) {
    y = modalRect.height - tooltipRect.height - padding;
  }

  graphTooltip.style.left = `${x}px`;
  graphTooltip.style.top = `${y}px`;
}

function hideGraphTooltip() {
  graphTooltip.classList.remove("visible");

  setTimeout(() => {
    if (!graphTooltip.classList.contains("visible")) {
      graphTooltip.classList.add("hidden");
    }
  }, 140);
}

function openGraph() {
  if (isPreviewMode) return;

  canvas.setAttribute("tabindex", "0");

  setTimeout(() => canvas.focus(), 50);

  graphState.isOpen = true;

  graphState.filters = {
    chapter: true,
    character: true,
    timeline: true,
    world: true,
    notes: true,
    ideas: true,
    tag: true,
  };

  graphState.focusMode = true;

  document
    .querySelectorAll("#graph-filters input[type='checkbox']")
    .forEach((checkbox) => {
      const type = checkbox.dataset.type;
      if (type) checkbox.checked = graphState.filters[type];
      if (checkbox.id === "focus-mode-toggle") {
        checkbox.checked = graphState.focusMode;
      }
    });

  document.getElementById("graph-modal").classList.remove("hidden");

  // STOP animation
  graphAnimating = false;
  if (graphAnimationFrame) {
    cancelAnimationFrame(graphAnimationFrame);
    graphAnimationFrame = null;
  }

  // RESET STATE
  graphState.nodes = [];
  graphState.edges = [];
  graphState.selectedNodeId = null;

  setupCanvasSize();

  clusterCenters.chapter = {
    x: canvas.width * 0.5,
    y: canvas.height * 0.5,
  };

  clusterCenters.character = {
    x: canvas.width * 0.25,
    y: canvas.height * 0.5,
  };

  clusterCenters.tag = {
    x: canvas.width * 0.75,
    y: canvas.height * 0.5,
  };

  clusterCenters.world = {
    x: canvas.width * 0.72,
    y: canvas.height * 0.35,
  };

  clusterCenters.timeline = {
    x: canvas.width * 0.62,
    y: canvas.height * 0.22,
  };

  clusterCenters.notes = {
    x: canvas.width * 0.78,
    y: canvas.height * 0.68,
  };

  clusterCenters.ideas = {
    x: canvas.width * 0.88,
    y: canvas.height * 0.5,
  };

  // BUILD GRAPH
  const data = getGraphData();

  const spacing = Math.max(120, 300 - data.nodes.length * 5);
  const radius = spacing * Math.sqrt(data.nodes.length || 1);

  graphState.nodes = data.nodes.map((node) => {
    const cluster = clusterCenters[node.type] || clusterCenters.chapter;

    return {
      ...node,

      x: cluster.x + (Math.random() - 0.5) * 300,
      y: cluster.y + (Math.random() - 0.5) * 300,

      vx: 0,
      vy: 0,

      fixed: false,
    };
  });

  graphState.nodeMap.clear();

  graphState.nodes.forEach((node) => {
    graphState.nodeMap.set(node.id, node);
  });

  graphState.edges = data.edges;

  detectCommunities();
  detectSubcommunities();

  // INITIAL CAMERA (centered)
  graphState.scale = 0.3;
  graphState.targetScale = 0.3;

  graphState.offsetX = canvas.width / 2;
  graphState.offsetY = canvas.height / 2;

  graphState.targetOffsetX = canvas.width / 2;
  graphState.targetOffsetY = canvas.height / 2;

  // FIT AFTER RENDER
  setTimeout(() => {
    fitGraphToScreen();

    // SAVE BASELINE
    graphState.initialScale = graphState.targetScale;
    graphState.initialOffsetX = graphState.targetOffsetX;
    graphState.initialOffsetY = graphState.targetOffsetY;
  }, 100);

  graphState.temperature = 1;

  renderGraph();
  wakeGraphPhysics();
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

function openDocumentFromGraph(id) {
  closeGraph();
  loadDocument(id);

  setTimeout(() => {
    editorContent.focus();
  }, 100);
}

function setupCanvasSize() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  minimapCanvas.width = 220;
  minimapCanvas.height = 160;
}

// Graph mouse controls
function onGraphMouseDown(e) {
  const drag = graphState.dragging;
  if (!drag) {
    console.error("Dragging state missing");
    return;
  }

  const rect = canvas.getBoundingClientRect();

  const worldX =
    (e.clientX - rect.left - graphState.offsetX) / graphState.scale;
  const worldY = (e.clientY - rect.top - graphState.offsetY) / graphState.scale;

  drag.startX = e.clientX;
  drag.startY = e.clientY;
  drag.hasDragged = false;

  // find clicked node
  const visibleNodes = graphState.nodes.filter(
    (node) => graphState.filters[node.type],
  );

  let clickedNode = null;

  for (const node of visibleNodes) {
    const dx = node.x - worldX;
    const dy = node.y - worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clickableRadius = Math.max(NODE_RADIUS * graphState.scale, 18);

    if (dist < clickableRadius / graphState.scale) {
      clickedNode = node;
      break;
    }

    canvas.style.cursor = clickedNode ? "pointer" : "grab";
  }

  if (clickedNode) {
    drag.draggedNode = clickedNode;

    drag.nodeOffsetX = worldX - clickedNode.x;
    drag.nodeOffsetY = worldY - clickedNode.y;

    drag.isDraggingGraph = false;
  } else {
    drag.draggedNode = null;
    drag.isDraggingGraph = true; // enables panning
  }
}

function onGraphMouseMove(e) {
  const rect = canvas.getBoundingClientRect();

  const drag = graphState.dragging;

  const localX = e.clientX - rect.left;
  const localY = e.clientY - rect.top;

  const insideCanvas =
    localX >= 0 && localY >= 0 && localX <= rect.width && localY <= rect.height;

  const worldX = (localX - graphState.offsetX) / graphState.scale;

  const worldY = (localY - graphState.offsetY) / graphState.scale;

  // NODE DRAGGING
  if (drag.draggedNode) {
    drag.hasDragged = true;

    drag.draggedNode.x = worldX - drag.nodeOffsetX;

    drag.draggedNode.y = worldY - drag.nodeOffsetY;

    drag.draggedNode.vx = 0;
    drag.draggedNode.vy = 0;

    drag.draggedNode.fixed = true;

    wakeGraphPhysics();

    renderGraph();

    return;
  }

  // GRAPH PANNING
  if (drag.isDraggingGraph) {
    drag.hasDragged = true;

    canvas.style.cursor = "grabbing";

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    graphState.offsetX += dx;
    graphState.offsetY += dy;

    graphState.targetOffsetX = graphState.offsetX;

    graphState.targetOffsetY = graphState.offsetY;

    drag.startX = e.clientX;
    drag.startY = e.clientY;

    renderGraph();

    return;
  }

  // ONLY PROCESS HOVER INSIDE CANVAS
  if (!insideCanvas) {
    hideGraphTooltip();

    graphState.hoveredNodeId = null;

    canvas.style.cursor = "default";

    return;
  }

  // HOVER DETECTION
  const hoveredNode = getNodeAtPosition(worldX, worldY);

  graphState.hoveredNodeId = hoveredNode ? hoveredNode.id : null;

  if (hoveredNode) {
    renderGraphTooltip(hoveredNode, localX, localY);
  } else {
    hideGraphTooltip();
  }

  // CURSOR
  canvas.style.cursor = hoveredNode ? "pointer" : "grab";

  renderGraph();

  clampGraphCamera();
}

function onGraphMouseUp() {
  const drag = graphState.dragging;

  // RELEASE NODE
  if (drag.draggedNode) {
    drag.draggedNode.fixed = false;
    drag.draggedNode = null;
  }

  // RELEASE GRAPH
  drag.isDraggingGraph = false;

  canvas.style.cursor = "grab";

  // SYNCHRONIZE CAMERA TARGETS
  graphState.targetOffsetX = graphState.offsetX;
  graphState.targetOffsetY = graphState.offsetY;
  graphState.targetScale = graphState.scale;

  // RESET DRAG STATE
  drag.nodeOffsetX = 0;
  drag.nodeOffsetY = 0;
}

function onGraphMouseLeave() {
  graphState.isDraggingGraph = false;
  graphState.draggedNode = null;
  graphState.hasDragged = false;
  hideGraphTooltip();
}

function onGraphWheel(e) {
  e.preventDefault();

  wakeGraphPhysics();

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

  const newScale = Math.max(
    0.1,
    Math.min(3, graphState.targetScale * zoomFactor),
  );

  const worldX = (mouseX - graphState.offsetX) / graphState.scale;
  const worldY = (mouseY - graphState.offsetY) / graphState.scale;

  graphState.targetScale = newScale;

  graphState.targetOffsetX = mouseX - worldX * newScale;
  graphState.targetOffsetY = mouseY - worldY * newScale;
}

function onGraphClick(e) {
  const rect = canvas.getBoundingClientRect();

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  handleGraphClick(
    (mouseX - graphState.offsetX) / graphState.scale,

    (mouseY - graphState.offsetY) / graphState.scale,

    e,
  );

  if (graphState.selectedNodeId) {
    focusNode(graphState.selectedNodeId, {
      scale: Math.max(graphState.scale, 0.85),
    });
  }
}

function onGraphDoubleClick(e) {
  const rect = canvas.getBoundingClientRect();

  const x = (e.clientX - rect.left - graphState.offsetX) / graphState.scale;

  const y = (e.clientY - rect.top - graphState.offsetY) / graphState.scale;

  const { node, distance } = findClosestNode(x, y);

  if (node && distance <= NODE_RADIUS) {
    focusNode(node.id, {
      scale: 1.15,
    });

    openDocumentFromGraph(node.id);
  }
}

function onMinimapMouseDown(e) {
  graphState.minimap.dragging = true;

  const rect = minimapCanvas.getBoundingClientRect();

  navigateFromMinimap(e.clientX - rect.left, e.clientY - rect.top);
}

function onMinimapMouseMove(e) {
  if (!graphState.minimap.dragging) return;

  const rect = minimapCanvas.getBoundingClientRect();

  navigateFromMinimap(e.clientX - rect.left, e.clientY - rect.top);
}

function onMinimapMouseUp() {
  graphState.minimap.dragging = false;
}

// Graph initialization
function initGraphEvents() {
  initGraphCanvasEvent();
  initMinimapEvents();
  initGraphUIEvents();
  initGraphKeyboardControls();
}

function initGraphCanvasEvent() {
  const canvas = document.getElementById("graph-canvas");

  // CANVAS-BOUND EVENTS
  canvas.addEventListener("mousedown", onGraphMouseDown);
  canvas.addEventListener("mouseleave", onGraphMouseLeave);
  canvas.addEventListener("wheel", onGraphWheel, {
    passive: false,
  });

  canvas.addEventListener("click", onGraphClick);
  canvas.addEventListener("dblclick", onGraphDoubleClick);

  // WINDOW-BOUND DRAG EVENTS
  window.addEventListener("mousemove", onGraphMouseMove);
  window.addEventListener("mouseup", onGraphMouseUp);
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

function initMinimapEvents() {
  minimapCanvas.addEventListener("mousedown", onMinimapMouseDown);

  window.addEventListener("mousemove", onMinimapMouseMove);

  window.addEventListener("mouseup", onMinimapMouseUp);
}

// =====================================================
// EDITOR SYSTEM
// =====================================================

// Editor initialization
function initEditorEvents() {
  initEditorInputEvents();
  initEditorKeyboardEvents();
  initEditorToolbarEvents();
  initEditorTitleEvents();
  initEditorUIEvents();
}

function initEditorInputEvents() {
  editorContent.addEventListener("input", onEditorInput);
  editorContent.addEventListener("keyup", updateToolbarState);
  editorContent.addEventListener("click", updateToolbarState);
}

function initEditorKeyboardEvents() {
  editorContent.addEventListener("keydown", handleEditorKeyDown);

  editorContent.addEventListener("blur", () => {
    editorState.lastSelectionStart = editorContent.selectionStart;
    editorState.lastSelectionEnd = editorContent.selectionEnd;
  });
}

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

function initEditorTitleEvents() {
  editorTitle.addEventListener("input", onTitleChange);
  editorTitle.addEventListener("keydown", onTitleKeyDown);
}

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

// Editor input handling
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

  if (graphState.isOpen) {
    if (e.key.toLowerCase() === "c") {
      e.preventDefault();
      centerGraph();
      return;
    }
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

// Toolbar/editor formatting
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

// Title handling
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

// Selection handling
function restoreSelection() {
  editorContent.focus();
}

// Editor save/restore
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

// Preview/focus modes
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

// Word count / typography
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

// =====================================================
// SIDEBAR SYSTEM
// =====================================================

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

// =====================================================
// TAG SYSTEM
// =====================================================

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

// =====================================================
// CHARACTER RELATIONSHIP SYSTEM
// =====================================================

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

// =====================================================
// DOCUMENT MANAGEMENT
// =====================================================

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

function selectFirstDocument() {
  const docs = projects[appState.currentProjectId]?.documents || {};
  const firstId = Object.keys(docs)[0];

  if (firstId) {
    loadDocument(firstId);
  }
}

// =====================================================
// PROJECT MANAGEMENT
// =====================================================

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

// =====================================================
// MENU SYSTEM
// =====================================================

function initMenuSystem() {
  initMenuCoreEvents();
  initMenuSwitchEvents();
  initMenuActionEvents();
}

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

// =====================================================
// EXPORT SYSTEM
// =====================================================

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

function closeExportModal() {
  document.getElementById("export-modal").classList.add("hidden");
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

// =====================================================
// HELP / ABOUT MODALS
// =====================================================

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

// =====================================================
// KEYBOARD SHORTCUTS
// =====================================================

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

// =====================================================
// EVENT LISTENERS
// =====================================================

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

// =====================================================
// APPLICATION INITIALIZATION
// =====================================================

function initApp() {
  loadFromLocalStorage();

  initMenuSystem();
  initEditorEvents();
  initSidebarEvents();
  initKeyboardShortcuts();
  initGraphEvents();
  initializeAgents();
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
