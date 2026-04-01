// ======================
// DATA (APP STATE)
// ======================
let documents = {
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

const appState = {
  activeSection: null,
  activeItemId: null,
};

let currentDocumentId = null;

// ======================
// ELEMENTS (DOM)
// ======================
const editorTitle = document.getElementById("editor-title");
const editorContent = document.getElementById("editor-content");
const searchInput = document.getElementById("search-input");

const sections = document.querySelectorAll("details");
const addButtons = document.querySelectorAll(".add-btn");

// ======================
// FUNCTIONS
// ======================
function saveToLocalStorage() {
  localStorage.setItem("tapestriDocuments", JSON.stringify(documents));
}

function loadFromLocalStorage() {
  const data = localStorage.getItem("tapestriDocuments");

  if (data) {
    documents = JSON.parse(data);
  } else {
    documents = {
      chapter1: {
        id: "chapter1",
        title: "Chapter 1",
        content: "",
        type: "chapter",
      },
      character1: {
        id: "character1",
        title: "Character 1",
        content: "",
        type: "character",
      },
      world1: { id: "world1", title: "World 1", content: "", type: "world" },
      timeline1: {
        id: "timeline1",
        title: "Event 1",
        content: "",
        type: "timeline",
      },
      note1: { id: "note1", title: "Note 1", content: "", type: "notes" },
    };

    saveToLocalStorage();
  }
}

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

  saveToLocalStorage();
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

function getItems() {
  return document.querySelectorAll("li[data-id]");
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

function handleSelectionToggle(currentSelection) {
  appState.activeSection = currentSelection;

  sections.forEach((section) => {
    if (section !== currentSelection) {
      section.removeAttribute("open");
    }
  });
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

function initApp() {
  loadFromLocalStorage();
  renderSidebar();

  if (getItems().length > 0) {
    handleItemClick(getItems()[0]);
  }
}

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

  editorTitle.addEventListener("input", saveDocument);
  editorContent.addEventListener("input", saveDocument);
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
