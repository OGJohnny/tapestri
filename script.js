const sections = document.querySelectorAll("details");

sections.forEach((section) => {
  section.addEventListener("toggle", () => {
    if (section.open) {
      sections.forEach((other) => {
        if (other !== section) {
          other.removeAttribute("open");
        }
      });
    }
  });
});

sections.forEach((other) => {
  other.classList.remove("active-section");
});

section.classList.add("active-section");
