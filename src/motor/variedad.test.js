import { describe, it, expect } from "vitest";
import { techoPorVariedad, prepararEntrada, TECHO_MINIMO } from "./corrida.js";

// Calibrado con 2,098 contenedores de exportación reales (ver corrida.js). La tabla observada:
//   1 SKU 98.4% · 2-4 96.3% · 5-9 94.2% · 10-14 93.3% · 15-19 92.8% · 20-24 92.1% · 25-34 90.8%
describe("pérdida por variedad", () => {
  it("reproduce la ocupación observada en los cargues reales", () => {
    // Desde 2 SKUs: con uno solo no se topa nada, porque la pérdida se mide CONTRA el cargue de un SKU
    // y lo que le falta a ese para el 100% es ineficiencia de acomodo, que el motor ya reproduce solo.
    const obs = [[3, 96.3], [7, 94.2], [12, 93.3], [17, 92.8], [22, 92.1], [29, 90.8]];
    obs.forEach(([n, real]) => {
      const t = techoPorVariedad(n);
      expect(Math.abs(t - real), `${n} SKUs: techo ${t} contra ${real} observado`).toBeLessThan(1);
    });
  });
  it("un solo SKU no pierde nada", () => expect(techoPorVariedad(1)).toBe(100));
  it("siempre baja al subir la variedad, y nunca por debajo del piso", () => {
    let ant = 101;
    for (const n of [2, 5, 10, 20, 50, 200, 700]) { const t = techoPorVariedad(n); expect(t).toBeLessThanOrEqual(ant); expect(t).toBeGreaterThanOrEqual(TECHO_MINIMO); ant = t; }
  });

  const it0 = (i) => ({ id: i, nombre: "S" + i, L: 400, W: 300, H: 300, peso: 2, qty: 50, oris: [true, true, false, false, false, false],
    volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0,
    piezas: 1, paletizar: false, palletId: 0, porPallet: 0, porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false });
  const veh = { L: 12032, W: 2352, H: 2690, tara: 3800, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
  const prep = (n, r = reglas, v = veh) => prepararEntrada({ items: Array.from({ length: n }, (_, i) => it0(i + 1)), vehiculo: v, tarimas: [], reglas: r });

  it("va dentro de «Simular la carga real»: sin ese interruptor no se aplica", () => {
    expect(prep(10).veh.maxVolPct).toBe(techoPorVariedad(10));
    expect(prep(10, { ...reglas, compresionAuto: false }).veh.maxVolPct).toBe(0);
  });
  it("respeta un tope más bajo puesto a mano por el usuario", () => {
    expect(prep(10, reglas, { ...veh, maxVolPct: 80 }).veh.maxVolPct).toBe(80);
    expect(prep(10, reglas, { ...veh, maxVolPct: 99 }).veh.maxVolPct).toBe(techoPorVariedad(10));
  });
});
