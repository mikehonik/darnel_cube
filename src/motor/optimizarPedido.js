// ================= Optimizar el pedido =================
// Las dos preguntas que se hace el planeador al ver el resultado, contestadas sobre el mismo pedido:
//   · «Llenar con pedido sugerido»: sobra espacio, ¿cuánto más de estos mismos SKUs cabe sin sumar vehículos?
//   · «Sugerir disminución»: salió un vehículo casi vacío. Primero se prueba reacomodar (nivel máximo, abriendo
//     Bundles si hace falta) sin tocar cantidades; solo si no alcanza, se sugiere qué bajar para usar uno menos.
// Nunca se sugiere un SKU que no esté en el pedido, y las líneas marcadas como fijas no se tocan.
// Todo se comprueba con una corrida real antes de proponerlo: lo que se ve en la vista previa es lo que queda.
//
// Quien llama pasa cómo correr (así esto no sabe de Workers ni de React):
//   correrPedido(itemsDelPedido)  → corrida del pedido completo, en el nivel de la optimización. Durante la
//     búsqueda NO se rehace la apertura de Bundles: cada corrida cuesta segundos y la búsqueda hace decenas.
//   correrFinal(itemsDelPedido)   → la corrida que se le muestra al usuario, ya con la política de Bundles
//   correrCarga(itemsDelMotor, maxVehiculos) → corrida de una lista ya lista para el motor (sin optimizar
//     Bundles). maxVehiculos topa cuántos puede usar: el relleno se ofrece «sin límite» para que el motor
//     meta lo que quepa en los huecos, y sin tope abría vehículos nuevos y seguía acomodando miles de
//     cajas que después se descartan. En el ejemplo de 3 entregas esa sola corrida costaba 30 de los 35
//     segundos del llenado.

import { tieneBundle, cajasPorBundle } from "../archivos/bundle.js";

// Cajas por línea del pedido dentro de un vehículo (sueltas y el contenido de sus pallets; un Bundle cuenta sus cajas)
export function cajasPorLinea(corrida, iCont, soloRelleno = false) {
  const { resultado: r, carga } = corrida, cuenta = new Map(), cont = r.contenedores[iCont];
  if (!cont) return cuenta;
  const sumar = (k) => {
    if (soloRelleno !== !!k.relleno) return;
    const it = carga.items[k.idx]; if (!it) return;
    const id = it.lineaId ?? it.id;
    cuenta.set(id, (cuenta.get(id) || 0) + (it.esBundle ? it.cantidadPorBundle || 1 : 1));
  };
  cont.cajas.forEach((k) => { if (k.pal >= 0) (r.pallets[k.pal]?.cajas || []).forEach(sumar); else sumar(k); });
  return cuenta;
}

const resumen = (c) => {
  const v = c.carga.vehiculo, volV = v.L * v.W * v.H;
  return { n: c.resultado.contenedores.length, sinCargar: c.resultado.sinCargar, ocupaciones: c.resultado.contenedores.map((k) => (volV ? (k.vol / volV) * 100 : 0)) };
};
// Cuántas corridas se gastan comprobando la sugerencia. Cada una cuesta hasta medio minuto en nivel 4.
const INTENTOS_COMPROBAR = 5, INTENTOS_RAPIDO = 2;
// Cuánto del hueco se le ofrece a CADA SKU como relleno. Probé repartirlo entre los SKUs para darle menos
// candidatos al motor: en una carga de 15 SKUs mejoró mucho (57% → 90%) y en otra de 6 empeoró igual de
// feo (87% → 55%). El número no manda; lo que manda es lo caprichoso del acomodo. Con una ronda más de
// relleno las dos llegan al 87% con el valor de siempre, así que se queda en 1.5 y la velocidad sale de
// hacer menos corridas, no de adivinar esta constante. Exportado para poder medirlo.
export let REPARTO_RELLENO = () => 1.5;
export const _setReparto = (f) => { REPARTO_RELLENO = f; };
// Saturar: cuántas corridas más se gastan comprobando que de verdad no cabe ni una caja más. Es caro,
// pero es la diferencia entre proponer un llenado y poder sostenerlo cuando el planeador agrega una a mano.
// El tope real es el reloj, no el número de corridas: en un pedido chico una corrida son 2 segundos y en
// uno de 32 SKUs son 25, así que un presupuesto fijo de corridas satura el chico y deja a medias el grande.
// Si se acaba el tiempo, la sugerencia dice que no se alcanzó a comprobar; nunca promete que está llena.
const PRESUPUESTO_SATURAR = 60, MS_SATURAR = 180000, RONDAS_RELLENO = 4, RONDAS_RAPIDAS = 3, PASADAS_FINAS = 4;
const HUECO_QUE_VALE_OTRA_RONDA = 0.10;   // 10% del vehículo libre
const porIdItem = (items, id) => items.find((x) => x.id === id);

