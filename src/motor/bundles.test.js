import { describe, it, expect } from "vitest";
import { correrConBundles, ejecutorEnProceso } from "./corrida.js";
import { optimizar } from "./motor.js";

// Caja de 300 × 300 × 250 y Bundle de 24 cajas (3 × 2 × 4) de 900 × 600 × 1000: el Bundle no tiene aire,
// pero por su tamaño deja huecos en el contenedor que solo las cajas sueltas pueden llenar.
const linea = (qty, d = {}) => ({ id: 1, nombre: "DU-TEST", desc: "", color: null, L: 300, W: 300, H: 250, peso: 5, qty, oris: [true, true, false, false, false, false],
  volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0,
  porPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, enBundle: true, bundleCantidadEstandar: 24, bundleL: 900, bundleW: 600, bundleH: 1000, bundlePeso: 0, ...d });
const vehiculo = { L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const ejecutor = ejecutorEnProceso(optimizar);

describe("correrConBundles", () => {
  it("si todo cabe en Bundles, no abre ninguno", async () => {
    const c = await correrConBundles({ items: [linea(24 * 20)], vehiculo, tarimas: [], reglas }, { ejecutor });
    expect(c.resultado.contenedores).toHaveLength(1);
    expect(c.resultado.bundles).toMatchObject({ abiertos: 0, ahorro: 0 });
    expect(c.carga.items.every((it) => it.esBundle)).toBe(true);
  });
  it("abre los menos Bundles posibles cuando eso ahorra un vehículo, y conserva todas las cajas", async () => {
    const qty = 24 * 40, c = await correrConBundles({ items: [linea(qty)], vehiculo, tarimas: [], reglas }, { ejecutor });
    const b = c.resultado.bundles;
    expect(c.resultado.contenedores).toHaveLength(1);
    expect(b.abiertos).toBeGreaterThan(0);
    expect(b.abiertos).toBeLessThan(20);
    expect(b.ahorro).toBe(1);
    const cajas = c.carga.items.reduce((a, it) => a + (it.esBundle ? it.qty * 24 : it.qty), 0);
    expect(cajas).toBe(qty);
    expect(c.resultado.sinCargar).toBe(0);
    expect(c.resultado.avisos.join(" ")).toMatch(/se abren \d+ Bundles/);
  });
  it("si no ahorra un vehículo, los abre para dejar el último más vacío (y lo dice)", async () => {
    const sinAbrir = await correrConBundles({ items: [linea(24 * 60)], vehiculo, tarimas: [], reglas: { ...reglas, _maxContenedores: 1 } }, { ejecutor });
    const c = await correrConBundles({ items: [linea(24 * 60)], vehiculo, tarimas: [], reglas }, { ejecutor });
    expect(c.resultado.contenedores).toHaveLength(2);
    expect(c.resultado.bundles.abiertos).toBeGreaterThan(0);
    expect(c.resultado.bundles.ahorro).toBe(0);
    expect(c.resultado.avisos.join(" ")).toMatch(/más vacío/);
    // el primer vehículo va más lleno que sin abrir ninguno
    expect(c.resultado.contenedores[0].vol).toBeGreaterThan(sinAbrir.resultado.contenedores[0].vol);
    // y no se pierde ninguna caja
    expect(c.carga.items.reduce((a, it) => a + (it.esBundle ? it.qty * 24 : it.qty), 0)).toBe(24 * 60);
  });
  it("con un solo vehículo no abre nada (abrir cuesta mano de obra y no gana espacio)", async () => {
    const c = await correrConBundles({ items: [linea(24 * 10)], vehiculo, tarimas: [], reglas }, { ejecutor });
    expect(c.resultado.contenedores).toHaveLength(1);
    expect(c.resultado.bundles.abiertos).toBe(0);
  });
});
