// Pantalla de ajustes: gestion de dias y editor de ejercicios. Cada persona
// que instale la app puede crear sus propios dias y ejercicios para llevar
// su propia rutina, no la de fabrica.

const settingsState = { selectedDayId: null };

function formatRest(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function renderSettingsView(container) {
  const settings = await DB.get("settings", "main");
  const dayId = settingsState.selectedDayId && getDayIds().includes(settingsState.selectedDayId)
    ? settingsState.selectedDayId
    : getDayIds()[0];
  settingsState.selectedDayId = dayId;
  const exercises = await getDayExercises(dayId);

  const rows = exercises
    .map(
      (ex) => `
      <li class="exercise-row" data-exercise-id="${ex.id}">
        <div class="exercise-row-main">
          <div class="exercise-name">${escapeHtml(ex.name)}</div>
          <div class="exercise-meta">${ex.plannedSets}×${ex.repsLow}-${ex.repsHigh} · descanso ${formatRest(
        ex.defaultRestSeconds
      )}${ex.note ? " · " + escapeHtml(ex.note) : ""}</div>
        </div>
        <div class="exercise-row-actions">
          <button class="row-icon-btn" data-edit-id="${ex.id}" title="Editar">✏️</button>
          <button class="row-icon-btn" data-delete-id="${ex.id}" title="Borrar">🗑️</button>
        </div>
      </li>
    `
    )
    .join("");

  container.innerHTML = `
    <div class="theme-section">
      <h2 class="section-title">🎨 Color de la app</h2>
      <div class="theme-swatches">
        ${ACCENT_PRESETS.map(
          (color) => `
          <button class="theme-swatch ${settings.accentColor === color ? "active" : ""}" data-color="${color}" style="background:${color}" title="${color}"></button>
        `
        ).join("")}
      </div>
      <div class="theme-custom-row">
        <input type="color" id="theme-custom-picker" value="${settings.accentColor || "#d11507"}" title="Color personalizado" />
        <button class="secondary-btn" id="theme-reset-btn">Restablecer</button>
      </div>
    </div>

    <h2 class="section-title">Días y ejercicios</h2>
    <div class="day-tabs-row">
      <div class="day-tabs">
        ${getDayIds()
          .map(
            (id) => `<button class="day-tab ${id === dayId ? "active" : ""}" data-day-id="${id}">${dayLabel(id)}</button>`
          )
          .join("")}
      </div>
      <button class="row-icon-btn" id="manage-days-btn" title="Gestionar días">📅</button>
    </div>
    <ul class="exercise-list">${rows || `<p class="hint">Sin ejercicios en ${dayLabel(dayId)} todavía.</p>`}</ul>
    <button class="primary-btn" id="add-exercise-btn">+ Añadir ejercicio a ${dayLabel(dayId)}</button>
  `;

  async function setAccentColor(color) {
    applyAccentColor(color);
    settings.accentColor = color;
    await DB.put("settings", settings);
    renderSettingsView(container);
  }

  container.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.addEventListener("click", () => setAccentColor(btn.dataset.color));
  });
  document.getElementById("theme-custom-picker").addEventListener("change", (e) => setAccentColor(e.target.value));
  document.getElementById("theme-reset-btn").addEventListener("click", () => setAccentColor(null));

  document.getElementById("manage-days-btn").addEventListener("click", () => {
    openManageDaysSheet(() => renderSettingsView(container));
  });

  container.querySelectorAll(".day-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      settingsState.selectedDayId = btn.dataset.dayId;
      renderSettingsView(container);
    });
  });

  container.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ex = exercises.find((e) => e.id === Number(btn.dataset.editId));
      openExerciseEditSheet(ex, dayId, () => renderSettingsView(container));
    });
  });

  container.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ex = exercises.find((e) => e.id === Number(btn.dataset.deleteId));
      if (!confirm(`¿Borrar "${ex.name}"? Las series ya registradas se quedan en el historial.`)) return;
      await DB.delete("exercises", ex.id);
      await markRoutineCustomized();
      renderSettingsView(container);
    });
  });

  document.getElementById("add-exercise-btn").addEventListener("click", () => {
    openExerciseEditSheet(null, dayId, () => renderSettingsView(container));
  });
}

