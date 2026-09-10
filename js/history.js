// Pantalla de historial: tarjetas por dia (rutina + fecha + % completado)
// que al pulsarlas abren el detalle de que se hizo en cada ejercicio. Los
// dias cerrados con "Hemos terminado" llevan una insignia. Tambien permite
// borrar un dia entero o anadir uno retroactivo (p.ej. si se entreno sin
// el movil a mano).

const historyState = { openDate: null };

function percentClass(percent) {
  if (percent >= 100) return "pct-up";
  if (percent >= 50) return "pct-equal";
  return "pct-down";
}

/** Resumen de un dia: ejercicios planificados en ese dia (segun la rutina
 * actual), series hechas por ejercicio y % completado = series hechas
 * (topadas al objetivo) entre series planificadas. */
function summarizeDay(date, daySets, exercises, sessionByDate) {
  const session = sessionByDate.get(date);
  const byExercise = new Map();
  for (const s of daySets) {
    if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
    byExercise.get(s.exerciseId).push(s);
  }

  const dayId = session?.dayId ?? exercises.find((e) => e.id === daySets[0].exerciseId)?.dayId;
  const planExercises = exercises.filter((e) => e.dayId === dayId).sort((a, b) => a.order - b.order);

  let totalPlanned = 0;
  let totalDoneCapped = 0;
  for (const ex of planExercises) {
    const done = (byExercise.get(ex.id) || []).length;
    totalPlanned += ex.plannedSets;
    totalDoneCapped += Math.min(done, ex.plannedSets);
  }
  const percent = totalPlanned > 0 ? Math.round((totalDoneCapped / totalPlanned) * 100) : 0;

  return { dayId, session, percent, planExercises, byExercise };
}

async function deleteDay(date) {
  const [allSets, allSessions] = await Promise.all([DB.getAll("sets"), DB.getAll("sessions")]);
  for (const s of allSets.filter((s) => s.date === date)) await DB.delete("sets", s.id);
  for (const sess of allSessions.filter((s) => s.date === date)) await DB.delete("sessions", sess.id);
}

async function renderHistoryView(container) {
  const [sets, exercises, sessions] = await Promise.all([
    DB.getAll("sets"),
    DB.getAll("exercises"),
    DB.getAll("sessions"),
  ]);

  const sessionByDate = new Map(sessions.map((s) => [s.date, s]));
  const byDate = new Map();
  for (const s of sets) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  if (historyState.openDate && byDate.has(historyState.openDate)) {
    const date = historyState.openDate;
    const summary = summarizeDay(date, byDate.get(date), exercises, sessionByDate);
    renderHistoryDetail(container, date, summary);
    return;
  }

  const cards = dates
    .map((date) => {
      const { dayId, session, percent } = summarizeDay(date, byDate.get(date), exercises, sessionByDate);
      return `
        <div class="history-day" data-date="${date}">
          <div class="history-day-main">
            <div class="history-day-label">${dayLabel(dayId)}${
        session ? ' <span class="history-done-badge">✅</span>' : ""
      }</div>
            <div class="history-day-date">${formatDateLabel(date)}</div>
          </div>
          <div class="history-day-actions">
            <div class="history-day-percent ${percentClass(percent)}">${percent}%</div>
            <button class="row-icon-btn" data-delete-date="${date}" title="Borrar día">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="history-view">
      <h2 class="section-title">Historial</h2>
      <button class="secondary-btn" id="add-day-btn">+ Añadir día</button>
      ${
        dates.length === 0
          ? `<p class="hint">Aún no hay entrenos registrados. En cuanto guardes tu primera serie aparecerá aquí.</p>`
          : cards
      }
    </div>
  `;

  document.getElementById("add-day-btn").addEventListener("click", () => {
    openAddDaySheet(container);
  });

  container.querySelectorAll(".history-day[data-date]").forEach((card) => {
    card.addEventListener("click", () => {
      historyState.openDate = card.dataset.date;
      armBackTrap();
      renderHistoryView(container);
    });
  });

  container.querySelectorAll("[data-delete-date]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const date = btn.dataset.deleteDate;
      if (!confirm(`¿Borrar el entreno del ${formatDateLabel(date)}? No se puede deshacer.`)) return;
      await deleteDay(date);
      renderHistoryView(container);
    });
  });
}

