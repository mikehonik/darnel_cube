import { describe, it, expect } from "vitest";
import { calcularBundle, validarBundleSku, transformarItemBundle, transformarPedidoBundle } from "./bundle.js";
import { clave } from "./celdas.js";

const productoBundle = (d = {}) => ({
  bundleActivo: true, manufacturaPropia: true, bundlePct: 70, bundleCantidadEstandar: 10,
  bundleL: 1200, bundleW: 1000, bundleH: 1500, bundlePeso: 220, ...d,
});

describe("calcularBundle", () => {
  it("reproduce el ejemplo del documento: 189 pedidas, Bundle de 10, máximo 70% → 13 BDL + 59 sueltas", () => {
    const r = calcularBundle(189, 70, 10);
    expect(r.cantidadBundles).toBe(13);
    expect(r.cantidadSuelta).toBe(59);
    expect(r.cantidadBundles * 10 + r.cantidadSuelta).toBe(189);
  });

  it("nunca genera Bundles parciales (parte entera hacia abajo)", () => {
    expect(calcularBundle(19, 100, 10).cantidadBundles).toBe(1);
    expect(calcularBundle(9, 100, 10).cantidadBundles).toBe(0);
    expect(calcularBundle(9, 100, 10).cantidadSuelta).toBe(9);
  });

  it("sin cantidad, porcentaje o cantidad estándar válidos, todo se queda suelto", () => {
    expect(calcularBundle(0, 70, 10)).toEqual({ cantidadBundles: 0, cantidadSuelta: 0 });
    expect(calcularBundle(50, 0, 10)).toEqual({ cantidadBundles: 0, cantidadSuelta: 50 });
    expect(calcularBundle(50, 70, 0)).toEqual({ cantidadBundles: 0, cantidadSuelta: 50 });
  });

  it("la cantidad procesada siempre reproduce el 100% de lo pedido", () => {
    for (const q of [1, 7, 10, 23, 100, 999]) {
      const r = calcularBundle(q, 45, 8);
      expect(r.cantidadBundles * 8 + r.cantidadSuelta).toBe(q);
    }
  });
});

describe("validarBundleSku", () => {
  it("sin problemas cuando todo está configurado", () => {
    expect(validarBundleSku(productoBundle())).toEqual([]);
  });
  it("reporta cada parámetro faltante", () => {
    const faltan = validarBundleSku(productoBundle({ manufacturaPropia: false, bundleCantidadEstandar: 0, bundleL: 0, bundlePct: 0 }));
    expect(faltan).toHaveLength(4);
    expect(faltan.join(" ")).toMatch(/manufactura propia/);
    expect(faltan.join(" ")).toMatch(/cantidad estándar/);
    expect(faltan.join(" ")).toMatch(/dimensiones/);
    expect(faltan.join(" ")).toMatch(/porcentaje máximo/);
  });
  it("el porcentaje no puede ser 0, 100 ni mayor a 100 (sin incluir extremos)", () => {
    expect(validarBundleSku(productoBundle({ bundlePct: 0 }))).toHaveLength(1);
    expect(validarBundleSku(productoBundle({ bundlePct: 100 }))).toHaveLength(1);
    expect(validarBundleSku(productoBundle({ bundlePct: 100.0001 }))).toHaveLength(1);
  });
});

describe("transformarItemBundle", () => {
  const item = { id: 1, nombre: "DU2014501", qty: 189, L: 300, W: 200, H: 150, peso: 3, piezas: 1, oris: [true, true, false, false, false, false], grupo: "", orden: 0, destino: "" };

  it("SKU sin Bundle activado se queda igual", () => {
    const r = transformarItemBundle(item, { bundleActivo: false });
    expect(r.items).toEqual([item]);
    expect(r.aviso).toBeNull();
  });

  it("el Bundle no hereda el paletizado ni la forma de la caja suelta", () => {
    const prod = { bundleActivo: true, manufacturaPropia: true, bundlePct: 70, bundleCantidadEstandar: 10, bundleL: 1200, bundleW: 1000, bundleH: 1500, bundlePeso: 0 };
    const r = transformarItemBundle({ ...item, paletizar: "uno", porPallet: 24, forma: "barril", anidado: 50 }, prod);
    expect(r.items[0]).toMatchObject({ esBundle: true, paletizar: false, porPallet: 0, forma: "caja", anidado: 0 });
    expect(r.items[1]).toMatchObject({ paletizar: "uno", porPallet: 24 }); // lo suelto conserva sus reglas
  });

  it("sin producto (SKU no encontrado) se queda igual", () => {
    const r = transformarItemBundle(item, null);
    expect(r.items).toEqual([item]);
  });

  it("divide la línea en Bundle + suelto y conserva el 100% de las cajas", () => {
    const r = transformarItemBundle(item, productoBundle());
    expect(r.items).toHaveLength(2);
    const [bdl, suelto] = r.items;
    expect(bdl.esBundle).toBe(true);
    expect(bdl.qty).toBe(13);
    expect(bdl.L).toBe(1200); expect(bdl.W).toBe(1000); expect(bdl.H).toBe(1500); expect(bdl.peso).toBe(220);
    expect(bdl.skuOrigen).toBe("DU2014501");
    expect(suelto.qty).toBe(59);
    expect(suelto.L).toBe(300); // conserva las medidas normales del SKU
    expect(bdl.qty * 10 + suelto.qty).toBe(189);
  });

  it("sin peso de Bundle capturado, lo calcula como peso de la caja × cantidad estándar", () => {
    const r = transformarItemBundle(item, productoBundle({ bundlePeso: 0 }));
    expect(r.items[0].peso).toBe(3 * 10);
  });

  it("si no alcanza para un Bundle completo, la línea se queda suelta y avisa", () => {
    const r = transformarItemBundle({ ...item, qty: 5 }, productoBundle());
    expect(r.items).toEqual([{ ...item, qty: 5 }]);
    expect(r.aviso).toMatch(/no alcanzó/);
  });

  it("Bundle activado pero mal configurado: se queda suelto y avisa qué falta", () => {
    const r = transformarItemBundle(item, productoBundle({ bundleCantidadEstandar: 0 }));
    expect(r.items).toEqual([item]);
    expect(r.aviso).toMatch(/cantidad estándar/);
  });

  it("cuando toda la cantidad forma Bundles exactos, no deja línea suelta", () => {
    const r = transformarItemBundle({ ...item, qty: 130 }, productoBundle()); // 130 × 70% / 10 = 9.1 → 9 BDL, sobran 40 sueltas
    // con 100% sí cierra exacto:
    const r2 = transformarItemBundle({ ...item, qty: 130 }, productoBundle({ bundlePct: 99.999 }));
    expect(r.items).toHaveLength(2);
    expect(r2.items).toHaveLength(2);
  });
});

describe("transformarPedidoBundle", () => {
  it("transforma varias líneas y junta los avisos", () => {
    const items = [
      { id: 1, nombre: "DU2014501", qty: 189, L: 300, W: 200, H: 150, peso: 3 },
      { id: 2, nombre: "OTRO-SKU", qty: 40, L: 400, W: 300, H: 200, peso: 5 },
    ];
    const mapaMaestro = new Map([
      [clave("DU2014501"), productoBundle()],
      [clave("OTRO-SKU"), { bundleActivo: false }],
    ]);
    const r = transformarPedidoBundle(items, mapaMaestro, clave);
    expect(r.items).toHaveLength(3); // DU se parte en 2, OTRO-SKU queda igual
    expect(r.avisos).toEqual([]);
    expect(r.items.filter((i) => i.esBundle)).toHaveLength(1);
  });
});
