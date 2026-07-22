// Punto de entrada: siembra datos, dibuja la navegacion y registra el
// service worker. Las pestanas distintas de "Entreno" son un placeholder
// por ahora (fase 2: historial, nutricion, peso, ajustes).

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
      appState.view = btn.dataset.view;
      if (appState.view !== "workout") workoutState.activeExerciseId = null;
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
  container.innerHTML = renderComingSoon(appState.view);
}

function renderComingSoon(view) {
  const titles = {
    history: "Historial y progresión",
    nutrition: "Nutrición",
    weight: "Peso corporal",
    settings: "Ajustes",
  };
  return `
    <div class="coming-soon">
      <h2>${titles[view]}</h2>
      <p class="hint">Próximamente. Esta primera versión se centra en el registro de series durante el entreno.</p>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", init);
