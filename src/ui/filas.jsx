// ================= Filas =================
// Una fila de la tabla de mercancía o del maestro, con su ficha de reglas de estiba y paletizado; y el formulario de una tarima.
import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { ORIENTACIONES } from "../motor/reporte.js";
import { clave } from "../archivos/celdas.js";
import { T } from "./tema.js";
import { UM_COMUNES } from "../archivos/conversiones.js";
import { RESTOS } from "./referencia.js";
import { Num, Sel, Interruptor } from "./controles.jsx";
import { useUnidades } from "./unidadesContexto.jsx";

export function FormPallet({ p, editar }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <Num etiqueta="Largo" tipo="largo" valor={p.L} onChange={(v) => editar("L", v)} />
      <Num etiqueta="Ancho" tipo="largo" valor={p.W} onChange={(v) => editar("W", v)} />
      <Num etiqueta="Espesor" tipo="largo" valor={p.esp} onChange={(v) => editar("esp", v)} />
      <Num etiqueta="Peso" tipo="peso" valor={p.peso} onChange={(v) => editar("peso", v)} />
      <Num etiqueta="Altura máx." tipo="largo" valor={p.altMax} onChange={(v) => editar("altMax", v)} ayuda="Incluye la tarima" />
      <Num etiqueta="Carga máx." tipo="peso" valor={p.maxKg} onChange={(v) => editar("maxKg", v)} ayuda="0 = sin límite" />
      <Num etiqueta="Sobresale a lo largo" tipo="largo" valor={p.ovL ?? 0} onChange={(v) => editar("ovL", v)} ayuda="Cuánto pueden salir las cajas por cada extremo del largo de la tarima" />
      <Num etiqueta="Sobresale a lo ancho" tipo="largo" valor={p.ovW ?? 0} onChange={(v) => editar("ovW", v)} ayuda="Cuánto pueden salir las cajas por cada costado del ancho de la tarima" />
    </div>
  );
}

// Unidad de la caja: lista de unidades comunes, pero admite escribir cualquier otra
function SelUM({ etiqueta, valor, onChange }) {
  return (
    <label className="block text-xs" style={{ color: T.suave }} title="Unidad en la que el maestro guarda esta caja o bolsa. Si el pedido viene en otra, se convierte a esta.">
      <span className="block mb-1">{etiqueta}</span>
      <input list="um-comunes" value={valor} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-full rounded-md px-2 py-1.5 text-sm border outline-none" style={{ borderColor: T.linea, background: T.sup, color: T.tinta }} />
      <datalist id="um-comunes">{UM_COMUNES.map(([u, n]) => <option key={u} value={u}>{n}</option>)}</datalist>
    </label>
  );
}

