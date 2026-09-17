import { AYUDA } from "../../archivos/maestro.js";
import { T } from "../tema.js";
import { Tarjeta } from "../controles.jsx";

export function SeccionAyuda({  }) {
  return (
    <>
      <h2 className="text-lg font-semibold leading-tight">Ayuda</h2>
      <p className="text-xs mb-3" style={{ color: T.suave }}>Así se usa: 1) conecta el maestro de productos, 2) sube el pedido con SKU y cantidad, 3) elige el vehículo y presiona Calcular carga. Lo mismo está en la hoja Instrucciones del maestro.</p>
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
