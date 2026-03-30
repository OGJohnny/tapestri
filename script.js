let currentDocumentId = null;

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

// ======================
// ELEMENTS (DOM)
// ======================
const sections = document.querySelectorAll("details");
const addButtons = document.querySelectorAll(".add-btn");
const items = document.querySelectorAll("li");
const editorTitle = document.getElementById("editor-title");
const editorContent = document.getElementById("editor-content");

// ======================
// FUNCTIONS
// ======================
function handleSelectionToggle(currentSelection) {
  appState.activeSection = currentSelection;

  sections.forEach((section) => {
    if (section !== currentSelection) {
      section.removeAttribute("open");
    }
  });
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

function handleItemClick(item) {
  const id = item.dataset.id;

  currentDocumentId = id;
  loadDocument(id);
  setActiveItem(item);
}

function loadDocument(id) {
  const doc = documents[id];

  if (!doc) return;

  editorTitle.value = doc.title;
  editorContent.value = doc.content;
}

function setActiveItem(clickedItem) {
  items.forEach((item) => item.classList.remove("active"));
  clickedItem.classList.add("active");
}

function initApp() {
  if (items.length > 0) {
    handleItemClick(items[0]);
  }
}

function saveDocument() {
  if (!currentDocumentId) return;

  documents[currentDocumentId].title = editorTitle.value;
  documents[currentDocumentId].content = editorContent.value;
}

// ======================
// EVENT LISTENERS
// ======================
initEventListeners();

items.forEach((item) => {
  item.addEventListener("click", () => {
    handleItemClick(item);
  });
});

editorTitle.addEventListener("input", saveDocument);
editorContent.addEventListener("input", saveDocument);

initApp();
