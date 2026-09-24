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

import { lineasBundle, repartirAbiertos, expandirBundles } from "../archivos/bundle.js";

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
    if (it.paletizar && tarimas && !tarimas[it.palletId || 0]) p(id, "palletId", `${it.nombre}: el pallet elegido no existe.`);
  });

  if (!vehiculo) p(null, "vehiculo", "Falta el vehículo.");
  else {
    for (const campo of ["L", "W", "H"]) if (!positivo(vehiculo[campo])) p(null, `vehiculo.${campo}`, `Vehículo: la medida ${campo} debe ser mayor que 0.`);
    if (reglas?.limitarPeso && vehiculo.maxKg > 0 && vehiculo.maxKg - (vehiculo.tara || 0) <= 0)
      p(null, "vehiculo.maxKg", "Vehículo: el peso máximo debe ser mayor que la tara.");
  }

  (tarimas || []).forEach((t, i) => {
    if (!positivo(t.L) || !positivo(t.W)) p(null, `tarimas.${i}`, `Pallet ${t.nombre || i + 1}: largo y ancho deben ser mayores que 0.`);
    if (!positivo(t.altMax) || !noNegativo(t.esp) || t.altMax <= t.esp) p(null, `tarimas.${i}`, `Pallet ${t.nombre || i + 1}: la altura máxima debe ser mayor que el espesor.`);
  });

  if (!reglas) p(null, "reglas", "Faltan las reglas.");
  else {
    if (!esNum(reglas.soporteMin) || reglas.soporteMin < 0 || reglas.soporteMin > 100) p(null, "reglas.soporteMin", "El soporte mínimo debe estar entre 0 y 100 %.");
    if (![1, 2, 3, 4].includes(reglas.nivel)) p(null, "reglas.nivel", "El nivel de esfuerzo debe ser 1, 2, 3 o 4.");
  }
  return problemas;
}

// ---------- Normalización: de unidades de UI a lo que espera el motor ----------
// Compresión por omisión según el empaque, en % de altura que cede la pieza de más abajo.
// Lo que decide es quién recibe el peso, no de qué está hecho el producto:
//   · Bolsa suelta (BL): la de abajo aguanta toda la columna y cede de verdad.
//   · Rollo (RL): viaja paletizado, así que el peso lo toma la tarima y no la pieza de abajo. No cede.
//   · Caja y demás: el cartón cede poco, y solo en columnas altas.
// El número es el que cede la pieza de MÁS ABAJO; hacia arriba va cediendo menos, así que la
// deformación promedio de la pila es cerca de la mitad del parámetro (BL 8% → ~4% promedio).
//
// A propósito NO están calibrados para reproducir la realidad al máximo. Comparando contra 1,185
// contenedores reales, subirlos deja menos casos "cortos", pero ese ajuste extra estaría tapando
// otras cosas con el nombre de compresión: que un estibador acomoda mejor que el algoritmo, y que
// algunos SKUs traen medidas mal capturadas (tres de ellos causaban más de la mitad de los casos
// geométricamente imposibles). Atribuirle eso al producto sería falso y, si el motor mejora,
// pasaría a prometer de más. Estos valores se sostienen como deformación física y nada más;
// el resto de la brecha queda a la vista, que es donde se puede trabajar de verdad.
export const COMPRESION_POR_OMISION = { BL: 4, PQ: 2, CJ: 0, CS: 0, CJM: 0, PAC: 0, BLT: 0, RL: 0 };

// Holgura entre bultos rígidos, en mm que se suman a lo largo y ancho de cada caja al buscarle
// lugar (el dibujo y el volumen usan la medida real). Con un solo SKU no hace falta: las cajas
// iguales encajan entre sí. Con variedad se pierde espacio, y crece con cuántos SKUs distintos
// lleva el contenedor. El tope es bajo a propósito: más allá de unos milímetros ya no sería una
// holgura física sino otra cosa, y no queremos que un número inventado se lea como si lo fuera.
// Las bolsas no llevan holgura: se amoldan y rellenan el hueco solas.
export const holguraPorMezcla = (nSkus) => Math.min(6, 2 * Math.max(0, nSkus - 1));