// Por qué no cabe nada. Que sobre volumen no quiere decir que quepa otra caja: una caja de 400 mm de alto
// en un vehículo de 2,700 deja 300 mm muertos arriba, y eso solo son ya 11 puntos de ocupación que nunca
// se van a usar. Decirlo convierte un «no» en información que el comercial puede usar (cambiar de empaque,
// pedir otro vehículo, aceptar el número). Se mide el sobrante de la envolvente de la carga en cada eje y
// se compara con la medida más chica de las cajas del pedido.
export function porQueNoCabe(corrida, candidatos) {
  const v = corrida.carga.vehiculo, r = corrida.resultado;
  const defs = r.pallets || [];
  let mx = 0, my = 0, mz = 0;
  r.contenedores.forEach((k) => k.cajas.forEach((c) => {
    const d = c.pal >= 0 ? defs[c.pal] : null;
    const l = d ? (c.rot ? d.palW : d.palL) : c.l, w = d ? (c.rot ? d.palL : d.palW) : c.w, h = d ? d.alto : c.h;
    mx = Math.max(mx, c.x + l); my = Math.max(my, c.y + w); mz = Math.max(mz, c.z + h);
  }));
  const menor = candidatos.reduce((a, it) => Math.min(a, it.L, it.W, it.H), Infinity);
  const sobra = { L: Math.max(0, v.L - mx), W: Math.max(0, v.W - my), H: Math.max(0, v.H - mz) };
  const ejes = [["de fondo", sobra.L], ["de ancho", sobra.W], ["de alto", sobra.H]].filter(([, x]) => x >= 1);
  return { sobra, menor: Number.isFinite(menor) ? menor : 0, ejes: ejes.sort((a, b) => b[1] - a[1]) };
}
const cabeIgual = (c, ref) => c.resultado.contenedores.length <= ref.resultado.contenedores.length && c.resultado.sinCargar <= ref.resultado.sinCargar;

// Suma cantidades al pedido. Lo extra de una línea paletizada entra como línea suelta aparte (el relleno se
// calculó suelto: sumado a la línea paletizada, el motor lo armaría en pallets y ya no cabría igual).
export function sumarAlPedido(items, deltas) {
  let lista = items.map((it) => ({ ...it }));
  deltas.forEach((d, id) => {
    if (!(d > 0)) return;
    const it = lista.find((x) => x.id === id); if (!it) return;
    if (!it.paletizar) { it.qty += d; return; }
    const extra = lista.find((x) => x.extraDe === id);
    if (extra) extra.qty += d;
    else lista.push({ ...it, id: `${id}-extra`, extraDe: id, qty: d, paletizar: false, enBundle: false });
  });
  return lista;
}
export function restarAlPedido(items, deltas) {
  return items.map((it) => (deltas.has(it.id) ? { ...it, qty: Math.max(0, it.qty - deltas.get(it.id)) } : it)).filter((it) => it.qty > 0);
}
const cambiosEntre = (antes, despues) => {
  const porId = new Map(despues.map((it) => [it.id, it])), cambios = [];
  antes.forEach((it) => { const d = porId.get(it.id); const nuevo = (d?.qty || 0) + despues.filter((x) => x.extraDe === it.id).reduce((a, x) => a + x.qty, 0); if (nuevo !== it.qty) cambios.push({ id: it.id, nombre: it.nombre, umCaja: it.umCaja, actual: it.qty, nuevo, delta: nuevo - it.qty }); });
  return cambios;
};

