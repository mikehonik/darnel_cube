import { NIVELES, REGLAS_APILAR } from "../referencia.js";
import { T } from "../tema.js";
import { Interruptor, Num, Sel, Tarjeta } from "../controles.jsx";

export function SeccionReglas({ editarRegla, reglas }) {
  return (
    <>
      <h2 className="text-lg font-semibold mb-3">Reglas de cálculo</h2>
      <Tarjeta titulo="Optimización">
        <div className="grid grid-cols-2 gap-2">
          <Sel etiqueta="Nivel" valor={reglas.nivel} onChange={(v) => editarRegla("nivel", Number(v))} opciones={NIVELES} />
          <Num etiqueta="Apoyo mínimo bajo cada caja %" valor={reglas.soporteMin} onChange={(v) => editarRegla("soporteMin", Math.min(100, v))} />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Cajas del mismo SKU">
        <div className="grid grid-cols-2 gap-2">
          {[[true, "Mantener juntas", "Arma bloques y columnas del mismo SKU. Más fácil de cargar y descargar."], [false, "Permitir separar", "Reparte cajas del mismo SKU en huecos para aprovechar espacio."]].map(([v, t, d]) => (
            <button key={t} onClick={() => editarRegla("juntos", v)} aria-pressed={reglas.juntos === v} className="text-left rounded-lg p-3"
              style={{ border: `1.5px solid ${reglas.juntos === v ? T.nav : T.linea}`, background: reglas.juntos === v ? T.shell : T.sup }}>
              <span className="block text-sm font-medium">{t}</span>
              <span className="block text-xs mt-0.5" style={{ color: T.suave }}>{d}</span>
            </button>
          ))}
        </div>
      </Tarjeta>
      <Tarjeta titulo="Estiba">
        <Sel etiqueta="Regla de apilamiento" valor={reglas.apilamiento} onChange={(v) => editarRegla("apilamiento", v)} opciones={REGLAS_APILAR} />
        <div className="mt-2 divide-y" style={{ borderColor: T.linea }}>
          <Interruptor etiqueta="Respetar peso bruto máximo" valor={reglas.limitarPeso} onChange={(v) => editarRegla("limitarPeso", v)} />
                  <Interruptor etiqueta="Simular la carga real" detalle="Reproduce cómo se carga en el piso, no el óptimo teórico. Los bultos van de pie y solo se rotan donde ya no caben de pie: contra una pared, bajo el techo o en el sobrante. Las bolsas ceden bajo el peso de lo que llevan encima (4%, y la de hasta arriba nada); las cajas no ceden. Entre cajas queda una holgura chica que crece con la variedad de productos. Calibrado contra 1,841 contenedores reales. Apágalo para ver el óptimo geométrico puro." valor={reglas.compresionAuto !== false} onChange={(v) => editarRegla("compresionAuto", v)} />
          <Interruptor etiqueta="Ordenar por entrega (ruta)" detalle="La parada 1 se entrega primero, así que se carga al final y queda junto a las puertas. Las paradas altas van al fondo. Mismo número = se cargan juntos. Sin número = se acomodan donde convenga, al fondo." valor={reglas.usarOrden} onChange={(v) => editarRegla("usarOrden", v)} />
                  <Interruptor etiqueta="Cargar en el orden de la lista" detalle="La primera fila del pedido entra primero y queda al fondo. Aparecen flechas para subir o bajar cada línea y la carga se vuelve a acomodar sola. Si además usas entregas, la parada manda y la lista solo decide el orden dentro de cada parada." valor={reglas.usarLista} onChange={(v) => editarRegla("usarLista", v)} />
          <Interruptor etiqueta="Mantener juntos los pedidos" detalle="Los SKUs del mismo pedido o destino se cargan seguidos, dentro de su parada." valor={reglas.agrupar} onChange={(v) => editarRegla("agrupar", v)} />
                  <Interruptor etiqueta="Un vehículo por pedido" detalle="No mezcla pedidos distintos en el mismo vehículo. Útil para transferencias que viajan por separado; se usan más vehículos." valor={reglas.separarGrupos} onChange={(v) => editarRegla("separarGrupos", v)} />
        </div>
      </Tarjeta>
      {reglas.usarOrden && (
        <Tarjeta titulo="Qué tan estricto es el orden de entrega">
          <div className="grid grid-cols-2 gap-2">
            {[["estricto", "Estricto", "Cada entrega en su zona. Descarga limpia, aunque a veces ocupa más vehículos."], ["flexible", "Flexible", "Permite que una entrega se meta un poco en la zona anterior. Aprovecha mejor el espacio; algunos bultos habrá que moverlos."]].map(([v, t, d]) => (
              <button key={v} onClick={() => editarRegla("rigor", v)} aria-pressed={(reglas.rigor || "estricto") === v} className="text-left rounded-lg p-3"
                style={{ border: `1.5px solid ${(reglas.rigor || "estricto") === v ? T.nav : T.linea}`, background: (reglas.rigor || "estricto") === v ? T.shell : T.sup }}>
                <span className="block text-sm font-medium">{t}</span>
                <span className="block text-xs mt-0.5" style={{ color: T.suave }}>{d}</span>
              </button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: T.suave }}>Después de calcular, la pestaña Entregas dice cuántos bultos estorban con cada opción.</p>
        </Tarjeta>
      )}
    </>
  );
}
