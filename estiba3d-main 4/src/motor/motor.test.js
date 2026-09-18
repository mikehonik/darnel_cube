import { describe, it, expect } from "vitest";
import { optimizar, marcarEntregas } from "./motor.js";

// Fixtures mínimos con la misma forma que usa App.jsx (nuevoItem, VEHICULOS, reglas).
const caja = (d = {}) => ({
  nombre: "SKU", L: 600, W: 400, H: 400, peso: 10, qty: 20, oris: [true, true, false, false, false, false], volteoPiso: false,
  maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1,
  paletizar: false, palletId: 0, porPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d,
});
const veh20 = { L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
// soporteMin ya en fracción (App.jsx divide entre 100 antes de llamar al motor)
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 0.75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };

const seSolapan = (a, b) =>
  a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.w && b.y < a.y + a.w && a.z < b.z + b.h && b.z < a.z + a.h;

describe("optimizar", () => {
  it("coloca 20 cajas chicas en un contenedor de 20 pies sin dejar nada fuera", () => {
    const r = optimizar([caja()], veh20, reglas, () => {}, []);
    expect(r.contenedores.length).toBe(1);
    expect(r.contenedores[0].cajas.length).toBe(20);
    expect(r.sinCargar).toBe(0);
    expect(r.noCaben).toEqual([]);
  });

  it("no saca cajas del contenedor ni las solapa", () => {
    const r = optimizar([caja({ qty: 40 })], veh20, reglas, () => {}, []);
    const cajas = r.contenedores.flatMap((c) => c.cajas);
    for (const c of cajas) {
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0); expect(c.z).toBeGreaterThanOrEqual(0);
      expect(c.x + c.l).toBeLessThanOrEqual(veh20.L);
      expect(c.y + c.w).toBeLessThanOrEqual(veh20.W);
      expect(c.z + c.h).toBeLessThanOrEqual(veh20.H);
    }
    for (let i = 0; i < cajas.length; i++)
      for (let j = i + 1; j < cajas.length; j++) expect(seSolapan(cajas[i], cajas[j])).toBe(false);
  });

  it("reporta por nombre lo que no cabe en el vehículo", () => {
    const r = optimizar([caja({ nombre: "Enorme", L: 7000, W: 400, H: 400, qty: 3 })], veh20, reglas, () => {}, []);
    expect(r.noCaben).toContain("Enorme");
    // Contrato actual: lo que no cabe se nombra en noCaben y NO se suma en sinCargar (sinCargar solo cuenta lo que cabía pero no alcanzó lugar).
    expect(r.sinCargar).toBe(0);
    expect(r.contenedores.length).toBe(0);
  });
});

describe("entregas", () => {
  // 50 cajas de 600×400×400 llenan dos columnas de 600 mm a lo largo del contenedor de 20 pies: cada parada ocupa su propia zona.
  const xs = (r, idx) => r.contenedores[0].cajas.filter((c) => c.idx === idx).map((c) => c.x);
  const ruta = (reglasExtra = {}, itemsExtra = []) => optimizar([caja({ nombre: "Parada 1", qty: 50, orden: 1 }), caja({ nombre: "Parada 2", qty: 50, orden: 2 }), ...itemsExtra], veh20, { ...reglas, ...reglasExtra }, () => {}, []);

  it("la parada 1 se carga al final y queda junto a las puertas; la 2 va al fondo", () => {
    const r = ruta();
    expect(r.sinCargar).toBe(0);
    expect(r.contenedores).toHaveLength(1);
    expect(Math.min(...xs(r, 0))).toBeGreaterThanOrEqual(Math.max(...xs(r, 1)) + 600);
  });

  it("sin número va al fondo, detrás de todas las paradas", () => {
    const r = ruta({}, [caja({ nombre: "Libre", qty: 25 })]);
    expect(Math.max(...xs(r, 2)) + 600).toBeLessThanOrEqual(Math.min(...xs(r, 1)) + 1);
  });

  it("estricto: cada entrega en su zona y nada estorba", () => {
    const c = ruta({ rigor: "estricto" }).contenedores[0];
    expect(c.estorban).toBe(0);
    expect(c.entregas.map((e) => [e.orden, e.n, e.estorban])).toEqual([[1, 50, 0], [2, 50, 0]]);
    expect(c.entregas[0].x0).toBeGreaterThanOrEqual(c.entregas[1].x1);
    expect(c.entregas[0].vol).toBe(50 * 600 * 400 * 400);
  });

  it("flexible: la parada 1 puede meterse hasta un 12% del largo en la zona anterior", () => {
    const c = ruta({ rigor: "flexible" }).contenedores[0];
    expect(c.entregas[0].x0).toBeGreaterThanOrEqual(c.entregas[1].x1 - veh20.L * 0.12 - 1);
    expect(c.estorban).toBe(c.entregas.reduce((a, e) => a + e.estorban, 0));
  });
});

