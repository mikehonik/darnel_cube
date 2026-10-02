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

// Holgura entre bloques, en mm. Donde se pierde espacio al cargar no es entre cajas iguales (esas
// encajan solas y el estibador las arrima), sino en la junta entre un bloque y el de al lado: nadie
// deja dos bloques distintos pegados al milímetro. Por eso la holgura se le aplica al ENVOLVENTE del
// bloque al reservar su lugar (ver motor.js: actualizarEspacios), no al tamaño de cada caja: un
// bloque de 24 cajas a lo largo paga la holgura una vez, no 24 veces.
// Crece con cuántos SKUs distintos lleva el contenedor, porque más variedad son más juntas. El tope
// es bajo a propósito: más allá de unos milímetros ya no sería una holgura física sino otra cosa, y
// no queremos que un número inventado se lea como si lo fuera.
// El relleno final no la paga: ahí el estibador ya está metiendo piezas a presión donde quepan.
// El dibujo y el volumen siempre usan la medida real.
export const holguraPorMezcla = (nSkus) => Math.min(6, 2 * Math.max(0, nSkus - 1));

export function prepararEntrada({ items, vehiculo, tarimas, reglas }) {
  return {
    // El motor identifica cada caja por su posición en este arreglo (idx). Se quitan los campos que solo son de UI.
    // Compresión por omisión: a un SKU que no la tenga capturada se le aplica la de su empaque
    // (ver COMPRESION_POR_OMISION). Calibrada con 1,185 contenedores reales; se apaga con
    // reglas.compresionAuto = false, y cualquier valor capturado en el SKU manda sobre esto.
    items: items.map(({ id, color, desc, ...x }) => {
      if (reglas.compresionAuto === false) return x;
      const um = String(x.umCaja || "CJ").trim().toUpperCase();
      const y = { ...x };
      if (!(x.compresion > 0)) y.compresion = COMPRESION_POR_OMISION[um] ?? COMPRESION_POR_OMISION.CJ;
      return y;
    }),
    veh: vehiculo,
    // "Simular la carga real" gobierna las tres cosas: cómo se rota, cuánto cede el producto y la holgura.
    reglas: { ...reglas, soporteMin: reglas.soporteMin / 100, cargaReal: reglas.compresionAuto !== false, rotarAlFinal: reglas.compresionAuto !== false,
      holgura: reglas.compresionAuto === false ? 0 : holguraPorMezcla(new Set(items.map((i) => String(i.nombre || "").trim().toUpperCase())).size) },
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
// Igual que correr(), pero las líneas que van en Bundle se optimizan como en el andén (ver archivos/bundle.js):
//   1. Primero todos los Bundles completos; lo que no completa un Bundle va suelto.
//   2. Si con eso se ocupa un vehículo más, se abren los MENOS Bundles posibles para ahorrarlo.
//   3. Si no se ahorra ninguno, se prueba abrirlos para dejar el último vehículo lo más vacío posible: sus
//      cajas caben en los huecos de los anteriores, que es lo que pide el andén (llenar de verdad los que van).
// La búsqueda se hace en nivel rápido; el resultado final se calcula en el nivel pedido.
// El resultado lleva `bundles`: { lineas: [{ id, nombre, bundles, abiertos, cajasPorBundle }], abiertos, ahorro }.
// Abrir Bundles cuesta mano de obra en el andén, así que para «llenar» se exige una mejora clara y se abren
// los menos posibles que consigan casi toda esa mejora. Con reglas.abrirBundles se cambia la política:
//   "llenar" (por omisión): para ahorrar vehículo y también para dejar el último lo más vacío posible
//   "ahorrar": solo si se ahorra un vehículo completo   ·   "nunca": no se abre ninguno
const MEJORA_MINIMA = 0.85;   // el último vehículo debe quedar al menos 15% más vacío
const PARTE_DE_LA_MEJORA = 0.6;   // basta con conseguir el 60% de la mejora máxima

export async function correrConBundles(carga, { ejecutor, signal, onProgreso, onFase } = {}) {
  const lineas = lineasBundle(carga.items);
  const con = (abiertos, reglas = carga.reglas) => correr({ ...carga, reglas, items: expandirBundles(carga.items, abiertos) }, { ejecutor, signal, onProgreso });
  const conInfo = (c, abiertos, ahorro = 0) => {
    if (lineas.length) c.resultado.bundles = { lineas: lineas.map((l) => ({ ...l, abiertos: abiertos[l.id] || 0 })), abiertos: Object.values(abiertos).reduce((a, b) => a + b, 0), ahorro };
    return c;
  };
  const detalle = (abiertos) => lineas.filter((l) => abiertos[l.id]).map((l) => `${l.nombre}: ${abiertos[l.id]}`).join(", ");
  const base = await con({});
  const n0 = base.resultado.contenedores.length, total = lineas.reduce((a, l) => a + l.bundles, 0);
  const politica = carga.reglas.abrirBundles || "llenar";
  if (!lineas.length || n0 < 2 || carga.reglas._maxContenedores || politica === "nunca") return conInfo(base, {});

  // Cada k (cuántos Bundles se abren) se evalúa una sola vez: con pedidos grandes cada corrida cuesta segundos.
  const rapido = { ...carga.reglas, nivel: 1 };
  const usados = (c) => c.resultado.contenedores.length + (c.resultado.sinCargar > base.resultado.sinCargar ? 1000 : 0);
  const ultimo = (c) => (usados(c) > n0 ? Infinity : c.resultado.contenedores[c.resultado.contenedores.length - 1].vol);
  const memo = new Map(), memoReal = new Map();
  const evaluar = async (k) => {
    if (memo.has(k)) return memo.get(k);
    const c = await con(repartirAbiertos(lineas, k), rapido), r = { n: usados(c), cola: ultimo(c) };
    memo.set(k, r); return r;
  };

  // ----- Rematar: los Bundles que quedaron solos en el último vehículo -----
  // El caso más caro y más visible: el último vehículo va casi vacío y lo único que lleva son Bundles.
  // La búsqueda general no lo ve, porque reparte los abiertos en proporción entre TODAS las líneas y
  // nunca prueba «abre justamente estos dos». Así que se mira el resultado y, si el último vehículo es
  // puro Bundle, se abren esos y se recalcula. Se repite mientras siga ganando: cada pasada puede dejar
  // otra vez un último vehículo con un par de Bundles, que es exactamente lo que pasaba.
  const MAX_REMATES = 4;
  const rematar = async (c0, abiertos0) => {
    let c = c0, abiertos = abiertos0, aviso = null;
    for (let i = 0; i < MAX_REMATES; i++) {
      const n = c.resultado.contenedores.length;
      if (n < 2) break;
      const ult = c.resultado.contenedores[n - 1], its = c.carga.items, extra = {};
      let solo = ult.cajas.length > 0;
      ult.cajas.forEach((k) => {
        const it = its[k.idx];
        if (it && it.esBundle) extra[it.lineaId] = (extra[it.lineaId] || 0) + 1;
        else solo = false;
      });
      if (!solo || !Object.keys(extra).length) break;
      const prueba = { ...abiertos };
      Object.entries(extra).forEach(([id, k]) => { prueba[id] = (prueba[id] || 0) + k; });
      if (!i) onFase?.("Probando abrir los Bundles que quedaron solos en el último vehículo…");
      const c2 = await con(prueba);
      if (c2.resultado.contenedores.length >= n || (c2.resultado.sinCargar || 0) > (c.resultado.sinCargar || 0)) break;
      const k2 = Object.values(extra).reduce((a, b) => a + b, 0), n2 = c2.resultado.contenedores.length;
      aviso = `El último vehículo llevaba solo ${k2} ${k2 === 1 ? "Bundle" : "Bundles"} (${detalle(extra)}). Abriéndolos la carga entra en ${n2} ${n2 === 1 ? "vehículo" : "vehículos"}: sus cajas van sueltas en los huecos.`;
      c = c2; abiertos = prueba;
    }
    if (aviso) c.resultado.avisos = [...(c.resultado.avisos || []), aviso];
    return { c, abiertos, gano: c !== c0 };
  };
  {
    const r = await rematar(base, {});
    if (r.gano) return conInfo(r.c, r.abiertos, n0 - r.c.resultado.contenedores.length);
  }

  // ----- Usar un vehículo menos -----
  // La búsqueda se hace en nivel rápido porque son decenas de corridas. El riesgo es que el nivel rápido
  // empaca peor: puede decir «ni abriendo todos se ahorra un vehículo» cuando en el nivel de verdad sí.
  // Por eso, si el rápido dice que no pero el último vehículo va casi vacío (que es cuando esto importa),
  // se comprueba una vez al nivel configurado antes de rendirse. Vale la corrida: es un camión.
  onFase?.("Probando abrir Bundles para usar menos vehículos…");
  const nRef = carga.reglas.nivel === 1 ? n0 : (await evaluar(0)).n;
  const COLA_QUE_VALE_COMPROBAR = 0.45;   // el último vehículo por debajo de este llenado
  let valeBuscar = (await evaluar(total)).n < nRef, enSerio = false;
  if (!valeBuscar && carga.reglas.nivel > 1) {
    const volVeh = carga.vehiculo.L * carga.vehiculo.W * carga.vehiculo.H;
    if (base.resultado.contenedores[n0 - 1].vol / volVeh < COLA_QUE_VALE_COMPROBAR) {
      onFase?.("Comprobando a fondo si abriendo Bundles se ahorra un vehículo…");
      const todo = await con(repartirAbiertos(lineas, total));
      if (usados(todo) < n0) { valeBuscar = true; enSerio = true; memoReal.set(total, usados(todo)); }
    }
  }
  if (valeBuscar) {
    // En serio: la búsqueda del mínimo también al nivel configurado, si no volveríamos a creerle al rápido
    const nDe = async (k) => {
      if (!enSerio) return (await evaluar(k)).n;
      if (memoReal.has(k)) return memoReal.get(k);
      const n = usados(await con(repartirAbiertos(lineas, k)));
      memoReal.set(k, n); return n;
    };
    let lo = 0, hi = total;
    while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (await nDe(m) < (enSerio ? n0 : nRef)) hi = m; else lo = m; }
    onFase?.("Calculando el acomodo final…");
    for (const k of [...new Set([hi, Math.min(total, Math.ceil(hi * 1.25)), total])]) {
      const abiertos = repartirAbiertos(lineas, k), c = await con(abiertos);
      if (usados(c) < n0) {
        const n = c.resultado.contenedores.length;
        c.resultado.avisos = [...(c.resultado.avisos || []), `Para usar ${n} ${n === 1 ? "vehículo" : "vehículos"} en lugar de ${n0} se abren ${k} ${k === 1 ? "Bundle" : "Bundles"} (${detalle(abiertos)}); sus cajas van sueltas en los huecos.`];
        const r = await rematar(c, abiertos);
        return conInfo(r.c, r.abiertos, n0 - r.c.resultado.contenedores.length);
      }
    }
  }

  // ----- Llenar mejor los vehículos que sí van (dejar el último lo más vacío posible) -----
  if (politica !== "llenar") return conInfo(base, {});
  onFase?.("Probando abrir Bundles para llenar mejor…");
  const colaBase = (await evaluar(0)).cola;
  let mejor = 0, mejorCola = colaBase;
  for (const k of [Math.max(1, Math.round(total / 2)), total]) {
    const r = await evaluar(k);
    if (r.n <= n0 && r.cola < mejorCola) { mejor = k; mejorCola = r.cola; }
  }
  if (!mejor || mejorCola > colaBase * MEJORA_MINIMA) return conInfo(base, {});
  // Con los menos Bundles que conserven casi toda la mejora (abrir cuesta mano de obra)
  const objetivo = colaBase - (colaBase - mejorCola) * PARTE_DE_LA_MEJORA;
  let lo = 0, hi = mejor;
  while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); const r = await evaluar(m); if (r.n <= n0 && r.cola <= objetivo) hi = m; else lo = m; }

  onFase?.("Calculando el acomodo final…");
  const abiertos = repartirAbiertos(lineas, hi), c = await con(abiertos);
  if (usados(c) > n0 || ultimo(c) >= colaBase * MEJORA_MINIMA) return conInfo(base, {});
  const pct = (1 - ultimo(c) / colaBase) * 100;
  c.resultado.avisos = [...(c.resultado.avisos || []), `Se abren ${hi} ${hi === 1 ? "Bundle" : "Bundles"} (${detalle(abiertos)}) para aprovechar los huecos: el último vehículo queda ${pct.toFixed(0)}% más vacío y los demás van más llenos.`];
  // Llenar deja muchas veces un último vehículo con dos o tres Bundles sueltos: ese es el caso que se
  // remata, y es el que hacía que una carga de 85% saliera en dos vehículos por un par de bultos.
  const fin = await rematar(c, abiertos);
  return conInfo(fin.c, fin.abiertos, n0 - fin.c.resultado.contenedores.length);
}
