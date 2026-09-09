// Funciones compartidas por las distintas pantallas.

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

/** "Hoy", "Ayer" o "9 sept" para una fecha ISO (YYYY-MM-DD). */
function formatDateLabel(dateISO) {
  const today = todayISO();
  if (dateISO === today) return "Hoy";
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateISO === yesterday) return "Ayer";
  return DATE_LABEL_FORMATTER.format(new Date(`${dateISO}T00:00:00`));
}

function formatSegments(segments) {
  return segments.map((s) => `${s.reps}×${s.weight}kg`).join(" + ");
}

/** Compara una serie nueva contra la misma serie de la sesion anterior.
 * Se basa en el peso maximo usado (peso de trabajo) y, si es igual,
 * en el total de repeticiones sumando todos los segmentos. */
function compareToPrevious(newSegments, prevSegments) {
  if (!prevSegments || prevSegments.length === 0) return null;

  const sumReps = (segs) => segs.reduce((acc, s) => acc + s.reps, 0);
  const topWeight = (segs) => Math.max(...segs.map((s) => s.weight));

  const newTotalReps = sumReps(newSegments);
  const prevTotalReps = sumReps(prevSegments);
  const newTopWeight = topWeight(newSegments);
  const prevTopWeight = topWeight(prevSegments);

  if (newTopWeight > prevTopWeight) return "up";
  if (newTopWeight === prevTopWeight && newTotalReps > prevTotalReps) return "up";
  if (newTopWeight === prevTopWeight && newTotalReps === prevTotalReps) return "equal";
  return "down";
}

async function getTodaySets(exerciseId, today) {
  const sets = await DB.getSetsForExercise(exerciseId);
  return sets.filter((s) => s.date === today).sort((a, b) => a.setNumber - b.setNumber);
}

/** Crea una hoja modal (.sheet-overlay) con el HTML dado: quita cualquier
 * otra hoja que hubiera quedado abierta (p.ej. por un doble tap) y permite
 * cerrarla tocando fuera del panel, para que nunca se quede algo invisible
 * bloqueando la pantalla. Devuelve el overlay para que el que la abre le
 * anada sus propios listeners a los botones de dentro. */
function openSheetOverlay(innerHtml) {
  document.querySelectorAll(".sheet-overlay").forEach((el) => el.remove());
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = innerHtml;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

/** Series de la sesion anterior (la fecha mas reciente distinta de hoy). */
async function getPreviousSession(exerciseId, today) {
  const sets = await DB.getSetsForExercise(exerciseId);
  const previous = sets.find((s) => s.date !== today);
  if (!previous) return [];
  return sets
    .filter((s) => s.date === previous.date)
    .sort((a, b) => a.setNumber - b.setNumber);
}