describe("marcarEntregas", () => {
  const cj = (idx, x, y = 0, z = 0) => ({ idx, x, y, z, l: 600, w: 400, h: 400 });
  const ordenDe = { 0: 1, 1: 2, 2: 0 };
  it("cuenta un bulto de parada posterior que queda entre las puertas y una parada anterior", () => {
    const c = marcarEntregas({ cajas: [cj(0, 0), cj(1, 600)] }, ordenDe);
    expect(c.estorban).toBe(1);
    expect(c.entregas).toEqual([{ orden: 1, x0: 0, x1: 600, n: 1, vol: 600 * 400 * 400, estorban: 1 }, { orden: 2, x0: 600, x1: 1200, n: 1, vol: 600 * 400 * 400, estorban: 0 }]);
  });
  it("no estorba si va por encima, en otro pasillo, más al fondo, o no tiene parada", () => {
    expect(marcarEntregas({ cajas: [cj(0, 0), cj(1, 600, 0, 400)] }, ordenDe).estorban).toBe(0);
    expect(marcarEntregas({ cajas: [cj(0, 0), cj(1, 600, 400)] }, ordenDe).estorban).toBe(0);
    expect(marcarEntregas({ cajas: [cj(0, 600), cj(1, 0)] }, ordenDe).estorban).toBe(0);
    expect(marcarEntregas({ cajas: [cj(0, 0), cj(2, 600)] }, ordenDe).estorban).toBe(0);
  });
});

