// Ajustes de maquina (asiento, respaldo, altura de brazos/pin, marco) y
// alternativas de ejercicio (sustituto solo para hoy o cambio definitivo
// del ejercicio de ese hueco en la rutina).

const MACHINE_FIELDS = [
  { key: "seat", label: "Asiento" },
  { key: "backrest", label: "Respaldo" },
  { key: "armHeight", label: "Altura brazos/pin" },
  { key: "frame", label: "Marco" },
];

/** Vista del ejercicio a mostrar hoy: si tiene un sustituto marcado para
 * la fecha de hoy, se fusionan sus campos por encima de los originales. */
function effectiveExercise(ex) {
  if (ex.swapToday && ex.swapToday.date === todayISO()) {
    return { ...ex, ...ex.swapToday.alt, isSwapped: true, originalName: ex.name };
  }
  return { ...ex, isSwapped: false };
}

function renderMachineSettingsBox(exercise) {
  const fields = exercise.machineFields || [];
  if (fields.length === 0) return "";
  const values = exercise.machineValues || {};
  return `
    <div class="machine-box">
      <div class="machine-box-label">Ajustes de máquina</div>
      ${fields
        .map((key) => {
          const def = MACHINE_FIELDS.find((f) => f.key === key);
          const val = values[key] || 5;
          return `
            <div class="stepper-row">
              <span class="stepper-title">${def.label}</span>
              <div class="stepper">
                <button class="stepper-btn" data-machine-action="dec" data-field="${key}">−</button>
                <span class="stepper-value" data-machine-value="${key}">${val}</span>
                <button class="stepper-btn" data-machine-action="inc" data-field="${key}">+</button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function bindMachineSettingsBox(container, exercise) {
  container.querySelectorAll("[data-machine-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const field = btn.dataset.field;
      const values = exercise.machineValues || (exercise.machineValues = {});
      let val = values[field] || 5;
      val = btn.dataset.machineAction === "inc" ? Math.min(9, val + 1) : Math.max(1, val - 1);
      values[field] = val;
      container.querySelector(`[data-machine-value="${field}"]`).textContent = val;
      await DB.put("exercises", exercise);
    });
  });
}

function openMachineConfigSheet(exercise, onSaved) {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  const active = new Set(exercise.machineFields || []);

  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-title">¿Qué ajustes tiene esta máquina?</div>
      <p class="hint">Marca los que apliquen. Se recordará el valor (1-9) que pongas cada vez que entrenes este ejercicio.</p>
      <div class="sheet-options">
        ${MACHINE_FIELDS.map(
          (f) => `
          <label class="check-row">
            <input type="checkbox" data-field="${f.key}" ${active.has(f.key) ? "checked" : ""} />
            ${f.label}
          </label>
        `
        ).join("")}
      </div>
      <button class="primary-btn" id="machine-save">Guardar</button>
      <button class="secondary-btn" id="machine-cancel">Cancelar</button>
    </div>
  `;

  overlay.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) active.add(cb.dataset.field);
      else active.delete(cb.dataset.field);
    });
  });
  overlay.querySelector("#machine-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#machine-save").addEventListener("click", async () => {
    exercise.machineFields = Array.from(active);
    exercise.machineValues = exercise.machineValues || {};
    await DB.put("exercises", exercise);
    overlay.remove();
    onSaved();
  });

  document.body.appendChild(overlay);
}

function openAlternativesSheet(exercise, onChanged) {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  const alternatives = exercise.alternatives || [];
  const today = todayISO();
  const swappedNow = exercise.swapToday && exercise.swapToday.date === today;

  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-title">Alternativas a ${escapeHtml(exercise.name)}</div>
      ${
        swappedNow
          ? `<div class="swap-banner">Hoy haces: <strong>${escapeHtml(exercise.swapToday.alt.name)}</strong></div>
             <button class="secondary-btn" id="revert-swap">Volver a ${escapeHtml(exercise.name)} hoy</button>`
          : ""
      }
      ${
        alternatives.length === 0
          ? `<p class="hint">No hay alternativas guardadas para este ejercicio todavía.</p>`
          : `<div class="sheet-options">
              ${alternatives
                .map(
                  (a, i) => `
                <div class="alt-option">
                  <div class="alt-name">${escapeHtml(a.name)}</div>
                  <div class="alt-actions">
                    <button class="secondary-btn alt-btn" data-i="${i}" data-mode="today">Hoy</button>
                    <button class="secondary-btn alt-btn" data-i="${i}" data-mode="permanent">Definitivo</button>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>`
      }
      <button class="secondary-btn" id="alt-cancel">Cerrar</button>
    </div>
  `;

  overlay.querySelector("#alt-cancel").addEventListener("click", () => overlay.remove());

  const revertBtn = overlay.querySelector("#revert-swap");
  if (revertBtn) {
    revertBtn.addEventListener("click", async () => {
      exercise.swapToday = null;
      await DB.put("exercises", exercise);
      overlay.remove();
      onChanged();
    });
  }

  overlay.querySelectorAll(".alt-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const chosen = alternatives[Number(btn.dataset.i)];
      if (btn.dataset.mode === "today") {
        exercise.swapToday = { date: today, alt: chosen };
      } else {
        if (!confirm(`¿Cambiar definitivamente este hueco de la rutina a "${chosen.name}"?`)) return;
        exercise.name = chosen.name;
        exercise.repsLow = chosen.repsLow ?? exercise.repsLow;
        exercise.repsHigh = chosen.repsHigh ?? exercise.repsHigh;
        exercise.plannedSets = chosen.plannedSets ?? exercise.plannedSets;
        exercise.defaultRestSeconds = chosen.defaultRestSeconds ?? exercise.defaultRestSeconds;
        exercise.note = chosen.note ?? exercise.note;
        exercise.swapToday = null;
        await markRoutineCustomized();
      }
      await DB.put("exercises", exercise);
      overlay.remove();
      onChanged();
    });
  });

  document.body.appendChild(overlay);
}

window.effectiveExercise = effectiveExercise;
window.renderMachineSettingsBox = renderMachineSettingsBox;
window.bindMachineSettingsBox = bindMachineSettingsBox;
window.openMachineConfigSheet = openMachineConfigSheet;
window.openAlternativesSheet = openAlternativesSheet;
