// ================= Herramientas de capacidad =================
// Tres preguntas que no necesitan cargar un pedido completo: cuánto cabe SUELTO de un SKU en un
// vehículo, cuántos PALLETS COMPLETOS de un SKU caben, y cuál es la mejor CONFIGURACIÓN de cajas por
// pallet. Las tres reutilizan el mismo motor de cubicaje (ver motor/motor.js), solo que con un único
// SKU y una cantidad "infinita": el motor topa por espacio, peso y las reglas propias del SKU.
import { useMemo, useState } from "react";
import { claveSku } from "../../archivos/celdas.js";
import { capacidadSuelta, configuracionPallet, capacidadPalletCompleto } from "../../motor/motor.js";
import { prepararEntrada } from "../../motor/corrida.js";
import { T } from "../tema.js";
import { Sel, Tarjeta } from "../controles.jsx";

const vehParaCalculo = (v) => ({ ...v, maxVolPct: v.maxVolPct || 0, maxSkus: v.maxSkus || 0, maxPiezas: v.maxPiezas || 0 });
// El motor espera la entrada ya normalizada (soporte mínimo como fracción, compresión por omisión según
// el empaque): se pasa por el mismo prepararEntrada que usa una corrida normal. El cálculo corre en el hilo
// de la pantalla, así que se topa en nivel 2 (en la práctica, milisegundos para un solo SKU).
const paraMotor = (p, reglas) => {
  const { pid, sku, tarima, ...resto } = p;
  const e = prepararEntrada({ items: [{ ...resto, nombre: sku, qty: 1 }], vehiculo: null, tarimas: [], reglas: { ...reglas, nivel: Math.min(2, reglas.nivel || 2) } });
  return { it: e.items[0], reglas: e.reglas };
};
const pct = (n) => `${(n * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;
const m3 = (mm3) => (mm3 / 1e9).toLocaleString("es-MX", { maximumFractionDigits: 2 });

function Resultado({ filas }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
      {filas.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 col-span-2 sm:col-span-1">
          <dt style={{ color: T.suave }}>{k}</dt><dd className="font-medium text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SeccionHerramientas({ maestro, vehiculos, pallets, reglas }) {
  const [skuSel, setSkuSel] = useState(maestro.productos[0]?.sku || "");
  const [vehSel, setVehSel] = useState(vehiculos[0]?.id || "");
  const [tarimaSel, setTarimaSel] = useState(0);

  const producto = useMemo(() => maestro.productos.find((p) => claveSku(p.sku) === claveSku(skuSel)) || null, [maestro.productos, skuSel]);
  const veh = useMemo(() => vehParaCalculo(vehiculos.find((v) => v.id === vehSel) || vehiculos[0] || {}), [vehiculos, vehSel]);
  const pal = pallets[tarimaSel] || pallets[0];
  // Memorizado: sin esto el objeto cambiaba en cada render y el motor se volvía a correr cada vez.
  const m = useMemo(() => (producto ? paraMotor(producto, reglas) : null), [producto, reglas]);

  const rSuelta = useMemo(() => (m && veh.L > 0 ? capacidadSuelta(m.it, veh, m.reglas) : null), [m, veh]);
  const rConfig = useMemo(() => (m && pal ? configuracionPallet(m.it, pal, m.reglas) : null), [m, pal]);
  const rPallets = useMemo(() => (m && pal && veh.L > 0 ? capacidadPalletCompleto(m.it, pal, veh, m.reglas) : null), [m, pal, veh]);

  if (!maestro.productos.length) return <p className="text-sm" style={{ color: T.suave }}>Necesitas productos en el maestro para usar estas herramientas.</p>;

  return (
    <>
      <h2 className="text-lg font-semibold mb-1">Herramientas de capacidad</h2>
      <p className="text-xs mb-3" style={{ color: T.suave }}>Preguntas rápidas sobre un solo SKU, sin necesidad de cargar un pedido completo.</p>
      <Tarjeta titulo="SKU a evaluar">
        <Sel etiqueta="SKU" valor={producto ? producto.sku : ""} onChange={setSkuSel} opciones={maestro.productos.map((p) => [p.sku, `${p.sku}${p.desc ? " — " + p.desc : ""}`])} />
      </Tarjeta>

      <Tarjeta titulo="Capacidad máxima suelta (sin paletizar)">
        <p className="text-xs mb-2" style={{ color: T.suave }}>¿Cuál es la cantidad máxima de este SKU que puedo cargar suelto en este vehículo?</p>
        <Sel etiqueta="Vehículo" valor={veh.id || vehiculos[0]?.id} onChange={setVehSel} opciones={vehiculos.map((v) => [v.id, v.nombre])} />
        {rSuelta && (
          rSuelta.cajas > 0 ? (
            <Resultado filas={[
              ["Cantidad máxima (unidades)", rSuelta.cajas.toLocaleString("es-MX")],
              ["Piezas totales", rSuelta.piezas.toLocaleString("es-MX")],
              ["Volumen ocupado", `${m3(rSuelta.vol)} m³`],
              ["% de ocupación del vehículo", pct(rSuelta.vol / rSuelta.volV)],
              ["Peso total", `${Math.round(rSuelta.peso).toLocaleString("es-MX")} kg`],
            ]} />
          ) : <p className="text-sm mt-2" style={{ color: T.error }}>Este SKU no cabe suelto en este vehículo (o excede el peso máximo).</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Configuración óptima de cajas por pallet">
        <p className="text-xs mb-2" style={{ color: T.suave }}>¿Cuál es la configuración que maximiza la cantidad de cajas de este SKU en esta tarima?</p>
        <Sel etiqueta="Tarima" valor={tarimaSel} onChange={(v) => setTarimaSel(Number(v))} opciones={pallets.map((p, i) => [i, p.nombre])} />
        {rConfig ? (
          <Resultado filas={[
            ["Cajas por nivel", rConfig.porCapa.toLocaleString("es-MX")],
            ["Niveles", rConfig.capas.toLocaleString("es-MX")],
            ["Total de cajas por pallet", rConfig.n.toLocaleString("es-MX")],
            ["Unidades totales por pallet", rConfig.piezas.toLocaleString("es-MX")],
            ["Altura del pallet cargado", `${Math.round(rConfig.alto).toLocaleString("es-MX")} mm`],
            ["Peso del pallet cargado", `${Math.round(rConfig.peso).toLocaleString("es-MX")} kg`],
            ["% de utilización de la superficie", pct((rConfig.L * rConfig.W) / (pal.L * pal.W))],
          ]} />
        ) : <p className="text-sm mt-2" style={{ color: T.error }}>Este SKU no arma ni un pallet en esta tarima (revisa medidas y orientaciones).</p>}
      </Tarjeta>

      <Tarjeta titulo="Capacidad máxima en pallets completos">
        <p className="text-xs mb-2" style={{ color: T.suave }}>¿Cuántos pallets completos de este SKU puedo transportar en este vehículo? (nunca pallets parciales)</p>
        <Sel etiqueta="Vehículo" valor={veh.id || vehiculos[0]?.id} onChange={setVehSel} opciones={vehiculos.map((v) => [v.id, v.nombre])} />
        {rPallets && (
          rPallets.pallets > 0 ? (
            <Resultado filas={[
              ["Pallet usado", rPallets.def.estandar ? `Estándar del SKU: ${rPallets.def.capas ? `${rPallets.def.capas} niveles × ${rPallets.def.porCapa}` : `${rPallets.cajasPorPallet} cajas`}` : "Configuración óptima (el SKU no tiene estándar)"],
              ["Pallets completos", rPallets.pallets.toLocaleString("es-MX")],
              ["Cajas por pallet", rPallets.cajasPorPallet.toLocaleString("es-MX")],
              ["Total de cajas", rPallets.cajasTotales.toLocaleString("es-MX")],
              ["Unidades totales", rPallets.piezasTotales.toLocaleString("es-MX")],
              ["% de ocupación del vehículo", pct(rPallets.vol / rPallets.volV)],
              ["Peso total transportado", `${Math.round(rPallets.peso).toLocaleString("es-MX")} kg`],
            ]} />
          ) : <p className="text-sm mt-2" style={{ color: T.error }}>Ni un pallet completo de este SKU cabe en este vehículo.</p>
        )}
      </Tarjeta>
    </>
  );
}
