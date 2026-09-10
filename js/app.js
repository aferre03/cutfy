// Punto de entrada: siembra datos, dibuja la navegacion y registra el
// service worker. Nutricion sigue como placeholder por ahora.

// iOS (sobre todo en apps instaladas, con formularios) a veces no recalcula
// bien 100dvh cuando aparece/desaparece el teclado, dejando huecos negros
// donde estaba el teclado. Medir el viewport real con JS y mantenerlo al
// dia es el arreglo fiable - ver --app-height en styles.css.
function updateAppHeight() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}
updateAppHeight();
window.addEventListener("resize", updateAppHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateAppHeight);
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
