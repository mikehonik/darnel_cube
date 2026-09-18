import { Plus } from "lucide-react";
import { T } from "../tema.js";
import { Tarjeta, estInp, inp } from "../controles.jsx";
import { FormPallet, modoPal, valorPal } from "../filas.jsx";

export function SeccionPaletizado({ colores, editarItem, editarPallet, items, nPalletizados, pallets, setPallets }) {
  return (
    <>
      <h2 className="text-lg font-semibold mb-1">Paletizado</h2>
      <p className="text-xs mb-3" style={{ color: T.suave }}>Elige por SKU: Suelta, pallet de Un SKU o pallet Mixto (se combinan los SKUs mixtos que usan la misma tarima). Los pallets se arman primero y luego entran al vehículo con lo suelto. Para diseñar un solo pallet a mano, en Vehículo elige una tarima.</p>
      <Tarjeta titulo="SKUs paletizados">
        {nPalletizados === 0 && <p className="text-sm" style={{ color: T.suave }}>Ningún SKU se paletiza todavía. Actívalo aquí o en las reglas de cada fila.</p>}
        <div className="flex flex-col gap-1" style={{ maxHeight: 260, overflowY: "auto" }}>
          {items.map((it, i) => (
            <div key={it.id} className="flex items-center gap-2 text-sm py-1">
              <span style={{ width: 10, height: 10, background: colores[i], borderRadius: 2, flex: "none" }} />
              <span className="flex-1 truncate">{it.nombre}</span>
              <select value={modoPal(it.paletizar)} onChange={(e) => editarItem(it.id, "paletizar", valorPal(e.target.value))} className={inp} style={{ ...estInp, width: 110 }} aria-label={`Paletizar ${it.nombre}`}>
                <option value="no">Suelta</option><option value="uno">Un SKU</option><option value="mixto">Mixto</option>
              </select>
              {it.paletizar === true && <>
                <input type="number" value={it.porPallet} onChange={(e) => editarItem(it.id, "porPallet", Math.max(0, +e.target.value || 0))} className={inp} style={{ ...estInp, width: 64 }} aria-label="Cajas por pallet" title="Cajas por pallet (0 = máximo)" />
                <span className="text-xs" style={{ color: T.suave }}>/pallet</span>
              </>}
            </div>
          ))}
        </div>
      </Tarjeta>
      <Tarjeta titulo="Catálogo de tarimas" accion={<button className="flex items-center gap-1 text-xs" style={{ color: T.suave }} onClick={() => setPallets((a) => [...a, { ...PALLETS_INICIALES[0], nombre: `Tarima ${a.length + 1}` }])}><Plus size={14} />Agregar</button>}>
        {pallets.map((p, i) => (
          <div key={i} className="mb-3 pb-3" style={{ borderBottom: i < pallets.length - 1 ? `1px solid ${T.linea}` : "none" }}>
            <input value={p.nombre} onChange={(e) => editarPallet(i, "nombre", e.target.value)} className={inp + " mb-2 font-medium"} style={estInp} aria-label="Nombre de la tarima" />
            <FormPallet p={p} editar={(k, v) => editarPallet(i, k, v)} />
          </div>
        ))}
      </Tarjeta>
    </>
  );
}