export function prepararEntrada({ items, vehiculo, tarimas, reglas }) {
  return {
    // El motor identifica cada caja por su posición en este arreglo (idx). Se quitan los campos que solo son de UI.
    // Compresión por omisión: a un SKU que no la tenga capturada se le aplica la de su empaque
    // (ver COMPRESION_POR_OMISION). Calibrada con 1,185 contenedores reales; se apaga con
    // reglas.compresionAuto = false, y cualquier valor capturado en el SKU manda sobre esto.
    items: (() => {
      const real = reglas.compresionAuto !== false;
      const holgura = real ? holguraPorMezcla(new Set(items.map((i) => String(i.nombre || "").trim().toUpperCase())).size) : 0;
      return items.map(({ id, color, desc, ...x }) => {
        if (!real) return x;
        const um = String(x.umCaja || "CJ").trim().toUpperCase();
        const y = { ...x };
        if (!(x.compresion > 0)) y.compresion = COMPRESION_POR_OMISION[um] ?? COMPRESION_POR_OMISION.CJ;
        if (holgura > 0 && um !== "BL") { y.L = x.L + holgura; y.W = x.W + holgura; }
        return y;
      });
    })(),
    veh: vehiculo,
    // "Simular la carga real" gobierna las tres cosas: cómo se rota, cuánto cede el producto y la holgura.
    reglas: { ...reglas, soporteMin: reglas.soporteMin / 100, cargaReal: reglas.compresionAuto !== false, rotarAlFinal: reglas.compresionAuto !== false },
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

// ---------- Corrida con Bundles ----------
// Igual que correr(), pero las líneas que van en Bundle se optimizan como en el andén: primero todos los
// Bundles completos y, solo si con eso se usa un vehículo más, se abren los MENOS Bundles posibles para que
// sus cajas sueltas llenen los huecos y la carga quepa en menos vehículos (ver archivos/bundle.js).
// La búsqueda de cuántos abrir se hace en nivel rápido; el resultado final, en el nivel pedido.
// El resultado lleva `bundles`: { lineas: [{ id, nombre, bundles, abiertos, cajasPorBundle }], abiertos, ahorro }.
export async function correrConBundles(carga, { ejecutor, signal, onProgreso, onFase } = {}) {
  const lineas = lineasBundle(carga.items);
  const con = (abiertos, reglas = carga.reglas) => correr({ ...carga, reglas, items: expandirBundles(carga.items, abiertos) }, { ejecutor, signal, onProgreso });
  const conInfo = (c, abiertos, ahorro = 0) => {
    if (lineas.length) c.resultado.bundles = { lineas: lineas.map((l) => ({ ...l, abiertos: abiertos[l.id] || 0 })), abiertos: Object.values(abiertos).reduce((a, b) => a + b, 0), ahorro };
    return c;
  };
  const base = await con({});
  const n0 = base.resultado.contenedores.length, total = lineas.reduce((a, l) => a + l.bundles, 0);
  if (!lineas.length || n0 < 2 || carga.reglas._maxContenedores) return conInfo(base, {});

  onFase?.("Probando abrir Bundles para usar menos vehículos…");
  const rapido = { ...carga.reglas, nivel: 1 };
  const usados = (c) => c.resultado.contenedores.length + (c.resultado.sinCargar > base.resultado.sinCargar ? 1000 : 0);
  const cuenta = async (k) => usados(await con(repartirAbiertos(lineas, k), rapido));
  const nRef = carga.reglas.nivel === 1 ? n0 : await cuenta(0);
  if ((await cuenta(total)) >= nRef) return conInfo(base, {});   // ni abriendo todos se ahorra un vehículo: no se abre ninguno
  let lo = 0, hi = total;
  while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if ((await cuenta(m)) < nRef) hi = m; else lo = m; }

  onFase?.("Calculando el acomodo final…");
  for (const k of [...new Set([hi, Math.min(total, Math.ceil(hi * 1.25)), total])]) {
    const abiertos = repartirAbiertos(lineas, k), c = await con(abiertos);
    if (usados(c) < n0) {
      const n = c.resultado.contenedores.length, detalle = lineas.filter((l) => abiertos[l.id]).map((l) => `${l.nombre}: ${abiertos[l.id]}`).join(", ");
      c.resultado.avisos = [...(c.resultado.avisos || []), `Para usar ${n} ${n === 1 ? "vehículo" : "vehículos"} en lugar de ${n0} se abren ${k} ${k === 1 ? "Bundle" : "Bundles"} (${detalle}); sus cajas van sueltas en los huecos.`];
      return conInfo(c, abiertos, n0 - n);
    }
  }
  return conInfo(base, {});
}
