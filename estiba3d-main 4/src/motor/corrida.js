// ================= Corrida =================
// Una Corrida es una ejecución del motor sobre una carga.
// Recibe la carga tal como la tiene la UI (mm, kg, soporte mínimo en %), la valida,
// la convierte a lo que espera el motor, la ejecuta en un adaptador (Worker o en proceso),
// reporta progreso, permite cancelar y devuelve el resultado junto con la carga exacta que usó.
//
// Falla de tres formas, siempre con ErrorCorrida:
//   "entrada_invalida"  → detalle.problemas: [{ id, campo, mensaje }]
//   "motor"             → el motor lanzó; detalle.original trae el mensaje
//   "cancelada"         → la señal de cancelación se activó

export class ErrorCorrida extends Error {
  constructor(tipo, mensaje, detalle = {}) {
    super(mensaje);
    this.name = "ErrorCorrida";
    this.tipo = tipo;
    this.detalle = detalle;
  }
}

// ---------- Validación ----------
const esNum = (v) => typeof v === "number" && Number.isFinite(v);
const positivo = (v) => esNum(v) && v > 0;
const noNegativo = (v) => esNum(v) && v >= 0;

export function validarCarga({ items, vehiculo, tarimas, reglas }) {
  const problemas = [];
  const p = (id, campo, mensaje) => problemas.push({ id, campo, mensaje });

  if (!Array.isArray(items) || items.length === 0) p(null, "items", "No hay cajas que cargar.");
  else items.forEach((it) => {
    const id = it.id ?? it.nombre;
    for (const campo of ["L", "W", "H"]) if (!positivo(it[campo])) p(id, campo, `${it.nombre}: la medida ${campo} debe ser mayor que 0.`);
    if (!noNegativo(it.peso)) p(id, "peso", `${it.nombre}: el peso debe ser 0 o mayor.`);
    if (!positivo(it.qty) || !Number.isInteger(it.qty)) p(id, "qty", `${it.nombre}: la cantidad debe ser un entero mayor que 0.`);
    if (!Array.isArray(it.oris) || !it.oris.some(Boolean)) p(id, "oris", `${it.nombre}: debe permitir al menos una orientación.`);
    if (it.paletizar && tarimas && !tarimas[it.palletId || 0]) p(id, "palletId", `${it.nombre}: la tarima elegida no existe.`);
  });

  if (!vehiculo) p(null, "vehiculo", "Falta el vehículo.");
  else {
    for (const campo of ["L", "W", "H"]) if (!positivo(vehiculo[campo])) p(null, `vehiculo.${campo}`, `Vehículo: la medida ${campo} debe ser mayor que 0.`);
    if (reglas?.limitarPeso && vehiculo.maxKg > 0 && vehiculo.maxKg - (vehiculo.tara || 0) <= 0)
      p(null, "vehiculo.maxKg", "Vehículo: el peso máximo debe ser mayor que la tara.");
  }

  (tarimas || []).forEach((t, i) => {
    if (!positivo(t.L) || !positivo(t.W)) p(null, `tarimas.${i}`, `Tarima ${t.nombre || i + 1}: largo y ancho deben ser mayores que 0.`);
    if (!positivo(t.altMax) || !noNegativo(t.esp) || t.altMax <= t.esp) p(null, `tarimas.${i}`, `Tarima ${t.nombre || i + 1}: la altura máxima debe ser mayor que el espesor.`);
  });

  if (!reglas) p(null, "reglas", "Faltan las reglas.");
  else {
    if (!esNum(reglas.soporteMin) || reglas.soporteMin < 0 || reglas.soporteMin > 100) p(null, "reglas.soporteMin", "El soporte mínimo debe estar entre 0 y 100 %.");
    if (![1, 2, 3, 4].includes(reglas.nivel)) p(null, "reglas.nivel", "El nivel de esfuerzo debe ser 1, 2, 3 o 4.");
  }
  return problemas;
}

// ---------- Normalización: de unidades de UI a lo que espera el motor ----------
export function prepararEntrada({ items, vehiculo, tarimas, reglas }) {
  return {
    // El motor identifica cada caja por su posición en este arreglo (idx). Se quitan los campos que solo son de UI.
    items: items.map(({ id, color, desc, ...x }) => x),
    veh: vehiculo,
    reglas: { ...reglas, soporteMin: reglas.soporteMin / 100 },
    pallets: tarimas || [],
  };
}

// ---------- Adaptadores (ejecutores) ----------
// Un ejecutor es: (entrada, { signal, onProgreso }) => Promise<resultado crudo del motor>

// Corre el motor en el mismo hilo. Para tests, o como último recurso.
export const ejecutorEnProceso = (optimizar) => async (entrada, { signal, onProgreso } = {}) => {
  if (signal?.aborted) throw new ErrorCorrida("cancelada", "Corrida cancelada.");
  return optimizar(entrada.items, entrada.veh, entrada.reglas, onProgreso || (() => {}), entrada.pallets);
};

// Corre el motor en un Web Worker propio. crearWorker debe devolver un Worker nuevo cada vez.
export const ejecutorWorker = (crearWorker) => (entrada, { signal, onProgreso } = {}) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ErrorCorrida("cancelada", "Corrida cancelada."));
    let worker;
    try { worker = crearWorker(); } catch (e) { return reject(new ErrorCorrida("motor", "No se pudo iniciar el motor.", { original: String(e) })); }
    const terminar = () => { worker.terminate(); signal?.removeEventListener("abort", cancelar); };
    const cancelar = () => { terminar(); reject(new ErrorCorrida("cancelada", "Corrida cancelada.")); };
    signal?.addEventListener("abort", cancelar);
    worker.onmessage = (e) => {
      const d = e.data;
      if (d.tipo === "progreso") onProgreso?.(d.i, d.n);
      else if (d.tipo === "fin") { terminar(); resolve(d.r); }
      else { terminar(); reject(new ErrorCorrida("motor", "El motor falló.", { original: d.msg })); }
    };
    worker.onerror = (e) => { terminar(); reject(new ErrorCorrida("motor", "El motor falló.", { original: e.message || String(e) })); };
    worker.postMessage(entrada);
  });

// ---------- La corrida ----------
export async function correr(carga, { ejecutor, signal, onProgreso } = {}) {
  if (!ejecutor) throw new Error("correr necesita un ejecutor.");
  const problemas = validarCarga(carga);
  if (problemas.length) throw new ErrorCorrida("entrada_invalida", "La carga tiene datos inválidos.", { problemas });
  if (signal?.aborted) throw new ErrorCorrida("cancelada", "Corrida cancelada.");
  const entrada = prepararEntrada(carga);
  let resultado;
  try {
    resultado = await ejecutor(entrada, { signal, onProgreso });
  } catch (e) {
    if (e instanceof ErrorCorrida) throw e;
    throw new ErrorCorrida("motor", "El motor falló.", { original: e?.message || String(e) });
  }
  // Se devuelve la carga tal cual entró: resultado.contenedores[].cajas[].idx apunta a carga.items[idx].
  return { resultado, carga };
}
