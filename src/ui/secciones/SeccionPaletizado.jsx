// ================= Paletizado =================
// Solo el catálogo de pallets: aquí se crean y editan (medidas, altura y peso máximos, sobresaliente).
// Cómo se paletiza cada SKU se elige en su línea del pedido, que es donde se usa; antes también se podía
// elegir aquí y la misma decisión quedaba en dos lugares.
import { Plus, Trash2, Copy } from "lucide-react";
import { T } from "../tema.js";
import { Tarjeta, estInp, inp } from "../controles.jsx";
import { FormPallet } from "../filas.jsx";
import { PALLETS_INICIALES } from "../referencia.js";

export function SeccionPaletizado({ editarPallet, pallets, setPallets, quitarPallet, usos }) {
  const agregar = (base) => setPallets((a) => [...a, { ...(base || PALLETS_INICIALES[0]), nombre: base ? `${base.nombre} (copia)` : `Pallet ${a.length + 1}` }]);
  return (
    <>
      <h2 className="text-lg font-semibold mb-1">Paletizado</h2>
      <p className="text-xs mb-3" style={{ color: T.suave }}>
        Catálogo de pallets. Los que crees aquí aparecen para elegir en cada línea del pedido (al abrir la fila) y en Herramientas.
        Para diseñar un solo pallet a mano, en Vehículo elige un pallet como espacio de carga.
      </p>
      <Tarjeta titulo="Catálogo de pallets" accion={<button className="flex items-center gap-1 text-xs" style={{ color: T.suave }} onClick={() => agregar()}><Plus size={14} />Agregar pallet</button>}>
        {pallets.map((p, i) => (
          <div key={i} className="mb-3 pb-3" style={{ borderBottom: i < pallets.length - 1 ? `1px solid ${T.linea}` : "none" }}>
            <div className="flex items-center gap-2 mb-2">
              <input value={p.nombre} onChange={(e) => editarPallet(i, "nombre", e.target.value)} className={inp + " font-medium"} style={estInp} aria-label="Nombre del pallet" />
              <button onClick={() => agregar(p)} className="p-1.5 rounded-md flex-none" style={{ border: `1px solid ${T.linea}`, color: T.suave }} title="Duplicar este pallet" aria-label={`Duplicar ${p.nombre}`}><Copy size={14} /></button>
              <button onClick={() => quitarPallet(i)} disabled={pallets.length < 2} className="p-1.5 rounded-md flex-none" style={{ border: `1px solid ${T.linea}`, color: T.error, opacity: pallets.length < 2 ? 0.4 : 1 }}
                title={pallets.length < 2 ? "Debe quedar al menos un pallet" : "Quitar este pallet"} aria-label={`Quitar ${p.nombre}`}><Trash2 size={14} /></button>
            </div>
            {usos[i] > 0 && <p className="text-xs mb-2" style={{ color: T.suave }}>Lo usan {usos[i]} {usos[i] === 1 ? "línea" : "líneas"} del pedido.</p>}
            <FormPallet p={p} editar={(k, v) => editarPallet(i, k, v)} />
          </div>
        ))}
      </Tarjeta>
    </>
  );
}
