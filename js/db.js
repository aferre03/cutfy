// Capa de acceso a IndexedDB. Todo el resto de la app guarda y lee datos
// a traves de las funciones de `DB`, nunca hablando con IndexedDB directamente.

const DB_NAME = "cutfy-db";
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("days")) {
        db.createObjectStore("days", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("exercises")) {
        const store = db.createObjectStore("exercises", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("byDay", "dayId");
      }

      if (!db.objectStoreNames.contains("sets")) {
        const store = db.createObjectStore("sets", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("byExercise", "exerciseId");
        store.createIndex("byExerciseDate", ["exerciseId", "date"]);
      }

      if (!db.objectStoreNames.contains("mealTemplates")) {
        db.createObjectStore("mealTemplates", {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      if (!db.objectStoreNames.contains("mealLogs")) {
        const store = db.createObjectStore("mealLogs", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("byDate", "date");
      }

      if (!db.objectStoreNames.contains("bodyWeights")) {
        const store = db.createObjectStore("bodyWeights", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("byDate", "date");
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
function getDB() {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  async getAll(store) {
    const db = await getDB();
    return reqToPromise(db.transaction(store).objectStore(store).getAll());
  },

  async get(store, key) {
    const db = await getDB();
    return reqToPromise(db.transaction(store).objectStore(store).get(key));
  },

  async put(store, value) {
    const db = await getDB();
    return reqToPromise(
      db.transaction(store, "readwrite").objectStore(store).put(value)
    );
  },

  async add(store, value) {
    const db = await getDB();
    return reqToPromise(
      db.transaction(store, "readwrite").objectStore(store).add(value)
    );
  },

  async delete(store, key) {
    const db = await getDB();
    return reqToPromise(
      db.transaction(store, "readwrite").objectStore(store).delete(key)
    );
  },

  async getByIndex(store, indexName, query) {
    const db = await getDB();
    return reqToPromise(
      db.transaction(store).objectStore(store).index(indexName).getAll(query)
    );
  },

  /** Todas las series de un ejercicio, ordenadas de mas reciente a mas antigua. */
  async getSetsForExercise(exerciseId) {
    const all = await DB.getByIndex("sets", "byExercise", exerciseId);
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },
};

window.DB = DB;
