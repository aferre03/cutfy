// Pantalla de entreno: selector de dia, lista de ejercicios y registro de series.

const DAY_CYCLE = ["push", "pull", "leg"];
const DAY_LABELS = { push: "Push", pull: "Pull", leg: "Leg" };

const workoutState = {
  selectedDayId: null,
  activeExerciseId: null,
};

/** Series extra pedidas hoy por ejercicio (no persistidas: viven mientras
 * dura la sesion de la pestana). Clave `${exerciseId}|${date}`. */
const extraSetsRequested = {};

function extraSetsKey(exerciseId, date) {
  return `${exerciseId}|${date}`;
}

async function getDayExercises(dayId) {
  return (await DB.getByIndex("exercises", "byDay", dayId)).sort((a, b) => a.order - b.order);
}

/** Que dia toca segun el ciclo Push > Pull > Leg > (descanso) > repetir.
 * Si hay un dia forzado a mano (suggestedDayOverride), manda por encima de
 * todo hasta que se entrene de verdad. Si no, y ya se ha entrenado hoy sin
 * cerrar con "Hemos terminado", se queda en ese mismo dia en vez de avanzar
 * (para poder seguir metiendo series). En cuanto cambia la fecha, o en
 * cuanto cierras el dia, avanza. */
function suggestedDayId(settings) {
  if (settings.suggestedDayOverride) return settings.suggestedDayOverride;
  const today = todayISO();
  if (!settings.lastDayId) return "push";
  if (settings.lastDayDate === today && !settings.dayFinished) return settings.lastDayId;
  const idx = DAY_CYCLE.indexOf(settings.lastDayId);
  return DAY_CYCLE[(idx + 1) % DAY_CYCLE.length];
}

async function updateDayCycleBookkeeping(dayId, today) {
  const settings = await DB.get("settings", "main");
  if (settings.lastDayDate === today) return;
  settings.lastDayId = dayId;
  settings.lastDayDate = today;
  settings.dayFinished = false;
  settings.suggestedDayOverride = null;
  await DB.put("settings", settings);
}

/** Abre una hoja para forzar a mano que dia se sugiere la proxima vez,
 * con confirmacion antes de aplicarlo. El aviso deja claro que es solo
 * para "la proxima vez" - en cuanto se registre una serie, el ciclo
 * normal retoma desde ese dia. */
function openSuggestedDaySheet(currentSuggestion, onChanged) {
  const overlay = openSheetOverlay(`
    <div class="sheet">
      <div class="sheet-title">¿Qué día quieres que te sugiera?</div>
      <p class="hint">Ahora mismo te sugiere ${DAY_LABELS[currentSuggestion]}. En cuanto registres una serie, el ciclo sigue normal desde ese día.</p>
      <div class="sheet-options">
        ${DAY_CYCLE.map(
          (id) => `<button class="secondary-btn suggest-day-btn" data-day-id="${id}">${DAY_LABELS[id]}</button>`
        ).join("")}
      </div>
      <button class="secondary-btn" id="suggest-cancel">Cancelar</button>
    </div>
  `);

  overlay.querySelector("#suggest-cancel").addEventListener("click", () => overlay.remove());

  overlay.querySelectorAll(".suggest-day-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const dayId = btn.dataset.dayId;
      if (!confirm(`¿Cambiar el día sugerido a ${DAY_LABELS[dayId]}?`)) return;
      const settings = await DB.get("settings", "main");
      settings.suggestedDayOverride = dayId;
      await DB.put("settings", settings);
      overlay.remove();
      onChanged();
    });
  });
}

