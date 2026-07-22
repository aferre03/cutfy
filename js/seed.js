// Datos iniciales: se insertan una unica vez, la primera vez que se abre la
// app (se detecta comprobando si ya existe el registro de settings).

const SEED_DAYS = [
  { id: "push", name: "Push", order: 0 },
  { id: "pull", name: "Pull", order: 1 },
  { id: "leg", name: "Leg", order: 2 },
];

const SEED_EXERCISES = [
  // Push
  { dayId: "push", order: 0, name: "Press banca", repsLow: 8, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 150 },
  { dayId: "push", order: 1, name: "Shoulder press", repsLow: 10, repsHigh: 12, plannedSets: 3, defaultRestSeconds: 120 },
  { dayId: "push", order: 2, name: "Abracho (chest press/fly)", repsLow: 15, repsHigh: 20, plannedSets: 3, defaultRestSeconds: 90, note: "Última serie al fallo" },
  { dayId: "push", order: 3, name: "Elevación lateral", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90 },
  { dayId: "push", order: 4, name: "Extensión tríceps encima cabeza", repsLow: 5, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 90 },
  { dayId: "push", order: 5, name: "Extensión tríceps una mano (agarre bajo)", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90 },

  // Pull
  { dayId: "pull", order: 0, name: "Remo sentado pecho apoyado (agarre cerrado)", repsLow: 8, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 120 },
  { dayId: "pull", order: 1, name: "Jalón triángulo", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90 },
  { dayId: "pull", order: 2, name: "Remo sentado triángulo", repsLow: 15, repsHigh: 20, plannedSets: 2, defaultRestSeconds: 90, note: "Al fallo, reps parciales al final" },
  { dayId: "pull", order: 3, name: "Reverse cable fly", repsLow: 15, repsHigh: 20, plannedSets: 3, defaultRestSeconds: 90 },
  { dayId: "pull", order: 4, name: "Dumbbell shrug", repsLow: 15, repsHigh: 20, plannedSets: 4, defaultRestSeconds: 90 },
  { dayId: "pull", order: 5, name: "Bíceps Z (de pie)", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90 },
  { dayId: "pull", order: 6, name: "Bíceps máquina", repsLow: 15, repsHigh: 20, plannedSets: 3, defaultRestSeconds: 90 },

  // Leg
  { dayId: "leg", order: 0, name: "Seated leg curl", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 120 },
  { dayId: "leg", order: 1, name: "Smith sentadilla / Leg press", repsLow: 5, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 180, note: "Alternar entre ambos" },
  { dayId: "leg", order: 2, name: "RDL", repsLow: 5, repsHigh: 10, plannedSets: 3, defaultRestSeconds: 150 },
  { dayId: "leg", order: 3, name: "Extensión de pierna", repsLow: 10, repsHigh: 15, plannedSets: 3, defaultRestSeconds: 90 },
  { dayId: "leg", order: 4, name: "Aductor", repsLow: 15, repsHigh: 20, plannedSets: 2, defaultRestSeconds: 90 },
  { dayId: "leg", order: 5, name: "Abductor", repsLow: 15, repsHigh: 20, plannedSets: 2, defaultRestSeconds: 90 },
  { dayId: "leg", order: 6, name: "Gemelos (en leg press)", repsLow: 10, repsHigh: 15, plannedSets: 4, defaultRestSeconds: 90 },
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
};

async function ensureSeeded() {
  const existing = await DB.get("settings", "main");
  if (existing) return;

  for (const day of SEED_DAYS) await DB.put("days", day);
  for (const exercise of SEED_EXERCISES) await DB.add("exercises", exercise);
  for (const meal of SEED_MEAL_TEMPLATES) await DB.add("mealTemplates", meal);
  await DB.put("settings", SEED_SETTINGS);
}

window.ensureSeeded = ensureSeeded;