function openExerciseEditSheet(exercise, dayId, onSaved) {
  const isNew = !exercise;
  const overlay = openSheetOverlay(`
    <div class="sheet">
      <div class="sheet-title">${isNew ? "Nuevo ejercicio" : "Editar ejercicio"}</div>

      <label class="field-label" for="f-name">Nombre</label>
      <input type="text" id="f-name" class="note-input" maxlength="60" value="${
        exercise ? escapeHtml(exercise.name) : ""
      }" />

      <div class="field-row">
        <div>
          <label class="field-label" for="f-sets">Series</label>
          <input type="number" inputmode="numeric" pattern="[0-9]*" id="f-sets" class="note-input" min="1" max="10" value="${exercise?.plannedSets ?? 3}" />
        </div>
        <div>
          <label class="field-label" for="f-reps-low">Reps min</label>
          <input type="number" inputmode="numeric" pattern="[0-9]*" id="f-reps-low" class="note-input" min="1" max="50" value="${
            exercise?.repsLow ?? 8
          }" />
        </div>
        <div>
          <label class="field-label" for="f-reps-high">Reps max</label>
          <input type="number" inputmode="numeric" pattern="[0-9]*" id="f-reps-high" class="note-input" min="1" max="50" value="${
            exercise?.repsHigh ?? 12
          }" />
        </div>
      </div>

      <label class="field-label" for="f-rest">Descanso (segundos)</label>
      <input type="number" inputmode="numeric" pattern="[0-9]*" id="f-rest" class="note-input" min="15" max="600" step="15" value="${
        exercise?.defaultRestSeconds ?? 90
      }" />

      <label class="field-label" for="f-note">Nota (opcional)</label>
      <input type="text" id="f-note" class="note-input" maxlength="60" value="${
        exercise?.note ? escapeHtml(exercise.note) : ""
      }" />

      <button class="primary-btn" id="edit-save">Guardar</button>
      ${!isNew ? `<button class="secondary-btn" id="edit-delete">Borrar ejercicio</button>` : ""}
      <button class="secondary-btn" id="edit-cancel">Cancelar</button>
    </div>
  `);

  overlay.querySelector("#edit-cancel").addEventListener("click", () => overlay.remove());

  if (!isNew) {
    overlay.querySelector("#edit-delete").addEventListener("click", async () => {
      if (!confirm(`¿Borrar "${exercise.name}"? Las series ya registradas se quedan en el historial.`)) return;
      await DB.delete("exercises", exercise.id);
      await markRoutineCustomized();
      overlay.remove();
      onSaved();
    });
  }

  overlay.querySelector("#edit-save").addEventListener("click", async () => {
    const name = overlay.querySelector("#f-name").value.trim();
    if (!name) return;
    const plannedSets = Math.max(1, Number(overlay.querySelector("#f-sets").value) || 1);
    const repsLow = Math.max(1, Number(overlay.querySelector("#f-reps-low").value) || 1);
    const repsHigh = Math.max(repsLow, Number(overlay.querySelector("#f-reps-high").value) || repsLow);
    const defaultRestSeconds = Math.max(0, Number(overlay.querySelector("#f-rest").value) || 90);
    const note = overlay.querySelector("#f-note").value.trim();

    if (isNew) {
      const siblings = await getDayExercises(dayId);
      const order = siblings.length ? Math.max(...siblings.map((e) => e.order)) + 1 : 0;
      await DB.add("exercises", {
        dayId,
        order,
        name,
        repsLow,
        repsHigh,
        plannedSets,
        defaultRestSeconds,
        note,
        machineFields: [],
        machineValues: {},
        swapToday: null,
        alternatives: [],
      });
    } else {
      exercise.name = name;
      exercise.repsLow = repsLow;
      exercise.repsHigh = repsHigh;
      exercise.plannedSets = plannedSets;
      exercise.defaultRestSeconds = defaultRestSeconds;
      exercise.note = note;
      await DB.put("exercises", exercise);
    }
    await markRoutineCustomized();
    overlay.remove();
    onSaved();
  });
}

window.renderSettingsView = renderSettingsView;