// ---------- Llenar con pedido sugerido ----------
// Primero se agranda el pedido completo en la misma proporción (se conserva el mix que pidió el cliente) hasta
// donde quepa sin sumar vehículos; después, los huecos que queden se llenan con lo que mejor entre.
// correrRapido (opcional) se usa para esa búsqueda de proporción; el resultado siempre se comprueba con correrPedido.
// nActual: los vehículos que el usuario tiene EN PANTALLA. No es lo mismo que los de `ref`: la búsqueda
// corre con abrirBundles "nunca" (rehacer la apertura en cada corrida costaría minutos), así que su
// referencia puede salir en 2 vehículos cuando la pantalla muestra 1 porque allá sí se abrieron Bundles.
// Sin este tope, llenar se comparaba contra su propia referencia y proponía llenar DOS vehículos cuando
// el usuario tenía uno: para él eso no es llenar, es sumar un camión.
// saturar: si se exprime hasta que no quepa ni una caja más de ninguna referencia. Esa comprobación son
// decenas de corridas y es lo que vuelve lenta la herramienta, así que por omisión NO se hace: el primer
// llenado sale en segundos y es una base sobre la que el comercial ya puede trabajar. Cuando esa base le
// sirve y quiere exprimirla, se vuelve a pedir con saturar: true («Llenar hasta el tope»). Una propuesta
// sin saturar nunca dice que está llena: viene marcada con `rapido: true` y la tarjeta lo advierte.
export async function sugerirLlenado({ items, nActual = Infinity, saturar = false, correrPedido, correrCarga, correrRapido = correrPedido, correrFinal = correrPedido, fijas = new Set(), onFase }) {
  onFase?.("Calculando el pedido actual en nivel máximo…");
  const ref = await correrPedido(items);
  const tope = Math.min(nActual, ref.resultado.contenedores.length);
  const candidatos = items.filter((it) => it.qty > 0 && !fijas.has(it.id) && !it.fijo && !it.extraDe);
  if (!candidatos.length) return { tipo: "llenar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, motivo: "sinCandidatos" };
  const esCandidato = new Set(candidatos.map((it) => it.id));
  // Una línea en Bundle crece de Bundle en Bundle: media caja suelta de más no la pide nadie
  const paso = (it) => (it.enBundle && tieneBundle(it) ? cajasPorBundle(it) : 1);
  const aPaso = (it, n) => Math.floor(n / paso(it)) * paso(it);
  const escalar = (f) => items.map((it) => (esCandidato.has(it.id) ? { ...it, qty: Math.max(it.qty, aPaso(it, Math.floor(it.qty * f))) } : it));
  // Crecer el pedido en proporción conserva el mix que pidió el cliente, pero cuesta seis corridas y el
  // relleno llega a lo mismo en dos. En la base rápida se salta: lo que importa ahí es dar un número en
  // segundos. Al exprimir sí se hace, porque ahí el mix sí vale las corridas.
  let proporcional = items, refProp = ref;
  if (saturar) {
    onFase?.("Agrandando el pedido en la misma proporción…");
    const ocup = resumen(ref).ocupaciones, ultima = ocup[ocup.length - 1] || 100;
    let lo = 1, hi = Math.min(20, Math.max(1.05, 100 / Math.max(1, ultima)) * (ocup.length > 1 ? 1 : 1.1));
    for (let i = 0; i < 5 && hi / lo > 1.02; i++) {
      const m = (lo + hi) / 2, c = await correrRapido(escalar(m));
      if (cabeIgual(c, ref)) lo = m; else hi = m;
    }
    if (lo > 1.005) proporcional = escalar(lo);
    if (proporcional !== items) {
      const c = await correrPedido(proporcional);
      if (cabeIgual(c, ref)) refProp = c; else proporcional = items;
    }
  }
  onFase?.("Llenando los huecos que quedan…");
  const base = refProp.carga.items;
  // El relleno se ofrece "ilimitado", pero pedir 500,000 cajas hace que el motor las intente una por una:
  // basta con las que caben en el hueco que quedó, con holgura.
  const vb = refProp.carga.vehiculo, volV = vb.L * vb.W * vb.H;
  const libre = refProp.resultado.contenedores.reduce((a, k) => a + Math.max(0, volV - k.vol), 0);
  // Las líneas de relleno: los mismos SKUs del pedido, sueltos y «sin límite», para que el motor meta
  // cuantos quepan en los huecos. Se arma aparte porque las rondas de saturación lo vuelven a usar.
  // Cuántas cajas de relleno se le ofrecen al motor. Antes se le daba a CADA SKU para llenar 1.5 veces el
  // hueco él solo, así que con 6 SKUs entraban nueve veces el hueco en candidatos y el motor los probaba
  // uno por uno: esa sola corrida se llevaba 30 de los 35 segundos del llenado. Ahora el total ofrecido
  // ronda vez y media el hueco, repartido, con un piso por SKU para que ninguno quede sin oportunidad.
  // Ofrecer de menos solo hace que la base rápida sea un poco conservadora, y para eso está exprimir.
  const rellenoPara = (hueco) => {
    const reparto = REPARTO_RELLENO(candidatos.length);
    const caben = (d) => Math.min(500000, Math.max(30, Math.ceil((hueco * reparto) / Math.max(1, d.L * d.W * d.H)) + 10));
    return candidatos.map((it) => {
      const comun = { ...it, id: `rel-${it.id}`, lineaId: it.id, esRelleno: true, paletizar: false, enBundle: false };
      if (!(it.enBundle && tieneBundle(it))) return { ...comun, qty: caben(it) };
      const c = cajasPorBundle(it);
      return { ...comun, qty: caben({ L: it.bundleL, W: it.bundleW, H: it.bundleH }), L: it.bundleL, W: it.bundleW, H: it.bundleH,
        peso: it.bundlePeso > 0 ? it.bundlePeso : (it.peso || 0) * c, umCaja: "BDL", piezas: (it.piezas || 1) * c,
        porPallet: 0, porCapa: 0, capasPallet: 0, anidado: 0, maxAnidado: 0, forma: "caja", diametro: 0,
        esBundle: true, cantidadPorBundle: c };   // cajasPorLinea ya cuenta las cajas que trae cada Bundle
    });
  };
  const relleno = rellenoPara(libre);
  const conRelleno = await correrCarga([...base, ...relleno], refProp.resultado.contenedores.length);
  const deltas = new Map();
  // Solo cuenta el relleno que cayó en los vehículos QUE YA IBAN. La corrida de relleno no tiene tope de
  // vehículos, así que con un hueco chico se desborda y abre uno nuevo para el relleno sobrante; ese
  // sobrante no es «lo que cabe», es un vehículo más. Contarlo era el origen de «se encontró espacio, pero
  // al recalcular la carga ya no cupo igual»: en un pedido real de 32 SKUs proponía 24,428 cajas, de las
  // cuales 23,896 estaban en un segundo vehículo inventado. Ningún factor de la comprobación podía salvar eso.
  const nVehiculos = refProp.resultado.contenedores.length;
  conRelleno.resultado.contenedores.forEach((_, i) => { if (i >= nVehiculos) return; cajasPorLinea(conRelleno, i, true).forEach((n, id) => deltas.set(id, (deltas.get(id) || 0) + n)); });
  proporcional.forEach((it) => { const o = items.find((x) => x.id === it.id); if (o && it.qty > o.qty) deltas.set(it.id, (deltas.get(it.id) || 0) + it.qty - o.qty); });
  if (!deltas.size) return { tipo: "llenar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, motivo: "noCabeMas", porQue: porQueNoCabe(ref, candidatos) };
  // Se comprueba con el pedido real. Si el acomodo no reproduce el relleno, se busca por bisección la
  // cantidad más grande que SÍ se comprueba, en vez de bajar 20% cuatro veces y rendirse: esa escalera
  // nunca probaba por debajo del 51%, así que devolvía «no cabe nada» cuando el 30% sí cabía. Y el cero
  // siempre cabe, así que la bisección tiene piso: la respuesta puede ser pequeña, pero nunca es vacía
  // por habérsele acabado los intentos.
  const porId = new Map(items.map((it) => [it.id, it]));
  const listaCon = (factor) => {
    const escalado = new Map([...deltas].map(([id, n]) => [id, aPaso(porId.get(id) || {}, Math.floor(n * factor))]).filter(([, n]) => n > 0));
    return escalado.size ? sumarAlPedido(items, escalado) : null;
  };
  // El piso de la bisección: una sola unidad de la línea más chica. Si ni eso cabe, de verdad no cabe
  // nada; pero el andén sí notaba la diferencia entre «no cabe nada» y «cabe una caja más», porque
  // sumando una a mano veía que seguía en el mismo contenedor. La bisección por factores no puede llegar
  // ahí: con 2,000 cajas de propuesta, el factor más chico que prueba ya son más de cien.
  // TODAS las líneas que se pueden aumentar, de la más chica a la más grande. Tomar solo las que el
  // relleno propuso dejaba fuera justamente a las que el relleno no alcanzó a acomodar, que son las que
  // después entran de a una a mano: así quedaba una referencia admitiendo más y la carga no estaba llena.
  const porVolumen = candidatos.slice().sort((a, b) => a.L * a.W * a.H - b.L * b.W * b.H);
  const minima = () => { const it = porVolumen[0]; return it ? sumarAlPedido(items, new Map([[it.id, paso(it)]])) : null; };
  let lo2 = 0, hi2 = 1, mejor = null;
  const intentos = saturar ? INTENTOS_COMPROBAR : INTENTOS_RAPIDO;
  for (let intento = 0; intento < intentos && hi2 - lo2 > 0.06; intento++) {
    const f = intento === 0 ? 1 : (lo2 + hi2) / 2;
    const nuevos = listaCon(f);
    if (!nuevos) break;
    onFase?.(intento ? "Ajustando la sugerencia para que quepa…" : "Comprobando la sugerencia…");
    const c = await correrPedido(nuevos);
    if (cabeIgual(c, ref)) { mejor = nuevos; lo2 = f; if (f === 1) break; } else hi2 = f;
  }
  if (!mejor) {
    // Antes de rendirse: ¿cabe aunque sea una unidad más?
    const una = minima();
    if (una) {
      onFase?.("Probando si cabe aunque sea una unidad más…");
      const c = await correrPedido(una);
      if (cabeIgual(c, ref)) { mejor = una; lo2 = 0; }
    }
  }
  if (!mejor) return { tipo: "llenar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, motivo: "noSeComprobo" };

  // ---------- Saturar ----------
  // Llenar quiere decir que NO CABE NI UNA CAJA MÁS DE NINGUNA REFERENCIA. Si el planeador aplica la
  // propuesta, agrega una caja a mano y no se va otro vehículo, la propuesta no estaba llena, y entonces
  // tampoco se le puede creer el resto. Así que no basta con que la cantidad propuesta se compruebe:
  // hay que seguir empujando hasta que el motor diga que no, referencia por referencia. Esa es
  // literalmente la prueba que hace él, así que es la que hace la herramienta.
  // Dos etapas, de lo grueso a lo fino:
  //   1. Rondas de relleno sobre la propuesta ya comprobada: cada ronda mete muchas cajas de un golpe.
  //   2. Pasada final de una unidad por referencia (un Bundle en las líneas que van en Bundle), que es
  //      el paso más chico que alguien pediría de verdad. Se insiste en la misma línea mientras acepte.
  // Con presupuesto de corridas, porque cada una cuesta hasta medio minuto. Si se acaba antes de que el
  // motor diga que no a todas, la sugerencia NO promete estar llena: lo dice (`saturado: false`).
  let corridas = 0, saturadoRondas = true;
  const hasta = Date.now() + MS_SATURAR;
  const presupuesto = () => corridas < PRESUPUESTO_SATURAR && Date.now() < hasta;
  const cabeAsi = async (lista) => { corridas++; return cabeIgual(await correrPedido(lista), ref); };

  // Rondas de relleno también en la base rápida. Con una sola, un vehículo que iba al 34% quedaba al 63%
  // y el usuario tenía que volver a pedir llenado una y otra vez: una rueda de hámster. Cada ronda se
  // mide sobre el acomodo nuevo, que cambia al meter cajas, y por eso encuentra más. Son corridas de
  // nivel rápido y además se cortan solas en cuanto el vehículo queda casi lleno (ver
  // HUECO_QUE_VALE_OTRA_RONDA), así que una carga que ya venía al 86% no paga ninguna.
  const rondas = saturar ? RONDAS_RELLENO : RONDAS_RAPIDAS;
  for (let ronda = 0; ronda < rondas && presupuesto(); ronda++) {
    onFase?.("Buscando si todavía queda hueco…");
    corridas++;
    const act = await correrPedido(mejor);
    const nAct = act.resultado.contenedores.length;
    const libreAct = act.resultado.contenedores.reduce((a, k) => a + Math.max(0, volV - k.vol), 0);
    if (libreAct <= 0) break;
    // En la base rápida la ronda extra solo vale si todavía quedó hueco de verdad. Cuando el primer
    // relleno ya dejó los vehículos casi llenos, repetir cuesta el doble de tiempo para ganar un punto;
    // cuando los dejó a la mitad (pasa cuando el acomodo cambia mucho al meter cajas), es lo que lleva
    // de 57% a 87%. Medido: con el corte, una carga de 32 SKUs baja de 56 a 17 segundos y pierde 0.8 puntos.
    if (!saturar && libreAct < HUECO_QUE_VALE_OTRA_RONDA * nAct * volV) break;
    const relleno2 = rellenoPara(libreAct);
    corridas++;
    const con2 = await correrCarga([...act.carga.items, ...relleno2], nAct);
    const extra = new Map();
    con2.resultado.contenedores.forEach((_, i) => { if (i >= nAct) return; cajasPorLinea(con2, i, true).forEach((n, id) => extra.set(id, (extra.get(id) || 0) + n)); });
    const porPaso = new Map([...extra].map(([id, n]) => [id, aPaso(porId.get(id) || {}, n)]).filter(([, n]) => n > 0));
    if (!porPaso.size) break;
    onFase?.("Comprobando lo que todavía cabe…");
    // Si lo que propuso el relleno no se comprueba, se prueba la mitad antes de rendirse. Rendirse en el
    // primer no era lo que dejaba la base corta: un vehículo al 34% quedaba al 63% y el usuario tenía que
    // volver a pedir llenado cuatro o cinco veces. Media ronda cuesta una corrida y casi siempre sí pasa.
    let puso = false;
    for (const f of [1, 0.5]) {
      const esc = new Map([...porPaso].map(([id, k]) => [id, aPaso(porId.get(id) || {}, Math.floor(k * f))]).filter(([, k]) => k > 0));
      if (!esc.size) continue;
      const cand = sumarAlPedido(mejor, esc);
      if (await cabeAsi(cand)) { mejor = cand; puso = true; break; }
      if (!presupuesto()) break;
    }
    if (!puso) break;
    if (!presupuesto()) { saturadoRondas = false; break; }
  }

  // Pasada fina, referencia por referencia. De a una caja sería eterno en las líneas que admiten muchas
  // (un pallet a medias se traga veinte sin pedir más piso), así que se duplica mientras quepa y se
  // reparte a la mitad cuando deja de caber, hasta el paso mínimo. Ese último «no» al paso mínimo es la
  // prueba que importa: ni una caja más de esa referencia. Son unas pocas corridas por línea en vez de una
  // por caja. Una línea que ya dijo que no, no se vuelve a probar: agregar de otras solo quita espacio.
  if (!saturar) {
    onFase?.("Calculando el resultado final…");
    const f0 = await correrFinal(mejor);
    if (f0.resultado.contenedores.length <= tope)
      return { tipo: "llenar", cambios: cambiosEntre(items, mejor), antes: resumen(ref), despues: resumen(f0), corrida: f0, items: mejor, saturado: false, rapido: true };
    return { tipo: "llenar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, motivo: "sumabaVehiculo" };
  }

  // Se repite la pasada completa hasta que una entera no agregue nada. Hace falta: el acomodo es
  // heurístico, así que meter cajas de una referencia cambia el orden y a veces deja el conjunto MEJOR
  // acomodado, con hueco donde antes no cabía. Saturar con una sola pasada dejaba referencias que, al
  // volver a probarlas, sí entraban, que es exactamente lo que el andén descubre agregando a mano.
  let saturado = saturadoRondas, cambio = true, pasada = 0;
  while (cambio && pasada < PASADAS_FINAS && saturado) {
    cambio = false; pasada++;
    for (const it of porVolumen) {
      const min = paso(it);
      let k = min, aceptado = 0;
      while (k >= min) {
        if (!presupuesto()) { saturado = false; break; }
        onFase?.(`Probando si cabe más de ${it.nombre}…`);
        const cand = sumarAlPedido(mejor, new Map([[it.id, aceptado + k]]));
        if (await cabeAsi(cand)) { aceptado += k; k *= 2; }
        else k = Math.floor(k / (2 * min)) * min;
      }
      if (aceptado) { mejor = sumarAlPedido(mejor, new Map([[it.id, aceptado]])); cambio = true; }
      if (!saturado) break;
    }
  }
  if (cambio) saturado = false;   // la última pasada todavía metió cajas: no se puede prometer que esté lleno

  onFase?.("Calculando el resultado final…");
  let f = await correrFinal(mejor);
  // El que manda es el resultado final, no la corrida de búsqueda: si ahí se pasa del tope, se recorta.
  for (let i = 0; i < 3 && f.resultado.contenedores.length > tope; i++) {
    hi2 = lo2; lo2 = lo2 / 2;
    const menos = listaCon(lo2) || minima();
    if (!menos) { mejor = null; break; }
    saturado = false;   // se recortó: ya no se puede prometer que esté lleno
    onFase?.("Ajustando la sugerencia para que no sume un vehículo…");
    mejor = menos; f = await correrFinal(menos);
  }
  if (mejor && f.resultado.contenedores.length <= tope)
    return { tipo: "llenar", cambios: cambiosEntre(items, mejor), antes: resumen(ref), despues: resumen(f), corrida: f, items: mejor, saturado };
  return { tipo: "llenar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, motivo: "sumabaVehiculo" };
}

// ---------- Sugerir disminución del pedido ----------
export async function sugerirDisminucion({ items, nActual, correrPedido, correrFinal = correrPedido, fijas = new Set(), onFase }) {
  onFase?.("Probando reacomodar en nivel máximo, sin cambiar cantidades…");
  const ref = await correrPedido(items);
  if (ref.resultado.contenedores.length < nActual) return { tipo: "reacomodo", cambios: [], antes: { n: nActual }, despues: resumen(ref), corrida: ref, items, logrado: true };
  const objetivo = ref.resultado.contenedores.length - 1;
  if (objetivo < 1) return { tipo: "reducir", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, logrado: false };
  let actual = ref, lista = items;
  for (let intento = 0; intento < 4; intento++) {
    onFase?.(intento ? "Ajustando la disminución…" : "Calculando qué bajar para usar un vehículo menos…");
    const ultimo = actual.resultado.contenedores.length - 1;
    const quitar = new Map([...cajasPorLinea(actual, ultimo)].filter(([id]) => !fijas.has(id) && lista.some((it) => it.id === id && !it.fijo)));
    if (!quitar.size) break;
    lista = restarAlPedido(lista, quitar);
    if (!lista.length) break;
    actual = await correrPedido(lista);
    if (actual.resultado.contenedores.length <= objetivo && actual.resultado.sinCargar <= ref.resultado.sinCargar) {
      onFase?.("Calculando el resultado final…");
      const f = await correrFinal(lista);
      return { tipo: "reducir", cambios: cambiosEntre(items, lista), antes: resumen(ref), despues: resumen(f), corrida: f, items: lista, logrado: true };
    }
  }
  return { tipo: "reducir", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, logrado: false };
}

// ---------- Sugerir qué SKU dejar sin paletizar ----------
// Tercera pregunta del planeador, y la que más veces decide el camión: salió un vehículo de más, pero no
// por cómo se acomodó sino por QUÉ se paletizó. Un pallet cobra su deck y el aire que queda sobre la torre;
// ese mismo SKU suelto rellena los huecos de los demás. Medido en tres pedidos reales de Darnel: dejar UN
// SKU suelto ahorró el vehículo en los tres, y no siempre el mismo (conviene el que menos Bundles obligue
// a abrir después). Se prueba uno por uno, que son pocas corridas: una por SKU paletizado.
export async function sugerirSinPaletizar({ items, correrPedido, correrFinal = correrPedido, fijas = new Set(), onFase }) {
  const ref = await correrPedido(items);
  const n0 = ref.resultado.contenedores.length;
  const candidatos = items.filter((it) => it.paletizar && it.qty > 0 && !it.fijo && !fijas.has(it.id));
  if (n0 < 2 || !candidatos.length) return { tipo: "sinPaletizar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, opciones: [], motivo: n0 < 2 ? "cabeIgual" : "sinCandidatos" };

  const opciones = [];
  for (let i = 0; i < candidatos.length; i++) {
    const it = candidatos[i];
    onFase?.(`Probando con ${it.nombre} sin paletizar…`);
    const lista = items.map((x) => (x.id === it.id ? { ...x, paletizar: false } : x));
    const c = await correrPedido(lista);
    if (c.resultado.contenedores.length < n0 && c.resultado.sinCargar <= ref.resultado.sinCargar) {
      opciones.push({ id: it.id, nombre: it.nombre, lista, n: c.resultado.contenedores.length, ocupaciones: resumen(c).ocupaciones });
    }
  }
  if (!opciones.length) return { tipo: "sinPaletizar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, opciones: [], motivo: "noAhorra" };
  // La mejor: la que use menos vehículos y, a igualdad, la que deje el último más lleno
  opciones.sort((a, b) => a.n - b.n || (b.ocupaciones[b.ocupaciones.length - 1] - a.ocupaciones[a.ocupaciones.length - 1]));
  const g = opciones[0];
  onFase?.("Calculando el resultado final…");
  const f = await correrFinal(g.lista);
  return { tipo: "sinPaletizar", cambios: [], antes: resumen(ref), despues: resumen(f), corrida: f, items: g.lista,
    elegido: g.nombre, opciones: opciones.map(({ id, nombre, n }) => ({ id, nombre, n })) };
}

// ---------- Sugerir juntar los pallets de un SKU que van medio vacíos ----------
// Un SKU paletizado con poca cantidad arma un pallet incompleto que viaja casi vacío (12 cajas en una
// tarima de 1,382 mm, por ejemplo). Varios de esos juntos en pallets mixtos liberan piso. Solo se ofrece
// cuando salió más de un vehículo: con uno solo, un pallet por SKU es más cómodo en el andén y no cuesta.
const UTIL_POBRE = 0.5;   // un pallet que usa menos de la mitad de su espacio va «medio vacío»

export function palletsPobres(corrida) {
  const defs = corrida.resultado.pallets || [];
  const usados = new Set();
  corrida.resultado.contenedores.forEach((v) => v.cajas.forEach((k) => { if (k.pal >= 0) usados.add(k.pal); }));
  return defs.map((d, i) => ({ ...d, i })).filter((d) => usados.has(d.i) && !d.mixto && d.utilVol < UTIL_POBRE);
}

export async function sugerirPalletMixto({ items, correrPedido, correrFinal = correrPedido, fijas = new Set(), onFase }) {
  onFase?.("Revisando qué pallets van medio vacíos…");
  const ref = await correrPedido(items);
  const n0 = ref.resultado.contenedores.length;
  const pobres = palletsPobres(ref);
  const nombres = new Set(pobres.map((d) => d.nombre.replace(/ \(incompleto\)$/, "")));
  const candidatos = items.filter((it) => it.paletizar === true && it.qty > 0 && !it.fijo && !fijas.has(it.id) && nombres.has(it.nombre));
  if (n0 < 2 || candidatos.length < 2) {
    return { tipo: "palletMixto", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, pobres: [],
      motivo: n0 < 2 ? "cabeIgual" : "pocosPobres" };
  }
  onFase?.("Probando armarlos como pallets mixtos…");
  const lista = items.map((x) => (candidatos.some((c) => c.id === x.id) ? { ...x, paletizar: "mixto" } : x));
  const c = await correrPedido(lista);
  if (!(c.resultado.contenedores.length < n0) || c.resultado.sinCargar > ref.resultado.sinCargar) {
    return { tipo: "palletMixto", cambios: [], antes: resumen(ref), despues: resumen(c), corrida: ref, items,
      pobres: candidatos.map((x) => x.nombre), motivo: "noAhorra" };
  }
  onFase?.("Calculando el resultado final…");
  const f = await correrFinal(lista);
  return { tipo: "palletMixto", cambios: [], antes: resumen(ref), despues: resumen(f), corrida: f, items: lista,
    pobres: candidatos.map((x) => x.nombre) };
}

// ---------- Abrir Bundles a mano ----------
// El motor abre los menos posibles y casi siempre acierta, pero el andén sabe cosas que la herramienta no
// (que ese SKU viene flejado de planta, que ese otro se abre en dos minutos). Así que cuando sale más de un
// vehículo se ofrece la lista: cuántos Bundles tiene cada SKU y cuántos propone abrir, para subir o bajar
// cada uno y volver a calcular. Las cajas de los Bundles abiertos se cargan ANTES que los Bundles enteros
// (ver motor/motor.js: subDe), que es el orden que pidió el andén.
import { lineasBundle } from "../archivos/bundle.js";

// Propuesta inicial: lo que el motor decidió solo, para que el usuario arranque de ahí y no de cero.
export async function sugerirAbrirBundles({ items, correrPedido, correrFinal = correrPedido, abiertos = null, onFase }) {
  const lineas = lineasBundle(items);
  if (!lineas.length) return { tipo: "abrirBundles", cambios: [], lineas: [], motivo: "sinBundles" };
  onFase?.(abiertos ? "Recalculando con los Bundles que elegiste…" : "Calculando con la apertura que propone el motor…");
  const reglas = abiertos ? { _abiertos: abiertos } : null;
  const c = await (reglas ? correrFinal(items, abiertos) : correrFinal(items));
  const prop = c.resultado.bundles;
  const elegidos = abiertos || Object.fromEntries((prop?.lineas || []).map((l) => [l.id, l.abiertos]));
  return {
    tipo: "abrirBundles", cambios: [], items, corrida: c,
    antes: resumen(c), despues: resumen(c),
    lineas: lineas.map((l) => ({ id: l.id, nombre: l.nombre, bundles: l.bundles, cajasPorBundle: l.cajasPorBundle, abiertos: elegidos[l.id] || 0 })),
    abiertos: elegidos,
  };
}
