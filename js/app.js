// Punto de entrada: siembra datos, dibuja la navegacion y registra el
// service worker. Nutricion sigue como placeholder por ahora.

// Esconde el menu de abajo mientras se escribe (ver body.keyboard-open en
// styles.css). Detectarlo por geometria del viewport (visualViewport) no es
// fiable en modo standalone en iOS - con foco/desenfoque de los campos es
// directo y no depende de como cada iOS mida el teclado.
//
// Solo cuenta como "abre teclado" el texto/numero real. type="color" o
// type="date" abren un selector nativo, no el teclado, y su foco/desenfoque
// no siempre dispara con fiabilidad - si se tratan igual, el menu se puede
// quedar escondido para siempre despues de tocar el selector de color (el
// bug de "no me deja volver a otro menu").
function opensKeyboard(el) {
  if (!el || !el.matches) return false;
  if (el.matches("textarea")) return true;
  if (!el.matches("input")) return false;
  const type = (el.type || "text").toLowerCase();
  return ["text", "number", "email", "tel", "url", "password", "search"].includes(type);
}
document.addEventListener("focusin", (e) => {
  if (opensKeyboard(e.target)) {
    document.body.classList.add("keyboard-open");
  }
});
document.addEventListener("focusout", (e) => {
  if (opensKeyboard(e.target)) {
    document.body.classList.remove("keyboard-open");
  }
});
// Red de seguridad: si por lo que sea la clase se queda pegada sin que haya
// realmente un campo de teclado con el foco, se autocorrige en el primer
// toque a cualquier sitio.
document.addEventListener("click", () => {
  if (!opensKeyboard(document.activeElement)) {
    document.body.classList.remove("keyboard-open");
  }
});

const TABS = [
  { id: "workout", label: "Entreno", icon: "🏋️" },
  { id: "history", label: "Historial", icon: "📈" },
  { id: "nutrition", label: "Nutrición", icon: "🍽️" },
  { id: "weight", label: "Peso", icon: "⚖️" },
  { id: "settings", label: "Ajustes", icon: "⚙️" },
];

const appState = { view: "workout" };

async function init() {
  await ensureSeeded();
  await initTheme();
  await loadDays();
  initBackNavigation();
  renderNav();
  await renderView();

  document.getElementById("burger-btn").addEventListener("click", openBurgerMenu);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

/** Cambia a otra pestana desde cualquier sitio (menu de abajo o menu
 * hamburguesa) - siempre lleva a la pantalla principal de esa pestana,
 * aunque se estuviera dentro de un sub-detalle (una serie, un dia del
 * historial...). */
async function switchToView(viewId) {
  appState.view = viewId;
  workoutState.activeExerciseId = null;
  historyState.openDate = null;
  updateNavVisibility();
  renderNav();
  await renderView();
}

function renderNav() {
  const nav = document.getElementById("bottom-nav");
  nav.innerHTML = TABS.map(
    (tab) => `
    <button class="nav-btn ${tab.id === appState.view ? "active" : ""}" data-view="${tab.id}">
      <span class="nav-icon">${tab.icon}</span>
      <span class="nav-label">${tab.label}</span>
    </button>
  `
  ).join("");

  nav.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchToView(btn.dataset.view));
  });
}

/** Menu hamburguesa: alternativa al menu de abajo para saltar a otra
 * pestana desde cualquier sitio, incluido dentro de un sub-detalle (donde
 * el menu de abajo se esconde a proposito para evitar toques accidentales -
 * ver body.subview-active en styles.css). */
function openBurgerMenu() {
  const overlay = openSheetOverlay(`
    <div class="sheet">
      <div class="sheet-title">Menú</div>
      <div class="sheet-options">
        ${TABS.map(
          (tab) => `
          <button class="secondary-btn burger-item ${tab.id === appState.view ? "active" : ""}" data-view="${tab.id}">
            ${tab.icon} ${tab.label}
          </button>
        `
        ).join("")}
      </div>
      <button class="secondary-btn" id="burger-cancel">Cerrar</button>
    </div>
  `);

  overlay.querySelector("#burger-cancel").addEventListener("click", () => overlay.remove());

  overlay.querySelectorAll(".burger-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      overlay.remove();
      await switchToView(btn.dataset.view);
    });
  });
}

async function renderView() {
  const container = document.getElementById("view-container");
  if (appState.view === "workout") {
    await renderWorkoutView(container);
    return;
  }
  if (appState.view === "history") {
    await renderHistoryView(container);
    return;
  }
  if (appState.view === "settings") {
    await renderSettingsView(container);
    return;
  }
  if (appState.view === "weight") {
    await renderWeightView(container);
    return;
  }
  container.innerHTML = renderComingSoon(appState.view);
}

function renderComingSoon(view) {
  const titles = {
    nutrition: "Nutrición",
  };
  return `
    <div class="coming-soon">
      <h2>${titles[view]}</h2>
      <p class="hint">Próximamente. Esta primera versión se centra en el registro de series durante el entreno.</p>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", init);
