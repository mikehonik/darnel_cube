// ================= Optimizar el pedido (sobre el 3D) =================
// En cuanto termina el cálculo, si sobra espacio o salió un vehículo de más, aquí mismo están los botones:
// «Llenar con pedido sugerido» y «Sugerir disminución del pedido». Los dos calculan en nivel 4, muestran una
// vista previa (qué cambia y cómo queda la ocupación) y solo al aplicar cambian el pedido. Ver motor/optimizarPedido.js.
import { useEffect, useState } from "react";
import { PackagePlus, PackageMinus, PackageOpen, Layers, Loader2, X, Lock, Unlock, Undo2, CheckCircle2, Info, Zap, Maximize2 } from "lucide-react";
import { T } from "../tema.js";
import { pctProgreso } from "../referencia.js";
import { NotaCargaReal } from "./AvisoCargaReal.jsx";

const nVeh = (n) => `${n} ${n === 1 ? "vehículo" : "vehículos"}`;
const pcts = (lista) => lista.map((p) => `${p.toFixed(0)}%`).join(" + ");

const Boton = ({ onClick, children, primario, titulo }) => (
  <button onClick={onClick} title={titulo} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap"
    style={primario ? { background: T.nav, color: "#fff" } : { border: `1px solid ${T.linea}`, background: T.sup, color: T.tinta }}>{children}</button>
);

