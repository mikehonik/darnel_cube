import { Fragment, useRef, useState } from "react";
import { Download, AlertTriangle, Loader2, FileSpreadsheet, ChevronDown, PanelBottomClose, PanelBottomOpen } from "lucide-react";
import { T } from "../tema.js";
import { ORIENTACIONES } from "../../motor/reporte.js";
import { Dato } from "../controles.jsx";

export function PanelResultados({ colores, descargarInstructivo, descargarResultados, generando, modoPallet, palVista, pestana, reporte, res, resaltado, sel, setPestana, setResaltado, stats, verPallet, vista, editarOris, oculto, setOculto }) {
  // Altura del panel: se arrastra desde el borde superior y crece sola cuando la pestaña activa es una tabla
  const [alto, setAlto] = useState(250);
  const [abierta, setAbierta] = useState(null);   // línea desplegada en la lista de carga
  const arrastre = useRef(null);
  const altoEfectivo = ["lista", "entregas", "pallets"].includes(pestana) ? Math.max(alto, 340) : alto;
  const iniciarArrastre = (e) => {
    arrastre.current = { y: e.clientY, alto: altoEfectivo }; e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moverArrastre = (e) => {
    if (!arrastre.current) return;
    setAlto(Math.min(window.innerHeight - 260, Math.max(160, arrastre.current.alto + (arrastre.current.y - e.clientY))));
  };
  const soltarArrastre = () => { arrastre.current = null; };
  if (oculto) {
    return (
      <div className="flex-none flex items-center gap-2 px-3 py-1.5" style={{ background: T.sup, borderTop: `1px solid ${T.linea}` }}>
        <span className="text-xs" style={{ color: T.suave }}>
          Resultados ocultos{stats ? ` · ${reporte.contenedores.length} ${reporte.contenedores.length === 1 ? "vehículo" : "vehículos"} · ${stats.ocupacion.toFixed(0)}% el primero` : ""}
        </span>
        <div className="flex-1" />
        <button onClick={() => setOculto(false)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md" style={{ border: `1px solid ${T.linea}` }} title="Mostrar el panel de resultados">
          <PanelBottomOpen size={14} />Mostrar resultados
        </button>
      </div>
    );
  }
  return (
    <div className="flex-none flex flex-col relative" style={{ height: altoEfectivo, background: T.sup, borderTop: `1px solid ${T.linea}` }}>
      <div onPointerDown={iniciarArrastre} onPointerMove={moverArrastre} onPointerUp={soltarArrastre} onDoubleClick={() => setAlto(250)} role="separator" aria-orientation="horizontal" aria-label="Cambiar altura del panel de resultados" title="Arrastra para cambiar la altura · doble clic para restablecer"
        className="absolute left-0 right-0 flex justify-center" style={{ top: -5, height: 10, cursor: "row-resize", zIndex: 5 }}>
        <span className="rounded-full mt-1" style={{ width: 44, height: 4, background: T.linea }} />
      </div>
      <div className="flex items-center gap-1 px-3 flex-none" style={{ borderBottom: `1px solid ${T.linea}` }} role="tablist">
        {[["resumen", "Resumen"], ["lista", "Lista de carga"], ...(reporte?.conEntregas ? [["entregas", `Entregas${stats?.estorban ? " ⚠" : ""}`]] : []), ["pallets", `Pallets armados${reporte?.pallets.length ? ` (${reporte.pallets.length})` : ""}`], ["avisos", `Avisos${reporte?.avisos.length ? ` (${reporte.avisos.length})` : ""}`]].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)} className="text-sm px-3 py-2.5 relative whitespace-nowrap"
            style={{ color: pestana === k ? T.tinta : T.suave, fontWeight: pestana === k ? 600 : 400 }}>
            {t}
            <span className="absolute left-2 right-2 bottom-0" style={{ height: 2, background: pestana === k ? T.acento : "transparent" }} />
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setOculto(true)} className="flex items-center text-xs px-2 py-1.5 rounded-md mr-1" style={{ border: `1px solid ${T.linea}`, color: T.suave }} aria-label="Ocultar el panel de resultados" title="Ocultar el panel y dejar el visor completo">
          <PanelBottomClose size={14} />
        </button>
        {res && res.contenedores.length > 0 && (
          <div className="flex gap-1.5">
            <button onClick={descargarResultados} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap" style={{ border: `1px solid ${T.linea}` }} title="Resumen, lista de carga, pallets y pasos de todos los vehículos"><Download size={14} />Excel</button>
            <button onClick={descargarInstructivo} disabled={generando || !!palVista} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap" style={{ background: T.nav, color: "#fff", opacity: generando || palVista ? 0.6 : 1 }} title="Pasos con imágenes para el equipo de carga">
              {generando ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}Instructivo {sel + 1}
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {!res ? <p className="text-sm" style={{ color: T.suave }}>Los resultados aparecerán aquí.</p> : (
          <>
            {pestana === "resumen" && (palVista ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Dato t="Cajas" v={palVista.n} s={`${palVista.piezas.toLocaleString("es-MX")} piezas`} />
                <Dato t="Altura total" v={`${palVista.alto.toLocaleString("es-MX")} mm`} s="con tarima" />
                <Dato t="Peso total" v={`${palVista.peso.toLocaleString("es-MX")} kg`} s="con tarima" />
                <Dato t="Tope" v={palVista.techoPlano ? "Plano" : "Irregular"} s={palVista.techoPlano ? "puede recibir carga" : "no recibe carga encima"} />
                <Dato t="Utilización del pallet" v={`${(palVista.utilVol * 100).toFixed(0)}%`} s="del espacio permitido sobre la tarima" />
                <Dato t="Huella" v={`${Math.round(palVista.L)} × ${Math.round(palVista.W)} mm`} s={`tarima ${palVista.palL} × ${palVista.palW}`} />
                <Dato t="Sobresale" v={palVista.sobraL || palVista.sobraW ? `${Math.round(palVista.sobraL)} / ${Math.round(palVista.sobraW)} mm` : "Nada"} s={`por lado, a lo largo / ancho · permitido ${palVista.ovL} / ${palVista.ovW}`} />
                <Dato t="Armado" v={palVista.capas ? `${palVista.capas} × ${palVista.porCapa}` : "Por bloques"} s={palVista.capas ? `capas × cajas por capa${palVista.alternado ? " · entrelazadas" : ""}` : "pallet mixto"} />
              </div>
            ) : stats && (
              <>
                <div className={`grid grid-cols-2 gap-2 mb-3 ${reporte.conEntregas ? "md:grid-cols-6" : "md:grid-cols-5"}`}>
                  <Dato t={modoPallet ? "Pallets" : "Vehículos"} v={reporte.contenedores.length} s={`mejor de ${reporte.estrategiasProbadas} intentos`} />
                  <Dato t="Utilización volumétrica" v={`${stats.ocupacion.toFixed(1)}%`} s={`${stats.m3.toLocaleString("es-MX", { maximumFractionDigits: 1 })} de ${stats.m3Cap.toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³`} />
                  <Dato t="Utilización de peso" v={stats.utilPeso != null ? `${stats.utilPeso.toFixed(1)}%` : "—"} s={`${Math.round(stats.peso).toLocaleString("es-MX")} kg de carga${reporte.vehiculo.maxKg ? ` · bruto ${Math.round(stats.pesoBruto).toLocaleString("es-MX")} / ${reporte.vehiculo.maxKg.toLocaleString("es-MX")}` : ""}`} />
                  <Dato t="Bultos" v={stats.nBultos.toLocaleString("es-MX")} s={stats.nPallets ? `${stats.nPallets} pallets · ${stats.nCajas.toLocaleString("es-MX")} cajas` : `${stats.piezas.toLocaleString("es-MX")} piezas`} />
                  <Dato t="Centro de gravedad" v={`${stats.cgLargo.toFixed(0)}%`} s={`del fondo · ${Math.round(stats.cgLateral)} mm lateral`} />
                  {reporte.conEntregas && <Dato t="Bultos que estorban" v={stats.estorban || 0} s={stats.estorban ? "hay que moverlos al descargar" : "descarga limpia por entrega"} />}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3 md:grid-cols-3">
                  <Dato t="Metros lineales libres" v={`${stats.mLibres.toLocaleString("es-MX", { maximumFractionDigits: 2 })} m`} s={`de ${stats.mTotal.toLocaleString("es-MX", { maximumFractionDigits: 1 })} m · usados ${stats.mUsados.toLocaleString("es-MX", { maximumFractionDigits: 2 })} m`} />
                  {stats.ejes && (
                    <>
                      <Dato t="Eje delantero" v={`${stats.ejes.delantero.carga.toLocaleString("es-MX")} kg`}
                        s={<span style={{ color: stats.ejes.delantero.alerta ? T.error : T.suave }}>{stats.ejes.delantero.pct}% de {stats.ejes.delantero.maximo.toLocaleString("es-MX")} kg{stats.ejes.delantero.alerta ? " · excedido" : ""}</span>} />
                      <Dato t="Eje trasero" v={`${stats.ejes.trasero.carga.toLocaleString("es-MX")} kg`}
                        s={<span style={{ color: stats.ejes.trasero.alerta ? T.error : T.suave }}>{stats.ejes.trasero.pct}% de {stats.ejes.trasero.maximo.toLocaleString("es-MX")} kg{stats.ejes.trasero.alerta ? " · excedido" : ""}</span>} />
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.lista.map((f) => {
                    const k = f.idx, act = resaltado === k;
                    return (
                      <button key={k} onClick={() => setResaltado(act ? null : k)} aria-pressed={act} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                        style={{ border: `1px solid ${act ? T.nav : T.linea}`, background: act ? T.shell : T.sup }}>
                        <span style={{ width: 8, height: 8, background: colores[k], borderRadius: 99 }} />{f.nombre} · {f.total}
                      </button>
                    );
                  })}
                </div>
              </>
            ))}
            {pestana === "lista" && (palVista ? <p className="text-sm" style={{ color: T.suave }}>Vuelve al vehículo para ver su lista de carga.</p> : stats && (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs" style={{ color: T.suave }}><th className="font-medium py-1">SKU</th><th className="font-medium">Entrega</th><th className="font-medium">Sueltas</th><th className="font-medium">En pallet</th><th className="font-medium">Total cajas</th><th className="font-medium">m³</th><th className="font-medium">Peso</th></tr></thead>
                <tbody>
                  {stats.lista.map((f) => (
                    <Fragment key={f.idx}>
                      <tr className="fila" style={{ borderTop: `1px solid ${T.linea}` }}>
                        <td className="py-1.5">
                          <button onClick={() => setAbierta(abierta === f.idx ? null : f.idx)} aria-expanded={abierta === f.idx} className="inline-flex items-center gap-1 text-left" title="Ver cómo quedó acomodado">
                            <ChevronDown size={13} style={{ transform: abierta === f.idx ? "none" : "rotate(-90deg)", transition: "transform .15s", color: T.suave }} />
                            <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: colores[f.idx] }} />
                            {f.nombre}
                          </button>
                        </td>
                        <td>{f.orden || <span style={{ color: T.suave }}>Libre</span>}</td><td>{f.sueltas}</td><td>{f.enPallet}</td><td className="font-medium">{f.total}</td>
                        <td>{f.m3.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                        <td>{Math.round(f.peso).toLocaleString("es-MX")} kg</td>
                      </tr>
                      {abierta === f.idx && (
                        <tr>
                          <td colSpan={7} className="px-3 pb-3" style={{ background: "#F7F9FB" }}>
                            <p className="text-xs mt-2 mb-1" style={{ color: T.suave }}>
                              Caja de {f.L} × {f.W} × {f.H} mm · {f.m3.toLocaleString("es-MX", { maximumFractionDigits: 3 })} m³ en total · quedó acomodada así:
                            </p>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {f.orientaciones.map((o) => (
                                <span key={o.ori} className="text-xs px-2 py-0.5 rounded-full" style={{ background: T.shell, border: `1px solid ${T.linea}` }}>
                                  {o.nombre} · <b>{o.n}</b>
                                </span>
                              ))}
                            </div>
                            {editarOris && (
                              <>
                                <p className="text-xs mb-1" style={{ color: T.suave }}>Orientaciones permitidas. Al cambiarlas se recalcula la carga.</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {ORIENTACIONES.map((n, k) => {
                                    const on = f.permitidas.includes(k);
                                    return (
                                      <button key={k} onClick={() => editarOris(f.idx, k)} aria-pressed={on} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ border: `1px solid ${on ? T.nav : T.linea}`, background: on ? T.nav : T.sup, color: on ? "#fff" : T.suave }}>
                                        {n}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            ))}
            {pestana === "entregas" && (stats?.entregas?.length ? (
              <>
                <p className="text-xs mb-2" style={{ color: T.suave }}>Orden de descarga, de las puertas hacia el fondo. «Estorban» son los bultos que habría que mover para llegar a esa entrega.</p>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs" style={{ color: T.suave }}><th className="font-medium py-1">Entrega</th><th className="font-medium">Destino</th><th className="font-medium">Pedidos</th><th className="font-medium">Bultos</th><th className="font-medium">Volumen</th><th className="font-medium">Zona (desde las puertas)</th><th className="font-medium">Estorban</th></tr></thead>
                  <tbody>
                    {stats.entregas.map((e) => (
                      <tr key={e.orden} style={{ borderTop: `1px solid ${T.linea}` }}>
                        <td className="py-1.5 font-medium">{e.orden}</td><td>{e.destinos.join(", ") || <span style={{ color: T.suave }}>—</span>}</td><td style={{ color: T.suave }}>{e.pedidos.join(", ") || "—"}</td><td>{e.n}</td><td>{(e.vol / 1e9).toFixed(1)} m³</td>
                        <td>{(e.desdePuertas / 1e3).toFixed(1)} – {(e.hastaPuertas / 1e3).toFixed(1)} m</td><td style={{ color: e.estorban ? T.aviso : T.ok }}>{e.estorban || "ninguno"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : <p className="text-sm" style={{ color: T.suave }}>Pon un número de entrega en la columna Entrega y activa «Ordenar por entrega» en Reglas.</p>)}
            {pestana === "pallets" && (reporte.pallets.length === 0 ? <p className="text-sm" style={{ color: T.suave }}>Esta carga no tiene pallets armados.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs" style={{ color: T.suave }}><th className="font-medium py-1">Pallet</th><th className="font-medium">Cajas</th><th className="font-medium">Alto</th><th className="font-medium">Peso</th><th className="font-medium">Cantidad</th><th></th></tr></thead>
                <tbody>
                  {reporte.pallets.map((d) => (
                    <tr key={d.i} style={{ borderTop: `1px solid ${T.linea}`, background: vista === d.i ? T.shell : "transparent" }}>
                      <td className="py-1.5">{d.nombre}<span className="block text-xs" style={{ color: T.suave }}>{d.tipoPallet} · tope {d.techoPlano ? "plano" : "irregular"}{d.alternado ? " · capas entrelazadas" : ""}</span></td>
                      <td>{d.n}</td><td>{Math.round(d.alto).toLocaleString("es-MX")} mm</td><td>{Math.round(d.peso).toLocaleString("es-MX")} kg</td><td>× {d.usos}</td>
                      <td className="text-right"><button onClick={() => verPallet(d.i)} className="text-xs px-2 py-1 rounded-md" style={{ border: `1px solid ${T.linea}` }}>Ver armado</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
            {pestana === "avisos" && (reporte.avisos.length === 0 ? <p className="text-sm" style={{ color: T.ok }}>Todo se cargó sin avisos.</p> : (
              <ul className="text-sm flex flex-col gap-1.5">
                {reporte.avisos.map((a, i) => <li key={i} className="flex gap-2" style={{ color: a.tipo === "motor" ? T.aviso : T.error }}><AlertTriangle size={16} className="flex-none mt-0.5" />{a.texto}</li>)}
              </ul>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
