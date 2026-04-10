// ======================
// DATA (APP STATE)
// ======================
let projects = {};
let currentProjectId = null;
let currentDocumentId = null;

const appState = {
  activeSection: null,
  activeItemId: null,
};

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

// ======================
// FUNCTIONS
// ======================

// DATA
function saveToLocalStorage() {
  localStorage.setItem("tapestriProjects", JSON.stringify(projects));
  localStorage.setItem("tapestriCurrentProject", currentProjectId);
}

function loadFromLocalStorage() {
  const data = localStorage.getItem("tapestriProjects");
  const savedProjectId = localStorage.getItem("tapestriCurrentProject");

  if (data) {
    projects = JSON.parse(data);

    // Fix old data
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

    currentProjectId = savedProjectId || Object.keys(projects)[0];
  } else {
    // 🔥 First project
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

    saveToLocalStorage();
  }
}

// RENDER
function renderSidebar() {
  const lists = document.querySelectorAll("ul");

  lists.forEach((list) => {
    list.innerHTML = "";
  });

  const docs = projects[currentProjectId].documents;

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

// DOCUMENT LOGIC
function loadDocument(id) {
  const doc = projects[currentProjectId].documents[id];

  if (!doc) return;

  currentDocumentId = id;

  editorTitle.value = doc.title;
  editorContent.value = doc.content;

  renderTags(doc);

  populateCharacterSelect();
  renderCharacterRelationships(doc);

  if (doc.type === "character") {
    renderChapterAppearances(id);
  } else {
    document.getElementById("chapter-appearances").innerHTML = "";
  }
}

function saveDocument() {
  if (!currentDocumentId) return;

  projects[currentProjectId].documents[currentDocumentId].title =
    editorTitle.value;
  projects[currentProjectId].documents[currentDocumentId].content =
    editorContent.value;

  saveToLocalStorage();
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

  saveToLocalStorage();
  renderProjectList();
  renderSidebar();
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
  saveToLocalStorage();
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

  saveToLocalStorage();
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

  saveToLocalStorage();
}

function clearEditor() {
  editorTitle.value = "";
  editorContent.value = "";

  tagList.innerHTML = "";
  characterList.innerHTML = "";

  const appearances = document.getElementById("chapter-appearances");
  if (appearances) appearances.innerHTML = "";

  characterSelect.innerHTML = ""; // 🔥 clears dropdown
}

function selectFirstDocument() {
  const docs = projects[currentProjectId].documents;
  const firstId = Object.keys(docs)[0];

  if (firstId) {
    loadDocument(firstId);
  }
}

// TAGS
function addTag(tag) {
  if (!currentDocumentId) return;

  const doc = projects[currentProjectId].documents[currentDocumentId];

  if (!doc.tags.includes(tag)) {
    doc.tags.push(tag);
  }

  renderTags(doc);
  saveToLocalStorage();
}

function removeTag(tag) {
  if (!currentDocumentId) return;

  const doc = projects[currentProjectId].documents[currentDocumentId];

  doc.tags = doc.tags.filter((t) => t !== tag);

  renderTags(doc);
  saveToLocalStorage();
}

// CHARACTER
function populateCharacterSelect() {
  characterSelect.innerHTML = "";

  const docs = projects[currentProjectId].documents;

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

function renderCharacterRelationships(doc) {
  characterList.innerHTML = "";

  if (!doc.relationships || !doc.relationships.characters) return;

  doc.relationships.characters.forEach((charId) => {
    const charDoc = projects[currentProjectId].documents[charId];

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

  if (!doc.relationships.characters.includes(charId)) {
    doc.relationships.characters.push(charId);
  }

  renderCharacterRelationships(doc);
  saveToLocalStorage();
}

function removeCharacterFromChapter(charId) {
  const doc = projects[currentProjectId].documents[currentDocumentId];

  doc.relationships.characters = doc.relationships.characters.filter(
    (id) => id !== charId,
  );

  renderCharacterRelationships(doc);
  saveToLocalStorage();
}

function getChaptersForCharacter(characterId) {
  const chapters = [];

  const docs = projects[currentProjectId].documents;

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

// HELPERS
function getItems() {
  return document.querySelectorAll("li[data-id]");
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

function setActiveItem(clickedItem) {
  getItems().forEach((item) => item.classList.remove("active"));
  clickedItem.classList.add("active");
}

// INIT
function initEventListeners() {
  getItems().forEach((item) => {
    attachItemListeners(item);
  });

  addButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const section = button.closest("details");
      addNewItem(section);
    });
  });

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

  editorTitle.addEventListener("input", saveDocument);
  editorContent.addEventListener("input", saveDocument);
}

function initApp() {
  loadFromLocalStorage();
  renderProjectList();
  renderSidebar();
}

function searchDocuments(query) {
  query = query.toLowerCase();

  const lists = document.querySelectorAll("ul");
  lists.forEach((list) => (list.innerHTML = ""));

  const docs = projects[currentProjectId].documents;

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

function handleItemClick(item) {
  const id = item.dataset.id;

  currentDocumentId = id;
  loadDocument(id);
  setActiveItem(item);
}

function handleSelectionToggle(currentSelection) {
  appState.activeSection = currentSelection;

  sections.forEach((section) => {
    if (section !== currentSelection) {
      section.removeAttribute("open");
    }
  });
}

// ======================
// EVENT LISTENERS
// ======================
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

addButtons.forEach((button) => {
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const section = button.closest("details");
  });
});

editorTitle.addEventListener("input", saveDocument);
editorContent.addEventListener("input", saveDocument);
addCharacterBtn.addEventListener("click", addCharacterToChapter);
newProjectBtn.addEventListener("click", createNewProject);

projectSelect.addEventListener("change", () => {
  currentProjectId = projectSelect.value;
  currentDocumentId = null;

  saveToLocalStorage();
  renderProjectList();
  renderSidebar();

  selectFirstDocument(); // 🔥 optional but nice
});

// ======================
// Init
// ======================
initEventListeners();
initApp();
