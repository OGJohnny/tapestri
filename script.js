// ======================
// DATA (APP STATE)
// ======================
let documents = {};
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

const sections = document.querySelectorAll("details");
const addButtons = document.querySelectorAll(".add-btn");
const searchInput = document.getElementById("search-input");

// ======================
// FUNCTIONS
// ======================

// DATA
function saveToLocalStorage() {
  localStorage.setItem("tapestriDocuments", JSON.stringify(documents));
}

function loadFromLocalStorage() {
  const data = localStorage.getItem("tapestriDocuments");

  if (data) {
    documents = JSON.parse(data);

    for (const id in documents) {
      if (!documents[id].tags) {
        documents[id].tags = [];
      }
    }
  } else {
    documents = {
      chapter1: {
        id: "chapter1",
        title: "Chapter 1",
        content: "",
        type: "chapter",
        tags: [],
      },
    };

    saveToLocalStorage();
  }
}

// RENDER
function renderSidebar() {
  const lists = document.querySelectorAll("ul");

  lists.forEach((list) => {
    list.innerHTML = "";
  });

  for (const id in documents) {
    const doc = documents[id];

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
  const doc = documents[id];

  if (!doc) return;

  currentDocumentId = id;

  editorTitle.value = doc.title;
  editorContent.value = doc.content;

  renderTags(doc);
}

function saveDocument() {
  if (!currentDocumentId) return;

  documents[currentDocumentId].title = editorTitle.value;
  documents[currentDocumentId].content = editorContent.value;

  saveToLocalStorage();
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

  documents[id] = {
    id: id,
    title: newLi.textContent,
    content: "",
    type: type,
    tags: [],
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
  documents[id].title = newName;

  if (currentDocumentId === id) {
    editorTitle.value = newName;
  }

  saveToLocalStorage();
}

function deleteItem(item) {
  const confirmDelete = confirm("Delete this item?");

  if (!confirmDelete) return;

  const id = item.dataset.id;

  delete documents[id];

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

// TAGS
function addTag(tag) {
  if (!currentDocumentId) return;

  const doc = documents[currentDocumentId];

  if (!doc.tags.includes(tag)) {
    doc.tags.push(tag);
  }

  renderTags(doc);
  saveToLocalStorage();
}

function removeTag(tag) {
  if (!currentDocumentId) return;

  const doc = documents[currentDocumentId];

  doc.tags = doc.tags.filter((t) => t !== tag);

  renderTags(doc);
  saveToLocalStorage();
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
  renderSidebar();

  if (getItems().length > 0) {
    handleItemClick(getItems()[0]);
  }
}

function searchDocuments(query) {
  query = query.toLowerCase();

  const lists = document.querySelectorAll("ul");
  lists.forEach((list) => (list.innerHTML = ""));

  for (const id in documents) {
    const doc = documents[id];

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

// ======================
// Init
// ======================
initEventListeners();
initApp();
