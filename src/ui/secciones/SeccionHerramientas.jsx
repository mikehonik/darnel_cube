// ================= Herramientas de capacidad =================
// Tres preguntas que no necesitan cargar un pedido completo: cuánto cabe SUELTO de un SKU en un
// vehículo, cuántos PALLETS COMPLETOS de un SKU caben, y cuál es la mejor CONFIGURACIÓN de cajas por
// pallet. Las tres reutilizan el mismo motor de cubicaje (ver motor/motor.js), solo que con un único
// SKU y una cantidad "infinita": el motor topa por espacio, peso y las reglas propias del SKU.
import { useMemo, useState } from "react";
import { claveSku, indiceSku, buscarSku } from "../../archivos/celdas.js";
import { capacidadSuelta, configuracionPallet, capacidadPalletCompleto } from "../../motor/motor.js";
import { prepararEntrada } from "../../motor/corrida.js";
import { T } from "../tema.js";
import { Sel, Tarjeta, inp, estInp } from "../controles.jsx";
import { useUnidades } from "../unidadesContexto.jsx";

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

function Resultado({ filas, estimado }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 col-span-2 sm:col-span-1">
            <dt style={{ color: T.suave }}>{k}</dt><dd className="font-medium text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {estimado && <p className="text-xs mt-2" style={{ color: T.suave }}>Aproximado: son tantas piezas que se calcula en rejilla en vez de acomodarlas una por una.</p>}
    </>
  );
}

// Con 26 mil SKU, una lista desplegable con todos tardaba en abrir y se sentía trabada. Aquí se escribe el
// SKU (o parte de la descripción) y solo se sugieren las primeras coincidencias.
const MAX_SUGERENCIAS = 30;
function BuscadorSku({ productos, valor, onElegir }) {
  const [texto, setTexto] = useState(valor);
  const indice = useMemo(() => indiceSku(productos), [productos]);
  const sugerencias = useMemo(() => {
    const q = claveSku(texto), d = texto.trim().toLowerCase();
    if (!q) return productos.slice(0, MAX_SUGERENCIAS);
    const empiezan = [], contienen = [];
    for (const p of productos) {
      const k = claveSku(p.sku);
      if (k.startsWith(q)) empiezan.push(p);
      else if (contienen.length < MAX_SUGERENCIAS && (k.includes(q) || (d.length > 2 && String(p.desc || "").toLowerCase().includes(d)))) contienen.push(p);
      if (empiezan.length >= MAX_SUGERENCIAS) break;
    }
    return [...empiezan, ...contienen].slice(0, MAX_SUGERENCIAS);
  }, [texto, productos]);
  const cambiar = (t) => { setTexto(t); const p = buscarSku(indice, t); if (p) onElegir(p.sku); };
  return (
    <label className="block text-xs" style={{ color: T.suave }}>
      <span className="block mb-1">SKU (escribe el código o parte de la descripción)</span>
      <input list="herramientas-skus" value={texto} onChange={(e) => cambiar(e.target.value)} className={inp} style={estInp} placeholder="Ej. 85210" autoComplete="off" />
      <datalist id="herramientas-skus">
        {sugerencias.map((p) => <option key={p.pid ?? p.sku} value={p.sku}>{p.desc || ""}</option>)}
      </datalist>
    </label>
  );
}

