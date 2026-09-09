// Gestion de los dias de la rutina (antes fijos: Push/Pull/Leg, ahora datos
// editables por cada persona). El resto de la app lee siempre de este cache
// en memoria (cargado una vez al arrancar) en vez de tener el ciclo escrito
// a mano; se recarga cada vez que algo cambia desde la hoja de gestion.

let daysCache = [];

async function loadDays() {
  daysCache = (await DB.getAll("days")).sort((a, b) => a.order - b.order);
  return daysCache;
}

function getDays() {
  return daysCache;
}

function getDayIds() {
  return daysCache.map((d) => d.id);
}

function dayLabel(dayId) {
  const day = daysCache.find((d) => d.id === dayId);
  return day ? day.name : "Entreno";
}

async function addDay(name) {
  const order = daysCache.length ? Math.max(...daysCache.map((d) => d.order)) + 1 : 0;
  const id = `day_${Date.now()}`;
  await DB.put("days", { id, name, order });
  await loadDays();
}

async function renameDay(dayId, name) {
  const day = daysCache.find((d) => d.id === dayId);
  if (!day) return;
  day.name = name;
  await DB.put("days", day);
  await loadDays();
}

async function deleteDay(dayId) {
  const exercises = await DB.getByIndex("exercises", "byDay", dayId);
  for (const ex of exercises) await DB.delete("exercises", ex.id);
  await DB.delete("days", dayId);
  await loadDays();
}

async function moveDay(dayId, direction) {
  const idx = daysCache.findIndex((d) => d.id === dayId);
  const swapWith = idx + direction;
  if (idx === -1 || swapWith < 0 || swapWith >= daysCache.length) return;
  const a = daysCache[idx];
  const b = daysCache[swapWith];
  const tmpOrder = a.order;
  a.order = b.order;
  b.order = tmpOrder;
  await DB.put("days", a);
  await DB.put("days", b);
  await loadDays();
}

/** Hoja para crear, borrar, renombrar y reordenar los dias de la rutina.
 * onChanged se llama una vez al cerrar, para que quien la abrio refresque
 * su vista con los dias ya actualizados. */
function openManageDaysSheet(onChanged) {
  const overlay = openSheetOverlay(`<div class="sheet" id="manage-days-sheet"></div>`);
  const sheetEl = overlay.querySelector("#manage-days-sheet");

  function paint() {
    sheetEl.innerHTML = `
      <div class="sheet-title">Días de la rutina</div>
      <p class="hint">Crea, borra, renombra o reordena tus días. Al borrar uno se borran también sus ejercicios (el historial ya registrado se conserva).</p>
      <div class="sheet-options">
        ${daysCache
          .map(
            (day, i) => `
          <div class="day-manage-row">
            <div class="day-manage-arrows">
              <button class="row-icon-btn" data-move="-1" data-day-id="${day.id}" ${
              i === 0 ? "disabled" : ""
            }>↑</button>
              <button class="row-icon-btn" data-move="1" data-day-id="${day.id}" ${
              i === daysCache.length - 1 ? "disabled" : ""
            }>↓</button>
            </div>
            <div class="day-manage-name">${escapeHtml(day.name)}</div>
            <div class="day-manage-actions">
              <button class="row-icon-btn" data-rename="${day.id}" title="Renombrar">✏️</button>
              <button class="row-icon-btn" data-delete-day="${day.id}" title="Borrar">🗑️</button>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      <button class="secondary-btn" id="add-day-name-btn">+ Añadir día</button>
      <button class="secondary-btn" id="manage-days-close">Cerrar</button>
    `;

    sheetEl.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await moveDay(btn.dataset.dayId, Number(btn.dataset.move));
        paint();
      });
    });

    sheetEl.querySelectorAll("[data-rename]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const day = daysCache.find((d) => d.id === btn.dataset.rename);
        const name = prompt("Nombre del día:", day.name);
        if (!name || !name.trim()) return;
        await renameDay(day.id, name.trim());
        paint();
      });
    });

    sheetEl.querySelectorAll("[data-delete-day]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (daysCache.length <= 1) {
          alert("Tiene que quedar al menos un día.");
          return;
        }
        const day = daysCache.find((d) => d.id === btn.dataset.deleteDay);
        const exerciseCount = (await DB.getByIndex("exercises", "byDay", day.id)).length;
        if (
          !confirm(
            `¿Borrar "${day.name}"? Se borrarán también sus ${exerciseCount} ejercicios (el historial ya registrado se conserva).`
          )
        )
          return;
        await deleteDay(day.id);
        paint();
      });
    });

    sheetEl.querySelector("#add-day-name-btn").addEventListener("click", async () => {
      const name = prompt("Nombre del nuevo día (ej. 'Upper', 'Full Body'):");
      if (!name || !name.trim()) return;
      await addDay(name.trim());
      paint();
    });

    sheetEl.querySelector("#manage-days-close").addEventListener("click", () => {
      overlay.remove();
      onChanged();
    });
  }

  paint();
}

window.loadDays = loadDays;
window.getDays = getDays;
window.getDayIds = getDayIds;
window.dayLabel = dayLabel;
window.openManageDaysSheet = openManageDaysSheet;
