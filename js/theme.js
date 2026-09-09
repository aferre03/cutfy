// Personalizacion del color de acento de la app (por defecto el rojo del
// tema). Se aplica pisando las variables CSS en tiempo de ejecucion, asi
// que no hace falta re-escribir el CSS por color - el resto de la app ya
// usa var(--accent)/var(--accent-dark)/var(--accent-rgb) en todas partes.

const ACCENT_PRESETS = [
  "#d11507", // rojo (por defecto)
  "#f97316", // naranja
  "#eab308", // amarillo
  "#22c55e", // verde
  "#14b8a6", // turquesa
  "#3b82f6", // azul
  "#8b5cf6", // morado
  "#ec4899", // rosa
];

function hexToRgbTriplet(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
}

function darkenHex(hex, factor = 0.75) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = Math.round(((bigint >> 16) & 255) * factor);
  const g = Math.round(((bigint >> 8) & 255) * factor);
  const b = Math.round((bigint & 255) * factor);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function applyAccentColor(hex) {
  const root = document.documentElement.style;
  if (!hex) {
    root.removeProperty("--accent");
    root.removeProperty("--accent-rgb");
    root.removeProperty("--accent-dark");
    return;
  }
  root.setProperty("--accent", hex);
  root.setProperty("--accent-rgb", hexToRgbTriplet(hex));
  root.setProperty("--accent-dark", darkenHex(hex));
}

async function initTheme() {
  const settings = await DB.get("settings", "main");
  if (settings.accentColor) applyAccentColor(settings.accentColor);
}

window.ACCENT_PRESETS = ACCENT_PRESETS;
window.applyAccentColor = applyAccentColor;
window.initTheme = initTheme;
