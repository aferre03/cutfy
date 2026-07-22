// Temporizador de descanso a pantalla completa. Se abre automaticamente al
// guardar una serie y llama a `onDone` cuando el usuario decide continuar.

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

function showRestTimer(initialSeconds, comparison, onDone) {
  let remaining = initialSeconds;
  let finished = false;

  const overlay = document.createElement("div");
  overlay.className = "rest-overlay";
  document.body.appendChild(overlay);

  function paint() {
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
        remaining = Math.max(0, remaining - 15);
        paint();
      });
      overlay.querySelector("#rest-plus").addEventListener("click", () => {
        remaining += 15;
        paint();
      });
    }

    overlay.querySelector("#rest-continue").addEventListener("click", close);
  }

  function close() {
    clearInterval(interval);
    overlay.remove();
    onDone();
  }

  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0 && !finished) {
      finished = true;
      playBeep();
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }
    paint();
  }, 1000);

  paint();
}

window.showRestTimer = showRestTimer;
