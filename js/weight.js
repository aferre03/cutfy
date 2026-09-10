// Pantalla de peso corporal: registro de peso por fecha (store bodyWeights)
// + altura (perfil en settings) para calcular el IMC. El IMC no distingue
// musculo de grasa, asi que se muestra siempre junto a un aviso de que es
// solo una referencia orientativa, no un diagnostico.

function computeBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: "Bajo peso", cls: "pct-equal" };
  if (bmi < 25) return { label: "Normal", cls: "pct-up" };
  if (bmi < 30) return { label: "Sobrepeso", cls: "pct-equal" };
  return { label: "Obesidad", cls: "pct-down" };
}

async function renderWeightView(container) {
  const [settings, weightsRaw] = await Promise.all([DB.get("settings", "main"), DB.getAll("bodyWeights")]);
  const weights = weightsRaw.slice().sort((a, b) => b.date.localeCompare(a.date));
  const latest = weights[0];
  const heightCm = settings.heightCm || null;
  const today = todayISO();
  const todayEntry = weights.find((w) => w.date === today);

  const bmi = latest && heightCm ? computeBmi(latest.weightKg, heightCm) : null;
  const category = bmi ? bmiCategory(bmi) : null;

  const historyRows = weights
    .map((w, i) => {
      const prev = weights[i + 1];
      const delta = prev ? Math.round((w.weightKg - prev.weightKg) * 10) / 10 : null;
      return `
        <div class="weight-row" data-weight-id="${w.id}">
          <div>
            <div class="weight-row-date">${formatDateLabel(w.date)}</div>
            <div class="weight-row-value">${w.weightKg} kg${
        delta !== null ? ` <span class="hint">(${delta > 0 ? "+" : ""}${delta} kg)</span>` : ""
      }</div>
          </div>
          <button class="row-icon-btn" data-delete-weight="${w.id}" title="Borrar">🗑️</button>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="weight-view">
      <h2 class="section-title">Peso corporal</h2>

      <div class="weight-card">
        ${
          latest
            ? `
          <div>
            <div class="weight-current">${latest.weightKg} kg</div>
            <div class="weight-date">${formatDateLabel(latest.date)}</div>
          </div>
        `
            : `<p class="hint">Registra tu peso más abajo para empezar.</p>`
        }
        ${
          bmi
            ? `
          <div class="bmi-box">
            <div class="bmi-value ${category.cls}">${bmi.toFixed(1)}</div>
            <div class="bmi-label ${category.cls}">${category.label}</div>
          </div>
        `
            : ""
        }
      </div>

      ${
        latest && !heightCm
          ? `<p class="hint">Añade tu altura en Ajustes para ver también tu IMC.</p>`
          : ""
      }
      ${
        bmi
          ? `<p class="hint">El IMC no distingue músculo de grasa: si entrenas fuerza y tienes poca grasa, no te fíes de la categoría literal — úsalo solo como referencia de tendencia, no como diagnóstico.</p>`
          : ""
      }

      <label class="field-label" for="weight-date">Registrar peso</label>
      <div class="weight-log-row">
        <input type="date" id="weight-date" class="note-input" max="${today}" value="${today}" />
        <input type="text" inputmode="decimal" id="weight-input" class="note-input" placeholder="kg" value="${
          todayEntry ? todayEntry.weightKg : ""
        }" />
      </div>
      <button class="primary-btn" id="save-weight-btn">Guardar</button>

      ${historyRows}
    </div>
  `;

  document.getElementById("save-weight-btn").addEventListener("click", async () => {
    const date = document.getElementById("weight-date").value;
    // El teclado decimal en español usa coma ("83,5"); un <input type="number">
    // solo admite punto y se queda vacio por dentro si escribes una coma, asi
    // que el campo es type="text" y aqui se normaliza antes de convertir.
    const weightKg = Number(document.getElementById("weight-input").value.replace(",", "."));
    if (!date || !weightKg || weightKg <= 0) return;

    const existing = weights.find((w) => w.date === date);
    if (existing) {
      existing.weightKg = weightKg;
      await DB.put("bodyWeights", existing);
    } else {
      await DB.add("bodyWeights", { date, weightKg });
    }
    renderWeightView(container);
  });

  container.querySelectorAll("[data-delete-weight]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar este registro de peso?")) return;
      await DB.delete("bodyWeights", Number(btn.dataset.deleteWeight));
      renderWeightView(container);
    });
  });
}

window.renderWeightView = renderWeightView;