export function SeccionHerramientas({ maestro, vehiculos, pallets, reglas }) {
  const u = useUnidades();
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
        <BuscadorSku productos={maestro.productos} valor={producto ? producto.sku : ""} onElegir={setSkuSel} />
        {producto && (
          <p className="text-xs mt-2" style={{ color: T.suave }}>
            {producto.desc ? `${producto.desc} · ` : ""}{u.fLLL(producto.L, producto.W, producto.H)} · {u.fP(producto.peso, 2)}
          </p>
        )}
        {producto && Math.max(producto.L, producto.W, producto.H) < 30 && (
          <p className="text-xs mt-2 px-2 py-1.5 rounded" style={{ color: T.error, background: `${T.error}12` }}>
            Medidas muy pequeñas ({u.fLLL(producto.L, producto.W, producto.H)}). Puede ser un dato de relleno en el maestro: revisa las medidas reales antes de usar estos resultados.
          </p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Capacidad máxima suelta (sin paletizar)">
        <p className="text-xs mb-2" style={{ color: T.suave }}>¿Cuál es la cantidad máxima de este SKU que puedo cargar suelto en este vehículo?</p>
        <Sel etiqueta="Vehículo" valor={veh.id || vehiculos[0]?.id} onChange={setVehSel} opciones={vehiculos.map((v) => [v.id, v.nombre])} />
        {rSuelta && (
          rSuelta.cajas > 0 ? (
            <Resultado estimado={rSuelta.estimado} filas={[
              ["Cantidad máxima (unidades)", rSuelta.cajas.toLocaleString("es-MX")],
              ["Piezas totales", rSuelta.piezas.toLocaleString("es-MX")],
              ["Volumen ocupado", u.fV(rSuelta.vol)],
              ["% de ocupación del vehículo", pct(rSuelta.vol / rSuelta.volV)],
              ["Peso total", u.fP(rSuelta.peso)],
            ]} />
          ) : <p className="text-sm mt-2" style={{ color: T.error }}>Este SKU no cabe suelto en este vehículo (o excede el peso máximo).</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Configuración óptima de cajas por pallet">
        <p className="text-xs mb-2" style={{ color: T.suave }}>¿Cuál es la configuración que maximiza la cantidad de cajas de este SKU en esta tarima?</p>
        <Sel etiqueta="Tarima" valor={tarimaSel} onChange={(v) => setTarimaSel(Number(v))} opciones={pallets.map((p, i) => [i, p.nombre])} />
        {rConfig ? (
          <Resultado estimado={rConfig.estimado} filas={[
            ["Cajas por nivel", rConfig.porCapa.toLocaleString("es-MX")],
            ["Niveles", rConfig.capas.toLocaleString("es-MX")],
            ["Total de cajas por pallet", rConfig.n.toLocaleString("es-MX")],
            ["Unidades totales por pallet", rConfig.piezas.toLocaleString("es-MX")],
            ["Altura del pallet cargado", u.fL(rConfig.alto, 1)],
            ["Peso del pallet cargado", u.fP(rConfig.peso)],
            ["% de utilización de la superficie", pct((rConfig.L * rConfig.W) / (pal.L * pal.W))],
          ]} />
        ) : <p className="text-sm mt-2" style={{ color: T.error }}>Este SKU no arma ni un pallet en esta tarima (revisa medidas y orientaciones).</p>}
      </Tarjeta>

      <Tarjeta titulo="Capacidad máxima en pallets completos">
        <p className="text-xs mb-2" style={{ color: T.suave }}>¿Cuántos pallets completos de este SKU puedo transportar en este vehículo? (nunca pallets parciales)</p>
        <Sel etiqueta="Vehículo" valor={veh.id || vehiculos[0]?.id} onChange={setVehSel} opciones={vehiculos.map((v) => [v.id, v.nombre])} />
        {rPallets && (
          rPallets.pallets > 0 ? (
            <Resultado estimado={rPallets.def.estimado} filas={[
              ["Pallet usado", rPallets.def.estandar ? `Estándar del SKU: ${rPallets.def.capas ? `${rPallets.def.capas} niveles × ${rPallets.def.porCapa}` : `${rPallets.cajasPorPallet} cajas`}` : "Configuración óptima (el SKU no tiene estándar)"],
              ["Pallets completos", rPallets.pallets.toLocaleString("es-MX")],
              ["Cajas por pallet", rPallets.cajasPorPallet.toLocaleString("es-MX")],
              ["Total de cajas", rPallets.cajasTotales.toLocaleString("es-MX")],
              ["Unidades totales", rPallets.piezasTotales.toLocaleString("es-MX")],
              ["% de ocupación del vehículo", pct(rPallets.vol / rPallets.volV)],
              ["Peso total transportado", u.fP(rPallets.peso)],
            ]} />
          ) : <p className="text-sm mt-2" style={{ color: T.error }}>Ni un pallet completo de este SKU cabe en este vehículo.</p>
        )}
      </Tarjeta>
    </>
  );
}