export function OptimizarPedido({ reporte, items, optim, progreso, onCalcular, onAplicar, onDeshacer, onCerrar, onCancelar, onFijarLinea, costoReal, onQuitarSimulacion, cargaReal, lleno }) {
  const [oculto, setOculto] = useState(false);
  useEffect(() => { setOculto(false); }, [reporte]);
  // El candado es el mismo de la tabla del pedido (it.fijo): lo que se fija aquí queda fijo allá.
  const fijas = new Set(items.filter((it) => it.fijo).map((it) => it.id));
  if (!reporte) return null;
  const caja = (contenido) => (
    <div className="absolute left-3 z-10 rounded-lg shadow-lg text-sm pointer-events-auto" style={{ bottom: 64, width: 340, maxWidth: "calc(100% - 24px)", maxHeight: "calc(100% - 110px)", overflowY: "auto", background: "rgba(255,255,255,.97)", border: `1px solid ${T.linea}` }}>{contenido}</div>
  );

  if (optim?.aplicado) return caja(
    <div className="flex items-center gap-2 px-3 py-2">
      <CheckCircle2 size={15} color={T.ok} className="flex-none" />
      <span className="flex-1 text-xs">Pedido ajustado con la sugerencia.</span>
      <Boton onClick={onDeshacer}><Undo2 size={13} />Deshacer</Boton>
      <button onClick={onCerrar} aria-label="Cerrar"><X size={14} color={T.suave} /></button>
    </div>
  );

  if (optim?.calculando) return caja(
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2 font-semibold"><Loader2 size={15} className="animate-spin" />{optim.tipo === "llenar" ? (optim.saturar ? "Llenando hasta el tope" : "Buscando qué más cabe") : "Buscando cómo usar un vehículo menos"}</div>
      <p className="text-xs mt-1" style={{ color: T.suave }}>{progreso?.fase || "Calculando en nivel 4…"}</p>
      {optim.sinSimular && <p className="text-xs mt-0.5" style={{ color: T.aviso }}>Sin simular la carga real: maximizando el espacio geométrico.</p>}
      {/* Barra y porcentaje en vez de «intento 3 de 7»: el total cambia durante la búsqueda y el texto
          cambiaba de ancho, así que la tarjeta se movía sola mientras calculaba. */}
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: T.linea }}>
          <div style={{ width: `${pctProgreso(progreso)}%`, height: "100%", background: T.nav, transition: "width .3s" }} />
        </div>
        {/* El mismo número que el botón de arriba: una sola barra para todo el cálculo, que solo sube */}
        <span className="tabular-nums" style={{ fontSize: 11, color: T.suave, minWidth: 30, textAlign: "right" }}>{pctProgreso(progreso)}%</span>
      </div>
      <p className="text-xs mt-1" style={{ color: T.suave }}>
        {optim.saturar ? "Exprimiendo: prueba referencia por referencia hasta que no entre ni una caja más. Tarda, y se puede cancelar."
          : optim.nivel === 1 ? "En nivel 1 sale en segundos, pero sugiere menos: acomoda peor que el cálculo bueno."
          : "En nivel 4 cada cálculo tarda hasta medio minuto, y la búsqueda hace varios."}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {optim.nivel !== 1 && (
          <Boton primario onClick={() => onCalcular(optim.tipo, fijas, { nivel: 1 })} titulo="Repite la búsqueda en nivel 1: sale en segundos, aunque sugiera menos">
            <Zap size={13} />Rehacer rápido (nivel 1)
          </Boton>
        )}
        <Boton onClick={onCancelar}><X size={13} />Cancelar</Boton>
      </div>
    </div>
  );

  const pr = optim?.propuesta;

  // --- Dejar un SKU sin paletizar ---
  if (pr && pr.tipo === "sinPaletizar") return caja(
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2 font-semibold">
        <PackageMinus size={15} color={T.ok} /><span className="flex-1">Sin paletizar un SKU</span>
        <button onClick={onCerrar} aria-label="Cerrar"><X size={14} color={T.suave} /></button>
      </div>
      <p className="text-xs mt-1" style={{ color: pr.elegido ? T.tinta : T.suave }}>
        {pr.elegido
          ? `Si ${pr.elegido} viaja suelto en vez de en pallet, la carga queda en ${nVeh(pr.despues.n)} (${pcts(pr.despues.ocupaciones)}) en lugar de ${nVeh(pr.antes.n)}. El pallet cobra su tarima y el aire que queda arriba; suelto, ese SKU rellena los huecos de los demás.`
          : pr.motivo === "sinCandidatos" ? "No hay SKUs paletizados que se puedan soltar: están fijos con el candado."
          : "Soltar cualquiera de los SKUs paletizados no ahorra un vehículo en este pedido."}
      </p>
      {pr.opciones?.length > 1 && (
        <p className="mt-1" style={{ fontSize: 10, color: T.suave }}>También sirven: {pr.opciones.slice(1).map((o) => o.nombre).join(", ")}.</p>
      )}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {pr.elegido && <Boton primario onClick={onAplicar}><CheckCircle2 size={13} />Dejar {pr.elegido} suelto</Boton>}
        <Boton onClick={onCerrar}>{pr.elegido ? "Cancelar" : "Cerrar"}</Boton>
      </div>
    </div>
  );

  // --- Juntar los pallets de un SKU que van medio vacíos ---
  if (pr && pr.tipo === "palletMixto") return caja(
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2 font-semibold">
        <Layers size={15} color={T.aviso} /><span className="flex-1">Pallets mixtos</span>
        <button onClick={onCerrar} aria-label="Cerrar"><X size={14} color={T.suave} /></button>
      </div>
      <p className="text-xs mt-1" style={{ color: pr.motivo ? T.suave : T.tinta }}>
        {!pr.motivo
          ? `Armando ${pr.pobres.join(", ")} en pallets mixtos en vez de un pallet por SKU, la carga queda en ${nVeh(pr.despues.n)} (${pcts(pr.despues.ocupaciones)}) en lugar de ${nVeh(pr.antes.n)}.`
          : pr.motivo === "pocosPobres" ? "No hay suficientes pallets de un SKU yendo medio vacíos como para juntarlos."
          : `Juntar ${pr.pobres.join(", ")} en pallets mixtos no ahorra un vehículo en este pedido.`}
      </p>
      {!pr.motivo && <p className="mt-1" style={{ fontSize: 10, color: T.suave }}>En el andén cuesta más armarlos: se mezclan SKUs en la misma tarima, lo más pesado abajo.</p>}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {!pr.motivo && <Boton primario onClick={onAplicar}><CheckCircle2 size={13} />Armar mixtos</Boton>}
        <Boton onClick={onCerrar}>{pr.motivo ? "Cerrar" : "Cancelar"}</Boton>
      </div>
    </div>
  );

  // --- Elegir a mano qué Bundles se abren ---
  if (pr && pr.tipo === "abrirBundles") {
    const total = pr.lineas.reduce((a, l) => a + l.abiertos, 0);
    const mover = (id, d) => {
      const l = pr.lineas.find((x) => x.id === id); if (!l) return;
      const k = Math.max(0, Math.min(l.bundles, l.abiertos + d));
      if (k === l.abiertos) return;
      onCalcular("abrirBundles", fijas, { abiertos: Object.fromEntries(pr.lineas.map((x) => [x.id, x.id === id ? k : x.abiertos])) });
    };
    return caja(
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 font-semibold">
          <PackageOpen size={15} color={T.nav} /><span className="flex-1">Qué Bundles se abren</span>
          <button onClick={onCerrar} aria-label="Cerrar"><X size={14} color={T.suave} /></button>
        </div>
        <p className="text-xs mt-1">
          Con {total} {total === 1 ? "Bundle abierto" : "Bundles abiertos"} la carga queda en {nVeh(pr.despues.n)} ({pcts(pr.despues.ocupaciones)}).
        </p>
        <table className="w-full text-xs mt-2">
          <thead><tr style={{ color: T.suave }}><th className="text-left font-normal">SKU</th><th className="text-right font-normal">Tiene</th><th className="text-right font-normal">Se abren</th><th /></tr></thead>
          <tbody>
            {pr.lineas.map((l) => (
              <tr key={l.id} style={{ borderTop: `1px solid ${T.linea}` }}>
                <td className="py-1 pr-1 truncate" style={{ maxWidth: 120 }} title={`${l.nombre} · ${l.cajasPorBundle} cajas por Bundle`}>{l.nombre}</td>
                <td className="text-right" style={{ color: T.suave }}>{l.bundles}</td>
                <td className="text-right font-semibold" style={{ color: l.abiertos ? T.nav : T.suave }}>{l.abiertos}</td>
                <td className="text-right pl-1 whitespace-nowrap">
                  <button onClick={() => mover(l.id, -1)} disabled={!l.abiertos} aria-label={`Abrir un Bundle menos de ${l.nombre}`} style={{ opacity: l.abiertos ? 1 : 0.3, padding: "0 4px" }}>−</button>
                  <button onClick={() => mover(l.id, 1)} disabled={l.abiertos >= l.bundles} aria-label={`Abrir un Bundle más de ${l.nombre}`} style={{ opacity: l.abiertos < l.bundles ? 1 : 0.3, padding: "0 4px" }}>+</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="flex items-start gap-1 mt-1.5" style={{ fontSize: 10, color: T.suave }}>
          <Info size={11} className="flex-none mt-px" />Las cajas de los Bundles abiertos se cargan antes que los Bundles enteros, después de los pallets.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Boton primario onClick={onAplicar}><CheckCircle2 size={13} />Aplicar</Boton>
          <Boton onClick={() => onCalcular("abrirBundles", fijas, { abiertos: Object.fromEntries(pr.lineas.map((l) => [l.id, l.bundles])) })}>Abrir todos</Boton>
          <Boton onClick={onCerrar}>Cancelar</Boton>
        </div>
      </div>
    );
  }

  if (pr) {
    const cambiaron = [...fijas].sort().join() !== [...(optim.fijas || [])].sort().join();
    const alternarFija = (id) => onFijarLinea?.(id);
    const sinCambio = !pr.cambios.length && pr.tipo !== "reacomodo";
    const mensaje = pr.tipo === "reacomodo" ? `Sin cambiar cantidades, reacomodando la carga cabe en ${nVeh(pr.despues.n)} (${pcts(pr.despues.ocupaciones)}).`
      : sinCambio ? (pr.tipo === "llenar"
        ? (pr.motivo === "sinCandidatos" ? "No hay líneas que se puedan aumentar: todas están fijas con el candado."
          : pr.motivo === "sumabaVehiculo" ? "Lo que cabía en los huecos solo entraba sumando otro vehículo, así que no se propone: llenar no puede costar un camión."
          : pr.motivo === "noSeComprobo" ? "Se encontró espacio, pero al recalcular el pedido completo la carga ya no cupo igual. Prueba soltando algún candado o agregando tú la cantidad."
          : "No cabe ni una caja más de los SKUs del pedido sin sumar un vehículo.")
        : "No se encontró una disminución que quite un vehículo sin tocar las líneas fijas.")
      : pr.tipo === "llenar" ? `Con esto ${pr.despues.n === 1 ? "queda" : "quedan"} ${nVeh(pr.despues.n)} al ${pcts(pr.despues.ocupaciones)} (antes ${pcts(pr.antes.ocupaciones)}).`
      : `Con esto la carga queda en ${nVeh(pr.despues.n)} al ${pcts(pr.despues.ocupaciones)} (antes ${nVeh(pr.antes.n)}).`;
    return caja(
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 font-semibold">
          {pr.tipo === "llenar" ? <PackagePlus size={15} color={T.ok} /> : <PackageMinus size={15} color={T.aviso} />}
          <span className="flex-1">{pr.tipo === "llenar" ? "Pedido sugerido para llenar" : pr.tipo === "reacomodo" ? "Cabe reacomodando" : "Disminución sugerida"}</span>
          <button onClick={onCerrar} aria-label="Cerrar"><X size={14} color={T.suave} /></button>
        </div>
        <p className="text-xs mt-1" style={{ color: sinCambio ? T.suave : T.tinta }}>{mensaje}</p>
        {/* Llenar significa que no cabe ni una caja más de ninguna referencia, y eso se comprueba caja por
            caja. Si no alcanzó a comprobarse, se dice: prometer que está lleno y que luego entre una más
            a mano es lo que hace que nadie le crea a la propuesta. */}
        {pr.tipo === "llenar" && !sinCambio && (
          pr.saturado
            ? <p className="mt-1" style={{ fontSize: 10, color: T.ok }}>Comprobado referencia por referencia: no cabe ni una caja más sin sumar un vehículo.</p>
            : pr.rapido
              ? <p className="mt-1" style={{ fontSize: 10, color: T.suave }}>Base rápida: cabe seguro, pero no es el máximo. Ajusta las cantidades que quieras y, si buscas exprimirlo, dale a «Llenar hasta el tope».</p>
              : <p className="mt-1" style={{ fontSize: 10, color: T.aviso }}>No alcanzó a comprobarse que quede lleno del todo: puede que todavía entre alguna caja más.</p>
        )}
        {optim.nivel === 1 && !(pr.tipo === "llenar" && (pr.rapido || sinCambio)) && <p className="mt-1" style={{ fontSize: 10, color: T.aviso }}>Calculado en nivel 1 (rápido): es aproximado. El cálculo bueno puede meter un poco más.</p>}
        {/* Que sobre volumen no quiere decir que quepa otra caja: decir en qué eje se quedó corto
            convierte el «no» en algo que el comercial puede usar. */}
        {pr.motivo === "noCabeMas" && pr.porQue?.ejes?.length > 0 && (
          <p className="mt-1" style={{ fontSize: 10, color: T.suave }}>
            Al acomodo le sobran {pr.porQue.ejes.map(([eje, mm]) => `${Math.round(mm)} mm ${eje}`).join(" y ")}
            {pr.porQue.menor > 0 ? `, y la caja más chica del pedido mide ${Math.round(pr.porQue.menor)} mm por su lado menor.` : "."} Ese espacio existe pero no da para otro bulto.
          </p>
        )}
        {sinCambio && pr.tipo === "llenar" && !optim.saturar && <p className="mt-1" style={{ fontSize: 10, color: T.suave }}>Es la búsqueda rápida. «Buscar a fondo» usa el nivel bueno y comprueba referencia por referencia; tarda, pero es la palabra final.</p>}
        {/* Con o sin la simulación de cargue son dos conversaciones distintas con el andén: una dice qué va
            a pasar de verdad y la otra, cuánto espacio hay en el contenedor. Conviene poder ver las dos. */}
        {optim.sinSimular && <p className="mt-1" style={{ fontSize: 10, color: T.aviso }}>
          Calculado sin simular la carga real: es el óptimo geométrico, sin compresión, sin holgura entre bloques y sin bultos de pie. Es más optimista que el andén. Al aplicarlo queda apagada la simulación en Reglas.
        </p>}
        {pr.cambios.length > 0 && (
          <table className="w-full text-xs mt-2">
            <thead><tr style={{ color: T.suave }}><th className="text-left font-normal">SKU</th><th className="text-right font-normal">Actual</th><th className="text-right font-normal">Cambio</th><th className="text-right font-normal">Nuevo</th><th /></tr></thead>
            <tbody>
              {pr.cambios.map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${T.linea}`, opacity: fijas.has(c.id) ? 0.5 : 1 }}>
                  <td className="py-1 pr-1 truncate" style={{ maxWidth: 110 }} title={c.nombre}>{c.nombre}</td>
                  <td className="text-right">{c.actual.toLocaleString("es-MX")}</td>
                  <td className="text-right font-semibold" style={{ color: c.delta > 0 ? T.ok : T.error }}>{c.delta > 0 ? "+" : ""}{c.delta.toLocaleString("es-MX")}</td>
                  <td className="text-right">{c.nuevo.toLocaleString("es-MX")}</td>
                  <td className="text-right pl-1">
                    <button onClick={() => alternarFija(c.id)} title={fijas.has(c.id) ? "Esta línea no se toca. Clic para permitir cambiarla" : "Fijar: no cambiar esta línea"} aria-label={fijas.has(c.id) ? "Soltar línea" : "Fijar línea"}>
                      {fijas.has(c.id) ? <Lock size={12} color={T.nav} /> : <Unlock size={12} color={T.suave} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pr.cambios.length > 0 && !cambiaron && <p className="flex items-start gap-1 mt-1.5" style={{ fontSize: 10, color: T.suave }}><Info size={11} className="flex-none mt-px" />Comprobado en nivel 4. El candado deja una línea sin tocar.</p>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {cambiaron
            ? <Boton primario onClick={() => onCalcular(optim.tipo, fijas)}>Recalcular sin tocar las fijas</Boton>
            : !sinCambio && <Boton primario onClick={onAplicar}><CheckCircle2 size={13} />Aplicar</Boton>}
          {/* Si no encontró nada en nivel 4, en nivel 1 a veces sí: el cálculo de referencia también
              acomoda peor, así que queda más hueco por llenar. Y sale en segundos. */}
          {/* La base sale en segundos; exprimirla hasta que no entre ni una caja más son decenas de
              corridas, así que se pide aparte y solo cuando esa base ya le sirve al comercial. */}
          {pr.tipo === "llenar" && !sinCambio && !pr.saturado && (
            <Boton onClick={() => onCalcular("llenar", fijas, { saturar: true })} titulo="Exprime la carga: mete más hasta que no quepa ni una caja de ninguna referencia. Tarda más, porque lo comprueba una por una.">
              <PackagePlus size={13} />Llenar hasta el tope
            </Boton>
          )}
          {/* La base rápida va en nivel 1 y no exprime, así que su «no cabe nada» es un primer veredicto,
              no el último: queda el botón para buscar a fondo antes de darlo por cerrado. */}
          {sinCambio && pr.tipo === "llenar" && !optim.saturar && (
            <Boton primario onClick={() => onCalcular("llenar", fijas, { saturar: true })} titulo="Repite la búsqueda en el nivel bueno y comprobando referencia por referencia. Tarda, pero es la palabra final."><PackagePlus size={13} />Buscar a fondo</Boton>
          )}
          {sinCambio && optim.nivel !== 1 && (
            <Boton onClick={() => onCalcular(optim.tipo, fijas, { nivel: 1 })} titulo="Repite la búsqueda en nivel 1: sale en segundos y a veces encuentra lo que el nivel 4 descartó"><Zap size={13} />Probar rápido (nivel 1)</Boton>
          )}
          {/* Correr la misma búsqueda con o sin la simulación de cargue */}
          {optim.sinSimular
            ? <Boton onClick={() => onCalcular(optim.tipo, fijas, { nivel: optim.nivel })} titulo="Repite la misma búsqueda simulando la carga real: compresión, holgura entre bloques y bultos de pie, como en el andén">Probar con la simulación</Boton>
            : cargaReal && <Boton onClick={() => onCalcular(optim.tipo, fijas, { nivel: optim.nivel, sinSimular: true })} titulo="Repite la misma búsqueda sin simular la carga real: maximiza el espacio geométrico. Sirve para saber si el vehículo de más lo decide el acomodo o la simulación."><Maximize2 size={13} />Probar sin simular</Boton>}
          <Boton onClick={onCerrar}>{sinCambio ? "Cerrar" : "Cancelar"}</Boton>
        </div>
        <NotaCargaReal costo={costoReal} onQuitarSimulacion={onQuitarSimulacion} />
      </div>
    );
  }

  // Ofrecimiento: aparece solo si hay algo que hacer
  if (oculto) return null;
  const n = reporte.contenedores.length, ult = reporte.contenedores[n - 1];
  const yaLleno = !!lleno?.lleno, midiendoLleno = !!lleno?.midiendo;
  const sinCargar = reporte.avisos.some((a) => a.tipo === "sinCargar" || a.tipo === "noCaben");
  // Siempre se ofrece llenar mientras quede algo de espacio: si al final no cabe ni una caja más, la
  // sugerencia lo dice en una línea. Un tope de ocupación dejaba fuera cargas al 91% donde sí cabía más.
  const hayQueAumentar = items.some((it) => it.qty > 0 && !it.fijo);
  const llenar = ult && !sinCargar && hayQueAumentar && ult.ocupacion < 99.5 && (ult.utilPeso == null || ult.utilPeso < 98);
  const reducir = n >= 2;
  // Con más de un vehículo hay tres palancas más, y las tres cambian la decisión de paletizado o de
  // Bundles, no las cantidades del pedido. Solo se ofrecen cuando pueden aplicar, para no llenar de botones.
  const paletizados = items.filter((it) => it.paletizar && it.qty > 0 && !it.fijo).length;
  const hayBundles = items.some((it) => it.enBundle && it.qty > 0);
  const sinPaletizar = n >= 2 && paletizados > 0;
  const mixtos = n >= 2 && items.filter((it) => it.paletizar === true && it.qty > 0 && !it.fijo).length >= 2;
  const bundles = n >= 2 && hayBundles;
  if ((!llenar || (yaLleno && lleno.comprobado)) && !reducir && !yaLleno && !midiendoLleno) return null;
  return caja(
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-xs">
          <b>{n === 1 ? `El vehículo va al ${ult.ocupacion.toFixed(0)}%.` : `El vehículo ${n} va al ${ult.ocupacion.toFixed(0)}%.`}</b>{" "}
          {/* Antes decía «Hay espacio para más de los SKUs de este pedido», y eso es una promesa que la
              tarjeta no puede hacer: que sobre volumen no quiere decir que quepa otra caja. Con un solo SKU
              que embaldosa mal el vehículo, el 85% ES el máximo, y el usuario daba Llenar para que le
              contestaran que no cabe nada. Ahora se dice el dato (cuánto va ocupado) y se ofrece buscar. */}
          {reducir && llenar ? "Puedes bajar el pedido para usar un vehículo menos, o buscar si cabe algo más."
            : reducir ? "Puedes bajar el pedido para usar un vehículo menos."
            : yaLleno ? (lleno.comprobado
                ? "Está lleno: se comprobó referencia por referencia que no cabe ni una caja más sin sumar un vehículo."
                : `Está lleno: ni una caja más de ${lleno.sku || "la referencia más chica"} entra sin sumar un vehículo. El volumen que sobra no da para otro bulto.`)
            : midiendoLleno ? "Revisando si todavía cabe algo…"
            : `Queda ${(100 - ult.ocupacion).toFixed(0)}% de volumen sin usar, aunque no siempre se puede aprovechar: puedo buscar si cabe algo más.`}
        </span>
        <button onClick={() => setOculto(true)} aria-label="Ocultar sugerencias"><X size={14} color={T.suave} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {reducir && <Boton primario onClick={() => onCalcular("reducir", fijas)} titulo="Primero prueba reacomodar sin cambiar cantidades; si no alcanza, sugiere qué bajar. Calcula en nivel 4."><PackageMinus size={13} />Sugerir disminución del pedido</Boton>}
        {llenar && !yaLleno && !midiendoLleno && <Boton primario={!reducir} onClick={() => onCalcular("llenar", fijas)} titulo="Busca cuántas cajas más de los SKUs de este pedido caben sin sumar vehículos. Da una base en segundos."><PackagePlus size={13} />{n === 1 ? "Llenar con pedido sugerido" : `Llenar el vehículo ${n}`}</Boton>}
        {yaLleno && !lleno.comprobado && llenar && <Boton onClick={() => onCalcular("llenar", fijas, { saturar: true })} titulo="Comprueba una por una todas las referencias del pedido, no solo la más chica. Tarda, pero es la palabra final."><PackagePlus size={13} />Comprobar a fondo</Boton>}
        {sinPaletizar && <Boton onClick={() => onCalcular("sinPaletizar", fijas)} titulo="Prueba uno por uno los SKUs paletizados: un pallet cobra su tarima y el aire de arriba, y suelto ese SKU rellena los huecos de los demás."><PackageMinus size={13} />¿Y si un SKU va suelto?</Boton>}
        {mixtos && <Boton onClick={() => onCalcular("palletMixto", fijas)} titulo="Hay pallets de un solo SKU que van medio vacíos. Prueba armarlos como pallets mixtos para liberar piso."><Layers size={13} />Juntar pallets medio vacíos</Boton>}
        {bundles && <Boton onClick={() => onCalcular("abrirBundles", fijas)} titulo="Elige a mano cuántos Bundles se abren de cada SKU y recalcula."><PackageOpen size={13} />Elegir qué Bundles abrir</Boton>}
      </div>
      {/* Más de un vehículo y con la simulación prendida: se propone, con su mensaje, buscar el acomodo sin
          la simulación. No es lo mismo que «Ver sin simular» (ese solo muestra la misma carga sin el flag):
          esto rehace la búsqueda entera maximizando el espacio, y así se ve si el vehículo de más lo decide
          el acomodo o lo decide la simulación. */}
      {reducir && cargaReal && (
        <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.linea}` }}>
          <p className="flex items-start gap-1.5" style={{ fontSize: 11 }}>
            <Info size={12} color={T.aviso} className="flex-none mt-px" />
            <span>Esto salió en {nVeh(n)} simulando la carga real. También puedes buscar el acomodo <b>sin la simulación</b>, maximizando el espacio: sale más optimista que el andén, pero dice si el vehículo de más lo decide el acomodo o lo decide la simulación.</span>
          </p>
          <div className="mt-1.5">
            <Boton onClick={() => onCalcular("reducir", fijas, { sinSimular: true })} titulo="Rehace la búsqueda sin compresión, sin holgura entre bloques y sin bultos de pie">
              <Maximize2 size={13} />Optimizar sin simular
            </Boton>
          </div>
        </div>
      )}
      <NotaCargaReal costo={costoReal} onQuitarSimulacion={onQuitarSimulacion} />
    </div>
  );
}
