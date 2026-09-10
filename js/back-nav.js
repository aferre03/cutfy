// Intercepta el boton/gesto "atras" de Android para que, si hay una hoja
// abierta o estas dentro de un sub-detalle (una serie, un dia del
// historial...), vuelva ahi en vez de cerrar la app entera. En iOS esto no
// hace nada (una app instalada desde Safari no tiene gesto de atras del
// sistema), asi que es inofensivo alli.
//
// Funciona empujando una entrada al historial del navegador cada vez que se
// entra en una hoja o sub-detalle (armBackTrap, llamado desde openSheetOverlay
// y desde donde se entra a un sub-detalle). El gesto de atras consume esa
// entrada sin salir de la app; si no hay nada que cerrar, se deja que el
// gesto siga su curso normal (salir/minimizar la app).

function armBackTrap() {
  history.pushState({ cutfyBack: true }, "");
}

function closeTopSheet() {
  const sheets = document.querySelectorAll(".sheet-overlay");
  const last = sheets[sheets.length - 1];
  if (last) last.remove();
}

function isInSubView() {
  return Boolean(workoutState.activeExerciseId) || Boolean(historyState.openDate);
}

function exitSubView() {
  const container = document.getElementById("view-container");
  if (workoutState.activeExerciseId) {
    workoutState.activeExerciseId = null;
    if (appState.view === "workout") renderWorkoutView(container);
  } else if (historyState.openDate) {
    historyState.openDate = null;
    if (appState.view === "history") renderHistoryView(container);
  }
}

function initBackNavigation() {
  window.addEventListener("popstate", () => {
    if (document.querySelector(".sheet-overlay")) {
      closeTopSheet();
      return;
    }
    if (isInSubView()) {
      exitSubView();
    }
  });
}

window.armBackTrap = armBackTrap;
window.initBackNavigation = initBackNavigation;
