// Pantalla de historial: tarjetas por dia (rutina + fecha + % completado)
// que al pulsarlas abren el detalle de que se hizo en cada ejercicio. Los
// dias cerrados con "Hemos terminado" llevan una insignia.

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

async function renderHistoryView(container) {
  const [sets, exercises, sessions] = await Promise.all([
    DB.getAll("sets"),
    DB.getAll("exercises"),
    DB.getAll("sessions"),
  ]);

  if (sets.length === 0) {
    container.innerHTML = `
      <div class="coming-soon">
        <h2>Historial</h2>
        <p class="hint">Aún no hay entrenos registrados. En cuanto guardes tu primera serie aparecerá aquí.</p>
      </div>
    `;
    return;
  }

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
            <div class="history-day-label">${DAY_LABELS[dayId] || "Entreno"}${
        session ? ' <span class="history-done-badge">✅</span>' : ""
      }</div>
            <div class="history-day-date">${formatDateLabel(date)}</div>
          </div>
          <div class="history-day-percent ${percentClass(percent)}">${percent}%</div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="history-view">
      <h2 class="section-title">Historial</h2>
      ${cards}
    </div>
  `;

  container.querySelectorAll(".history-day[data-date]").forEach((card) => {
    card.addEventListener("click", () => {
      historyState.openDate = card.dataset.date;
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
      <h2 class="exercise-title">${DAY_LABELS[dayId] || "Entreno"}</h2>
      <div class="exercise-meta">
        ${formatDateLabel(date)} · <span class="${percentClass(percent)}">${percent}% completado</span>${
    session ? " · ✅ cerrado" : ""
  }
      </div>
      ${plannedRows}
      ${orphanRows}
    </div>
  `;

  document.getElementById("history-back").addEventListener("click", () => {
    historyState.openDate = null;
    renderHistoryView(container);
  });
}

window.renderHistoryView = renderHistoryView;
