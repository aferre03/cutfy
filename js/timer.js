// Temporizador de descanso a pantalla completa. Se abre automaticamente al
// guardar una serie y llama a `onDone` cuando el usuario decide continuar.
//
// La cuenta atras se basa en una hora de fin absoluta (Date.now() + segundos),
// no en un contador que se va restando - asi, si el navegador pausa el
// intervalo (movil bloqueado, app en segundo plano), al volver se recalcula
// el tiempo real que queda en vez de arrastrar el desfase. Ademas pide
// mantener la pantalla encendida mientras dura el descanso (Wake Lock) y, si
// hay permiso, lanza una notificacion del sistema al terminar por si el
// movil se ha bloqueado de todas formas.

const COMPARE_LABEL = {
  up: "⬆️ Subiste",
  equal: "➡️ Igualaste",
  down: "⬇️ Bajaste",
};

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22, 0.44].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch (e) {
    // Web Audio no disponible en este navegador; el aviso visual basta.
  }
}

function formatSeconds(total) {
  const safe = Math.max(0, total);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function requestScreenWakeLock() {
  if (!("wakeLock" in navigator)) return null;
  try {
    return await navigator.wakeLock.request("screen");
  } catch (e) {
    return null; // p.ej. pestana no visible en ese instante; no es grave
  }
}

function notifyRestDone() {
  if (!window.Notification || Notification.permission !== "granted") return;
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.ready
    .then((reg) =>
      reg.showNotification("¡Descanso terminado! 💪", {
        body: "Toca para volver a Cutfy",
        icon: "icons/icon-192.png",
        tag: "cutfy-rest-done",
      })
    )
    .catch(() => {});
}

function showRestTimer(initialSeconds, comparison, onDone) {
  // Por si un doble tap en "Guardar serie" ya habia disparado un temporizador:
  // sin esto, el overlay viejo se queda apilado encima de todo (y su interval
  // sigue corriendo de fondo), bloqueando cualquier toque aunque no se vea
  // (el bug de "las pestañas no reaccionan").
  document.querySelectorAll(".rest-overlay").forEach((el) => {
    clearInterval(el._restInterval);
    el.remove();
  });

  // Pide permiso de notificaciones la primera vez que hace falta (si el
  // navegador lo soporta) para poder avisar aunque el movil se bloquee.
  if (window.Notification && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  let endTime = Date.now() + initialSeconds * 1000;
  let finished = false;
  let wakeLock = null;

  const overlay = document.createElement("div");
  overlay.className = "rest-overlay";
  document.body.appendChild(overlay);

  requestScreenWakeLock().then((lock) => {
    wakeLock = lock;
  });

  // El Wake Lock se libera solo si la pestana deja de estar visible; al
  // volver a estarlo (se desbloquea el movil) se vuelve a pedir.
  function onVisibilityChange() {
    if (document.visibilityState === "visible" && !wakeLock && !finished) {
      requestScreenWakeLock().then((lock) => {
        wakeLock = lock;
      });
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  function remainingSeconds() {
    return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  }

  function paint() {
    const remaining = remainingSeconds();
    overlay.innerHTML = `
      ${
        comparison
          ? `<div class="compare-chip compare-${comparison}">${COMPARE_LABEL[comparison]}</div>`
          : ""
      }
      <div class="rest-label">${finished ? "¡Descanso terminado!" : "Descanso"}</div>
      <div class="rest-countdown ${finished ? "done" : ""}">${finished ? "✅" : formatSeconds(remaining)}</div>
      ${
        finished
          ? ""
          : `<div class="rest-adjust">
               <button class="secondary-btn" id="rest-minus">−15s</button>
               <button class="secondary-btn" id="rest-plus">+15s</button>
             </div>`
      }
      <button class="primary-btn" id="rest-continue">${finished ? "Continuar" : "Saltar descanso"}</button>
    `;

    if (!finished) {
      overlay.querySelector("#rest-minus").addEventListener("click", () => {
        endTime = Math.max(Date.now(), endTime - 15000);
        paint();
      });
      overlay.querySelector("#rest-plus").addEventListener("click", () => {
        endTime += 15000;
        paint();
      });
    }

    overlay.querySelector("#rest-continue").addEventListener("click", close);
  }

  function close() {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (wakeLock) wakeLock.release().catch(() => {});
    overlay.remove();
    onDone();
  }

  const interval = setInterval(() => {
    if (remainingSeconds() <= 0 && !finished) {
      finished = true;
      playBeep();
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      notifyRestDone();
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    }
    paint();
  }, 1000);
  overlay._restInterval = interval;

  paint();
}

window.showRestTimer = showRestTimer;