function renderHistoryDetail(container, date, summary) {
  const { dayId, session, percent, planExercises, byExercise } = summary;
  const planIds = new Set(planExercises.map((e) => e.id));

  const plannedRows = planExercises
    .map((ex) => {
      const exSets = (byExercise.get(ex.id) || []).slice().sort((a, b) => a.setNumber - b.setNumber);
      const setsText = exSets.length ? exSets.map((s) => formatSegments(s.segments)).join(" · ") : "No hecho";
      return `
        <div class="history-exercise">
          <div class="history-exercise-name">${escapeHtml(ex.name)}</div>
          <div class="history-exercise-sets">${setsText}</div>
        </div>
      `;
    })
    .join("");

  const orphanRows = Array.from(byExercise.entries())
    .filter(([exId]) => !planIds.has(exId))
    .map(([, exSets]) => {
      exSets.sort((a, b) => a.setNumber - b.setNumber);
      const setsText = exSets.map((s) => formatSegments(s.segments)).join(" · ");
      return `
        <div class="history-exercise">
          <div class="history-exercise-name">Ejercicio eliminado</div>
          <div class="history-exercise-sets">${setsText}</div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="history-view">
      <button class="back-btn" id="history-back">← Historial</button>
      <h2 class="exercise-title">${dayLabel(dayId)}</h2>
      <div class="exercise-meta">
        ${formatDateLabel(date)} · <span class="${percentClass(percent)}">${percent}% completado</span>${
    session ? " · ✅ cerrado" : ""
  }
      </div>
      ${plannedRows}
      ${orphanRows}
      <button class="secondary-btn" id="history-delete-day">🗑️ Borrar este día</button>
    </div>
  `;

  document.getElementById("history-back").addEventListener("click", () => {
    historyState.openDate = null;
    renderHistoryView(container);
  });

  document.getElementById("history-delete-day").addEventListener("click", async () => {
    if (!confirm(`¿Borrar el entreno del ${formatDateLabel(date)}? No se puede deshacer.`)) return;
    await deleteDay(date);
    historyState.openDate = null;
    renderHistoryView(container);
  });
}

/** Hoja para meter un dia retroactivo (p.ej. entrenaste sin el movil a
 * mano): fecha + dia + cuantas series hiciste de cada ejercicio de ese dia.
 * No pide peso/reps exactos por serie, solo el recuento - queda marcado en
 * el historial y cuenta para el % completado igual que un dia normal. */
async function openAddDaySheet(container) {
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let selectedDay = getDayIds()[0];
  let dayExercises = await getDayExercises(selectedDay);
  const counts = {};

  function ensureCounts() {
    for (const ex of dayExercises) {
      if (!(ex.id in counts)) counts[ex.id] = ex.plannedSets;
    }
  }
  ensureCounts();

  const overlay = openSheetOverlay(`<div class="sheet" id="add-day-sheet"></div>`);
  const sheetEl = overlay.querySelector("#add-day-sheet");

  function paint() {
    sheetEl.innerHTML = `
      <div class="sheet-title">Añadir día al historial</div>
      <label class="field-label" for="add-day-date">Fecha</label>
      <input type="date" id="add-day-date" class="note-input" max="${today}" value="${yesterday}" />

      <label class="field-label">Día</label>
      <div class="day-tabs">
        ${getDayIds()
          .map(
            (id) => `<button class="day-tab ${id === selectedDay ? "active" : ""}" data-day-id="${id}">${dayLabel(id)}</button>`
          )
          .join("")}
      </div>

      <div class="sheet-options">
        ${dayExercises
          .map(
            (ex) => `
          <div class="alt-option">
            <div class="alt-name">${escapeHtml(ex.name)}</div>
            <div class="stepper">
              <button class="stepper-btn" data-action="dec" data-ex-id="${ex.id}">−</button>
              <span class="stepper-value" data-count-value="${ex.id}">${counts[ex.id]}</span>
              <button class="stepper-btn" data-action="inc" data-ex-id="${ex.id}">+</button>
            </div>
          </div>
        `
          )
          .join("")}
      </div>

      <button class="primary-btn" id="add-day-save">Guardar día</button>
      <button class="secondary-btn" id="add-day-cancel">Cancelar</button>
    `;

    sheetEl.querySelectorAll(".day-tab").forEach((btn) => {
      btn.addEventListener("click", async () => {
        selectedDay = btn.dataset.dayId;
        dayExercises = await getDayExercises(selectedDay);
        ensureCounts();
        paint();
      });
    });

    sheetEl.querySelectorAll(".stepper-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const exId = Number(btn.dataset.exId);
        const delta = btn.dataset.action === "inc" ? 1 : -1;
        counts[exId] = Math.max(0, (counts[exId] || 0) + delta);
        sheetEl.querySelector(`[data-count-value="${exId}"]`).textContent = counts[exId];
      });
    });

    sheetEl.querySelector("#add-day-cancel").addEventListener("click", () => overlay.remove());

    sheetEl.querySelector("#add-day-save").addEventListener("click", async () => {
      const date = sheetEl.querySelector("#add-day-date").value;
      if (!date) return;

      const existingSets = await DB.getAll("sets");
      const hasExisting = existingSets.some((s) => s.date === date);
      if (hasExisting && !confirm(`Ya hay series registradas el ${formatDateLabel(date)}. ¿Añadir estas de todas formas?`)) {
        return;
      }

      let totalSets = 0;
      for (const ex of dayExercises) {
        const n = counts[ex.id] || 0;
        for (let i = 1; i <= n; i++) {
          await DB.add("sets", {
            exerciseId: ex.id,
            date,
            setNumber: i,
            segments: [{ reps: ex.repsLow, weight: 0 }],
            note: "",
            timestamp: `${date}T12:00:00.000Z`,
          });
          totalSets++;
        }
      }

      await DB.put("sessions", {
        id: `${selectedDay}_${date}`,
        dayId: selectedDay,
        date,
        finishedAt: new Date().toISOString(),
        setCount: totalSets,
        exerciseCount: dayExercises.filter((ex) => (counts[ex.id] || 0) > 0).length,
      });

      overlay.remove();
      renderHistoryView(container);
    });
  }

  paint();
}

window.renderHistoryView = renderHistoryView;
