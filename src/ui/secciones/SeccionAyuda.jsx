import { AYUDA } from "../../archivos/maestro.js";
import { T } from "../tema.js";
import { Tarjeta } from "../controles.jsx";
import { NOVEDADES, VERSION_COMPLETA } from "../../version.js";

export function SeccionAyuda({  }) {
  return (
    <>
      <h2 className="text-lg font-semibold leading-tight">Ayuda</h2>
      <p className="text-xs mb-3" style={{ color: T.suave }}>Así se usa: 1) conecta el maestro de productos, 2) sube el pedido con SKU y cantidad, 3) elige el vehículo y presiona Calcular carga. Lo mismo está en la hoja Instrucciones del maestro.</p>
      <Tarjeta titulo={`Novedades · versión ${VERSION_COMPLETA}`}>
        {NOVEDADES.map((n, i) => (
          <div key={n.version} className="py-2 text-sm" style={{ borderTop: i ? `1px solid ${T.linea}` : "none" }}>
            <p className="font-medium">Versión {n.version} <span className="font-normal text-xs" style={{ color: T.suave }}>· {n.fecha}</span></p>
            <ul className="list-disc pl-5 mt-1" style={{ color: T.suave }}>{n.cambios.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        ))}
      </Tarjeta>
      {[...new Set(AYUDA.map((a) => a[0]))].map((g) => (
        <Tarjeta key={g} titulo={g}>
          <dl className="text-sm">
            {AYUDA.filter((a) => a[0] === g).map(([, campo, que, ej, vacio]) => (
              <div key={campo} className="py-2" style={{ borderTop: `1px solid ${T.linea}` }}>
                <dt className="font-medium">{campo}</dt>
                <dd style={{ color: T.suave }}>{que}</dd>
                <dd className="text-xs mt-0.5" style={{ color: T.suave }}>Ejemplo: <span style={{ color: T.tinta }}>{ej}</span> · Vacío: <span style={{ color: T.tinta }}>{vacio}</span></dd>
              </div>
            ))}
          </dl>
        </Tarjeta>
      ))}
    </>
  );
}
