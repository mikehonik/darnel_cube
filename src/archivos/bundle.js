// ================= Bundle (BDL) =================
// Un Bundle agrupa varias cajas del mismo SKU en un solo bulto más grande, con sus propias
// dimensiones y peso. Un SKU marcado como Bundle puede generar, dentro del mismo pedido, dos tipos
// de carga distintos: Bundle (bultos completos) y Suelto (lo que no alcanzó para formar otro bulto).
// La transformación ocurre ANTES de correr el motor de cubicaje: por eso vive aquí, junto a los demás
// lectores de archivos, y no dentro del motor.
//
// Parámetros del SKU (ver maestro.js):
//   bundleActivo            "Activar agrupación en Bundle"
//   manufacturaPropia       El Bundle solo aplica a manufactura propia (en la práctica, SKUs que
//                           empiezan con DU; ver leerBundleMaestro)
//   bundlePct               "Porcentaje máximo de cantidad en Bundle" (0 a 100, sin incluir extremos)
//   bundleCantidadEstandar  Cuántas cajas (unidad de la caja del SKU) entran en UN Bundle. Equivale a
//                           "Factor conversión BDL / Factor conversión unidad del pedido" del documento
//                           funcional, ya resuelto a cajas porque a esta altura el pedido ya se convirtió
//                           a cajas (ver archivos/conversiones.js: aCajas).
//   bundleL, bundleW, bundleH  Medidas del Bundle armado, en mm (independientes de la caja suelta).
//   bundlePeso              Peso del Bundle armado, en kg.

// Cantidad de Bundles completos y cantidad suelta restante, a partir de la cantidad pedida (en cajas).
// Fórmulas del documento funcional:
//   Bundles = parte entera ((cantidad pedido × % máximo) / (100 × cantidad estándar por Bundle))
//   Suelta  = cantidad pedido - (Bundles × cantidad estándar por Bundle)
// Nunca se generan Bundles parciales, y la suma siempre reproduce el 100% de lo pedido.
export function calcularBundle(cantidadPedido, pct, cantidadEstandar) {
  if (!(cantidadPedido > 0) || !(pct > 0) || !(cantidadEstandar > 0)) return { cantidadBundles: 0, cantidadSuelta: Math.max(0, cantidadPedido) || 0 };
  const cantidadBundles = Math.floor((cantidadPedido * pct) / (100 * cantidadEstandar));
  const cantidadSuelta = cantidadPedido - cantidadBundles * cantidadEstandar;
  return { cantidadBundles, cantidadSuelta };
}

// Qué le falta a un SKU para poder procesarse como Bundle. Devuelve un arreglo de textos (vacío = listo).
// No valida bundleActivo: eso lo decide quien llama, para poder distinguir "no aplica" de "mal configurado".
export function validarBundleSku(p) {
  const faltan = [];
  if (!p.manufacturaPropia) faltan.push("no es manufactura propia");
  if (!(p.bundleCantidadEstandar > 0)) faltan.push("falta la cantidad estándar por Bundle");
  if (!(p.bundleL > 0 && p.bundleW > 0 && p.bundleH > 0)) faltan.push("faltan las dimensiones del Bundle");
  if (!(p.bundlePct > 0 && p.bundlePct < 100)) faltan.push("el porcentaje máximo de Bundle debe estar entre 0% y 100%");
  return faltan;
}

// Transforma un solo item (una línea del pedido, ya en cajas) en uno, dos o los mismos items,
// según si su producto está habilitado y correctamente configurado para Bundle.
// Devuelve { items, aviso } — aviso es null cuando no hay nada que reportar (SKU normal, o Bundle
// exitoso sin nada que avisar aparte del resumen que ya se ve en la carga).
export function transformarItemBundle(item, producto) {
  if (!producto || !producto.bundleActivo) return { items: [item], aviso: null };
  const faltan = validarBundleSku(producto);
  if (faltan.length) return { items: [item], aviso: `${item.nombre}: Bundle activado pero ${faltan.join("; ")}; se cargó como suelto.` };

  const { cantidadBundles, cantidadSuelta } = calcularBundle(item.qty, producto.bundlePct, producto.bundleCantidadEstandar);
  if (cantidadBundles <= 0) return { items: [item], aviso: `${item.nombre}: no alcanzó para formar un Bundle completo (${item.qty} cajas, ${producto.bundleCantidadEstandar} por Bundle); se cargó como suelto.` };

  const base = { grupo: item.grupo, orden: item.orden, destino: item.destino, categoria: item.categoria, color: item.color };
  const bundle = {
    ...item, ...base,
    L: producto.bundleL, W: producto.bundleW, H: producto.bundleH,
    peso: producto.bundlePeso > 0 ? producto.bundlePeso : item.peso * producto.bundleCantidadEstandar,
    qty: cantidadBundles, umCaja: "BDL", piezas: (item.piezas || 1) * producto.bundleCantidadEstandar,
    // El Bundle ya es un bulto armado: no se paletiza con el estándar de la caja suelta, ni anida, y
    // se trata como caja aunque la pieza suelta sea un barril o un tubo.
    paletizar: false, porPallet: 0, porCapa: 0, capasPallet: 0, anidado: 0, maxAnidado: 0, forma: "caja", diametro: 0,
    esBundle: true, skuOrigen: item.nombre, cantidadPorBundle: producto.bundleCantidadEstandar,
    id: item.id,
  };
  if (cantidadSuelta <= 0) return { items: [bundle], aviso: null };
  const suelto = { ...item, id: `${item.id}-suelto`, qty: cantidadSuelta, skuOrigen: item.nombre };
  return { items: [bundle, suelto], aviso: null };
}

// Aplica transformarItemBundle a toda la lista de items de una carga.
// mapaMaestro: Map de SKU normalizado (clave()) → producto. Devuelve { items, avisos }.
export function transformarPedidoBundle(items, mapaMaestro, clave) {
  const resultado = [], avisos = [];
  items.forEach((item) => {
    const p = mapaMaestro.get(clave(item.nombre));
    const { items: nuevos, aviso } = transformarItemBundle(item, p);
    resultado.push(...nuevos);
    if (aviso) avisos.push(aviso);
  });
  return { items: resultado, avisos };
}