async function renderWorkoutView(container) {
  const settings = await DB.get("settings", "main");
  if (!workoutState.selectedDayId) {
    workoutState.selectedDayId = suggestedDayId(settings);
  }

  if (workoutState.activeExerciseId) {
    return renderLogSetScreen(container, workoutState.activeExerciseId);
  }

  const exercises = await getDayExercises(workoutState.selectedDayId);

  const today = todayISO();
  const trainedToday = settings.lastDayDate === today;
  const suggestion = suggestedDayId(settings);

  const rows = await Promise.all(
    exercises.map(async (ex) => {
      const view = effectiveExercise(ex);
      const done = (await getTodaySets(ex.id, today)).length;
      const complete = done >= view.plannedSets;
      return `
        <li class="exercise-row ${complete ? "complete" : ""}" data-exercise-id="${ex.id}">
          <div class="exercise-row-main">
            <div class="exercise-name">${escapeHtml(view.name)}${
        view.isSwapped ? ' <span class="swap-tag">🔁 hoy</span>' : ""
      }</div>
            <div class="exercise-meta">${view.plannedSets}×${view.repsLow}-${view.repsHigh}${
        view.note ? " · " + escapeHtml(view.note) : ""
      }</div>
            ${
              view.isSwapped
                ? `<div class="exercise-meta">en vez de ${escapeHtml(view.originalName)}</div>`
                : ""
            }
          </div>
          <div class="exercise-row-actions">
            <button class="row-icon-btn" data-alt-id="${ex.id}" title="Alternativas">🔄</button>
            <div class="exercise-progress">${done}/${view.plannedSets}</div>
          </div>
        </li>
      `;
    })
  );

  container.innerHTML = `
    <div class="day-tabs-row">
      <div class="day-tabs">
        ${DAY_CYCLE.map(
          (id) => `
          <button class="day-tab ${id === workoutState.selectedDayId ? "active" : ""}" data-day-id="${id}">
            ${DAY_LABELS[id]}${id === suggestion ? '<span class="suggested-dot"></span>' : ""}
          </button>`
        ).join("")}
      </div>
      <button class="row-icon-btn" id="change-suggestion-btn" title="Cambiar día sugerido">🔀</button>
    </div>
    <ul class="exercise-list">${rows.join("")}</ul>
    ${
      trainedToday
        ? `<button class="primary-btn finish-day-btn" id="finish-day-btn">✅ Hemos terminado</button>`
        : ""
    }
  `;

  document.getElementById("change-suggestion-btn").addEventListener("click", () => {
    openSuggestedDaySheet(suggestion, () => renderWorkoutView(container));
  });

  container.querySelectorAll(".day-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      workoutState.selectedDayId = btn.dataset.dayId;
      renderWorkoutView(container);
    });
  });

  container.querySelectorAll(".exercise-row").forEach((row) => {
    row.addEventListener("click", () => {
      workoutState.activeExerciseId = Number(row.dataset.exerciseId);
      renderWorkoutView(container);
    });
  });

  container.querySelectorAll(".row-icon-btn[data-alt-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ex = exercises.find((x) => x.id === Number(btn.dataset.altId));
      openAlternativesSheet(ex, () => renderWorkoutView(container));
    });
  });

  const finishBtn = document.getElementById("finish-day-btn");
  if (finishBtn) {
    finishBtn.addEventListener("click", async () => {
      if (finishBtn.disabled) return;
      finishBtn.disabled = true;
      await finishDay(settings.lastDayId, today, () => {
        workoutState.selectedDayId = null;
        renderWorkoutView(container);
      });
    });
  }
}

/** Cierra la sesion de hoy: la guarda en `sessions` (para que salga marcada
 * como completada en el Historial), marca el dia como terminado para que el
 * ciclo Push/Pull/Leg avance ya mismo (sin esperar a que cambie la fecha) y
 * muestra un resumen. Las series ya estaban guardadas desde que se registro
 * cada una; esto solo anade el cierre explicito. */
async function finishDay(dayId, date, onDone) {
  const allSets = await DB.getAll("sets");
  const todaySets = allSets.filter((s) => s.date === date);
  const exerciseIds = new Set(todaySets.map((s) => s.exerciseId));

  await DB.put("sessions", {
    id: `${dayId}_${date}`,
    dayId,
    date,
    finishedAt: new Date().toISOString(),
    setCount: todaySets.length,
    exerciseCount: exerciseIds.size,
  });

  const settings = await DB.get("settings", "main");
  settings.dayFinished = true;
  await DB.put("settings", settings);

  const overlay = openSheetOverlay(`
    <div class="sheet">
      <div class="sheet-title">¡Sesión guardada! 💪</div>
      <p class="hint">${todaySets.length} series en ${exerciseIds.size} ejercicios (${DAY_LABELS[dayId]}).</p>
      <button class="primary-btn" id="finish-view-history">Ver historial</button>
      <button class="secondary-btn" id="finish-close">Cerrar</button>
    </div>
  `);
  overlay.querySelector("#finish-close").addEventListener("click", () => {
    overlay.remove();
    onDone();
  });
  overlay.querySelector("#finish-view-history").addEventListener("click", () => {
    overlay.remove();
    appState.view = "history";
    renderNav();
    renderView();
  });
}