describe("compresión bajo carga", () => {
  // Hueco de 1000 mm de alto para cajas de 400: rígidas caben 2 capas; con 25% (300 mm aplastada) caben 3.
  const hueco = { L: 600, W: 400, H: 1000, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const columna = (d) => optimizar([caja({ qty: 3, oris: [true, false, false, false, false, false], ...d })], hueco, { ...reglas, limitarPeso: false }, () => {}, []);

  it("una caja rígida no gana capas", () => {
    const r = columna({ compresion: 0 });
    expect(r.contenedores[0].cajas.length).toBe(2);
    expect(r.contenedores[0].cajas.map((c) => c.h)).toEqual([400, 400]);
  });

  it("la caja comprimida cede altura salvo la de hasta arriba, que se dibuja completa", () => {
    const r = columna({ compresion: 25 });
    const cajas = r.contenedores[0].cajas.sort((a, b) => a.z - b.z);
    expect(cajas.map((c) => [c.z, c.h])).toEqual([[0, 300], [300, 300], [600, 400]]);
    expect(r.sinCargar).toBe(0);
  });

  it("también cuenta al armar pallets", () => {
    const tarima = { nombre: "T", L: 600, W: 400, esp: 150, peso: 20, altMax: 1150, maxKg: 0, ovL: 0, ovW: 0 };
    const veh = { L: 5898, W: 2352, H: 2393, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
    const porPallet = (compresion) => optimizar([caja({ qty: 6, paletizar: true, palletId: 0, compresion })], veh, { ...reglas, limitarPeso: false }, () => {}, [tarima]).pallets[0].n;
    expect(porPallet(0)).toBe(2);
    expect(porPallet(25)).toBe(3);
  });
});

describe("formas anidables", () => {
  const base = {
    oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
    piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0, porPallet: 0,
    porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, compresion: 0, anidado: 0, maxAnidado: 0, forma: "caja", peso: 5,
  };
  const veh = { L: 12032, W: 2352, H: 2698, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const reglas = { nivel: 1, limitarPeso: false, soporteMin: 0.75, usarOrden: false, agrupar: false, juntos: true, apilamiento: "ninguna" };
  const columna = (c) => c.cajas.filter((k) => Math.abs(k.x - c.cajas[0].x) < 1 && Math.abs(k.y - c.cajas[0].y) < 1).length;

  it("una pila anidada sube el incremento, no la altura completa", () => {
    const sin = optimizar([{ ...base, nombre: "B", L: 580, W: 580, H: 880, qty: 2000 }], veh, reglas, null, []);
    const con = optimizar([{ ...base, nombre: "B", L: 580, W: 580, H: 880, qty: 2000, anidado: 150 }], veh, reglas, null, []);
    expect(columna(sin.contenedores[0])).toBe(3);                    // 880 × 3 = 2640 ≤ 2698
    expect(columna(con.contenedores[0])).toBe(13);                   // 880 + 12 × 150 = 2680
    const alto = Math.max(...con.contenedores[0].cajas.map((k) => k.z + k.h));
    expect(alto).toBeLessThanOrEqual(veh.H);
  });

  it("respeta el tope de piezas anidadas por torre", () => {
    const r = optimizar([{ ...base, nombre: "B", L: 580, W: 580, H: 880, qty: 2000, anidado: 150, maxAnidado: 5 }], veh, reglas, null, []);
    const zs = r.contenedores[0].cajas.filter((k) => Math.abs(k.x - r.contenedores[0].cajas[0].x) < 1 && Math.abs(k.y - r.contenedores[0].cajas[0].y) < 1).map((k) => k.z).sort((a, b) => a - b);
    // La torre arranca de nuevo cada 5 piezas: el salto entre la 5.ª y la 6.ª es la altura completa
    expect(zs[1] - zs[0]).toBeCloseTo(150, 1);
    expect(zs[5] - zs[4]).toBeCloseTo(880, 1);
  });

  it("no cuenta dos veces el volumen de las piezas anidadas", () => {
    const r = optimizar([{ ...base, nombre: "T", L: 420, W: 330, H: 38, qty: 5000, anidado: 14 }], veh, reglas, null, []);
    const volV = veh.L * veh.W * veh.H;
    expect(r.contenedores[0].vol).toBeLessThanOrEqual(volV);
  });
});

describe("apilamiento por categoría", () => {
  const base = {
    oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
    piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0, porPallet: 0,
    porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, compresion: 0, anidado: 0,
    maxAnidado: 0, forma: "caja", categoria: "", peso: 10,
  };
  const veh = { L: 6000, W: 2400, H: 2600, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const reglas = { nivel: 1, limitarPeso: false, soporteMin: 0.75, usarOrden: false, agrupar: false, juntos: true, apilamiento: "mismaCategoria" };

  it("deja apilar tejas sobre tejas aunque sean SKUs distintos de la misma categoría", () => {
    const items = [
      { ...base, nombre: "Teja modelo A", L: 1000, W: 800, H: 100, qty: 20, categoria: "Tejas" },
      { ...base, nombre: "Teja modelo B", L: 1000, W: 800, H: 100, qty: 20, categoria: "Tejas" },
    ];
    const r = optimizar(items, veh, reglas, null, []);
    const apiladas = r.contenedores[0].cajas.filter((c) => c.z > 0);
    expect(apiladas.length).toBeGreaterThan(0);
    expect(r.sinCargar).toBe(0);
  });

  it("no deja que algo de otra categoría se apile encima, aunque soporte carga", () => {
    const items = [
      { ...base, nombre: "Teja", L: 1000, W: 800, H: 100, qty: 4, categoria: "Tejas" },
      { ...base, nombre: "Vidrio", L: 1000, W: 800, H: 100, qty: 4, categoria: "Frágiles" },
    ];
    const r = optimizar(items, veh, reglas, null, []);
    r.contenedores.forEach((c) => c.cajas.forEach((a, i) => {
      if (a.z === 0) return;
      const debajo = c.cajas.find((b, j) => j !== i && Math.abs(b.z + b.h - a.z) < 0.5 && a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.w && b.y < a.y + a.w);
      if (debajo) expect(items[a.idx].categoria).toBe(items[debajo.idx].categoria);
    }));
  });

  it("una pieza siempre se apila sobre sí misma, aunque no tenga categoría", () => {
    const items = [{ ...base, nombre: "Sin clasificar", L: 1000, W: 800, H: 300, qty: 8, categoria: "" }];
    const r = optimizar(items, veh, reglas, null, []);
    expect(r.contenedores[0].cajas.some((c) => c.z > 0)).toBe(true);
  });

  it("dos SKUs distintos sin categoría no se apilan entre sí", () => {
    const items = [
      { ...base, nombre: "A", L: 1000, W: 800, H: 300, qty: 4, categoria: "" },
      { ...base, nombre: "B", L: 1000, W: 800, H: 300, qty: 4, categoria: "" },
    ];
    const r = optimizar(items, veh, reglas, null, []);
    r.contenedores[0].cajas.forEach((a, i) => {
      if (a.z === 0) return;
      const debajo = r.contenedores[0].cajas.find((b, j) => j !== i && Math.abs(b.z + b.h - a.z) < 0.5 && a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.w && b.y < a.y + a.w);
      if (debajo) expect(a.idx).toBe(debajo.idx);
    });
  });
});