export function FilaItem({ it, color, abierto, pallets, modoPallet, verMedidas = true, anchoSku = 200, onToggle, editar, quitar, difiere, enMaestro, aMaestro, deMaestro, mover, primera, ultima }) {
  const sinOri = !it.oris.some(Boolean);
  const u = useUnidades();
  const num = (k) => (e) => editar(k, Math.max(0, Number(e.target.value) || 0));
  // Medidas y peso se muestran y capturan en la unidad del usuario; por dentro siguen en mm y kg.
  const vista = (k, v) => (k === "peso" ? u.P(v) : ["L", "W", "H"].includes(k) ? u.L(v) : v);
  const numU = (k) => (e) => { const x = Math.max(0, Number(e.target.value) || 0); editar(k, k === "peso" ? u.aKg(x) : ["L", "W", "H"].includes(k) ? u.aMm(x) : x); };
  const td = { borderBottom: `1px solid ${T.linea}` };
  const celda = "celda w-full rounded px-1 py-1 text-sm outline-none";
  return (
    <>
      <tr className="fila">
        <td className="px-1 py-1" style={{ ...td, position: "sticky", left: 0, background: T.sup, zIndex: 1, width: anchoSku, minWidth: anchoSku, maxWidth: anchoSku }}>
          <div className="flex items-center gap-1.5">
            <button onClick={onToggle} aria-expanded={abierto} aria-label={`Reglas de ${it.nombre}`} className="flex-none flex items-center justify-center rounded" style={{ width: 18, height: 18 }}>
              <ChevronDown size={14} style={{ transform: abierto ? "none" : "rotate(-90deg)", transition: "transform .15s", color: sinOri ? T.error : T.suave }} />
            </button>
            <label className="flex-none relative rounded cursor-pointer" title="Cambiar color" style={{ width: 14, height: 14, background: color, boxShadow: it.color ? `0 0 0 2px #fff, 0 0 0 3px ${T.nav}` : "inset 0 0 0 1px rgba(0,0,0,.15)" }}>
              <input type="color" value={color} onChange={(e) => editar("color", e.target.value.toUpperCase())} aria-label={`Color de ${it.nombre}`} className="absolute inset-0 opacity-0 cursor-pointer" style={{ width: "100%", height: "100%" }} />
            </label>
            <input value={it.nombre} onChange={(e) => editar("nombre", e.target.value)} className={celda} style={{ minWidth: 76, textOverflow: "ellipsis" }} title={it.nombre} />
            {it.paletizar && !modoPallet && <span className="flex-none text-xs px-1.5 rounded" style={{ background: "#FFF4CC", color: T.aviso }} title={it.paletizar === "mixto" ? "Pallet mixto" : "Pallet de un SKU"}>{it.paletizar === "mixto" ? "PM" : `P${it.porPallet || ""}`}</span>}
            {it.esBundle && <span className="flex-none text-xs px-1.5 rounded" style={{ background: "#E6D9F7", color: "#5B3A9E" }} title={`Bundle: ${it.qty} × ${it.cantidadPorBundle} cajas`}>BDL</span>}
            {difiere && <span className="flex-none text-xs px-1.5 rounded" style={{ background: "#E8EEF8", color: T.nav }} title="Tiene ajustes solo para esta carga">ajustado</span>}
          </div>
        </td>
        {[...(verMedidas ? ["L", "W", "H", "peso"] : []), "qty"].map((k) => (
          <td key={k} className="px-0.5" style={{ ...td, width: 56, minWidth: 56 }}><input type="number" value={vista(k, it[k])} onChange={numU(k)} className={celda} aria-label={{ L: "Largo", W: "Ancho", H: "Alto", peso: "Peso", qty: "Cantidad" }[k]} /></td>
        ))}
        <td className="px-1 text-center whitespace-nowrap" style={{ ...td, width: 54, minWidth: 54, color: T.suave }}
          title={it.umPedido ? `${it.qtyPedido.toLocaleString("es-MX")} ${it.umPedido} = ${it.qty.toLocaleString("es-MX")} cajas` : "Volumen de esta línea"}>
          {u.V(it.L * it.W * it.H * it.qty).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
          {it.umPedido && <span className="block" style={{ fontSize: 10 }}>{it.qtyPedido.toLocaleString("es-MX")} {it.umPedido}</span>}
        </td>
        <td className="px-0.5" style={{ ...td, width: 52, minWidth: 52 }} title="Parada de la ruta: la 1 queda junto a las puertas. Vacío = se acomoda donde convenga, al fondo">
          <input type="number" value={it.orden || ""} placeholder="—" onChange={num("orden")} className={celda} style={{ fontWeight: it.orden ? 600 : 400 }} />
        </td>
        <td className="px-0.5" style={{ ...td, minWidth: 78 }}><input value={it.grupo} onChange={(e) => editar("grupo", e.target.value)} className={celda} placeholder="—" title="Número de pedido. Con «Mantener juntos los pedidos» activa, sus SKUs se cargan seguidos" /></td>
        <td className="px-0.5" style={{ ...td, minWidth: 92 }}><input value={it.destino || ""} onChange={(e) => editar("destino", e.target.value)} className={celda} placeholder="—" title="Ciudad o punto de entrega, para el resumen de entregas y el flete" /></td>
        {mover && (
          <td className="px-0.5 whitespace-nowrap" style={td}>
            <button onClick={() => mover(-1)} disabled={primera} aria-label="Subir esta línea" title="Subir: se carga antes, más al fondo" style={{ color: primera ? T.linea : T.suave }}><ChevronUp size={14} /></button>
            <button onClick={() => mover(1)} disabled={ultima} aria-label="Bajar esta línea" title="Bajar: se carga después, más cerca de las puertas" style={{ color: ultima ? T.linea : T.suave }}><ChevronDown size={14} /></button>
          </td>
        )}
        <td className="px-1" style={td}><button onClick={quitar} aria-label={`Quitar ${it.nombre}`} className="p-1 rounded" style={{ color: T.suave }}><Trash2 size={14} /></button></td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={(verMedidas ? 11 : 7) + (mover ? 1 : 0)} className="p-0" style={{ background: "#F7F9FB", borderBottom: `1px solid ${T.linea}` }}>
            <div className="p-3" style={{ position: "sticky", left: 0, width: "var(--anchoPanel, 100%)", boxSizing: "border-box" }}>
            {enMaestro && (
              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs rounded-md px-2 py-1.5" style={{ background: difiere ? "#E8EEF8" : "#F1F3F6", color: T.suave }}>
                <span className="flex-1">{difiere ? "Estos ajustes aplican solo a esta carga." : "Valores tomados del maestro. Si los cambias, aplican solo a esta carga."}</span>
                {difiere && <button onClick={aMaestro} className="underline" style={{ color: T.nav }}>Guardar en el maestro</button>}
                {difiere && <button onClick={deMaestro} className="underline">Volver a los del maestro</button>}
              </div>
            )}
            <ReglasSku it={it} editar={editar} pallets={pallets} modoPallet={modoPallet} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function IconoCaja({ dims, tapa, activa }) {
  // Caja en perspectiva con la tapa (lado "este lado arriba") en ámbar
  const [dx, dy, dz] = dims, m = Math.max(dx, dy, dz), k = 30 / m;
  const c = Math.cos(Math.PI / 6), s = 0.5;
  const P = (x, y, z) => [((x - y) * c) * k, ((x + y) * s - z) * k];
  const pts = [[0, 0, dz], [dx, 0, dz], [dx, dy, dz], [0, dy, dz], [dx, 0, 0], [dx, dy, 0], [0, dy, 0]].map((p) => P(...p));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), w = Math.max(...xs) - minX, h = Math.max(...ys) - minY;
  const T2 = (p) => `${(p[0] - minX + 4).toFixed(1)},${(p[1] - minY + 4).toFixed(1)}`;
  const cara = (arr) => arr.map((i) => T2(pts[i])).join(" ");
  const base = activa ? "#DCE3EC" : "#F1F3F6", borde = activa ? T.nav : "#A9B4C0", amb = activa ? T.acento : "#F6E7A8";
  return (
    <svg width={w + 8} height={h + 8} viewBox={`0 0 ${w + 8} ${h + 8}`} aria-hidden="true">
      <polygon points={cara([0, 1, 2, 3])} fill={tapa === "z" ? amb : base} stroke={borde} strokeWidth="1" />
      <polygon points={cara([3, 2, 5, 6])} fill={tapa === "y" ? amb : base} stroke={borde} strokeWidth="1" />
      <polygon points={cara([1, 4, 5, 2])} fill={tapa === "x" ? amb : base} stroke={borde} strokeWidth="1" />
    </svg>
  );
}
const PRESETS_ORI = [["Solo de pie", [true, true, false, false, false, false]], ["De pie y acostada", [true, true, true, true, false, false]], ["Todas", [true, true, true, true, true, true]]];
function SelectorOrientacion({ it, editar }) {
  const d = [[it.L, it.W, it.H], [it.W, it.L, it.H], [it.L, it.H, it.W], [it.H, it.L, it.W], [it.W, it.H, it.L], [it.H, it.W, it.L]];
  const tapa = ["z", "z", "y", "x", "y", "x"];
  const sinOri = !it.oris.some(Boolean);
  const preset = PRESETS_ORI.find(([, o]) => o.every((v, i) => v === it.oris[i]));
  const u = useUnidades();
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: sinOri ? T.error : T.suave }}>{sinOri ? "Elige al menos una forma de acomodar la caja" : "Cómo se puede acomodar la caja"}</span>
        <div className="flex gap-1">
          {PRESETS_ORI.map(([n, o]) => (
            <button key={n} onClick={() => editar("oris", o)} aria-pressed={preset?.[0] === n} className="text-xs px-2 py-0.5 rounded-full"
              style={{ border: `1px solid ${preset?.[0] === n ? T.nav : T.linea}`, background: preset?.[0] === n ? T.nav : T.sup, color: preset?.[0] === n ? "#fff" : T.suave }}>{n}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {ORIENTACIONES.map((n, k) => (
          <button key={k} onClick={() => editar("oris", it.oris.map((o, j) => (j === k ? !o : o)))} aria-pressed={it.oris[k]} title={`${n}: alto ${u.fL(d[k][2])}`}
            className="flex flex-col items-center rounded-md px-0.5 py-1" style={{ border: `1.5px solid ${it.oris[k] ? T.nav : T.linea}`, background: it.oris[k] ? "#fff" : "#F7F9FB", opacity: it.oris[k] ? 1 : 0.7 }}>
            <IconoCaja dims={d[k]} tapa={tapa[k]} activa={it.oris[k]} />
            <span className="text-center leading-tight mt-0.5" style={{ fontSize: 10, color: it.oris[k] ? T.tinta : T.suave }}>{n}</span>
            <span style={{ fontSize: 9, color: T.suave }}>alto {u.L(d[k][2]).toLocaleString("es-MX", { maximumFractionDigits: 1 })}</span>
          </button>
        ))}
      </div>
      <p className="mt-1" style={{ fontSize: 10, color: T.suave }}>La cara ámbar es la tapa de la caja (el lado que dice «este lado arriba»).</p>
    </div>
  );
}
// Al cambiar la forma se ajustan las medidas y las orientaciones que tienen sentido
function aplicarForma(it, forma, editar) {
  editar("forma", forma);
  if (forma === "barril") {
    const d = it.diametro || Math.max(it.L, it.W);
    editar("diametro", d); editar("L", d); editar("W", d);
    editar("oris", [true, false, false, false, false, false]);   // de pie
  } else if (forma === "tubo") {
    const d = it.diametro || Math.min(it.W, it.H);
    editar("diametro", d); editar("W", d); editar("H", d);
    editar("oris", [true, true, false, false, false, false]);    // acostado, puede girar
  }
}
function aplicarDiametro(it, d, editar) {
  editar("diametro", d);
  if (it.forma === "barril") { editar("L", d); editar("W", d); }
  else if (it.forma === "tubo") { editar("W", d); editar("H", d); }
}
const MODOS_PAL = [["no", "No, se carga suelta"], ["uno", "Pallet de un solo SKU"], ["mixto", "Pallet mixto (con otros SKUs)"]];
export const modoPal = (v) => (v === "mixto" ? "mixto" : v ? "uno" : "no");
export const valorPal = (m) => (m === "mixto" ? "mixto" : m === "uno");

// Lo avanzado (apilado, resistencia, posición) se pliega salvo que el SKU ya tenga algo distinto de lo normal
const tieneAvanzado = (it) => it.maxNiveles > 0 || it.valorApilar > 0 || it.pesoMaxEncima > 0 || (it.piezas || 1) !== 1 || it.compresion > 0 || (it.piso || "libre") !== "libre" || !it.soportaEncima || !!it.volteoPiso;
function ReglasSku({ it, editar, pallets, modoPallet }) {
  const m = modoPal(it.paletizar);
  const [avanzado, setAvanzado] = useState(() => tieneAvanzado(it));
  return (
    <>
      {!modoPallet && (
        <div className="mb-3">
          <Sel etiqueta="Paletizar antes de cargar" valor={m} onChange={(v) => editar("paletizar", valorPal(v))} opciones={MODOS_PAL} />
          {m !== "no" && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Sel etiqueta="Tarima" valor={it.palletId} onChange={(v) => editar("palletId", Number(v))} opciones={pallets.map((p, i) => [i, p.nombre])} />
              {m === "uno" && <Num etiqueta="Cajas por pallet" valor={it.porPallet} onChange={(v) => editar("porPallet", v)} ayuda="Total de cajas del pallet. 0 = las que quepan" />}
              {m === "uno" && <Sel etiqueta="Si sobran cajas" valor={it.resto} onChange={(v) => editar("resto", v)} opciones={RESTOS} />}
              {m === "uno" && <Num etiqueta="Cajas por nivel" valor={it.porCapa} onChange={(v) => editar("porCapa", v)} ayuda="Cuántas cajas en cada cama. 0 = la herramienta calcula el mejor acomodo" />}
              {m === "uno" && <Num etiqueta="Niveles" valor={it.capasPallet} onChange={(v) => editar("capasPallet", v)} ayuda="Cuántas camas de alto. 0 = las que permita la altura de la tarima" />}
              {m === "uno" && <p className="col-span-3 text-xs" style={{ color: T.suave }}>Con 0 en los tres campos el pallet se arma solo, buscando el mejor acomodo para las medidas de la caja.</p>}
              {m === "mixto" && <p className="col-span-2 text-xs self-end pb-1" style={{ color: T.suave }}>Se arma junto con los demás SKUs marcados como mixtos que usen la misma tarima (y el mismo pedido o entrega, si esas reglas están activas).</p>}
              <div className="col-span-3 grid grid-cols-2 gap-x-4">
                <Interruptor etiqueta="Acepta cajas encima" valor={it.aceptaCajas} onChange={(v) => editar("aceptaCajas", v)} />
                <Interruptor etiqueta="Acepta otro pallet encima" valor={it.aceptaPallet} onChange={(v) => editar("aceptaPallet", v)} />
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Sel etiqueta="Forma" valor={it.forma || "caja"} onChange={(v) => aplicarForma(it, v, editar)}
          opciones={[["caja", "Caja o bulto"], ["barril", "Barril o cilindro"], ["tubo", "Tubo o rollo"], ["teja", "Teja o placa"]]} />
        {(it.forma === "barril" || it.forma === "tubo") && (
          <Num etiqueta="Diámetro" tipo="largo" valor={it.diametro || 0} onChange={(v) => aplicarDiametro(it, v, editar)} ayuda="Ajusta las medidas de la caja que envuelve al cilindro" />
        )}
        <Num etiqueta="Anidado: sube por pieza" tipo="largo" valor={it.anidado || 0} onChange={(v) => editar("anidado", v)} ayuda="Cuánto crece la pila por cada pieza extra cuando una entra en la otra. 0 = no se anidan" />
        {it.anidado > 0 && <Num etiqueta="Máx. piezas anidadas" valor={it.maxAnidado || 0} onChange={(v) => editar("maxAnidado", v)} ayuda="Cuántas puede llevar una torre antes de empezar otra. 0 = las que quepan" />}
      </div>
      <SelectorOrientacion it={it} editar={editar} />
      <button onClick={() => setAvanzado(!avanzado)} aria-expanded={avanzado} className="flex items-center gap-1 text-xs mb-2" style={{ color: T.suave }}>
        <ChevronDown size={14} style={{ transform: avanzado ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
        Apilado, resistencia y posición{!avanzado && tieneAvanzado(it) ? " · con ajustes" : ""}
      </button>
      {avanzado && <>
      <div className="grid grid-cols-3 gap-2">
        <Num etiqueta="Máx. cajas apiladas" valor={it.maxNiveles} onChange={(v) => editar("maxNiveles", v)} ayuda="Cuántas cajas de este SKU pueden ir una sobre otra. 0 = sin límite" />
        <Num etiqueta="Prioridad de apilamiento" valor={it.valorApilar} onChange={(v) => editar("valorApilar", v)} ayuda="Mayor número = va más abajo. Una caja de 3 puede llevar encima cajas de 3, 2 o 1, nunca de 4. 0 = no usar" />
        <Num etiqueta="Peso máx. encima" tipo="peso" valor={it.pesoMaxEncima} onChange={(v) => editar("pesoMaxEncima", v)} ayuda="Resistencia de la caja. 0 = sin límite" />
        <Num etiqueta="Piezas por caja" valor={it.piezas} onChange={(v) => editar("piezas", v)} />
        <SelUM etiqueta="UM de la caja" valor={it.umCaja || "CJ"} onChange={(v) => editar("umCaja", v)} />
        <label className="block text-xs" style={{ color: T.suave }} title="Agrupa productos con reglas de apilamiento en común, por ejemplo «Tejas». Se usa con la regla «Solo sobre la misma categoría».">
          <span className="block mb-1">Categoría</span>
          <input list="categorias-existentes" value={it.categoria || ""} onChange={(e) => editar("categoria", e.target.value)} className="w-full rounded-md px-2 py-1.5 text-sm border outline-none" style={{ borderColor: T.linea, background: T.sup, color: T.tinta }} />
        </label>
        <Num etiqueta="Compresión bajo carga %" valor={it.compresion} onChange={(v) => editar("compresion", Math.min(40, v))} ayuda="Cuánto se aplasta la caja o bolsa cuando lleva otra encima. 0 = rígida" />
        <Sel etiqueta="Posición" valor={it.piso} onChange={(v) => editar("piso", v)} opciones={[["libre", "Donde convenga"], ["soloPiso", "Solo en el piso"], ["noPiso", "Nunca en el piso"]]} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 mt-1">
        <Interruptor etiqueta="Soporta carga encima" valor={it.soportaEncima} onChange={(v) => editar("soportaEncima", v)} />
        <Interruptor etiqueta="Acostada directo en el piso" detalle="Permite las formas acostada o de canto en la primera capa" valor={it.volteoPiso} onChange={(v) => editar("volteoPiso", v)} />
      </div>
      </>}
    </>
  );
}

// Parámetros de Bundle (BDL): solo se configuran en el maestro, por SKU. Ver archivos/bundle.js.
function BloqueBundle({ p, editar }) {
  const [abierto, setAbierto] = useState(() => !!p.bundleActivo);
  return (
    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.linea}` }}>
      <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex items-center gap-1 text-xs mb-2" style={{ color: T.suave }}>
        <ChevronDown size={14} style={{ transform: abierto ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
        Bundle (BDL){p.bundleActivo ? " · activo" : ""}
      </button>
      {abierto && (
        <>
          <div className="grid grid-cols-2 gap-x-4 mb-2">
            <Interruptor etiqueta="Activar agrupación en Bundle" valor={p.bundleActivo} onChange={(v) => editar("bundleActivo", v)} />
            <Interruptor etiqueta="Manufactura propia" detalle="El Bundle solo aplica a manufactura propia" valor={p.manufacturaPropia} onChange={(v) => editar("manufacturaPropia", v)} />
          </div>
          {p.bundleActivo && (
            <div className="grid grid-cols-3 gap-2">
              <Num etiqueta="% máximo en Bundle" valor={p.bundlePct} onChange={(v) => editar("bundlePct", Math.min(99.99, v))} ayuda="Mayor a 0% y menor a 100%. Es la parte de lo pedido que se intenta convertir en Bundles completos" />
              <Num etiqueta="Cajas por Bundle" valor={p.bundleCantidadEstandar} onChange={(v) => editar("bundleCantidadEstandar", v)} ayuda="Cuántas cajas de este SKU entran en un Bundle completo" />
              <Num etiqueta="Peso Bundle" tipo="peso" valor={p.bundlePeso} onChange={(v) => editar("bundlePeso", v)} ayuda="0 = se calcula como el peso de la caja × cajas por Bundle" />
              <Num etiqueta="Largo Bundle" tipo="largo" valor={p.bundleL} onChange={(v) => editar("bundleL", v)} />
              <Num etiqueta="Ancho Bundle" tipo="largo" valor={p.bundleW} onChange={(v) => editar("bundleW", v)} />
              <Num etiqueta="Alto Bundle" tipo="largo" valor={p.bundleH} onChange={(v) => editar("bundleH", v)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FilaMaestro({ p, pallets, abierto, onToggle, editar, quitar, aCarga }) {
  const u = useUnidades();
  const numU = (k) => (e) => { const x = Math.max(0, Number(e.target.value) || 0); editar(k, k === "peso" ? u.aKg(x) : u.aMm(x)); };
  const td = { borderBottom: `1px solid ${T.linea}` };
  const celda = "celda w-full rounded px-1.5 py-1 text-sm outline-none";
  const pi = Math.max(0, pallets.findIndex((t) => clave(t.nombre) === clave(p.tarima)));
  const itAdapt = { ...p, palletId: pi };
  const editarAdapt = (k, v) => (k === "palletId" ? editar("tarima", pallets[v]?.nombre || "") : editar(k, v));
  const incompleto = !(p.L > 0 && p.W > 0 && p.H > 0) || !p.sku;
  return (
    <>
      <tr className="fila">
        <td className="px-1 py-1" style={td}>
          <div className="flex items-center gap-1">
            <button onClick={onToggle} aria-expanded={abierto} aria-label={`Reglas de ${p.sku}`} className="flex-none" style={{ width: 18 }}>
              <ChevronDown size={14} style={{ transform: abierto ? "none" : "rotate(-90deg)", transition: "transform .15s", color: incompleto ? T.error : T.suave }} />
            </button>
            <input value={p.sku} onChange={(e) => editar("sku", e.target.value)} className={celda} style={{ minWidth: 80, fontWeight: 600 }} />
          </div>
        </td>
        <td className="px-0.5" style={td}><input value={p.desc} onChange={(e) => editar("desc", e.target.value)} className={celda} style={{ minWidth: 110 }} placeholder="—" /></td>
        {["L", "W", "H", "peso"].map((k) => (
          <td key={k} className="px-0.5" style={{ ...td, width: 60 }}><input type="number" value={k === "peso" ? u.P(p[k]) : u.L(p[k])} onChange={numU(k)} className={celda} /></td>
        ))}
        <td className="px-1 text-xs whitespace-nowrap" style={{ ...td, color: p.paletizar ? T.aviso : T.suave }}>{p.paletizar === "mixto" ? "Mixto" : p.paletizar ? `×${p.porPallet || "máx"}` : "—"}</td>
        <td className="px-1 whitespace-nowrap" style={td}>
          <button onClick={aCarga} className="text-xs px-1.5 py-0.5 rounded" style={{ border: `1px solid ${T.linea}` }} title="Agregar a la carga actual">+ carga</button>
          <button onClick={quitar} aria-label={`Eliminar ${p.sku} del maestro`} className="p-1 ml-0.5" style={{ color: T.suave }}><Trash2 size={14} /></button>
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={8} className="p-0" style={{ background: "#F7F9FB", borderBottom: `1px solid ${T.linea}` }}>
            <div className="p-3" style={{ position: "sticky", left: 0, width: "var(--anchoPanel, 100%)", boxSizing: "border-box" }}>
            <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: T.suave }}>
              Color en el visor:
              <label className="relative rounded cursor-pointer" style={{ width: 18, height: 14, background: p.color || "#FFFFFF", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.2)" }}>
                <input type="color" value={p.color || "#FFFFFF"} onChange={(e) => editar("color", e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" style={{ width: "100%", height: "100%" }} aria-label="Color del SKU" />
              </label>
              {p.color ? <button className="underline" onClick={() => editar("color", null)}>usar paleta</button> : <span>usa la paleta</span>}
            </div>
            <ReglasSku it={itAdapt} editar={editarAdapt} pallets={pallets} modoPallet={false} />
            <BloqueBundle p={p} editar={editar} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
