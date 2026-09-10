// Punto de entrada: siembra datos, dibuja la navegacion y registra el
// service worker. Nutricion sigue como placeholder por ahora.

// Detecta si el teclado esta abierto (el viewport visible se queda bastante
// mas bajo que la pantalla real) para esconder el menu de abajo mientras
// tanto - ver body.keyboard-open en styles.css. El alto de la app en reposo
// lo lleva 100dvh en CSS sin nada de JS, mas fiable que intentar medirlo.
function updateKeyboardState() {
  if (!window.visualViewport) return;
  const gap = window.innerHeight - window.visualViewport.height;
  document.body.classList.toggle("keyboard-open", gap > 150);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateKeyboardState);
}

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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
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
    btn.addEventListener("click", async () => {
      // Tocar un icono siempre lleva a la pantalla principal de esa pestana,
      // aunque ya estuvieras en ella dentro de un sub-detalle (una serie, un
      // dia del historial...) - es una salida rapida ademas del boton atras.
      appState.view = btn.dataset.view;
      workoutState.activeExerciseId = null;
      historyState.openDate = null;
      renderNav();
      await renderView();
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
