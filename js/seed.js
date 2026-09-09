// Datos iniciales: se insertan una unica vez, la primera vez que se abre la
// app (se detecta comprobando si ya existe el registro de settings).
// Ademas, en cada arranque se ejecutan dos pasadas de migracion:
//  - migrateExercises: anade campos nuevos (alternativas, ajustes de
//    maquina, swap del dia) a ejercicios ya guardados, sin tocar el resto.
//  - syncRoutine: cuando cambia la rutina en si (nombres, series, reps,
//    descansos), actualiza en sitio los ejercicios ya guardados para que
//    coincidan, comparando por (dia, orden) y conservando el historial de
//    series y los ajustes de maquina ya configurados.

const ROUTINE_VERSION = 2;

const SEED_DAYS = [
  { id: "push", name: "Push", order: 0 },
  { id: "pull", name: "Pull", order: 1 },
  { id: "leg", name: "Leg", order: 2 },
];

function alt(name, overrides = {}) {
  return { name, ...overrides };
}

const SEED_EXERCISES = [
  // Push
  { dayId: "push", order: 0, name: "Press pecho en máquina", repsLow: 8, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 150,
    alternatives: [alt("Press banca mancuernas"), alt("Press inclinado mancuernas")] },
  { dayId: "push", order: 1, name: "Shoulder press en máquina", repsLow: 10, repsHigh: 12, plannedSets: 3, defaultRestSeconds: 120,
    alternatives: [alt("Press militar mancuernas"), alt("Press mancuernas sentado")] },
  { dayId: "push", order: 2, name: "Pec deck", repsLow: 15, repsHigh: 20, plannedSets: 3, defaultRestSeconds: 90, note: "Última serie al fallo",
    alternatives: [alt("Press converge máquina"), alt("Cruce de poleas")] },
  { dayId: "push", order: 3, name: "Elevación lateral (mancuerna ligera o cable)", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Elevación lateral en polea"), alt("Elevación lateral en máquina")] },
  { dayId: "push", order: 4, name: "Extensión tríceps encima cabeza (cuerda en polea)", repsLow: 5, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Press francés"), alt("Extensión tríceps en máquina")] },
  { dayId: "push", order: 5, name: "Extensión tríceps una mano (cuerda en polea)", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Extensión tríceps polea agarre normal"), alt("Fondos en máquina")] },

  // Pull
  { dayId: "pull", order: 0, name: "Remo pecho apoyado", repsLow: 8, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 120,
    alternatives: [alt("Remo en máquina agarre neutro"), alt("Remo con mancuerna a una mano")] },
  { dayId: "pull", order: 1, name: "Jalón triángulo", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Jalón agarre supino"), alt("Jalón agarre ancho")] },
  { dayId: "pull", order: 2, name: "Remo sentado triángulo", repsLow: 15, repsHigh: 20, plannedSets: 2, defaultRestSeconds: 90, note: "Al fallo",
    alternatives: [alt("Remo en polea baja agarre ancho"), alt("Pull-over en polea")] },
  { dayId: "pull", order: 3, name: "Reverse cable fly", repsLow: 15, repsHigh: 20, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Pájaros con mancuernas"), alt("Reverse pec-deck")] },
  { dayId: "pull", order: 4, name: "Face pull", repsLow: 15, repsHigh: 20, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Remo alto en polea"), alt("Reverse pec-deck")] },
  { dayId: "pull", order: 5, name: "Bíceps con cuerda", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Curl con mancuernas alterno"), alt("Curl en banco Scott")] },
  { dayId: "pull", order: 6, name: "Bíceps máquina", repsLow: 15, repsHigh: 20, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Curl en polea baja"), alt("Curl concentrado")] },

  // Leg
  { dayId: "leg", order: 0, name: "Seated leg curl", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 120,
    alternatives: [alt("Leg curl tumbado"), alt("Peso muerto rumano a una pierna")] },
  { dayId: "leg", order: 1, name: "Sentadilla en la hack", repsLow: 5, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 180,
    alternatives: [alt("Sentadilla goblet"), alt("Prensa (leg press)")] },
  { dayId: "leg", order: 2, name: "Hip thrust en máquina", repsLow: 8, repsHigh: 12, plannedSets: 3, defaultRestSeconds: 150,
    alternatives: [alt("Hip thrust con barra"), alt("Buenos días")] },
  { dayId: "leg", order: 3, name: "Extensión de pierna", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90,
    alternatives: [alt("Sentadilla búlgara"), alt("Zancadas")] },
  { dayId: "leg", order: 4, name: "Aductor", repsLow: 15, repsHigh: 20, plannedSets: 2, defaultRestSeconds: 90,
    alternatives: [alt("Aductor en polea"), alt("Sentadilla sumo")] },
  { dayId: "leg", order: 5, name: "Abductor", repsLow: 15, repsHigh: 20, plannedSets: 2, defaultRestSeconds: 90,
    alternatives: [alt("Abductor en polea"), alt("Puente de glúteo con banda")] },
  { dayId: "leg", order: 6, name: "Gemelos", repsLow: 10, repsHigh: 15, plannedSets: 4, defaultRestSeconds: 90,
    alternatives: [alt("Gemelo de pie en máquina"), alt("Gemelo a una pierna con mancuerna")] },
];

const SEED_MEAL_TEMPLATES = [
  { name: "Desayuno", kcal: 350, protein: 20, carbs: 5, fat: 28 },
  { name: "Comida", kcal: 700, protein: 65, carbs: 90, fat: 15 },
  { name: "Cena", kcal: 580, protein: 50, carbs: 75, fat: 12 },
  { name: "Batido post-entreno", kcal: 150, protein: 30, carbs: 3, fat: 2 },
];

const SEED_SETTINGS = {
  id: "main",
  kcalGoal: 2200,
  proteinGoal: 170,
  currentWeightKg: 83,
  lastDayId: null,
  lastDayDate: null,
  routineVersion: ROUTINE_VERSION,
  routineCustomized: false,
};

async function ensureSeeded() {
  const existing = await DB.get("settings", "main");
  if (!existing) {
    for (const day of SEED_DAYS) await DB.put("days", day);
    for (const exercise of SEED_EXERCISES) await DB.add("exercises", exercise);
    for (const meal of SEED_MEAL_TEMPLATES) await DB.add("mealTemplates", meal);
    await DB.put("settings", SEED_SETTINGS);
  }
  await migrateExercises();
  await syncRoutine();
}

/** Anade a ejercicios ya guardados los campos incorporados despues del
 * lanzamiento inicial (alternativas, ajustes de maquina, swap del dia),
 * sin tocar nada de lo que el usuario ya haya registrado. */
async function migrateExercises() {
  const exercises = await DB.getAll("exercises");
  for (const ex of exercises) {
    let changed = false;
    if (!ex.machineFields) {
      ex.machineFields = [];
      changed = true;
    }
    if (!ex.machineValues) {
      ex.machineValues = {};
      changed = true;
    }
    if (ex.swapToday === undefined) {
      ex.swapToday = null;
      changed = true;
    }
    if (!ex.alternatives) {
      const seedMatch = SEED_EXERCISES.find((s) => s.name === ex.name);
      ex.alternatives = seedMatch?.alternatives || [];
      changed = true;
    }
    if (changed) await DB.put("exercises", ex);
  }
}

/** Cuando la rutina en si cambia (nombres, series, reps, descansos), sincroniza
 * los ejercicios guardados con el nuevo SEED_EXERCISES emparejando por
 * (dia, orden). Conserva el id (y por tanto el historial de series), los
 * ajustes de maquina ya configurados y cualquier swap activo; solo pisa los
 * datos que definen el ejercicio en si. Se ejecuta una unica vez por bump
 * de ROUTINE_VERSION, y nunca si la persona ya ha editado su rutina a mano
 * desde Ajustes (routineCustomized) — eso es solo para la rutina de fabrica. */
async function syncRoutine() {
  const settings = await DB.get("settings", "main");
  if (settings.routineVersion === ROUTINE_VERSION) return;
  if (settings.routineCustomized) {
    settings.routineVersion = ROUTINE_VERSION;
    await DB.put("settings", settings);
    return;
  }

  const exercises = await DB.getAll("exercises");
  for (const seedEx of SEED_EXERCISES) {
    const match = exercises.find((e) => e.dayId === seedEx.dayId && e.order === seedEx.order);
    if (!match) continue;
    match.name = seedEx.name;
    match.repsLow = seedEx.repsLow;
    match.repsHigh = seedEx.repsHigh;
    match.plannedSets = seedEx.plannedSets;
    match.defaultRestSeconds = seedEx.defaultRestSeconds;
    match.note = seedEx.note || "";
    match.alternatives = seedEx.alternatives;
    await DB.put("exercises", match);
  }

  settings.routineVersion = ROUTINE_VERSION;
  await DB.put("settings", settings);
}

/** Marca la rutina como personalizada para que syncRoutine no la vuelva a
 * pisar con la rutina de fabrica en el futuro. Llamar tras cualquier
 * edicion manual de un ejercicio (crear, editar, borrar, cambio definitivo). */
async function markRoutineCustomized() {
  const settings = await DB.get("settings", "main");
  if (settings.routineCustomized) return;
  settings.routineCustomized = true;
  await DB.put("settings", settings);
}

window.ensureSeeded = ensureSeeded;
window.markRoutineCustomized = markRoutineCustomized;
