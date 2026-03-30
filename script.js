// ======================
// DATA (APP STATE)
// ======================
const appState = {
  activeSection: null,
  activeItemId: null,
};

const documents = {
  "chapter-1": {
    title: "Chapter 1",
    content: "This is the beginning of your story...",
  },
  hero: {
    title: "Hero",
    content: "Brave, flawed, and determined.",
  },
  "magic-system": {
    title: "Magic System",
    content: "Magic is fueled by memory and emotion.",
  },
};

let currentDocumentId = null;

// ======================
// ELEMENTS (DOM)
// ======================
const editorTitle = document.getElementById("editor-title");
const editorContent = document.getElementById("editor-content");

const items = document.querySelectorAll("li");
const sections = document.querySelectorAll("details");
const addButtons = document.querySelectorAll(".add-btn");

// ======================
// FUNCTIONS
// ======================
function loadDocument(id) {
  const doc = documents[id];

  if (!doc) return;

  editorTitle.value = doc.title;
  editorContent.value = doc.content;
}

function saveDocument() {
  if (!currentDocumentId) return;

  documents[currentDocumentId].title = editorTitle.value;
  documents[currentDocumentId].content = editorContent.value;
}

function setActiveItem(clickedItem) {
  items.forEach((item) => item.classList.remove("active"));
  clickedItem.classList.add("active");
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

function addNewItem(section) {
  const ul = section.querySelector("ul");
  const type = ul.querySelector("li").dataset.type;

  const newId = type + "-" + Date.now();

  documents[newId] = {
    title: "New " + type,
    content: "",
  };

  const newLi = document.createElement("li");
  newLi.textContent = "New " + type;
  newLi.dataset.id = newId;
  newLi.dataset.type = type;

  ul.appendChild(newLi);

  newLi.addEventListener("click", () => {
    handleItemClick(newLi);
  });

  handleItemClick(newLi);
}

function initApp() {
  if (items.length > 0) {
    handleItemClick(items[0]);
  }
}

function initEventListeners() {
  sections.forEach((section) => {
    section.addEventListener("toggle", () => {
      if (section.open) {
        handleSelectionToggle(section);
      }
    });
  });
}

// ======================
// EVENT LISTENERS
// ======================
items.forEach((item) => {
  item.addEventListener("click", () => {
    handleItemClick(item);
  });
});

addButtons.forEach((button) => {
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const section = button.closest("details");
    addNewItem(section);
  });
});

editorTitle.addEventListener("input", saveDocument);
editorContent.addEventListener("input", saveDocument);

// ======================
// Init
// ======================
initEventListeners();
initApp();
