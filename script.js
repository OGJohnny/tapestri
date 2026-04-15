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
let isFocusMode = false;
let isPreviewMode = false;
let exportMode = "project";

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

function debounceSave() {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    saveToLocalStorage();
  }, 300);
}

// =====================
// HELPERS
// =====================

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

function renderMarkdown(text) {
  if (!text) return "";

  return text
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>")
    .replace(/__(.*?)__/gim, "<u>$1</u>")
    .replace(/(^|[^*])\*(?!\*)(.*?)\*(?!\*)/gim, "$1<i>$2</i>")
    .replace(/\n/gim, "<br>");
}

function getWordCount(text) {
  if (!text) return 0;

  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
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
  const preview = document.getElementById("preview-pane");
  preview.innerHTML = renderMarkdown(editorContent.value);
}

function formatText(type) {
  const textarea = editorContent;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

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

  updatePreview();
  updateWordCount();
}

function togglePreview() {
  isPreviewMode = !isPreviewMode;

  applyPreviewMode();
  savePreviewMode();
}

function toggleFocusMode() {
  isFocusMode = !isFocusMode;

  document.body.classList.toggle("focus-mode", isFocusMode);

  saveFocusMode();
}

function applyPreviewMode() {
  document.body.classList.toggle("preview-mode", isPreviewMode);
}

function updateWordCount() {
  const text = editorContent.value;

  const words = getWordCount(text);
  const chars = text.length;

  document.getElementById("word-count").textContent =
    `Words: ${words} | Characters: ${chars}`;
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

  editorContent.focus();
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

function renderSidebar() {
  const lists = document.querySelectorAll("ul");

  lists.forEach((list) => {
    list.innerHTML = "";
  });

  const docs = projects[currentProjectId]?.documents || {};

  for (const id in docs) {
    const doc = projects[currentProjectId].documents[id];

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
  modal.classList.remove("hidden");

  const input = document.getElementById("export-filename");

  if (exportMode === "document") {
    input.value = "document.md";
  } else {
    input.value = "project.md";
  }

  input.focus();

  const options = modal.querySelector(".export-options");

  if (exportMode === "document") {
    options.style.display = "none";
  } else {
    options.style.display = "block";

    const checkboxes = modal.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach((cb) => (cb.checked = true));
  }
}

function closeExportModal() {
  document.getElementById("export-modal").classList.add("hidden");
}

function handleExportConfirm() {
  const filename = document.getElementById("export-filename").value.trim();
  if (!filename) return;

  let content = "";

  if (exportMode === "document") {
    content = exportCurrentDocument();
  } else {
    const checkboxes = document.querySelectorAll(
      "#export-modal input[type='checkbox']:checked",
    );

    const selectedSections = Array.from(checkboxes).map((cb) => cb.value);

    content = buildExportContent(selectedSections);
  }

  downloadFile(filename, content);

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

// =====================
// MENU SYSTEM
// =====================

function initMenuSystem() {
  const menus = {
    file: document.getElementById("file-menu"),
    edit: document.getElementById("edit-menu"),
    view: document.getElementById("view-menu"),
  };

  let activeMenu = null;

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const menuName = item.dataset.menu;
      const menu = menus[menuName];

      if (activeMenu === menuName) {
        menu.style.display = "none";
        activeMenu = null;
        return;
      }

      document.querySelectorAll(".menu-option").forEach((item) => {
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
        });
      });

      Object.values(menus).forEach((m) => (m.style.display = "none"));

      menu.style.display = "block";
      activeMenu = menuName;
    });
  });

  document.addEventListener("click", (e) => {
    const isMenuItem = e.target.closest(".menu-item");
    const isDropdown = e.target.closest(".menu-dropdown");

    if (!isMenuItem && !isDropdown) {
      Object.values(menus).forEach((m) => (m.style.display = "none"));
      activeMenu = null;
    }
  });

  document.getElementById("export-project").addEventListener("click", () => {
    openExportModal();
  });

  document.getElementById("export-project").addEventListener("click", () => {
    exportMode = "project";
    openExportModal();
  });

  document.getElementById("export-doc").addEventListener("click", () => {
    exportMode = "document";
    openExportModal();
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

    saveHistory();

    doc.content = editorContent.value;

    updatePreview();
    updateWordCount();
    debounceSave();
  });

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

  editorTitle.addEventListener("input", saveDocument);
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
  });
}

function initEventListeners() {
  getItems().forEach((item) => {
    attachItemListeners(item);
  });

  document.getElementById("new-project").addEventListener("click", () => {
    document.getElementById("new-project-btn").click();
  });

  document.getElementById("export-doc").addEventListener("click", () => {
    exportCurrentDocument();
  });

  document.querySelectorAll("#edit-menu [data-format]").forEach((item) => {
    item.addEventListener("click", () => {
      formatText(item.dataset.format);
    });
  });

  document.getElementById("toggle-focus").addEventListener("click", () => {
    toggleFocusMode();
  });

  document
    .getElementById("toggle-preview-menu")
    .addEventListener("click", () => {
      togglePreview();
    });

  document.addEventListener("keydown", (e) => {
    // Ctrl + P → Toggle Preview
    if (e.ctrlKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      togglePreview();
    }
  });

  document.getElementById("togglePreviewBtn").addEventListener("click", () => {
    document
      .getElementById("togglePreviewBtn")
      .addEventListener("click", togglePreview);
  });

  const togglePreviewBtn = document.getElementById("togglePreviewBtn");

  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener("click", togglePreview);
  }

  searchInput.addEventListener("input", () => {
    const query = searchInput.value;

    if (query === "") {
      renderSidebar();
    } else {
      searchDocuments(query);
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
    item.addEventListener("click", () => {
      handleItemClick(item);
    });
  });

  getItems().forEach((item) => {
    item.addEventListener("dblclick", () => {
      renameItem(item);
    });
  });

  getItems().forEach((item) => {
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

  document
    .getElementById("rename-project-btn")
    .addEventListener("click", renameProject);

  document
    .getElementById("delete-project-btn")
    .addEventListener("click", deleteProject);

  document.addEventListener("keydown", (e) => {
    // Ctrl + Shift + F → Toggle Focus Mode
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      toggleFocusMode();
    }
  });

  document.querySelectorAll(".format-toolbar button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.format;
      formatText(type);
    });
  });

  document
    .getElementById("confirm-export")
    .addEventListener("click", handleExportConfirm);

  document
    .getElementById("cancel-export")
    .addEventListener("click", closeExportModal);

  saveHistory();
  initMenuSystem();
  initEditorEvents();
  initSidebarEvents();
  initKeyboardShortcuts();
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
  updatePreview();
  loadPreviewMode();
  applyPreviewMode();
  loadFocusMode();
  renderProjectList();
  renderSidebar();
  selectFirstDocument();
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
  initEventListeners();
});