async function renderLogSetScreen(container, exerciseId) {
  const rawExercise = await DB.get("exercises", exerciseId);
  const exercise = effectiveExercise(rawExercise);
  const today = todayISO();
  const todaySets = await getTodaySets(exerciseId, today);
  const previousSets = await getPreviousSession(exerciseId, today);
  const setNumber = todaySets.length + 1;
  const extraKey = extraSetsKey(exerciseId, today);
  const targetSets = exercise.plannedSets + (extraSetsRequested[extraKey] || 0);
  const isComplete = todaySets.length >= targetSets;

  const dayExercises = await getDayExercises(rawExercise.dayId);
  const currentIndex = dayExercises.findIndex((e) => e.id === exerciseId);
  const nextExercise = dayExercises[currentIndex + 1] || null;

  const previousForThisSet = previousSets[setNumber - 1];
  const lastKnown = previousForThisSet || previousSets[previousSets.length - 1];

  const segmentsState = [
    {
      reps: lastKnown ? lastKnown.segments[0].reps : exercise.repsLow,
      weight: lastKnown ? lastKnown.segments[0].weight : 20,
    },
  ];

  function renderPreviousBox() {
    if (previousSets.length === 0) {
      return `<p class="hint">Aún no hay historial de este ejercicio.</p>`;
    }
    return `
      <div class="previous-box">
        <div class="previous-label">Última vez</div>
        ${previousSets
          .map(
            (s) =>
              `<div class="previous-set">Serie ${s.setNumber}: ${formatSegments(s.segments)}${
                s.note ? ` <span class="previous-note">(${escapeHtml(s.note)})</span>` : ""
              }</div>`
          )
          .join("")}
      </div>
    `;
  }

  function segmentDeltaLabel(i) {
    if (i === 0) return "";
    const diff = segmentsState[i].weight - segmentsState[i - 1].weight;
    if (diff === 0) return "";
    return ` · ${diff > 0 ? "+" : ""}${diff}kg`;
  }

  function renderSegments() {
    return segmentsState
      .map(
        (seg, i) => `
        <div class="segment-editor">
          ${
            segmentsState.length > 1
              ? `<div class="segment-label">Segmento ${i + 1}${segmentDeltaLabel(i)}</div>`
              : ""
          }
          <div class="stepper-row">
            <span class="stepper-title">Reps</span>
            <div class="stepper">
              <button class="stepper-btn" data-action="reps-dec" data-i="${i}">−</button>
              <span class="stepper-value">${seg.reps}</span>
              <button class="stepper-btn" data-action="reps-inc" data-i="${i}">+</button>
            </div>
          </div>
          <div class="stepper-row">
            <span class="stepper-title">Peso (kg)</span>
            <div class="stepper stepper-wide">
              <button class="stepper-btn" data-action="weight-dec5" data-i="${i}">−5</button>
              <button class="stepper-btn" data-action="weight-dec1" data-i="${i}">−1</button>
              <span class="stepper-value">${seg.weight}</span>
              <button class="stepper-btn" data-action="weight-inc1" data-i="${i}">+1</button>
              <button class="stepper-btn" data-action="weight-inc5" data-i="${i}">+5</button>
            </div>
          </div>
        </div>
      `
      )
      .join("");
  }

  function paint() {
    container.innerHTML = `
      <div class="log-set-screen">
        <button class="back-btn" id="back-to-list">← ${DAY_LABELS[exercise.dayId]}</button>
        <div class="title-row">
          <h2 class="exercise-title">${escapeHtml(exercise.name)}</h2>
          <button class="row-icon-btn" id="machine-gear-btn" title="Ajustes de máquina">⚙️</button>
        </div>
        ${
          exercise.isSwapped
            ? `<div class="swap-banner">🔁 Hoy en vez de ${escapeHtml(exercise.originalName)}</div>`
            : ""
        }
        <div class="exercise-meta">
          Objetivo: ${exercise.plannedSets}×${exercise.repsLow}-${exercise.repsHigh}${
      exercise.note ? " · " + escapeHtml(exercise.note) : ""
    }
        </div>
        <div class="row-btn-pair">
          <button class="secondary-btn" id="swap-exercise-btn">🔄 Cambiar ejercicio</button>
          <button class="secondary-btn" id="next-exercise-btn">${
            nextExercise ? `Siguiente →` : `Volver a la lista`
          }</button>
        </div>

        ${renderMachineSettingsBox(rawExercise)}

        ${renderPreviousBox()}

        ${
          isComplete
            ? `<div class="complete-banner">✅ Ejercicio completo (${todaySets.length}/${exercise.plannedSets})</div>
               <button class="secondary-btn" id="extra-set-btn">Añadir serie extra</button>`
            : `<div class="set-counter">${
                setNumber <= exercise.plannedSets
                  ? `Serie ${setNumber} de ${exercise.plannedSets}`
                  : `Serie ${setNumber} · extra`
              }</div>
               <div id="segments-container">${renderSegments()}</div>
               <button class="secondary-btn" id="add-segment-btn">+ Nuevo segmento (menos/más peso, sin descanso)</button>
               <input type="text" id="set-note" class="note-input" placeholder="Nota (opcional, ej. 'N' agarre neutro)" maxlength="40" />
               <button class="primary-btn" id="save-set-btn">Guardar serie</button>`
        }
      </div>
    `;

    document.getElementById("back-to-list").addEventListener("click", () => {
      workoutState.activeExerciseId = null;
      renderWorkoutView(container);
    });

    document.getElementById("machine-gear-btn").addEventListener("click", () => {
      openMachineConfigSheet(rawExercise, () => renderLogSetScreen(container, exerciseId));
    });
    bindMachineSettingsBox(container, rawExercise);

    document.getElementById("swap-exercise-btn").addEventListener("click", () => {
      openAlternativesSheet(rawExercise, () => renderLogSetScreen(container, exerciseId));
    });

    document.getElementById("next-exercise-btn").addEventListener("click", () => {
      if (nextExercise) {
        workoutState.activeExerciseId = nextExercise.id;
        renderLogSetScreen(container, nextExercise.id);
      } else {
        workoutState.activeExerciseId = null;
        renderWorkoutView(container);
      }
    });

    if (isComplete) {
      document.getElementById("extra-set-btn").addEventListener("click", () => {
        extraSetsRequested[extraKey] = (extraSetsRequested[extraKey] || 0) + 1;
        renderLogSetScreen(container, exerciseId);
      });
      return;
    }

    container.querySelectorAll(".stepper-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        const action = btn.dataset.action;
        const seg = segmentsState[i];
        if (action === "reps-inc") seg.reps++;
        if (action === "reps-dec") seg.reps = Math.max(0, seg.reps - 1);
        if (action === "weight-inc1") seg.weight += 1;
        if (action === "weight-dec1") seg.weight = Math.max(0, seg.weight - 1);
        if (action === "weight-inc5") seg.weight += 5;
        if (action === "weight-dec5") seg.weight = Math.max(0, seg.weight - 5);
        paint();
      });
    });

    document.getElementById("add-segment-btn").addEventListener("click", () => {
      const last = segmentsState[segmentsState.length - 1];
      const suggestedWeight = Math.max(0, Math.round(last.weight * 0.8));
      segmentsState.push({ reps: last.reps, weight: suggestedWeight });
      paint();
    });

    document.getElementById("save-set-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;

      const note = document.getElementById("set-note").value.trim();
      const newSet = {
        exerciseId,
        date: today,
        setNumber,
        segments: segmentsState.map((s) => ({ ...s })),
        note,
        timestamp: new Date().toISOString(),
      };
      await DB.add("sets", newSet);
      await updateDayCycleBookkeeping(exercise.dayId, today);

      const comparison = compareToPrevious(newSet.segments, previousForThisSet?.segments);
      showRestTimer(exercise.defaultRestSeconds, comparison, () => {
        renderLogSetScreen(container, exerciseId);
      });
    });
  }

  paint();
}
